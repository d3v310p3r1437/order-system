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

interface BranchBody {
  id: string;
  name: string;
  address?: string | null;
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

// §7 модуль #5-ийн BranchSelectionScreen хөгжүүлэлтийн үед Android
// emulator дээр бодитоор илэрсэн олдвор: `branches_select` RLS
// (`app_accessible_branch_ids()`) CUSTOMER-д ХЭЗЭЭ Ч мөр буцаадаггүй
// байсныг (staff-д зориулагдсан `user_branch_roles`-д тулгуурладаг тул)
// баталгаажуулна — docs/adr/005 "READ-redact" `app_public_branches()`
// SECURITY DEFINER функцээр CUSTOMER-д ч идэвхтэй салбаруудыг харуулна.
describe('Branch (e2e)', () => {
  let app: INestApplication<App>;
  let superuserPrisma: PrismaClient;

  let activeBranch: { id: string };
  let inactiveBranch: { id: string };
  let customerToken: string;

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

    const unique = Date.now();
    activeBranch = await superuserPrisma.branch.create({
      data: { name: `Идэвхтэй салбар ${unique}`, isActive: true },
    });
    inactiveBranch = await superuserPrisma.branch.create({
      data: { name: `Идэвхгүй салбар ${unique}`, isActive: false },
    });

    const customerId = randomUUID();
    await superuserPrisma.user.create({
      data: {
        id: customerId,
        phone: `+9765${Date.now().toString().slice(-8)}`,
        authProvider: 'CUSTOMER_AUTH',
      },
    });
    customerToken = await mintAccessToken(customerId);
  });

  afterAll(async () => {
    await app.close();
    await superuserPrisma.$disconnect();
  });

  it('CUSTOMER GET /branches дуудвал идэвхтэй салбарыг харна (өмнө нь RLS-ээр үргэлж хоосон байсан)', async () => {
    const res = await request(app.getHttpServer())
      .get('/branches')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);

    const body = res.body as BranchBody[];
    expect(body.find((b) => b.id === activeBranch.id)).toBeDefined();
  });

  it('CUSTOMER идэвхгүй (isActive=false) салбарыг ХАРАХГҮЙ', async () => {
    const res = await request(app.getHttpServer())
      .get('/branches')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);

    const body = res.body as BranchBody[];
    expect(body.find((b) => b.id === inactiveBranch.id)).toBeUndefined();
  });

  it('нэвтрээгүй хэрэглэгч GET /branches дуудвал 401', async () => {
    await request(app.getHttpServer()).get('/branches').expect(401);
  });
});
