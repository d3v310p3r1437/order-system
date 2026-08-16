# ADR 006: Төлбөрийн webhook — "signature шалгах" биш "server-to-server дахин баталгаажуулах"

- Статус: Хүлээн зөвшөөрсөн (Mock provider-оор бүрэн урсгал баталгаажсан;
  QPay бодит credential хараахан ирээгүй тул `QPayProvider`-ийн HTTP
  дуудлагууд ЗӨВХӨН unit тестээр (mock HTTP хариу) шалгагдсан, доорх
  "QPay бодит холболт ирэхэд заавал баталгаажуулах зүйлс" хэсгийг үз).
  2026-08-17: idempotency (davtagdah webhook) ба rate-limit/dedupe
  хэсгүүд нэмэгдэж шинэчлэгдсэн — доорх "Webhook idempotency ба
  rate-limit" хэсгийг үз.
- Огноо: 2026-08-16 (анхны), 2026-08-17 (idempotency/rate-limit нэмэлт)
- Холбоотой: `docs/plan.md` §4.4, §8 Phase 3b (Хэсэг B),
  `docs/adr/005-security-definer-pattern.md` (WRITE ангилал),
  `apps/api/src/payment/*`, `apps/api/src/common/login-throttle.service.ts`,
  `apps/api/prisma/migrations/20260816120500_add_order_mark_paid_function`,
  `apps/api/prisma/migrations/20260817090000_atomic_idempotent_mark_paid_function`

## Асуудал

`docs/plan.md` §4.4-ийн анхны аюулгүй байдлын checklist "Payment webhook
(QPay/SocialPay) бүрт HMAC/signature verification заавал шалгагдсан"
гэж заасан байсан. Гэвч:

1. QPay-ийн Merchant V2 API-ийн (developer.qpay.mn) webhook/callback
   payload-д HMAC signature header орсон эсэх, орсон бол ямар алгоритм
   (HMAC-SHA256 гэх мэт) ашигладгийг эх сурвалжаас тодорхой олж
   баталгаажуулж чадаагүй (бодит sandbox credential байхгүй тул бодит
   callback хүлээж авч шалгах боломжгүй) — иймд "signature шалгана" гэсэн
   шаардлагыг код болгож хэрэгжүүлэх боломжгүй/эрсдэлтэй.
2. Webhook endpoint нь угаасаа **session identity огт байхгүй** хүсэлт
   хүлээн авдаг (QPay-ийн сервэрээс ирдэг, манай `Authorization: Bearer`
   биш) — иймд ердийн `RolesGuard`/RLS-ээр хамгаалах боломжгүй, харин
   payload-д итгэх эсэхийг өөр аргаар шийдэх ёстой.

## Шийдвэр

Signature шалгах (боломжтой болмогц НЭМЭЛТ давхарга болгож болно, доорхыг
үз) ОРОНД **"ямар ч payload-д шууд итгэхгүй, идэвхтэй `PaymentProvider`-ийн
`checkPayment()`-ийг сервэр талаас дахин дуудаж, ТҮҮНИЙ хариуг л
баталгаа болгож ашиглана"** зарчмыг баримталсан:

```
QPay webhook → POST /payment/webhook/:orderId { payment_id }
                        │
                        ▼
        PaymentService.confirmWebhookPayment(orderId, payment_id)
                        │
              paymentProvider.checkPayment(payment_id)  ← QPay/Mock-той
              СЕРВЭР ТАЛААС ШУУД (webhook payload-аас ХАРААТГҮЙ) холбогдоно
                        │
              статус === 'PAID' эсэхийг ЭНД шийднэ, webhook body-ийн
              ямар нэг "status"/"success" талбарт ХЭЗЭЭ Ч итгэхгүй
                        │
                        ▼
        app_mark_order_paid(orderId, payment_id) SECURITY DEFINER
        (зөвхөн энэ хос таарвал л Order.paidAt тавина)
```

### Яагаад энэ хангалттай вэ

