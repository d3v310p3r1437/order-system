import { RedisService } from '../redis/redis.service.js';
import { LoginThrottleService } from './login-throttle.service.js';

// Redis (infra/docker-compose.dev.yml) ажиллаж байх шаардлагатай —
// dev орчны бодит Redis-тэй интеграцийн тест (mock ашиглахгүй, учир нь
// INCR/EXPIRE-ийн атомик зан төлөвийг бодитоор шалгах нь илүү найдвартай).
describe('LoginThrottleService', () => {
  let redis: RedisService;
  let throttle: LoginThrottleService;
  const phone = `+9760000${Math.floor(Math.random() * 1000)}`;

  beforeAll(() => {
    redis = new RedisService();
    throttle = new LoginThrottleService(redis);
  });

  afterAll(async () => {
    await redis.del(`auth-customer:login-fail:${phone}`);
    redis.disconnect();
  });

  it('эхлээд блоклогдоогүй байна', async () => {
    expect(await throttle.isBlocked(phone)).toBe(false);
  });

  it('1-5 дахь оролдлогын өмнө блоклогдоогүй байна, 6 дахь шалгалт дээр блоклоно', async () => {
    // Бодит хэрэглээний дараалалтай адил: isBlocked() шалгаад л дараа нь
    // recordFailure() дуудна (§6.2: 1-5 дахь буруу оролдлого зөвшөөрөгдөнө,
    // 6 дахь нь тоолуур >=5 болсон тул шалгахаас нь өмнө блоклогдоно).
    for (let i = 0; i < 5; i++) {
      expect(await throttle.isBlocked(phone)).toBe(false);
      await throttle.recordFailure(phone);
    }
    expect(await throttle.isBlocked(phone)).toBe(true);
  });

  it('reset дуудсаны дараа дахин блоклохгүй болно', async () => {
    await throttle.reset(phone);
    expect(await throttle.isBlocked(phone)).toBe(false);
  });
});
