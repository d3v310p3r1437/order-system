import { HttpException, UnauthorizedException } from '@nestjs/common';
import type { LoginThrottleService } from '../common/login-throttle.service.js';
import { AuthStaffService } from './auth-staff.service.js';

interface ThrottleMocks {
  throttle: LoginThrottleService;
  isBlocked: jest.Mock;
  recordFailure: jest.Mock;
  reset: jest.Mock;
}

function mockThrottle(blocked = false): ThrottleMocks {
  const isBlocked = jest.fn().mockResolvedValue(blocked);
  const recordFailure = jest.fn().mockResolvedValue(undefined);
  const reset = jest.fn().mockResolvedValue(undefined);
  return {
    throttle: {
      isBlocked,
      recordFailure,
      reset,
    } as unknown as LoginThrottleService,
    isBlocked,
    recordFailure,
    reset,
  };
}

// Keycloak-руу бодит сүлжээний хүсэлт явуулахгүйгээр §6.2-ийн зөв/буруу
// нэвтрэлт, throttle-ийн логикыг шалгана — бодит Keycloak-тэй интеграцийг
// test/auth-staff.e2e-spec.ts дээр шалгана.
describe('AuthStaffService', () => {
  const originalSecret = process.env.KEYCLOAK_CLIENT_SECRET;
  const originalFetch = global.fetch;

  beforeAll(() => {
    process.env.KEYCLOAK_CLIENT_SECRET = 'unit-test-secret';
  });

  afterAll(() => {
    process.env.KEYCLOAK_CLIENT_SECRET = originalSecret;
    global.fetch = originalFetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('амжилттай нэвтрэлт → Keycloak-ийн snake_case хариуг camelCase болгоод throttle цэвэрлэнэ', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: 'access-abc',
          refresh_token: 'refresh-abc',
          expires_in: 300,
          refresh_expires_in: 1800,
          token_type: 'Bearer',
        }),
    });
    global.fetch = fetchMock;
    const { throttle, reset } = mockThrottle();
    const service = new AuthStaffService(throttle);

    const result = await service.login('staff@example.com', 'Test1234!');

    expect(result).toEqual({
      accessToken: 'access-abc',
      refreshToken: 'refresh-abc',
      expiresIn: 300,
      refreshExpiresIn: 1800,
      tokenType: 'Bearer',
    });
    expect(reset).toHaveBeenCalledWith('auth-staff', 'staff@example.com');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      'http://localhost:8080/realms/order-system/protocol/openid-connect/token',
    );
    const body = init.body as URLSearchParams;
    expect(body.get('grant_type')).toBe('password');
    expect(body.get('client_id')).toBe('api-client');
    expect(body.get('client_secret')).toBe('unit-test-secret');
    expect(body.get('username')).toBe('staff@example.com');
    expect(body.get('password')).toBe('Test1234!');
  });

  it('Keycloak 400 (буруу нэвтрэлт) буцаавал 401 INVALID_CREDENTIALS шидэж, алдааг бүртгэнэ', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false });
    const { throttle, recordFailure } = mockThrottle();
    const service = new AuthStaffService(throttle);

    await expect(
      service.login('staff@example.com', 'wrong'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(recordFailure).toHaveBeenCalledWith(
      'auth-staff',
      'staff@example.com',
    );
  });

  it('throttle блоклосон бол Keycloak рүү огт хандалгүй 429 TOO_MANY_ATTEMPTS шидэнэ', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    const { throttle } = mockThrottle(true);
    const service = new AuthStaffService(throttle);

    await expect(
      service.login('staff@example.com', 'Test1234!'),
    ).rejects.toBeInstanceOf(HttpException);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
