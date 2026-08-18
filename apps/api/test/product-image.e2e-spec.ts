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

interface ProductImageBody {
  id: string;
  productId: string;
  objectKey: string;
  displayOrder: number;
  altText: string | null;
  url: string;
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

// docs/plan.md §8 Phase 2 Хэсэг A: ProductImage upload/delete (MinIO)-ийн
// e2e тест — CLAUDE.md-ийн "Тестийн стандарт — RLS mutation policy"
// зарчмын дагуу product_images_insert/delete-ийг ЧАДАМЖТАЙ HTTP-ийн
// зэрэгцээ, service давхаргыг тойрсон шууд SQL-ээр (RolesGuard-ыг ч
// тойрсон) шалгав.
describe('Product images (e2e)', () => {
  let app: INestApplication<App>;
  let superuserPrisma: PrismaClient;
  let prismaService: PrismaService;

  let branch: { id: string };
  let categoryId: string;
  let productId: string;

  let superAdminToken: string;
  let branchAdminToken: string;
  let branchManagerToken: string;
  let customerToken: string;
  let customerId: string;

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
      data: { name: `Салбар ${Date.now()}` },
    });

    const category = await superuserPrisma.category.create({
      data: { name: `Ангилал ${Date.now()}`, slug: `img-cat-${Date.now()}` },
    });
    categoryId = category.id;

    const product = await superuserPrisma.product.create({
      data: {
        name: 'Зурагтай бүтээгдэхүүн',
        slug: `img-product-${Date.now()}`,
        categoryId,
      },
    });
    productId = product.id;

