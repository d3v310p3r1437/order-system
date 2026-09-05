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

interface BrandingBody {
  storeName: string;
  logoUrl: string | null;
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

// docs/plan.md §7 "Дэлгүүрийн нэр/лого (branding)" даалгавар: GET
// нэвтрэлтгүй нээлттэй байх ёстой (Login дэлгэц дээр ч харагдана), PUT
// зөвхөн SUPER_ADMIN/OWNER — ADR 005-ийн "READ-redact" app_public_branding()
// SECURITY DEFINER функцээр system_settings RLS-ийг (аль хэдийн
// нэвтэрсэн байхыг шаарддаг) тойрно.
describe('Branding (e2e)', () => {
  let app: INestApplication<App>;
  let superuserPrisma: PrismaClient;
  let prismaService: PrismaService;

  let superAdminToken: string;
  let ownerToken: string;
  let allBranchManagerToken: string;
  let branchAdminToken: string;
  let customerToken: string;
  let customerId: string;

  let originalStoreName: string;
  let originalLogoUrl: string | null;

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

    const branch = await superuserPrisma.branch.create({
      data: { name: `Брэндинг тест салбар ${Date.now()}` },
    });

    const superAdminId = randomUUID();
    const ownerId = randomUUID();
    const allBranchManagerId = randomUUID();
    const branchAdminId = randomUUID();
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
    superAdminToken = await mintAccessToken(superAdminId);

    await superuserPrisma.user.create({
      data: {
        id: ownerId,
        email: `owner-${ownerId}@example.com`,
        authProvider: 'KEYCLOAK',
      },
    });
    await superuserPrisma.userBranchRole.create({
      data: { userId: ownerId, branchId: null, role: 'OWNER' },
    });
    ownerToken = await mintAccessToken(ownerId);

    await superuserPrisma.user.create({
      data: {
        id: allBranchManagerId,
        email: `abm-${allBranchManagerId}@example.com`,
        authProvider: 'KEYCLOAK',
      },
    });
    await superuserPrisma.userBranchRole.create({
      data: {
        userId: allBranchManagerId,
        branchId: null,
        role: 'ALL_BRANCH_MANAGER',
      },
    });
    allBranchManagerToken = await mintAccessToken(allBranchManagerId);

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
    branchAdminToken = await mintAccessToken(branchAdminId);

    await superuserPrisma.user.create({
      data: {
        id: customerId,
        phone: `+9765${Date.now().toString().slice(-8)}`,
        authProvider: 'CUSTOMER_AUTH',
      },
    });
    customerToken = await mintAccessToken(customerId);

    const initial = await superuserPrisma.$queryRaw<
      Array<{ key: string; value: string }>
    >`SELECT * FROM app_public_branding()`;
    const byKey = new Map(initial.map((row) => [row.key, row.value]));
    originalStoreName = byKey.get('STORE_NAME') ?? 'ЧАНАР';
    originalLogoUrl = byKey.get('STORE_LOGO_URL') ?? null;
  });

  afterAll(async () => {
    // Дараагийн тестүүдэд/локал баталгаажуулалтад нөлөөлөхгүйн тулд анхны
    // утгад буцаана (returns.e2e-spec.ts-ийн RETURN_FEE_PERCENT-той ижил
    // зарчим).
    await superuserPrisma.systemSetting.upsert({
      where: { key: 'STORE_NAME' },
      create: { key: 'STORE_NAME', value: originalStoreName },
      update: { value: originalStoreName },
    });
    if (originalLogoUrl) {
      await superuserPrisma.systemSetting.upsert({
        where: { key: 'STORE_LOGO_URL' },
        create: { key: 'STORE_LOGO_URL', value: originalLogoUrl },
        update: { value: originalLogoUrl },
      });
    } else {
      await superuserPrisma.systemSetting
        .delete({ where: { key: 'STORE_LOGO_URL' } })
        .catch(() => undefined);
    }

    await app.close();
    await superuserPrisma.$disconnect();
  });

  it('GET /settings/branding нэвтрэлтгүй (token-гүй) 200 буцаана', async () => {
    const res = await request(app.getHttpServer())
      .get('/settings/branding')
      .expect(200);

    const body = res.body as BrandingBody;
    expect(typeof body.storeName).toBe('string');
    expect(body.storeName.length).toBeGreaterThan(0);
  });

