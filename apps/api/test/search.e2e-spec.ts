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
    color?: string | null;
    size?: string | null;
    availability: { status: string; leadDays: number | null };
  }[];
}

interface SearchFacets {
  colors: string[];
  sizes: string[];
}

interface SearchResponse {
  products: SearchResultProduct[];
  facets: SearchFacets;
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

  async function searchWithFacets(
    token: string,
    query: Record<string, string>,
  ): Promise<SearchResponse> {
    const res = await request(app.getHttpServer())
      .get('/catalog/search')
      .query(query)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    return res.body as SearchResponse;
  }

  async function searchFor(
    token: string,
    query: Record<string, string>,
  ): Promise<SearchResultProduct[]> {
    const body = await searchWithFacets(token, query);
    return body.products;
  }

  async function createVariant(data: {
    productId: string;
    name: string;
    sku: string;
    color?: string;
    size?: string;
  }): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/product-variants')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        productId: data.productId,
        name: data.name,
        sku: data.sku,
        basePrice: 10000,
        color: data.color,
        size: data.size,
      })
      .expect(201);
    return (res.body as { id: string }).id;
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

  // GET /products/:id-ийн "мэдээлэл алдагдаагүй" e2e загварын (test/
  // catalog-inventory.e2e-spec.ts-ийн "quantity/branchId дотоод
  // мэдээлэл харагдахгүй" тест) ЯГ ижил зарчмаар GET /catalog/search-г
  // мөн баталгаажуулна — findManyWithAvailability() нь findOne()-той адил
  // hydrateProduct()-г дахин ашигладаг ч, энэ баталгааг хайлтын замаар ч
  // тусад нь батлах ёстой (endpoint тус бүр өөрийн гэсэн e2e нотолгоотой
  // байх ёстой, findOne()-ийн тест дотоод хэрэгжилтийн дэлгэрэнгүйг
  // мэдэхгүй тул).
  it('CUSTOMER-ийн хайлтын хариунд InventoryItem-ийн raw quantity/branchId ил гардаггүй, зөвхөн тооцоолсон availability status буцна', async () => {
    const tag = freshTag();
    const branch = await superuserPrisma.branch.create({
      data: { name: `Хайлтын салбар ${tag}` },
    });
    const productId = await createProduct({
      name: `${tag} Нөөцтэй бараа`,
      categoryId: categoryA.id,
    });
    const variantRes = await request(app.getHttpServer())
      .post('/product-variants')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        productId,
        name: 'Стандарт',
        sku: `search-sku-${tag}`,
        basePrice: 10000,
      })
      .expect(201);
    const variantId = (variantRes.body as { id: string }).id;

    await request(app.getHttpServer())
      .post('/inventory-items')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ variantId, branchId: branch.id, quantity: 42 })
      .expect(201);

    const results = await waitFor(async () => {
      const hits = await searchFor(customerToken, {
        q: `${tag} Нөөцтэй бараа`,
        branchId: branch.id,
      });
      return hits.length >= 1 ? hits : null;
    });

    const product = results.find((p) => p.id === productId);
    const variant = product?.variants.find((v) => v.id === variantId);
    expect(variant?.availability).toEqual({
      status: 'IN_STOCK',
      leadDays: null,
    });
    expect(variant?.availability).not.toHaveProperty('quantity');
    expect(variant?.availability).not.toHaveProperty('branchId');
    expect(JSON.stringify(results)).not.toContain('"quantity"');
    expect(JSON.stringify(results)).not.toContain('"branchId"');
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

  // §7 модуль #3-ийн UX сайжруулалт (2026-09-05): ProductVariant.color/
  // size-ийг Meilisearch-д денормалчилж, color/size query параметр +
  // facets хариу нэмсэн (Хэсэг A, даалгавар #2, #3).
  describe('color/size шүүлт + facets (2026-09-05)', () => {
    it('color query параметр зөвхөн тухайн өнгөтэй variant-той Product-ыг буцаана', async () => {
      const tag = freshTag();
      const redProductId = await createProduct({
        name: `${tag} Цамц А`,
        categoryId: categoryA.id,
      });
      await createVariant({
        productId: redProductId,
        name: 'Улаан',
        sku: `${tag}-red`,
        color: 'улаан',
        size: 'M',
      });
      const blueProductId = await createProduct({
        name: `${tag} Цамц Б`,
        categoryId: categoryA.id,
      });
      await createVariant({
        productId: blueProductId,
        name: 'Хөх',
        sku: `${tag}-blue`,
        color: 'хөх',
        size: 'L',
      });

      const results = await waitFor(async () => {
        const hits = await searchFor(superAdminToken, {
          q: `${tag} Цамц`,
          color: 'улаан',
        });
        return hits.length >= 1 ? hits : null;
      });

      const ids = results.map((p) => p.id);
      expect(ids).toContain(redProductId);
      expect(ids).not.toContain(blueProductId);
    });

    it('size query параметр зөвхөн тухайн хэмжээтэй variant-той Product-ыг буцаана', async () => {
      const tag = freshTag();
      const sProductId = await createProduct({
        name: `${tag} Өмд А`,
        categoryId: categoryA.id,
      });
      await createVariant({
        productId: sProductId,
        name: 'S',
        sku: `${tag}-s`,
        size: 'S',
      });
      const lProductId = await createProduct({
        name: `${tag} Өмд Б`,
        categoryId: categoryA.id,
      });
      await createVariant({
        productId: lProductId,
        name: 'L',
        sku: `${tag}-l`,
        size: 'L',
      });

      const results = await waitFor(async () => {
        const hits = await searchFor(superAdminToken, {
          q: `${tag} Өмд`,
          size: 'S',
        });
        return hits.length >= 1 ? hits : null;
      });

      const ids = results.map((p) => p.id);
      expect(ids).toContain(sProductId);
      expect(ids).not.toContain(lProductId);
    });

    it('facets нь color/size-ийн сонголтоос ХАМААРАЛГҮЙ (сонгосны дараа ч бусад боломжит утга хэвээр харагдана)', async () => {
      const tag = freshTag();
      const productId = await createProduct({
        name: `${tag} Малгай`,
        categoryId: categoryA.id,
      });
      await createVariant({
        productId,
        name: 'Улаан S',
        sku: `${tag}-1`,
        color: 'улаан',
        size: 'S',
      });
      await createVariant({
        productId,
        name: 'Хөх L',
        sku: `${tag}-2`,
        color: 'хөх',
        size: 'L',
      });

      const body = await waitFor(async () => {
        const res = await searchWithFacets(superAdminToken, {
          q: `${tag} Малгай`,
          color: 'улаан',
        });
        return res.products.length >= 1 ? res : null;
      });

      // Hits: зөвхөн улаан (color шүүлтээр шүүгдсэн).
      expect(body.products.map((p) => p.id)).toEqual([productId]);
      // Facets: улаан СОНГОСОН ч хөх-ийг ч сонголтод санал болгоно (q+
      // category-аар л шүүгдсэн, color-оор ШҮҮГДЭЭГҮЙ тул).
      expect(body.facets.colors).toEqual(
        expect.arrayContaining(['улаан', 'хөх']),
      );
      expect(body.facets.sizes).toEqual(expect.arrayContaining(['S', 'L']));
    });

    it('PATCH /product-variants/:id-ээр color өөрчлөгдвөл эцэг Product-ийн индекс шинэчлэгдэж, шинэ өнгөөр олддог болно', async () => {
      const tag = freshTag();
      const productId = await createProduct({
        name: `${tag} Куртка`,
        categoryId: categoryA.id,
      });
      const variantId = await createVariant({
        productId,
        name: 'Ногоон',
        sku: `${tag}-green`,
        color: 'ногоон',
      });
      await waitFor(async () => {
        const hits = await searchFor(superAdminToken, {
          q: `${tag} Куртка`,
          color: 'ногоон',
        });
        return hits.length >= 1 ? hits : null;
      });

      await request(app.getHttpServer())
        .patch(`/product-variants/${variantId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ color: 'шар' })
        .expect(200);

      await waitFor(async () => {
        const hits = await searchFor(superAdminToken, {
          q: `${tag} Куртка`,
          color: 'шар',
        });
        return hits.length >= 1 ? hits : null;
      });
      const oldColorHits = await searchFor(superAdminToken, {
        q: `${tag} Куртка`,
        color: 'ногоон',
      });
      expect(oldColorHits.map((p) => p.id)).not.toContain(productId);
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
