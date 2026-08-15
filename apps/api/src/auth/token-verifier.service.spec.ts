import { UnauthorizedException } from '@nestjs/common';
import { SignJWT } from 'jose';
import { CUSTOMER_JWT_ISSUER } from './constants.js';
import { TokenVerifierService } from './token-verifier.service.js';

const JWT_SECRET = 'unit-test-secret';

async function signCustomerToken(
  overrides: {
    typ?: string;
    sub?: string;
    issuer?: string;
    expiresIn?: string;
    secret?: string;
  } = {},
): Promise<string> {
  const secret = new TextEncoder().encode(overrides.secret ?? JWT_SECRET);
  return new SignJWT({ typ: overrides.typ ?? 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(overrides.sub ?? 'user-123')
    .setIssuer(overrides.issuer ?? CUSTOMER_JWT_ISSUER)
    .setIssuedAt()
    .setExpirationTime(overrides.expiresIn ?? '15m')
    .sign(secret);
}

describe('TokenVerifierService', () => {
  const originalEnv = process.env.JWT_SECRET;

  beforeAll(() => {
    process.env.JWT_SECRET = JWT_SECRET;
  });

  afterAll(() => {
    process.env.JWT_SECRET = originalEnv;
  });

  let verifier: TokenVerifierService;

  beforeEach(() => {
    verifier = new TokenVerifierService();
  });

  it('custom (харилцагч) access token-ыг зөв баталгаажуулж localUserId буцаана', async () => {
    const token = await signCustomerToken({ sub: 'customer-42' });
    const result = await verifier.verify(token);
    expect(result).toEqual({ localUserId: 'customer-42' });
  });

  it('refresh token (typ=refresh)-ыг access token болгож хүлээж авахгүй', async () => {
    const token = await signCustomerToken({ typ: 'refresh' });
    await expect(verifier.verify(token)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('буруу нууц үгээр гарын үсэг зурсан token-ыг хүлээж авахгүй', async () => {
    const token = await signCustomerToken({ secret: 'wrong-secret' });
    await expect(verifier.verify(token)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('хугацаа дууссан token-ыг хүлээж авахгүй', async () => {
    const token = await signCustomerToken({ expiresIn: '-10s' });
    await expect(verifier.verify(token)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('танигдаагүй iss бүхий token-ыг UNKNOWN_TOKEN_ISSUER-ээр татгалзана', async () => {
    const token = await signCustomerToken({ issuer: 'some-other-issuer' });
    try {
      await verifier.verify(token);
      fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(UnauthorizedException);
      expect((err as UnauthorizedException).getResponse()).toMatchObject({
        code: 'UNKNOWN_TOKEN_ISSUER',
      });
    }
  });

  it('JWT биш утгыг задлах үед INVALID_TOKEN алдаа өгнө', async () => {
    try {
      await verifier.verify('not-a-jwt');
      fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(UnauthorizedException);
      expect((err as UnauthorizedException).getResponse()).toMatchObject({
        code: 'INVALID_TOKEN',
      });
    }
  });
});
