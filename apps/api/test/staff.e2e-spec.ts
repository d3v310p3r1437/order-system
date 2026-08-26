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

interface StaffCreateBody {
  id: string;
  email: string;
  fullName: string;
  role: string;
  branchId: string | null;
  temporaryPassword: string;
}

interface KeycloakUserRepresentation {
  id: string;
  email?: string;
  attributes?: Record<string, string[]>;
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

const keycloakUrl = process.env.KEYCLOAK_URL ?? 'http://localhost:8080';
const keycloakRealm = process.env.KEYCLOAK_REALM ?? 'order-system';

async function getKeycloakAdminToken(): Promise<string> {
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
  return ((await res.json()) as { access_token: string }).access_token;
}

async function findKeycloakUserByEmail(
  adminToken: string,
  email: string,
): Promise<KeycloakUserRepresentation | null> {
  const res = await fetch(
    `${keycloakUrl}/admin/realms/${keycloakRealm}/users?email=${encodeURIComponent(email)}&exact=true`,
    { headers: { Authorization: `Bearer ${adminToken}` } },
  );
  const users = (await res.json()) as KeycloakUserRepresentation[];
  return users[0] ?? null;
}

async function waitFor<T>(
  fn: () => Promise<T | null>,
  timeoutMs = 1500,
  intervalMs = 50,
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

// docs/adr/002-ийн "Инцидент (2026-08-25)"-ийг (Keycloak-д local_user_id
// тохируулагдсан ч Postgres users мөр огт байхгүй болсон, дутуу гар
// тохиргооноос үүссэн) ДАХИН давтагдахаас сэргийлэх зорилготой POST
// /staff-ийн ГОЛ баталгаа: Keycloak+Postgres хамт (АТОМИК) үүсэх,
// аль нэг нь REJECT хийвэл ХОЁУЛАНГ НЬ (шинээр үүссэн Keycloak
// хэрэглэгчийг ч) rollback хийдэг эсэх — бодит Keycloak+Postgres-той.
describe('Staff management (e2e)', () => {
  let app: INestApplication<App>;
  let superuserPrisma: PrismaClient;
  let prismaService: PrismaService;
  let adminToken: string;

  let branchA: { id: string };
  let branchB: { id: string };
  let superAdminToken: string;
  let branchAdminAId: string;
  let branchAdminAToken: string;
  let branchManagerAToken: string;

  // Тест бүрийн явцад бодитоор ҮҮССЭН (rollback хийгдээгүй, амжилттай
  // үлдсэн) Keycloak хэрэглэгчдийг afterAll-д ЗААВАЛ устгана — эс бөгөөс
  // энэ spec ӨӨРӨӨ dev DB-д яг ижил төрлийн debris үлдээх байсан
  // (cleanup-debris.ts users/Keycloak-д ХҮРДЭГГҮЙг ADR 002 инцидентийн
  // судалгаагаар баталгаажуулсан).
  const createdKeycloakUserIds: string[] = [];
  const createdUserIds: string[] = [];

  async function createStaff(role: string, branchId: string | null) {
    const id = randomUUID();
    await superuserPrisma.user.create({
      data: {
        id,
        email: `staff-e2e-actor-${role.toLowerCase()}-${id}@example.com`,
        authProvider: 'KEYCLOAK',
      },
    });
    createdUserIds.push(id);
    await superuserPrisma.userBranchRole.create({
      data: { userId: id, branchId, role: role as never },
    });
    return { id, token: await mintAccessToken(id) };
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
    prismaService = app.get(PrismaService);
    adminToken = await getKeycloakAdminToken();

    const unique = Date.now();
    branchA = await superuserPrisma.branch.create({
      data: { name: `Staff E2E Салбар А ${unique}` },
    });
    branchB = await superuserPrisma.branch.create({
      data: { name: `Staff E2E Салбар Б ${unique}` },
    });

    superAdminToken = (await createStaff('SUPER_ADMIN', null)).token;
    const branchAdminA = await createStaff('BRANCH_ADMIN', branchA.id);
    branchAdminAId = branchAdminA.id;
    branchAdminAToken = branchAdminA.token;
    branchManagerAToken = (await createStaff('BRANCH_MANAGER', branchA.id))
      .token;
  });

  afterAll(async () => {
    for (const keycloakUserId of createdKeycloakUserIds) {
      await fetch(
        `${keycloakUrl}/admin/realms/${keycloakRealm}/users/${keycloakUserId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${adminToken}` },
        },
      ).catch(() => undefined);
    }
    await superuserPrisma.userBranchRole.deleteMany({
      where: { userId: { in: createdUserIds } },
    });
    await superuserPrisma.user.deleteMany({
      where: { id: { in: createdUserIds } },
    });
    await app.close();
    await superuserPrisma.$disconnect();
  });

