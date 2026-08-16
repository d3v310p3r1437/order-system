import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { SignJWT } from 'jose';
import request from 'supertest';
import type { App } from 'supertest/types';
import { io } from 'socket.io-client';
import { AppModule } from '../src/app.module';
import { CUSTOMER_JWT_ISSUER } from '../src/auth/constants.js';
import { HttpExceptionFilter } from '../src/common/http-exception.filter';

interface OrderBody {
  id: string;
  status: string;
  providerInvoiceId: string | null;
  paidAt: string | null;
  payUrl?: string;
}

interface WebhookResponseBody {
  orderId: string;
  checkStatus: string | null;
  result: string;
  paid: boolean;
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
  let baseUrl: string;

  let branch: { id: string };
  let customerId: string;
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
    // 'order.payment_confirmed' WebSocket event-ийг socket.io-client-аар
    // бодитоор хүлээж авахын тулд жинхэнэ TCP порт сонсуулна
    // (test/realtime.e2e-spec.ts-тэй ижил зарчим).
    await app.listen(0);
    const httpServer: import('http').Server = app.getHttpServer();
    const address = httpServer.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;

    superuserPrisma = new PrismaClient({
      datasources: { db: { url: process.env.DATABASE_URL } },
    });

    branch = await superuserPrisma.branch.create({
      data: { name: `Төлбөрийн тест салбар ${Date.now()}` },
    });

