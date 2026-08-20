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
- `cd apps/mobile && flutter pub get` — mobile dependency суулгах
- `cd apps/mobile && dart run build_runner watch --delete-conflicting-outputs`
  — freezed/riverpod_generator-ийн код автоматаар дахин үүсгэх (хөгжүүлэлтийн
  үед ажиллуулсан хэвээр байх ёстой — `AuthState`/`AuthNotifier` зэрэг
  `@freezed`/`@riverpod` annotation-той класс бүр `*.g.dart`/`*.freezed.dart`
  файл шаарддаг, эдгээр нь `.gitignore`-д орсон тул commit хийгдэхгүй, CI
  болон шинэ clone бүрд дахин үүсгэх ёстой)
- `cd apps/mobile && flutter test` — mobile тест
- `cd apps/mobile && flutter run` — mobile апп ажиллуулах (⚠️ Android
  emulator дээр backend рүү хандахдаа `localhost` БИШ `10.0.2.2` ашиглана
  — `apps/mobile/README.md`-ийг үз)

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

## Тестийн стандарт — RLS mutation policy (дэлгэрэнгүй: docs/plan.md §4.5, §9)
- **RLS mutation (INSERT/UPDATE/DELETE) policy-ийн тестийг ЗААВАЛ service
  давхаргыг тойрсон (raw SQL эсвэл шууд Prisma transaction) аргаар нэмж
  шалгах ёстой** — учир нь service давхаргын урьдчилсан SELECT/`findUnique`
  шалгалт (жиш: "энэ мөр надад харагдахгүй бол 404" гэсэн pre-check)
  policy-ийн `WITH CHECK`/`USING` кодын мөрийг бодитоор ХЭЗЭЭ Ч
  ажиллуулахгүй нуух боломжтой — HTTP-ээр дамжуулж бичсэн тест "ногоон"
  гарсан ч, энэ нь policy өөрөө зөв гэдгийг батлахгүй, зөвхөн pre-check
  зөв гэдгийг л батална. `PrismaService.runRequestTransaction(userId, tx =>
  ...)`-оор (эсвэл ижил зориулалттай туслах функцээр) service-ийг бүрэн
  тойрч, шууд raw INSERT/UPDATE оролдуулж RLS-ээр цуцлагдаж байгааг тусад
  нь баталгаажуулна (returns PR #7-ийн олдворын жишээ, commit
  `d3ff639`-ыг үз — `test/returns.e2e-spec.ts`-ийн
  `return_requests_insert RLS policy: ...` тест).