- Webhook-ийн ганц эрх мэдлийн эх сурвалж бол **QPay-ийн өөрийнх нь
  `checkPayment()` (`GET`/`POST /v2/payment/check`) хариу** — webhook
  payload өөрөө зөвхөн "ямар нэг зүйл боллоо, шалгаад үз" гэсэн
  ТРИГГЕР төдий үүрэгтэй, шийдвэр гаргах өгөгдлийн эх сурвалж БИШ.
  Attacker webhook payload-ыг бүхэлд нь хуурамчаар үүсгэсэн ч,
  `checkPayment()`-ийн бодит хариу (QPay-ийн сервэр өөрөө) PAID гэж
  батлахгүй л бол `Order.paidAt` хэзээ ч тавигдахгүй.
- **`orderId`-г webhook body-оос БИШ, URL path-аас (`/payment/webhook/:orderId`)
  авдаг, мөн энэ URL-ыг QPay рүү илгээх `callback_url`-ыг БИД ӨӨРСДӨӨ
  `createInvoice()`-ийн үед (`qpay.provider.ts`) тохируулдаг** — тиймээс
  webhook-ийн орж ирж буй orderId нь ХЭЗЭЭ Ч хэрэглэгч/attacker-ийн шууд
  оруулсан утга биш, БИД ӨӨРСДӨӨ өмнө нь итгэмжтэй үүсгэсэн лавлагаа.
- **`app_mark_order_paid(p_order_id, p_provider_invoice_id)`
  (`20260816120500` migration) — cross-order халдлагаас хамгаална:**
  зөвхөн `providerInvoiceId` (checkout үед БИД ӨӨРСДӨӨ
  `PaymentProvider.createInvoice()`-ийн буцаасан утгаар Order мөрөнд
  бичсэн) яг таарсан үед л `paidAt`-г тавьдаг тул attacker өөрийн (жинхэнэ,
  бага дүнтэй) invoice-оо төлөөд, тэр `payment_id`-гаа өөр (том дүнтэй)
  Order-ийн `orderId`-тай хамт webhook рүү илгээсэн ч (checkPayment() энэ
  payment_id-г ЖИНХЭНЭ PAID гэж батлах болно!) `providerInvoiceId` хос
  таарахгүй тул `paidAt` тавигдахгүй —
  `apps/api/test/payment.e2e-spec.ts`-ийн "буруу orderId-тай хамт
  илгээвэл" тестээр батлагдсан. Энэ функц `docs/adr/005`-ийн **WRITE**
  ангиллын шинэ тохиолдол (session identity огт байхгүй тул "authorize"
  алхам нь session-based биш, харин "checkout үед бид өөрсдөө үүсгэсэн
  ID-тай таарсан эсэх" гэсэн domain relationship-оор хийгддэг).
- **Idempotent:** `WHERE "paidAt" IS NULL` нөхцөл тул QPay webhook-г
  давхар (retry) илгээсэн ч (нийтлэг зан төлөв) хоёр дахь удаад зүгээр
  0 мөр өөрчилж, алдаа шидэхгүй — доорх "Webhook idempotency ба
  rate-limit" хэсэгт 2026-08-17-нд бүрэн жагсаалтаар (`MARKED_PAID`/
  `ALREADY_PAID`/`MISMATCH`) өргөтгөв.
- **Webhook-д ямар ч session identity шаардахгүй** (`PaymentController`
  дээр `RolesGuard` ЗОРИУДАА байхгүй) — учир нь дээрх server-to-server
  re-check бүхэлдээ л эрх мэдлийн баталгаа, `Authorization` header-т
  найдах шаардлагагүй.

### HMAC signature-той харьцуулбал

