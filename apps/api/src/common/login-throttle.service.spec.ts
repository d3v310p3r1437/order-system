import { RedisService } from '../redis/redis.service.js';
import { LoginThrottleService } from './login-throttle.service.js';

// Redis (infra/docker-compose.dev.yml) ажиллаж байх шаардлагатай —
// dev орчны бодит Redis-тэй интеграцийн тест (mock ашиглахгүй, учир нь
// INCR/EXPIRE-ийн атомик зан төлөвийг бодитоор шалгах нь илүү найдвартай).
describe('LoginThrottleService', () => {
  let redis: RedisService;
  let throttle: LoginThrottleService;
  const namespace = 'test-throttle';
  const identifier = `+9760000${Math.floor(Math.random() * 1000)}`;

  beforeAll(() => {
    redis = new RedisService();
    throttle = new LoginThrottleService(redis);
  });

  afterAll(async () => {
    await redis.del(`${namespace}:login-fail:${identifier}`);
    redis.disconnect();
  });

  it('эхлээд блоклогдоогүй байна', async () => {
    expect(await throttle.isBlocked(namespace, identifier)).toBe(false);
  });

  it('1-5 дахь оролдлогын өмнө блоклогдоогүй байна, 6 дахь шалгалт дээр блоклоно', async () => {
    // Бодит хэрэглээний дараалалтай адил: isBlocked() шалгаад л дараа нь
    // recordFailure() дуудна (§6.2: 1-5 дахь буруу оролдлого зөвшөөрөгдөнө,
    // 6 дахь нь тоолуур >=5 болсон тул шалгахаас нь өмнө блоклогдоно).
    for (let i = 0; i < 5; i++) {
      expect(await throttle.isBlocked(namespace, identifier)).toBe(false);
      await throttle.recordFailure(namespace, identifier);
    }
    expect(await throttle.isBlocked(namespace, identifier)).toBe(true);
  });

  it('reset дуудсаны дараа дахин блоклохгүй болно', async () => {
    await throttle.reset(namespace, identifier);
    expect(await throttle.isBlocked(namespace, identifier)).toBe(false);
  });

  it('namespace тус бүрийн тоолуур тусдаа байна', async () => {
    await throttle.recordFailure('other-namespace', identifier);
    expect(await throttle.isBlocked(namespace, identifier)).toBe(false);
    await redis.del(`other-namespace:login-fail:${identifier}`);
  });

  // auth-customer/auth-staff хоёр модуль ижил LoginThrottleService-г
  // хуваалцдаг (§ CLAUDE.md "Одоогийн Phase") тул нэг identifier (жиш:
  // адилхан утга и-мэйл болон утасны дугаарын форматад давхцаж болзошгүй)
  // хоёр namespace-д ЯГ ХАРИЛЦАН БИЕ ДААСАН ажиллаж байгааг илт баталгаажуулна.
  it("'customer' namespace 5 удаа блоклогдсон ч 'staff' namespace ижил identifier-ээр шинээр эхэлж хэвийн ажиллана", async () => {
    const sharedIdentifier = `shared-${Math.floor(Math.random() * 100000)}`;

    for (let i = 0; i < 5; i++) {
      await throttle.recordFailure('customer', sharedIdentifier);
    }
    expect(await throttle.isBlocked('customer', sharedIdentifier)).toBe(true);
    expect(await throttle.isBlocked('staff', sharedIdentifier)).toBe(false);

    await redis.del(`customer:login-fail:${sharedIdentifier}`);
    await redis.del(`staff:login-fail:${sharedIdentifier}`);
  });

  // src/payment/webhook-guard.service.ts энэ ThrottleOptions-ийг (шинэ
  // Redis логик давхардуулж бичихгүйн тулд) coarse rate-limit-д дахин
  // ашигладаг — anхны login (5/900с) хэрэглээнд ЯМАР Ч нөлөөгүйг батална.
  it('ThrottleOptions-оор өөр maxAttempts/windowSeconds дамжуулбал ЯГ тэрийг ашиглана (анхны 5/900с-той хамааралгүй)', async () => {
    const namespace = 'custom-options-namespace';
    const customIdentifier = `custom-${Math.floor(Math.random() * 100000)}`;

    const firstCount = await throttle.recordFailure(
      namespace,
      customIdentifier,
      { windowSeconds: 5 },
    );
    expect(firstCount).toBe(1);
    expect(
      await throttle.isBlocked(namespace, customIdentifier, {
        maxAttempts: 2,
      }),
    ).toBe(false);

    await throttle.recordFailure(namespace, customIdentifier, {
      windowSeconds: 5,
    });
    expect(
      await throttle.isBlocked(namespace, customIdentifier, {
        maxAttempts: 2,
      }),
    ).toBe(true);

    await redis.del(`${namespace}:login-fail:${customIdentifier}`);
  });
});