  it('GET /settings/branding нэвтэрсэн хэрэглэгчид ч (CUSTOMER) адилхан ажиллана', async () => {
    await request(app.getHttpServer())
      .get('/settings/branding')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);
  });

  it('PUT /settings/branding-ийг CUSTOMER/BRANCH_ADMIN/ALL_BRANCH_MANAGER дуудвал 403 (зөвхөн SUPER_ADMIN/OWNER)', async () => {
    await request(app.getHttpServer())
      .put('/settings/branding')
      .set('Authorization', `Bearer ${customerToken}`)
      .field('storeName', 'Хакердсан нэр')
      .expect(403);
    await request(app.getHttpServer())
      .put('/settings/branding')
      .set('Authorization', `Bearer ${branchAdminToken}`)
      .field('storeName', 'Хакердсан нэр')
      .expect(403);
    await request(app.getHttpServer())
      .put('/settings/branding')
      .set('Authorization', `Bearer ${allBranchManagerToken}`)
      .field('storeName', 'Хакердсан нэр')
      .expect(403);
  });

  it('PUT /settings/branding token-гүй бол 401', async () => {
    await request(app.getHttpServer())
      .put('/settings/branding')
      .field('storeName', 'Нэвтрээгүй')
      .expect(401);
  });

  it('PUT /settings/branding storeName БОЛОН file хоёулгүй бол 400', async () => {
    await request(app.getHttpServer())
      .put('/settings/branding')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(400);
  });

  it('SUPER_ADMIN зөвшөөрөгдөөгүй файлын төрөл (PDF) илгээвэл 400', async () => {
    await request(app.getHttpServer())
      .put('/settings/branding')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .attach('file', Buffer.from('%PDF-1.4'), {
        filename: 'x.pdf',
        contentType: 'application/pdf',
      })
      .expect(400);
  });

  it('OWNER зөвхөн storeName илгээж амжилттай шинэчилнэ, GET-ээр даруй харагдана', async () => {
    const putRes = await request(app.getHttpServer())
      .put('/settings/branding')
      .set('Authorization', `Bearer ${ownerToken}`)
      .field('storeName', 'ЧАНАР ТЕСТ')
      .expect(200);
    expect((putRes.body as BrandingBody).storeName).toBe('ЧАНАР ТЕСТ');

    const getRes = await request(app.getHttpServer())
      .get('/settings/branding')
      .expect(200);
    expect((getRes.body as BrandingBody).storeName).toBe('ЧАНАР ТЕСТ');
  });

  it('SUPER_ADMIN лого файл илгээвэл MinIO-руу upload хийгдэж, logoUrl шинэчлэгдэнэ', async () => {
    const putRes = await request(app.getHttpServer())
      .put('/settings/branding')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .attach('file', Buffer.from('fake-png-bytes'), {
        filename: 'logo.png',
        contentType: 'image/png',
      })
      .expect(200);
    const body = putRes.body as BrandingBody;
    expect(body.logoUrl).toMatch(/branding\/.+\.png$/);

    const getRes = await request(app.getHttpServer())
      .get('/settings/branding')
      .expect(200);
    expect((getRes.body as BrandingBody).logoUrl).toBe(body.logoUrl);
  });

  // CLAUDE.md "Тестийн стандарт — RLS mutation policy": RolesGuard/Service
  // давхаргын урьдчилсан шалгалтыг тойрч, шууд raw SQL-ээр
  // system_settings_update policy-г батална.
  describe('system_settings_update RLS policy — service/RolesGuard-ыг тойрч шууд SQL-ээр', () => {
    it('CUSTOMER raw UPDATE хийхэд 0 мөр өөрчлөгдөж чимээгүй "татгалздаг"', async () => {
      const before = await superuserPrisma.systemSetting.findUnique({
        where: { key: 'STORE_NAME' },
      });
      const affectedRows = await prismaService.runRequestTransaction(
        customerId,
        (tx) =>
          tx.$executeRaw`UPDATE system_settings SET value = 'hacked' WHERE "key" = 'STORE_NAME'`,
      );
      expect(affectedRows).toBe(0);

      const after = await superuserPrisma.systemSetting.findUnique({
        where: { key: 'STORE_NAME' },
      });
      expect(after?.value).toBe(before?.value);
    });
  });
});
