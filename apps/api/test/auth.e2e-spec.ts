import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/http-exception.filter';

interface TokenPairBody {
  accessToken: string;
  refreshToken: string;
}

interface MeBody {
  userId: string;
  roles: { role: string; branchId: string | null }[];
}

interface ErrorBody {
  error: { code: string; message: string; details: unknown };
}

// §6.2 архитектурын бодит урсгалыг бодит Postgres/Redis-тэй (dev docker
// compose) шалгана — docs/adr/002 (customer JWT → /auth/me → role CUSTOMER),
// docs/adr/001 (token-гүй хүсэлт RLS-ээр хаагдана), §6.2 (5 буруу оролдлого
// зөвшөөрөгдөнө, 6 дахь нь throttle-д унана).
describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  const phone = `+9769${Date.now().toString().slice(-8)}`;
  const password = 'Test1234!';
  let accessToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /auth/customer/register → 201, access/refresh JWT ирнэ', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/customer/register')
      .send({ phone, password })
      .expect(201);

    const body = res.body as TokenPairBody;
    expect(typeof body.accessToken).toBe('string');
    expect(typeof body.refreshToken).toBe('string');
    accessToken = body.accessToken;
  });

  it('GET /auth/me (custom JWT-тэйгээр) → role CUSTOMER, branch мөргүй', async () => {
    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect((res.body as MeBody).roles).toEqual([
      { role: 'CUSTOMER', branchId: null },
    ]);
  });

  it('GET /debug/branches (token/header-гүй) → [] — RLS-ээр хамгаалагдсан', async () => {
    const res = await request(app.getHttpServer())
      .get('/debug/branches')
      .expect(200);
    expect(res.body).toEqual([]);
  });

  it('буруу нууц үгээр 6 удаа дараалан → 1-5 дахь нь 401, 6 дахь нь 429 throttle', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await request(app.getHttpServer())
        .post('/auth/customer/login')
        .send({ phone, password: 'WrongPassword1' })
        .expect(401);
      expect((res.body as ErrorBody).error.code).toBe('INVALID_CREDENTIALS');
    }

    const blocked = await request(app.getHttpServer())
      .post('/auth/customer/login')
      .send({ phone, password: 'WrongPassword1' })
      .expect(429);
    expect((blocked.body as ErrorBody).error.code).toBe('TOO_MANY_ATTEMPTS');
  });
});
