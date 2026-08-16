# Олон салбартай захиалгын систем — CLAUDE.md

## ХЭЛНИЙ ШААРДЛАГА (ЗААВАЛ, ХЭЗЭЭ Ч БҮҮ ЗӨРЧ)
Хүн рүү чиглэсэн бүх текст — ажлын тайлан, дүгнэлт, тодруулах асуулт,
алдааны тайлбар, PR/commit-ийн дэлгэрэнгүй тайлбар — ЗААВАЛ МОНГОЛ
ХЭЛЭЭР байна. Код, хувьсагч/функцийн нэр, commit-ийн Conventional
Commits угтвар (feat:, fix: гэх мэт) англи хэвээр байж болно — энэ
бол стандарт практик, зөрчил биш. Гэхдээ АЛЬ Ч тайлан, асуулт англи
хэлээр бичигдвэл энэ дүрмийг зөрчсөн хэрэг гэдгийг өөрөө шалгаж,
дахин Монгол хэлээр бичиж өг.

## Төслийн зорилго
Салбар тус бүр админ/менежер/худалдагч эрхтэй, бүх салбарыг хариуцсан
менежер/дэлгүүрийн эзэн/супер админ эрхийн давхарга бүхий онлайн дэлгүүрийн
захиалгын систем. Бүрэн төлөвлөгөө: `docs/plan.md`.

## Стек
Node.js 22 + NestJS + Prisma + PostgreSQL (RLS) + Redis + Keycloak (staff auth)
+ custom phone-auth (customer auth) + MinIO + Meilisearch + Flutter + React.

> ⚠️ **Prisma-г 6.x дээр PIN хийсэн (7.x-рүү бүү шинэчил)** —
> `docs/adr/003-prisma-6-pin.md`-г үзнэ үү. `package.json` JSON тул
> comment бичих боломжгүй тул энд бичиж байна: Prisma 7-ийн WASM query
> compiler нь Jest/CJS build tooling-тай (dynamic import, ESM-only гарц)
> давтан зөрчилдсөн тул 6.19.x руу бууруулсан. ADR-д заасан нөхцөл
> хангагдах хүртэл `prisma`/`@prisma/client`-ийг `^7`-руу бүү өсгө.

## Гол командууд
- `docker compose -f infra/docker-compose.dev.yml up -d` — dev сервисүүд асаах
- `pnpm install` — root dependency суулгах
- `pnpm --filter api test` — backend тест
- `pnpm --filter api lint` — lint
- `cd apps/mobile && flutter run` — mobile апп ажиллуулах