Signature шалгах нь (боломжтой бол) НЭМЭЛТ давхар хамгаалалт болж болох ч
цорын ганц баталгаа болгож болохгүй — учир нь (a) manай систем ямар
алгоритм/түлхүүрээр signature гаргадгийг ЭХ СУРВАЛЖААС батлан тодруулаагүй
(§"Мэдэгдэж буй эрсдэл"-ийг үз), (b) signature зөв байлаа ч гэсэн "энэ
яг тухайн orderId-д хамаарах ЖИНХЭНЭ, ТУХАЙН дүнгээр төлөгдсөн" гэдгийг
баталгаажуулах ёстой хэвээр (signature ЗӨВХӨН "энэ payload QPay-ээс ирсэн"
гэдгийг батална, "энэ мэдээлэл ОДООГИЙН ҮНЭН" гэдгийг батлахгүй — жиш,
хуучин, аль хэдийн орлуулагдсан webhook давтагдаж ирж болно). Иймд
server-to-server re-check ЗААВАЛ байх ёстой, signature (нэмэгдвэл) зөвхөн
"эрт татгалзах" (fast-reject, `checkPayment()` дуудлагыг хэмнэх) оптимизаци
байх болно.

## Webhook idempotency ба rate-limit (2026-08-17 нэмэлт)

### Судалгаа: Stripe/PayPal-ийн webhook стандарт практик

Bодит QPay sandbox байхгүй тул Stripe/PayPal-ийн (нийтэд ил, сайн
баримтжуулсан) webhook удирдамжийг эх сурвалж болгож ашигласан — учир нь
"payment provider webhook" гэдэг асуудлын хэлбэр (давхар илгээгдэх
магадлалтай, эрх мэдэлгүй, гадны сервэрээс ирдэг HTTP хүсэлт) ижил бөгөөд
эдгээр компаниуд аль хэдийн олон жил production дээр шийдвэрлэсэн загвар:

1. **Webhook ЗААВАЛ HTTP 2xx буцаана** (амжилттай боловсруулагдсан ч,
   idempotent давталт ч, "манай тал аль хэдийн мэднэ" гэсэн утгатай
   MISMATCH/алдаа ч) — 2xx-ээс өөр код (400/500 гэх мэт) буцвал
   илгээгч тал (Stripe/PayPal/QPay) ЭНЭ webhook-ийг "амжилтгүй хүргэгдсэн"
   гэж үзэж **автоматаар олон удаа (exponential backoff-оор, заримдаа
   өдрүүдийн турш) retry хийдэг** — энэ нь бидний талд давхар боловсруулах
   ачаалал үүсгэдэг тул зайлсхийх ёстой. Rate-limit-ийн хариу (429) л
   цорын ганц зөвтгөгдсөн үл хамаарал (доор тайлбарлав).
2. **Webhook event ID (эсвэл манай тохиолдолд payment/invoice ID)-аар
   idempotency key болгож ашиглана** — ижил ID-тай хүсэлт хэдэн ч удаа
   ирсэн, зөвхөн НЭГ удаа л бодит "мутаци" хийгдэх ёстой.
3. Webhook боловсруулалт удаан (гадаад API дуудлага гэх мэт) үед ЗЭРЭГ
   (concurrent) давхар хүсэлт ирэх магадлал бодитой (сүлжээний саатал →
   илгээгч тал хугацаа хэтэрсэн гэж үзээд шинэ оролдлого эхлүүлэх) тул
   **зөвхөн DB-ийн atomic UPDATE-д найдахгүй, ХҮСЭЛТ хүлээн авах
   давхаргад (application/Redis) богино хугацааны dedupe ЗӨВЛӨДӨГ**
   (Stripe-ийн "Designing an idempotent API" удирдамжийн зарчим).

### Шийдвэр 1 — SQL функцийг ATOMIC IDEMPOTENT болгосон (давхар боловсруулах, алдаа шидэхгүй)

`app_mark_order_paid()`-ийг (`20260817090000_atomic_idempotent_mark_paid_function`
migration, өмнөх `20260816120500`-ийг DROP+CREATE-ээр сольсон) 0 мөр
өөрчлөгдсөн ШАЛТГААНЫГ ялгаж мэдэх боломжтой болгов:

