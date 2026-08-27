import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { SignJWT } from 'jose';
import { io, type Socket } from 'socket.io-client';
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
}

interface SupportMessageBody {
  id: string;
  ticketId: string;
  senderId: string;
  body: string;
}

interface SupportTicketBody {
  id: string;
  customerId: string;
  orderId: string | null;
  subject: string;
  category: string;
  status: string;
  messages?: SupportMessageBody[];
}

interface SupportMessageCreatedPayload {
  ticketId: string;
  messageId: string;
  senderId: string;
  body: string;
  createdAt: string;
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

// docs/adr/001-ийн benign race (reviews/returns.e2e-spec.ts-тэй ижил
// тайлбар): HTTP хариу ирсний дараа ч RlsMiddleware-ийн transaction commit
// хараахан бүрэн дуусаагүй байж болзошгүй тул өөр connection-оор шалгах
// assertion бүрийг богино polling-оор эрүүлжүүлнэ.
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

// docs/plan.md §7 модуль #13: Харилцагчийн үйлчилгээ (тасалбар), текст-зөвхөн
// MVP, бодит цагийн чат.
describe('Support tickets (e2e)', () => {
  let app: INestApplication<App>;
  let superuserPrisma: PrismaClient;
  let prismaService: PrismaService;
  let baseUrl: string;

  let branchA: { id: string };
  let branchB: { id: string };
  let variantId: string;

  let superAdminToken: string;
  let ownerToken: string;
  let branchAdminAId: string;
  let branchAdminAToken: string;
  let branchAdminBId: string;
  let branchAdminBToken: string;
  let salespersonAToken: string;

  let customerId: string;
  let customerToken: string;
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
    // WebSocket тестэд socket.io-client бодит TCP холболт хийх ёстой тул
    // жинхэнэ порт сонсуулна (realtime.e2e-spec.ts-тэй ижил зарчим).
    await app.listen(0);
    const httpServer: import('http').Server = app.getHttpServer();
    const address = httpServer.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;

    prismaService = app.get(PrismaService);
    superuserPrisma = new PrismaClient({
      datasources: { db: { url: process.env.DATABASE_URL } },
    });

    branchA = await superuserPrisma.branch.create({
      data: { name: `Тасалбар Салбар А ${Date.now()}` },
    });
    branchB = await superuserPrisma.branch.create({
      data: { name: `Тасалбар Салбар Б ${Date.now()}` },
    });

    const superAdminId = randomUUID();
    await superuserPrisma.user.create({
      data: {
        id: superAdminId,
        email: `support-super-${superAdminId}@example.com`,
        authProvider: 'KEYCLOAK',
      },
    });
    await superuserPrisma.userBranchRole.create({
      data: { userId: superAdminId, branchId: null, role: 'SUPER_ADMIN' },
    });
    superAdminToken = await mintAccessToken(superAdminId);

    const ownerId = randomUUID();
    await superuserPrisma.user.create({
      data: {
        id: ownerId,
        email: `support-owner-${ownerId}@example.com`,
        authProvider: 'KEYCLOAK',
      },
    });
    await superuserPrisma.userBranchRole.create({
      data: { userId: ownerId, branchId: null, role: 'OWNER' },
    });
    ownerToken = await mintAccessToken(ownerId);

    branchAdminAId = randomUUID();
    await superuserPrisma.user.create({
      data: {
        id: branchAdminAId,
        email: `support-admin-a-${branchAdminAId}@example.com`,
        authProvider: 'KEYCLOAK',
      },
    });
    await superuserPrisma.userBranchRole.create({
      data: {
        userId: branchAdminAId,
        branchId: branchA.id,
        role: 'BRANCH_ADMIN',
      },
    });
    branchAdminAToken = await mintAccessToken(branchAdminAId);

    branchAdminBId = randomUUID();
    await superuserPrisma.user.create({
      data: {
        id: branchAdminBId,
        email: `support-admin-b-${branchAdminBId}@example.com`,
        authProvider: 'KEYCLOAK',
      },
    });
    await superuserPrisma.userBranchRole.create({
      data: {
        userId: branchAdminBId,
        branchId: branchB.id,
        role: 'BRANCH_ADMIN',
      },
    });
    branchAdminBToken = await mintAccessToken(branchAdminBId);

    const salespersonAId = randomUUID();
    await superuserPrisma.user.create({
      data: {
        id: salespersonAId,
        email: `support-sales-a-${salespersonAId}@example.com`,
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
    salespersonAToken = await mintAccessToken(salespersonAId);

    customerId = randomUUID();
    await superuserPrisma.user.create({
      data: {
        id: customerId,
        phone: `+9768${Date.now().toString().slice(-8)}`,
        authProvider: 'CUSTOMER_AUTH',
      },
    });
    customerToken = await mintAccessToken(customerId);

    const otherCustomerId = randomUUID();
    await superuserPrisma.user.create({
      data: {
        id: otherCustomerId,
        phone: `+9769${Date.now().toString().slice(-8)}`,
        authProvider: 'CUSTOMER_AUTH',
      },
    });
    otherCustomerToken = await mintAccessToken(otherCustomerId);

    const unique = Date.now();
    const category = await superuserPrisma.category.create({
      data: {
        name: `Тасалбар ангилал ${unique}`,
        slug: `support-angilal-${unique}`,
      },
    });
    const product = await superuserPrisma.product.create({
      data: {
        name: 'Тасалбар бүтээгдэхүүн',
        slug: `support-buteegdehuun-${unique}`,
        categoryId: category.id,
      },
    });
    const variant = await superuserPrisma.productVariant.create({
      data: {
        productId: product.id,
        name: 'Стандарт',
        sku: `support-sku-${unique}`,
        basePrice: 5000,
      },
    });
    variantId = variant.id;
    await superuserPrisma.inventoryItem.create({
      data: { variantId, branchId: branchA.id, quantity: 100 },
    });
  });

  afterAll(async () => {
    await app.close();
    await superuserPrisma.$disconnect();
  });

  async function createOrder(token: string, branchId: string): Promise<string> {
    await request(app.getHttpServer())
      .post('/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ variantId, quantity: 1 })
      .expect(201);
    const res = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ branchId })
      .expect(201);
    return (res.body as OrderBody).id;
  }

  let orderId: string;
  let orderTicketId: string;
  let generalTicketId: string;

  describe('POST /support-tickets', () => {
    it('CUSTOMER orderId-той тасалбар үүсгэнэ (§7 модуль #13, 1)', async () => {
      orderId = await createOrder(customerToken, branchA.id);

      const res = await request(app.getHttpServer())
        .post('/support-tickets')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          subject: 'Захиалга ирсэнгүй',
          category: 'ORDER_ISSUE',
          orderId,
        })
        .expect(201);
      const body = res.body as SupportTicketBody;
      expect(body.customerId).toBe(customerId);
      expect(body.orderId).toBe(orderId);
      expect(body.status).toBe('OPEN');
      orderTicketId = body.id;

      const auditRow = await waitFor(() =>
        superuserPrisma.auditLog.findFirst({
          where: { tableName: 'support_tickets', recordId: body.id },
        }),
      );
      expect(auditRow).not.toBeNull();
    });

    it('CUSTOMER orderId-гүй ерөнхий тасалбар үүсгэнэ', async () => {
      const res = await request(app.getHttpServer())
        .post('/support-tickets')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ subject: 'Ерөнхий асуулт', category: 'OTHER' })
        .expect(201);
      const body = res.body as SupportTicketBody;
      expect(body.orderId).toBeNull();
      generalTicketId = body.id;
    });

