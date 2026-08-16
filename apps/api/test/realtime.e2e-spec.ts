import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { SignJWT } from 'jose';
import request from 'supertest';
import type { App } from 'supertest/types';
import { io, type Socket } from 'socket.io-client';
import { AppModule } from '../src/app.module';
import { CUSTOMER_JWT_ISSUER } from '../src/auth/constants.js';
import { HttpExceptionFilter } from '../src/common/http-exception.filter';

interface OrderBody {
  id: string;
}

interface OrderStatusChangedPayload {
  orderId: string;
  branchId: string;
  customerId: string;
  oldStatus: string;
  newStatus: string;
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

function waitForEvent<T>(
  socket: Socket,
  event: string,
  timeoutMs = 3000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`"${event}" event ${timeoutMs}ms дотор ирсэнгүй`)),
      timeoutMs,
    );
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

// docs/plan.md §8 Phase 3b, Хэсэг A #5: WebSocket холболт, event хүлээн
// авах урсгалыг бодит Socket.io сервертэй (жинхэнэ TCP порт сонсуулж)
// e2e-ээр баталгаажуулна.
describe('Realtime order events (e2e)', () => {
  let app: INestApplication<App>;
  let superuserPrisma: PrismaClient;
  let baseUrl: string;

  let branch: { id: string };
  let customerToken: string;
  let branchManagerToken: string;
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
    // Socket.io-client бодит TCP холболт хийх ёстой тул supertest-ийн
    // in-memory http.Server биш, жинхэнэ порт сонсуулна (port 0 = OS-ээс
    // чөлөөтэй порт олгуулна).
    await app.listen(0);
    const httpServer: import('http').Server = app.getHttpServer();
    const address = httpServer.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;

    superuserPrisma = new PrismaClient({
      datasources: { db: { url: process.env.DATABASE_URL } },
    });

    branch = await superuserPrisma.branch.create({
      data: { name: `Realtime тест салбар ${Date.now()}` },
    });

    const customerId = randomUUID();
    const branchManagerId = randomUUID();
    await superuserPrisma.user.create({
      data: {
        id: customerId,
        phone: `+9766${Date.now().toString().slice(-8)}`,
        authProvider: 'CUSTOMER_AUTH',
      },
    });
    await superuserPrisma.user.create({
      data: {
        id: branchManagerId,
        email: `realtime-mgr-${branchManagerId}@example.com`,
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
    customerToken = await mintAccessToken(customerId);
    branchManagerToken = await mintAccessToken(branchManagerId);

    const unique = Date.now();
    const category = await superuserPrisma.category.create({
      data: {
        name: `Realtime ангилал ${unique}`,
        slug: `realtime-angilal-${unique}`,
      },
    });
    const product = await superuserPrisma.product.create({
      data: {
        name: 'Realtime бүтээгдэхүүн',
        slug: `realtime-buteegdehuun-${unique}`,
        categoryId: category.id,
      },
    });
    const variant = await superuserPrisma.productVariant.create({
      data: {
        productId: product.id,
        name: 'Стандарт',
        sku: `realtime-sku-${unique}`,
        basePrice: 5000,
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

  it('staff холбогдоход өөрийн салбарын room-д автоматаар нэгдэж, PATCH /orders/:id/status-ийн дараа event хүлээн авна', async () => {
    const checkoutRes = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ branchId: branch.id, items: [{ variantId, quantity: 1 }] })
      .expect(201);
    const orderId = (checkoutRes.body as OrderBody).id;

    const socket = io(`${baseUrl}/ws/orders`, {
      auth: { token: branchManagerToken },
      transports: ['websocket'],
    });

    try {
      await new Promise<void>((resolve, reject) => {
        socket.once('connect', () => resolve());
        socket.once('connect_error', (err) => reject(err));
      });

      const eventPromise = waitForEvent<OrderStatusChangedPayload>(
        socket,
        'order.status_changed',
      );

      await request(app.getHttpServer())
        .patch(`/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${branchManagerToken}`)
        .send({ status: 'CONFIRMED' })
        .expect(200);

      const payload = await eventPromise;
      expect(payload.orderId).toBe(orderId);
      expect(payload.branchId).toBe(branch.id);
      expect(typeof payload.customerId).toBe('string');
      expect(payload.oldStatus).toBe('CREATED');
      expect(payload.newStatus).toBe('CONFIRMED');
    } finally {
      socket.disconnect();
    }
  });

  it('token хүчингүй холболтыг сервер таслана', async () => {
    const socket = io(`${baseUrl}/ws/orders`, {
      auth: { token: 'invalid-token' },
      transports: ['websocket'],
    });

    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error('disconnect 2000ms дотор ирсэнгүй')),
          2000,
        );
        socket.once('disconnect', () => {
          clearTimeout(timer);
          resolve();
        });
      });
    } finally {
      socket.disconnect();
    }
  });
});
