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
  status: string;
  providerInvoiceId: string | null;
  paidAt: string | null;
  payUrl?: string;
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

// docs/plan.md §8 Phase 3b, Хэсэг B #12: PAYMENT_PROVIDER env-г тохируулаагүй
// (анхдагч 'mock') үед checkout→createInvoice→simulate-paid→webhook→
// Order.paidAt тавигдах→(§Хэсэг A) бүрэн урсгалыг бодит Postgres/Redis-тэй
// e2e-ээр баталгаажуулна. docs/adr/006-ыг үз.
describe('Payment (e2e, mock provider)', () => {
  let app: INestApplication<App>;
  let superuserPrisma: PrismaClient;

  let branch: { id: string };
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

    branch = await superuserPrisma.branch.create({
      data: { name: `Төлбөрийн тест салбар ${Date.now()}` },
    });

    const customerId = randomUUID();
    await superuserPrisma.user.create({
      data: {
        id: customerId,
        phone: `+9767${Date.now().toString().slice(-8)}`,
        authProvider: 'CUSTOMER_AUTH',
      },
    });
    customerToken = await mintAccessToken(customerId);

    const unique = Date.now();
    const category = await superuserPrisma.category.create({
      data: {
        name: `Төлбөрийн ангилал ${unique}`,
        slug: `tulbur-angilal-${unique}`,
      },
    });
    const product = await superuserPrisma.product.create({
      data: {
        name: 'Төлбөрийн бүтээгдэхүүн',
        slug: `tulbur-buteegdehuun-${unique}`,
        categoryId: category.id,
      },
    });
    const variant = await superuserPrisma.productVariant.create({
      data: {
        productId: product.id,
        name: 'Стандарт',
        sku: `tulbur-sku-${unique}`,
        basePrice: 10000,
      },
    });
    variantId = variant.id;

    await superuserPrisma.inventoryItem.create({
      data: { variantId, branchId: branch.id, quantity: 10 },
    });
  });

  afterAll(async () => {
    await app.close();
    await superuserPrisma.$disconnect();
  });

  it('checkout → providerInvoiceId+payUrl буцаана, simulate-paid → webhook → Order.paidAt тавигдана', async () => {
    const checkoutRes = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ branchId: branch.id, items: [{ variantId, quantity: 1 }] })
      .expect(201);
    const order = checkoutRes.body as OrderBody;

    expect(order.providerInvoiceId).toMatch(/^mock_/);
    expect(order.payUrl).toContain(order.providerInvoiceId);
    expect(order.paidAt).toBeNull();

    // Webhook-г эхлээд симуляц ХИЙХЭЭС ӨМНӨ дуудахад checkPayment() PENDING
    // буцаах тул Order.paidAt ХЭВЭЭР null байх ёстой (webhook payload-д
    // шууд итгэдэггүй гэдгийг батлана, docs/adr/006).
    const premature = await request(app.getHttpServer())
      .post(`/payment/webhook/${order.id}`)
      .send({ payment_id: order.providerInvoiceId })
      .expect(201);
    expect((premature.body as { status: string; paid: boolean }).status).toBe(
      'PENDING',
    );
    expect((premature.body as { paid: boolean }).paid).toBe(false);

    await request(app.getHttpServer())
      .post(`/payment/mock/simulate-paid/${order.providerInvoiceId}`)
      .expect(201);

    const confirmed = await request(app.getHttpServer())
      .post(`/payment/webhook/${order.id}`)
      .send({ payment_id: order.providerInvoiceId })
      .expect(201);
    expect((confirmed.body as { status: string; paid: boolean }).status).toBe(
      'PAID',
    );
    expect((confirmed.body as { paid: boolean }).paid).toBe(true);

    const dbOrder = await waitFor(async () => {
      const row = await superuserPrisma.order.findUnique({
        where: { id: order.id },
      });
      return row?.paidAt ? row : null;
    });
    expect(dbOrder.paidAt).not.toBeNull();

    // Дахин ижил webhook ирвэл (QPay-ийн бодит давталт) idempotent —
    // marked=false (аль хэдийн тэмдэглэгдсэн), алдаа шидэхгүй.
    const replay = await request(app.getHttpServer())
      .post(`/payment/webhook/${order.id}`)
      .send({ payment_id: order.providerInvoiceId })
      .expect(201);
    expect((replay.body as { paid: boolean }).paid).toBe(false);
  });

  it('өөр захиалгын providerInvoiceId-г буруу orderId-тай хамт илгээвэл (binding таарахгүй) paidAt тавигдахгүй', async () => {
    const checkoutA = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ branchId: branch.id, items: [{ variantId, quantity: 1 }] })
      .expect(201);
    const orderA = checkoutA.body as OrderBody;

    const checkoutB = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ branchId: branch.id, items: [{ variantId, quantity: 1 }] })
      .expect(201);
    const orderB = checkoutB.body as OrderBody;

    await request(app.getHttpServer())
      .post(`/payment/mock/simulate-paid/${orderB.providerInvoiceId}`)
      .expect(201);

    // orderA-ийн ID-тай хамт orderB-ийн (аль хэдийн PAID) payment_id-г
    // илгээхэд checkPayment() ӨӨРӨӨ PAID гэж баталгаажуулах ч,
    // app_mark_order_paid() дотор providerInvoiceId таарахгүй тул orderA
    // paid БОЛОХГҮЙ ёстой (docs/adr/006-ийн "cross-order" хамгаалалт).
    const res = await request(app.getHttpServer())
      .post(`/payment/webhook/${orderA.id}`)
      .send({ payment_id: orderB.providerInvoiceId })
      .expect(201);
    expect((res.body as { status: string; paid: boolean }).status).toBe('PAID');
    expect((res.body as { paid: boolean }).paid).toBe(false);

    const dbOrderA = await superuserPrisma.order.findUniqueOrThrow({
      where: { id: orderA.id },
    });
    expect(dbOrderA.paidAt).toBeNull();
  });

  it('token/header-гүй webhook хүсэлт ч ажиллана (RolesGuard-гүй, unauthenticated зорилготой)', async () => {
    const checkoutRes = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ branchId: branch.id, items: [{ variantId, quantity: 1 }] })
      .expect(201);
    const order = checkoutRes.body as OrderBody;

    // Authorization header ОГТ ЗААГҮЙ — webhook нь QPay-ийн серверээс
    // ирдэг тул манай хэрэглэгчийн session байхгүй байх нь хэвийн.
    const res = await request(app.getHttpServer())
      .post(`/payment/webhook/${order.id}`)
      .send({ payment_id: order.providerInvoiceId })
      .expect(201);
    expect((res.body as ErrorBody & { status?: string }).status).toBe(
      'PENDING',
    );
  });
});
