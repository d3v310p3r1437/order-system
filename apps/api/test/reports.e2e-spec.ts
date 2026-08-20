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
  items: { id: string; variantId: string }[];
}

interface SalesSummaryBody {
  totalRevenue: string;
  orderCount: number;
  averageOrderAmount: string;
  returnAmount: string;
  returnCount: number;
  branchId: string | null;
}

interface TopProductBody {
  variantId: string;
  productName: string;
  variantName: string;
  quantitySold: number;
  revenue: string;
}

interface RevenueTrendPointBody {
  date: string;
  revenue: string;
  orderCount: number;
}

interface BranchComparisonRowBody {
  branchId: string;
  branchName: string;
  revenue: string;
  orderCount: number;
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

// docs/plan.md §7 модуль #14, §8 Phase 5: Тайлан ба олон-салбарын
// харьцуулалт — §6.1 матрицын "Тайлан/аналитик" мөрийг (RLS-ээр аль хэдийн
// хамгаалагдсан Order/OrderItem/ReturnRequest дээр шинэ query бичсэн)
// бодит Postgres/RLS-тэй баталгаажуулна.
describe('Reports (e2e)', () => {
  let app: INestApplication<App>;
  let superuserPrisma: PrismaClient;

  let branchA: { id: string };
  let branchB: { id: string };

  let superAdminToken: string;
  let branchManagerAToken: string;
  let salespersonAToken: string;
  let customerToken: string;

  let variantId: string;
  const unitPrice = 10000;

  // Тайлангийн хугацааны хүрээ — доорх бүх захиалгыг үүнд багтаана
  // (backdatedOrder-оос бусад, доорхыг үз). ⚠️ (2026-08-20 засвар) Урьд нь
  // '2026-08-19' гэж ХАТУУ бичигдсэн байсан — тест ажиллуулсан огноо энэ
  // огноог давсны дараа (маргааш нь) "өнөөдөр" үүсгэсэн захиалгууд ЭНЭ
  // хугацааны хүрээнээс ГАДУУР унаж, revenue/orderCount 0 болж CI-г
  // байнга унагаах болсныг илрүүлж засав. Одоо `now`-аас (тест ажиллах
  // ямар ч өдөр) динамикаар тооцно: rangeFrom = энэ сарын эхний өдөр,
  // rangeTo = өнөөдөр (UTC) — доорх backdated захиалга (2026-06-01)
  // ямагт rangeFrom-оос өмнө байх тул out-of-range шалгалт хэвээр хүчинтэй.
  const now = new Date();
  const rangeFrom = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;
  const rangeTo = now.toISOString().slice(0, 10);

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
      data: { name: `Тайлан Салбар А ${Date.now()}` },
    });
    branchB = await superuserPrisma.branch.create({
      data: { name: `Тайлан Салбар Б ${Date.now()}` },
    });

    const superAdminId = randomUUID();
    const branchManagerAId = randomUUID();
    const salespersonAId = randomUUID();
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

    superAdminToken = await mintAccessToken(superAdminId);
    branchManagerAToken = await mintAccessToken(branchManagerAId);
    salespersonAToken = await mintAccessToken(salespersonAId);
    customerToken = await mintAccessToken(customerId);

    const unique = Date.now();
    const category = await superuserPrisma.category.create({
      data: {
        name: `Тайлангийн ангилал ${unique}`,
        slug: `tailan-angilal-${unique}`,
      },
    });
    const product = await superuserPrisma.product.create({
      data: {
        name: 'Тайлангийн бүтээгдэхүүн',
        slug: `tailan-buteegdehuun-${unique}`,
        categoryId: category.id,
      },
    });
    const variant = await superuserPrisma.productVariant.create({
      data: {
        productId: product.id,
        name: 'Стандарт',
        sku: `tailan-sku-${unique}`,
        basePrice: unitPrice,
      },
    });
    variantId = variant.id;

    await superuserPrisma.inventoryItem.create({
      data: { variantId, branchId: branchA.id, quantity: 1000 },
    });
    await superuserPrisma.inventoryItem.create({
      data: { variantId, branchId: branchB.id, quantity: 1000 },
    });

    // Салбар А: 2 COMPLETED захиалга (нийт 3 ширхэг = 30,000₮) хугацааны
    // хүрээнд, + 1 захиалга (2 ширхэг = 20,000₮) ХҮРЭЭНЭЭС ГАДУУР
    // (backdated) — date filtering зөв ажиллаж байгааг батлахад ашиглана.
    await checkoutAndComplete(branchA.id, branchManagerAToken, 2);
    await checkoutAndComplete(branchA.id, branchManagerAToken, 1);
    const outOfRangeOrder = await checkoutAndComplete(
      branchA.id,
      branchManagerAToken,
      2,
    );
    await superuserPrisma.order.update({
      where: { id: outOfRangeOrder.id },
      data: { completedAt: new Date('2026-06-01T00:00:00.000Z') },
    });