    const superAdminId = randomUUID();
    const branchAdminId = randomUUID();
    const branchManagerId = randomUUID();
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
        id: branchAdminId,
        email: `badmin-${branchAdminId}@example.com`,
        authProvider: 'KEYCLOAK',
      },
    });
    await superuserPrisma.userBranchRole.create({
      data: {
        userId: branchAdminId,
        branchId: branch.id,
        role: 'BRANCH_ADMIN',
      },
    });

    await superuserPrisma.user.create({
      data: {
        id: branchManagerId,
        email: `bmgr-${branchManagerId}@example.com`,
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

    await superuserPrisma.user.create({
      data: {
        id: customerId,
        phone: `+9768${Date.now().toString().slice(-8)}`,
        authProvider: 'CUSTOMER_AUTH',
      },
    });

    superAdminToken = await mintAccessToken(superAdminId);
    branchAdminToken = await mintAccessToken(branchAdminId);
    branchManagerToken = await mintAccessToken(branchManagerId);
    customerToken = await mintAccessToken(customerId);
  });

  afterAll(async () => {
    await app.close();
    await superuserPrisma.$disconnect();
  });

  it('SUPER_ADMIN зөв jpg зураг upload хийж чадна, GET /products/:id хариунд public url-тэй ирнэ', async () => {
    const res = await request(app.getHttpServer())
      .post(`/products/${productId}/images`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .field('displayOrder', '1')
      .field('altText', 'Урд талаас')
      .attach('file', Buffer.from('fake-jpeg-bytes'), {
        filename: 'front.jpg',
        contentType: 'image/jpeg',
      })
      .expect(201);
    const body = res.body as ProductImageBody;
    expect(body.productId).toBe(productId);
    expect(body.displayOrder).toBe(1);
    expect(body.altText).toBe('Урд талаас');
    expect(body.objectKey).toMatch(
      new RegExp(`^products/${productId}/.+\\.jpg$`),
    );
    expect(body.url).toContain(body.objectKey);

    const productRes = await request(app.getHttpServer())
      .get(`/products/${productId}`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);
    const images = (productRes.body as { images: ProductImageBody[] }).images;
    expect(
      images.some((img) => img.id === body.id && img.url === body.url),
    ).toBe(true);

    const auditRow = await superuserPrisma.auditLog.findFirst({
      where: { tableName: 'product_images', recordId: body.id },
    });
    expect(auditRow).not.toBeNull();
  });

  it('BRANCH_ADMIN зураг upload хийж чадна (products_insert-тэй ижил дүрүүд)', async () => {
    await request(app.getHttpServer())
      .post(`/products/${productId}/images`)
      .set('Authorization', `Bearer ${branchAdminToken}`)
      .attach('file', Buffer.from('fake-png-bytes'), {
        filename: 'back.png',
        contentType: 'image/png',
      })
      .expect(201);
  });

  it('BRANCH_MANAGER/CUSTOMER upload хийх эрхгүй (403) — IMAGE_WRITE_ROLES-д ороогүй', async () => {
    const asManager = await request(app.getHttpServer())
      .post(`/products/${productId}/images`)
      .set('Authorization', `Bearer ${branchManagerToken}`)
      .attach('file', Buffer.from('x'), {
        filename: 'a.jpg',
        contentType: 'image/jpeg',
      })
      .expect(403);
    expect((asManager.body as ErrorBody).error.code).toBe('FORBIDDEN');

    const asCustomer = await request(app.getHttpServer())
      .post(`/products/${productId}/images`)
      .set('Authorization', `Bearer ${customerToken}`)
      .attach('file', Buffer.from('x'), {
        filename: 'a.jpg',
        contentType: 'image/jpeg',
      })
      .expect(403);
    expect((asCustomer.body as ErrorBody).error.code).toBe('FORBIDDEN');
  });

  it('зөвшөөрөгдөөгүй файлын төрөл (pdf) бол 400 INVALID_FILE_TYPE', async () => {
    const res = await request(app.getHttpServer())
      .post(`/products/${productId}/images`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .attach('file', Buffer.from('%PDF-1.4'), {
        filename: 'doc.pdf',
        contentType: 'application/pdf',
      })
      .expect(400);
    expect((res.body as ErrorBody).error.code).toBe('INVALID_FILE_TYPE');
  });

  it('файл огт дамжуулаагүй бол 400 FILE_REQUIRED', async () => {
    const res = await request(app.getHttpServer())
      .post(`/products/${productId}/images`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .field('altText', 'файлгүй')
      .expect(400);
    expect((res.body as ErrorBody).error.code).toBe('FILE_REQUIRED');
  });

  it('5MB-с том файл бол multer-ийн interceptor түвшинд 413 PAYLOAD_TOO_LARGE', async () => {
    const oversized = Buffer.alloc(6 * 1024 * 1024, 1);
    await request(app.getHttpServer())
      .post(`/products/${productId}/images`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .attach('file', oversized, {
        filename: 'huge.jpg',
        contentType: 'image/jpeg',
      })
      .expect(413);
  });

  it('байхгүй productId рүү upload хийвэл 404 PRODUCT_NOT_FOUND', async () => {
    const res = await request(app.getHttpServer())
      .post(`/products/${randomUUID()}/images`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .attach('file', Buffer.from('x'), {
        filename: 'a.jpg',
        contentType: 'image/jpeg',
      })
      .expect(404);
    expect((res.body as ErrorBody).error.code).toBe('PRODUCT_NOT_FOUND');
  });

  describe('DELETE /products/:productId/images/:id', () => {
    it('SUPER_ADMIN амжилттай устгана, дараа нь GET /products/:id-д ЭНЭ зураг гарахгүй', async () => {
      const uploadRes = await request(app.getHttpServer())
        .post(`/products/${productId}/images`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .attach('file', Buffer.from('to-delete'), {
          filename: 'del.jpg',
          contentType: 'image/jpeg',
        })
        .expect(201);
      const imageId = (uploadRes.body as ProductImageBody).id;

      await request(app.getHttpServer())
        .delete(`/products/${productId}/images/${imageId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      const productRes = await request(app.getHttpServer())
        .get(`/products/${productId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);
      const images = (productRes.body as { images: ProductImageBody[] }).images;
      expect(images.some((img) => img.id === imageId)).toBe(false);

      const dbRow = await superuserPrisma.productImage.findUnique({
        where: { id: imageId },
      });
      expect(dbRow).toBeNull();
    });

    it('өөр бүтээгдэхүүний imageId-аар (productId таарахгүй) устгах оролдвол 404', async () => {
      const otherProduct = await superuserPrisma.product.create({
        data: {
          name: 'Өөр бүтээгдэхүүн',
          slug: `other-product-${Date.now()}`,
          categoryId,
        },
      });
      const uploadRes = await request(app.getHttpServer())
        .post(`/products/${otherProduct.id}/images`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .attach('file', Buffer.from('x'), {
          filename: 'a.jpg',
          contentType: 'image/jpeg',
        })
        .expect(201);
      const imageId = (uploadRes.body as ProductImageBody).id;

      const res = await request(app.getHttpServer())
        .delete(`/products/${productId}/images/${imageId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(404);
      expect((res.body as ErrorBody).error.code).toBe(
        'PRODUCT_IMAGE_NOT_FOUND',
      );
    });
  });

  // CLAUDE.md "Тестийн стандарт — RLS mutation policy": service/RolesGuard
  // давхаргын урьдчилсан шалгалт (@Roles(), findFirst pre-check)
  // product_images_insert/delete policy-ийн WITH CHECK/USING кодын мөрийг
  // бодитоор ажиллуулахгүй нуух боломжтой тул RolesGuard-ыг ч тойрч, шууд
  // raw SQL-ээр CUSTOMER session-ээр оролдоно.
  describe('product_images RLS policy — service/RolesGuard-ыг тойрч шууд SQL-ээр', () => {
    it('product_images_insert: CUSTOMER raw INSERT хийж чадахгүй (row-level security алдаа шидэнэ)', async () => {
      const imageId = randomUUID();
      await expect(
        prismaService.runRequestTransaction(
          customerId,
          (tx) =>
            tx.$executeRaw`
            INSERT INTO product_images (id, "productId", "objectKey", "displayOrder")
            VALUES (${imageId}, ${productId}, 'products/hack/x.jpg', 0)
          `,
        ),
      ).rejects.toThrow(/row-level security/i);

      const leaked = await superuserPrisma.productImage.findUnique({
        where: { id: imageId },
      });
      expect(leaked).toBeNull();
    });

    it('product_images_delete: CUSTOMER raw DELETE 0 мөр өөрчилж чимээгүй "татгалздаг" (ADR 001-ийн UPDATE/DELETE зарчим)', async () => {
      const seeded = await superuserPrisma.productImage.create({
        data: { productId, objectKey: 'products/seed/keep.jpg' },
      });

      const affectedRows = await prismaService.runRequestTransaction(
        customerId,
        (tx) =>
          tx.$executeRaw`DELETE FROM product_images WHERE id = ${seeded.id}`,
      );
      expect(affectedRows).toBe(0);

      const stillThere = await superuserPrisma.productImage.findUnique({
        where: { id: seeded.id },
      });
      expect(stillThere).not.toBeNull();
    });
  });
});