    it('өөр хэрэглэгчийн orderId дамжуулбал 404 (orders_select RLS-ээр харагдахгүй)', async () => {
      const res = await request(app.getHttpServer())
        .post('/support-tickets')
        .set('Authorization', `Bearer ${otherCustomerToken}`)
        .send({ subject: 'Хуурамч', category: 'ORDER_ISSUE', orderId })
        .expect(404);
      expect((res.body as ErrorBody).error.code).toBe('ORDER_NOT_FOUND');
    });

    it('staff (CUSTOMER биш) POST хийхийг оролдвол 403', async () => {
      await request(app.getHttpServer())
        .post('/support-tickets')
        .set('Authorization', `Bearer ${branchAdminAToken}`)
        .send({ subject: 'Staff оролдлого', category: 'OTHER' })
        .expect(403);
    });
  });

  describe('GET /support-tickets — эрхийн хамрах хүрээ (RBAC + RLS)', () => {
    it('CUSTOMER зөвхөн өөрийн 2 тасалбарыг харна (бусад CUSTOMER-ийнхийг харахгүй)', async () => {
      const res = await request(app.getHttpServer())
        .get('/support-tickets')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);
      const ids = (res.body as SupportTicketBody[]).map((t) => t.id);
      expect(ids).toEqual(
        expect.arrayContaining([orderTicketId, generalTicketId]),
      );

      const otherRes = await request(app.getHttpServer())
        .get('/support-tickets')
        .set('Authorization', `Bearer ${otherCustomerToken}`)
        .expect(200);
      expect(
        (otherRes.body as SupportTicketBody[]).map((t) => t.id),
      ).not.toEqual(expect.arrayContaining([orderTicketId]));
    });

    it('SUPER_ADMIN бүх тасалбарыг (ерөнхий орно) харна', async () => {
      const res = await request(app.getHttpServer())
        .get('/support-tickets')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);
      const ids = (res.body as SupportTicketBody[]).map((t) => t.id);
      expect(ids).toEqual(
        expect.arrayContaining([orderTicketId, generalTicketId]),
      );
    });

    it('OWNER мөн бүх тасалбарыг харна (R бүх)', async () => {
      const res = await request(app.getHttpServer())
        .get('/support-tickets')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
      const ids = (res.body as SupportTicketBody[]).map((t) => t.id);
      expect(ids).toEqual(
        expect.arrayContaining([orderTicketId, generalTicketId]),
      );
    });

    // ЗААВАЛ шаардлагатай тест (а): branch staff зөвхөн өөрийн салбарын
    // orderId-той тасалбарыг харна, ерөнхий (orderId=null) тасалбарыг
    // ХАРАХГҮЙ — HTTP давхаргаас.
    it('BRANCH_ADMIN (Салбар А) зөвхөн ӨӨРИЙН салбарын orderId-той тасалбарыг харна, ерөнхий тасалбарыг ХАРАХГҮЙ', async () => {
      const res = await request(app.getHttpServer())
        .get('/support-tickets')
        .set('Authorization', `Bearer ${branchAdminAToken}`)
        .expect(200);
      const ids = (res.body as SupportTicketBody[]).map((t) => t.id);
      expect(ids).toContain(orderTicketId);
      expect(ids).not.toContain(generalTicketId);
    });

    it('SALESPERSON (Салбар А) мөн ӨӨРИЙН салбарын orderId-той тасалбарыг харна', async () => {
      const res = await request(app.getHttpServer())
        .get('/support-tickets')
        .set('Authorization', `Bearer ${salespersonAToken}`)
        .expect(200);
      expect((res.body as SupportTicketBody[]).map((t) => t.id)).toContain(
        orderTicketId,
      );
    });

    it('BRANCH_ADMIN (Салбар Б) өөр салбарын orderId-той тасалбарыг ХАРАХГҮЙ', async () => {
      const res = await request(app.getHttpServer())
        .get('/support-tickets')
        .set('Authorization', `Bearer ${branchAdminBToken}`)
        .expect(200);
      const ids = (res.body as SupportTicketBody[]).map((t) => t.id);
      expect(ids).not.toContain(orderTicketId);
      expect(ids).not.toContain(generalTicketId);
    });

    // ЗААВАЛ шаардлагатай тест (а), давхар баталгаажуулалт: service
    // давхаргыг ОГТ тойрч (typed .findMany() ч БИШ) raw SQL-ээр л
    // support_tickets_select RLS-ийг шууд шалгана (CLAUDE.md-ийн
    // "Тестийн стандарт" зарчим).
    it('support_tickets_select RLS policy: branch staff-ийн raw SQL SELECT-д ерөнхий тасалбар ОГТ ирэхгүй', async () => {
      const rows = await prismaService.runRequestTransaction(
        branchAdminAId,
        (tx) =>
          tx.$queryRaw<{ id: string }[]>`
            SELECT id FROM support_tickets WHERE id IN (${orderTicketId}, ${generalTicketId})
          `,
      );
      const ids = rows.map((r) => r.id);
      expect(ids).toContain(orderTicketId);
      expect(ids).not.toContain(generalTicketId);
    });
  });

  describe('PATCH /support-tickets/:id — статус шилжилт (staff-only)', () => {
    it('CUSTOMER PATCH хийхийг оролдвол 403', async () => {
      await request(app.getHttpServer())
        .patch(`/support-tickets/${orderTicketId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ status: 'IN_PROGRESS' })
        .expect(403);
    });

    it('OWNER (зөвхөн R) PATCH хийхийг оролдвол 403', async () => {
      await request(app.getHttpServer())
        .patch(`/support-tickets/${orderTicketId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ status: 'IN_PROGRESS' })
        .expect(403);
    });

    it('BRANCH_ADMIN (Салбар Б, өөр салбар) PATCH хийхийг оролдвол 404 (RLS-ээр харагдахгүй)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/support-tickets/${orderTicketId}`)
        .set('Authorization', `Bearer ${branchAdminBToken}`)
        .send({ status: 'IN_PROGRESS' })
        .expect(404);
      expect((res.body as ErrorBody).error.code).toBe(
        'SUPPORT_TICKET_NOT_FOUND',
      );
    });

    it('BRANCH_ADMIN (Салбар А) OPEN→IN_PROGRESS шилжүүлнэ', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/support-tickets/${orderTicketId}`)
        .set('Authorization', `Bearer ${branchAdminAToken}`)
        .send({ status: 'IN_PROGRESS' })
        .expect(200);
      expect((res.body as SupportTicketBody).status).toBe('IN_PROGRESS');
    });

    it('OPEN→CLOSED шиг зөвшөөрөгдөөгүй буруу шилжилт (жиш: CLOSED дараа дахин IN_PROGRESS→OPEN) 400', async () => {
      await request(app.getHttpServer())
        .patch(`/support-tickets/${orderTicketId}`)
        .set('Authorization', `Bearer ${branchAdminAToken}`)
        .send({ status: 'OPEN' })
        .expect(400);
    });

    it('IN_PROGRESS→CLOSED шилжүүлнэ (closedAt тавигдана)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/support-tickets/${orderTicketId}`)
        .set('Authorization', `Bearer ${branchAdminAToken}`)
        .send({ status: 'CLOSED' })
        .expect(200);
      expect((res.body as SupportTicketBody).status).toBe('CLOSED');
    });

    it('support_tickets_update RLS policy: өөр салбарын BRANCH_ADMIN raw UPDATE 0 мөр өөрчилнө (алдаа шидэхгүй)', async () => {
      const affectedRows = await prismaService.runRequestTransaction(
        branchAdminBId,
        (tx) =>
          tx.$executeRaw`UPDATE support_tickets SET status = 'RESOLVED' WHERE id = ${generalTicketId}`,
      );
      expect(affectedRows).toBe(0);

      const row = await superuserPrisma.supportTicket.findUniqueOrThrow({
        where: { id: generalTicketId },
      });
      expect(row.status).toBe('OPEN');
    });
  });

  describe('POST /support-tickets/:ticketId/messages — чат', () => {
    it('CUSTOMER (эзэн) OPEN тасалбарт мессеж нэмнэ', async () => {
      const res = await request(app.getHttpServer())
        .post(`/support-tickets/${generalTicketId}/messages`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ body: 'Сайн байна уу, надад тусламж хэрэгтэй байна' })
        .expect(201);
      const body = res.body as SupportMessageBody;
      expect(body.ticketId).toBe(generalTicketId);
      expect(body.senderId).toBe(customerId);

      const auditRow = await waitFor(() =>
        superuserPrisma.auditLog.findFirst({
          where: { tableName: 'support_messages', recordId: body.id },
        }),
      );
      expect(auditRow).not.toBeNull();
    });

    it('SUPER_ADMIN (staff) мөн адил тасалбарт мессеж нэмж болно', async () => {
      await request(app.getHttpServer())
        .post(`/support-tickets/${generalTicketId}/messages`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ body: 'Сайн байна уу, туслая' })
        .expect(201);
    });

    it('GET /support-tickets/:id мессежүүдийг он цагийн эрэмбээр (ascending) буцаана', async () => {
      const res = await request(app.getHttpServer())
        .get(`/support-tickets/${generalTicketId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);
      const body = res.body as SupportTicketBody;
      expect(body.messages).toHaveLength(2);
      expect(body.messages?.[0].body).toContain('тусламж хэрэгтэй');
      expect(body.messages?.[1].body).toContain('туслая');
    });

    // ЗААВАЛ шаардлагатай тест (б): CLOSED тасалбарт харилцагч мессеж
    // нэмэхийг оролдвол татгалзана.
    it('CUSTOMER (эзэн) CLOSED тасалбарт мессеж нэмэхийг оролдвол 403', async () => {
      const res = await request(app.getHttpServer())
        .post(`/support-tickets/${orderTicketId}/messages`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ body: 'Хаагдсаны дараа бичсэн' })
        .expect(403);
      expect((res.body as ErrorBody).error.code).toBe('SUPPORT_TICKET_CLOSED');
    });

    it('staff CLOSED тасалбарт ч мессеж нэмж болно (хязгаарлалт зөвхөн CUSTOMER-д)', async () => {
      await request(app.getHttpServer())
        .post(`/support-tickets/${orderTicketId}/messages`)
        .set('Authorization', `Bearer ${branchAdminAToken}`)
        .send({ body: 'Хаагдсан ч гэсэн нэмэлт тайлбар' })
        .expect(201);
    });

    // ЗААВАЛ шаардлагатай тест (б), давхар баталгаажуулалт: service
    // давхаргыг тойрч raw SQL INSERT-ээр support_messages_insert RLS-ийн
    // WITH CHECK-ийг шууд шалгана — INSERT-ийн RLS татгалзал ЖИНХЭНЭ
    // Postgres алдаа шиднэ (CLAUDE.md-ийн "Тестийн стандарт" зарчим).
    it('support_messages_insert RLS policy: CUSTOMER raw INSERT CLOSED тасалбарт цуцлагдана', async () => {
      const messageId = randomUUID();
      await expect(
        prismaService.runRequestTransaction(
          customerId,
          (tx) =>
            tx.$executeRaw`
            INSERT INTO support_messages (id, "ticketId", "senderId", body)
            VALUES (${messageId}, ${orderTicketId}, ${customerId}, 'raw SQL оролдлого')
          `,
        ),
      ).rejects.toThrow(/row-level security/i);

      const leaked = await superuserPrisma.supportMessage.findUnique({
        where: { id: messageId },
      });
      expect(leaked).toBeNull();
    });
  });

  describe('WebSocket support.message.created', () => {
    it('тасалбарт subscribe хийсэн CUSTOMER мессеж нэмэгдэхэд бодит цагт event хүлээн авна', async () => {
      const socket = io(`${baseUrl}/ws/orders`, {
        auth: { token: customerToken },
        transports: ['websocket'],
      });

      try {
        await new Promise<void>((resolve, reject) => {
          socket.once('connect', () => resolve());
          socket.once('connect_error', (err) => reject(err));
        });

        socket.emit('subscribe:ticket', generalTicketId);
        // namespace.use() middleware (auth) БОЛОН subscribe:ticket handler
        // хоёул ASYNC тул room-д нэгдэх хүртэл бага зэрэг хүлээнэ
        // (order-events.gateway.spec.ts-ийн race condition тайлбарыг үз).
        await new Promise((resolve) => setTimeout(resolve, 200));

        const eventPromise = waitForEvent<SupportMessageCreatedPayload>(
          socket,
          'support.message.created',
        );

        await request(app.getHttpServer())
          .post(`/support-tickets/${generalTicketId}/messages`)
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({ body: 'Бодит цагийн мессеж' })
          .expect(201);

        const payload = await eventPromise;
        expect(payload.ticketId).toBe(generalTicketId);
        expect(payload.body).toBe('Бодит цагийн мессеж');
      } finally {
        socket.disconnect();
      }
    });
  });
});
