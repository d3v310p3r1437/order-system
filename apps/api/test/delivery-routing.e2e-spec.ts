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
  deliveryMethod: string;
  deliveryAddress: string | null;
  deliveryLatitude: number | null;
  deliveryLongitude: number | null;
}

interface RouteBody {
  distanceMeters: number;
  durationSeconds: number;
  geometry: [number, number][];
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

// docs/plan.md §8 Phase 4, Хэсэг A: checkout-ийн deliveryMethod/Address/
// Latitude/Longitude DTO validation БОЛОН GET /orders/:id/route
// (MockRoutingProvider, ROUTING_PROVIDER=mock анхдагч) бодит Postgres/RLS-тэй.
describe('Delivery/Routing (e2e)', () => {
  let app: INestApplication<App>;
  let superuserPrisma: PrismaClient;

  let branch: { id: string; latitude: number; longitude: number };
  let branchWithoutGeo: { id: string };

  let superAdminToken: string;
  let customerToken: string;

  let variantId: string;

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

    branch = (await superuserPrisma.branch.create({
      data: {
        name: `Хүргэлт Салбар ${Date.now()}`,
        latitude: 47.918,
        longitude: 106.917,
      },
    })) as typeof branch;
    branchWithoutGeo = await superuserPrisma.branch.create({
      data: { name: `Байршилгүй Салбар ${Date.now()}` },
    });

    const superAdminId = randomUUID();
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
        id: customerId,
        phone: `+9767${Date.now().toString().slice(-8)}`,
        authProvider: 'CUSTOMER_AUTH',
      },
    });

    superAdminToken = await mintAccessToken(superAdminId);
    customerToken = await mintAccessToken(customerId);

    const unique = Date.now();
    const category = await superuserPrisma.category.create({
      data: {
        name: `Хүргэлтийн ангилал ${unique}`,
        slug: `hurgelt-angilal-${unique}`,
      },
    });
    const product = await superuserPrisma.product.create({
      data: {
        name: 'Хүргэлтийн бүтээгдэхүүн',
        slug: `hurgelt-buteegdehuun-${unique}`,
        categoryId: category.id,
      },
    });
    const variant = await superuserPrisma.productVariant.create({
      data: {
        productId: product.id,
        name: 'Стандарт',
        sku: `hurgelt-sku-${unique}`,
        basePrice: 10000,
      },
    });
    variantId = variant.id;

    await superuserPrisma.inventoryItem.create({
      data: { variantId, branchId: branch.id, quantity: 100 },
    });
    await superuserPrisma.inventoryItem.create({
      data: { variantId, branchId: branchWithoutGeo.id, quantity: 100 },
    });
  });

  afterAll(async () => {
    await app.close();
    await superuserPrisma.$disconnect();
  });

  describe('POST /orders — deliveryMethod DTO validation', () => {
    it('deliveryMethod огт өгөөгүй бол PICKUP гэж тооцож 201 (одоо байгаа checkout дуудлагуудтай нийцтэй)', async () => {
      const res = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ branchId: branch.id, items: [{ variantId, quantity: 1 }] })
        .expect(201);
      const body = res.body as OrderBody;
      expect(body.deliveryMethod).toBe('PICKUP');
      expect(body.deliveryAddress).toBeNull();
    });

    it('deliveryMethod=DELIVERY ч deliveryAddress/Latitude/Longitude дутуу бол 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          branchId: branch.id,
          deliveryMethod: 'DELIVERY',
          items: [{ variantId, quantity: 1 }],
        })
        .expect(400);
      expect((res.body as ErrorBody).error.code).toBe('VALIDATION_ERROR');
    });

    it('deliveryMethod=PICKUP атал deliveryAddress илгээвэл 400', async () => {
      await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          branchId: branch.id,
          deliveryMethod: 'PICKUP',
          deliveryAddress: 'Энэ талбар PICKUP-д байх ёсгүй',
          items: [{ variantId, quantity: 1 }],
        })
        .expect(400);
    });

    it('deliveryMethod=DELIVERY + хүчинтэй хаяг/координат бол 201, талбарууд хадгалагдана', async () => {
      const res = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          branchId: branch.id,
          deliveryMethod: 'DELIVERY',
          deliveryAddress: 'СБД, 1-р хороо, XX байр',
          deliveryLatitude: 47.925,
          deliveryLongitude: 106.93,
          items: [{ variantId, quantity: 1 }],
        })
        .expect(201);
      const body = res.body as OrderBody;
      expect(body.deliveryMethod).toBe('DELIVERY');
      expect(body.deliveryAddress).toBe('СБД, 1-р хороо, XX байр');
      expect(body.deliveryLatitude).toBeCloseTo(47.925, 6);
      expect(body.deliveryLongitude).toBeCloseTo(106.93, 6);
    });
  });

  describe('GET /orders/:id/route', () => {
    let pickupOrderId: string;
    let deliveryOrderId: string;
    let deliveryOrderNoGeoBranchId: string;

    beforeAll(async () => {
      const pickupRes = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          branchId: branch.id,
          deliveryMethod: 'PICKUP',
          items: [{ variantId, quantity: 1 }],
        })
        .expect(201);
      pickupOrderId = (pickupRes.body as OrderBody).id;

      const deliveryRes = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          branchId: branch.id,
          deliveryMethod: 'DELIVERY',
          deliveryAddress: 'СБД, 2-р хороо',
          deliveryLatitude: 47.925,
          deliveryLongitude: 106.93,
          items: [{ variantId, quantity: 1 }],
        })
        .expect(201);
      deliveryOrderId = (deliveryRes.body as OrderBody).id;

      const noGeoRes = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          branchId: branchWithoutGeo.id,
          deliveryMethod: 'DELIVERY',
          deliveryAddress: 'СБД, 3-р хороо',
          deliveryLatitude: 47.925,
          deliveryLongitude: 106.93,
          items: [{ variantId, quantity: 1 }],
        })
        .expect(201);
      deliveryOrderNoGeoBranchId = (noGeoRes.body as OrderBody).id;
    });

    it('CUSTOMER дуудвал 403 (staff-only)', async () => {
      await request(app.getHttpServer())
        .get(`/orders/${deliveryOrderId}/route`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);
    });

    it('staff PICKUP захиалгад дуудвал 400 NOT_DELIVERY_ORDER', async () => {
      const res = await request(app.getHttpServer())
        .get(`/orders/${pickupOrderId}/route`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(400);
      expect((res.body as ErrorBody).error.code).toBe('NOT_DELIVERY_ORDER');
    });

    it('салбарын байршил (latitude/longitude) бүртгэгдээгүй бол 400 BRANCH_LOCATION_MISSING', async () => {
      const res = await request(app.getHttpServer())
        .get(`/orders/${deliveryOrderNoGeoBranchId}/route`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(400);
      expect((res.body as ErrorBody).error.code).toBe(
        'BRANCH_LOCATION_MISSING',
      );
    });

    it('staff DELIVERY захиалгад дуудвал 200, MockRoutingProvider-ийн Haversine тооцоотой нийцсэн хариу', async () => {
      const res = await request(app.getHttpServer())
        .get(`/orders/${deliveryOrderId}/route`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);
      const body = res.body as RouteBody;
      expect(body.distanceMeters).toBeGreaterThan(0);
      expect(body.durationSeconds).toBeGreaterThan(0);
      // routing-provider.interface.ts-ийн тайлбарын дагуу [lng, lat] дараалалтай.
      expect(body.geometry).toEqual([
        [branch.longitude, branch.latitude],
        [106.93, 47.925],
      ]);
    });
  });
});
