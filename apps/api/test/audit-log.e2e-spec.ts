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

interface AuditLogBody {
  id: string;
  tableName: string;
  action: string;
  recordId: string;
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

// §Даалгавар #9: аудит логийн (зөвхөн унших) UI-ийн backend endpoint —
// audit-log.controller.ts-ийн коммент дэх "branchId ХЭЗЭЭ Ч бөглөгддөггүй
// тул зөвхөн глобал-эрхийн дүрд" хязгаарлалтыг эндээс баталгаажуулна.
describe('Audit logs (e2e)', () => {
  let app: INestApplication<App>;
  let superuserPrisma: PrismaClient;
  let superAdminToken: string;
  let branchAdminToken: string;
  let markerRecordId: string;

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

    async function createStaff(role: string, branchId: string | null) {
      const id = randomUUID();
      await superuserPrisma.user.create({
        data: {
          id,
          email: `audit-log-e2e-${role.toLowerCase()}-${id}@example.com`,
          authProvider: 'KEYCLOAK',
        },
      });
      await superuserPrisma.userBranchRole.create({
        data: { userId: id, branchId, role: role as never },
      });
      return { id, token: await mintAccessToken(id) };
    }

    const branch = await superuserPrisma.branch.create({
      data: { name: `Audit Log E2E Салбар ${Date.now()}` },
    });
    superAdminToken = (await createStaff('SUPER_ADMIN', null)).token;
    branchAdminToken = (await createStaff('BRANCH_ADMIN', branch.id)).token;

    // Бодит @Audit()-тэй mutation дуудаж (POST /categories, SUPER_ADMIN),
    // тодорхой олж болохуйц "маркер" мөр бий болгоно.
    const uniqueSlug = `audit-log-e2e-${Date.now()}`;
    const createRes = await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ name: 'Audit Log E2E Ангилал', slug: uniqueSlug })
      .expect(201);
    markerRecordId = (createRes.body as { id: string }).id;
  });

  afterAll(async () => {
    await app.close();
    await superuserPrisma.$disconnect();
  });

  it('SUPER_ADMIN (глобал эрх) GET /audit-logs дуудаж, шинээр бичигдсэн мөрөө recordId-аар олно', async () => {
    const res = await request(app.getHttpServer())
      .get('/audit-logs')
      .query({ recordId: markerRecordId })
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);

    const body = res.body as AuditLogBody[];
    expect(body.some((r) => r.recordId === markerRecordId && r.tableName === 'categories')).toBe(
      true,
    );
  });

  it('tableName/action-аар шүүж болно', async () => {
    const res = await request(app.getHttpServer())
      .get('/audit-logs')
      .query({ tableName: 'categories', action: 'categories.created', limit: 5 })
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);

    const body = res.body as AuditLogBody[];
    expect(body.length).toBeGreaterThan(0);
    for (const row of body) {
      expect(row.tableName).toBe('categories');
      expect(row.action).toBe('categories.created');
    }
  });

  it('⚠️ BRANCH_ADMIN (branch-scoped) 403 авна — branchId ХЭЗЭЭ Ч populate хийгддэггүй тул RLS-ээр бодитоор хэзээ ч мөр харагдахгүй, @Roles()-оор тодорхой хаасан', async () => {
    await request(app.getHttpServer())
      .get('/audit-logs')
      .set('Authorization', `Bearer ${branchAdminToken}`)
      .expect(403);
  });

  it('нэвтрээгүй хэрэглэгч 401 авна', async () => {
    await request(app.getHttpServer()).get('/audit-logs').expect(401);
  });
});
