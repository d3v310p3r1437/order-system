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
import { PrismaService } from '../src/prisma/prisma.service.js';

interface ErrorBody {
  error: { code: string; message: string; details: unknown };
}

interface OrderBody {
  id: string;
  status: string;
  branchId: string;
  providerInvoiceId: string | null;
  items: { id: string; variantId: string; quantity: number }[];
}

interface ReturnRequestBody {
  id: string;
  status: string;
  reason: string;
  rejectedReason: string | null;
  refundFeePercent: string | null;
  refundAmount: string | null;
  providerRefundId: string | null;
  orderItem: { id: string; orderId: string };
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

// docs/adr/001-ийн benign race (orders.e2e-spec.ts-тэй ижил тайлбар):
// HTTP хариу ирсний дараа ч RlsMiddleware-ийн transaction commit хараахан
// бүрэн дуусаагүй байж болзошгүй тул өөр connection (superuserPrisma)-оор
// шалгах assertion бүрийг богино polling-оор эрүүлжүүлнэ.
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

// docs/plan.md §7 модуль #9, §8 Phase 3c: буцаалт/нөхөн төлбөр — 7 хоногийн
// цонх, refund амжилттай/амжилтгүй зам, RLS дүр тус бүрээр, тохиргооны API.
describe('Returns (e2e)', () => {
  let app: INestApplication<App>;
  let superuserPrisma: PrismaClient;
  let prismaService: PrismaService;

  let branchA: { id: string };
  let branchB: { id: string };

  let superAdminToken: string;
  let branchManagerAToken: string;
  let salespersonAToken: string;
  let branchManagerBToken: string;
  let customerToken: string;
  let otherCustomerToken: string;
  let customerId: string;
  let otherCustomerId: string;
  let salespersonAId: string;

  let variantId: string;
  let variantBasePrice: number;

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

    prismaService = app.get(PrismaService);

    superuserPrisma = new PrismaClient({
      datasources: { db: { url: process.env.DATABASE_URL } },
    });

    branchA = await superuserPrisma.branch.create({
      data: { name: `Буцаалт Салбар А ${Date.now()}` },
    });
    branchB = await superuserPrisma.branch.create({
      data: { name: `Буцаалт Салбар Б ${Date.now()}` },
    });

    const superAdminId = randomUUID();
    const branchManagerAId = randomUUID();
    salespersonAId = randomUUID();
    const branchManagerBId = randomUUID();
    otherCustomerId = randomUUID();
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
        phone: `+9761${Date.now().toString().slice(-8)}`,
        authProvider: 'CUSTOMER_AUTH',
      },
    });
    await superuserPrisma.user.create({
      data: {
        id: otherCustomerId,
        phone: `+9762${Date.now().toString().slice(-8)}`,
        authProvider: 'CUSTOMER_AUTH',
      },
    });

    superAdminToken = await mintAccessToken(superAdminId);
    branchManagerAToken = await mintAccessToken(branchManagerAId);
    salespersonAToken = await mintAccessToken(salespersonAId);
    branchManagerBToken = await mintAccessToken(branchManagerBId);
    customerToken = await mintAccessToken(customerId);
    otherCustomerToken = await mintAccessToken(otherCustomerId);

    const unique = Date.now();
    const category = await superuserPrisma.category.create({
      data: {
        name: `Буцаалтын ангилал ${unique}`,
        slug: `butsaalt-angilal-${unique}`,
      },
    });
    const product = await superuserPrisma.product.create({
      data: {
        name: 'Буцаалтын бүтээгдэхүүн',
        slug: `butsaalt-buteegdehuun-${unique}`,
        categoryId: category.id,
      },
    });
    variantBasePrice = 10000;
    const variant = await superuserPrisma.productVariant.create({
      data: {
        productId: product.id,
        name: 'Стандарт',
        sku: `butsaalt-sku-${unique}`,
        basePrice: variantBasePrice,
      },
    });
    variantId = variant.id;

    await superuserPrisma.inventoryItem.create({
      data: { variantId, branchId: branchA.id, quantity: 100 },
    });

    // §6.1 матрицаас гаргасан RETURN_FEE_PERCENT анхны утга (10) хэвээр
    // байгааг баталгаажуулна — өөр e2e файл энэ тохиргоог хөндөхгүй ч,
    // энэ файлын дотор SUPER_ADMIN шинэ утга тавих тест байгаа тул бусад
    // (fee-той холбоотой) тестийг эхлүүлэхээс ӨМНӨ детерминистик утгад
    // буцааж тавина.
    await request(app.getHttpServer())
      .put('/settings/return-fee-percent')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ value: 10 })
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
    await superuserPrisma.$disconnect();
  });

  async function checkoutAndComplete(
    branchId: string,
    staffToken: string,
  ): Promise<OrderBody> {
    const checkoutRes = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ branchId, items: [{ variantId, quantity: 1 }] })
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

  describe('Харилцагчийн буцаалт хүсэх (POST /returns)', () => {
    it('COMPLETED биш захиалгын мөрд буцаалт хүсвэл 400 ORDER_NOT_COMPLETED', async () => {
      const checkoutRes = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ branchId: branchA.id, items: [{ variantId, quantity: 1 }] })
        .expect(201);
      const orderItemId = (checkoutRes.body as OrderBody).items[0].id;

      const res = await request(app.getHttpServer())
        .post('/returns')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ orderItemId, reason: 'таалагдсангүй' })
        .expect(400);
      expect((res.body as ErrorBody).error.code).toBe('ORDER_NOT_COMPLETED');
    });

    it('хүргэгдснээс хойш 7 хоног хэтэрсэн бол 400 RETURN_WINDOW_EXPIRED', async () => {
      const order = await checkoutAndComplete(branchA.id, branchManagerAToken);
      // completedAt-г шууд DB-ээр 8 хоногийн өмнөх огноогоор дарж бичив
      // (API-аар COMPLETED болговол үргэлж "одоо" цагийг тавьдаг тул
      // хугацаа хэтрэлтийг детерминистикээр бий болгох цорын ганц зам).
      await superuserPrisma.order.update({
        where: { id: order.id },
        data: { completedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) },
      });

      const res = await request(app.getHttpServer())
        .post('/returns')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ orderItemId: order.items[0].id, reason: 'эвдэрсэн ирсэн' })
        .expect(400);
      expect((res.body as ErrorBody).error.code).toBe('RETURN_WINDOW_EXPIRED');
    });

    it('өөр хэрэглэгчийн захиалгын мөрд буцаалт хүсвэл 404 (RLS)', async () => {
      const order = await checkoutAndComplete(branchA.id, branchManagerAToken);

      const res = await request(app.getHttpServer())
        .post('/returns')
        .set('Authorization', `Bearer ${otherCustomerToken}`)
        .send({ orderItemId: order.items[0].id, reason: 'миний биш ч оролдъё' })
        .expect(404);
      expect((res.body as ErrorBody).error.code).toBe('ORDER_ITEM_NOT_FOUND');
    });

    // ⚠️ Дээрх 404-той тест зөвхөн ReturnRequestService.create()-ийн
    // ӨМНӨХ SELECT (order_items_select RLS-ээр null буцаах) шалгалтыг
    // л шалгадаг — return_requests_insert-ийн WITH CHECK ЗАРЧМЫН хувьд
    // ХЭЗЭЭ Ч хүрдэггүй (service нь INSERT-д хүрэхээс өмнө аль хэдийн
    // 404 шидчихдэг). ReturnRequestService-ийг ирээдүйд заавал ГАРАН
    // (жиш: someone accidentally-г preflight-ыг устгах гэх мэт алдаа)
    // хамгаалах "сүүлчийн шугам" гэдгийг ЭНЭ RLS policy-г ӨӨРИЙГ нь,
    // service давхаргыг бүрэн тойрч, шууд raw SQL-ээр шалгана —
    // `PrismaService.runRequestTransaction()`-оор (order-events.gateway.ts-д
    // ашигладаг ижил механизм) otherCustomer-ийн session нээж, ЧАДАМЖТАЙ
    // (requestedByUserId=otherCustomer, ӨӨРИЙНХ нь) ч БУСДЫН (customerId)
    // orderItemId зорьсон raw INSERT оролдоно.
    it('return_requests_insert RLS policy: requestedByUserId ӨӨРИЙНХ байсан ч orderItemId БУСДЫН эзэмшлийнх бол INSERT цуцлагдана (service давхаргыг тойрсон шууд SQL-ээр)', async () => {
      const order = await checkoutAndComplete(branchA.id, branchManagerAToken);
      const orderItemId = order.items[0].id;

      await expect(
        prismaService.runRequestTransaction(
          otherCustomerId,
          (tx) =>
            tx.$executeRaw`
            INSERT INTO return_requests (id, "orderItemId", "requestedByUserId", reason)
            VALUES (${randomUUID()}, ${orderItemId}, ${otherCustomerId}, 'RLS цоорхойг шалгах оролдлого')
          `,
        ),
      ).rejects.toThrow(/row-level security/i);

      // Хамгийн чухал нь: RLS татгалзсаны улмаас ЯМАР Ч мөр бодитоор
      // бичигдээгүй эсэхийг (алдаа шидсэн ч зарим орчинд "0 мөр INSERT
      // хийгдсэн" гэдэгтэй андуурч болзошгүй тул) шууд DB-ээс баталгаажуулав.
      const leaked = await superuserPrisma.returnRequest.findFirst({
        where: { orderItemId, requestedByUserId: otherCustomerId },
      });
      expect(leaked).toBeNull();
    });

    // return_requests_insert-ийн WITH CHECK-ийн эхний нөхцөл
    // (`requestedByUserId = app_current_user_id()`) ганцаараа хангагдсан
    // ч (SALESPERSON ӨӨРИЙНХӨӨ userId-г requestedByUserId болгож
    // илгээвэл) хоёр дахь нөхцөл (`o."customerId" = app_current_user_id()`)
    // тэр SALESPERSON харилцагч БИШ тул хэзээ ч биелэхгүй — өөрөөр
    // хэлбэл "CUSTOMER бус дүр огт буцаалт хүсэж чадахгүй" гэдэг
    // §7 модуль #9 8-р зүйлийн заавар зөвхөн @Roles('CUSTOMER')-оор
    // биш, RLS-ийн өөрийнх нь түвшинд ч давхар хамгаалагдсаныг батална.
    it('return_requests_insert RLS policy: CUSTOMER БУС дүр (SALESPERSON) requestedByUserId=өөрийнхөөр ч raw INSERT хийж чадахгүй', async () => {
      const order = await checkoutAndComplete(branchA.id, branchManagerAToken);
      const orderItemId = order.items[0].id;

      await expect(
        prismaService.runRequestTransaction(
          salespersonAId,
          (tx) =>
            tx.$executeRaw`
            INSERT INTO return_requests (id, "orderItemId", "requestedByUserId", reason)
            VALUES (${randomUUID()}, ${orderItemId}, ${salespersonAId}, 'SALESPERSON RLS цоорхойг шалгах оролдлого')
          `,
        ),
      ).rejects.toThrow(/row-level security/i);

      const leaked = await superuserPrisma.returnRequest.findFirst({
        where: { orderItemId, requestedByUserId: salespersonAId },
      });
      expect(leaked).toBeNull();
    });

    it('хүчинтэй хүсэлт REQUESTED төлөвтэй үүсэж, audit лог бичигдэнэ, давхар идэвхтэй хүсэлт 409', async () => {
      const order = await checkoutAndComplete(branchA.id, branchManagerAToken);

      const res = await request(app.getHttpServer())
        .post('/returns')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ orderItemId: order.items[0].id, reason: 'хэмжээ таарсангүй' })
        .expect(201);
      const body = res.body as ReturnRequestBody;
      expect(body.status).toBe('REQUESTED');

      const auditRow = await waitFor(() =>
        superuserPrisma.auditLog.findFirst({
          where: { tableName: 'return_requests', recordId: body.id },
        }),
      );
      expect(auditRow).not.toBeNull();

      const dup = await request(app.getHttpServer())
        .post('/returns')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ orderItemId: order.items[0].id, reason: 'дахин оролдъё' })
        .expect(409);
      expect((dup.body as ErrorBody).error.code).toBe(
        'ACTIVE_RETURN_REQUEST_EXISTS',
      );
    });
  });

  describe('Зөвшөөрөх урсгал (PATCH /returns/:id/approve)', () => {
    it('CUSTOMER (эрхгүй дүр) зөвшөөрөх оролдвол 403', async () => {
      const order = await checkoutAndComplete(branchA.id, branchManagerAToken);
      const createRes = await request(app.getHttpServer())
        .post('/returns')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ orderItemId: order.items[0].id, reason: 'test' })
        .expect(201);
      const returnId = (createRes.body as ReturnRequestBody).id;

      const res = await request(app.getHttpServer())
        .patch(`/returns/${returnId}/approve`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);
      expect((res.body as ErrorBody).error.code).toBe('FORBIDDEN');
    });

    it('SALESPERSON (харах эрхтэй ч шийдвэр гаргах эрхгүй) зөвшөөрөх оролдвол 403', async () => {
      const order = await checkoutAndComplete(branchA.id, branchManagerAToken);
      const createRes = await request(app.getHttpServer())
        .post('/returns')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ orderItemId: order.items[0].id, reason: 'test' })
        .expect(201);
      const returnId = (createRes.body as ReturnRequestBody).id;

      // SALESPERSON харах боломжтой (RLS-ээр 404 биш) гэдгийг эхлээд батална.
      await request(app.getHttpServer())
        .get(`/returns/${returnId}`)
        .set('Authorization', `Bearer ${salespersonAToken}`)
        .expect(200);

      const res = await request(app.getHttpServer())
        .patch(`/returns/${returnId}/approve`)
        .set('Authorization', `Bearer ${salespersonAToken}`)
        .expect(403);
      expect((res.body as ErrorBody).error.code).toBe('FORBIDDEN');
    });

    // ⚠️ Дээрх 403-той тест ЗӨВХӨН RolesGuard-ийн (@Roles(...REVIEW_ROLES))
    // controller-түвшний шалгалтыг л шалгадаг — SALESPERSON хүсэлт бүр
    // HTTP давхаргад БҮР RolesGuard-аар цуцлагддаг тул
    // `return_requests_update` RLS policy-ийн SALESPERSON-г ХАСДАГ өөрийнх
    // нь заалт (return_requests_select-ийн SALESPERSON-г ОРУУЛСАН заалттай
    // ЯЛГААТАЙ) хэзээ ч ганцаараа (RolesGuard-гүйгээр) шалгагдаж үзээгүй
    // байсан. RolesGuard-ыг БҮРЭН тойрч, service-ийг ч тойрч, шууд
    // `PrismaService.runRequestTransaction()`-оор SALESPERSON-ийн session
    // нээж, raw UPDATE оролдуулав.
    //
    // ⚠️ Нээлт (INSERT-ээс ЯЛГААТАЙ зан төлөв): анх `.rejects.toThrow(/row-level
    // security/i)` гэж таамагласан ч БОДИТООР `$executeRaw` АМЖИЛТТАЙ
    // resolve хийж, 0-г буцаадаг нь тогтоогдсон — PostgreSQL-ийн RLS-ийн
    // UPDATE/DELETE-д зориулсан `USING` заалт нь `WITH CHECK`-ээс (INSERT-д
    // ашиглагддаг, "шинэ мөрийг татгалзвал алдаа шидэх") ЗАРЧМЫН хувьд өөр:
    // `USING`-д тохирохгүй мөр зүгээр л "харагдахгүй" (candidate болохгүй)
    // тул UPDATE команд 0 мөр өөрчилсөн гэж АМЖИЛТТАЙ дуусна, алдаа огт
    // шидэгдэхгүй (docs/adr/001-ийн "0 мөр... ЖИНХЭНЭ Postgres алдаа БИШ"
    // нээлттэй яг ижил зарчим, OrderService.adjustInventory()-ийн
    // тайлбарыг үз). Тиймээс энд "throw биш", "0 мөр л өөрчлөгдсөн, DB-ийн
    // бодит төлөв өөрчлөгдөөгүй" гэдгийг шалгах нь зөв — CLAUDE.md-ийн
    // шинэ "RLS mutation policy" зарчмыг баримтлахдаа ирээдүйд UPDATE/
    // DELETE-ийн хувьд ЭНЭ ялгааг анхаарах ёстой.
    it('return_requests_update RLS policy: SALESPERSON (RolesGuard-ыг БҮРЭН тойрсон, шууд SQL) UPDATE-г 0 мөрөөр "чимээгүй" татгалзана', async () => {
      const order = await checkoutAndComplete(branchA.id, branchManagerAToken);
      const createRes = await request(app.getHttpServer())
        .post('/returns')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ orderItemId: order.items[0].id, reason: 'RLS UPDATE шалгалт' })
        .expect(201);
      const returnId = (createRes.body as ReturnRequestBody).id;

      const affectedRows = await prismaService.runRequestTransaction(
        salespersonAId,
        (tx) =>
          tx.$executeRaw`
            UPDATE return_requests SET status = 'APPROVED'::"ReturnStatus"
            WHERE id = ${returnId}
          `,
      );
      // `$executeRaw` алдаа шидэхгүй, харин "0 мөр өөрчлөгдсөн" гэж
      // амжилттай буцаана — энэ ӨӨРӨӨ л RLS-ийн бодит хамгаалалт.
      expect(affectedRows).toBe(0);

      const unchanged = await superuserPrisma.returnRequest.findUniqueOrThrow({
        where: { id: returnId },
      });
      expect(unchanged.status).toBe('REQUESTED');
    });

    it('өөр салбарын менежер (B) харах/зөвшөөрөх оролдвол 404 (RLS)', async () => {
      const order = await checkoutAndComplete(branchA.id, branchManagerAToken);
      const createRes = await request(app.getHttpServer())
        .post('/returns')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ orderItemId: order.items[0].id, reason: 'test' })
        .expect(201);
      const returnId = (createRes.body as ReturnRequestBody).id;

      await request(app.getHttpServer())
        .get(`/returns/${returnId}`)
        .set('Authorization', `Bearer ${branchManagerBToken}`)
        .expect(404);
      await request(app.getHttpServer())
        .patch(`/returns/${returnId}/approve`)
        .set('Authorization', `Bearer ${branchManagerBToken}`)
        .expect(404);
    });

    it('refund АМЖИЛТТАЙ бол REFUNDED болгож, шимтгэл хассан дүнгээр snapshot хийж, нөөц буцаж нэмэгдэнэ', async () => {
      const order = await checkoutAndComplete(branchA.id, branchManagerAToken);
      // MockPaymentProvider-ийн refundPayment() зөвхөн PAID invoice дээр
      // л амжилттай ажилладаг (§8 Phase 3c) — simulate-paid-ээр PAID болгоно.
      await request(app.getHttpServer())
        .post(`/payment/mock/simulate-paid/${order.providerInvoiceId}`)
        .expect(201);

      const before = await superuserPrisma.inventoryItem.findFirstOrThrow({
        where: { variantId, branchId: branchA.id },
      });

      const createRes = await request(app.getHttpServer())
        .post('/returns')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ orderItemId: order.items[0].id, reason: 'таалагдсангүй' })
        .expect(201);
      const returnId = (createRes.body as ReturnRequestBody).id;

      const approveRes = await request(app.getHttpServer())
        .patch(`/returns/${returnId}/approve`)
        .set('Authorization', `Bearer ${branchManagerAToken}`)
        .expect(200);
      const body = approveRes.body as ReturnRequestBody;

      expect(body.status).toBe('REFUNDED');
      expect(Number(body.refundFeePercent)).toBe(10);
      // variantBasePrice(10000) × 1 × (1 - 10/100) = 9000
      expect(Number(body.refundAmount)).toBe(9000);
      expect(body.providerRefundId).toMatch(/^mock_refund_/);

      const item = await waitFor(async () => {
        const row = await superuserPrisma.inventoryItem.findUnique({
          where: { id: before.id },
        });
        return row && row.quantity === before.quantity + 1 ? row : null;
      });
      expect(item.quantity).toBe(before.quantity + 1);

      const auditRow = await waitFor(() =>
        superuserPrisma.auditLog.findFirst({
          where: {
            tableName: 'return_requests',
            recordId: returnId,
            action: 'return_requests.approved',
          },
        }),
      );
      expect(auditRow).not.toBeNull();
    });

    // ⚠️ Playwright-аар (2 tab, admin-web-ийн бодит UI дээр бараг нэг зэрэг
    // "Зөвшөөрөх" товч дарах гэж оролдоход) илэрсэн race condition-ийн шууд
    // e2e нотолгоо: HTTP давхаргаас ЯГ ЗЭРЭГ (Promise.all) 2 удаа
    // /approve дуудвал ЗӨВХӨН НЭГ нь л амжилттай (200, REFUNDED) байх ёстой,
    // нөгөө нь 409 (RETURN_REQUEST_NOT_PENDING) авах ёстой — хоёулаа
    // амжилттай болвол PaymentProvider.refundPayment() ХОЁР дахин дуудагдаж
    // (санхүүгийн ХОЁР дахин refund) байгаагийн шинж тул нөөц ЗӨВХӨН 1
    // удаа (биш 2 удаа) буцаж нэмэгдсэнээр давхар refund болоогүйг батална.
    it('ЗЭРЭГ (Promise.all) 2 удаа "Зөвшөөрөх" дуудвал ЗӨВХӨН 1 нь амжилттай, нөгөө нь 409, нөөц ЗӨВХӨН 1 удаа буцна (davhar refund-ийн race)', async () => {
      const order = await checkoutAndComplete(branchA.id, branchManagerAToken);
      await request(app.getHttpServer())
        .post(`/payment/mock/simulate-paid/${order.providerInvoiceId}`)
        .expect(201);

      const before = await superuserPrisma.inventoryItem.findFirstOrThrow({
        where: { variantId, branchId: branchA.id },
      });

      const createRes = await request(app.getHttpServer())
        .post('/returns')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ orderItemId: order.items[0].id, reason: 'race condition тест' })
        .expect(201);
      const returnId = (createRes.body as ReturnRequestBody).id;

      const [resA, resB] = await Promise.all([
        request(app.getHttpServer())
          .patch(`/returns/${returnId}/approve`)
          .set('Authorization', `Bearer ${branchManagerAToken}`),
        request(app.getHttpServer())
          .patch(`/returns/${returnId}/approve`)
          .set('Authorization', `Bearer ${branchManagerAToken}`),
      ]);

      const statuses = [resA.status, resB.status].sort();
      expect(statuses).toEqual([200, 409]);

      const successRes = resA.status === 200 ? resA : resB;
      const failedRes = resA.status === 200 ? resB : resA;
      expect((successRes.body as ReturnRequestBody).status).toBe('REFUNDED');
      expect((failedRes.body as ErrorBody).error.code).toBe(
        'RETURN_REQUEST_NOT_PENDING',
      );

      const item = await waitFor(async () => {
        const row = await superuserPrisma.inventoryItem.findUnique({
          where: { id: before.id },
        });
        return row && row.quantity === before.quantity + 1 ? row : null;
      });
      // ЗӨВХӨН +1 (биш +2) — restockInventory() ганц удаа л дуудагдсан
      // гэдгийг нотолно (davhar refund болоогүй).
      expect(item.quantity).toBe(before.quantity + 1);

      const finalRow = await superuserPrisma.returnRequest.findUniqueOrThrow({
        where: { id: returnId },
      });
      expect(finalRow.status).toBe('REFUNDED');
    });

    it('refund АМЖИЛТГҮЙ (invoice PAID биш) бол REFUND_FAILED болгож, нөөц буцаахгүй', async () => {
      // ⚠️ simulate-paid ЗАВХАН дуудаагүй тул MockPaymentProvider дотор
      // invoice PENDING хэвээр — refundPayment() алдаа шидэнэ.
      const order = await checkoutAndComplete(branchA.id, branchManagerAToken);

      const before = await superuserPrisma.inventoryItem.findFirstOrThrow({
        where: { variantId, branchId: branchA.id },
      });

      const createRes = await request(app.getHttpServer())
        .post('/returns')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ orderItemId: order.items[0].id, reason: 'test refund fail' })
        .expect(201);
      const returnId = (createRes.body as ReturnRequestBody).id;

      const approveRes = await request(app.getHttpServer())
        .patch(`/returns/${returnId}/approve`)
        .set('Authorization', `Bearer ${branchManagerAToken}`)
        .expect(200);
      const body = approveRes.body as ReturnRequestBody;

      expect(body.status).toBe('REFUND_FAILED');
      expect(body.providerRefundId).toBeNull();

      // Нөөц ХЭЗЭЭ Ч буцаж нэмэгдэхгүй — богино хугацаа хүлээгээд шалгана
      // (waitFor эерэг нөхцөл шалгадаг тул энд сөрөг нөхцлийг шууд шалгав).
      await new Promise((resolve) => setTimeout(resolve, 300));
      const after = await superuserPrisma.inventoryItem.findUnique({
        where: { id: before.id },
      });
      expect(after?.quantity).toBe(before.quantity);
    });

    it('REFUND_FAILED-ийг дахин "Зөвшөөрөх" дуудвал (гараар дахин оролдох) амжилттай бол REFUNDED болно', async () => {
      const order = await checkoutAndComplete(branchA.id, branchManagerAToken);
      const before = await superuserPrisma.inventoryItem.findFirstOrThrow({
        where: { variantId, branchId: branchA.id },
      });

      const createRes = await request(app.getHttpServer())
        .post('/returns')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ orderItemId: order.items[0].id, reason: 'retry test' })
        .expect(201);
      const returnId = (createRes.body as ReturnRequestBody).id;

      const firstAttempt = await request(app.getHttpServer())
        .patch(`/returns/${returnId}/approve`)
        .set('Authorization', `Bearer ${branchManagerAToken}`)
        .expect(200);
      expect((firstAttempt.body as ReturnRequestBody).status).toBe(
        'REFUND_FAILED',
      );

      // Одоо invoice-г PAID болгож, staff дахин "Зөвшөөрөх" (§7 модуль #9
      // 3(д)-ийн "гараар дахин оролдох боломжтой байх") дуудна.
      await request(app.getHttpServer())
        .post(`/payment/mock/simulate-paid/${order.providerInvoiceId}`)
        .expect(201);

      const retryRes = await request(app.getHttpServer())
        .patch(`/returns/${returnId}/approve`)
        .set('Authorization', `Bearer ${branchManagerAToken}`)
        .expect(200);
      const body = retryRes.body as ReturnRequestBody;
      expect(body.status).toBe('REFUNDED');
      expect(body.providerRefundId).toMatch(/^mock_refund_/);

      const item = await waitFor(async () => {
        const row = await superuserPrisma.inventoryItem.findUnique({
          where: { id: before.id },
        });
        return row && row.quantity === before.quantity + 1 ? row : null;
      });
      expect(item.quantity).toBe(before.quantity + 1);
    });

    it('аль хэдийн шийдвэрлэгдсэн хүсэлтийг дахин зөвшөөрөхийг оролдвол 409', async () => {
      const order = await checkoutAndComplete(branchA.id, branchManagerAToken);
      const createRes = await request(app.getHttpServer())
        .post('/returns')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ orderItemId: order.items[0].id, reason: 'test' })
        .expect(201);
      const returnId = (createRes.body as ReturnRequestBody).id;

      await request(app.getHttpServer())
        .patch(`/returns/${returnId}/reject`)
        .set('Authorization', `Bearer ${branchManagerAToken}`)
        .send({ rejectedReason: 'хугацаа хэтэрсэн' })
        .expect(200);

      const res = await request(app.getHttpServer())
        .patch(`/returns/${returnId}/approve`)
        .set('Authorization', `Bearer ${branchManagerAToken}`)
        .expect(409);
      expect((res.body as ErrorBody).error.code).toBe(
        'RETURN_REQUEST_NOT_PENDING',
      );
    });
  });

  describe('Татгалзах урсгал (PATCH /returns/:id/reject)', () => {
    it('rejectedReason шаардлагатай (өгөгдөөгүй бол 400)', async () => {
      const order = await checkoutAndComplete(branchA.id, branchManagerAToken);
      const createRes = await request(app.getHttpServer())
        .post('/returns')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ orderItemId: order.items[0].id, reason: 'test' })
        .expect(201);
      const returnId = (createRes.body as ReturnRequestBody).id;

      await request(app.getHttpServer())
        .patch(`/returns/${returnId}/reject`)
        .set('Authorization', `Bearer ${branchManagerAToken}`)
        .send({})
        .expect(400);
    });

    it('staff татгалзвал REJECTED болж, rejectedReason хадгалагдана, нөөц/refund хөндөгдөхгүй', async () => {
      const order = await checkoutAndComplete(branchA.id, branchManagerAToken);
      const before = await superuserPrisma.inventoryItem.findFirstOrThrow({
        where: { variantId, branchId: branchA.id },
      });

      const createRes = await request(app.getHttpServer())
        .post('/returns')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ orderItemId: order.items[0].id, reason: 'test reject' })
        .expect(201);
      const returnId = (createRes.body as ReturnRequestBody).id;

      const res = await request(app.getHttpServer())
        .patch(`/returns/${returnId}/reject`)
        .set('Authorization', `Bearer ${branchManagerAToken}`)
        .send({ rejectedReason: 'бүтээгдэхүүн эвдрээгүй нотлогдсон' })
        .expect(200);
      const body = res.body as ReturnRequestBody;
      expect(body.status).toBe('REJECTED');
      expect(body.rejectedReason).toBe('бүтээгдэхүүн эвдрээгүй нотлогдсон');

      await new Promise((resolve) => setTimeout(resolve, 300));
      const after = await superuserPrisma.inventoryItem.findUnique({
        where: { id: before.id },
      });
      expect(after?.quantity).toBe(before.quantity);
    });
  });

  describe('Тохиргооны API (GET/PUT /settings/return-fee-percent)', () => {
    it('token-гүй хүсэлт 401', async () => {
      await request(app.getHttpServer())
        .get('/settings/return-fee-percent')
        .expect(401);
    });

    it('нэвтэрсэн ямар ч дүр (CUSTOMER ч) GET хийж чадна', async () => {
      const res = await request(app.getHttpServer())
        .get('/settings/return-fee-percent')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);
      expect((res.body as { key: string }).key).toBe('RETURN_FEE_PERCENT');
    });

    it('global-scope БИШ дүр (SALESPERSON, BRANCH_MANAGER) PUT хийхийг оролдвол 403', async () => {
      await request(app.getHttpServer())
        .put('/settings/return-fee-percent')
        .set('Authorization', `Bearer ${salespersonAToken}`)
        .send({ value: 5 })
        .expect(403);
      await request(app.getHttpServer())
        .put('/settings/return-fee-percent')
        .set('Authorization', `Bearer ${branchManagerAToken}`)
        .send({ value: 5 })
        .expect(403);
    });

    it('0-100 хязгаараас гадуурх утга 400', async () => {
      await request(app.getHttpServer())
        .put('/settings/return-fee-percent')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ value: 150 })
        .expect(400);
    });

    it('SUPER_ADMIN шинэ утга тавихад дараагийн буцаалтын snapshot шинэ утгыг ашиглана', async () => {
      await request(app.getHttpServer())
        .put('/settings/return-fee-percent')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ value: 20 })
        .expect(200);

      const order = await checkoutAndComplete(branchA.id, branchManagerAToken);
      await request(app.getHttpServer())
        .post(`/payment/mock/simulate-paid/${order.providerInvoiceId}`)
        .expect(201);

      const createRes = await request(app.getHttpServer())
        .post('/returns')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ orderItemId: order.items[0].id, reason: 'шинэ шимтгэлээр' })
        .expect(201);
      const returnId = (createRes.body as ReturnRequestBody).id;

      const approveRes = await request(app.getHttpServer())
        .patch(`/returns/${returnId}/approve`)
        .set('Authorization', `Bearer ${branchManagerAToken}`)
        .expect(200);
      const body = approveRes.body as ReturnRequestBody;
      expect(Number(body.refundFeePercent)).toBe(20);
      // 10000 × 1 × (1 - 20/100) = 8000
      expect(Number(body.refundAmount)).toBe(8000);

      // Дараагийн тестүүдэд нөлөөлөхгүйн тулд анхны (10%) утгад буцаана.
      await request(app.getHttpServer())
        .put('/settings/return-fee-percent')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ value: 10 })
        .expect(200);
    });
  });

  it('SUPER_ADMIN бүх салбарын буцаалтын хүсэлтийг харна', async () => {
    const res = await request(app.getHttpServer())
      .get('/returns')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);
    expect((res.body as ReturnRequestBody[]).length).toBeGreaterThan(0);
  });

  it('token/header-гүй хүсэлт 401', async () => {
    const res = await request(app.getHttpServer()).get('/returns').expect(401);
    expect((res.body as ErrorBody).error.code).toBe('UNAUTHENTICATED');
  });
});
