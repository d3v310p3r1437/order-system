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

interface CouponBody {
  id: string;
  code: string;
  isActive: boolean;
  usageCount: number;
  usageLimit: number | null;
}

interface OrderBody {
  id: string;
  totalAmount: string;
  couponCode: string | null;
  discountAmount: string | null;
  items: { id: string; variantId: string; quantity: number }[];
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

// docs/adr/001-ийн benign race (returns.e2e-spec.ts-тэй ижил тайлбар): HTTP
// хариу ирсний дараа ч RlsMiddleware-ийн transaction commit хараахан бүрэн
// дуусаагүй байж болзошгүй тул өөр connection-оор шалгах assertion бүрийг
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

// docs/plan.md §7 модуль #10, §6.1 матриц "Урамшуулал/купон" мөр.
describe('Coupons (e2e)', () => {
  let app: INestApplication<App>;
  let superuserPrisma: PrismaClient;
  let prismaService: PrismaService;

  let branch: { id: string };
  let variantId: string;
  let variantBasePrice: number;

  let superAdminToken: string;
  let ownerToken: string;
  let allBranchManagerToken: string;
  let branchAdminToken: string;
  let branchManagerId: string;
  let branchManagerToken: string;
  let salespersonToken: string;
  let customerId: string;
  let customerToken: string;
  let otherCustomerId: string;
  let otherCustomerToken: string;

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

    branch = await superuserPrisma.branch.create({
      data: { name: `Купон Салбар ${Date.now()}` },
    });

    async function createStaff(role: string, branchId: string | null) {
      const id = randomUUID();
      await superuserPrisma.user.create({
        data: {
          id,
          email: `coupon-${role.toLowerCase()}-${id}@example.com`,
          authProvider: 'KEYCLOAK',
        },
      });
      await superuserPrisma.userBranchRole.create({
        data: { userId: id, branchId, role: role as never },
      });
      return { id, token: await mintAccessToken(id) };
    }

    const superAdmin = await createStaff('SUPER_ADMIN', null);
    superAdminToken = superAdmin.token;
    const owner = await createStaff('OWNER', null);
    ownerToken = owner.token;
    const allBranchManager = await createStaff('ALL_BRANCH_MANAGER', null);
    allBranchManagerToken = allBranchManager.token;
    const branchAdmin = await createStaff('BRANCH_ADMIN', branch.id);
    branchAdminToken = branchAdmin.token;
    const branchManager = await createStaff('BRANCH_MANAGER', branch.id);
    branchManagerId = branchManager.id;
    branchManagerToken = branchManager.token;
    const salesperson = await createStaff('SALESPERSON', branch.id);
    salespersonToken = salesperson.token;

    customerId = randomUUID();
    await superuserPrisma.user.create({
      data: {
        id: customerId,
        phone: `+9761${Date.now().toString().slice(-8)}`,
        authProvider: 'CUSTOMER_AUTH',
      },
    });
    customerToken = await mintAccessToken(customerId);

    otherCustomerId = randomUUID();
    await superuserPrisma.user.create({
      data: {
        id: otherCustomerId,
        phone: `+9762${Date.now().toString().slice(-8)}`,
        authProvider: 'CUSTOMER_AUTH',
      },
    });
    otherCustomerToken = await mintAccessToken(otherCustomerId);

    const unique = Date.now();
    const category = await superuserPrisma.category.create({
      data: {
        name: `Купоны ангилал ${unique}`,
        slug: `coupon-angilal-${unique}`,
      },
    });
    const product = await superuserPrisma.product.create({
      data: {
        name: 'Купоны бүтээгдэхүүн',
        slug: `coupon-buteegdehuun-${unique}`,
        categoryId: category.id,
      },
    });
    variantBasePrice = 10000;
    const variant = await superuserPrisma.productVariant.create({
      data: {
        productId: product.id,
        name: 'Стандарт',
        sku: `coupon-sku-${unique}`,
        basePrice: variantBasePrice,
      },
    });
    variantId = variant.id;
    await superuserPrisma.inventoryItem.create({
      data: { variantId, branchId: branch.id, quantity: 1000 },
    });
  });

  afterAll(async () => {
    await app.close();
    await superuserPrisma.$disconnect();
  });

  async function createCoupon(
    token: string,
    overrides: Record<string, unknown> = {},
  ) {
    const code = `TEST${randomUUID().slice(0, 8).toUpperCase()}`;
    const now = Date.now();
    const res = await request(app.getHttpServer())
      .post('/coupons')
      .set('Authorization', `Bearer ${token}`)
      .send({
        code,
        discountType: 'FIXED_AMOUNT',
        discountValue: 1000,
        validFrom: new Date(now - 60_000).toISOString(),
        validTo: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
        ...overrides,
      });
    return res;
  }

