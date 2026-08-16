import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service.js';

// §6.2 даалгавар: "буруу оролдлого хязгаарла (5 удаа → 15 минут блок)".
// 1-5 дахь буруу оролдлого тус бүрдээ "нууц үг буруу" гэж хариулна;
// 6 дахь оролдлого (тоолуур >= 5 үед) нууц үгийг шалгахаас ч өмнө
// шууд блоклогдоно. `namespace` нь харилцагч (auth-customer) болон
// ажилтны (auth-staff) throttle-г Redis key-ээр тусгаарлана.
const MAX_FAILED_ATTEMPTS = 5;
const BLOCK_SECONDS = 15 * 60;

export interface ThrottleOptions {
  // Өгөгдөөгүй бол анхны login-throttle зорилготой утгууд (5 оролдлого /
  // 15 минут) хэвээр ашиглагдана — auth-customer/auth-staff-ийн одоо
  // байгаа дуудлагууд ӨӨРЧЛӨГДӨХГҮЙ (backward-compatible).
  maxAttempts?: number;
  windowSeconds?: number;
}

// Ганц "INCR+EXPIRE цонхонд тоолж, N-ээс давбал блоклох" Redis pattern —
// login буруу оролдлогод зориулж анх бичигдсэн ч ямар ч "цонхны дотор
// давтамж хязгаарлах" хэрэгцээнд (жиш: payment/webhook-guard.service.ts-ийн
// IP-ээр coarse rate-limit) ThrottleOptions-оор дахин ашиглах боломжтой —
// шинэ Redis INCR/EXPIRE логик хаа сайгүй давхардуулж бичихгүйн тулд.
@Injectable()
export class LoginThrottleService {
  constructor(private readonly redis: RedisService) {}

  private key(namespace: string, identifier: string): string {
    return `${namespace}:login-fail:${identifier}`;
  }

  async isBlocked(
    namespace: string,
    identifier: string,
    options?: ThrottleOptions,
  ): Promise<boolean> {
    const count = await this.redis.get(this.key(namespace, identifier));
    return (
      count !== null &&
      Number(count) >= (options?.maxAttempts ?? MAX_FAILED_ATTEMPTS)
    );
  }

  // Буцаах утга (шинэ тоолуур) нь зөвхөн энэ дуудлагаар шинээр нэмэгдсэн
  // цонхны дотоод тоо — coarse rate-limit кейст (webhook-guard) "энэ
  // хүсэлт хэддүгээрх вэ" гэдгийг нэг дуудлагаар мэдэхэд ашигтай (login
  // урсгал энэ буцаах утгыг өнөөг хүртэл ашиглаагүй тул нэмэгдсэн ч
  // одоо байгаа дуудагчдад нөлөөгүй).
  async recordFailure(
    namespace: string,
    identifier: string,
    options?: ThrottleOptions,
  ): Promise<number> {
    const key = this.key(namespace, identifier);
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, options?.windowSeconds ?? BLOCK_SECONDS);
    }
    return count;
  }

  async reset(namespace: string, identifier: string): Promise<void> {
    await this.redis.del(this.key(namespace, identifier));
  }
}
