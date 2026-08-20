import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { SignJWT } from 'jose';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { CUSTOMER_JWT_ISSUER } from '../src/auth/constants.js';
import { HttpExceptionFilter } from '../src/common/http-exception.filter';

interface ErrorBody {
  error: { code: string; message: string; details: unknown };
}

interface OrderBody {
  id: string;
  status: string;
  totalAmount: string;
  branchId: string;
  customerId: string;
  items: { variantId: string; quantity: number; unitPriceSnapshot: string }[];
  payUrl?: string;
  qrText?: string;
  bankDeeplinks?: { bankName: string; link: string }[];
}

function getJwtSecret(): Uint8Array {
  return new TextEncoder().encode(process.env.JWT_SECRET ?? '');
}

// docs/adr/001: RlsMiddleware нь HTTP хариу 'finish' болмогц транзакцийн
// commit-г ЭХЛҮҮЛДЭГ (commit өөрөө нэмэлт round-trip шаарддаг) — supertest
// талын .expect(...) HTTP хариу хүлээн авмагцаа шууд resolve хийдэг тул
// маш ховор тохиолдолд дараагийн мөр дэх ӨӨР connection-оор (superuserPrisma)
// хийсэн шалгалт commit хараахан бүрэн бэлэн болоогүй байхад гүйцэтгэгдэж
// болзошгүй (benign race, бүтээгдэхүүний алдаа биш). Иймд checkout/status
// шинэчлэлтийн ДАРАА ижил датаг өөр connection-оор шалгах assertion бүрийг
// богино polling-оор эрүүлжүүлнэ.
async function waitFor<T>(
  fn: () => Promise<T | null>,
  timeoutMs = 1000,
  intervalMs = 25,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const result = await fn();
    if (result !== null) {
      return result;
    }
    if (Date.now() > deadline) {
      throw new Error('waitFor: хугацаа дууслаа, нөхцөл хангагдсангүй');
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

// docs/adr/002-той ижил: JWT зөвхөн identity нотолно, эрх DB-ээс уншина.
async function mintAccessToken(userId: string): Promise<string> {
  return new SignJWT({ typ: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuer(CUSTOMER_JWT_ISSUER)
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(getJwtSecret());
}

// (2026-08-20, Cart→Checkout→QPay) OrderService.checkout() одоо
// item-үүдийг ХЭЗЭЭ Ч HTTP body-оос биш, зөвхөн Redis-ийн cart-аас уншина
// (`checkout-order.dto.ts`-ийн толгой тайлбарыг үз) — тул checkout-оос
// ӨМНӨ ЗААВАЛ `POST /cart/items`-ээр сагсанд бичих ёстой.
// `addOrUpdateItem` upsert-set семантиктай тул давхар дуудахад ч зүгээр
// (шинэ quantity-гаар л дарж бичнэ).
async function setCartItem(
  app: INestApplication<App>,
  token: string,
  variantId: string,
  quantity: number,
): Promise<void> {
  await request(app.getHttpServer())
    .post('/cart/items')
    .set('Authorization', `Bearer ${token}`)
    .send({ variantId, quantity })
    .expect(201);
}

// docs/plan.md §8 Phase 3a: checkout, state machine, RLS/inventory-той
// холбоотой SAVEPOINT атомик байдлыг бодит Postgres-тэй турших.
describe('Orders (e2e)', () => {
  let app: INestApplication<App>;
  let superuserPrisma: PrismaClient;

  let branchA: { id: string };
  let branchB: { id: string };

  let superAdminToken: string;
  let branchManagerAToken: string;
  let salespersonAToken: string;
  let customerToken: string;
  let otherCustomerToken: string;
  let customerId: string;

  let variantId: string;
  let variantBasePrice: number;
  let inventoryItemId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // src/main.ts-тэй ижил заавал (app.init()-ээс ӨМНӨ) — эс бөгөөс
    // OrderEventsGateway "server.adapter is not a function" алдаа шидэж
    // app.init() бүхэлдээ унана.
    app.useWebSocketAdapter(new IoAdapter(app));
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    superuserPrisma = new PrismaClient({
      datasources: { db: { url: process.env.DATABASE_URL } },
    });

    branchA = await superuserPrisma.branch.create({
      data: { name: `Захиалга Салбар А ${Date.now()}` },
    });
    branchB = await superuserPrisma.branch.create({
      data: { name: `Захиалга Салбар Б ${Date.now()}` },
    });

    const superAdminId = randomUUID();
    const branchManagerAId = randomUUID();
    const salespersonAId = randomUUID();
    const otherCustomerId = randomUUID();
    customerId = randomUUID();

    await superuserPrisma.user.create({
      data: {
        id: superAdminId,
        email: `super-${superAdminId}@example.com`,
        authProvider: 'KEYCLOAK',
      },
    });
    await superuserPrisma.userBranchRole.create({
      data: { userId: superAdminId, branchId: null, role: 'SUPER_ADMIN' },
    });

    await superuserPrisma.user.create({
      data: {
        id: branchManagerAId,
        email: `mgr-a-${branchManagerAId}@example.com`,
        authProvider: 'KEYCLOAK',
      },
    });
    await superuserPrisma.userBranchRole.create({
      data: {
        userId: branchManagerAId,
        branchId: branchA.id,
        role: 'BRANCH_MANAGER',
      },
    });

    await superuserPrisma.user.create({
      data: {
        id: salespersonAId,
        email: `sales-a-${salespersonAId}@example.com`,
        authProvider: 'KEYCLOAK',
      },
    });
    await superuserPrisma.userBranchRole.create({
      data: {
        userId: salespersonAId,
        branchId: branchA.id,
        role: 'SALESPERSON',
      },
    });

    await superuserPrisma.user.create({
      data: {
        id: customerId,
        phone: `+9769${Date.now().toString().slice(-8)}`,
        authProvider: 'CUSTOMER_AUTH',
      },
    });
    await superuserPrisma.user.create({
      data: {
        id: otherCustomerId,
        phone: `+9768${Date.now().toString().slice(-8)}`,
        authProvider: 'CUSTOMER_AUTH',
      },
    });

    superAdminToken = await mintAccessToken(superAdminId);
    branchManagerAToken = await mintAccessToken(branchManagerAId);
    salespersonAToken = await mintAccessToken(salespersonAId);
    customerToken = await mintAccessToken(customerId);
    otherCustomerToken = await mintAccessToken(otherCustomerId);

    // Каталог + агуулах: branchPrice override-той (39000, basePrice 45000-с
    // доогуур) — unitPriceSnapshot нь override утгыг ашиглаж байгааг
    // шалгахад ашиглана (resolveEffectivePrice, inventory-effective.util.ts).
    const unique = Date.now();
    const category = await superuserPrisma.category.create({
      data: {
        name: `Захиалгын ангилал ${unique}`,
        slug: `zahialga-angilal-${unique}`,
      },
    });
    const product = await superuserPrisma.product.create({
      data: {
        name: 'Захиалгын бүтээгдэхүүн',
        slug: `zahialga-buteegdehuun-${unique}`,
        categoryId: category.id,
      },
    });
    variantBasePrice = 45000;
    const variant = await superuserPrisma.productVariant.create({
      data: {
        productId: product.id,
        name: 'Стандарт',
        sku: `zahialga-sku-${unique}`,
        basePrice: variantBasePrice,
      },
    });
    variantId = variant.id;

    const inventoryItem = await superuserPrisma.inventoryItem.create({
      data: {
        variantId,
        branchId: branchA.id,
        quantity: 5,
        branchPrice: 39000,
      },
    });
    inventoryItemId = inventoryItem.id;
  });

  afterAll(async () => {
    await app.close();
    await superuserPrisma.$disconnect();
  });

  it('CUSTOMER 2 ширхэг захиалахад Order+OrderItem үүсэж, branchPrice override-оор unitPriceSnapshot тооцогдож, нөөц decrement хийгдэнэ', async () => {
    await setCartItem(app, customerToken, variantId, 2);
    const res = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ branchId: branchA.id })
      .expect(201);

    const body = res.body as OrderBody;
    expect(body.status).toBe('CREATED');
    expect(body.customerId).toBe(customerId);
    expect(Number(body.totalAmount)).toBe(39000 * 2);
    expect(body.items).toHaveLength(1);
    expect(Number(body.items[0].unitPriceSnapshot)).toBe(39000);
    expect(body.items[0].quantity).toBe(2);

    const item = await waitFor(async () => {
      const row = await superuserPrisma.inventoryItem.findUnique({
        where: { id: inventoryItemId },
      });
      return row && row.quantity === 3 ? row : null;
    });
    expect(item.quantity).toBe(3);

    const auditRow = await waitFor(() =>
      superuserPrisma.auditLog.findFirst({
        where: { tableName: 'orders', recordId: body.id },
        orderBy: { createdAt: 'desc' },
      }),
    );
    expect(auditRow).not.toBeNull();
  });

  it('CUSTOMER амжилттай checkout хийсний дараа payUrl/qrText/bankDeeplinks буцаана, Redis сагс цэвэрлэгдэнэ', async () => {
    await setCartItem(app, customerToken, variantId, 1);
    const res = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ branchId: branchA.id })
      .expect(201);

    const body = res.body as OrderBody;
    expect(typeof body.payUrl).toBe('string');
    expect(typeof body.qrText).toBe('string');
    expect(Array.isArray(body.bankDeeplinks)).toBe(true);

    // Checkout онCommit()-гэйт cart цэвэрлэлт — RLS transaction COMMIT
    // хийгдсэний дараа л явагдах тул waitFor()-оор эрүүлжүүлнэ (энэ
    // файлын толгой хэсгийн "benign race" тайлбарыг үз).
    const cart = await waitFor(async () => {
      const cartRes = await request(app.getHttpServer())
        .get('/cart')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);
      const items = cartRes.body as unknown[];
      return items.length === 0 ? items : null;
    });
    expect(cart).toEqual([]);
  });

  it('CUSTOMER сагс хоосон үед захиалахыг оролдвол 400 CART_EMPTY', async () => {
    const res = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ branchId: branchA.id })
      .expect(400);
    expect((res.body as ErrorBody).error.code).toBe('CART_EMPTY');
  });

  it('CUSTOMER нөөцөөс их хэмжээгээр захиалахад 409 OUT_OF_STOCK, ямар ч бичилт (Order/InventoryItem) хийгдэхгүй (SAVEPOINT rollback)', async () => {
    const before = await superuserPrisma.inventoryItem.findUniqueOrThrow({
      where: { id: inventoryItemId },
    });
    const ordersCountBefore = await superuserPrisma.order.count({
      where: { customerId },
    });

    await setCartItem(app, customerToken, variantId, 1000);
    const res = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ branchId: branchA.id })
      .expect(409);
    expect((res.body as ErrorBody).error.code).toBe('OUT_OF_STOCK');

    const after = await superuserPrisma.inventoryItem.findUniqueOrThrow({
      where: { id: inventoryItemId },
    });
    expect(after.quantity).toBe(before.quantity);

    const ordersCountAfter = await superuserPrisma.order.count({
      where: { customerId },
    });
    expect(ordersCountAfter).toBe(ordersCountBefore);
  });

  it('InventoryItem мөр огт байхгүй branch-д захиалахад 409 OUT_OF_STOCK', async () => {
    await setCartItem(app, customerToken, variantId, 1);
    const res = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ branchId: branchB.id })
      .expect(409);
    expect((res.body as ErrorBody).error.code).toBe('OUT_OF_STOCK');
  });

  describe('Захиалгын статусын шилжилт (state machine)', () => {
    let orderId: string;

    beforeAll(async () => {
      await setCartItem(app, customerToken, variantId, 1);
      const res = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ branchId: branchA.id })
        .expect(201);
      orderId = (res.body as OrderBody).id;
    });

    it('CUSTOMER өөр хэрэглэгчийн захиалгыг харах/cancel хийх боломжгүй (RLS-ээр 404)', async () => {
      await request(app.getHttpServer())
        .get(`/orders/${orderId}`)
        .set('Authorization', `Bearer ${otherCustomerToken}`)
        .expect(404);

      await request(app.getHttpServer())
        .patch(`/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${otherCustomerToken}`)
        .send({ status: 'CANCELLED' })
        .expect(404);
    });

    it('CUSTOMER CREATED→READY гэх мэт зөвшөөрөгдөөгүй шилжилт хийхийг оролдвол 400', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ status: 'READY' })
        .expect(400);
      expect((res.body as ErrorBody).error.code).toBe(
        'INVALID_ORDER_STATUS_TRANSITION',
      );
    });

    it('staff (BRANCH_MANAGER) CREATED→PREPARING (дараалал алгасах) 400', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${branchManagerAToken}`)
        .send({ status: 'PREPARING' })
        .expect(400);
      expect((res.body as ErrorBody).error.code).toBe(
        'INVALID_ORDER_STATUS_TRANSITION',
      );
    });

    it('SALESPERSON CREATED→CONFIRMED хийж чадна (RU эрх), audit лог бичигдэнэ', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${salespersonAToken}`)
        .send({ status: 'CONFIRMED' })
        .expect(200);
      expect((res.body as OrderBody).status).toBe('CONFIRMED');

      const auditRow = await waitFor(() =>
        superuserPrisma.auditLog.findFirst({
          where: {
            tableName: 'orders',
            recordId: orderId,
            action: 'orders.status_changed',
          },
        }),
      );
      expect(auditRow).not.toBeNull();
    });

    it('CUSTOMER CONFIRMED болсон ӨӨРИЙН захиалгаа cancel хийж чадахгүй (зөвхөн CREATED-ээс)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ status: 'CANCELLED' })
        .expect(400);
      expect((res.body as ErrorBody).error.code).toBe(
        'INVALID_ORDER_STATUS_TRANSITION',
      );
    });

    it('staff CONFIRMED→CANCELLED хийхэд нөөц буцаж нэмэгдэнэ', async () => {
      const before = await superuserPrisma.inventoryItem.findUniqueOrThrow({
        where: { id: inventoryItemId },
      });

      const res = await request(app.getHttpServer())
        .patch(`/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${branchManagerAToken}`)
        .send({ status: 'CANCELLED' })
        .expect(200);
      expect((res.body as OrderBody).status).toBe('CANCELLED');

      const after = await waitFor(async () => {
        const row = await superuserPrisma.inventoryItem.findUnique({
          where: { id: inventoryItemId },
        });
        return row && row.quantity === before.quantity + 1 ? row : null;
      });
      expect(after.quantity).toBe(before.quantity + 1);

      const order = await waitFor(async () => {
        const row = await superuserPrisma.order.findUnique({
          where: { id: orderId },
        });
        return row?.cancelledAt ? row : null;
      });
      expect(order.cancelledAt).not.toBeNull();
    });
  });

  it('CUSTOMER ӨӨРИЙН CREATED захиалгаа cancel хийхэд нөөц буцаж нэмэгдэнэ', async () => {
    const baseline = await superuserPrisma.inventoryItem.findUniqueOrThrow({
      where: { id: inventoryItemId },
    });

    await setCartItem(app, customerToken, variantId, 1);
    const checkoutRes = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ branchId: branchA.id })
      .expect(201);
    const orderId = (checkoutRes.body as OrderBody).id;

    const before = await waitFor(async () => {
      const row = await superuserPrisma.inventoryItem.findUnique({
        where: { id: inventoryItemId },
      });
      return row && row.quantity === baseline.quantity - 1 ? row : null;
    });

    const cancelRes = await request(app.getHttpServer())
      .patch(`/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ status: 'CANCELLED' })
      .expect(200);
    expect((cancelRes.body as OrderBody).status).toBe('CANCELLED');

    const after = await waitFor(async () => {
      const row = await superuserPrisma.inventoryItem.findUnique({
        where: { id: inventoryItemId },
      });
      return row && row.quantity === before.quantity + 1 ? row : null;
    });
    expect(after.quantity).toBe(before.quantity + 1);
  });

  it('SALESPERSON өөр салбарын (B) захиалгыг харах боломжгүй (RLS 404)', async () => {
    const branchBOrder = await superuserPrisma.order.create({
      data: {
        customerId,
        branchId: branchB.id,
        status: 'CREATED',
        totalAmount: 1000,
      },
    });

    await request(app.getHttpServer())
      .get(`/orders/${branchBOrder.id}`)
      .set('Authorization', `Bearer ${salespersonAToken}`)
      .expect(404);
  });

  it('SUPER_ADMIN бүх салбарын захиалгыг харна', async () => {
    const res = await request(app.getHttpServer())
      .get('/orders')
      .query({ branchId: branchA.id })
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);
    expect((res.body as OrderBody[]).length).toBeGreaterThan(0);
  });

  it('token/header-гүй хүсэлт 401 (нэвтрээгүй)', async () => {
    const res = await request(app.getHttpServer()).get('/orders').expect(401);
    expect((res.body as ErrorBody).error.code).toBe('UNAUTHENTICATED');
  });
});
