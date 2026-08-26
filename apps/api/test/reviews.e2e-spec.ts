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
  items: { id: string; variantId: string; quantity: number }[];
}

interface ReviewBody {
  id: string;
  customerId: string;
  productId: string;
  rating: number;
  comment: string | null;
}

interface ProductBody {
  id: string;
  canReview?: boolean;
  myReview?: ReviewBody | null;
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

// docs/plan.md §7 модуль #11: сэтгэгдэл/үнэлгээ — verified-purchase
// (COMPLETED захиалгаар худалдаж авсан) шалгалт, unique constraint,
// дундаж үнэлгээ, RLS дүр тус бүрээр.
describe('Reviews (e2e)', () => {
  let app: INestApplication<App>;
  let superuserPrisma: PrismaClient;
  let prismaService: PrismaService;

  let branch: { id: string };
  let productId: string;
  let variantId: string;

  let superAdminToken: string;
  let branchManagerToken: string;
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
      data: { name: `Сэтгэгдэл Салбар ${Date.now()}` },
    });

    const superAdminId = randomUUID();
    await superuserPrisma.user.create({
      data: {
        id: superAdminId,
        email: `review-super-${superAdminId}@example.com`,
        authProvider: 'KEYCLOAK',
      },
    });
    await superuserPrisma.userBranchRole.create({
      data: { userId: superAdminId, branchId: null, role: 'SUPER_ADMIN' },
    });
    superAdminToken = await mintAccessToken(superAdminId);

