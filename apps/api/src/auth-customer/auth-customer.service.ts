import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { SignJWT, jwtVerify } from 'jose';
import { CUSTOMER_JWT_ISSUER } from '../auth/constants.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { LoginThrottleService } from './login-throttle.service.js';

const ACCESS_TOKEN_EXPIRY = process.env.JWT_ACCESS_EXPIRY ?? '15m';
const REFRESH_TOKEN_EXPIRY = '30d'; // §6.2 хүснэгт: харилцагчийн refresh token — 30 хоног

export interface CustomerTokenPair {
  accessToken: string;
  refreshToken: string;
}

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET орчны хувьсагч тохируулагдаагүй байна');
  }
  return new TextEncoder().encode(secret);
}

@Injectable()
export class AuthCustomerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loginThrottle: LoginThrottleService,
  ) {}

  async register(phone: string, password: string): Promise<CustomerTokenPair> {
    const existing = await this.prisma.tx.$queryRaw<{ id: string | null }[]>`
      SELECT app_find_customer_id_by_phone(${phone}) AS id
    `;
    if (existing[0]?.id) {
      throw new ConflictException({
        code: 'PHONE_ALREADY_REGISTERED',
        message: 'Энэ утасны дугаар аль хэдийн бүртгэлтэй байна',
      });
    }

    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const newId = randomUUID();

    // users_insert RLS policy-ийн "id = app_current_user_id()" нөхцөлийг
    // хангахын тулд (docs/adr/002-...) trusted auth service context-аас
    // шинэ хэрэглэгчийн өөрийнх нь id-г урьдчилан "би" гэж тохируулна.
    await this.prisma.tx
      .$executeRaw`SELECT set_config('app.user_id', ${newId}, true)`;
    await this.prisma.tx.user.create({
      data: {
        id: newId,
        phone,
        passwordHash,
        authProvider: 'CUSTOMER_AUTH',
      },
    });

    return this.issueTokenPair(newId);
  }

  async login(phone: string, password: string): Promise<CustomerTokenPair> {
    if (await this.loginThrottle.isBlocked(phone)) {
      throw new HttpException(
        {
          code: 'TOO_MANY_ATTEMPTS',
          message:
            'Оролдлого хэт олон удаа амжилтгүй боллоо. 15 минутын дараа дахин оролдоно уу.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Анонимаар эхэлдэг тул users_select RLS-ийг шууд давж чадахгүй —
    // зөвхөн `id`-г буцаадаг SECURITY DEFINER функцээр эхлээд олно
    // (migration: add_customer_phone_lookup_function).
    const found = await this.prisma.tx.$queryRaw<{ id: string | null }[]>`
      SELECT app_find_customer_id_by_phone(${phone}) AS id
    `;
    const userId = found[0]?.id ?? null;

    if (!userId) {
      await this.loginThrottle.recordFailure(phone);
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Утасны дугаар эсвэл нууц үг буруу байна',
      });
    }

    // id олдсоны дараа өөрийгөө "би" гэж тохируулснаар users_select
    // policy (id = app_current_user_id()) бүрэн мөрийг (passwordHash-тай)
    // унших зөвшөөрөл өгнө.
    await this.prisma.tx
      .$executeRaw`SELECT set_config('app.user_id', ${userId}, true)`;
    const user = await this.prisma.tx.user.findUnique({
      where: { id: userId },
    });

    if (
      !user?.passwordHash ||
      !(await argon2.verify(user.passwordHash, password))
    ) {
      await this.loginThrottle.recordFailure(phone);
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Утасны дугаар эсвэл нууц үг буруу байна',
      });
    }

    await this.loginThrottle.reset(phone);
    return this.issueTokenPair(user.id);
  }

  async refresh(refreshToken: string): Promise<CustomerTokenPair> {
    let subject: string;
    try {
      const { payload } = await jwtVerify(refreshToken, getJwtSecret(), {
        issuer: CUSTOMER_JWT_ISSUER,
      });
      if (payload.typ !== 'refresh' || typeof payload.sub !== 'string') {
        throw new Error('unexpected token type');
      }
      subject = payload.sub;
    } catch {
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Refresh token хүчингүй байна',
      });
    }
    return this.issueTokenPair(subject);
  }

  private async issueTokenPair(userId: string): Promise<CustomerTokenPair> {
    const secret = getJwtSecret();

    const accessToken = await new SignJWT({ typ: 'access' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(userId)
      .setIssuer(CUSTOMER_JWT_ISSUER)
      .setIssuedAt()
      .setExpirationTime(ACCESS_TOKEN_EXPIRY)
      .sign(secret);

    const refreshToken = await new SignJWT({ typ: 'refresh' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(userId)
      .setIssuer(CUSTOMER_JWT_ISSUER)
      .setIssuedAt()
      .setExpirationTime(REFRESH_TOKEN_EXPIRY)
      .sign(secret);

    return { accessToken, refreshToken };
  }
}
