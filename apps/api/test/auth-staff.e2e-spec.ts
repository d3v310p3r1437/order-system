import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { decodeJwt } from 'jose';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/http-exception.filter';

interface StaffTokenBody {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
  tokenType: string;
}

interface ErrorBody {
  error: { code: string; message: string; details: unknown };
}

// RlsMiddleware-ийн request-scoped transaction (ADR 001) COMMIT хийгдэх нь
// HTTP хариу клиент рүү очихоос бага зэрэг ХОЙШ (`res.once('finish', ...)`
// дараа Prisma COMMIT илгээдэг) явагддаг тул supertest-ийн `.expect(200)`
// амжилттай буцсан ч audit_logs мөр ХАРАХ баталгаагүй агшин байж болно —
// test/returns.e2e-spec.ts-ийн ижил зорилготой waitFor()-той адил.
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

async function getKeycloakAdminToken(keycloakUrl: string): Promise<string> {
  const res = await fetch(
    `${keycloakUrl}/realms/master/protocol/openid-connect/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: 'admin-cli',
        grant_type: 'password',
        username: process.env.KEYCLOAK_ADMIN ?? 'admin',
        password: process.env.KEYCLOAK_ADMIN_PASSWORD ?? '',
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`Keycloak admin нэвтрэлт амжилтгүй: ${res.status}`);
  }
  const body = (await res.json()) as { access_token: string };
  return body.access_token;
}

// §6.2 архитектурын бодит урсгалыг бодит Keycloak/Postgres/Redis-тэй (dev
// docker compose) шалгана. infra/keycloak/setup-realm.sh-ийн тайлбарласан
// "шинэ ажилтныг хэрхэн бүртгэх" 3 алхмыг (DB users мөр → Keycloak
// хэрэглэгч + local_user_id attribute → энд UBR шаардлагагүй) Keycloak
// Admin REST API-аар нөхөн турших орчинд автоматжуулна.
describe('Auth Staff (e2e)', () => {
  let app: INestApplication<App>;
  let superuserPrisma: PrismaClient;
  const keycloakUrl = process.env.KEYCLOAK_URL ?? 'http://localhost:8080';
  const keycloakRealm = process.env.KEYCLOAK_REALM ?? 'order-system';
  const email = `staff-e2e-${Date.now()}@example.com`;
  const password = 'Test1234!';
  const localUserId = randomUUID();
  let adminToken: string;
  let keycloakUserId: string | undefined;
  let accessToken: string;

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

    await superuserPrisma.user.create({
      data: { id: localUserId, email, authProvider: 'KEYCLOAK' },
    });

    adminToken = await getKeycloakAdminToken(keycloakUrl);
    const createRes = await fetch(
      `${keycloakUrl}/admin/realms/${keycloakRealm}/users`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          username: email,
          email,
          enabled: true,
          emailVerified: true,
          firstName: 'E2E',
          lastName: 'Staff',
          attributes: { local_user_id: [localUserId] },
          credentials: [
            { type: 'password', value: password, temporary: false },
          ],
        }),
      },
    );
    if (createRes.status !== 201) {
      throw new Error(
        `Keycloak хэрэглэгч үүсгэх амжилтгүй: ${createRes.status} ${await createRes.text()}`,
      );
    }
    keycloakUserId = createRes.headers.get('location')?.split('/').pop();
  });

  afterAll(async () => {
    if (keycloakUserId) {
      await fetch(
        `${keycloakUrl}/admin/realms/${keycloakRealm}/users/${keycloakUserId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${adminToken}` },
        },
      );
    }
    await superuserPrisma.user
      .delete({ where: { id: localUserId } })
      .catch(() => undefined);
    await app.close();
    await superuserPrisma.$disconnect();
  });

  it('POST /auth/staff/login (зөв и-мэйл/нууц үг) → 200, camelCase token хос, local_user_id claim таарна', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/staff/login')
      .send({ email, password })
      .expect(200);

    const body = res.body as StaffTokenBody;
    expect(typeof body.accessToken).toBe('string');
    expect(typeof body.refreshToken).toBe('string');
    expect(typeof body.expiresIn).toBe('number');
    expect(typeof body.refreshExpiresIn).toBe('number');
    accessToken = body.accessToken;

    const { local_user_id: claimLocalUserId } = decodeJwt(accessToken);
    expect(claimLocalUserId).toBe(localUserId);
  });

  // §4.4, §7 модуль #15: login нь audit_logs-д (AuditInterceptor-ээр)
  // "staff.login" мөр бичсэн эсэхийг шалгана.
  it('login хийсний дараа audit_logs-д "staff.login" мөр орсон байна', async () => {
    const row = await waitFor(() =>
      superuserPrisma.auditLog.findFirst({
        where: {
          tableName: 'users',
          recordId: localUserId,
          action: 'staff.login',
        },
      }),
    );
    expect((row.afterData as { accessToken?: string })?.accessToken).toBe(
      accessToken,
    );
  });

  it('GET /auth/me (Keycloak JWT-тэйгээр) → local user id зөв танигдана', async () => {
    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect((res.body as { userId: string }).userId).toBe(localUserId);
  });

  it('буруу нууц үгээр 6 удаа дараалан → 1-5 дахь нь 401, 6 дахь нь 429 throttle', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await request(app.getHttpServer())
        .post('/auth/staff/login')
        .send({ email, password: 'WrongPassword1' })
        .expect(401);
      expect((res.body as ErrorBody).error.code).toBe('INVALID_CREDENTIALS');
    }

    const blocked = await request(app.getHttpServer())
      .post('/auth/staff/login')
      .send({ email, password: 'WrongPassword1' })
      .expect(429);
    expect((blocked.body as ErrorBody).error.code).toBe('TOO_MANY_ATTEMPTS');
  });
});
