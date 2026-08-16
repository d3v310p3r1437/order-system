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

## Хөгжүүлэлтийн орчны тохиргоо

**GitHub CLI (`gh`) PATH асуудал (2026-08-16, шийдэгдсэн):** `gh.exe`
(`C:\Program Files\GitHub CLI\gh.exe`) суулгагдсан ч Windows-ийн
хэрэглэгчийн (User-level) PATH environment variable-д ороогүй байсан тул
Claude Code-ийн Bash/PowerShell орчинд `gh: command not found` алдаа
өгдөг байсан. Шийдвэрлэсэн арга (админ эрх шаардахгүй, `setx`-ийн
1024 тэмдэгтийн хязгаарлалт/PATH таслах эрсдэлгүй):
```powershell
$p = [Environment]::GetEnvironmentVariable('Path','User')
[Environment]::SetEnvironmentVariable('Path', $p + ';C:\Program Files\GitHub CLI', 'User')
```
мөн Git Bash-д шууд ажиллахын тулд `~/.bashrc`-д
`export PATH="$PATH:/c/Program Files/GitHub CLI"` мөрийг нэмсэн.

⚠️ **Чухал:** энэ өөрчлөлт зөвхөн **шинэ** процесст нөлөөлнө — аль хэдийн
нээлттэй VS Code/терминал сесс дээр АВТОМАТААР шинэчлэгдэхгүй тул PATH
өөрчлөлтийг ашиглахын тулд VS Code-оо (эсвэл терминалаа) бүрэн хааж
дахин нээх шаардлагатай.