    const branchManagerId = randomUUID();
    await superuserPrisma.user.create({
      data: {
        id: branchManagerId,
        email: `review-mgr-${branchManagerId}@example.com`,
        authProvider: 'KEYCLOAK',
      },
    });
    await superuserPrisma.userBranchRole.create({
      data: {
        userId: branchManagerId,
        branchId: branch.id,
        role: 'BRANCH_MANAGER',
      },
    });
    branchManagerToken = await mintAccessToken(branchManagerId);

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
        name: `Сэтгэгдлийн ангилал ${unique}`,
        slug: `review-angilal-${unique}`,
      },
    });
    const product = await superuserPrisma.product.create({
      data: {
        name: 'Сэтгэгдлийн бүтээгдэхүүн',
        slug: `review-buteegdehuun-${unique}`,
        categoryId: category.id,
      },
    });
    productId = product.id;
    const variant = await superuserPrisma.productVariant.create({
      data: {
        productId,
        name: 'Стандарт',
        sku: `review-sku-${unique}`,
        basePrice: 5000,
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

  async function setCartItem(token: string, quantity: number): Promise<void> {
    await request(app.getHttpServer())
      .post('/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ variantId, quantity })
      .expect(201);
  }

  async function checkoutAndComplete(token: string): Promise<OrderBody> {
    await setCartItem(token, 1);
    const checkoutRes = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ branchId: branch.id })
      .expect(201);
    const orderId = (checkoutRes.body as OrderBody).id;

    for (const status of ['CONFIRMED', 'PREPARING', 'READY', 'COMPLETED']) {
      await request(app.getHttpServer())
        .patch(`/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${branchManagerToken}`)
        .send({ status })
        .expect(200);
    }

    const finalRes = await request(app.getHttpServer())
      .get(`/orders/${orderId}`)
      .set('Authorization', `Bearer ${branchManagerToken}`)
      .expect(200);
    return finalRes.body as OrderBody;
  }

  describe('POST /products/:id/reviews — verified-purchase шалгалт', () => {
    it('худалдаж аваагүй CUSTOMER сэтгэгдэл бичихийг оролдвол 403 PRODUCT_NOT_PURCHASED', async () => {
      const res = await request(app.getHttpServer())
        .post(`/products/${productId}/reviews`)
        .set('Authorization', `Bearer ${otherCustomerToken}`)
        .send({ rating: 5, comment: 'сайхан' })
        .expect(403);
      expect((res.body as ErrorBody).error.code).toBe('PRODUCT_NOT_PURCHASED');
    });

    it('COMPLETED захиалгаар худалдаж авсан CUSTOMER амжилттай сэтгэгдэл бичнэ', async () => {
      await checkoutAndComplete(customerToken);

      const res = await request(app.getHttpServer())
        .post(`/products/${productId}/reviews`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ rating: 5, comment: 'маш сайхан бүтээгдэхүүн' })
        .expect(201);
      const body = res.body as ReviewBody;
      expect(body.customerId).toBe(customerId);
      expect(body.productId).toBe(productId);
      expect(body.rating).toBe(5);

      const auditRow = await waitFor(() =>
        superuserPrisma.auditLog.findFirst({
          where: { tableName: 'reviews', recordId: body.id },
        }),
      );
      expect(auditRow).not.toBeNull();
    });

    it('2 дахь удаа ижил бүтээгдэхүүнд сэтгэгдэл бичихийг оролдвол 409 REVIEW_ALREADY_EXISTS', async () => {
      const res = await request(app.getHttpServer())
        .post(`/products/${productId}/reviews`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ rating: 3, comment: 'дахин оролдоод үзье' })
        .expect(409);
      expect((res.body as ErrorBody).error.code).toBe('REVIEW_ALREADY_EXISTS');
    });

    it('rating муж (1-5)-аас гадуур бол 400 (class-validator)', async () => {
      await request(app.getHttpServer())
        .post(`/products/${productId}/reviews`)
        .set('Authorization', `Bearer ${otherCustomerToken}`)
        .send({ rating: 6 })
        .expect(400);
    });

    // §Тестийн стандарт (CLAUDE.md): RLS mutation policy-г service
    // давхаргыг тойрч шууд SQL-ээр баталгаажуулна.
    it('reviews_insert RLS policy: худалдаж аваагүй CUSTOMER raw INSERT хийхийг оролдвол цуцлагдана', async () => {
      const reviewId = randomUUID();
      await expect(
        prismaService.runRequestTransaction(
          otherCustomerId,
          (tx) =>
            tx.$executeRaw`
            INSERT INTO reviews (id, "customerId", "productId", rating, "updatedAt")
            VALUES (${reviewId}, ${otherCustomerId}, ${productId}, 5, now())
          `,
        ),
      ).rejects.toThrow(/row-level security/i);

      const leaked = await superuserPrisma.review.findUnique({
        where: { id: reviewId },
      });
      expect(leaked).toBeNull();
    });
  });

  describe('GET /products/:id/reviews — paginated + дундаж үнэлгээ', () => {
    it('reviews/averageRating/totalCount зөв буцаана (денормалиц ХИЙХГҮЙ aggregate)', async () => {
      // Гуравдагч (шинэ) харилцагч худалдаж аваад rating=3 сэтгэгдэл
      // бичнэ — customerToken-ийн rating=5-тай хамт дундаж (5+3)/2=4.
      const thirdCustomerId = randomUUID();
      await superuserPrisma.user.create({
        data: {
          id: thirdCustomerId,
          phone: `+9763${Date.now().toString().slice(-8)}`,
          authProvider: 'CUSTOMER_AUTH',
        },
      });
      const thirdCustomerToken = await mintAccessToken(thirdCustomerId);
      await checkoutAndComplete(thirdCustomerToken);
      await request(app.getHttpServer())
        .post(`/products/${productId}/reviews`)
        .set('Authorization', `Bearer ${thirdCustomerToken}`)
        .send({ rating: 3 })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`/products/${productId}/reviews`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);
      const body = res.body as {
        reviews: ReviewBody[];
        averageRating: number;
        totalCount: number;
      };
      expect(body.totalCount).toBe(2);
      expect(body.averageRating).toBe(4);
      expect(body.reviews).toHaveLength(2);
    });
  });

  describe('GET /products/:id — canReview/myReview нэгтгэл (§7 модуль #11)', () => {
    it('худалдаж аваад аль хэдийн сэтгэгдэл бичсэн CUSTOMER: canReview=true, myReview агуулна', async () => {
      const res = await request(app.getHttpServer())
        .get(`/products/${productId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);
      const body = res.body as ProductBody;
      expect(body.canReview).toBe(true);
      expect(body.myReview?.rating).toBe(5);
    });

    it('худалдаж аваагүй CUSTOMER: canReview=false, myReview=null', async () => {
      const freshCustomerId = randomUUID();
      await superuserPrisma.user.create({
        data: {
          id: freshCustomerId,
          phone: `+9764${Date.now().toString().slice(-8)}`,
          authProvider: 'CUSTOMER_AUTH',
        },
      });
      const freshCustomerToken = await mintAccessToken(freshCustomerId);

      const res = await request(app.getHttpServer())
        .get(`/products/${productId}`)
        .set('Authorization', `Bearer ${freshCustomerToken}`)
        .expect(200);
      const body = res.body as ProductBody;
      expect(body.canReview).toBe(false);
      expect(body.myReview).toBeNull();
    });

    it('staff (CUSTOMER биш) хариунд canReview/myReview огт ОРОХГҮЙ', async () => {
      const res = await request(app.getHttpServer())
        .get(`/products/${productId}`)
        .set('Authorization', `Bearer ${branchManagerToken}`)
        .expect(200);
      const body = res.body as ProductBody;
      expect(body.canReview).toBeUndefined();
      expect(body.myReview).toBeUndefined();
    });
  });

  describe('PATCH /reviews/:id — зөвхөн өөрийн', () => {
    let reviewId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .get(`/products/${productId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);
      reviewId = (res.body as ProductBody).myReview!.id;
    });

    it('эзэмшигч засварлаж чадна', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ rating: 4, comment: 'бодлоо өөрчиллөө' })
        .expect(200);
      const body = res.body as ReviewBody;
      expect(body.rating).toBe(4);
      expect(body.comment).toBe('бодлоо өөрчиллөө');
    });

    it('бусад хэрэглэгч засварлахыг оролдвол 404 (RLS-ээр харагдахгүй)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${otherCustomerToken}`)
        .send({ rating: 1 })
        .expect(404);
      expect((res.body as ErrorBody).error.code).toBe('REVIEW_NOT_FOUND');
    });

    // ⚠️ UPDATE-ийн RLS татгалзал INSERT-ээс ЗАН ТӨЛӨВӨӨРӨӨ ӨӨР
    // (CLAUDE.md-ийн "Тестийн стандарт" хэсэг): алдаа ОГТ шидэхгүй, 0 мөр
    // өөрчилнө.
    it('reviews_update RLS policy: бусад хэрэглэгч raw UPDATE 0 мөр өөрчилнө (алдаа шидэхгүй)', async () => {
      const affectedRows = await prismaService.runRequestTransaction(
        otherCustomerId,
        (tx) =>
          tx.$executeRaw`UPDATE reviews SET rating = 1 WHERE id = ${reviewId}`,
      );
      expect(affectedRows).toBe(0);

      const row = await superuserPrisma.review.findUniqueOrThrow({
        where: { id: reviewId },
      });
      expect(row.rating).toBe(4);
    });
  });

  describe('DELETE /reviews/:id — өөрийн ЭСВЭЛ модераци', () => {
    async function createReview(token: string) {
      await checkoutAndComplete(token);
      const res = await request(app.getHttpServer())
        .post(`/products/${productId}/reviews`)
        .set('Authorization', `Bearer ${token}`)
        .send({ rating: 2, comment: 'дундаж' });
      return (res.body as ReviewBody).id;
    }

    it('эзэмшигч устгаж чадна', async () => {
      const newCustomerId = randomUUID();
      await superuserPrisma.user.create({
        data: {
          id: newCustomerId,
          phone: `+9765${Date.now().toString().slice(-8)}`,
          authProvider: 'CUSTOMER_AUTH',
        },
      });
      const newCustomerToken = await mintAccessToken(newCustomerId);
      const reviewId = await createReview(newCustomerToken);

      await request(app.getHttpServer())
        .delete(`/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${newCustomerToken}`)
        .expect(200);

      const row = await superuserPrisma.review.findUnique({
        where: { id: reviewId },
      });
      expect(row).toBeNull();
    });

    it('бусад CUSTOMER (модератор биш) устгахыг оролдвол 404', async () => {
      const ownerCustomerId = randomUUID();
      await superuserPrisma.user.create({
        data: {
          id: ownerCustomerId,
          phone: `+9766${Date.now().toString().slice(-8)}`,
          authProvider: 'CUSTOMER_AUTH',
        },
      });
      const ownerToken = await mintAccessToken(ownerCustomerId);
      const reviewId = await createReview(ownerToken);

      const res = await request(app.getHttpServer())
        .delete(`/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${otherCustomerToken}`)
        .expect(404);
      expect((res.body as ErrorBody).error.code).toBe('REVIEW_NOT_FOUND');
    });

    it('SUPER_ADMIN (модераци) бусдын сэтгэгдлийг устгаж чадна', async () => {
      const ownerCustomerId = randomUUID();
      await superuserPrisma.user.create({
        data: {
          id: ownerCustomerId,
          phone: `+9767${Date.now().toString().slice(-8)}`,
          authProvider: 'CUSTOMER_AUTH',
        },
      });
      const ownerToken = await mintAccessToken(ownerCustomerId);
      const reviewId = await createReview(ownerToken);

      await request(app.getHttpServer())
        .delete(`/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      const row = await superuserPrisma.review.findUnique({
        where: { id: reviewId },
      });
      expect(row).toBeNull();
    });
  });

  describe('GET /reviews — admin-web модераци жагсаалт', () => {
    it('SUPER_ADMIN бүтээгдэхүүний нэртэй хамт бүх сэтгэгдлийг харна', async () => {
      const res = await request(app.getHttpServer())
        .get('/reviews')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);
      const body = res.body as {
        reviews: (ReviewBody & { product: { name: string } })[];
      };
      expect(body.reviews.length).toBeGreaterThan(0);
      expect(body.reviews[0].product).toHaveProperty('name');
    });

    it('CUSTOMER модераци жагсаалт хийхийг оролдвол 403', async () => {
      await request(app.getHttpServer())
        .get('/reviews')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);
    });

    it('BRANCH_MANAGER (global scope биш) модераци жагсаалт хийхийг оролдвол 403', async () => {
      await request(app.getHttpServer())
        .get('/reviews')
        .set('Authorization', `Bearer ${branchManagerToken}`)
        .expect(403);
    });
  });
});
