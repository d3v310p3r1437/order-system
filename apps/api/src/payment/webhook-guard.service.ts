import { Injectable } from '@nestjs/common';
import { LoginThrottleService } from '../common/login-throttle.service.js';
import { RedisService } from '../redis/redis.service.js';

// docs/adr/006-qpay-verify-dont-trust.md-ийн "Webhook idempotency/rate-limit"
// хэсэг (эх сурвалж: Stripe/PayPal-ийн стандарт webhook practice — payload
// давхар ирэхийг хүлээж, dedupe+coarse rate-limit хийдэг). Хоёр өөр Redis
// primitive хэрэгтэй тул тус бүрийг зөв газраас нь (аль хэдийн байгаа
// эсэх) авсан:
// - Coarse IP rate-limit: `LoginThrottleService`-ийн INCR+EXPIRE
//   "цонхны дотор N-ээс давбал блоклох" pattern-ийг ШУУД дахин ашиглав
//   (шинэ Redis логик БИЧЭЭГҮЙ) — зөвхөн шинэ namespace + ThrottleOptions.
// - 10 секундын dedupe lock: ЭНЭ codebase-д өмнө байгаагүй ӨӨР ТӨРЛИЙН
//   primitive (SET NX EX — атомик "аль хэдийн боловсруулж байгаа эсэх"
//   шалгалт, тоолуур биш) тул шинээр (1 мөр) бичив.
const WEBHOOK_IP_NAMESPACE = 'payment-webhook-ip';
const IP_RATE_LIMIT_MAX_REQUESTS = 30;
const IP_RATE_LIMIT_WINDOW_SECONDS = 60;
const DEDUPE_LOCK_SECONDS = 10;

@Injectable()
export class WebhookGuardService {
  constructor(
    private readonly redis: RedisService,
    private readonly loginThrottle: LoginThrottleService,
  ) {}

  // 1 минутад 30 хүсэлт — цорын ганц IP-ээс webhook үерлүүлэх халдлагаас
  // (checkPayment() бүрт бодит гадаад QPay дуудлага хийдэг тул үнэтэй)
  // хамгаална. Босго ӨНДӨР (жинхэнэ QPay retry маш ховор 30/минутаас
  // хэтэрдэггүй) — legitimate дан webhook хэзээ ч алдахгүйн тулд.
  async isRateLimited(ip: string): Promise<boolean> {
    const count = await this.loginThrottle.recordFailure(
      WEBHOOK_IP_NAMESPACE,
      ip,
      { windowSeconds: IP_RATE_LIMIT_WINDOW_SECONDS },
    );
    return count > IP_RATE_LIMIT_MAX_REQUESTS;
  }

  // Ижил payment_id-аар 10 секундын дотор дахин webhook ирвэл (QPay-ийн
  // бодит давталт эсвэл Promise.all-аар зэрэг ирсэн хос хүсэлт) `true`
  // буцаана — дуудагч тал `checkPayment()`-ийг ДАХИН дуудахгүй, шууд 200
  // OK буцаана. `SET key val NX EX 10` атомик тул race-safe: хоёр
  // хүсэлт яг зэрэг ирсэн ч зөвхөн НЭГ нь л "шинэ" (false) гэж тооцогдоно.
  async isDuplicate(paymentId: string): Promise<boolean> {
    const result = await this.redis.set(
      this.dedupeKey(paymentId),
      '1',
      'EX',
      DEDUPE_LOCK_SECONDS,
      'NX',
    );
    return result === null;
  }

  private dedupeKey(paymentId: string): string {
    return `payment-webhook:dedupe:${paymentId}`;
  }
}