  it('SUPER_ADMIN шинэ ажилтан амжилттай үүсгэнэ — Keycloak БОЛОН Postgres ХАМТ (атомик)', async () => {
    const email = `staff-e2e-new-${Date.now()}@example.com`;
    const res = await request(app.getHttpServer())
      .post('/staff')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        email,
        fullName: 'Шинэ Ажилтан',
        role: 'BRANCH_MANAGER',
        branchId: branchA.id,
      })
      .expect(201);

    const body = res.body as StaffCreateBody;
    expect(typeof body.temporaryPassword).toBe('string');
    expect(body.temporaryPassword.length).toBeGreaterThan(0);
    createdUserIds.push(body.id);

    const dbUser = await superuserPrisma.user.findUnique({
      where: { id: body.id },
    });
    expect(dbUser?.email).toBe(email);
    const dbRole = await superuserPrisma.userBranchRole.findFirst({
      where: { userId: body.id, role: 'BRANCH_MANAGER', branchId: branchA.id },
    });
    expect(dbRole).not.toBeNull();

    const kcUser = await findKeycloakUserByEmail(adminToken, email);
    expect(kcUser).not.toBeNull();
    expect(kcUser?.attributes?.local_user_id?.[0]).toBe(body.id);
    if (kcUser) {
      createdKeycloakUserIds.push(kcUser.id);
    }
  });

  it('BRANCH_ADMIN өөрийн салбартаа ажилтан үүсгэж чадна', async () => {
    const email = `staff-e2e-own-branch-${Date.now()}@example.com`;
    const res = await request(app.getHttpServer())
      .post('/staff')
      .set('Authorization', `Bearer ${branchAdminAToken}`)
      .send({
        email,
        fullName: 'Салбарын Ажилтан',
        role: 'SALESPERSON',
        branchId: branchA.id,
      })
      .expect(201);

    const body = res.body as StaffCreateBody;
    createdUserIds.push(body.id);
    const kcUser = await findKeycloakUserByEmail(adminToken, email);
    if (kcUser) {
      createdKeycloakUserIds.push(kcUser.id);
    }
  });

  it('⚠️ ЦӨМ: BRANCH_ADMIN ӨӨР салбарт ажилтан үүсгэхийг оролдвол 403, ШИНЭЭР үүссэн Keycloak хэрэглэгч ROLLBACK (устгагдана)', async () => {
    const email = `staff-e2e-cross-branch-${Date.now()}@example.com`;
    const res = await request(app.getHttpServer())
      .post('/staff')
      .set('Authorization', `Bearer ${branchAdminAToken}`)
      .send({
        email,
        fullName: 'Хориотой Ажилтан',
        role: 'SALESPERSON',
        branchId: branchB.id,
      })
      .expect(403);

    expect((res.body as ErrorBody).error.code).toBe('FORBIDDEN');

    const dbUser = await superuserPrisma.user.findUnique({ where: { email } });
    expect(dbUser).toBeNull();

    // Keycloak талд ч эзэнгүй мөр үлдээгүй эсэхийг баталгаажуулна — яг
    // ЭНЭ төрлийн "Keycloak identity бий, Postgres мөргүй" зөрүү нь
    // ADR 002-ийн 2026-08-25 инцидентийн шинж чанар байсан тул.
    const kcUser = await waitFor(async () => {
      const found = await findKeycloakUserByEmail(adminToken, email);
      return found === null ? true : null;
    });
    expect(kcUser).toBe(true);
  });

  it('⚠️ ЦӨМ: BRANCH_ADMIN SUPER_ADMIN дүр оноохыг оролдвол 403 (escalation хаагдсан), Keycloak rollback хийгдэнэ', async () => {
    const email = `staff-e2e-escalation-${Date.now()}@example.com`;
    const res = await request(app.getHttpServer())
      .post('/staff')
      .set('Authorization', `Bearer ${branchAdminAToken}`)
      .send({ email, fullName: 'Escalation Оролдлого', role: 'SUPER_ADMIN' })
      .expect(403);

    expect((res.body as ErrorBody).error.code).toBe('FORBIDDEN');

    const kcUser = await waitFor(async () => {
      const found = await findKeycloakUserByEmail(adminToken, email);
      return found === null ? true : null;
    });
    expect(kcUser).toBe(true);
  });

  it('⚠️ ЦӨМ: Postgres тал (email давхардал) REJECT хийхэд ШИНЭЭР үүссэн Keycloak хэрэглэгч rollback хийгдэнэ', async () => {
    // Postgres-д ГАНЦААРАА (Keycloak талгүйгээр) урьдчилж мөр бий болгоно
    // — жинхэнэ "email аль хэдийн авагдсан" Postgres-only зөрчлийг
    // симуляцлана (энэ нь Keycloak-ийн find-by-email алхмаар БАРИГДАХГҮЙ,
    // учир нь Keycloak талд ийм email-тэй хэрэглэгч байхгүй).
    const email = `staff-e2e-pg-conflict-${Date.now()}@example.com`;
    const preExistingId = randomUUID();
    await superuserPrisma.user.create({
      data: { id: preExistingId, email, authProvider: 'KEYCLOAK' },
    });
    createdUserIds.push(preExistingId);

    const res = await request(app.getHttpServer())
      .post('/staff')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        email,
        fullName: 'Давхардсан Имэйл',
        role: 'SALESPERSON',
        branchId: branchA.id,
      })
      .expect(409);

    expect((res.body as ErrorBody).error.code).toBe('STAFF_EMAIL_TAKEN');

    const kcUser = await waitFor(async () => {
      const found = await findKeycloakUserByEmail(adminToken, email);
      return found === null ? true : null;
    });
    expect(kcUser).toBe(true);
  });

  it('BRANCH_MANAGER (ажилтан удирдах эрхгүй) POST /staff дуудвал 403 (RolesGuard)', async () => {
    await request(app.getHttpServer())
      .post('/staff')
      .set('Authorization', `Bearer ${branchManagerAToken}`)
      .send({
        email: `staff-e2e-blocked-${Date.now()}@example.com`,
        fullName: 'Хориотой',
        role: 'SALESPERSON',
        branchId: branchA.id,
      })
      .expect(403);
  });

  it('глобал дүрд branchId зааж болохгүй → 400, Keycloak-д хүрэхгүй', async () => {
    const email = `staff-e2e-bad-input-${Date.now()}@example.com`;
    await request(app.getHttpServer())
      .post('/staff')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        email,
        fullName: 'Буруу Оролт',
        role: 'SUPER_ADMIN',
        branchId: branchA.id,
      })
      .expect(400);

    const kcUser = await findKeycloakUserByEmail(adminToken, email);
    expect(kcUser).toBeNull();
  });

  it('GET /staff жагсаалтад SUPER_ADMIN бүх ажилтныг харна, branchId-аар шүүнэ', async () => {
    const res = await request(app.getHttpServer())
      .get('/staff')
      .query({ branchId: branchA.id })
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);

    const body = res.body as {
      id: string;
      roles: { branchId: string | null }[];
    }[];
    expect(body.length).toBeGreaterThan(0);
    for (const staff of body) {
      expect(staff.roles.some((r) => r.branchId === branchA.id)).toBe(true);
    }
  });

  it('PATCH /staff/:id — SUPER_ADMIN ажилтныг идэвхгүй болгож, дараа нь дүрийг сольж чадна', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/staff')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        email: `staff-e2e-update-${Date.now()}@example.com`,
        fullName: 'Шинэчлэгдэх Ажилтан',
        role: 'SALESPERSON',
        branchId: branchA.id,
      })
      .expect(201);
    const created = createRes.body as StaffCreateBody;
    createdUserIds.push(created.id);
    const kcUser = await findKeycloakUserByEmail(adminToken, created.email);
    if (kcUser) {
      createdKeycloakUserIds.push(kcUser.id);
    }

    await request(app.getHttpServer())
      .patch(`/staff/${created.id}`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ isActive: false })
      .expect(200);
    const deactivated = await superuserPrisma.user.findUnique({
      where: { id: created.id },
    });
    expect(deactivated?.isActive).toBe(false);

    await request(app.getHttpServer())
      .patch(`/staff/${created.id}`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        oldBranchId: branchA.id,
        role: 'BRANCH_MANAGER',
        branchId: branchA.id,
      })
      .expect(200);
    const promoted = await superuserPrisma.userBranchRole.findFirst({
      where: {
        userId: created.id,
        role: 'BRANCH_MANAGER',
        branchId: branchA.id,
      },
    });
    expect(promoted).not.toBeNull();
    const oldRole = await superuserPrisma.userBranchRole.findFirst({
      where: { userId: created.id, role: 'SALESPERSON', branchId: branchA.id },
    });
    expect(oldRole).toBeNull();
  });

  it('⚠️ BRANCH_ADMIN ӨӨР салбарын ажилтныг идэвхгүй болгож чадахгүй (users_select RLS-ээр тэр ажилтан ЭХЛЭЭД харагдахгүй тул 404 — 401/403-аас илүү мэдээлэл алдагдуулахгүй, prisma-errors.ts-ийн тогтсон зарчим)', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/staff')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        email: `staff-e2e-branchb-${Date.now()}@example.com`,
        fullName: 'Салбар Б Ажилтан',
        role: 'SALESPERSON',
        branchId: branchB.id,
      })
      .expect(201);
    const created = createRes.body as StaffCreateBody;
    createdUserIds.push(created.id);
    const kcUser = await findKeycloakUserByEmail(adminToken, created.email);
    if (kcUser) {
      createdKeycloakUserIds.push(kcUser.id);
    }

    await request(app.getHttpServer())
      .patch(`/staff/${created.id}`)
      .set('Authorization', `Bearer ${branchAdminAToken}`)
      .send({ oldBranchId: branchB.id, isActive: false })
      .expect(404);
  });

  // §Даалгавар: "PATCH /staff-д ижил escalation шалгалт бодитоор
  // хэрэгжсэн эсэхийг батал" — POST-ийн адил ЗӨВХӨН app_create_staff_member()-д
  // биш, app_update_staff_member()-д ч (migration 20260825090000) ЯГ ижил
  // "branch-scoped дуудагч глобал нэртэй role оноож чадахгүй" шалгалт бий
  // эсэхийг 2 давхаргаар (HTTP/DTO-той хамт БОЛОН DTO-г тойрсон шууд SQL)
  // баталгаажуулна.
  it('⚠️ ЦӨМ (PATCH, HTTP давхарга): BRANCH_ADMIN өөрийн салбарын ажилтныг SUPER_ADMIN болгохыг оролдвол 403, DB-д role бодитоор ӨӨРЧЛӨГДӨӨГҮЙ', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/staff')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        email: `staff-e2e-patch-escalation-${Date.now()}@example.com`,
        fullName: 'Escalation Бай',
        role: 'SALESPERSON',
        branchId: branchA.id,
      })
      .expect(201);
    const created = createRes.body as StaffCreateBody;
    createdUserIds.push(created.id);
    const kcUser = await findKeycloakUserByEmail(adminToken, created.email);
    if (kcUser) {
      createdKeycloakUserIds.push(kcUser.id);
    }

    // Глобал role бол DTO-ийн дагуу branchId ЗААВАЛ орхигдоно (400
    // BRANCH_ID_NOT_ALLOWED-оос зайлсхийхийн тулд) — энэ бол HTTP/DTO
    // давхаргаар зөвшөөрөгдөх ХАМГИЙН ойрхон (илбэрхэн) escalation оролдлого.
    await request(app.getHttpServer())
      .patch(`/staff/${created.id}`)
      .set('Authorization', `Bearer ${branchAdminAToken}`)
      .send({ oldBranchId: branchA.id, role: 'SUPER_ADMIN' })
      .expect(403);

    const stillSalesperson = await superuserPrisma.userBranchRole.findFirst({
      where: { userId: created.id, role: 'SALESPERSON', branchId: branchA.id },
    });
    expect(stillSalesperson).not.toBeNull();
    const escalated = await superuserPrisma.userBranchRole.findFirst({
      where: { userId: created.id, role: 'SUPER_ADMIN' },
    });
    expect(escalated).toBeNull();
  });

  it('⚠️ ЦӨМ (PATCH, SQL функцийн давхарга): app_update_staff_member()-г ӨӨРИЙГ нь (DTO-г БҮРЭН тойрсон, HTTP биш шууд SQL) branchId-той ХАМТ глобал role дамжуулж дуудахад ч FORBIDDEN буцаана', async () => {
    // ⚠️ ЭНЭ тест ЗОРИУДАА UpdateStaffDto-ийн "глобал role бол branchId
    // хориотой" шалгалтыг ТОЙРЧ, app_update_staff_member() SQL функц
    // ӨӨРӨӨ (application давхаргаас үл хамааран) ямар ч тохиолдолд
    // branch-scoped дуудагчид глобал role оноохыг хориглодгийг батална
    // (migration 20260825090000-ийн 121-123-р мөрийн "IF NOT v_is_global
    // AND p_new_role IN ('SUPER_ADMIN', 'OWNER', 'ALL_BRANCH_MANAGER')"
    // шалгалт) — CLAUDE.md-ийн "RLS mutation policy-г service давхаргыг
    // тойрсон аргаар шалгах ёстой" стандарттай ЯГ ижил зарчим.
    const rows = await prismaService.runRequestTransaction(
      branchAdminAId,
      (tx) => tx.$queryRaw<{ app_update_staff_member: string }[]>`
        SELECT app_update_staff_member(
          ${branchAdminAId}, ${branchA.id}, 'SUPER_ADMIN', ${branchA.id}, NULL
        )
      `,
    );
    expect(rows[0]?.app_update_staff_member).toBe('FORBIDDEN');

    const stillBranchAdmin = await superuserPrisma.userBranchRole.findFirst({
      where: {
        userId: branchAdminAId,
        role: 'BRANCH_ADMIN',
        branchId: branchA.id,
      },
    });
    expect(stillBranchAdmin).not.toBeNull();
  });
});

