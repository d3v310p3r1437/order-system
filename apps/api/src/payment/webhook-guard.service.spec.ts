import { LoginThrottleService } from '../common/login-throttle.service.js';
import { RedisService } from '../redis/redis.service.js';
import { WebhookGuardService } from './webhook-guard.service.js';

// Redis (infra/docker-compose.dev.yml) ажиллаж байх шаардлагатай —
// login-throttle.service.spec.ts-тэй ижил зарчмаар mock биш бодит
// Redis-тэй (SET NX EX, INCR/EXPIRE-ийн атомик зан төлөвийг бодитоор
// шалгах нь илүү найдвартай).
describe('WebhookGuardService', () => {
  let redis: RedisService;
  let guard: WebhookGuardService;

  beforeAll(() => {
    redis = new RedisService();
    guard = new WebhookGuardService(redis, new LoginThrottleService(redis));
  });

  afterAll(() => {
    redis.disconnect();
  });

  describe('isDuplicate', () => {
    it('шинэ payment_id-д false, 10 секундын дотор давхар дуудвал true буцаана', async () => {
      const paymentId = `pay-dup-${Date.now()}`;

      expect(await guard.isDuplicate(paymentId)).toBe(false);
      expect(await guard.isDuplicate(paymentId)).toBe(true);
      expect(await guard.isDuplicate(paymentId)).toBe(true);

      await redis.del(`payment-webhook:dedupe:${paymentId}`);
    });

    it('Promise.all-аар яг зэрэг ирсэн 2 хүсэлтийн зөвхөн 1 нь л "шинэ" (false) байна', async () => {
      const paymentId = `pay-race-${Date.now()}`;

      const [first, second] = await Promise.all([
        guard.isDuplicate(paymentId),
        guard.isDuplicate(paymentId),
      ]);

      const duplicateCount = [first, second].filter((v) => v === true).length;
      expect(duplicateCount).toBe(1);

      await redis.del(`payment-webhook:dedupe:${paymentId}`);
    });
  });

  describe('isRateLimited', () => {
    it('30 хүсэлт хүртэл false, 31 дэх хүсэлтэд true буцаана', async () => {
      const ip = `10.0.0.${Math.floor(Math.random() * 250)}`;

      for (let i = 0; i < 30; i++) {
        expect(await guard.isRateLimited(ip)).toBe(false);
      }
      expect(await guard.isRateLimited(ip)).toBe(true);

      await redis.del(`payment-webhook-ip:login-fail:${ip}`);
    }, 15000);
  });
});
