# ADR 002: JWT зөвхөн identity нотолно, role/branch DB-ээс уншина

- Статус: Хүлээн зөвшөөрсөн
- Огноо: 2026-08-15
- Холбоотой: `docs/plan.md` §6.1 (RBAC матриц), §6.2 (нэвтрэлтийн архитектур),
  `docs/adr/001-rls-transaction-pattern.md`

## Асуудал

Хоёр тусдаа auth зам (custom customer-auth, Keycloak staff-auth) байгаа
тул JWT claim бүтэц нэгдмэл байх ёстой (§6.2). Түгээмэл хандлага бол
`role`, `branch_id`-г JWT дотор шууд claim болгож оруулах явдал — ингэвэл
authorization шалгалт хурдан (DB рүү нэмэлт хандалт хэрэггүй) болно.

Гэхдээ бидний тохиолдолд:
- Ажилтны эрх (role, аль салбарт харьяалагдах) нь `user_branch_roles`
  хүснэгтэд байрлаж, **олон мөр** байж болно (нэг хэрэглэгч олон салбарт
  өөр өөр role-той байж болно — §6.1 матриц).
- Эрх өөрчлөгдөх давтамж (админ шинэ салбар нэмэх, role хасах/нэмэх)
  нь access token-ийн 15 минутын хугацаанаас богино байж болзошгүй.
- Keycloak талд role/branch-ыг **custom claim mapper**-ээр DB-тэй sync
  хийх шаардлагатай болно (жиш: Keycloak realm role эсвэл group-ыг манай
  `user_branch_roles`-тай tacах, эсвэл Keycloak дотроо тусад нь
  duplicate хадгалах). Энэ нь **2 дахь эх сурвалж (source of truth)**
  үүсгэж, sync алдаа/хоцролт (жиш: DB-д role хассан ч Keycloak token
  дотор хуучин role хэвээр байх) — chsun аюулгүй байдлын том эрсдэл.

## Шийдвэр

**JWT (аль ч эх үүсвэрээс ирсэн ч) зөвхөн "identity"-г нотолно, role/branch
огт агуулахгүй:**

| Эх сурвалж | Claim |
|---|---|
| Custom (харилцагч) | `{ sub: <users.id>, iss: 'order-system-customer-auth', exp }` (HS256) |
| Keycloak (ажилтан) | Стандарт Keycloak claim-ууд + **нэг** custom mapper: `local_user_id` (= `users.id`) (RS256, JWKS) |

`TokenVerifierService.verify(rawToken)` нэг ижил interface-аар аль ч
эх үүсвэрийг баталгаажуулж, зөвхөн `{ localUserId }` буцаана.

**Role/branch-ыг ХЭЗЭЭ Ч JWT-ээс уншихгүй** — үргэлж `user_branch_roles`
хүснэгтээс (RLS-ээр аль хэдийн хамгаалагдсан) асууна:

```ts
// GET /auth/me — жишээ
const ubrRows = await tx.userBranchRole.findMany({ where: { userId } });
```

`ubr_select` RLS policy (`docs/adr/001-...`) аль хэдийн
`"userId" = app_current_user_id()` нөхцөлөөр өөрийнхөө мөрийг унших
эрхийг олгодог тул **нэмэлт RBAC guard шаардахгүйгээр** л ажиллана.

### Ганц эх сурвалж (single source of truth)

- Keycloak: зөвхөн **identity** (нэвтрэх, нууц үг) хариуцна.
- `user_branch_roles`: зөвхөн **authorization** (ямар role, аль салбарт)
  хариуцна.
- Хоёрын хооронд sync хийх claim mapper, cron, event listener огт
  хэрэггүй болно — role өөрчлөгдмөгц (DB транзакц) дараагийн хүсэлт
  бүрт шууд шинэ эрхээр ажиллана (JWT дахин авах хүлээх шаардлагагүй,
  учир нь JWT-д role анхнаасаа байгаагүй).

### Trade-off

- **Нэмэлт DB round-trip:** эрх шалгах `RolesGuard` (Phase 1-ийн
  дараагийн ажил) бүрт `user_branch_roles`-аас унших шаардлагатай.
  Учир нь request бүр аль хэдийн нэг interactive transaction дотор
  явагддаг (ADR 001), энэ нь **нэмэлт connection биш**, зөвхөн нэмэлт
  query — өртөг бага.
