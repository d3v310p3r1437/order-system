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

interface CartLineBody {
  variantId: string;
  quantity: number;
  unavailable: boolean;
  productName?: string;
  basePrice?: string;
}

interface ValidateBranchBody {
  items: {
    variantId: string;
    quantity: number;
    available: boolean;
    status: string;
    effectivePrice: string | null;
    leadDays: number | null;
  }[];
  totalAmount: string;
}

function getJwtSecret(): Uint8Array {
  return new TextEncoder().encode(process.env.JWT_SECRET ?? '');
}

async function mintAccessToken(userId: string): Promise<string> {
  return new SignJWT({ typ: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuer(CUSTOMER_JWT_ISSUER)
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(getJwtSecret());
}

// docs/plan.md §7 модуль #5, §8 Phase 6 (Хэсэг A): Redis-д суурилсан сагс
// + branch-специфик бэлэн байдал шалгах.
describe('Cart (e2e)', () => {
  let app: INestApplication<App>;
  let superuserPrisma: PrismaClient;

  let branchA: { id: string };

  let customerToken: string;
  let otherCustomerToken: string;
  let salespersonToken: string;

  let variantInStock: { id: string };
  let variantOutOfStock: { id: string };
  let variantPreOrder: { id: string };

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
      data: { name: `Сагс Салбар А ${Date.now()}` },
    });

    const customerId = randomUUID();
    const otherCustomerId = randomUUID();
    const salespersonId = randomUUID();

    await superuserPrisma.user.create({
      data: {
        id: customerId,
        phone: `+9767${Date.now().toString().slice(-8)}`,
        authProvider: 'CUSTOMER_AUTH',
      },
    });
    await superuserPrisma.user.create({
      data: {
        id: otherCustomerId,
        phone: `+9766${Date.now().toString().slice(-8)}`,
        authProvider: 'CUSTOMER_AUTH',
      },
    });
    await superuserPrisma.user.create({
      data: {
        id: salespersonId,
        email: `sales-${salespersonId}@example.com`,
        authProvider: 'KEYCLOAK',
      },
    });
    await superuserPrisma.userBranchRole.create({
      data: {
        userId: salespersonId,
        branchId: branchA.id,
        role: 'SALESPERSON',
      },
    });

    customerToken = await mintAccessToken(customerId);
    otherCustomerToken = await mintAccessToken(otherCustomerId);
    salespersonToken = await mintAccessToken(salespersonId);

    const unique = Date.now();
    const category = await superuserPrisma.category.create({
      data: {
        name: `Сагсны ангилал ${unique}`,
        slug: `sagsny-angilal-${unique}`,
      },
    });
    const product = await superuserPrisma.product.create({
      data: {
        name: 'Сагсны бүтээгдэхүүн',
        slug: `sagsny-buteegdehuun-${unique}`,
        categoryId: category.id,
      },
    });

    variantInStock = await superuserPrisma.productVariant.create({
      data: {
        productId: product.id,
        name: 'Бэлэн',
        sku: `sagsny-instock-${unique}`,
        basePrice: 10000,
      },
    });
    await superuserPrisma.inventoryItem.create({
      data: {
        variantId: variantInStock.id,
        branchId: branchA.id,
        quantity: 5,
        branchPrice: 9000,
      },
    });

    variantOutOfStock = await superuserPrisma.productVariant.create({
      data: {
        productId: product.id,
        name: 'Дууссан',
        sku: `sagsny-oos-${unique}`,
        basePrice: 5000,
        defaultPreOrderEnabled: false,
      },
    });
    await superuserPrisma.inventoryItem.create({
      data: {
        variantId: variantOutOfStock.id,
        branchId: branchA.id,
        quantity: 0,
      },
    });

    variantPreOrder = await superuserPrisma.productVariant.create({
      data: {
        productId: product.id,
        name: 'Захиалгаар',
        sku: `sagsny-preorder-${unique}`,
        basePrice: 7000,
        defaultPreOrderEnabled: true,
        defaultPreOrderLeadDays: 7,
      },
    });
    await superuserPrisma.inventoryItem.create({
      data: {
        variantId: variantPreOrder.id,
        branchId: branchA.id,
        quantity: 0,
      },
    });
  });

  afterAll(async () => {
    // Redis дахь тестийн сагснуудыг цэвэрлэнэ (наад зах нь CI-ийн дараагийн
    // ажиллагаанд debris үлдээхгүйн тулд, TTL 30 хоног тул автоматаар
    // цэвэрлэгдэхийг хүлээхгүй).
    await request(app.getHttpServer())
      .delete('/cart')
      .set('Authorization', `Bearer ${customerToken}`);
    await request(app.getHttpServer())
      .delete('/cart')
      .set('Authorization', `Bearer ${otherCustomerToken}`);
    await app.close();
    await superuserPrisma.$disconnect();
  });

  it('нэвтрээгүй хэрэглэгч GET /cart дуудвал 401', async () => {
    await request(app.getHttpServer()).get('/cart').expect(401);
  });

  it('CUSTOMER бус (SALESPERSON) дүр /cart-д хандвал 403', async () => {
    const res = await request(app.getHttpServer())
      .get('/cart')
      .set('Authorization', `Bearer ${salespersonToken}`)
      .expect(403);
    expect((res.body as ErrorBody).error.code).toBe('FORBIDDEN');
  });

  it('шинэ CUSTOMER-ийн сагс эхлээд хоосон байна', async () => {
    const res = await request(app.getHttpServer())
      .get('/cart')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);
    expect(res.body).toEqual([]);
  });

  it('POST /cart/items variant нэмж, GET /cart-аар бүтээгдэхүүний нэр/үнэтэй нэгтгэгдсэн хариу буцаана', async () => {
    await request(app.getHttpServer())
      .post('/cart/items')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ variantId: variantInStock.id, quantity: 2 })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get('/cart')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);

    const body = res.body as CartLineBody[];
    expect(body).toHaveLength(1);
    expect(body[0].variantId).toBe(variantInStock.id);
    expect(body[0].quantity).toBe(2);
    expect(body[0].unavailable).toBe(false);
    expect(body[0].productName).toBe('Сагсны бүтээгдэхүүн');
    expect(body[0].basePrice).toBe('10000');
  });

  it('ижил variant-ыг ДАХИН нэмэхэд quantity шинэ утгаар СОЛИГДОНО (нэмэгдэхгүй)', async () => {
    await request(app.getHttpServer())
      .post('/cart/items')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ variantId: variantInStock.id, quantity: 9 })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get('/cart')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);
    const body = res.body as CartLineBody[];
    expect(body).toHaveLength(1);
    expect(body[0].quantity).toBe(9);
  });

  it('DELETE /cart/items/:variantId зөвхөн тухайн variant-ыг устгана', async () => {
    await request(app.getHttpServer())
      .post('/cart/items')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ variantId: variantOutOfStock.id, quantity: 1 })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/cart/items/${variantInStock.id}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);

    const res = await request(app.getHttpServer())
      .get('/cart')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);
    const body = res.body as CartLineBody[];
    expect(body).toHaveLength(1);
    expect(body[0].variantId).toBe(variantOutOfStock.id);
  });

  it('DELETE /cart бүх зүйлийг цэвэрлэнэ', async () => {
    await request(app.getHttpServer())
      .delete('/cart')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);

    const res = await request(app.getHttpServer())
      .get('/cart')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);
    expect(res.body).toEqual([]);
  });

  it('устсан/idle variant unavailable:true гэж тэмдэглэгдэж, алдаа шидэхгүй', async () => {
    const unique = Date.now();
    const category = await superuserPrisma.category.create({
      data: { name: `Идэвхгүй ангилал ${unique}`, slug: `idevhgui-${unique}` },
    });
    const product = await superuserPrisma.product.create({
      data: {
        name: 'Идэвхгүй бүтээгдэхүүн',
        slug: `idevhgui-buteegdehuun-${unique}`,
        categoryId: category.id,
      },
    });
    const idleVariant = await superuserPrisma.productVariant.create({
      data: {
        productId: product.id,
        name: 'Идэвхгүй',
        sku: `idevhgui-sku-${unique}`,
        basePrice: 1000,
      },
    });

    await request(app.getHttpServer())
      .post('/cart/items')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ variantId: idleVariant.id, quantity: 1 })
      .expect(201);

    await superuserPrisma.productVariant.update({
      where: { id: idleVariant.id },
      data: { isActive: false },
    });

    const res = await request(app.getHttpServer())
      .get('/cart')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);
    const body = res.body as CartLineBody[];
    expect(body).toEqual([
      { variantId: idleVariant.id, quantity: 1, unavailable: true },
    ]);

    await request(app.getHttpServer())
      .delete('/cart')
      .set('Authorization', `Bearer ${customerToken}`);
  });

  it('өөр CUSTOMER-ийн сагс бүрэн тусгаарлагдсан байна (нэг нь дүүрэн, нөгөө нь хоосон)', async () => {
    await request(app.getHttpServer())
      .post('/cart/items')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ variantId: variantInStock.id, quantity: 3 })
      .expect(201);

    const otherRes = await request(app.getHttpServer())
      .get('/cart')
      .set('Authorization', `Bearer ${otherCustomerToken}`)
      .expect(200);
    expect(otherRes.body).toEqual([]);

    const mineRes = await request(app.getHttpServer())
      .get('/cart')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);
    expect(mineRes.body as CartLineBody[]).toHaveLength(1);
  });

  describe('POST /cart/validate-branch', () => {
    beforeEach(async () => {
      await request(app.getHttpServer())
        .delete('/cart')
        .set('Authorization', `Bearer ${customerToken}`);
    });

    it('бүгд бэлэн (IN_STOCK) үед бүх зүйл available:true, нийт дүн branchPrice override-оор тооцогдоно', async () => {
      await request(app.getHttpServer())
        .post('/cart/items')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ variantId: variantInStock.id, quantity: 2 })
        .expect(201);

      const res = await request(app.getHttpServer())
        .post('/cart/validate-branch')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ branchId: branchA.id })
        .expect(201);

      const body = res.body as ValidateBranchBody;
      expect(body.items).toHaveLength(1);
      expect(body.items[0].available).toBe(true);
      expect(body.items[0].status).toBe('IN_STOCK');
      expect(body.items[0].effectivePrice).toBe('9000');
      expect(body.totalAmount).toBe('18000');
    });

    it('зарим зүйл дууссан (OUT_OF_STOCK) үед available:false, нийт дүнд ОРОХГҮЙ', async () => {
      await request(app.getHttpServer())
        .post('/cart/items')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ variantId: variantInStock.id, quantity: 1 })
        .expect(201);
      await request(app.getHttpServer())
        .post('/cart/items')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ variantId: variantOutOfStock.id, quantity: 1 })
        .expect(201);

      const res = await request(app.getHttpServer())
        .post('/cart/validate-branch')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ branchId: branchA.id })
        .expect(201);

      const body = res.body as ValidateBranchBody;
      const outOfStockLine = body.items.find(
        (item) => item.variantId === variantOutOfStock.id,
      );
      expect(outOfStockLine?.available).toBe(false);
      expect(outOfStockLine?.status).toBe('OUT_OF_STOCK');
      expect(outOfStockLine?.effectivePrice).toBeNull();
      // Зөвхөн variantInStock-ийн 1×9000 нийт дүнд орно.
      expect(body.totalAmount).toBe('9000');
    });

    it('зарим зүйл PRE_ORDER үед available:true, leadDays-тай, нийт дүнд ОРНО', async () => {
      await request(app.getHttpServer())
        .post('/cart/items')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ variantId: variantPreOrder.id, quantity: 1 })
        .expect(201);

      const res = await request(app.getHttpServer())
        .post('/cart/validate-branch')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ branchId: branchA.id })
        .expect(201);

      const body = res.body as ValidateBranchBody;
      expect(body.items).toHaveLength(1);
      expect(body.items[0].available).toBe(true);
      expect(body.items[0].status).toBe('PRE_ORDER');
      expect(body.items[0].leadDays).toBe(7);
      expect(body.items[0].effectivePrice).toBe('7000');
      expect(body.totalAmount).toBe('7000');
    });
  });
});