```sql
UPDATE orders SET "paidAt" = now()
WHERE id = p_order_id AND "providerInvoiceId" = p_provider_invoice_id
  AND "paidAt" IS NULL;
-- GET DIAGNOSTICS-аар мөрийн тоог авч, шалтгааныг ялгана:
```

| Буцаах утга (`result`) | Утга | HTTP хариу |
|---|---|---|
| `MARKED_PAID` | ЭНЭ дуудлагаар шинээр paidAt тавигдсан | 200, audit бичигдэнэ, WS event нийтлэгдэнэ |
| `ALREADY_PAID` | Хос зөв таарсан ч аль хэдийн PAID байсан (idempotent давталт) | 200, audit/event ДАХИН гарахгүй |
| `MISMATCH` | orderId олдсонгүй эсвэл providerInvoiceId таарахгүй | 200 (cross-order халдлагын хамгаалалт, дээрх хэсгийг үз) |

`PaymentController.webhook()` эдгээрийн АЛЬ АЛЬНД нь `@HttpCode(HttpStatus.OK)`-оор
**заавал HTTP 200** буцаана (rate-limit-ээс бусад тохиолдолд) — Stripe/
PayPal-ийн дээрх "давхар retry-аас сэргийлэх" зарчмыг баримтална.

### Шийдвэр 2 — WebhookGuardService: dedupe lock + coarse IP rate-limit

`src/payment/webhook-guard.service.ts` — шинэ Redis логик ХАМГИЙН БАГА
бичихийн тулд аль хэдийн байгаа `LoginThrottleService`-ийн INCR+EXPIRE
"цонхны дотор N-ээс давбал блоклох" pattern-ийг **`ThrottleOptions`-оор
параметржүүлж дахин ашигласан** (namespace `payment-webhook-ip`,
30 хүсэлт/60 секунд):

- **`isRateLimited(ip)`** — 1 минутад 30-с олон хүсэлт ирвэл 429
  `TOO_MANY_REQUESTS` (rate-limit ЯГАНЦ л 2xx-ээс өөр хариу буцаадаг
  тохиолдол — QPay-ийн бодит webhook ийм түвшний давтамжид хэзээ ч
  хүрэхгүй тул legitimate дан webhook алдагдах эрсдэлгүй).
- **`isDuplicate(paymentId)`** — payment_id-аар 10 секундын dedupe lock
  (`SET key val NX EX 10`, ЭНЭ codebase-д ӨМНӨ БАЙГААГҮЙ ӨӨР ТӨРЛИЙН Redis
  primitive — тоолуур биш "аль хэдийн боловсруулж байгаа эсэх" атомик
  шалгалт тул шинээр бичсэн). Ижил payment_id-аар 10 секундын дотор дахин
  ирвэл `checkPayment()`-ийг ДАХИН дуудахгүй (гадаад QPay API дуудлагыг
  хэмнэнэ), шууд `{ result: 'DUPLICATE_SKIPPED' }`-тэй 200 буцаана.
  `SET NX` атомик тул Promise.all-аар яг ЗЭРЭГ ирсэн 2 хүсэлтийн ЗӨВХӨН
  НЭГ нь л бодитоор боловсруулагдана (`test/payment.e2e-spec.ts`-ийн
  "2 удаа ЗЭРЭГ webhook" тестээр батлагдсан — `Order.paidAt` болон WS
  `order.payment_confirmed` event хоёулаа зөвхөн 1 удаа).

### Логлолт

Webhook хүлээн авсан БҮРИЙГ (амжилттай ч, rate-limited/davhardсан ч)
`PaymentController`-ийн `Logger` (`console`, DB биш) ашиглаж бичнэ —
DB-ийн `audit_logs`-д бол ЗӨВХӨН ЖИНХЭНЭ мутаци (`MARKED_PAID`) хийгдсэн
тохиолдолд л бичигдэнэ (`PaymentService.writeAuditLog()`, `@Audit()`
decorator-ыг ЗОРИУДАА ашиглаагүй, учир нь энэ нь controller handler-ийн
АМЖИЛТТАЙ хариу бүрт нөхцөлгүй бичдэг тул rate-limited/dedupe-skip
тохиолдолд ч "мутаци болсон" мэт худал мөр үлдээх эрсдэлтэй байсан).
Энэ ялгаа: DB audit log = "юу бодитоор өөрчлөгдсөн", application log =
"юу хүлээн авсан" — хоёр өөр зорилготой, хольж ашиглаагүй.