## Кодын стандарт (дэлгэрэнгүй: docs/plan.md §4)
- TypeScript strict mode, ESLint+Prettier заавал
- Commit: Conventional Commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`)
- Branch: `feature/…`, `fix/…`, `chore/…`
- Шинэ хүснэгт бүрт **RLS заавал идэвхжүүлнэ** (docs/plan.md §6.1 матрицаас policy гаргана)
- Мэдээлэл өөрчилдөг endpoint бүрт audit log дуудалт заавал орно
- API алдааны бүтэц: `{ "error": { "code", "message", "details" } }`

## Хэзээ ч дараах зүйлийг бүү хий
- `.env` файлыг commit хийхгүй
- RLS-гүй шинэ хүснэгт нэмэхгүй
- Migration-ийг шууд `docker-compose.prod.yml`-ийн эсрэг ажиллуулахгүй
- Payment webhook (QPay/SocialPay) дээр signature verification алгасахгүй

## Эрх, нэвтрэлт (docs/plan.md §6.2, docs/adr/002-...)
Харилцагч → утасны дугаар + `src/auth-customer` (HS256, JWT_SECRET).
Ажилтан/эрх бүхий хэрэглэгч → и-мэйл + Keycloak (RS256, JWKS). **JWT хоёулаа
зөвхөн identity нотолно** (`sub`/`local_user_id`) — **role/branch JWT-д
ОРОХГҮЙ**, үргэлж `user_branch_roles` хүснэгтээс (RLS-ээр хамгаалагдсан)
уншина (жиш: `GET /auth/me`). Баталгаажуулалт: `RlsMiddleware` →
`TokenVerifierService` (Guard биш, middleware — учир нь ADR 001-ийн
request-scoped transaction pattern-тай нэг дор ажиллах ёстой).

## Одоогийн Phase
Phase 2 — Каталог ба агуулах (1-р ба 2-р хэсэг: схем + CRUD API +
"бэлэн/захиалгаар" override логик + нийтэд харагдах availability endpoint
дууссан, MinIO/Meilisearch/UI хараахан эхлээгүй). Дэлгэрэнгүй: `docs/plan.md` §8.

- **RLS/transaction spike (§6.3) дууссан** — `docs/adr/001-rls-transaction-pattern.md`
- **Custom customer-auth + Keycloak staff-auth дууссан** (`docs/adr/002-jwt-identity-only-authorization-from-db.md`):
  `src/auth-customer` (register/login/refresh, Redis login-throttle),
  `src/auth` (`TokenVerifierService`, `GET /auth/me`), Keycloak realm
  bootstrap (`infra/keycloak/setup-realm.sh`, idempotent)
- **Prisma 6.x руу бууруулсан** (`docs/adr/003-prisma-6-pin.md`) —
  `pnpm --filter api test` болон `test:e2e` анх удаа хоёулаа бүрэн
  ажиллаж эхлэв; `test/auth.e2e-spec.ts` нэмэгдсэн (register→me,
  RLS-гүй debug endpoint, 5→6 дахь оролдлогын throttle)
- **Суурь аудит лог дууссан** (§4.4, §7 модуль #15): `src/common/audit.decorator.ts`
  (`@Audit(tableName, { action?, recordId? })`) + `src/common/audit.interceptor.ts`
  (`APP_INTERCEPTOR`, `app.module.ts`) — зөвхөн `@Audit`-аар тэмдэглэсэн
  mutation endpoint дээр, зөвхөн амжилттай хариулт буцсаны дараа,
  `getTx()`-тэй ижил transaction дотор бичнэ. `/auth/customer/register`,
  `/auth/customer/login` дээр жишээ тавьсан (`recordId` — шинэ
  accessToken-ийн JWT `sub`-аас, verify биш зөвхөн decode).
  ⚠️ **Чухал заль:** Prisma-гийн `.create()` дотроо `INSERT...RETURNING`
  хийдэг тул audit_logs-ын `audit_select` policy-гоор харагдахгүй мөр
  (жиш: эрхгүй харилцагч өөрийн бүртгэлийн үеийн audit мөрөө REGISTER-ийн
  ДАРАА ч харах эрхгүй) RETURNING шатандаа "violates row-level security
  policy" алдаа шидэх нь бий — тиймээс `audit.interceptor.ts` RETURNING
  шаардахгүй `tx.$executeRaw` INSERT ашигладаг. **RLS-тэй хүснэгтэд
  Prisma-гийн `.create()/.update()`-ийг ирээдүйд ашиглахдаа энэ зальтай
  тулгарвал мөн адил raw INSERT/UPDATE руу шилжүүл.**
- **Ажилтны нэвтрэлт (`auth-staff`) + admin-web login дууссан**: backend
  `src/auth-staff` модуль — `POST /auth/staff/login` нь admin-web-ээс
  Keycloak руу шууд хандахгүй (client secret browser-т задрахаас
  сэргийлнэ), зөвхөн backend server-to-server Resource Owner Password
  grant-аар Keycloak дуудаж, snake_case хариуг camelCase болгоно.
  `LoginThrottleService`-ийг `src/common`-руу зөөж, namespace параметртэй
  болгож (`auth-customer` / `auth-staff`) хоёр auth модуль хооронд
  хуваалцав. `apps/admin-web`: Vite + React + TS + Tailwind v4 +
  shadcn/ui (radix-nova, өөрийн cobalt-indigo палет) + TanStack Query
  scaffold; ганц дэлгэц (router-гүй, useState conditional render) —
  LoginForm ↔ Dashboard-lite (`GET /auth/me`-ээр "Дүр" харуулна), access
  token зөвхөн in-memory React state-д (localStorage-гүй, XSS эрсдэлээс
  сэргийлэх зорилготой, session персист дараагийн Phase-д) —
  `docs/adr/004-admin-web-token-storage.md`.
- **Каталог + агуулах (Phase 2, 1-р хэсэг) дууссан**: schema.prisma-д
  `Category`/`Product`/`ProductVariant`/`InventoryItem` нэмэгдсэн (migration
  `add_catalog_inventory` + `enable_catalog_inventory_rls` — өмнөх
  `app_current_user_id()`/`app_has_global_scope()`/`app_can_manage_branch()`
  функцүүдийг л дахин ашигласан, шинэ SECURITY DEFINER функц НЭМЭЭГҮЙ).
  `src/catalog/{category,product,product-variant}` + `src/inventory` модуль.
  **`RolesGuard`/`@Roles()` эцэст нь хэрэгжсэн** (`src/common/roles.guard.ts`,
  `roles.decorator.ts` — audit.decorator.ts-тэй ижил SetMetadata+Reflector
  загвар, шинэ authorization архитектур зохиогоогүй): @Roles()-гүй бол зөвхөн
  "нэвтэрсэн эсэх", @Roles(...)-той бол `user_branch_roles`-аас (эсвэл
  authProvider=CUSTOMER_AUTH бол CUSTOMER) уншсан дүрийг тулгана. RLS
  (мөр-түвшин) хэвээр сүүлчийн хамгаалалт. InventoryItem-ийн тоо хэмжээ
  зөвхөн delta-аар (`{ increment: delta }`, DB CHECK `quantity >= 0` —
  race-safe, read-then-write биш) өөрчлөгдөнө.
  ⚠️ **Чухал заль:** `AuditInterceptor.captureBeforeData`-ийн raw SELECT
  promise-г шууд `.catch(() => null)`-оор атгах ёстой (эх файл дотор
  тайлбарласан) — эс бөгөөс handler алдаа шидэж (жиш: RLS-ээр хориглогдсон
  мөр рүү update) `concatMap`-ийн callback ер нь ажиллахгүй тохиолдолд
  captureBeforeData-ийн promise хэзээ ч уншигдахгүй, харин чинжбол алдаа
  шидвэл orphaned rejection болж, e2e тестийг санамсаргүй, буруу мөр рүү
  чиглэсэн stack trace-тэйгээр унагаадаг байсан (debug хийхэд их цаг зарцуулсан).
  ⚠️ **Prisma 6.19-ийн алдааны код гэнэтийн зан:** typed (raw биш) `.update()`
  дээр Postgres CHECK constraint зөрчигдвөл P2004 биш,
  `PrismaClientUnknownRequestError` (алдааны `message`-дээ л Postgres код
  (жиш: "23514") агуулна) шидэх нь бодит e2e тестээр батлагдсан —
  `src/common/prisma-errors.ts`-ийн `isCheckConstraintViolation()`-г үз.
- **Каталог + агуулах (Phase 2, 2-р хэсэг) дууссан**: migration
  `add_branch_geo_and_catalog_fields` — `Branch.district`/`latitude`/
  `longitude`; `Category.slug`(unique)/`description`/`displayOrder`/
  `isActive`; `Product.slug`(unique)/`brand`; `ProductVariant.sku`(unique)/
  `unit`/`basePrice`(`price`-ийн сольсон нэр, `RENAME COLUMN`-оор хийсэн —
  CHECK constraint-ийг устгаж дахин үүсгээгүй, зөвхөн нэрийг нь өөрчилсөн)/
  `costPrice`/`barcode`/`isActive`/`defaultPreOrderEnabled`/
  `defaultPreOrderLeadDays`; `InventoryItem.branchPrice`/
  `preOrderEnabledOverride`/`preOrderLeadDaysOverride` (override) +
  `lowStockThreshold`-ийн анхны утга 0→5. Одоо байгаа мөрүүдэд slug/sku
  NOT NULL UNIQUE нэмэхдээ `id`-ээр backfill хийсэн (id аль хэдийн unique
  тул давхцахгүй баталгаатай) — жинхэнэ утгыг дараа нь admin-аар засна.
  Дундын override-resolve util: `src/catalog/inventory-effective.util.ts`
  (`resolveEffectivePrice`/`resolveEffectivePreOrder`/
  `computeAvailabilityStatus`).
  ⚠️ **Чухал заль (шинэ SECURITY DEFINER функц):** "Нийтэд харагдах"
  `GET /products/:id` (CUSTOMER ч дуудна) InventoryItem-ийн бэлэн эсэхийг
  мэдэх ёстой, гэвч `inventory_items_select` RLS policy нь CUSTOMER-д
  ХЭЗЭЭ Ч SELECT зөвшөөрдөггүй (row-level, багана биш — тул зүгээр
  багана хасаж SELECT хийвэл ч 0 мөр буцна). Иймд migration
  `add_public_availability_lookup_function`-д ГАНЦ л шинэ SECURITY
  DEFINER функц (`app_inventory_snapshot_for_variant`) нэмсэн — энэ нь
  зөвхөн түүхий баганыг (quantity, override) буцаадаг "цонх" бөгөөд
  ямар ч бизнес логик (IN_STOCK/PRE_ORDER шийдвэр) агуулаагүй тул
  `computeAvailabilityStatus()`-той давхцаж бичигдээгүй — шийдвэрийг
  ProductService.findOne() дотор ГАНЦ л газар (inventory-effective.util.ts)
  гаргаж, ЗӨВХӨН `{status, leadDays}`-ийг HTTP хариунд оруулна (quantity/
  branchId бодит утга серверийн санах ойгоос цааш хэзээ ч гарахгүй).
- Дараагийн ажил: MinIO зураг байршуулах endpoint, Meilisearch индексжилт,
  admin-web/mobile-ийн каталог/агуулах UI, `DebugController`-ыг устгах/
  SUPER_ADMIN-д хязгаарлах, refresh token revocation store (хэрэгцээ
  гарвал), admin-web-ийн салбар удирдах хуудас (Branch.district/lat/lng-г
  ашиглаж газрын зураг дээр харуулах боломжтой боллоо)
