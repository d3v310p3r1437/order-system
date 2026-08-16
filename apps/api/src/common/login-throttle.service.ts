import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service.js';

// §6.2 даалгавар: "буруу оролдлого хязгаарла (5 удаа → 15 минут блок)".
// 1-5 дахь буруу оролдлого тус бүрдээ "нууц үг буруу" гэж хариулна;
// 6 дахь оролдлого (тоолуур >= 5 үед) нууц үгийг шалгахаас ч өмнө
// шууд блоклогдоно. `namespace` нь харилцагч (auth-customer) болон
// ажилтны (auth-staff) throttle-г Redis key-ээр тусгаарлана.
const MAX_FAILED_ATTEMPTS = 5;
const BLOCK_SECONDS = 15 * 60;

@Injectable()
export class LoginThrottleService {
  constructor(private readonly redis: RedisService) {}

  private key(namespace: string, identifier: string): string {
    return `${namespace}:login-fail:${identifier}`;
  }

  async isBlocked(namespace: string, identifier: string): Promise<boolean> {
    const count = await this.redis.get(this.key(namespace, identifier));
    return count !== null && Number(count) >= MAX_FAILED_ATTEMPTS;
  }

  async recordFailure(namespace: string, identifier: string): Promise<void> {
    const key = this.key(namespace, identifier);
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, BLOCK_SECONDS);
    }
  }

  async reset(namespace: string, identifier: string): Promise<void> {
    await this.redis.del(this.key(namespace, identifier));
  }
}