- **Self-registration / anonymous lookup RLS-тэй мөргөлдөх тохиолдол:**
  харилцагчийн бүртгэл/нэвтрэлт нь "хэн бэ" гэдгийг мэдэхээс өмнө DB-ээс
  асуух ёстой тул RLS-ийн "зөвхөн өөрийгөө уншина" policy-той шууд
  зөрчилддөг. Үүнийг **бүх талын read/write-ыг чөлөөлөх биш**, зөвхөн
  тухайн нэг functional need-д зориулсан **нарийн хүрээтэй SECURITY
  DEFINER функц** (`app_find_customer_id_by_phone` — зөвхөн `id`-г
  буцаадаг, `passwordHash` огт дэлгэдэггүй) болон "trusted context
  self-signup" (шинэ хэрэглэгч өөрийн шинэ id-г урьдчилан "би" гэж
  тохируулаад л insert хийх) хосолсон загвараар шийдсэн. Дэлгэрэнгүй:
  `src/auth-customer/auth-customer.service.ts` коммент, migration
  `add_customer_phone_lookup_function`.
- **Client талд role харах бол `/auth/me` дуудах шаардлагатай** (JWT-г
  decode хийгээд шууд role харах боломжгүй) — frontend/mobile апп
  нэвтэрсний дараа энэ endpoint-ыг дуудаж кэшлэх ёстой (state
  management-ийн хариуцлага, backend биш).

## Мэдэгдэж буй цаашдын ажил

- `RolesGuard`/`@Roles()` decorator (§6.1 матрицыг код болгох) — Phase 1
  дараагийн sprint.
- Refresh token-ийн revocation/rotation store одоогоор байхгүй (stateless
  JWT, зөвхөн `typ: 'refresh'` + 30 хоногийн exp) — жинхэнэ
  бүтээгдэхүүний шаардлага гарвал Redis эсвэл DB-д хадгалж revoke хийх
  боломжтой болгоно (энэ бол зөвхөн Phase 1 spike-ийн хамрах хүрээнээс
  гадуурх бүтээгдэхүүний шийдвэр тул энд шийдээгүй болгож үлдээв).

## Инцидент (2026-08-25): `local_user_id` DB-д тохирох мөргүй байсан —
цэвэрлэлтийн script БИШ, дутуу гар тохиргоо байсныг нотолсон

**Шинж тэмдэг:** `super.admin@order-system.mn`-ээр admin-web-д нэвтрэхэд
токен зөв ирсэн ч "Эрх оноогдоогүй" гарч, Агуулах/Захиалгууд/Буцаалтууд
бүгд "Танд хандах эрхтэй салбар алга" гэдэг байв.

**Оношилгоо (3 давхарга дараалан шалгав):**
1. Keycloak дээр (`kcadm get users -q email=...`) `local_user_id` custom
   attribute бодитоор байсан (`26a7d6af-6562-4ff8-8c82-44b3671b4694`).
2. Тэр UUID-аар Postgres-ийн `users` хүснэгтээс (superuser `DATABASE_URL`,
   RLS bypass) хайхад **0 мөр** — email-ээр хайхад ч 0 мөр. Мөр ерөнхийдөө
   БАЙХГҮЙ байсан (зөвхөн `user_branch_roles` мөр дутсан асуудал БИШ).
3. `audit_logs`-аас яг энэ `recordId`-тай 3 `staff.login` мөр (2026-08-19,
   2026-08-21×2) олдсон нь эхэндээ "мөр байсан, дараа устсан" гэсэн
   таамаглал төрүүлсэн ч, `auth-staff.controller.ts`-ийн
   `recordIdFromIssuedToken()`-ийг уншихад **`@Audit`-ийн `recordId` нь
   Keycloak-ийн ЗӨВ ШАЛГАСАН биш, зөвхөн шинээр гарсан JWT-г `decodeJwt`-ээр
   (баталгаажуулалтгүйгээр) уншсан утга** болохыг олов — өөрөөр хэлбэл
   `/auth/staff/login` нь Postgres-д ОГТ ХАНДДАГГҮЙ (зөвхөн Keycloak ROPC
   grant), тул "staff.login амжилттай" гэдэг нь DB-д тухайн хэрэглэгч
   байгааг ЯМАР Ч байдлаар нотлохгүй. Энэ нээлт 2-р алхмын дүгнэлтийг
   (мөр угаасаа байгаагүй) баталсан, эсрэгээр биш.