- ⚠️ **INSERT ба UPDATE/DELETE-ийн хувьд RLS татгалзах ЗАН ТӨЛӨВ ӨӨР**
  (returns PR #7-ийн 2 дахь давхар шалгалтаар нотлогдсон, `test/
  returns.e2e-spec.ts`-ийн `return_requests_update RLS policy: ...`
  тест): `INSERT`-ийн `WITH CHECK` татгалзвал Postgres бодит алдаа
  ("new row violates row-level security policy") ШИДНЭ (`.rejects.
  toThrow(/row-level security/i)`-ээр шалгана) — харин `UPDATE`/
  `DELETE`-ийн `USING` заалтад тохирохгүй мөр зүгээр л "харагдахгүй"
  (candidate болохгүй) тул команд АМЖИЛТТАЙ дуусаж, **0 мөр
  өөрчлөгдсөн** гэж чимээгүй буцаана (алдаа ОГТ шидэхгүй) — ADR 001-ийн
  "UPDATE/DELETE-ийн 0 мөр... ЖИНХЭНЭ Postgres алдаа БИШ" нээлттэй яг
  ижил зарчим. Тиймээс UPDATE/DELETE policy-г шууд SQL-ээр шалгахдаа
  `.rejects.toThrow()`-ыг БИШ, `$executeRaw`-ийн буцаах утга (affected
  rows) `0` эсэх, БОЛОН DB-ийн бодит төлөв өөрчлөгдөөгүй эсэхийг
  (өөр connection-оор дахин уншиж) шалгах ёстой.

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
Phase 2 — Каталог ба агуулах (§7 модуль #3, #4) БҮРЭН дууссан (MinIO зураг
+ Meilisearch хайлт, Phase 3c-ийн дараа буцаж гүйцээв). Phase 3c — Буцаалт
ба нөхөн төлбөр (§7 модуль #9, Phase 6-с эрт орсон) дууссан. Phase 4 —
Хүргэлт/чиглүүлэлт + мэдэгдэл (§7 модуль #8, #12) дууссан (Худалдагчийн
ажлын урсгал + Mobile UI хараахан үлдсэн). Phase 5 — Тайлан ба
олон-салбарын удирдлага (§7 модуль #14) дууссан. **Сагс (Redis persist) +
Mobile cart/branch-select UI (§7 модуль #5-ийн үлдсэн хэсэг) дууссан**
(доор дэлгэрэнгүй) — checkout (захиалга үүсгэх дуудлага) өөрөө хараахан
дараагийн ажил. Geolocation auto-routing (автоматаар хамгийн ойрхон салбар
сонгох — Phase 4-ийн хүргэлтийн чиглүүлэлттэй ОГТ ӨӨР зүйл) хараахан
backlog хэвээр. Дэлгэрэнгүй: `docs/plan.md` §8.

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
- **Буцаалт ба нөхөн төлбөр (Phase 3c) дууссан** (`docs/plan.md` §7 модуль
  #9, §8 Phase 3c — анх Phase 6-д төлөвлөгдсөн байсан ч энэ даалгаварт
  зориулж эрт орсон): `SystemSetting` (`key`/`value`, RLS: SELECT бүх
  нэвтэрсэн, UPDATE зөвхөн `app_has_global_scope()`) + `ReturnRequest`
  (`ReturnStatus`: REQUESTED/APPROVED/REJECTED/REFUNDED/REFUND_FAILED)
  Prisma загвар + migration (`add_returns_and_settings`, RLS
  `enable_returns_settings_rls` — Phase 1-ийн `app_current_user_id()`/
  `app_has_global_scope()`/`app_can_manage_branch()`-г л дахин ашигласан,
  шинэ SECURITY DEFINER функц НЭМЭЭГҮЙ). `RETURN_FEE_PERCENT` анхны утга
  (10%) migration дотор seed хийсэн тул `SystemSettingService`-д null
  fallback-ийг тусад нь шалгах шаардлагагүй (эелдэг fallback хэвээр
  үлдсэн ч). `src/returns` (`ReturnRequestService`/`Controller`),
  `src/settings` (`SystemSettingService`/`Controller`) модуль.
  ⚠️ **Чухал заль (ADR 005-ийн WRITE зарчмыг практикт нотолсон жишээ):**
  зөвшөөрөх урсгалд (`PATCH /returns/:id/approve`) нөөц буцаахдаа шинэ
  SECURITY DEFINER функц ЗОХИОГООГҮЙ — Phase 3a-ийн
  `app_adjust_inventory_for_order()`-г ШУУД дахин ашигласан, учир нь энд
  (checkout/cancel-ийн CUSTOMER/SALESPERSON-ээс ЯЛГААТАЙ нь) дуудагч
  ЗААВАЛ staff (BRANCH_ADMIN/BRANCH_MANAGER/global) байдаг тул тэр функцийн
  дотоод `app_can_manage_branch()` зөвшөөрлийн нөхцлийг shuud хангадаг —
  ADR 005-ийн "өмнө нь бичигдсэн ижил зорилготой функц байхгүй эсэхийг
  эхлээд шалга" зарчим анх удаа бодитоор "шинэ функц ЗОХИОХГҮЙ" гэсэн үр
  дүнд хүргэсэн тохиолдол. `ReturnRequest` UPDATE (approve/reject) мөн
  энгийн typed Prisma `.update()`-ээр шууд ажилладаг — учир нь
  `return_requests_update` RLS policy-ийн нөхцөл яг ижил
  `app_can_manage_branch()`-д тулгуурладаг тул staff аль хэдийн SELECT/
  UPDATE аль алиныг нь давхар хангадаг (ADR 001-ийн "UPDATE-д SELECT
  policy давхар шаардагддаг" нээлт энд асуудал үүсгээгүй).
  ⚠️ **Чухал заль (SAVEPOINT дахин ашиглалт):** Phase 3a-д
  `OrderService`-ийн private method байсан SAVEPOINT логикийг
  `src/common/savepoint.util.ts`-руу зөөж (`withSavepoint(tx, fn)`,
  давхцалгүй нэрийн тоолуур залгасан) `OrderService`-г ч мөн шинэчлэн
  дахин ашигласан — хоёр дахь service (`ReturnRequestService`) яг ижил
  "хэсэгчилсэн rollback" хэрэгцээтэй болсноор код давхардуулахаас
  сэргийлэв (CLAUDE.md-ийн "логик давхардуулахгүй" зарчим SQL функцээс
  гадна TS туслах логикт ч хамаарна).
  Зөвшөөрөх урсгал: SystemSetting-ээс шимтгэл унших → snapshot
  (`refundFeePercent`/`refundAmount`) тооцох → идэвхтэй
  `PaymentProvider.refundPayment()` дуудах → амжилттай бол `REFUNDED` + нөөц
  буцаах, амжилтгүй бол `REFUND_FAILED`. **REFUND_FAILED-ээс ЯГ ЭНЭ ижил
  `/approve` endpoint-оор дахин дуудаж "гараар дахин оролдох" боломжтой**
  (тусдаа retry endpoint зохиогоогүй) — `approve()` REQUESTED-ийн зэрэгцээ
  REFUND_FAILED-ийг ч эхлэх цэг болгож зөвшөөрдөг.
  ⚠️🔴 **Ноцтой олдвор — Playwright-аар (2 tab, admin-web дээр бодитоор
  бараг зэрэг "Зөвшөөрөх" товч дарж) илрүүлсэн санхүүгийн race condition
  (нэвтрүүлэхийн өмнө ЗААВАЛ шалгасан):** анхны хувилбарт
  `findOne() → статус шалгах → PaymentProvider.refundPayment() дуудах →
  update()` гэсэн дараалал АТОМИК БИШ байсан тул (checkout-ийн
  `createInvoice()`-тэй адилхан "SAVEPOINT-ын гадна" гэсэн зарчмыг энд
  буруу хэрэглэсэн байсан — checkout дээр давхардал боломжгүй (шинэ
  orderId бүрд шинэ invoice), харин ЭНД ижил returnRequestId рүү 2
  зэрэг хүсэлт ирж болзошгүй) зэрэг ирсэн 2 хүсэлт ХОЁУЛАА `findOne()`-оор
  REQUESTED гэж харж, ХОЁУЛАА `refundPayment()`-ийг дуудах (санхүүгийн
  ХОЁР дахин refund!) боломжтой байв. **Засвар:** `ReturnStatus` enum-ийн
  өмнө нь ашиглагдаагүй (зөвхөн "vestigial" гэж тэмдэглэсэн байсан)
  `APPROVED` утгыг атомик "claim" тэмдэг болгож ашиглав —
  `returnRequest.updateMany({where: {id, status: {in: [REQUESTED,
  REFUND_FAILED]}}, data: {status: 'APPROVED', ...}})`-г
  `PaymentProvider.refundPayment()`-ийг дуудахаас ӨМНӨ, `withSavepoint`-ийн
  ДОТОР гүйцэтгэнэ. Postgres-ийн UPDATE мөрийн lock нь БҮХЭЛ хүсэлтийн
  транзакц (RlsMiddleware, ADR 001) COMMIT хийгдэх хүртэл баригддаг тул
  зэрэг ирсэн 2 дахь хүсэлтийн claim UPDATE эхний хүсэлтийн бүхэл
  транзакц дуусах хүртэл BLOCKED хүлээгээд, дараа нь committed төлөвийг
  харж 0 мөр өөрчилнө — `refundPayment()`-ийг ХОЁР дахин дуудахаас яг
  ЭНД зогсоно (`test/returns.e2e-spec.ts`-ийн "ЗЭРЭГ (Promise.all) 2 удаа
  'Зөвшөөрөх'..." тест HTTP давхаргаас, unit тест `return-request.
  service.spec.ts`-ийн claim-ийн дуудлагын дараалал (`invocationCallOrder`)
  шалгалт mock түвшинд аль алинд нь баталгаажуулсан). **Сургамж:**
  "SAVEPOINT-ын гадна дуудна" гэсэн загварыг ШИНЭ mutation бичих бүрд
  сохроор хуулбарлахгүй, тухайн endpoint ижил нөөцийг (мөрийг) 2 удаа
  зэрэг зорьж болзошгүй эсэхийг (checkout шиг "шинэ мөр үүсгэдэг" үү,
  эсвэл approve шиг "байгаа мөр рүү зэрэг хандаж болзошгүй" юу) тусад нь
  бодож үзэх ёстой.
  ⚠️ **Чухал заль (MockPaymentProvider бодитоор ажиллах болгосон):**
  `refundPayment()` өмнө нь аргументаа огт үл тоомсорлож үргэлж амжилттай
  буцдаг байсан тул REFUND_FAILED замыг детерминистикээр (тусгай
  simulate-endpoint шаардлагагүйгээр) e2e/нэгж тестээр турших боломжгүй
  байсан — одоо зөвхөн invoice PAID төлөвт байх үед л амжилттай ажилладаг
  (QPay-тай адил бодит хязгаарлалт simulate хийсэн) болгож, тест-д
  simulate-paid дуудсан эсэхээс шалтгаалж REFUNDED/REFUND_FAILED хоёуланг
  нь детерминистикээр гаргадаг болгов.
  WebSocket: `return.status_changed` event (Phase 3b-ийн `onCommit()`
  gated pattern-ийг дахин ашигласан, шинэ room зохиогоогүй — `orderRoom`/
  `branchRoom`-г л ашигласан). Тохиргооны API: `GET/PUT
  /settings/return-fee-percent` (PUT зөвхөн `SUPER_ADMIN`/`OWNER`/
  `ALL_BRANCH_MANAGER` — `system_settings_update` RLS-тэй ЯГ тохирно,
  admin-web-ийн `RETURN_FEE_WRITE_ROLES`-той давхар нийцүүлсэн).
  Admin-web: "Буцаалтууд" (`/returns`, `/returns/:id`) дэлгэц (жагсаалт,
  дэлгэрэнгүй, Зөвшөөрөх/Татгалзах товч, REFUND_FAILED үед "Дахин оролдох"
  товч), `RejectReturnDialog`; тусдаа "Тохиргоо" route зохиогоогүй,
  Dashboard-д `ReturnFeeSettingCard`-ыг зөвхөн global-scope дүрд харуулна.
  Харилцагчийн буцаалт хүсэх (`POST /returns`) зөвхөн API/e2e түвшинд
  шалгасан (Flutter UI Phase 3c-д ороогүй, өмнөх Phase-үүдтэй ижил зарчим).
  Тест: unit (`return-refund.util.spec.ts` 100%, `return-request.
  service.spec.ts`, `system-setting.service.spec.ts`,
  `savepoint.util.spec.ts`) + e2e (`test/returns.e2e-spec.ts`, 24 тест — 7
  хоногийн цонх хэтрэлт/хэтрээгүй, давхар идэвхтэй хүсэлт татгалзагдах,
  зөвшөөрөхөд refund+restock хамт явагдах, refund амжилтгүй үед
  REFUND_FAILED, тэндээс дахин оролдоход амжилттай, RLS дүр тус бүрээр
  (мутаци policy-г service/RolesGuard-ыг тойрч шууд SQL-ээр ч), тохиргооны
  API, **ЗЭРЭГ (Promise.all) 2 удаа "Зөвшөөрөх" дуудсан race condition**).
  **Playwright-аар admin-web UI-г бодит browser-т нэвтрэрч (Keycloak-руу
  ROPC-оор биш, жинхэнэ `POST /auth/staff/login` урсгалаар) баталгаажуулав**
  (merge хийхээс өмнөх шаардлага, ad hoc `npm install playwright` —
  repo-д permanent devDependency болгож нэмээгүй): нэвтрэх → Dashboard-ийн
  шимтгэлийн карт хадгалж, БҮРЭН ШИНЭ session-ээр (`page.reload()` БИШ,
  учир нь ADR 004-ийн дагуу F5 хийвэл session бүрмөсөн арилдаг тул илүү
  хатуу шалгалт) серверээс дахин уншиж баталгаажуулсан → Буцаалтууд
  жагсаалт/дэлгэрэнгүй → 2 tab-аар БОДИТООР зэрэг "Зөвшөөрөх" дарж дээрх
  race condition-ыг олж, засварыг мөн Playwright-аар давтан баталгаажуулсан
  → Агуулах дэлгэцээр нөөц зөв (+1, биш +2) буцсаныг харсан → Татгалзах
  урсгал (хоосон шалтгаанд товч disabled). ⚠️ **Playwright-ийн UI
  дадлагаас гарсан сургамж:** admin-web-ийн WebSocket real-time sync
  маш хурдан тул хоёр дахь "ялагдсан" tab-ийн алдааны мессеж бараг шууд
  дараагийн refetch-ээр дарагдаж, "Шийдвэр гаргах" карт бүхэлдээ unmount
  хийгддэг (canDecide/canRetry аль аль нь false болсноор) — тиймээс UI
  давхаргад "аль нь алдаа заавал үзүүлэх ёстой" гэж ХАТУУ баталгаажуулах
  боломжгүй (энэ бол UX-ийн давуу тал), харин ЖИНХЭНЭ (санхүүгийн)
  баталгааг ЗААВАЛ шууд API/DB дуудлагаар (UI-аас тусад нь) шалгах ёстой.
- **Каталог + агуулах (Phase 2) БҮРЭН дууссан — MinIO зураг (Хэсэг A) +
  Meilisearch хайлт (Хэсэг B)**, Phase 3c-ийн дараа буцаж гүйцээв:
  - **Хэсэг A (MinIO):** `ProductImage` Prisma загвар + migration
    (`add_product_images`, `enable_product_images_rls`) — Category/
    Product-той ЯГ ижил RLS зарчим (SELECT бүх нэвтэрсэн хэрэглэгчид, CUD
    зөвхөн `products_insert`/`products_delete`-тэй ижил дүрүүдэд:
    SUPER_ADMIN/ALL_BRANCH_MANAGER/BRANCH_ADMIN, BRANCH_MANAGER орохгүй)
    — шинэ SECURITY DEFINER функц ШААРДААГҮЙ (ADR 005-ийн "эхлээд байгаа
    RLS зарчмаа дахин ашигла" зарчим). `src/storage/minio.service.ts`
    (`MinioService.onModuleInit()` bucket-ийг idempotent үүсгэж
    (`bucketExists`→`makeBucket`) public-read bucket policy тавина —
    даалгаврын шууд заавраар presigned URL БИШ, учир нь бүтээгдэхүүний
    зураг угаасаа нийтэд харагдах учиртай). `src/catalog/product-image`
    (`ProductImageController`/`Service`) — `POST/DELETE
    /products/:productId/images(/:id)` (`FileInterceptor('file',
    {storage: memoryStorage(), limits: {fileSize: 5MB}})`, mimetype
    whitelist jpg/png/webp). ⚠️ **Чухал нээлт:** multer-ийн
    `limits.fileSize`-аас давсан файл NestJS-ийн `transformException()`-ээр
    `PayloadTooLargeException` (413, `PAYLOAD_TOO_LARGE`) болж хувирдаг
    (interceptor түвшинд, controller/service-д ХҮРЭХГҮЙ) — тул
    `ProductImageService`-ийн өөрийн `file.size` шалгалт (400
    `FILE_TOO_LARGE`) зөвхөн interceptor-ыг тойрсон/өөр орж ирэх замд
    (жиш: service-ийг шууд unit-тестлэх) хэрэгждэг, HTTP-ийн жинхэнэ
    их файл 413-аар баригдана — e2e тест хоёуланг нь тусад нь баталгаажуулсан.
    Route param-ыг DELETE-д ЗОРИУДАА `:imageId` биш `:id` гэж нэрлэсэн —
    `AuditInterceptor.captureBeforeData()`/`extractIdField()`-ийн
    анхдагч `req.params.id`-тай санамсаргүй бус давхацуулж, custom
    `recordId()` бичих шаардлагагүй болгосон (audit.decorator.ts-ийн
    зорилготой чинь давхар нийцүүлэв). `GET /products/:id` одоо
    `images` массивыг (`displayOrder`-оор эрэмбэлсэн, `MinioService.
    getPublicUrl()`-ээр нэмсэн `url`-тэй) хариунд нэгтгэдэг —
    `ProductService.hydrateProduct()` (`findOne`/`findManyWithAvailability`
    хоёуланд нь дахин ашигласан ганц газар, логик давхардуулаагүй).
  - **Хэсэг B (Meilisearch):** `src/search` (`MeilisearchService`,
    `SearchIndexer`) — Phase 3b-ийн `OrderEventsPublisher`-тэй ЯГ ИЖИЛ
    `RequestContextService.onCommit()` gated загвар (даалгаврын шууд
    зааврын дагуу WebSocket Gateway-ийн загварыг дахин ашиглав): RLS
    transaction (ADR 001) бодитоор COMMIT хийгдсэний ДАРАА л Meilisearch
    рүү индексжинэ, `onCommit` callback дотор `.catch()`-оор алдааг
    заавал барьж лог бичдэг (RlsMiddleware-ийн callback array нь async
    reject-ийг барьдаггүй тул — эс бөгөөс unhandled rejection-оор
    процесс унах эрсдэлтэй, `search-indexer.service.spec.ts`-д тусад нь
    баталгаажуулсан). `ProductService.create/update/remove()` автоматаар
    (category нэрийг тусад нь уншиж денормалчилж) индекс шинэчилдэг/
    устгадаг. `GET /catalog/search?q=&categoryId=&branchId=`
    (`src/catalog/search`) — @Roles()-гүй, ProductController.findOne-тэй
    ЯГ ижил зарчим ("бүх нэвтэрсэн дүрд", учир нь `products_select` RLS
    policy `app_current_user_id() IS NOT NULL` шаарддаг тул интернэтэд
    БҮРЭН анонимаар нээлттэй болгох нь одоо байгаа бүх каталогийн RLS-ийн
    урьдал нөхцлийг өөрчлөх том архитектурын шийдвэр — тиймээс энэ
    даалгаврын хүрээнд "public" гэдгийг зориудаар "ямар ч @Roles()
    шаардахгүй" гэж уламжлалт утгаар нь ойлгосон). `isActive=true` filter
    үргэлж хэрэгждэг (идэвхгүй бүтээгдэхүүн хайлтад хэзээ ч гарахгүй).
    ⚠️ **Чухал нээлт (e2e тестээр илэрсэн):** Meilisearch-ийн анхдагч
    `matchingStrategy: 'last'` нь query-ийн СҮҮЛИЙН үгсийг "хаяж" илүү
    олон (сул холбогдолтой, өөр бүтээгдэхүүнтэй ч давхцаж болзошгүй)
    үр дүн буцаадаг нь e2e тестийн санамсаргүй "давхцал" (өөр тестийн
    өгөгдөл холилдох) байдлаар нээгдсэн — `MeilisearchService.search()`-д
    `matchingStrategy: 'all'`-г ЗААВАЛ тавьж (бүх query үг тохирохыг
    шаардана) илүү тодорхой/урьдчилан таамаглаж болохуйц хайлтын үр
    дүнтэй болгосон. `POST /catalog/search/reindex` (SUPER_ADMIN,
    `@Audit` шаардлагагүй — DB мутаци биш, зөвхөн унших+Meilisearch руу
    бичих).
  - **CI:** `.github/workflows/ci.yml`-д MinIO (`docker run`-аар,
    Keycloak-той ижил шалтгаанаар — GH Actions-ийн job-level `services:`
    нь `command:` дэмждэггүй тул "server /data" аргумент дамжуулах
    боломжгүй) БОЛОН Meilisearch (`services:`-ээр шууд, анхдагч CMD
    аргумент шаардахгүй тул) нэмэгдэв, `MINIO_*`/`MEILI_*` env бүгд
    нэмэгдсэн, e2e-ийн өмнө хоёуланг нь `curl`-аар бэлэн болохыг хүлээдэг.
    ⚠️ **Чухал заль (pnpm strict node_modules):** `product-image.
    controller.ts` `multer`-ээс шууд `import { memoryStorage }` хийдэг ч
    зөвхөн `@types/multer` devDependency-д нэмсэн байсан — `multer`
    өөрөө `@nestjs/platform-express`-ийн transitive dependency тул dev/
    test-д (ts-jest-ийн module resolution-оор) санамсаргүй ажилласан ч
    prod build-ийн `dist/src/main.js`-г шууд `node`-оор ажиллуулахад
    (§10.2-ийн "Build дараах smoke test" CI алхам) pnpm-ийн strict
    node_modules-ээр `Cannot find module 'multer'` (MODULE_NOT_FOUND)
    болж унасан — GH Actions дээр л (локал `pnpm run build` + unit/e2e
    бүгд ажилладаг байсан тул анзаарагдаагүй) илэрсэн. Сургамж: гуравдагч
    сангаас ШУУД `import` хийдэг бол, тэр нь зөвхөн өөр dependency-ийн
    transitive dep байсан ч, `@types/*`-ийн хажууд бодит package-ийг ч
    ЗААВАЛ шууд `dependencies`-д нэмэх ёстой.
  - ⚠️ **Чухал заль (e2e тогтвортой байдал):** `apps/api/package.json`-ийн
    `test:e2e`-д `--runInBand` нэмсэн (spec файлуудыг цуврал ажиллуулна)
    — N Nest app instance зэрэг Postgres/Keycloak руу холбогдоход
    нөөцийн (connection pool) хомсдол үүсч `checkoutAndComplete`-ийн
    зарим PATCH санамсаргүй 400/404 буцаадаг байсныг GH Actions CI дээр
    бодитоор ажиглаж (локал дээр ч давтагдав) шийдэв. Нэмэлтээр
    `test/auth-staff.e2e-spec.ts`/`test/catalog-inventory.e2e-spec.ts`-ийн
    audit_logs шалгалт хоёул `waitFor()`-гүйгээр шууд `findFirst()`
    дуудаж байсан нь `--runInBand`-аар ч арилаагүй ганц race байсан
    (RlsMiddleware-ийн transaction COMMIT HTTP хариунаас бага зэрэг хойш
    явагддаг тул) — `test/returns.e2e-spec.ts`-д Phase 3c-д аль хэдийн
    нэвтрүүлсэн ЯГ ижил `waitFor()` idiom-ыг хоёуланд нь нэмж зассан.
  - **Admin-web:** `src/components/ProductImageGallery.tsx` (drag-drop
    БОЛОН file picker хоёулаа — товшиж эсвэл чирж оруулж болно, gallery
    grid, hover дээр гарч ирэх "Устгах" товч) `/products/:id`-д
    нэмэгдэв. `src/pages/ProductsPage.tsx`-д debounce-той (300мс,
    `src/lib/use-debounced-value.ts`) хайлтын талбар нэмэгдэж, хоосон
    үед энгийн `GET /products`, бичихэд `GET /catalog/search` рүү
    шилждэг. `src/lib/roles.ts`-д `PRODUCT_IMAGE_WRITE_ROLES`
    (`PRODUCT_CREATE_ROLES`-тэй ижил) нэмэгдэв. Vitest+RTL smoke тест
    (`ProductImageGallery.test.tsx`, `ProductsPage.test.tsx`).
    **Playwright-аар (ad hoc, Phase 3c-ийн адил, repo-д devDependency
    болгож нэмээгүй) бодит browser-т бүрэн урсгал баталгаажуулав:**
    нэвтрэх → ангилал/бүтээгдэхүүн үүсгэх → зураг upload (жинхэнэ PNG
    файл) → gallery-д харагдав, MinIO-ээс public URL (auth-гүй, 200 OK)
    зөв ирсэн → Устгах товч дарж gallery-ээс алга болов → хайлтын
    талбараар тухайн бүтээгдэхүүнээ олов; console алдаа 0.
    ⚠️ **Энэ дадлагаас олдсон, каталогтой шууд хамааралгүй ч чухал 2
    орчны засвар:** (1) `apps/admin-web/.env`-ийн `VITE_API_URL` энэ
    хөгжүүлэлтийн машин дээр байнга ажиллаж байсан backend-ийн бодит
    порттой (`3001`, учир нь `3000` порт өөр төслийн docker container-т
    аль хэдийн эзэмшигдсэн байсан) таарахгүй хуучирсан (`3000`) утгатай
    байсан — ЗАСАВ. (2) admin-web-ийн dev server нь vite-ийн анхдагч
    `5173`-аас өөр (`5174`) порт дээр гарч ирсэн байсан бол
    `main.ts`-ийн CORS `origin: 'http://localhost:5173'` хатуу заасан
    утгатай ХЭЗЭЭ Ч таарахгүй тул бүх хүсэлт чимээгүй block хийгддэг —
    vite-г ЗОРИУДАА `--port 5173 --strictPort`-ээр дахин асаав (код
    дотор ямар ч өөрчлөлт хийгээгүй, зөвхөн локал dev орчны тохиргоо).
    Playwright баталгаажуулалтад зориулж түр Keycloak тестийн
    хэрэглэгч (`playwright-verify@order-system.mn`, SUPER_ADMIN)
    үүсгэсэн — dev DB/Keycloak-д үлдсэн, устгах шаардлагагүй (бусад e2e
    тестийн өгөгдөлтэй адил зөвхөн dev орчны debris).
  - ⚠️ **Олдож, ЗАСАГДСАН — ЭНЭ ажилтай шууд холбоогүй, өмнөх Phase-аас
    өвлөгдсөн 2 CI-г улаан гаргаж байсан асуудал** (`multer` dependency
    + e2e `--runInBand`/`waitFor` race) — дэлгэрэнгүй тайлбарыг дээрх
    "CI" бүлгээс үз. `gh run watch`-аар PR #8 (`feature/
    catalog-images-search` → `main`) дээр CI бүрэн ногоон болсныг
    баталгаажуулсан.
- **Хүргэлт/чиглүүлэлт + мэдэгдэл (Phase 4) дууссан** (`docs/plan.md` §7
  модуль #8 "Хүргэлт ба хүлээлгэн өгөлт", #12 "Мэдэгдэл", §8 Phase 4):
  - **Хэсэг A (хүргэлт/чиглүүлэлт):** migration `add_order_delivery_fields`
    — `Order.deliveryMethod` (`OrderDeliveryMethod` enum: PICKUP/DELIVERY,
    `@default(PICKUP)`) + `deliveryAddress`/`deliveryLatitude`/
    `deliveryLongitude` (DELIVERY-д заавал, PICKUP-д ХОРИОТОЙ). RLS
    policy өөрчлөлт шаардлагагүй (мөр-түвшний, багана нэмэхэд
    нөлөөлдөггүй — Phase 2-ийн `add_branch_geo_and_catalog_fields`-тэй
    адил урьдал жишээ). ⚠️ **Чухал заль (DTO validation):**
    `deliveryAddress`/`Latitude`/`Longitude`-ийн "DELIVERY-д заавал, PICKUP-д
    хориотой" хос чиглэлийн шаардлагыг class-validator-ийн `@ValidateIf`-ыг
    НЭГ property дээр ХЭД ХЭДЭН удаа давхар зарлахаас ЗОРИУДАА зайлсхийж
    (AND/OR аль аргаар нэгддэгийг эх сурвалжаас тодорхой батлах
    боломжгүй байсан тул, input validation аюулгүй байдлын критик хэсэг
    учир таамаглалаар бичээгүй), `registerDecorator`-т суурилсан ганц
    custom validator (`IsDeliveryField`, `checkout-order.dto.ts`) ашиглаж
    хоёр чиглэлийг НЭГ функц дотор ХАМТ шалгасан. ⚠️ **Чухал заль
    (backward compatibility):** `deliveryMethod`-ийг `@IsOptional()`
    болгож, DTO/service түвшинд өгөгдөөгүй бол PICKUP гэж үзсэн (Prisma
    schema-ийн `@default(PICKUP)`-тай нийцүүлсэн) — учир нь өмнөх бүх
    Phase-ийн checkout е2е тест (`test/orders.e2e-spec.ts`,
    `test/payment.e2e-spec.ts` гэх мэт) энэ талбарыг ОГТ илгээдэггүй байсныг
    заавал шаардах маягаар өөрчилбөл бүгд 400 болж эвдэрнэ байсан.
    `RoutingProvider` абстракц (`src/routing/`, `PaymentProvider`-тэй ЯГ
    ижил `ROUTING_PROVIDER` DI сонголтын загвар): `MockRoutingProvider`
    (Haversine томъёо, `haversine.util.ts`, анхдагч dev/CI) +
    `OsrmRoutingProvider` (router.project-osrm.org public demo сервер,
    зөвхөн HTTP mock unit тестээр шалгагдсан — `docs/adr/007-osm-osrm-routing.md`,
    Google Maps Directions API-тай зардлын харьцуулалт + ирээдүйд өөрийн
    OSRM container руу шилжих төлөвлөгөө). `geometry`-ийн координатын
    дараалал ЗОРИУДАА `[lng, lat]` (OSRM/GeoJSON стандарт) — Leaflet-ийн
    `[lat, lng]`-тэй ЯЛГААТАЙ, admin-web-д хөрвүүлдэг. `GET /orders/:id/route`
    (staff-only, PICKUP захиалгад 400 NOT_DELIVERY_ORDER, салбарын
    latitude/longitude бүртгэгдээгүй бол 400 BRANCH_LOCATION_MISSING).
    ⚠️ **(2026-08-19 нэмэлт засвар) Кэшлэлт:** анхны хувилбарт `getRoute()`
    дуудлага БҮРД `RoutingProvider.getRoute()`-ийг ШУУД дуудаж байсан
    нь `OsrmRoutingProvider`-ийн хувьд public demo сервер рүү давхардуулж
    HTTP хүсэлт явуулна гэсэн үг байсан (§"Одоогийн public demo
    server-ийн хязгаарлалт", `docs/adr/007`, fair-use) — үр дүнг
    `Order.routeDistanceMeters`/`routeDurationSeconds`/`routeGeometry`
    (migration `add_order_route_cache`, nullable, jsonb geometry) талбар
    дээр бичиж кэшилдэг болгов: эхний дуудлагад л provider дуудагдаж
    Order мөрөнд бичигдэнэ (`orders_update` RLS staff-ийн бусад бичилттэй
    адил, шинэ SECURITY DEFINER функц шаардлагагүй — UPDATE-д SELECT
    policy давхар шаардагддаг ч staff аль хэдийн orders_select-ийг
    хангадаг), дараагийн дуудлага бүрд ЗӨВХӨН тэр кэшийг л буцаана
    (provider ОГТ дуудагдахгүй). Кэш `@Audit()`-гүй ЗОРИУДАА (GET
    endpoint дотрох UPDATE ч, энэ бол хэрэглэгчийн санаатай бизнес
    үйлдэл БИШ, зөвхөн тооцоолсон утгын дериватив кэш — `POST
    /catalog/search/reindex`-ийн "DB мутаци биш тул audit шаардлагагүй"
    зарчимтай ТӨСТЭЙ ч эсрэг чиглэлээс: энд мутаци бий, гэхдээ audit
    log-ийн зорилго "хэн юуг санаатайгаар өөрчилсөн бэ" гэдэгт нийцэхгүй
    тул хассан). deliveryLatitude/Longitude/branchId одоогоор ЗАСВАРЛАХ
    endpoint байхгүй тул кэш хугацаагүй хүчинтэй — ирээдүйд ийм засварлах
    боломж нэмэгдвэл яг тэр update-ийн дотор энэ 3 талбарыг NULL болгож
    (invalidate) дахин тооцоологдохоор хийх ёстойг `order.service.ts`/
    `schema.prisma`-д тэмдэглэсэн. `test/delivery-routing.e2e-spec.ts`-д
    `jest.spyOn(routingProvider, 'getRoute')`-оор ижил orderId-аар 2 удаа
    дуудахад provider ЗӨВХӨН 1 удаа дуудагдсаныг батлав, мөн
    `order.service.spec.ts`-д cache-hit/cache-miss хоёр замыг mock
    prisma-аар тусад нь баталгаажуулсан.
    Admin-web: `DeliveryRouteMap.tsx` (`react-leaflet` + OSM tile, Leaflet-ийн
    анхдагч marker icon зам Vite bundler-тай зөв ажилладаггүй тул зургийг
    шууд import хийж дахин тохируулсан) — Order дэлгэрэнгүй дэлгэц дээр
    (зөвхөн DELIVERY захиалганд, `ORDER_STATUS_UPDATE_ROLES`-тэй ижил
    role шүүлттэй) 2 marker (салбар — `route.geometry[0]`-ээс уусан,
    тусад нь `GET /branches` дуудаагүй; хүргэлтийн цэг — `order.deliveryLatitude/
    Longitude`) + route polyline зурна. **Checkout координат сонгогч UI
    (харилцагчийн тал) admin-web-д ЗОРИУДАА ОРООГҮЙ** — admin-web-д
    захиалга ҮҮСГЭХ дэлгэц угаасаа байхгүй (checkout зөвхөн
    `@Roles('CUSTOMER')`), харилцагчийн UI үргэлж Mobile-ийн хамрах
    хүрээ байсан (Phase 3a-с хойших тогтсон зарчим) тул энд ч мөн
    баримталсан.
  - **Хэсэг B (мэдэгдэл):** `NotificationProvider` абстракц
    (`src/notification/`, `sendSms`/`sendEmail`, `PaymentProvider`-тэй ижил
    загвар) — `MockNotificationProvider` (Logger-оор л бичдэг, dev/CI
    анхдагч) + `SmtpNotificationProvider` (**Email БОДИТООР**, `nodemailer`
    + `SMTP_HOST`/`PORT` env, dev/CI-д Mailpit; `sendSms()` нь ЗОРИУДАА
    стаб — `docs/plan.md` Phase 1-ийн "SMS gateway vendor үнэлгээ" зүйл
    (`SmsProvider` абстракц) БОДИТООР хийгдээгүй байсныг (checklist
    `[ ]` хэвээр байсныг) ЭНЭ Phase-д нээж, "Phase 1-д аль хэдийн бэлдсэн"
    гэсэн даалгаврын анхны таамаглал буруу байсныг тэмдэглэв — тусдаа
    `SmsProvider` interface зохиогоогүй, `NotificationProvider.sendSms()`-ийн
    дотоод хэрэгжилтийг сольж (bодит vendor сонгогдоход) хангах боломжтой,
    нэмэлт давхар абстракц шаардлагагүй гэж үзсэн). `infra/docker-compose.dev.yml`/CI-д
    `mailpit` (`axllent/mailpit`, порт 1025 SMTP/8025 web UI) service
    нэмэгдэв. `NotificationTrigger` (`src/notification/notification-trigger.service.ts`)
    — `SearchIndexer`-тэй ЯГ ИЖИЛ `RequestContextService.onCommit()`-гэйт
    загвар, захиалгын CONFIRMED/READY/COMPLETED + буцаалтын APPROVED/
    REJECTED статуст л илгээнэ (`order-notification.util.ts`-ийн pure
    message builder функцууд). ⚠️ **Чухал загварын шийдвэр:** `onCommit()`
    callback нь RLS transaction COMMIT хийгдсэний ДАРАА ажилладаг тул тэр
    үед `tx` ХҮЧИНГҮЙ болдог (docs/adr/001) — иймд харилцагчийн
    `phone`/`email`-г onCommit бүртгэхээс ӨМНӨ, tx хараахан нээлттэй байхад
    л уншсан (зөвхөн бодит sms/email сүлжээний дуудлагыг onCommit-оор
    хойшлуулсан), энэ шалтгаанаас `notifyOrderStatusChanged()`/
    `notifyReturnStatusChanged()` нь `OrderEventsPublisher`-ийн sync
    аргуудаас ЯЛГААТАЙ ASYNC (дуудагч `OrderService.updateStatus()`/
    `ReturnRequestService.approve()`/`reject()` ЗААВАЛ `await` хийдэг).
    ⚠️ **Мэдэгдэж буй, баримтжуулсан хязгаарлалт:** `User.email` нь зөвхөн
    ажилтан/Keycloak хэрэглэгчид зориулагдсан (`auth-customer/dto/
    register.dto.ts` зөвхөн `phone` цуглуулдаг) тул CUSTOMER-ийн email
    бараг үргэлж NULL — энэ урсгалын email тал практикт ихэвчлэн
    алгасагдана (санаатай, алдаа биш; `dispatch()`-ийн нөхцөлт шалгалт
    үүнийг зөв барина).
  - Тест: unit (`haversine.util.spec.ts`, `mock-routing.provider.spec.ts`,
    `osrm-routing.provider.spec.ts` — HTTP mock, `order-notification.util.spec.ts`,
    `mock-notification.provider.spec.ts`, `smtp-notification.provider.spec.ts`
    — nodemailer transport mock, `notification-trigger.service.spec.ts` —
    tx-ийн дараа хандахгүй эсэхийг mock prisma-аар баталгаажуулсан) + e2e
    (`test/delivery-routing.e2e-spec.ts` — checkout DTO validation хоёр
    чиглэл, `GET /orders/:id/route` staff-only/PICKUP-д 400/branch
    байршилгүйд 400, `test/notification.e2e-spec.ts` — `SmtpNotificationProvider`-ийг
    ШУУД instantiate хийж, **Mailpit-руу бодит SMTP-ээр илгээгээд, Mailpit-ийн
    REST API-аар (`GET /api/v1/messages`) бодитоор ирснийг баталгаажуулсан**
    — бүхэл order-урсгалаар БИШ, учир нь CUSTOMER.email ихэвчлэн NULL байдаг
    тул trigger-ийн WIRING логикийг зөвхөн unit түвшинд mock provider-оор
    шалгасан, бодит Mailpit round-trip-ийг provider-ийн ганц давхаргад
    тусад нь баталгаажуулсан).
  - **Playwright-аар (ad hoc, өмнөх Phase-үүдийн адил, repo-д devDependency
    болгож нэмээгүй) admin-web-ийн Хүргэлтийн газрын зургийг бодит
    browser-т баталгаажуулав:** нэвтрэх → Захиалгууд → тохирох салбар
    сонгох (§Playwright сургамж доор) → DELIVERY захиалгын дэлгэрэнгүй →
    "Хүргэлт" карт (хаяг, зай/ETA текст, 2 marker + route шугам) харагдав,
    console алдаа 0. ⚠️ **Playwright дадлагаас гарсан 2 сургамж:**
    (1) Keycloak-ийн User Profile-д (`setup-realm.sh`-ээс) `firstName`/
    `lastName` REQUIRED тул `POST /admin/realms/.../users`-ээр шинэ staff
    хэрэглэгч үүсгэхдээ эдгээрийг ОРХИВОЛ ROPC grant "Account is not fully
    set up" (400 `invalid_grant`) алдаа өгдөг (`requiredActions`-той ямар
    ч хамаагүй) — заавал бөглөх ёстой. (2) ADR 004-ийн "access token
    зөвхөн in-memory" зарчмаас шалтгаалан `page.goto()`-оор ШУУД
    `/orders/:id` рүү орох нь F5-тэй адил session-ийг арилгадаг тул
    Playwright script-д SPA-ийн дотоод навигаци (товч дарах) ашиглах
    ёстой — мөн Захиалгын жагсаалт анхдагчаар эхний (алфавит бус,
    буцаах эрэмбийн эхний) салбарыг сонгодог тул шинэ салбарт үүссэн
    захиалгыг харахын тулд салбар dropdown-оос тодорхой сонгох
    шаардлагатай.
- **Тайлан ба олон-салбарын удирдлага (Phase 5) дууссан** (`docs/plan.md`
  §7 модуль #14, §8 Phase 5): `src/reports` (`ReportController`/
  `ReportService`) — `GET /reports/{sales-summary,top-products,
  revenue-trend,branch-comparison,sales-summary/export}`. Шинэ RLS
  policy/SECURITY DEFINER функц НЭМЭЭГҮЙ (ADR 005 "эхлээд байгаа RLS
  зарчмаа дахин ашигла" — Order/OrderItem/ReturnRequest/Branch-ийн одоо
  байгаа RLS `tx.order.aggregate()`/`tx.orderItem.findMany()`/
  `tx.$queryRaw()` шинэ query дээр ч автоматаар "өөрийн салбар"/"бүх"
  гэсэн хамрах хүрээгээр шүүнэ — `RlsMiddleware`-ийн нэг transaction
  session-д `$queryRaw` ч мөн хамрагддагийг ADR 001-ээс баталгаажуулж
  ашигласан). §6.1 матрицын "Тайлан/аналитик" мөрийг `REPORT_VIEW_ROLES`
  (SUPER_ADMIN/OWNER/ALL_BRANCH_MANAGER/BRANCH_ADMIN/BRANCH_MANAGER,
  SALESPERSON/CUSTOMER "—" тул ороогүй) болон `branch-comparison`-ийн
  зөвхөн "R (бүх)" гурван дүрд (`BRANCH_COMPARISON_ROLES`) хязгаарласан
  `@Roles()`-оор код болгов. Export нь гуравдагч сангаас (exceljs гэх
  мэт) ХАМААРАЛГҮЙ гараар бичсэн CSV serializer (`report-csv.util.ts`,
  UTF-8 BOM — Windows Excel-д Cyrillic зөв харагдана).
  ⚠️ **Чухал сургамж (shared dev DB давхардал, e2e тест бичихэд
  анхаарах):** энэ dev Postgres бусад e2e spec файлуудтай ХУВААЛЦСАН тул
  branchId-гүй (global) aggregate query бусад spec-ийн COMPLETED
  захиалгыг ч санамсаргүй хамруулж болзошгүй — анх "SUPER_ADMIN бүх
  салбарын нийлбэрийг харна" гэсэн тест яг тэгш дүнтэй (жиш: "40000.00")
  таарахгүй байснаар илэрсэн. Засвар: тухайн тестийг эсвэл (a) тодорхой
  branchId-аар шүүх (revenue-trend), эсвэл (b) `toBeGreaterThanOrEqual`-ээр
  "багадаа мэдэгдэж буй хувь нэмэр орсон" гэдгийг шалгах хэлбэрт
  шилжүүлсэн (sales-summary). Ирээдүйд global (branchId-гүй) aggregate
  report тест бичихдээ энэ зарчмыг баримтал.
  Admin-web: `/reports` дэлгэц (`ReportsPage.tsx` — огнооны хүрээ, (1-ээс
  олон салбартай бол) салбар filter, KPI карт 4ш, `recharts`-аар
  (шинээр нэмсэн dependency) орлогын хандлагын chart (`index.css`-ийн
  аль хэдийн бэлэн `--color-chart-1..5` палет ашигласан, шинэ өнгөний
  систем зохиогоогүй), "Их зарагдсан бүтээгдэхүүн" хүснэгт, (зөвхөн
  global scope дүрд) "Салбаруудын харьцуулалт" хүснэгт, CSV татах товч
  (Blob + programmatic `<a download>` click — ADR 004-ийн "access token
  зөвхөн in-memory" зарчимтай нийцүүлж `fetch()`-ээр Authorization header
  дамжуулсан, статик `<a href>` биш). `Layout.tsx`-ийн нэвтрэлтийн цэс
  "Тайлан"-г зөвхөн `REPORT_VIEW_ROLES`-той дүрд харуулна (бусад мөрөнд
  байдаг "RLS-ээр хэсэгчилсэн харагдана" загвараас ЯЛГААТАЙ — эндхийн
  SALESPERSON/CUSTOMER endpoint бүрт БҮРЭН 403 авдаг тул 403-той хоосон
  хуудас руу шилжихийн оронд цэснээс нуусан, `NAV_ITEMS`-д нэмэлт
  сонголтот `roles` талбар нэмэв). Dashboard-д (`DashboardKpiCards.tsx`)
  өнөөдрийн орлого/захиалгын тоо + сүүлийн 7 хоногийн захиалгын тоо —
  шинэ backend endpoint шаардалгүй, `getSalesSummary()`-г л 2 өөр
  огнооны хүрээгээр (`from=to=өнөөдөр`, `from=6 хоногийн өмнө`) дахин
  ашигласан.
  Тест: unit (`report.service.spec.ts`, `report-csv.util.spec.ts` —
  RFC 4180 escape) + e2e (`test/reports.e2e-spec.ts`, 14 тест) +
  admin-web smoke тест (`ReportsPage.test.tsx`, `DashboardKpiCards.test.tsx`).
  **Playwright-аар (ad hoc, өмнөх Phase-үүдийн адил, repo-д
  devDependency болгож нэмээгүй) бодит browser-т баталгаажуулав:**
  нэвтрэх → Тайлан → KPI карт/chart/хүснэгтүүд зөв харагдав (console
  алдаа 0, шинэ Keycloak+DB staff хэрэглэгч `reports-verify@order-system.mn`
  (SUPER_ADMIN) үүсгэж ашигласан — dev DB/Keycloak-д өмнөх Phase-үүдийн
  адил үлдсэн, устгах шаардлагагүй) → CSV татах товч дарж жинхэнэ файл
  татаж, BOM+толгой мөр зөв байгааг баталгаажуулсан.
  ⚠️ **Keycloak admin API-ийн PUT /users/:id бол ФУЛЛ REPLACE, PATCH
  БИШ:** зөвхөн `attributes` талбартай PUT хүсэлт илгээхэд `email`/
  `firstName`/`lastName` мэдэгдэлгүйгээр ХООСРООД "Account is not fully
  set up" алдаа гаргасан (дээрх Phase 4-ийн "firstName/lastName заавал"
  сургамжтай төстэй ч ӨӨР шалтгаантай — тэнд бүр анхнаасаа дутуу байсан
  бол энд ХЭДИЙНЭЭ байсан утга PUT-аар устгагдсан) — ижил төстэй admin
  API дуудлага хийхдээ ЗААВАЛ бүрэн representation-оо (эсвэл дор хаяж
  бүх заавал талбарыг) дахин дамжуулах ёстойг тэмдэглэв.
- **(2026-08-19) ноцтой засвар — CI-ийн "flaky" гэж андуурагдаж байсан
  `orders.e2e-spec.ts`/`returns.e2e-spec.ts`/`reports.e2e-spec.ts`/
  `catalog-inventory.e2e-spec.ts`/`realtime.e2e-spec.ts`-ийн давтан
  404/400 (PR #8, #10, #12) бодит бүтцийн race байсныг олж засав**:
  `RlsMiddleware` (`src/common/rls.middleware.ts`) нь HTTP хариуг
  `res.on('finish')` (хариу АЛЬ ХЭДИЙН клиент рүү явсны ДАРАА гардаг
  event) хүлээгээд ЗӨВХӨН дараа нь Prisma-ийн `$transaction()`-ыг
  буцаадаг байсан тул **DB `COMMIT` ЗААВАЛ HTTP хариунаас ХОЙШ** болдог
  байв — санамсаргүй "заримдаа" биш, кодын бүтцээр 100% детерминистик
  дараалал. Клиент (тест/mobile апп) хариу хүлээн авангуутаа шууд
  дараагийн хүсэлт (жиш: checkout → шууд `PATCH .../status`) илгээвэл,
  анхны бичилт хараахан commit хийгдээгүй байхад л (race) 404
  (`ORDER_NOT_FOUND`)/400 (`INVALID_ORDER_STATUS_TRANSITION`, өмнөх
  шатны бичилт харагдаагүйгээс) гардаг байсан — ердийн үед сервэрийн
  дотоод commit хугацаа клиентийн дараагийн хүсэлт илгээх хугацаанаас
  богино тул анзаарагдаагүй ч, CI-ийн (Docker, contention ихтэй shared
  runner) орчинд энэ зай нарийсаж/сөрөгждөг байв. **Локал 1000 удаагийн
  "checkout → шууд PATCH" reproduce script-ээр (jest биш, шууд Node)
  1/1000 удаа яг ижил алдааг детерминист бусаар боловч бодитоор
  reproduce хийж баталгаажуулсан.** Засвар: `res.on('finish')`-ийг
  хүлээхийн оронд `res.end()`-ийг өөрийг нь monkey-patch хийж, controller
  `res.end()` дуудсан МӨЧИД (биш "явуулсан" мөчид) транзакцыг чөлөөлж
  (→ COMMIT эхэлнэ), харин ЖИНХЭНЭ хариуг зөвхөн COMMIT/ROLLBACK бүрэн
  дуусаж СҮҮЛД л клиент рүү явуулна. Дэлгэрэнгүй (кодын жишээ, reproduce
  script-ийн байршил/арга): `docs/adr/001-rls-transaction-pattern.md`-ийн
  "2026-08-19 нэмэлт" хэсэг. Тест: `src/common/rls.middleware.spec.ts`
  (регресс болгож дахин оруулахаас сэргийлнэ), засварын дараа локал e2e
  бүрэн suite 13/13 (119/119 тест) болон reproduce script 1000/1000
  амжилттай. ⚠️ **Энэ засвар `RlsMiddleware` ашигладаг АПП ДАЯАРХ БҮХ
  endpoint дээр нөлөөлдөг** (зөвхөн orders/returns биш) — "мутаци хийсний
  дараа шууд түүнийг харах/өөрчлөх дараагийн хүсэлт" загвартай ямар ч
  урсгал (admin-web, Mobile апп цаашид) адил эрсдэлтэй байсан тул энэ
  засвар тэдгээрт ч хамгаалалт өгнө.
- **Mobile: каталог үзэх/хайх/дэлгэрэнгүй UI дууссан** (docs/plan.md §7
  модуль #3, admin-web-ийн cobalt-indigo brand identity-г Flutter талд
  давхарлав): `pubspec.yaml`-д `cached_network_image`/`shimmer` нэмэгдэв.
  `lib/features/catalog/domain/{category,product,product_variant,
  product_image,availability}.dart` — `freezed` ЗОРИУДАА ашиглаагүй энгийн
  immutable класс + гар `fromJson` (backend-ийн `ProductDetail`/`Category`
  бүтэцтэй ШУУД тохирно, `Product.aggregateAvailability`/`cheapestVariant`
  getter-үүд зөвхөн UI-ийн товч танилцуулга зорилготой — backend-ийн
  `computeAvailabilityStatus()` шийдвэрийг дахин бичээгүй, ADR 005-ийн
  "ганц газар л шийднэ" зарчим). `lib/features/catalog/data/
  catalog_repository.dart` (`GET /categories`, `GET /catalog/search?q=&
  categoryId=`, `GET /products/:id`). `lib/features/catalog/presentation/
  catalog_providers.dart` — `riverpod_annotation` codegen ЗОРИУДАА
  ашиглаагүй (`AsyncNotifierProvider`-ийг гараар, `apiClientProvider`-тай
  ижил "codegen-гүй plain provider" загвар) — `CatalogSearchNotifier`:
  query бичихэд 300мс debounce (`Timer`, дараагийн `setQuery`-ээр өмнөх нь
  цуцлагдана), ангилал сонгоход debounce-ГҮЙ шууд дахин ачаална.
  `CatalogScreen` (grid 2 багана, ангиллын chip мөр хэвтээ гүйлгэдэг,
  хайлтын талбар debounce+бяцхан indicator+цэвэрлэх товч, RefreshIndicator)
  БОЛОН `ProductDetailScreen` (route: `/products/:id`, `SliverAppBar`+
  `Hero`-той зурган gallery — олон зурагтай бол `PageView`+dot indicator,
  variant сонголт `ChoiceChip`, тооцоолсон availability badge+leadDays
  тайлбар, "Сагслах" ЗОРИУДАА placeholder — `SnackBar`-аар "дараагийн
  шатанд нэмэгдэнэ" тайлбарладаг, cart Phase хараахан ирээгүй). 3 UI
  төлөв (ачаалж байгаа — `ProductCardSkeleton`/shimmer grid; өгөгдөлтэй;
  хоосон/алдаатай — дүрстэй `CatalogEmptyState` + "Дахин оролдох") бүгд
  8pt grid (spacing 8/16/24/32), 12-16px булангийн муруйлт, нарийн
  сүүдэр, tap үед `AnimatedScale` feedback-тэй.
  ⚠️ **Чухал заль (Android emulator networking, 2 дахь жишээ):**
  `resolveApiBaseUrl()`-ийн "Android emulator localhost-оо өөрийгөө
  зааж байгаа тул 10.0.2.2 ашиглана" зарчим ЗӨВХӨН backend API URL-д
  биш, `MinioService.getPublicUrl()`-ээс ирдэг зурган URL-д (dev орчинд
  мөн `localhost:9000`-ээр ирдэг) ч мөн адил хамаарна гэдгийг шинээр
  олов — `lib/core/network/api_base_url.dart`-д `resolveMediaUrl()`
  нэмж (`Platform.isAndroid` үед `localhost`/`127.0.0.1` host-ыг
  `10.0.2.2`-оор сольдог), `ProductImage.fromJson`-д шууд хэрэглэв.
  ⚠️ **Playwright-ийн оронд (mobile-д тохиромжгүй тул) бодит Android
  emulator дээр `adb`-аар screenshot цуврал авч баталгаажуулав:** нүүр →
  Каталог үзэх → хайлт (debounce ажиллаж, "Coca-Cola" гэж бичихэд зөв
  MinIO зурагтай карт олдов) → дэлгэрэнгүй (Hero шилжилт, "2,500₮" үнэ,
  ногоон "Бэлэн" badge) → олон variant-той бүтээгдэхүүн дээр variant
  chip сольж PRE_ORDER-руу шилжихэд үнэ/badge/"7 хоногийн дотор бэлэн
  болно" тайлбар зөв шинэчлэгдэв → хоосон хайлтын үр дүнгийн зурагтай
  empty state → dark mode (`cmd uimode night yes`) — бүх дэлгэц (карт,
  chip, badge, skeleton) зөв харагдав. Демо өгөгдөл (2 ангилал, 7
  бүтээгдэхүүн, IN_STOCK/PRE_ORDER/OUT_OF_STOCK гурвыг тус тусад нь
  илэрхийлсэн) шинэ Keycloak+DB staff хэрэглэгч (`mobile-catalog-
  demo@order-system.mn`, SUPER_ADMIN) болон шинэ "Mobile демо салбар"-аар
  дамжуулж API-аар үүсгэсэн (dev DB/Keycloak/MinIO-д өмнөх Phase-үүдийн
  адил debris байдлаар үлдсэн, устгах шаардлагагүй). Тест: unit
  (`catalog_search_notifier_test.dart` — debounce/filter логик, 5 тест)
  + widget (`catalog_screen_test.dart` — ачаалж байгаа/өгөгдөлтэй/
  хоосон 3 төлөв + карт→дэлгэрэнгүй navigation + debounce, 5 тест),
  fake нь `Dio`/HTTP давхаргыг бүрэн тойрсон `FakeCatalogRepository`
  (`auth_provider_test.dart`-ийн `_FakeAuthRepository`-тэй ижил загвар).
  `flutter analyze` 0 алдаа, `flutter test` 29/29 ногоон (CI-ийн `mobile`
  job-той яг ижил алхмаар локал баталгаажуулсан — CI аль хэдийн Phase
  0-ээс энэ job-той байсан тул шинээр нэмэх шаардлагагүй байв).
- **(2026-08-20) Сагс (Redis persist) + checkout-ийн салбар сонголт/бэлэн
  байдал шалгах урьдчилсан харагдац дууссан** (`docs/plan.md` §7 модуль
  #5-ийн Redis-cart хэсэг, Phase 3a-д checkout л хийгдэж жинхэнэ "сагс"
  хараахан байгаагүйг гүйцээв):
  - **Хэсэг A (backend):** `src/cart` (`CartController`/`Service`) —
    `GET/DELETE /cart`, `POST /cart/items` (upsert-**set**, delta биш —
    Flutter +/- adjuster шинэ бодит тоог өөрөө тооцоод дамжуулна),
    `DELETE /cart/items/:variantId`, `POST /cart/validate-branch`. Redis
    key `cart:{userId}` (JWT-ээс баталгаажсан userId-аар, dto/param-аар
    ирсэн утгаар ХЭЗЭЭ Ч биш), value variantId+quantity JSON, TTL 30 хоног
    (бичилт бүрд сэргээнэ). `@Audit()` ШААРДАГГҮЙ (Redis, Postgres mutation
    биш). `validate-branch` нь `order.service.ts`-ийн `resolveCheckoutItem()`-тэй
    ЯГ ижил `app_inventory_snapshot_for_variant()` SECURITY DEFINER функц +
    `computeAvailabilityStatus()`/`resolveEffectivePrice()`
    (inventory-effective.util.ts) дахин ашигласан — шинэ функц ШААРДААГҮЙ
    (ADR 005). Тест: unit (`cart.service.spec.ts`, Redis-ийг mock Map-аар),
    e2e (`test/cart.e2e-spec.ts` — userId тусгаарлалт, upsert-set семантик,
    validate-branch-ийн 3 тохиолдол: бүгд бэлэн/зарим дууссан/зарим
    PRE_ORDER).
  - **Хэсэг B (Mobile):** `features/cart` (`CartScreen` — жагсаалт, +/-,
    устгах, "Нийт (ойролцоогоор)" placeholder, "Захиалах" товч),
    `features/branch` (`BranchSelectionScreen` — салбар сонгоход
    `/cart/validate-branch` дуудаж "N-ээс M бэлэн" + дутуу зүйлсийн
    жагсаалт харуулна, "Үргэлжлүүлэх" ЗОРИУДАА placeholder — checkout
    өөрөө дараагийн ажил). `ProductDetailScreen`-ийн өмнөх Phase-ийн
    "Сагслах" placeholder-ыг ЭНЭ Phase-д бодитоор `cartProvider.addOne()`-тэй
    холбов (`CartNotifier.addOne()` — variantId сагсанд байвал тоог 1-ээр
    нэмнэ, байхгүй бол 1-ээр шинээр нэмнэ, `POST /cart/items`-ийн upsert-set
    семантиктай нийцүүлсэн). HomeScreen-д сагсны icon + `Badge` (item тоо)
    нэмэгдэв.
  - ⚠️🔴 **Ноцтой олдвор — Android emulator дээр бодитоор турших үед
    (screenshot дараалалаар) илрүүлсэн, зөвхөн widget тестээр олдоогүй
    real layout алдаа:** `CartScreen` анхны хувилбарт footer-ийг
    `Scaffold.bottomNavigationBar` слотод байрлуулсан байсан нь (`SafeArea`
    > `Container` (decoration+padding) > `Row` [`Expanded(Column(2×Text))`,
    `FilledButton`]) — item-тэй сагсанд орохоор **`Scaffold.body`-ийн
    өндөр 0 болж, AppBar/жагсаалт огт харагдахгүй, харин footer(-ийн
    агуулга) дэлгэцийн ДЭЭД хэсэгт (status bar-тай давхцаж) render хийгдэх**
    зөрчилтэй байсныг олов (яг зөв утгатай өгөгдөл ирж байгаа ч layout
    эвдэрсэн — `find.byKey('cart_list')`-ийн size нь `Size(800, 0)` гэдгийг
    isolated widget тестээр баталгаажуулсан). Язгуур шалтгааныг тодорхой
    тогтоож чадаагүй (Scaffold+bottomNavigationBar+Theme-based Text
    хослолын ямар нэг edge case гэж таамагласан, цаашид судлах шаардлагагүй)
    ч **засвар:** `bottomNavigationBar:` слотыг бүхэлд нь орхиж,
    `CatalogScreen`-ийн (модуль #3, аль хэдийн батлагдсан) ЯГ ижил загвар —
    `body: Column([Expanded(жагсаалт), footer widget])` руу шилжүүлснээр
    бүрэн шийдэгдсэн (Android emulator дээр screenshot-оор давтан
    баталгаажуулсан). **Сургамж:** widget тест "ногоон" гарахаас өмнө энэ
    алдаа мөн widget тестээр (`tester.getSize()`) БОДИТООР олдсон байсан ч
    (энэ Phase-ийн ажлын явцад), зөвхөн Android emulator дээрх бодит
    screenshot турших нь эцсийн баталгаажуулалтад зайлшгүй байсныг
    харуулав — `Scaffold`-ийн native слотуудыг (`bottomNavigationBar`,
    `drawer` гэх мэт) шинэ дэлгэцэд ашиглахаас өмнө, тухайн codebase-д
    аль хэдийн батлагдсан `Column`+`Expanded` загвар байгаа бол ТҮҮНИЙГ
    илүүд үзэх.
  - ⚠️🔴 **Хоёр дахь ноцтой олдвор (мөн Android emulator дээр илэрсэн) —
    `GET /branches` CUSTOMER-д ХЭЗЭЭ Ч мөр буцаадаггүй байсан бодит RLS
    цоорхой:** `BranchSelectionScreen`-ийг эхлээд туршихад "Салбар
    олдсонгүй" гарсныг судлахад, `branches_select` RLS policy
    (`app_accessible_branch_ids()`, 20260815082257 migration) нь ЗӨВХӨН
    `user_branch_roles` мөртэй хэрэглэгчид (staff)-д зориулагдсан болохыг
    олов — CUSTOMER-д ХЭЗЭЭ Ч `user_branch_roles` мөр байдаггүй
    (`resolveUserRoleNames()`-ийн "мөргүй бол authProvider=CUSTOMER_AUTH-аар
    CUSTOMER" fallback зарчим) тул `GET /branches` (admin-web-ийн салбар
    dropdown-д зориулж Phase 2-д нэмэгдсэн, staff-only хэрэглээ таамагласан)
    CUSTOMER-д ОГТ ашиглагдаж байгаагүй, шинэ хэрэгцээ (BranchSelectionScreen)
    анх удаа энэ цоорхойг илрүүлэв. **Засвар (ADR 005-ийн "READ-redact"
    зарчим, migration `20260820120000_add_public_branches_function`):**
    `app_public_branches()` шинэ SECURITY DEFINER функц (зөвхөн `id`/`name`/
    `address`/`district`, зөвхөн `isActive=true` мөр) нэмж,
    `BranchService.findAll()`-д CUSTOMER эсэхийг (`resolveUserRoleNames()`)
    шалгаад тохирвол raw SQL-ээр энэ функцийг дуудна; staff хэвээр
    `tx.branch.findMany()` (RLS-ээр өөрийн харах эрхтэй) ашиглана — admin-web-д
    нөлөөгүй. `test/catalog-inventory.e2e-spec.ts`-ийн "CUSTOMER аль ч
    салбарыг харахгүй (хоосон жагсаалт)" гэсэн хуучин тест (ХУУЧИН БУруу зан
    төлөвийг "зөв" гэж кодолсон байсан) "CUSTOMER идэвхтэй бүх салбарыг
    харна" болж шинэчлэгдэв, шинэ `test/branch.e2e-spec.ts` нэмэгдэв.
  - ⚠️ **Тохиолдсон, гэхдээ ЭНЭ ажилтай шууд холбоогүй 2 асуудал олж
    засав (доор дэлгэрэнгүй):** (1) PR #14 merge хийхийн өмнө locally
    commit хийгдээгүй үлдсэн WIP (categories isActive filter fix +
    Light/Dark тохиргооны дэлгэц + dark mode зурган placeholder засвар)
    тусдаа PR (#15, `wip/mobile-catalog-followups`) болгож CI-тэй хамт
    main-руу нэгтгэв — доорх тусдаа бичлэгийг үз. (2)
    `test/reports.e2e-spec.ts`-ийн `rangeTo`-г `'2026-08-19'` гэж ХАТУУ
    бичсэн байсан нь тухайн огноог давсны ДАРАА (өнөөдрөөс хойш) CI-г
    ТОГТМОЛ унагаах болсныг PR #15-ийн CI дээр илрүүлж, `new Date()`-ээс
    (энэ сарын эхнээс өнөөдөр хүртэл) динамикаар тооцох болгож засав —
    ЭНЭ засвар ОГТ өөр PR (#15)-д хийгдсэн ч, cart branch дээр ч мөн
    адил алдаа давхар гарах байсныг харсан тул хоёуланд нь тусад нь
    нэвтрүүлсэн.
  - **(тусдаа PR, #15) `wip/mobile-catalog-followups` → main:** cart
    branch дээр ажиллаж эхлэхээс өмнө олдсон, PR #14 merge хийхийн өмнө
    орон нутагт commit хийгдээгүй үлдсэн ажлыг тусад нь PR болгож нэгтгэв
    — `GET /categories`-д CUSTOMER-ийн `isActive=true` filter,
    Light/Dark тохиргооны дэлгэц (`theme_mode_provider`,
    `theme_preference_storage`), dark mode зурган placeholder засвар
    (`product_image_placeholder.dart`), mobile демо seed script. `gh pr
    create`+`gh run watch`-аар CI баталгаажуулж squash-merge хийсэн
    (дээрх reports.e2e-spec.ts огнооны засвар яг ЭНЭ PR-ийн CI дээр анх
    илэрсэн).
  Тест: backend 15/15 e2e suite (134/134), 39/39 unit suite (235/235,
  `cart.service.spec.ts`, `branch.service.spec.ts` шинээр орсон); mobile
  `flutter analyze` 0 алдаа, `flutter test` 47/47 (cart provider/screen
  widget тест шинээр орсон). Android emulator дээр бүрэн урсгал
  (сагслах→сагс харах→тоо+/-→салбар сонгох→"N-ээс M бэлэн"+status badge)
  screenshot-уудаар баталгаажуулсан.
- Дараагийн ажил: geolocation auto-routing (backlog, "should-have" — Phase
  4-ийн хүргэлтийн ЧИГЛҮҮЛЭЛТЭЭС (аль хэдийн сонгогдсон захиалганд зам/зай
  тооцох) ОГТ ӨӨР, "хамгийн ойрхон салбарыг АВТОМАТААР сонгох" гэсэн
  хараахан хэрэгжээгүй зүйл хэвээр), **Mobile-ийн захиалга үүсгэх (checkout)
  + бодит цагийн/хүргэлтийн UI** (каталог үзэх/хайх БОЛОН сагс/салбар
  сонгох дууссан — доорх "(2026-08-20)" бичлэгийг үз, "Захиалах" товч
  BranchSelectionScreen дээр placeholder хэвээр — checkout API дуудалт
  дараагийн ажил), push notification (Mobile апп push
  бүртгэл хараахан эхлээгүй тул
  хүлээн авах төхөөрөмж алга, backlog), бодит SMS vendor сонгож
  `SmtpNotificationProvider.sendSms()`-ийн стабыг солих (§11.3, Phase 1-ээс
  хойш хойшлогдсоор ирсэн), Худалдагчийн тусгай ажлын урсгал дэлгэц
  (Mobile UI-тай хамт), OSRM public demo-оос өөрийн container руу шилжих
  (`docs/adr/007`), `DebugController`-ыг устгах/SUPER_ADMIN-д хязгаарлах,
  refresh token revocation store (хэрэгцээ гарвал), admin-web-ийн салбар
  удирдах хуудас (CUD, одоо зөвхөн уншихад зориулсан `GET /branches`
  байгаа), admin-web session persist (ADR 004-ийн "Ирээдүйн сайжруулалт"
  хэсэг — одоогоор F5 хийвэл дахин нэвтрэх шаардлагатай хэвээр), QPay
  бодит sandbox credential ирмэгц ADR 006-ийн checklist гүйцээх, webhook
  endpoint-д rate-limit нэмэх (backlog).
- **(backlog, жижиг PR)** `OrderService.updateStatus()`-ийн `orders_update`
  RLS policy-д (`PATCH /orders/:id/status`) дээрх "Тестийн стандарт — RLS
  mutation policy"-той ЯГ ижил шууд SQL шалгалт (`PrismaService.
  runRequestTransaction()`-оор service/RolesGuard-ыг бүрэн тойрч) нэмэх —
  `OrderService.updateStatus()` мөн адил `findOne(id)` (SELECT,
  `orders_select`) pre-check хийсний ДАРАА л `.update()`
  (`orders_update`) дуудсан тул CUSTOMER-ийн "зөвхөн CREATED→CANCELLED"
  хязгаарлалт (`orders_update`-ийн `WITH CHECK`) бодитоор JS
  state-machine шалгалтаар (`order.status !== 'CREATED' ...`) НУУГДСАН
  хэвээр — returns PR #7-д яг энэ загварыг илрүүлж/шалгасан ч цаг
  хугацааны хувьд зөвхөн буцаалтын модульд л засварлав.
- **(backlog, яаралтай биш, зөвхөн тэмдэглэл)** `apps/api/package.json`-ийн
  `test:e2e`-д нэмсэн `--runInBand` (спец файлуудыг цуврал ажиллуулах,
  §8 Phase 2-ийн e2e тогтвортой байдлын засвар) нь Postgres/Keycloak
  connection pool-ийн хомсдлыг арилгасан ч, үүний хажуугийн зардал бол
  CI-ийн e2e ажиллах ХУГАЦАА spec файлын тоотой ШУЛУУН пропорциональ
  (шугаман) өсдөг болсон явдал — файлууд зэрэгцээ биш дараалан ажилладаг
  тул. Spec файлын тоо цаашид өсөх тусам ("Phase" бүрд шинэ
  `*.e2e-spec.ts` нэмэгдэх хандлагатай) энэ нь CI-ийн хамгийн удаан
  алхам болох эрсдэлтэй. Ирээдүйд шаардлагатай болвол авч болох
  чиглэл: тестийн өгөгдлийг (Meilisearch индекс, Postgres мөр)
  spec файл БҮРД тусгаарлах загвар руу шилжиж (жиш: өвөрмөц prefix/
  schema-ээр тусгаарлах) дахин зэрэгцээ ажиллуулах, эсвэл Jest
  `--shard`-аар CI job-ыг хэд хэдэд хуваах. Одоогоор яаралтай биш,
  учир нь CI-ийн нийт хугацаа хараахан тэвчиж болохуйц хэвээр байна.
