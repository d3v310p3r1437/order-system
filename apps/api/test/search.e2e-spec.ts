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

interface SearchResultProduct {
  id: string;
  name: string;
  categoryId: string;
  isActive: boolean;
  variants: {
    id: string;
    availability: { status: string; leadDays: number | null };
  }[];
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

// Meilisearch индексжилт нь SearchIndexer.indexProduct()-ийн onCommit()-оор
// хойшлогдож, RLS transaction COMMIT хийгдсэний ДАРАА л (HTTP хариу аль
// хэдийн буцсаны дараа ч байж болно) явагддаг тул тестүүд poll хийж хүлээх
// ёстой (test/returns.e2e-spec.ts-ийн audit лог-ийн waitFor()-той ижил зарчим).
async function waitFor<T>(
  fn: () => Promise<T | null>,
  timeoutMs = 3000,
  intervalMs = 100,
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

// docs/plan.md §8 Phase 2 Хэсэг B: GET /catalog/search e2e (бодит
// Meilisearch container-тэй, docker-compose.dev.yml/CI-ийн meilisearch
// service ашигласан).
describe('Catalog search (e2e)', () => {
  let app: INestApplication<App>;
  let superuserPrisma: PrismaClient;

  let categoryA: { id: string };
  let categoryB: { id: string };
  let superAdminToken: string;
  let customerToken: string;

  const unique = Date.now();
  // Meilisearch-ийн "products" индекс бүх e2e spec файлуудын (БОЛОН ЭНЭ
  // ФАЙЛ дотрох `it()` тус бүрийн хооронд ч) ХУВААЛЦСАН (Postgres-ийн
  // RLS/transaction-аар тусгаарлагддаг DB мөрүүдээс ЯЛГААТАЙ) НЭГ л
  // глобал нөөц. Meilisearch-ийн анхдагч matching strategy ("last") нь
  // илүү олон үр дүн олохын тулд query-ийн СҮҮЛИЙН үгсийг "хаяж" болдог
  // тул (жиш: "TAG Ноолуур" query "Ноолуур"-г хаяад зөвхөн "TAG"-аар
  // хайж эхэлбэл) НЭГ л tag-ийг бүх `it()`-д хуваалцвал тэдгээрийн
  // өөрсдийнх нь өөр тестийн Product-той холилдохыг бодитоор нотолсон
  // (өмнө нь файл-түвшний ганц `tag` ашигласан үед л ажиглагдсан).
  // Тиймээс `it()` тус бүр өөрийн ганцаарчилсан `freshTag()`-ийг ашиглана.
  function freshTag(): string {
    return `srch${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
  }

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

    categoryA = await superuserPrisma.category.create({
      data: { name: `Цамц ${unique}`, slug: `search-cat-a-${unique}` },
    });
    categoryB = await superuserPrisma.category.create({
      data: { name: `Пальто ${unique}`, slug: `search-cat-b-${unique}` },
    });

    const superAdminId = randomUUID();
    const customerId = randomUUID();
    await superuserPrisma.user.create({
      data: {
        id: superAdminId,
        email: `search-super-${superAdminId}@example.com`,
        authProvider: 'KEYCLOAK',
      },
    });
    await superuserPrisma.userBranchRole.create({
      data: { userId: superAdminId, branchId: null, role: 'SUPER_ADMIN' },
    });
    await superuserPrisma.user.create({
      data: {
        id: customerId,
        phone: `+9767${Date.now().toString().slice(-8)}`,
        authProvider: 'CUSTOMER_AUTH',
      },
    });

    superAdminToken = await mintAccessToken(superAdminId);
    customerToken = await mintAccessToken(customerId);
  });

  afterAll(async () => {
    await app.close();
    await superuserPrisma.$disconnect();
  });

  async function createProduct(data: {
    name: string;
    categoryId: string;
    isActive?: boolean;
  }): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        name: data.name,
        slug: `${data.name.toLowerCase().replace(/\s+/g, '-')}-${randomUUID()}`,
        categoryId: data.categoryId,
        isActive: data.isActive ?? true,
      })
      .expect(201);
    return (res.body as { id: string }).id;
  }

  async function searchFor(
    token: string,
    query: Record<string, string>,
  ): Promise<SearchResultProduct[]> {
    const res = await request(app.getHttpServer())
      .get('/catalog/search')
      .query(query)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    return res.body as SearchResultProduct[];
  }

  it('token-гүй хүсэлт 401 (нэвтрээгүй) — ProductController-тэй ижил зарчим', async () => {
    const res = await request(app.getHttpServer())
      .get('/catalog/search')
      .query({ q: 'юу ч' })
      .expect(401);
    expect((res.body as ErrorBody).error.code).toBe('UNAUTHENTICATED');
  });

  it('нэр (эсвэл түүний хэсэг)-ээр хайхад тохирох Product олдоно, тохирохгүйг нь буцаахгүй', async () => {
    const tag = freshTag();
    const noolluurTsamts = await createProduct({
      name: `${tag} Ноолуур цамц`,
      categoryId: categoryA.id,
    });
    const noolluurPalto = await createProduct({
      name: `${tag} Ноолуур пальто`,
      categoryId: categoryB.id,
    });
    await createProduct({
      name: `${tag} Хөвөн цамц`,
      categoryId: categoryA.id,
    });

    const results = await waitFor(async () => {
      const hits = await searchFor(superAdminToken, { q: `${tag} Ноолуур` });
      return hits.length >= 2 ? hits : null;
    });

    const ids = results.map((p) => p.id);
    expect(ids).toEqual(
      expect.arrayContaining([noolluurTsamts, noolluurPalto]),
    );
    expect(ids.length).toBe(2);
  });

  it('categoryId filter-тэй хайлт зөвхөн тухайн ангиллын бүтээгдэхүүнийг буцаана', async () => {
    const tag = freshTag();
    const inCategoryA = await createProduct({
      name: `${tag} Ноос цамц`,
      categoryId: categoryA.id,
    });
    await createProduct({
      name: `${tag} Ноос пальто`,
      categoryId: categoryB.id,
    });

    const results = await waitFor(async () => {
      const hits = await searchFor(superAdminToken, {
        q: `${tag} Ноос`,
        categoryId: categoryA.id,
      });
      return hits.length >= 1 ? hits : null;
    });

    expect(results.map((p) => p.id)).toEqual([inCategoryA]);
    expect(results.every((p) => p.categoryId === categoryA.id)).toBe(true);
  });

  it('isActive=false Product хайлтын үр дүнд ХЭЗЭЭ Ч гарахгүй', async () => {
    const tag = freshTag();
    const activeId = await createProduct({
      name: `${tag} Идэвхтэй бараа`,
      categoryId: categoryA.id,
    });
    await createProduct({
      name: `${tag} Идэвхгүй бараа`,
      categoryId: categoryA.id,
      isActive: false,
    });

    const results = await waitFor(async () => {
      const hits = await searchFor(superAdminToken, { q: `${tag} бараа` });
      return hits.length >= 1 ? hits : null;
    });

    const ids = results.map((p) => p.id);
    expect(ids).toContain(activeId);
    expect(results.every((p) => p.isActive)).toBe(true);
  });

  it('CUSTOMER (@Roles()-гүй endpoint) мөн адил хайлт хийж чадна', async () => {
    const tag = freshTag();
    const productId = await createProduct({
      name: `${tag} Харилцагчийн хайлт`,
      categoryId: categoryA.id,
    });

    const results = await waitFor(async () => {
      const hits = await searchFor(customerToken, {
        q: `${tag} Харилцагчийн хайлт`,
      });
      return hits.length >= 1 ? hits : null;
    });
    expect(results.map((p) => p.id)).toContain(productId);
  });

  it('PATCH /products/:id-ээр нэр өөрчлөгдвөл индекс шинэчлэгдэж, шинэ нэрээр олддог болно', async () => {
    const tag = freshTag();
    const productId = await createProduct({
      name: `${tag} Хуучин нэр`,
      categoryId: categoryA.id,
    });
    // Индекслэгдэхийг хүлээнэ (дараа нь update хийхэд хуучин баримт
    // overwrite хийгдэх ёстой, шинэ баримт нэмэгдэхгүй).
    await waitFor(async () => {
      const hits = await searchFor(superAdminToken, { q: `${tag} Хуучин нэр` });
      return hits.length >= 1 ? hits : null;
    });

    await request(app.getHttpServer())
      .patch(`/products/${productId}`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ name: `${tag} Шинэ нэр` })
      .expect(200);

    const results = await waitFor(async () => {
      const hits = await searchFor(superAdminToken, { q: `${tag} Шинэ нэр` });
      return hits.length >= 1 ? hits : null;
    });
    expect(results.map((p) => p.id)).toContain(productId);

    const oldNameHits = await searchFor(superAdminToken, {
      q: `${tag} Хуучин нэр`,
    });
    expect(oldNameHits.map((p) => p.id)).not.toContain(productId);
  });

  it('DELETE /products/:id-ийн дараа тухайн Product хайлтад ХЭЗЭЭ Ч гарахгүй', async () => {
    const tag = freshTag();
    const productId = await createProduct({
      name: `${tag} Устгагдах бараа`,
      categoryId: categoryA.id,
    });
    await waitFor(async () => {
      const hits = await searchFor(superAdminToken, {
        q: `${tag} Устгагдах бараа`,
      });
      return hits.length >= 1 ? hits : null;
    });

    await request(app.getHttpServer())
      .delete(`/products/${productId}`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);

    await waitFor(async () => {
      const hits = await searchFor(superAdminToken, {
        q: `${tag} Устгагдах бараа`,
      });
      return hits.length === 0 ? hits : null;
    });
  });

  describe('POST /catalog/search/reindex', () => {
    it('SUPER_ADMIN БУС дүр (CUSTOMER) 403', async () => {
      const res = await request(app.getHttpServer())
        .post('/catalog/search/reindex')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);
      expect((res.body as ErrorBody).error.code).toBe('FORBIDDEN');
    });

    it('SUPER_ADMIN бүх Product-ыг дахин индекслэж, тоог буцаана', async () => {
      // ЭНД `toBe`-ээр яг тэнцүү тоо шалгахгүй — Postgres ("products"
      // хүснэгт) бусад e2e spec файлуудтай (зэрэгцээ Jest worker) ХУВААЛЦСАН
      // тул count()-ийн дараа, reindex дуудахаас өмнөх агшинд өөр тестээс
      // шинэ Product орж ирж болзошгүй (race) — `>=`-ээр илүү тэсвэртэй.
      const totalProducts = await superuserPrisma.product.count();

      const res = await request(app.getHttpServer())
        .post('/catalog/search/reindex')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(
        (res.body as { reindexed: number }).reindexed,
      ).toBeGreaterThanOrEqual(totalProducts);
    });
  });
});