**Язгуур шалтгаан:** `infra/keycloak/setup-realm.sh`-ийн коммент дэх
3 алхамт гар тохиргооны журам ("1. Postgres-д users мөр үүсгэ → 2.
Keycloak дээр `local_user_id` attribute тавь → 3. `user_branch_roles`
мөр нэмэ") **1 болон 3-р алхам огт хийгдээгүй**, зөвхөн 2-р алхам
(Keycloak тал) хийгдсэн байсан — өөрөөр хэлбэл анхнаасаа дутуу
тохируулсан, дараа нь "устсан" биш. Үүнийг баталгаажуулахын тулд:
- `schema.prisma`-ийн `User` модель бол схемийн root (ямар ч гадаад
  түлхүүрээр өөр хүснэгт рүү заадаггүй) тул **ямар ч cascade delete
  зам `users` мөрийг устгаж чадахгүй** — зөвхөн `users` нь ӨӨРӨӨ бусад
  олон хүснэгтийн parent.
- `apps/api/prisma/cleanup-debris.ts`-г бүтэн уншиж баталгаажуулахад
  энэ script **`users`/`user_branch_roles` хүснэгтэд ЗУРААС Ч хүрдэггүй**
  (зөвхөн `Branch.name`/`Category.slug`/`Product.slug`-ийн 10+ оронтой
  debris pattern, мөн debris Branch-д хамаарах `Order`/`ReturnRequest`/
  `CouponRedemption`). `git log --diff-filter=D` -ээр аль хэдийн устсан
  `cleanup-branch-debris.ts`-ийг ч шалгаж, мөн адил зөвхөн Branch-д л
  хүрдэг байсныг баталгаажуулсан.
- `src/` доторх ямар ч endpoint `users` мөр устгадаггүй (delete endpoint
  байхгүй).

Иймд **§"Хэзээ ч дараах зүйлийг бүү хий" маягийн cleanup script-ийн
WHERE нөхцөл чангатгах шаардлагагүй** гэдгийг тодорхой дүгнэв — эдгээр
script анхнаасаа зөв хамрах хүрээтэй (blast radius) байсан.

**Засвар:** алдагдсан 2 мөрийг superuser холболтоор (cleanup script-үүдтэй
ижил зарчим) шууд нөхөн оруулав:
```sql
INSERT INTO users (id, email, "authProvider", "fullName", "isActive", "createdAt", "updatedAt")
VALUES ('26a7d6af-6562-4ff8-8c82-44b3671b4694', 'super.admin@order-system.mn', 'KEYCLOAK', 'Super Admin', true, now(), now());

INSERT INTO user_branch_roles (id, "userId", "branchId", role, "createdAt")
VALUES (gen_random_uuid(), '26a7d6af-6562-4ff8-8c82-44b3671b4694', NULL, 'SUPER_ADMIN', now());
```
Баталгаажуулалт: (1) `curl`-аар бодит `POST /auth/staff/login` →
`GET /auth/me` дуудаж `roles: [{role: "SUPER_ADMIN", branchId: null}]`
зөв ирснийг, `GET /orders`/`GET /returns`/`GET /reports/sales-summary`
бүгд бодит өгөгдөл (алдаа биш) буцааж байгааг батлав; (2) Playwright-аар
admin-web дээр бодитоор нэвтэрч (ADR 004-ийн зарчмын дагуу `page.goto()`
БИШ, SPA дотоод nav линк дараад) "Дүр: Супер админ" + Агуулах/Захиалгууд/
Буцаалтууд 3 дэлгэц бүгд "Танд хандах эрхтэй салбар алга" МЕССЕЖГҮЙгээр
ачаалж байгааг screenshot-оор баталгаажуулсан.

**Чухал систем-дизайны сул тал (олдсон, ЗАСААГҮЙ — цаашдын ажил):**
JWT-ийн `local_user_id` claim Postgres-д тохирох мөргүй болсон үед
(жиш: энэ инцидент шиг дутуу тохиргоо, эсвэл ирээдүйд ямар нэг зам
`users` мөрийг устгавал) систем **ЯМАР Ч алдаа шиддэггүй** —
`TokenVerifierService.verify()` зөвхөн JWT-ийн гарын үсэг зөв эсэхийг
шалгаад `localUserId`-г буцаадаг, дараа нь RLS-ээр хамгаалагдсан
`user_branch_roles` query зүгээр л 0 мөр буцаадаг тул `/auth/me` хоосон
`roles: []` буцааж, admin-web үүнийг "Эрх оноогдоогүй" гэсэн ЕРӨНХИЙ
(distinguish хийдэггүй) мессеж болгож харуулдаг — жинхэнэ "энэ ажилтанд
эрх өгөөгүй" гэдэгтэй ялгаагүй харагддаг тул оношлоход цаг их зарцуулдаг
(энэ инцидентэд Keycloak→Postgres→audit_logs 3 давхарга бүрийг гараар
шалгах шаардлагатай болсон). **Санал болгож буй сайжруулалт (backlog,
хэрэгжүүлээгүй):** `TokenVerifierService.verifyKeycloakToken()`
(эсвэл `RlsMiddleware`) дотор `localUserId`-аар `users` мөр байгаа
эсэхийг (superuser/app_has_global_scope шалгалтгүйгээр, зөвхөн
existence) шалгаж, байхгүй бол тодорхой `ORPHANED_IDENTITY`
(эсвэл ижил төстэй) алдааны код бүхий 401/403 шидвэл админ (болон
дэмжлэгийн баг) шууд "энэ Keycloak хэрэглэгч DB-тэй холбогдоогүй байна"
гэдгийг мэдэх боломжтой болно.