// §Даалгавар: инцидентийн эцсийн БҮТЦИЙН хамгаалалт — migration
// 20260826070000_add_global_role_branch_check_constraint. ADR
// 002/005-ийн SECURITY DEFINER функцүүд (app_create_staff_member/
// app_update_staff_member) ӨӨРСДИЙН дуудлагын замд л escalation
// шалгалт хийдэг — энэ CHECK constraint бол ТҮҮНЭЭС ЯЛГААТАЙ, ЯМАР Ч
// код зам (одоо байгаа/ирээдүйн endpoint, гар SQL)-аас ҮЛ ХАМААРАН DB
// түвшинд бүрмөсөн хориглодог сүүлчийн давхарга гэдгийг батлахын тулд
// service/SECURITY DEFINER функц АЛЬ АЛИНЫГ Ч ОГТ дуудалгүй, шууд
// superuser холболтоор (RLS-ээс ч тусгаарлаж) raw INSERT оролдоно.
describe('user_branch_roles CHECK constraint (chk_global_role_no_branch)', () => {
  let superuserPrisma: PrismaClient;
  let anyUserId: string;
  let anyBranchId: string;

  beforeAll(async () => {
    superuserPrisma = new PrismaClient({
      datasources: { db: { url: process.env.DATABASE_URL } },
    });
    const branch = await superuserPrisma.branch.create({
      data: { name: `CHK constraint E2E Салбар ${Date.now()}` },
    });
    anyBranchId = branch.id;
    const user = await superuserPrisma.user.create({
      data: {
        id: randomUUID(),
        email: `chk-constraint-e2e-${Date.now()}@example.com`,
        authProvider: 'KEYCLOAK',
      },
    });
    anyUserId = user.id;
  });

  afterAll(async () => {
    await superuserPrisma.userBranchRole.deleteMany({
      where: { userId: anyUserId },
    });
    await superuserPrisma.user
      .delete({ where: { id: anyUserId } })
      .catch(() => undefined);
    await superuserPrisma.branch
      .delete({ where: { id: anyBranchId } })
      .catch(() => undefined);
    await superuserPrisma.$disconnect();
  });

  it('SUPER_ADMIN + branchId NOT NULL — 23514 constraint зөрчил шиднэ (service/SECURITY DEFINER функц ОГТ ашиглаагүй, шууд superuser raw INSERT)', async () => {
    await expect(
      superuserPrisma.$executeRaw`
        INSERT INTO user_branch_roles (id, "userId", "branchId", role, "createdAt")
        VALUES (${randomUUID()}, ${anyUserId}, ${anyBranchId}, 'SUPER_ADMIN', now())
      `,
    ).rejects.toThrow(/chk_global_role_no_branch/);

    const leaked = await superuserPrisma.userBranchRole.findFirst({
      where: { userId: anyUserId, role: 'SUPER_ADMIN' },
    });
    expect(leaked).toBeNull();
  });

  it('SALESPERSON (салбарын role) + branchId NULL — 23514 constraint зөрчил шиднэ', async () => {
    await expect(
      superuserPrisma.$executeRaw`
        INSERT INTO user_branch_roles (id, "userId", "branchId", role, "createdAt")
        VALUES (${randomUUID()}, ${anyUserId}, NULL, 'SALESPERSON', now())
      `,
    ).rejects.toThrow(/chk_global_role_no_branch/);

    const leaked = await superuserPrisma.userBranchRole.findFirst({
      where: { userId: anyUserId, role: 'SALESPERSON', branchId: null },
    });
    expect(leaked).toBeNull();
  });

  it('OWNER + branchId NULL (зөв хослол) — амжилттай INSERT хийгдэнэ (constraint эерэг замыг хориглохгүй)', async () => {
    await superuserPrisma.$executeRaw`
      INSERT INTO user_branch_roles (id, "userId", "branchId", role, "createdAt")
      VALUES (${randomUUID()}, ${anyUserId}, NULL, 'OWNER', now())
    `;
    const created = await superuserPrisma.userBranchRole.findFirst({
      where: { userId: anyUserId, role: 'OWNER', branchId: null },
    });
    expect(created).not.toBeNull();
  });
});