    // Салбар Б: 1 COMPLETED захиалга (1 ширхэг = 10,000₮) хугацааны
    // хүрээнд.
    await checkoutAndComplete(branchB.id, superAdminToken, 1);
  }, 60000);

  afterAll(async () => {
    await app.close();
    await superuserPrisma.$disconnect();
  });

  async function checkoutAndComplete(
    branchId: string,
    staffToken: string,
    quantity: number,
  ): Promise<OrderBody> {
    // (2026-08-20) checkout item-үүдийг Redis сагснаас уншина.
    await request(app.getHttpServer())
      .post('/cart/items')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ variantId, quantity })
      .expect(201);
    const checkoutRes = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ branchId })
      .expect(201);
    const orderId = (checkoutRes.body as OrderBody).id;

    for (const status of ['CONFIRMED', 'PREPARING', 'READY', 'COMPLETED']) {
      await request(app.getHttpServer())
        .patch(`/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ status })
        .expect(200);
    }

    const finalRes = await request(app.getHttpServer())
      .get(`/orders/${orderId}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);
    return finalRes.body as OrderBody;
  }

  describe('GET /reports/sales-summary', () => {
    it('SALESPERSON дуудвал 403 (§6.1 матрицад "—")', async () => {
      await request(app.getHttpServer())
        .get(`/reports/sales-summary?from=${rangeFrom}&to=${rangeTo}`)
        .set('Authorization', `Bearer ${salespersonAToken}`)
        .expect(403);
    });

    it('CUSTOMER дуудвал 403', async () => {
      await request(app.getHttpServer())
        .get(`/reports/sales-summary?from=${rangeFrom}&to=${rangeTo}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);
    });

    it('SUPER_ADMIN (global scope, branchId-гүй) БҮХ салбарын нийлбэрийг харна', async () => {
      // ⚠️ Энэ dev DB бусад e2e spec файлуудтай (жиш: orders/payment/
      // delivery-routing) ХУВААЛЦСАН тул branchId-гүй (global) query
      // ТЭДНИЙ ч COMPLETED захиалгыг хамруулна — тиймээс энд яг тэгш
      // тоо биш, "Салбар А + Салбар Б-ийн мэдэгдэж буй хувь нэмэр ДОР
      // ХАЯХГҮЙ орсон эсэх"-ийг (>=) шалгана. Салбар тус бүрийн яг тэгш
      // дүн доорх BRANCH_MANAGER-ийн тестээр (RLS-ээр өөр салбарын
      // өгөгдлөөс тусгаарлагдсан тул бохирдолгүй) баталгаажсан.
      const res = await request(app.getHttpServer())
        .get(`/reports/sales-summary?from=${rangeFrom}&to=${rangeTo}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);
      const body = res.body as SalesSummaryBody;
      // Салбар А (30,000) + Салбар Б (10,000) = 40,000 — backdated
      // захиалга (20,000) ХАМРАГДАХГҮЙ.
      expect(Number(body.totalRevenue)).toBeGreaterThanOrEqual(40000);
      expect(body.orderCount).toBeGreaterThanOrEqual(3);
    });

    it('BRANCH_MANAGER (branch A) RLS-ээр ЗӨВХӨН өөрийн салбарынхаа мэдээллийг харна', async () => {
      const res = await request(app.getHttpServer())
        .get(`/reports/sales-summary?from=${rangeFrom}&to=${rangeTo}`)
        .set('Authorization', `Bearer ${branchManagerAToken}`)
        .expect(200);
      const body = res.body as SalesSummaryBody;
      expect(body.totalRevenue).toBe('30000.00');
      expect(body.orderCount).toBe(2);
    });

    it('date range-ээс гадуурх (backdated) захиалга ХЭЗЭЭ Ч тооцогдохгүй', async () => {
      const res = await request(app.getHttpServer())
        .get(`/reports/sales-summary?from=2026-05-01&to=2026-06-30`)
        .set('Authorization', `Bearer ${branchManagerAToken}`)
        .expect(200);
      const body = res.body as SalesSummaryBody;
      expect(body.totalRevenue).toBe('20000.00');
      expect(body.orderCount).toBe(1);
    });

    it('branchId=Салбар Б-г BRANCH_MANAGER (branch A) дамжуулбал RLS-ээр 0 мөр (алдаа биш, чимээгүй хоосон)', async () => {
      const res = await request(app.getHttpServer())
        .get(
          `/reports/sales-summary?from=${rangeFrom}&to=${rangeTo}&branchId=${branchB.id}`,
        )
        .set('Authorization', `Bearer ${branchManagerAToken}`)
        .expect(200);
      const body = res.body as SalesSummaryBody;
      expect(body.orderCount).toBe(0);
      expect(body.totalRevenue).toBe('0.00');
    });

    it('from > to бол 400 INVALID_DATE_RANGE', async () => {
      const res = await request(app.getHttpServer())
        .get(`/reports/sales-summary?from=${rangeTo}&to=${rangeFrom}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(400);
      expect((res.body as ErrorBody).error.code).toBe('INVALID_DATE_RANGE');
    });
  });

  describe('GET /reports/top-products', () => {
    it('салбар А-ийн зарагдсан тоо ширхэг/орлогыг зөв нэгтгэнэ', async () => {
      const res = await request(app.getHttpServer())
        .get(
          `/reports/top-products?from=${rangeFrom}&to=${rangeTo}&branchId=${branchA.id}`,
        )
        .set('Authorization', `Bearer ${branchManagerAToken}`)
        .expect(200);
      const body = res.body as TopProductBody[];
      expect(body).toHaveLength(1);
      expect(body[0].variantId).toBe(variantId);
      expect(body[0].quantitySold).toBe(3);
      expect(body[0].revenue).toBe('30000.00');
    });
  });

  describe('GET /reports/revenue-trend', () => {
    it('өдрөөр бүлэглэсэн орлогын цуваа буцаана', async () => {
      // branchId=branchA.id-аар шүүсэн тул dev DB-ийн бусад e2e spec
      // файлуудын (өөр салбарт харьяалагдах) COMPLETED захиалгууд огт
      // холилдохгүй (getSalesSummary-ийн SUPER_ADMIN тестийн тайлбартай
      // ижил "shared dev DB" анхаарал).
      const res = await request(app.getHttpServer())
        .get(
          `/reports/revenue-trend?from=${rangeFrom}&to=${rangeTo}&branchId=${branchA.id}`,
        )
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);
      const body = res.body as RevenueTrendPointBody[];
      const totalFromTrend = body.reduce(
        (sum, point) => sum + Number(point.revenue),
        0,
      );
      expect(totalFromTrend).toBeCloseTo(30000, 2);
      const totalOrders = body.reduce((sum, p) => sum + p.orderCount, 0);
      expect(totalOrders).toBe(2);
    });
  });

  describe('GET /reports/branch-comparison', () => {
    it('SALESPERSON дуудвал 403 (зөвхөн global scope дүрд)', async () => {
      await request(app.getHttpServer())
        .get(`/reports/branch-comparison?from=${rangeFrom}&to=${rangeTo}`)
        .set('Authorization', `Bearer ${salespersonAToken}`)
        .expect(403);
    });

    it('BRANCH_MANAGER (global scope БИШ) дуудвал 403', async () => {
      await request(app.getHttpServer())
        .get(`/reports/branch-comparison?from=${rangeFrom}&to=${rangeTo}`)
        .set('Authorization', `Bearer ${branchManagerAToken}`)
        .expect(403);
    });

    it('SUPER_ADMIN дуудвал салбар бүрийн орлогыг харьцуулж буцаана', async () => {
      const res = await request(app.getHttpServer())
        .get(`/reports/branch-comparison?from=${rangeFrom}&to=${rangeTo}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);
      const body = res.body as BranchComparisonRowBody[];
      const rowA = body.find((r) => r.branchId === branchA.id);
      const rowB = body.find((r) => r.branchId === branchB.id);
      expect(rowA?.revenue).toBe('30000.00');
      expect(rowA?.orderCount).toBe(2);
      expect(rowB?.revenue).toBe('10000.00');
      expect(rowB?.orderCount).toBe(1);
    });
  });

  describe('GET /reports/sales-summary/export', () => {
    it('CSV файл (UTF-8 BOM + Content-Disposition attachment) буцаана', async () => {
      const res = await request(app.getHttpServer())
        .get(
          `/reports/sales-summary/export?from=${rangeFrom}&to=${rangeTo}&branchId=${branchA.id}&format=csv`,
        )
        .set('Authorization', `Bearer ${branchManagerAToken}`)
        .expect(200);

      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('attachment');
      expect(res.headers['content-disposition']).toContain('.csv');
      const text = res.text;
      expect(text.charCodeAt(0)).toBe(0xfeff);
      expect(text).toContain('Нийт орлого');
      expect(text).toContain('30000.00');
    });

    it('format параметр буруу бол 400 VALIDATION_ERROR', async () => {
      const res = await request(app.getHttpServer())
        .get(
          `/reports/sales-summary/export?from=${rangeFrom}&to=${rangeTo}&format=xlsx`,
        )
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(400);
      expect((res.body as ErrorBody).error.code).toBe('VALIDATION_ERROR');
    });
  });
});