    customerId = randomUUID();
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
      data: { variantId, branchId: branch.id, quantity: 50 },
    });
  });

  afterAll(async () => {
    await app.close();
    await superuserPrisma.$disconnect();
  });

  async function checkout(): Promise<OrderBody> {
    const res = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ branchId: branch.id, items: [{ variantId, quantity: 1 }] })
      .expect(201);
    return res.body as OrderBody;
  }

  it('checkout providerInvoiceId+payUrl буцаана', async () => {
    const order = await checkout();
    expect(order.providerInvoiceId).toMatch(/^mock_/);
    expect(order.payUrl).toContain(order.providerInvoiceId);
    expect(order.paidAt).toBeNull();
  });

  it('webhook-г симуляц ХИЙХЭЭС ӨМНӨ дуудахад payload-д итгэхгүй — checkStatus=PENDING, paidAt хэвээр null (docs/adr/006)', async () => {
    const order = await checkout();

    const res = await request(app.getHttpServer())
      .post(`/payment/webhook/${order.id}`)
      .send({ payment_id: order.providerInvoiceId })
      .expect(200);
    const body = res.body as WebhookResponseBody;
    expect(body.checkStatus).toBe('PENDING');
    expect(body.result).toBe('NOT_PAID');
    expect(body.paid).toBe(false);

    const dbOrder = await superuserPrisma.order.findUniqueOrThrow({
      where: { id: order.id },
    });
    expect(dbOrder.paidAt).toBeNull();
  });

  it('simulate-paid → webhook → Order.paidAt тавигдаж, WebSocket order.payment_confirmed event нэг удаа явна', async () => {
    const order = await checkout();

    const socket = io(`${baseUrl}/ws/orders`, {
      auth: { token: customerToken },
      transports: ['websocket'],
    });
    const receivedEvents: unknown[] = [];
    socket.on('order.payment_confirmed', (payload: unknown) => {
      receivedEvents.push(payload);
    });

    try {
      await new Promise<void>((resolve, reject) => {
        socket.once('connect', () => resolve());
        socket.once('connect_error', (err) => reject(err));
      });
      socket.emit('subscribe:order', order.id);
      // Сервэр талын room join нь async (RLS-ээр Order-ыг дахин уншина) —
      // ack event-гүй тул богино хүлээлт (RLS query хэдхэн мс-д гүйцдэг).
      await new Promise((resolve) => setTimeout(resolve, 300));

      await request(app.getHttpServer())
        .post(`/payment/mock/simulate-paid/${order.providerInvoiceId}`)
        .expect(201);

      const confirmRes = await request(app.getHttpServer())
        .post(`/payment/webhook/${order.id}`)
        .send({ payment_id: order.providerInvoiceId })
        .expect(200);
      const body = confirmRes.body as WebhookResponseBody;
      expect(body.checkStatus).toBe('PAID');
      expect(body.result).toBe('MARKED_PAID');
      expect(body.paid).toBe(true);

      const dbOrder = await waitFor(async () => {
        const row = await superuserPrisma.order.findUnique({
          where: { id: order.id },
        });
        return row?.paidAt ? row : null;
      });
      expect(dbOrder.paidAt).not.toBeNull();

      // event socket-д хүрэхийг богино хугацаагаар хүлээнэ.
      await new Promise((resolve) => setTimeout(resolve, 300));
      expect(receivedEvents).toHaveLength(1);
      expect(receivedEvents[0]).toEqual({
        orderId: order.id,
        branchId: branch.id,
        customerId,
      });
    } finally {
      socket.disconnect();
    }
  });

  it('ижил payment_id-аар 2 удаа ЗЭРЭГ (Promise.all) webhook ирвэл (dedupe lock) Order.paidAt зөвхөн 1 удаа тавигдаж, WS event зөвхөн 1 удаа явна', async () => {
    const order = await checkout();
    await request(app.getHttpServer())
      .post(`/payment/mock/simulate-paid/${order.providerInvoiceId}`)
      .expect(201);

    const socket = io(`${baseUrl}/ws/orders`, {
      auth: { token: customerToken },
      transports: ['websocket'],
    });
    const receivedEvents: unknown[] = [];
    socket.on('order.payment_confirmed', (payload: unknown) => {
      receivedEvents.push(payload);
    });

    try {
      await new Promise<void>((resolve, reject) => {
        socket.once('connect', () => resolve());
        socket.once('connect_error', (err) => reject(err));
      });
      socket.emit('subscribe:order', order.id);
      await new Promise((resolve) => setTimeout(resolve, 300));

      const [resA, resB] = await Promise.all([
        request(app.getHttpServer())
          .post(`/payment/webhook/${order.id}`)
          .send({ payment_id: order.providerInvoiceId }),
        request(app.getHttpServer())
          .post(`/payment/webhook/${order.id}`)
          .send({ payment_id: order.providerInvoiceId }),
      ]);

      const results = [resA, resB].map(
        (r) => (r.body as WebhookResponseBody).result,
      );
      // Хоёр хариу ХОЁУЛАА 200 (илгээгч тал давхар retry хийхээс
      // сэргийлэх — Stripe/PayPal стандарт) — гэхдээ ЗӨВХӨН НЭГ нь л
      // бодитоор боловсруулагдсан (MARKED_PAID), нөгөө нь dedupe lock-д
      // "DUPLICATE_SKIPPED" болно.
      expect(resA.status).toBe(200);
      expect(resB.status).toBe(200);
      expect(results.filter((r) => r === 'MARKED_PAID')).toHaveLength(1);
      expect(results.filter((r) => r === 'DUPLICATE_SKIPPED')).toHaveLength(1);

      const dbOrder = await waitFor(async () => {
        const row = await superuserPrisma.order.findUnique({
          where: { id: order.id },
        });
        return row?.paidAt ? row : null;
      });
      expect(dbOrder.paidAt).not.toBeNull();

      await new Promise((resolve) => setTimeout(resolve, 300));
      expect(receivedEvents).toHaveLength(1);
    } finally {
      socket.disconnect();
    }
  });

  it('өөр захиалгын providerInvoiceId-г буруу orderId-тай хамт илгээвэл (binding таарахгүй) MISMATCH, paidAt тавигдахгүй', async () => {
    const orderA = await checkout();
    const orderB = await checkout();

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
      .expect(200);
    const body = res.body as WebhookResponseBody;
    expect(body.checkStatus).toBe('PAID');
    expect(body.result).toBe('MISMATCH');
    expect(body.paid).toBe(false);

    const dbOrderA = await superuserPrisma.order.findUniqueOrThrow({
      where: { id: orderA.id },
    });
    expect(dbOrderA.paidAt).toBeNull();
  });

  it('token/header-гүй webhook хүсэлт ч ажиллана (RolesGuard-гүй, unauthenticated зорилготой)', async () => {
    const order = await checkout();

    // Authorization header ОГТ ЗААГҮЙ — webhook нь QPay-ийн серверээс
    // ирдэг тул манай хэрэглэгчийн session байхгүй байх нь хэвийн.
    const res = await request(app.getHttpServer())
      .post(`/payment/webhook/${order.id}`)
      .send({ payment_id: order.providerInvoiceId })
      .expect(200);
    expect((res.body as WebhookResponseBody).checkStatus).toBe('PENDING');
  });
});