## QPay бодит холболт ирэхэд заавал баталгаажуулах зүйлс

`apps/api/src/payment/qpay.provider.ts`-ийн толгой хэсэгт дэлгэрэнгүй
тэмдэглэсэн (энд товч):

1. **Webhook-ийн бодит payload бүтэц** — QPay callback POST body-д
   яг ямар талбар (`payment_id`, эсвэл өөр нэр) ирдэгийг баталгаажуулах.
   `PaymentWebhookDto`-ийн `payment_id` талбар одоогоор ТААМАГЛАЛ.
2. **Signature/HMAC header байгаа эсэх** — хэрэв QPay бодитоор
   signature header (жиш: `X-QPay-Signature`) илгээдэг бол дээрх
   "нэмэлт давхар хамгаалалт" болгож нэмж болно (ГЭХДЭЭ server-to-server
   `checkPayment()`-ийг орлохгүй, зөвхөн НЭМЭЛТ).
3. **`/v2/payment/check`-ийн бодит хариуны бүтэц** (`payment_status`
   талбарын боломжит утгууд: `PAID`-аас өөр ямар утга байдгийг —
   жиш "NEW", "FAILED", "REFUNDED" гэх мэт — бүрэн жагсаах).
4. **`callback_url`-ийн бодит зан төлөв** — query param/path segment-ийг
   QPay хэвээр нь дамжуулдаг эсэх (кодчлол, URL encode/өөрчлөгдөж
   болзошгүй эсэх).
5. **`/v2/invoice`-ийн `sender_invoice_no`-ийн давтагдашгүй байх
   шаардлага** — манай `orderId` (UUID) энэ шаардлагыг хангах ёстой ч
   бодит sandbox дээр (урт, тэмдэгтийн хязгаарлалт) шалгах.
6. **Буцаалт (`refundPayment()`)-ийн бодит endpoint/талбар** — эх
   сурвалжаас олдоогүй тул одоогийн хэрэгжилт бүрэн таамаглал (кодын
   толгойд ⚠️ гэж тэмдэглэсэн).

## Мэдэгдэж буй эрсдэл

- QPay-ийн бодит webhook signature механизм байгаа эсэх, байгаа бол
  яагаад одоо ашиглаагүйг дээр тайлбарласан ч, **ирээдүйд credential
  ирмэгц НЭГ дэх алхмыг заавал гүйцэтгэж, шаардлагатай бол
  `PaymentWebhookDto`-д signature header баталгаажуулалт нэмэх ёстой**
  (fast-reject оптимизаци, гол хамгаалалт биш ч давхар хамгаалалт).
- ~~`PaymentController`-ийн webhook endpoint session-гүй тул rate-limit
  одоогоор тавигдаагүй~~ — **2026-08-17: шийдэгдсэн**, дээрх "Webhook
  idempotency ба rate-limit" хэсгийг үз (`WebhookGuardService`,
  IP-ээр 1 минутад 30). Босго ӨНДӨР сонгосон тул зохион байгуулалттай
  (олон IP-ээс тархсан) DDoS-ээс бүрэн хамгаалахгүй — зөвхөн цорын
  ганц эх сурвалжаас үерлүүлэх энгийн халдлагаас хамгаална, энэ нь
  мэдэгдэж буй үлдэгдэл эрсдэл хэвээр.
- `checkPayment()` дуудлага бүр QPay рүү бодит сүлжээний хүсэлт (латенц,
  QPay-ийн availability-аас хамаарна) — webhook-ийн хариу удаашрах
  боломжтой, гэхдээ аюулгүй байдлын trade-off хэлбэрээр зөвтгөгдсөн.