  async function setCartItem(token: string, quantity: number): Promise<void> {
    await request(app.getHttpServer())
      .post('/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ variantId, quantity })
      .expect(201);
  }

  describe('RBAC/RLS (§6.1 матриц)', () => {
    it('SUPER_ADMIN купон үүсгэж чадна', async () => {
      const res = await createCoupon(superAdminToken);
      expect(res.status).toBe(201);
      expect((res.body as CouponBody).usageCount).toBe(0);
    });

    it('ALL_BRANCH_MANAGER купон үүсгэж чадна', async () => {
      const res = await createCoupon(allBranchManagerToken);
      expect(res.status).toBe(201);
    });

    it('OWNER-д зөвхөн R/U байдаг тул үүсгэх (Create) оролдвол 403', async () => {
      const res = await createCoupon(ownerToken);
      expect(res.status).toBe(403);
    });

    it('BRANCH_ADMIN-д зөвхөн R байдаг тул үүсгэх оролдвол 403', async () => {
      const res = await createCoupon(branchAdminToken);
      expect(res.status).toBe(403);
    });

    it('OWNER идэвхтэй купоныг засварлаж (isActive=false) чадна', async () => {
      const created = await createCoupon(superAdminToken);
      const couponId = (created.body as CouponBody).id;

      const res = await request(app.getHttpServer())
        .patch(`/coupons/${couponId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ isActive: false })
        .expect(200);
      expect((res.body as CouponBody).isActive).toBe(false);
    });

    it('BRANCH_MANAGER/SALESPERSON GET /coupons жагсаалт хийхэд хоосон (RLS "—")', async () => {
      await createCoupon(superAdminToken);

      const bmRes = await request(app.getHttpServer())
        .get('/coupons')
        .set('Authorization', `Bearer ${branchManagerToken}`)
        .expect(200);
      expect(bmRes.body as CouponBody[]).toEqual([]);

      const spRes = await request(app.getHttpServer())
        .get('/coupons')
        .set('Authorization', `Bearer ${salespersonToken}`)
        .expect(200);
      expect(spRes.body as CouponBody[]).toEqual([]);
    });

    it('BRANCH_ADMIN GET /coupons жагсаалтаар БҮХ (идэвхгүй ч) купон харна', async () => {
      const created = await createCoupon(superAdminToken, { isActive: false });
      const couponId = (created.body as CouponBody).id;

      const res = await request(app.getHttpServer())
        .get('/coupons')
        .set('Authorization', `Bearer ${branchAdminToken}`)
        .expect(200);
      expect((res.body as CouponBody[]).some((c) => c.id === couponId)).toBe(
        true,
      );
    });

    it('CUSTOMER GET /coupons жагсаалтаар зөвхөн ИДЭВХТЭЙ купон харна', async () => {
      const inactive = await createCoupon(superAdminToken, { isActive: false });
      const active = await createCoupon(superAdminToken);

      const res = await request(app.getHttpServer())
        .get('/coupons')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);
      const ids = (res.body as CouponBody[]).map((c) => c.id);
      expect(ids).toContain((active.body as CouponBody).id);
      expect(ids).not.toContain((inactive.body as CouponBody).id);
    });

    // §Тестийн стандарт (CLAUDE.md, docs/plan.md §4.5/§9): RLS mutation
    // (INSERT/UPDATE) policy-г service давхаргыг тойрч шууд SQL-ээр
    // баталгаажуулна — HTTP давхаргаас "403" гарсан нь зөвхөн RolesGuard-ийг
    // л батална, RLS өөрийгөө биш.
    it('coupons_insert RLS policy: BRANCH_MANAGER (эрхгүй) raw INSERT хийхийг оролдвол цуцлагдана', async () => {
      const code = `RLSINS${Date.now()}`;
      await expect(
        prismaService.runRequestTransaction(
          branchManagerId,
          (tx) =>
            tx.$executeRaw`
            INSERT INTO coupons (id, code, "discountType", "discountValue", "validFrom", "validTo", "updatedAt")
            VALUES (${randomUUID()}, ${code}, 'FIXED_AMOUNT', 1000, now(), now() + interval '1 day', now())
          `,
        ),
      ).rejects.toThrow(/row-level security/i);

      const leaked = await superuserPrisma.coupon.findFirst({
        where: { code },
      });
      expect(leaked).toBeNull();
    });

    // ⚠️ UPDATE/DELETE-ийн RLS татгалзал INSERT-ээс ЗАН ТӨЛӨВӨӨРӨӨ ӨӨР
    // (CLAUDE.md-ийн "Тестийн стандарт" хэсэгт тайлбарласан): алдаа ОГТ
    // шидэхгүй, зүгээр л 0 мөр өөрчилнө (USING нөхцөлд тохирох мөр
    // "харагдахгүй" тул candidate болохгүй) — .rejects.toThrow() БИШ,
    // affected rows 0 БОЛОН DB-ийн бодит төлөв өөрчлөгдөөгүй эсэхийг
    // (өөр connection-оор дахин уншиж) шалгана.
    it('coupons_update RLS policy: BRANCH_MANAGER (эрхгүй) raw UPDATE 0 мөр өөрчилнө (алдаа шидэхгүй)', async () => {
      const created = await createCoupon(superAdminToken);
      const couponId = (created.body as CouponBody).id;

      const affectedRows = await prismaService.runRequestTransaction(
        branchManagerId,
        (tx) =>
          tx.$executeRaw`UPDATE coupons SET "isActive" = false WHERE id = ${couponId}`,
      );
      expect(affectedRows).toBe(0);

      const row = await superuserPrisma.coupon.findUniqueOrThrow({
        where: { id: couponId },
      });
      expect(row.isActive).toBe(true);
    });
  });

  describe('GET /coupons/validate', () => {
    it('хүчинтэй код: discountAmount зөв тооцоологдоно', async () => {
      const created = await createCoupon(superAdminToken, {
        discountType: 'PERCENTAGE',
        discountValue: 10,
      });
      const code = (created.body as CouponBody).code;

      const res = await request(app.getHttpServer())
        .get('/coupons/validate')
        .query({ code, orderAmount: '10000' })
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);
      const body = res.body as { valid: boolean; discountAmount: string };
      expect(body.valid).toBe(true);
      expect(body.discountAmount).toBe('1000');
    });

    it('байхгүй код: 404 COUPON_NOT_FOUND', async () => {
      const res = await request(app.getHttpServer())
        .get('/coupons/validate')
        .query({ code: 'NOSUCHCODE', orderAmount: '10000' })
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(404);
      expect((res.body as ErrorBody).error.code).toBe('COUPON_NOT_FOUND');
    });

    it('minOrderAmount хангаагүй бол 400 COUPON_MIN_ORDER_NOT_MET', async () => {
      const created = await createCoupon(superAdminToken, {
        minOrderAmount: 50000,
      });
      const code = (created.body as CouponBody).code;

      const res = await request(app.getHttpServer())
        .get('/coupons/validate')
        .query({ code, orderAmount: '10000' })
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(400);
      expect((res.body as ErrorBody).error.code).toBe(
        'COUPON_MIN_ORDER_NOT_MET',
      );
    });

    it('хугацаа дууссан бол CUSTOMER-д 404 (RLS-ээр урьдаас хараагдахгүй)', async () => {
      const now = Date.now();
      const created = await createCoupon(superAdminToken, {
        validFrom: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
        validTo: new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString(),
      });
      const code = (created.body as CouponBody).code;

      const res = await request(app.getHttpServer())
        .get('/coupons/validate')
        .query({ code, orderAmount: '10000' })
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(404);
      expect((res.body as ErrorBody).error.code).toBe('COUPON_NOT_FOUND');
    });

    // ⚠️ ЗААВАЛ: GET /coupons/validate нь МУТАЦИАГҮЙ (зөвхөн урьдчилан
    // харах) байх ёстой — CouponController.validate() зөвхөн
    // CouponService.validateForCheckout()-ыг л дуудна (read-only,
    // Prisma findUnique/count), redeemAtomic()/app_redeem_coupon()-г
    // (usageCount-ыг бодитоор нэмэгдүүлдэг цорын ганц зам) ХЭЗЭЭ Ч
    // дуудахгүй — тэр зөвхөн OrderService.checkout()-ийн дотор л
    // дуудагдана (order.service.ts:340). Ижил кодыг олон удаа (жиш:
    // Flutter-ийн "Ашиглах" товч дараа дараагийн дэлгэц дээр дахин
    // нээгдэх) дуудсан ч купон "дуусахгүй" гэдгийг баталгаажуулна.
    it('5 удаа дараалан дуудсан ч Coupon.usageCount ОГТ өөрчлөгдөхгүй (мутациагүй)', async () => {
      const created = await createCoupon(superAdminToken, { usageLimit: 3 });
      const coupon = created.body as CouponBody;
      expect(coupon.usageCount).toBe(0);

      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer())
          .get('/coupons/validate')
          .query({ code: coupon.code, orderAmount: '10000' })
          .set('Authorization', `Bearer ${customerToken}`)
          .expect(200);
      }

      const row = await superuserPrisma.coupon.findUniqueOrThrow({
        where: { id: coupon.id },
      });
      expect(row.usageCount).toBe(0);
      const redemptions = await superuserPrisma.couponRedemption.count({
        where: { couponId: coupon.id },
      });
      expect(redemptions).toBe(0);
    });
  });

  describe('Checkout-той нэгтгэл', () => {
    it('хүчинтэй купон хэрэглэвэл totalAmount хямдарч, coupon.usageCount 1-ээр нэмэгдэнэ', async () => {
      const created = await createCoupon(superAdminToken, {
        discountType: 'FIXED_AMOUNT',
        discountValue: 2000,
      });
      const coupon = created.body as CouponBody;

      await setCartItem(customerToken, 1);
      const res = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ branchId: branch.id, couponCode: coupon.code })
        .expect(201);
      const order = res.body as OrderBody;
      expect(order.couponCode).toBe(coupon.code);
      expect(order.discountAmount).toBe('2000');
      expect(order.totalAmount).toBe(String(variantBasePrice - 2000));

      const row = await waitFor(async () => {
        const c = await superuserPrisma.coupon.findUniqueOrThrow({
          where: { id: coupon.id },
        });
        return c.usageCount === 1 ? c : null;
      });
      expect(row.usageCount).toBe(1);
    });

    it('нэг хэрэглэгч ижил купоныг 2 дахь удаа ашиглахыг оролдвол 409 COUPON_ALREADY_USED', async () => {
      const created = await createCoupon(superAdminToken);
      const coupon = created.body as CouponBody;

      await setCartItem(customerToken, 1);
      await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ branchId: branch.id, couponCode: coupon.code })
        .expect(201);

      await setCartItem(customerToken, 1);
      const res = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ branchId: branch.id, couponCode: coupon.code })
        .expect(409);
      expect((res.body as ErrorBody).error.code).toBe('COUPON_ALREADY_USED');
    });

    it('буруу/байхгүй код бол checkout бүхэлдээ 404-ээр амжилтгүй болно (захиалга үүсэхгүй)', async () => {
      await setCartItem(customerToken, 1);
      const res = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ branchId: branch.id, couponCode: 'NOSUCHCODE' })
        .expect(404);
      expect((res.body as ErrorBody).error.code).toBe('COUPON_NOT_FOUND');
    });

    // ЗААВАЛ: ЗЭРЭГ (Promise.all) 2 ӨӨР хэрэглэгч сүүлчийн үлдсэн 1
    // ашиглалтын хязгаартай купон дээр зэрэг checkout хийхэд ЗӨВХӨН НЭГ
    // нь амжилттай болж, usageCount хэзээ ч хязгаараас хэтрэхгүй байх
    // ёстой (returns PR #7-ийн "davhar refund race" тестийн загварыг
    // дахин ашигласан — app_redeem_coupon()-ий "SELECT ... FOR UPDATE"
    // мөрийн lock л энэ race-ийг зогсоох ёстой цорын ганц механизм).
    it('ЗЭРЭГ (Promise.all) 2 хэрэглэгч сүүлчийн 1 ашиглалттай купон дээр checkout хийхэд ЗӨВХӨН 1 нь амжилттай', async () => {
      const created = await createCoupon(superAdminToken, { usageLimit: 1 });
      const coupon = created.body as CouponBody;

      await setCartItem(customerToken, 1);
      await setCartItem(otherCustomerToken, 1);

      const [resA, resB] = await Promise.all([
        request(app.getHttpServer())
          .post('/orders')
          .set('Authorization', `Bearer ${customerToken}`)
          .send({ branchId: branch.id, couponCode: coupon.code }),
        request(app.getHttpServer())
          .post('/orders')
          .set('Authorization', `Bearer ${otherCustomerToken}`)
          .send({ branchId: branch.id, couponCode: coupon.code }),
      ]);

      const statuses = [resA.status, resB.status].sort();
      expect(statuses).toEqual([201, 409]);

      const successRes = resA.status === 201 ? resA : resB;
      expect((successRes.body as OrderBody).couponCode).toBe(coupon.code);

      const row = await waitFor(async () => {
        const c = await superuserPrisma.coupon.findUniqueOrThrow({
          where: { id: coupon.id },
        });
        return c.usageCount === 1 ? c : null;
      });
      // ЗӨВХӨН 1 (биш 2) — usageLimit=1 хэзээ ч хэтрээгүй.
      expect(row.usageCount).toBe(1);

      const redemptions = await superuserPrisma.couponRedemption.count({
        where: { couponId: coupon.id },
      });
      expect(redemptions).toBe(1);
    });
  });
});
