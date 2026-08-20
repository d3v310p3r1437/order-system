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

interface ProductVariantBody {
  id: string;
  basePrice: string;
}

interface InventoryItemBody {
  id: string;
  branchId: string;
  quantity: number;
}

function getJwtSecret(): Uint8Array {
  return new TextEncoder().encode(process.env.JWT_SECRET ?? '');
}

// RlsMiddleware-ийн request-scoped transaction (ADR 001) COMMIT хийгдэх нь
// HTTP хариу клиент рүү очихоос бага зэрэг ХОЙШ явагддаг тул supertest-ийн
// `.expect(200)` амжилттай буцсан ч audit_logs мөр ХАРАХ баталгаагүй агшин
// байж болно — test/returns.e2e-spec.ts-ийн ижил зорилготой waitFor()-той адил.
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

// docs/adr/002: JWT (custom эсвэл Keycloak) хоёулаа зөвхөн "identity"
// нотолно, role/branch ХЭЗЭЭ Ч JWT-д ордоггүй тул TokenVerifierService-ийн
// custom (HS256, CUSTOMER_JWT_ISSUER) заманд ямар ч дүртэй тестийн
// хэрэглэгчийн нэрийн өмнөөс token гаргаж болно — эрх бүрэн DB-ээс
// (user_branch_roles) уншигдана, JWT-ээс биш.
async function mintAccessToken(userId: string): Promise<string> {
  return new SignJWT({ typ: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuer(CUSTOMER_JWT_ISSUER)
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(getJwtSecret());
}

// §8 Phase 2 checklist "§6.1 матрицын дагуу дор хаяж 3 дүр (SUPER_ADMIN,
// BRANCH_MANAGER өөр 2 өөр салбарт, CUSTOMER)-ээр inventory харагдац
// ялгаатай болохыг e2e тестээр батал" — Category/Product/ProductVariant/
// InventoryItem RLS+RBAC-ийг бодит Postgres-тэй турших.
describe('Catalog & Inventory (e2e)', () => {
  let app: INestApplication<App>;
  let superuserPrisma: PrismaClient;

  let branchA: { id: string };
  let branchB: { id: string };

  let superAdminToken: string;
  let branchManagerAToken: string;
  let branchManagerBToken: string;
  let customerToken: string;

  let categoryId: string;
  let productId: string;
  let variantId: string;
  let inventoryItemAId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
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
      data: { name: `Салбар А ${Date.now()}` },
    });
    branchB = await superuserPrisma.branch.create({
      data: { name: `Салбар Б ${Date.now()}` },
    });

    const superAdminId = randomUUID();
    const branchManagerAId = randomUUID();
    const branchManagerBId = randomUUID();
    const customerId = randomUUID();

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
        id: branchManagerBId,
        email: `mgr-b-${branchManagerBId}@example.com`,
        authProvider: 'KEYCLOAK',
      },
    });
    await superuserPrisma.userBranchRole.create({
      data: {
        userId: branchManagerBId,
        branchId: branchB.id,
        role: 'BRANCH_MANAGER',
      },
    });

    await superuserPrisma.user.create({
      data: {
        id: customerId,
        phone: `+9769${Date.now().toString().slice(-8)}`,
        authProvider: 'CUSTOMER_AUTH',
      },
    });

    superAdminToken = await mintAccessToken(superAdminId);
    branchManagerAToken = await mintAccessToken(branchManagerAId);
    branchManagerBToken = await mintAccessToken(branchManagerBId);
    customerToken = await mintAccessToken(customerId);
  });

  afterAll(async () => {
    await app.close();
    await superuserPrisma.$disconnect();
  });

  it('SUPER_ADMIN категори/бүтээгдэхүүн/хувилбар үүсгэнэ', async () => {
    const unique = Date.now();
    const categoryRes = await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ name: `Ангилал ${unique}`, slug: `angilal-${unique}` })
      .expect(201);
    categoryId = (categoryRes.body as { id: string }).id;

    const productRes = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        name: 'Ноолуур цамц',
        slug: `noolluur-tsamts-${unique}`,
        categoryId,
      })
      .expect(201);
    productId = (productRes.body as { id: string }).id;

    const variantRes = await request(app.getHttpServer())
      .post('/product-variants')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        productId,
        name: 'L, хар',
        sku: `sku-${unique}`,
        basePrice: 45000,
        defaultPreOrderEnabled: true,
        defaultPreOrderLeadDays: 3,
      })
      .expect(201);
    variantId = (variantRes.body as { id: string }).id;
    expect(variantId).toEqual(expect.any(String));
  });

  it('CUSTOMER каталог унших боломжтой (нийтэд харагдана) ч CUD хийх эрхгүй (403)', async () => {
    await request(app.getHttpServer())
      .get('/products')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);

    const res = await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ name: 'Эрхгүй ангилал' })
      .expect(403);
    expect((res.body as ErrorBody).error.code).toBe('FORBIDDEN');
  });

  it('token/header-гүй хүсэлт каталог унших ч 401 (нэвтрээгүй)', async () => {
    const res = await request(app.getHttpServer()).get('/products').expect(401);
    expect((res.body as ErrorBody).error.code).toBe('UNAUTHENTICATED');
  });

  it('BRANCH_MANAGER хувилбарын үнэ шинэчилж чадна (RU эрх)', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/product-variants/${variantId}`)
      .set('Authorization', `Bearer ${branchManagerAToken}`)
      .send({ basePrice: 47000 })
      .expect(200);
    expect(Number((res.body as ProductVariantBody).basePrice)).toBe(47000);
  });

  it('SUPER_ADMIN хоёр салбарт нөөц үүсгэнэ, BRANCH_MANAGER зөвхөн ӨӨРИЙН салбараа харна', async () => {
    const itemA = await request(app.getHttpServer())
      .post('/inventory-items')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ variantId, branchId: branchA.id, quantity: 10 })
      .expect(201);
    inventoryItemAId = (itemA.body as { id: string }).id;

    await request(app.getHttpServer())
      .post('/inventory-items')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ variantId, branchId: branchB.id, quantity: 5 })
      .expect(201);

    // §8 Phase 2 checklist-ийн шаардсан 3 дүрийн inventory харагдацын ялгаа.
    // ?variantId= filter-ээр зөвхөн ЭНЭ тестийн үүсгэсэн мөрүүдийг харна —
    // e2e тестийг давтан ажиллуулахад өмнөх удаагийн (цэвэрлээгүй) өгөгдөл
    // тоог гажуудуулахгүй байхын тулд.
    const asSuperAdmin = await request(app.getHttpServer())
      .get('/inventory-items')
      .query({ variantId })
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);
    expect(asSuperAdmin.body).toHaveLength(2);

    const asManagerA = await request(app.getHttpServer())
      .get('/inventory-items')
      .query({ variantId })
      .set('Authorization', `Bearer ${branchManagerAToken}`)
      .expect(200);
    expect(asManagerA.body).toHaveLength(1);
    expect((asManagerA.body as InventoryItemBody[])[0].branchId).toBe(
      branchA.id,
    );

    const asManagerB = await request(app.getHttpServer())
      .get('/inventory-items')
      .query({ variantId })
      .set('Authorization', `Bearer ${branchManagerBToken}`)
      .expect(200);
    expect(asManagerB.body).toHaveLength(1);
    expect((asManagerB.body as InventoryItemBody[])[0].branchId).toBe(
      branchB.id,
    );

    const asCustomer = await request(app.getHttpServer())
      .get('/inventory-items')
      .query({ variantId })
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(403);
    expect((asCustomer.body as ErrorBody).error.code).toBe('FORBIDDEN');
  });

  it('BRANCH_MANAGER өөр салбарын (B) нөөцийг харах/өөрчлөх боломжгүй — RLS-ээр "олдсонгүй" (404)', async () => {
    const itemB = await superuserPrisma.inventoryItem.findFirstOrThrow({
      where: { branchId: branchB.id, variantId },
    });

    await request(app.getHttpServer())
      .get(`/inventory-items/${itemB.id}`)
      .set('Authorization', `Bearer ${branchManagerAToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/inventory-items/${itemB.id}/adjust-quantity`)
      .set('Authorization', `Bearer ${branchManagerAToken}`)
      .send({ delta: -1 })
      .expect(404);
  });

  it('adjustQuantity нь атомик increment ашиглана (100% олдох тоо нэмэгдэнэ/хасагдана)', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/inventory-items/${inventoryItemAId}/adjust-quantity`)
      .set('Authorization', `Bearer ${branchManagerAToken}`)
      .send({ delta: -3 })
      .expect(200);
    expect((res.body as InventoryItemBody).quantity).toBe(7);
  });

  it('нөөцөөс их хэмжээгээр хасах (сөрөг тоо руу орох) оролдлого 409 INSUFFICIENT_STOCK', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/inventory-items/${inventoryItemAId}/adjust-quantity`)
      .set('Authorization', `Bearer ${branchManagerAToken}`)
      .send({ delta: -1000 })
      .expect(409);
    expect((res.body as ErrorBody).error.code).toBe('INSUFFICIENT_STOCK');
  });

  it('нөөцийн өөрчлөлт бүрт audit лог (inventory_items.quantity_adjusted) бичигдэнэ', async () => {
    await waitFor(() =>
      superuserPrisma.auditLog.findFirst({
        where: {
          tableName: 'inventory_items',
          recordId: inventoryItemAId,
          action: 'inventory_items.quantity_adjusted',
        },
        orderBy: { createdAt: 'desc' },
      }),
    );
  });

  // admin-web-ийн салбар сонгох dropdown БОЛОН mobile-ийн
  // BranchSelectionScreen-д зориулсан минимал GET /branches
  // (branch.controller.ts) — @Roles()-гүй. Staff-ийн хувьд RLS
  // (branches_select) хэн ямар салбарыг харахыг шийднэ; CUSTOMER-ийн
  // хувьд branches_select RLS-д "хандах эрх" гэдэг ойлголт байдаггүй
  // тул (staff-only user_branch_roles-д тулгуурладаг) ADR 005-ийн
  // "READ-redact" `app_public_branches()`-аар идэвхтэй бүх салбарыг харна.
  describe('GET /branches — staff RLS-ээр, CUSTOMER app_public_branches()-ээр', () => {
    it('SUPER_ADMIN бүх салбарыг харна', async () => {
      const res = await request(app.getHttpServer())
        .get('/branches')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);
      const ids = (res.body as { id: string }[]).map((b) => b.id);
      expect(ids).toEqual(expect.arrayContaining([branchA.id, branchB.id]));
    });

    it('BRANCH_MANAGER зөвхөн ӨӨРИЙН салбараа харна', async () => {
      const res = await request(app.getHttpServer())
        .get('/branches')
        .set('Authorization', `Bearer ${branchManagerAToken}`)
        .expect(200);
      const ids = (res.body as { id: string }[]).map((b) => b.id);
      expect(ids).toContain(branchA.id);
      expect(ids).not.toContain(branchB.id);
    });

    // ⚠️ (2026-08-20 засвар) Урьд нь CUSTOMER ЭНД үргэлж хоосон массив
    // авдаг байсан (`branches_select` RLS-ийн `app_accessible_branch_ids()`
    // ЗӨВХӨН staff-ийн `user_branch_roles` мөрд тулгуурладаг тул) — энэ нь
    // §7 модуль #5 (Сагс/захиалга)-ийн BranchSelectionScreen (CUSTOMER
    // захиалгын салбараа сонгох ёстой) хөгжүүлэлтийн үед Android emulator
    // дээр бодитоор эвдэрсэн feature болж илэрсэн. Одоо CUSTOMER-д зориулж
    // ADR 005-ийн "READ-redact" зарчмаар `app_public_branches()` SECURITY
    // DEFINER функцээр (зөвхөн нийтэд аюулгүй багана, зөвхөн идэвхтэй
    // салбар) шийддэг тул CUSTOMER Ч мөн идэвхтэй бүх салбарыг харна.
    it('CUSTOMER идэвхтэй бүх салбарыг харна (app_public_branches()-ээр, RLS branches_select-ийг тойрсон)', async () => {
      const res = await request(app.getHttpServer())
        .get('/branches')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);
      const ids = (res.body as { id: string }[]).map((b) => b.id);
      expect(ids).toEqual(expect.arrayContaining([branchA.id, branchB.id]));
    });

    it('token-гүй хүсэлт 401', async () => {
      await request(app.getHttpServer()).get('/branches').expect(401);
    });
  });

  // §8 Phase 2 (2-р хэсэг) нэмэлт шаардлага: Branch.district/latitude/
  // longitude migration-оор бодитоор орсон эсэх.
  it('Branch дээр district/latitude/longitude талбар хадгалагдана', async () => {
    const branch = await superuserPrisma.branch.create({
      data: {
        name: `Салбар геолокац ${Date.now()}`,
        district: 'Хан-Уул',
        latitude: 47.9184,
        longitude: 106.9177,
      },
    });
    const found = await superuserPrisma.branch.findUniqueOrThrow({
      where: { id: branch.id },
    });
    expect(found.district).toBe('Хан-Уул');
    expect(found.latitude).toBeCloseTo(47.9184);
    expect(found.longitude).toBeCloseTo(106.9177);
  });

  // §8 Phase 2 (2-р хэсэг) нэмэлт шаардлага: "нийтэд харагдах" GET
  // /products/:id нь InventoryItem-ийн бодит мөрийг (quantity, branchId)
  // ил гаргалгүй, зөвхөн тооцоолсон availability status-ийг CUSTOMER-д
  // ч буцаадаг эсэхийг батал.
  describe('GET /products/:id — нийтэд харагдах availability', () => {
    let branchPreOrder: { id: string };
    let branchEmpty: { id: string };

    beforeAll(async () => {
      branchPreOrder = await superuserPrisma.branch.create({
        data: { name: `Салбар preorder ${Date.now()}` },
      });
      branchEmpty = await superuserPrisma.branch.create({
        data: { name: `Салбар хоосон ${Date.now()}` },
      });

      // quantity=0 боловч variant.defaultPreOrderEnabled=true тул PRE_ORDER
      // болохыг батлана (InventoryItem дээр өөрийн override тавиагүй —
      // variant-ийн анхны утгыг ашиглана, inventory-effective.util.ts).
      await request(app.getHttpServer())
        .post('/inventory-items')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ variantId, branchId: branchPreOrder.id, quantity: 0 })
        .expect(201);
    });

    it('CUSTOMER branchId сонговол (бэлэн салбар) IN_STOCK, quantity/branchId дотоод мэдээлэл харагдахгүй', async () => {
      const res = await request(app.getHttpServer())
        .get(`/products/${productId}`)
        .query({ branchId: branchA.id })
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      const body = res.body as {
        variants: Array<{
          id: string;
          availability: { status: string; leadDays: number | null };
        }>;
      };
      const variant = body.variants.find((v) => v.id === variantId);
      expect(variant?.availability).toEqual({
        status: 'IN_STOCK',
        leadDays: null,
      });
      expect(variant?.availability).not.toHaveProperty('quantity');
      expect(variant?.availability).not.toHaveProperty('branchId');
      expect(JSON.stringify(body)).not.toContain('"quantity"');
    });

    it('CUSTOMER branchId сонговол (нөөц 0, preorder идэвхтэй салбар) PRE_ORDER + leadDays', async () => {
      const res = await request(app.getHttpServer())
        .get(`/products/${productId}`)
        .query({ branchId: branchPreOrder.id })
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      const body = res.body as {
        variants: Array<{
          id: string;
          availability: { status: string; leadDays: number | null };
        }>;
      };
      const variant = body.variants.find((v) => v.id === variantId);
      expect(variant?.availability).toEqual({
        status: 'PRE_ORDER',
        leadDays: 3,
      });
    });

    it('CUSTOMER InventoryItem огт байхгүй салбар сонговол OUT_OF_STOCK', async () => {
      const res = await request(app.getHttpServer())
        .get(`/products/${productId}`)
        .query({ branchId: branchEmpty.id })
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      const body = res.body as {
        variants: Array<{
          id: string;
          availability: { status: string; leadDays: number | null };
        }>;
      };
      const variant = body.variants.find((v) => v.id === variantId);
      expect(variant?.availability).toEqual({
        status: 'OUT_OF_STOCK',
        leadDays: null,
      });
    });

    it('CUSTOMER branchId өгөхгүй бол бүх салбараар аггрегатлаж (аль нэгэнд байвал) IN_STOCK', async () => {
      const res = await request(app.getHttpServer())
        .get(`/products/${productId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      const body = res.body as {
        variants: Array<{
          id: string;
          availability: { status: string; leadDays: number | null };
        }>;
      };
      const variant = body.variants.find((v) => v.id === variantId);
      expect(variant?.availability.status).toBe('IN_STOCK');
    });
  });
});