Ирээдүйд ижил төстэй асуудал ("winget/msi-ээр суулгасан хэрэгсэл systemwide
PATH-д ороогүй ч Program Files дор бодитоор оршдог") гарвал яг ижил
аргыг (хэрэглэгчийн PATH-д Windows-ийн бодит суулгасан замыг нэмэх,
`.bashrc`-д давхардуулах) ашиглана.

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
- Payment webhook (QPay/SocialPay) payload-д шууд итгэхгүй — ЗААВАЛ идэвхтэй
  `PaymentProvider.checkPayment()`-ийг сервэр талаас дахин дуудаж баталгаажуулна
  (`docs/adr/006-qpay-verify-dont-trust.md`, "verify don't trust" зарчим —
  HMAC signature биш)

## Эрх, нэвтрэлт (docs/plan.md §6.2, docs/adr/002-...)
Харилцагч → утасны дугаар + `src/auth-customer` (HS256, JWT_SECRET).
Ажилтан/эрх бүхий хэрэглэгч → и-мэйл + Keycloak (RS256, JWKS). **JWT хоёулаа
зөвхөн identity нотолно** (`sub`/`local_user_id`) — **role/branch JWT-д
ОРОХГҮЙ**, үргэлж `user_branch_roles` хүснэгтээс (RLS-ээр хамгаалагдсан)
уншина (жиш: `GET /auth/me`). Баталгаажуулалт: `RlsMiddleware` →
`TokenVerifierService` (Guard биш, middleware — учир нь ADR 001-ийн
request-scoped transaction pattern-тай нэг дор ажиллах ёстой).

## Одоогийн Phase
Phase 3b — Бодит цаг (WebSocket), төлбөрийн абстракц (Mock+QPay stub)
дууссан; geolocation auto-routing, mobile UI хараахан үлдсэн. Дэлгэрэнгүй:
`docs/plan.md` §8.

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
  шаардахгүй `tx.$executeRaw` INSERT ашигладаг.
  ⚠️ **ЗАСВАР (Phase 3a-д илэрсэн, доор дэлгэрэнгүй):** дээрх "raw
  INSERT/UPDATE-руу шилжүүл" зөвлөмж зөвхөн **INSERT**-д хүчинтэй.
  UPDATE/DELETE-д raw SQL ч (`$executeRaw`, RETURNING-гүй ч) SELECT
  policy-г ЗАЙЛШГҮЙ шаарддаг тул RETURNING-гүй болгох аргаар үүнийг
  тойрох АРГАГҮЙ — доорх Phase 3a-ийн тэмдэглэлийг үз.
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
  InventoryItem мөр огт байхгүй тохиолдлыг `computeAvailabilityStatus()`
  өөрөө (`item: ... | null | undefined`) OUT_OF_STOCK болгож шийддэг —
  дуудагч тал (ProductService) тусад нь "0 мөр" гэж шалгахгүй, ганц
  газар л шийднэ. Хэзээ шинэ SECURITY DEFINER функц зөвтгөгдөх, хэзээ
  байгааг дахин ашиглах ёстой гэдэг зарчмыг **`docs/adr/005-security-definer-pattern.md`**-д
  дэлгэрэнгүй бичив — ирээдүйд ижил хэрэгцээ (RLS-ээр хориглогдсон
  хүснэгтээс redact хийсэн утга нийтэд харуулах) гарвал ЭНЭ ADR-ыг
  заавал уншиж, шинэ функц зохиохоос өмнө байгаа функцүүдийг эхлээд
  шалга. (Энэ бол ADR 005-ийн "READ" бүлэг — Phase 3a-д WRITE-д зориулсан
  тусдаа бүлэг нэмэгдсэн, доорх Phase 3a тэмдэглэлийг үз.)
- **Admin-web: каталог/агуулахын UI дууссан**: `react-router-dom` (protected
  route-ууд: `/login`, `/dashboard`, `/categories`, `/products`,
  `/products/:id`, `/inventory` — токенгүй бол `/login` руу redirect).
  `src/lib/auth-context.tsx` (`AuthProvider`/`useAuth`) — session (accessToken,
  ADR 004-ийн дагуу in-memory хэвээр) + `GET /auth/me`-ээс role татаж
  context-оор дамжуулна, 401 гарвал автоматаар гарна. `src/lib/roles.ts`-д
  backend-ийн `@Roles()` decorator-уудтай ЯГ ТААРСАН UX-only role
  constant-ууд (`CATEGORY_WRITE_ROLES` гэх мэт) — жинхэнэ хамгаалалт
  үргэлж backend RBAC guard + RLS, frontend талд эрх дахин тооцоолохгүй,
  зөвхөн ирсэн role-оор товч харуулж/нуудаг. `Layout` (nav + header дэх
  email/role/Гарах). Ангилал/Бүтээгдэхүүн/Variant **гурванд нь адилхан**:
  Нэмэх/Засах dialog (slug нэрнээс автомат санал болгодог ч засварлаж
  болно), **Устгах товч ЗОРИУДАА байхгүй** (variant/inventory-той foreign
  key зөрчилдөх эрсдэлтэй) — зөвхөн "Идэвхгүй болгох" `isActive` toggle.
  `/products/:id`-ийн `InventoryPanel`: `GET /branches`-ээс ирсэн (RLS-ээр
  аль хэдийн шүүгдсэн) жагсаалт 1-ээс олон бол л салбар сонгох dropdown
  харуулна; quantity ЗӨВХӨН +N/-N delta (`QuantityAdjuster` →
  `PATCH .../adjust-quantity`); branchPrice/preOrder override
  `OverrideField`-ээр (унтраасан=variant-ийн анхны утгыг өвлөнө гэдгийг UI
  дээр тод бичсэн); тооцоолсон IN_STOCK/PRE_ORDER/OUT_OF_STOCK badge
  (`AvailabilityBadge`) нь `GET /products/:id?branchId=`-ээс ирсэн
  `computeAvailabilityStatus()`-ийн үр дүнг ШУУД харуулна — frontend талд
  availability логикийг ДАХИН БИЧЭЭГҮЙ (ADR 005-ийн "ганц газар л шийднэ"
  зарчим frontend-д ч мөн хамаарна). Vitest + React Testing Library суурь
  тавьсан (`apps/admin-web/src/**/__tests__`, `vite.config.ts`-ийн `test`
  талбар), CI-д (`ci.yml`) admin-web lint/test/build алхам нэмэгдэв (өмнө
  нь admin-web CI-д огт ороогүй байсан тул шинэ тестүүд CI дээр хэзээ ч
  ажиллахгүй байх эрсдэлтэй байсан).
  ⚠️ **Шинэ бэкенд endpoint нэмэгдсэн:** admin-web-ийн салбар сонгох
  dropdown-д зориулж минимал `GET /branches` (`src/branch/`, зөвхөн уншихад
  зориулсан, CUD алга) нэмэв — branches RLS (`branches_select`,
  `20260815082257_enable_rls_policies`) аль хэдийн бэлэн байсан тул шинэ
  SECURITY DEFINER функц ШААРДААГҮЙ. Бүрэн CRUD "салбар удирдах хуудас"
  ЭНЭ даалгаварт ХАМААРАХГҮЙ, доор "Дараагийн ажил"-д хэвээр байна.
- **Захиалгын үндсэн урсгал (Phase 3a) дууссан**: `Order`/`OrderItem`
  Prisma загвар + migration (`add_orders`), RLS (`enable_orders_rls`,
  §6.1 матриц), `src/orders` модуль — `POST /orders` (checkout, зөвхөн
  CUSTOMER), `PATCH /orders/:id/status` (staff-ийн ерөнхий шилжилт +
  харилцагчийн `CREATED→CANCELLED` cancel нэг endpoint-д нэгтгэсэн, role-оор
  дүрмээ ялгана). Захиалгын state machine (`src/orders/order-state-machine.ts`,
  цэвэр функц, 100% нэгж тест): `CREATED→CONFIRMED→PREPARING→READY→COMPLETED`,
  эсвэл `CREATED/CONFIRMED→CANCELLED`. Admin-web: "Захиалгууд" (`/orders`,
  `/orders/:id`) дэлгэц (жагсаалт, шүүлт, дэлгэрэнгүй, статус товч —
  `allowedNextStatuses()` frontend-ийн UX-only хуулбар).
  ⚠️ **Чухал нээлт — ADR 001-ийн "raw INSERT/UPDATE RETURNING тойрно"
  зөвлөмжийг ЗАСВАРЛАВ:** PostgreSQL-ийн албан ёсны баримт бичигт заасны
  дагуу **UPDATE/DELETE команд RETURNING байх эсэхээс ҮЛ ХАМААРАН** зорилтот
  мөрөө тодорхойлохын тулд ХҮСНЭГТИЙН SELECT policy-г ЗААВАЛ давхар
  хангасан байхыг шаарддаг (зөвхөн **INSERT** RETURNING-гүй үед л SELECT
  policy-г бүрэн алгасдаг). Иймд CUSTOMER/SALESPERSON-ийн session-ээр
  checkout/cancel-ийн үед InventoryItem.quantity-г (customer inventory_items
  SELECT хийх эрхгүй, "нөөцийн тоо нууц") atomic decrement/increment хийхийг
  `inventory_items_update` RLS-ийг join-оор өргөтгөж шийдэх оролдлого
  БОДИТООР АЖИЛЛАХГҮЙ болохыг `EXPLAIN (ANALYZE)`-аар нотолсон (Postgres
  policy quals-ыг "(update_using) AND (select_using)" гэж AND-аар
  нэгтгэсэн байгааг шууд харсан).
  **`docs/adr/005-security-definer-pattern.md`-ийг ЭНЭ нээлтээр шинэчилж,
  анхны "зөвхөн READ+redact" хязгаарлалтын хажууд шинэ "## WRITE тохиолдол"
  бүлэг + тусдаа WRITE зөвтгөлийн шалгуур (READ-ээс илүү хатуу, учир нь
  RLS бүхэлдээ тойрогддог) нэмсэн** — зөвшөөрлийг ӨӨРӨӨ дотроо шалгаад
  бичдэг WRITE зориулалттай SECURITY DEFINER функц
  (`app_adjust_inventory_for_order`, migration
  `add_order_inventory_adjustment_function`) ашигласан. **Ирээдүйд ижил
  "унших эрхгүй ч бичих ёстой" тохиолдол гарвал шинэ SECURITY DEFINER
  функц зохиохоос ӨМНӨ энэ шинэчилсэн ADR 005-ыг БҮХЭЛД нь (READ ба WRITE
  хоёр бүлэг) заавал уншиж, өөрийн хэрэгцээ аль ангилалд багтахыг эхлээд
  тодорхойл.**
  ⚠️ **Чухал заль (SAVEPOINT):** RlsMiddleware хэдийн бүх хүсэлтийг нэг
  interactive transaction-д ороосон байдаг (ADR 001) тул OrderService
  `prisma.$transaction`-ыг дахин дуудаж чадахгүй (interactive
  `TransactionClient` дээр `$transaction` метод deny-list-д орсон тул
  байхгүй). Cart-ийн олон мөрийн decrement дундаас аль нэг нь амжилтгүй
  болоход зөвхөн checkout/status-update-ийн бичсэн зүйлсийг (Order/
  OrderItem, өмнөх амжилттай decrement/increment) буцаахын тулд raw SQL
  `SAVEPOINT`/`ROLLBACK TO SAVEPOINT` (`OrderService.withSavepoint()`)
  ашигласан — "0 мөр өөрчлөгдсөн" (жиш: InventoryItem мөр байхгүй) нь
  ЖИНХЭНЭ Postgres алдаа БИШ тул CHECK constraint зөрчил шиг транзакцыг
  автоматаар "aborted" болгодоггүй, тиймээс аль ч төрлийн алдаанд ROLLBACK
  TO SAVEPOINT-ыг ЗААВАЛ дуудах ёстойг анхаарах.
- **Бодит цаг (WebSocket) + төлбөрийн абстракц (Phase 3b, Хэсэг A+B) дууссан**:
  `src/realtime/order-events.gateway.ts` (Socket.io, namespace `/ws/orders`,
  `@socket.io/redis-adapter` — horizontal scale-д зориулсан, `main.ts`-д
  `app.useWebSocketAdapter(new IoAdapter(app))` ЗААВАЛ өмнө нь дуудахгүй бол
  gateway "server.adapter is not a function" алдаагаар унана; мөн
  `namespace: '/ws/orders'` ашигласнаар Nest `afterInit()`-д ЖИНХЭНЭ Server-ийг
  БИШ зөвхөн `Namespace`-ийг дамжуулдаг тул adapter-ыг `namespace.server`
  дээр тавих ёстой). `PATCH /orders/:id/status` амжилттай бүрт
  `order.status_changed` event нийтэлнэ, гэхдээ **шинэ `RequestContextService.onCommit()`
  механизмаар** зөвхөн `RlsMiddleware`-ийн request-scoped transaction
  (ADR 001) бодитоор COMMIT хийгдсэний ДАРАА л (энгийн `.publish()`-ээр биш) —
  эс бөгөөс DB бичилт хараахан commit хийгдээгүй байхад "худал" event
  клиент рүү очих эрсдэлтэй байсан. Room-based зарчим (RLS-ийн зарчмыг
  WS давхаргад мөн баримталсан): staff холбогдох мөчдөө `GET /branches`-тэй
  ижил RLS query-гээр өөрт харагдах салбаруудын `branch:${branchId}` room-д
  автоматаар нэгддэг, CUSTOMER `subscribe:order` event-ээр (RLS
  `orders_select`-ээр харагдвал л) `order:${orderId}` room-д нэгддэг —
  шинэ SECURITY DEFINER функц ШААРДААГҮЙ (одоо байгаа RLS-ийг дахин
  ашигласан, ADR 005-ийн "READ" зарчим). ⚠️ **Чухал заль (Redis холболт
  цэвэрлэлт):** Nest-ийн `close()` дараалал `OnModuleDestroy`-г WS
  server-ийг хаахаас (`dispose()`, Redis adapter энэ үед л unsubscribe
  хийдэг) ӨМНӨ дуудна — тул `.duplicate()`-аар нээсэн pub/sub холболтыг
  цэвэрлэхдээ `OnModuleDestroy` биш `OnApplicationShutdown` (dispose()-ийн
  ДАРАА) ашиглах ёстой, мөн `.disconnect()` (огцом) биш `.quit()` (эелдэг)
  ашиглах ёстой — эс бөгөөс "Connection is closed" unhandled rejection-оор
  процесс унадаг (e2e тестийн worker crash-аар илэрсэн).
  Payment: `src/payment/payment-provider.interface.ts` (`PaymentProvider`
  interface) + `mock-payment.provider.ts` (dev/тест, `POST /payment/mock/
  simulate-paid/:providerInvoiceId` зөвхөн NODE_ENV!=='production') +
  `qpay.provider.ts` (developer.qpay.mn Merchant V2-ийн эх сурвалжаар
  бичсэн ч КРЕДЕНШИАЛ байхгүй тул ЗӨВХӨН HTTP mock unit тестээр шалгагдсан),
  `PAYMENT_PROVIDER` env (mock|qpay, анхдагч mock) DI сонголт. `POST /orders`
  (checkout) `PaymentProvider.createInvoice()` дуудаж `payUrl` буцаана.
  ⚠️ **Чухал заль (providerInvoiceId бичилт):** `orders_update` RLS
  policy CUSTOMER-д зөвхөн CREATED→CANCELLED шилжилтэд л UPDATE зөвшөөрдөг
  тул checkout-ийн дараа тусад нь `providerInvoiceId`-г UPDATE хийх
  боломжгүй (RLS татгалзана) — үүнийг шинэ SECURITY DEFINER функцгүйгээр
  (ADR 005 зарчим: эхлээд одоо байгаа механизмаар шийд) `orderId`-г
  application код (`randomUUID()`) урьдчилж үүсгэж, `PaymentProvider.
  createInvoice()`-г Order мөр ҮҮСГЭХЭЭС ӨМНӨ дуудаж, эхний INSERT дотор
  нь `providerInvoiceId`-г шууд бичиж шийдсэн. Webhook (`POST /payment/
  webhook/:orderId`, session/auth ЗОРИУДАА байхгүй) HMAC signature-ийн
  ОРОНД **"verify don't trust"** зарчим (`docs/adr/006-qpay-verify-dont-trust.md`):
  ЗААВАЛ идэвхтэй provider-ийн `checkPayment()`-ийг сервэр талаас дахин
  дуудаж, ТҮҮНИЙ хариу PAID байх үед л шинэ `app_mark_order_paid()`
  SECURITY DEFINER функцээр (migration `add_order_mark_paid_function`,
  ADR 005 WRITE ангилал — session identity огт байхгүй тул зөвшөөрлийн
  "нотолгоо" нь `providerInvoiceId` checkout үед бид өөрсдөө бичсэн
  утгатай таарах эсэхээр хийгдэнэ, cross-order халдлагаас хамгаална)
  `Order.paidAt`-г (шинэ талбар; `qpayPaymentId`→`providerInvoiceId`
  нэрийг мөн сольсон, `RENAME COLUMN`) тавина. admin-web `/orders`
  дэлгэц WebSocket холбогдож (`src/lib/realtime.ts`, `Layout`-д залгасан)
  event ирэхэд TanStack Query cache invalidate хийдэг. Тест: unit
  (`order-events.gateway.spec.ts`, `order-events.publisher.spec.ts`,
  `mock-payment.provider.spec.ts`, `qpay.provider.spec.ts` — HTTP mock,
  `payment.service.spec.ts`) + e2e (`test/realtime.e2e-spec.ts` — бодит
  TCP порт+`socket.io-client`, `test/payment.e2e-spec.ts` — checkout→
  simulate-paid→webhook→paidAt, cross-order binding хамгаалалт).
- **Webhook idempotency + rate-limit, WebSocket auth race condition засвар
  дууссан** (`docs/adr/006`-ийн 2026-08-17 нэмэлт): судалгаа —
  Stripe/PayPal-ийн стандарт webhook practice (эх сурвалж: тэдгээрийн
  нийтэд ил баримт бичиг) ашиглав.
  ⚠️ **Чухал нээлт (WebSocket race condition):** `OrderEventsGateway`-ийн
  `OnGatewayConnection.handleConnection()` lifecycle hook (ASYNC ч
  socket.io ХҮЛЭЭДЭГГҮЙ, клиент рүү 'connect' ack шууд явчихдаг) ашиглаж
  байсан нь клиент 'connect'-ийн дараа ШУУД `subscribe:order` явуулбал
  сервэр тал `client.data` хараахан бэлэн болоогүй байхад тэр message-г
  хүлээн авах race condition-той болохыг бодит e2e тестээр (WS event
  0 удаа ирсэн) нотолсон — **`handleConnection`-ийг устгаж, оронд нь
  `afterInit()`-д бүртгэсэн socket.io-ийн намespace-level `namespace.use()`
  middleware** (async-г баталгаатай ХҮЛЭЭДЭГ, клиент 'connect'-ийг
  ЗӨВХӨН middleware бүрэн дууссаны/`next(err)`-ээр татгалзсаны ДАРАА л
  хүлээн авдаг) ашигласнаар шийдсэн. Клиент тал одоо token хүчингүй үед
  'disconnect' биш 'connect_error' хүлээн авна (илүү зөв semantics —
  холболт ер нь батлагдаагүй тул "тасарсан" гэхээсээ "батлагдаагүй" гэх
  нь илүү үнэн).
  `app_mark_order_paid()` SQL функцийг (`20260817090000_atomic_idempotent_mark_paid_function`,
  өмнөх `add_order_mark_paid_function`-ийг DROP+CREATE-ээр сольсон)
  ATOMIC IDEMPOTENT болгож, `MARKED_PAID`/`ALREADY_PAID`/`MISMATCH`
  гурван ялгаатай утга буцаадаг болгов (`branchId`/`customerId`-г
  `MARKED_PAID`-ийн үед WS event-д ашиглахын тулд хамт буцаадаг).
  `PaymentController.webhook()` эдгээрийн АЛЬ АЛЬНД нь (rate-limit-ээс
  бусад) `@HttpCode(HttpStatus.OK)`-оор ЗААВАЛ 200 буцаана (Stripe/
  PayPal: 2xx-ээс өөр код буцвал илгээгч тал автоматаар олон удаа retry
  хийдэг). Шинэ `src/payment/webhook-guard.service.ts`
  (`WebhookGuardService`): (a) IP-ээр coarse rate-limit (1 минутад 30) —
  **`LoginThrottleService`-г шинээр параметржүүлж** (`ThrottleOptions`
  — `maxAttempts`/`windowSeconds`, анхны 5/900с дуудлагуудад нөлөөгүй
  backward-compatible) дахин ашигласан, шинэ Redis логик БИЧЭЭГҮЙ;
  (b) payment_id-аар 10 секундын dedupe lock (`SET NX EX`, ЭНЭ codebase-д
  ӨМНӨ БАЙГААГҮЙ өөр төрлийн Redis primitive тул 1 мөр шинээр бичсэн) —
  `Promise.all`-аар зэрэг ирсэн давхар webhook-ийн ЗӨВХӨН НЭГ нь л
  боловсруулагдана (`test/payment.e2e-spec.ts`-ийн concurrency тестээр
  батлагдсан). Логлолт: webhook хүлээн авсан БҮРИЙГ (rate-limited/
  davhardsan ч) `Logger`-оор бичдэг, харин `audit_logs`-д ЗӨВХӨН ЖИНХЭНЭ
  `MARKED_PAID` мутацийн үед л (`PaymentService.writeAuditLog()`, шинэ
  raw INSERT — `@Audit()` decorator-ыг ЗОРИУДАА ашиглаагүй, учир нь
  controller handler-ийн АМЖИЛТТАЙ хариу БҮРТ нөхцөлгүй бичдэг тул
  rate-limited/dedupe-skip тохиолдолд ч "мутаци болсон" мэт худал мөр
  үлдээх эрсдэлтэй байсан).
  ⚠️ **`MISMATCH`-ыг "HTTP 200 = чимээгүй өнгөрнө" гэж ойлгож БОЛОХГҮЙ:**
  `MISMATCH` (checkPayment() PAID гэж баталгаажуулсан ч orderId/
  providerInvoiceId хос таарахгүй — cross-order халдлагын оролдлого
  байж болзошгүй сонор сэрэмжтэй аномали) тохиолдол бүрт
  `PaymentService` `Logger.error()`-ээр (жинхэнэ `Error` объект +
  `.stack`-тай, §10.4-ийн ирээдүйн Sentry холболтод шууд нийцтэй)
  заавал бичнэ — HTTP хариу ЗААВАЛ 200 хэвээр (Stripe/PayPal-ийн
  "webhook-д амьдаар татгалзахгүй" зарчим), гэхдээ дотооддоо алгасдаггүй.
  `app_mark_order_paid()`-г (`20260817110000_add_mismatch_diagnostics_to_mark_paid_function`)
  4 дэх багана (`actual_provider_invoice_id`) нэмж өргөтгөж, ERROR
  лог-д "webhook-ээр ирсэн vs DB-д бодитоор байгаа" зөрүүг тодорхой
  бичих боломжтой болгов. `docs/adr/006`-ийн тус хэсгийг үз.
- Дараагийн ажил: geolocation auto-routing (backlog, "should-have"),
  MinIO зураг байршуулах endpoint, Meilisearch индексжилт,
  **Mobile-ийн каталог/агуулах/захиалгын/сагс/бодит цагийн UI** (admin-web
  хийгдсэн, Flutter тал хараахан эхлээгүй), `DebugController`-ыг
  устгах/SUPER_ADMIN-д хязгаарлах, refresh token revocation store (хэрэгцээ
  гарвал), admin-web-ийн салбар удирдах хуудас (CUD, одоо зөвхөн уншихад
  зориулсан `GET /branches` байгаа), admin-web session persist (ADR 004-ийн
  "Ирээдүйн сайжруулалт" хэсэг — одоогоор F5 хийвэл дахин нэвтрэх
  шаардлагатай хэвээр), QPay бодит sandbox credential ирмэгц ADR 006-ийн
  checklist гүйцээх, webhook endpoint-д rate-limit нэмэх (backlog).
