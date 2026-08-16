# ADR 006: Төлбөрийн webhook — "signature шалгах" биш "server-to-server дахин баталгаажуулах"

- Статус: Хүлээн зөвшөөрсөн (Mock provider-оор бүрэн урсгал баталгаажсан;
  QPay бодит credential хараахан ирээгүй тул `QPayProvider`-ийн HTTP
  дуудлагууд ЗӨВХӨН unit тестээр (mock HTTP хариу) шалгагдсан, доорх
  "QPay бодит холболт ирэхэд заавал баталгаажуулах зүйлс" хэсгийг үз)
- Огноо: 2026-08-16
- Холбоотой: `docs/plan.md` §4.4, §8 Phase 3b (Хэсэг B),
  `docs/adr/005-security-definer-pattern.md` (WRITE ангилал),
  `apps/api/src/payment/*`,
  `apps/api/prisma/migrations/20260816120500_add_order_mark_paid_function`

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
  0 мөр өөрчилж, алдаа шидэхгүй (`marked: false` буцаана).
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
- `PaymentController`-ийн webhook endpoint session-гүй тул rate-limit
  (§4.4 "OTP/auth endpoint-д rate-limit" зарчмыг энд ч баримтлах ёстой
  эсэх) одоогоор тавигдаагүй — DDoS/brute-force эрсдэлтэй (Phase 3b-ийн
  хамрах хүрээнээс гадуур, backlog-д тэмдэглэв).
- `checkPayment()` дуудлага бүр QPay рүү бодит сүлжээний хүсэлт (латенц,
  QPay-ийн availability-аас хамаарна) — webhook-ийн хариу удаашрах
  боломжтой, гэхдээ аюулгүй байдлын trade-off хэлбэрээр зөвтгөгдсөн.
