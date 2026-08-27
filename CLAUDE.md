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

**Mobile (Flutter) кодын өөрчлөлт бүрд яагаад бүтэн `flutter run` дахин
хийдэг вэ — hot reload/restart-ыг ЗОРИУДАА ашигладаггүй (2026-08-21,
судалж баталгаажуулсан):** Claude Code-ийн Android emulator дээрх
Flutter UI баталгаажуулалт бүрд (жиш: AddressScreen/OrderTrackingScreen
дизайны PR) `flutter run`-г **background процессоор нээлттэй байлгаж,
stdin руу `r` (hot reload) илгээх** боломжтой эсэхийг тусгайлан
судалж, БОДИТООР ЭНЭ орчинд туршиж баталгаажуулсан:
- Named pipe (`mkfifo`)-ийг `flutter run`-ий stdin болгож дамжуулахыг
  оролдоход (`flutter run < /tmp/fifo`, тэр байтугай `flutter --version
  < /tmp/fifo` гэсэн хамгийн энгийн дуудлага дээр ч) **`flutter.bat`
  ЯГ ЛУУГААР ажиллахгүй, өөрийн эх batch-скриптийн кодын мөрүүдийг
  (`SET /P dart_installed_version=<...`, `FOR /F %%i IN (...)` гэх мэт)
  шууд stdout руу гаргаад зогсдог** болохыг давтан (2 удаа тусдаа
  туршилтаар) баталгаажуулсан — жинхэнэ Flutter хувилбар хэзээ ч
  хэвлэгдээгүй, процесс цаашид ахиагүй. Харин piped stdin-гүйгээр
  ижил `flutter --version`-г шууд дуудахад алдаагүй ажилласан — тул
  энэ бол Windows batch launcher (`flutter.bat`)-ийн MSYS/Git Bash-ийн
  pipe-based stdin-тэй давхцахад гарах өвөрмөц зөрчил (`run` тушаалтай
  ч, ерөнхийдөө ямар ч тушаалтай ч хамааралгүй) гэдгийг нотолсон.
- Дараагийн оролдлого болгон `winpty`-г (Windows console апп-уудыг
  MSYS/Git Bash дор ажиллуулах стандарт хэрэгсэл) туршихад **winpty
  өөрөө "stdin is not a tty" алдаа өгч ажиллахаас татгалзсан** — учир
  нь Claude Code-ийн Bash tool-ийн ажиллуулдаг орчин өөрөө жинхэнэ
  interactive TTY биш (stdout аль хэдийн uншихад зориулж дамжуулагдсан
  байдаг) тул winpty pseudo-console холбож чадахгүй.
- Дүгнэлт: энэ орчинд (Claude Code Bash tool + Windows + Git Bash +
  `flutter.bat`) background `flutter run`-д stdin-аар hot reload/restart
  илгээх найдвартай арга **олдсонгүй** — 2 өөр аргачлал (raw named pipe,
  winpty) хоёул суурь түвшинд эвдэрсэн тул "заримдаа ажиллана" гэсэн
  хагас-найдвартай байдал ч биш, огт ажиллахгүй нь тодорхой болсон.

  **Шийдвэр — АЮУЛГҮЙ ТАЛЫГ сонгосон:** Flutter UI өөрчлөлт бүрийг
  баталгаажуулахдаа **бүтэн `flutter run` (35 секунд орчмын Gradle
  build)-ийг дахин хийдэг өмнөх зарчмыг хэвээр үлдээв** — энэ бол
  "hot reload бичихэд төвөгтэй учир" гэсэн тайвшралын шийдвэр БИШ,
  харин **бодитоор туршиж, суурь орчны түвшинд (`flutter.bat`-ийн
  batch launcher, winpty-ийн tty шаардлага) эвдэрснийг нотолсны дараа
  гаргасан ухамсартай, найдвартай байдлыг тэргүүн зэрэгт тавьсан
  сонголт**. Ирээдүйд өөр орчинд (жиш: жинхэнэ Linux/macOS, эсвэл
  Windows дээр WSL2 доторх Git Bash биш bash) ижил судалгаа хийвэл
  дээрх 2 бэрхшээл (batch launcher, tty) аль аль нь байхгүй байж
  болзошгүй тул дахин үнэлж болно — гэхдээ **энэ тодорхой орчинд
  (Windows + Git Bash + flutter.bat) дахин оролдохгүй байхыг зөвлөж
  байна**, учир нь яг ижил 2 бэрхшээл давтагдах магадлал өндөр.

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
(доор дэлгэрэнгүй). **Cart→Checkout→QPay бүрэн урсгал (backend checkout
Redis сагснаас уншиж, Mobile-ийн DeliveryMethod→Address→Review→Payment
(QR/deeplink)→Success→Tracking дэлгэцүүд) дууссан** (доор
"(2026-08-20, Cart→Checkout→QPay)" бичлэгийг үз). **Захиалгын түүх,
Буцаалт хүсэх, Профайл + Mobile 4-tab навигаци (§7 модуль #6, #9-ийн
CUSTOMER тал) дууссан** (доор "(2026-08-21) Захиалгын түүх..." бичлэгийг
үз). **Урамшуулал/купон (§7 модуль #10, Phase 6) дууссан** (backend +
admin-web + Mobile — доор "(2026-08-21) Урамшуулал/купон" бичлэгийг үз).
**Харилцагчийн үйлчилгээ (тасалбар, §7 модуль #13) дууссан** (backend +
admin-web + Mobile, текст-зөвхөн MVP + бодит цагийн чат — доор
"(2026-08-27) Харилцагчийн үйлчилгээ" бичлэгийг үз).
Geolocation auto-routing (автоматаар хамгийн ойрхон салбар сонгох —
Phase 4-ийн хүргэлтийн чиглүүлэлттэй ОГТ ӨӨР зүйл) хараахан backlog
хэвээр. Дэлгэрэнгүй: `docs/plan.md` §8.

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
- **(2026-08-20) Branch debris цэвэрлэлт дууссан**: `BranchSelectionScreen`
  (дээрх cart Phase)-ийг Android emulator дээр туршихад "Захиалга Салбар А
  1786874340520" гэх мэт e2e тестийн Branch debris бодит харилцагчийн
  UI-д харагдаж байгааг олов — dev DB-д нийт **767 Branch мөрөнд 764 нь
  идэвхтэй** байсныг шууд SQL-ээр баталгаажуулав. **Category/Product-ийн
  адил өмнөх "batch update script" ЭНЭ project-д ОГТ БАЙГААГҮЙг** (git
  log/scratch файл бүрэн хайлт) нээж, шинээр бичив:
  `apps/api/prisma/cleanup-branch-debris.ts` (`pnpm --filter api run
  cleanup:branch-debris`, `seed-catalog-demo.ts`-тэй ижил superuser
  `DATABASE_URL`-ээр шууд холбогдоно — `branches` FORCE RLS идэвхтэй).
  **Debris таних дүрэм** (dev DB-г бодитоор шинжилж баталгаажуулсан):
  бүх e2e-spec (`test/*.e2e-spec.ts`)-ийн үүсгэдэг Branch нэр бүр
  `Date.now()`-ийн 10+ оронтой тоо (эсвэл `search.e2e-spec.ts`-ийн
  `srch${Date.now()}...` tag) агуулдаг тул **нэрэндээ 10+ дараалсан
  цифртэй ямар ч Branch = debris** гэсэн ГАНЦ regex (`/[0-9]{10,}/`)-ээр
  Playwright/Debug/Verify ad hoc session-үүдийн үүсгэсэн Branch
  (`"Playwright тест салбар..."`, `"DebugBranch..."`, `"Verify
  Хэрэглэгч Хайрцаг..."`) хүртэл бүгдийг нэг дор хамарсан (шалгасан:
  идэвхтэй 764-аас яг 763 нь энэ дүрэмд таарч, 0 "тохирохгүй" үлдэгдэл
  байсан). Цорын ганц үл хамаарах нэр `"Mobile демо салбар"` (Latin,
  Phase 2-ийн анхны ad hoc баталгаажуулалтаар үүссэн, 0 захиалга/
  inventory-тай, `seed-catalog-demo.ts`-ийн канончлогдсон `"Мобайл демо
  салбар"` (Cyrillic)-аар аль хэдийн орлуулагдсан) байсныг нэрээр нь
  тусад нь зааж дуудсан. **Устгаагүй, зөвхөн `isActive=false`** (Order.branch
  → `onDelete: Restrict` тул захиалгын түүхтэй Branch-ыг хатуу устгах
  боломжгүй ч, захиалгын түүхгүй ч гэсэн Category/Product-той адил
  зарчмаар зөвхөн soft-deactivate хийхээр шийдсэн — task-ийн анхны
  зааврын "хоёр тохиолдолд аль алинд нь isActive=false хангалттай" гэсэн
  заалт бодит дата дээр давхар шалгагдаж зөв болохыг баталгаажуулсан:
  бүх debris Branch аль хэдийн 0 захиалгатай байсан тул энэ ялгаа
  практикт нөлөөлөөгүй). Script ажилласны дараа идэвхтэй Branch **1**
  (`"Мобайл демо салбар"` ганцаараа) болсон.
  ⚠️ **app_public_branches() (2026-08-20 migration
  `add_public_branches_function`) аль хэдийн `WHERE "isActive" = true`
  шүүлттэй байсныг шалгаж баталгаажуулав** — шинэ migration шаардлагагүй,
  зөвхөн дата цэвэрлэхэд л хангалттай байв. **admin-web-ийн талд ямар ч
  өөрчлөлт хийгээгүй** — `BranchService.findAll()` staff (CUSTOMER биш)
  дүрд `isActive` шүүлтгүйгээр БҮХ Branch-ыг харуулдаг зарчим хэвээр
  (dedicated "салбар удирдах хуудас" одоо ч байхгүй, зөвхөн
  `InventoryPage`-ийн dropdown `GET /branches`-ийг ашигладаг тул staff
  талд idle Branch-ууд ХЭВЭЭР харагдана — санаатай, дээрх "Дараагийн
  ажил"-ын "admin-web-ийн салбар удирдах хуудас (CUD)" зүйлтэй холбоотой,
  ирээдүйд тэр хуудас нэмэгдэхэд idle/active шүүлт/toggle UI-г тэнд
  зохион байгуулна).
  ⚠️ **Ирээдүйд давтагдахаас сэргийлэх шийдвэр — 15 e2e-spec файлд
  `afterAll` cleanup НЭМЭЭГҮЙ, ЗОРИУДАА (2026-08-20 тусад нь баталгаажуулсан):**
  эхлээд `apps/api/test/`-д ерөнхий/дундын test infrastructure байгаа
  эсэхийг тодорхой шалгасан — `test/jest-e2e.json`-д `globalSetup`/
  `globalTeardown`/`setupFiles` огт ЗААГДААГҮЙ, `test/`-д дундын helper
  файл (жиш: `test/setup.ts`) ч БАЙХГҮЙ, spec бүр (`app`, `auth`,
  `auth-staff`, `branch`, `cart`, `catalog-inventory`,
  `delivery-routing`, `notification`, `orders`, `payment`,
  `product-image`, `realtime`, `reports`, `returns`, `search`) `src/`-ээс
  шууд импортолж бие даасан `beforeAll`-тай (14 файлд `beforeAll`/
  `beforeEach` олдсон). Иймд Branch (мөн Category/Product/Order) үүсгэдэг
  логикийг НЭГ газар зогсоож цэвэрлэх боломжгүй — тус бүрт FK-ийн
  дараалалд (Order/OrderItem эхлээд, дараа нь Branch) нийцсэн `afterAll`
  teardown нэмэх нь 15 файлыг зэрэг өөрчилж CI тогтвортой байдалд эрсдэл
  үүсгэх шинжтэй том ажил гэж үзэж, **үүний оронд энэ тэмдэглэлийг +
  дээрх `cleanup:branch-debris` script-ийг байнгын зөвшөөрөгдсөн шийдэл
  болгосон** (Category/Product-ийн debris-ийг ЗОРИУДАА "устгах
  шаардлагагүй" гэж үлдээдэг өмнөх төслийн зарчимтай нийцүүлсэн).
  **Цаашид:** (a) шинэ e2e-spec Branch үүсгэхдээ нэрэндээ `Date.now()`/
  өвөрмөц тоон suffix заавал ашигласаар байвал энэ дүрэм автоматаар
  цаашид ч тэднийг хамарна; (b) `cleanup:branch-debris`-ийг тогтмол
  давтамжтай (жиш: sprint бүрийн эцэст, эсвэл mobile debris
  анзаарагдах бүрд) дахин ажиллуулж болно — script idempotent (зөвхөн
  `isActive=true` мөрөөс дүрэмд тохирохыг л дахин `false` болгодог,
  аль хэдийн `false` мөрд нөлөөгүй).
  📌 **(backlog, test infrastructure) Ирээдүйн сайжруулалт:** хэрэв
  ирээдүйд `apps/api/test/jest-e2e.json`-д `globalSetup`/`globalTeardown`
  (жиш: run эхлэхэд `process.env`-д run-тэй холбоотой tag/timestamp
  тэмдэглээд, run дуусахад ЗӨВХӨН тэр tag-тай мөрүүдийг (Branch/
  Category/Product/Order гэх мэт) цэвэрлэдэг) НЭМЭГДВЭЛ, `cleanup-branch-debris.ts`-ийн
  "10+ оронтой тоо агуулсан нэр = debris" дүрмийг ШУУД дахин ашиглаж
  болно — шинэ логик зохиох шаардлагагүй, зөвхөн scope-ыг (бүх debris
  → тухайн run-ий debris) нарийсгах ажил байх болно. Энэ бол зөвхөн
  "ирээдүйд test infrastructure сайжруулах" ажил бөгөөд одоогийн
  Branch debris цэвэрлэлтийн даалгаварт ХАМААРАХГҮЙ — сохроор шинэ
  global setup зохиогоогүй.
  Android emulator дээр `BranchSelectionScreen`-ийг дахин нээж, зөвхөн
  `"Мобайл демо салбар"` ГАНЦААРАА (debris байхгүй) харагдаж байгааг
  screenshot-оор баталгаажуулсан.
  ⚠️ **Баталгаажуулалтын явцад олдсон, ЭНЭ ажилтай шууд холбоогүй орчны
  зөрүү (цаг зарцуулсан тул тэмдэглэв):** Android emulator дээр аль
  хэдийн суулгагдсан байсан debug APK ачаалж байгаа backend порт
  (`resolveApiBaseUrl()`-ийн анхдагч `http://10.0.2.2:3100`, mobile
  талын код) БОЛОН тухайн үед бодитоор ажиллаж байсан NestJS dev
  server-ийн ЖИНХЭНЭ сонсож буй порт (`3001`, `netstat`-аар
  баталгаажуулсан) хоорондоо ЗӨРСӨН байснаас "Сүлжээний холболт
  амжилтгүй боллоо" гэсэн алдаа (login/cart аль алинд нь) гарч байсныг
  олов — `apps/api/.env`-ийн `PORT=3100` ч, ажиллаж байсан процесс энэ
  утгыг аваагүй (магадгүй өөр PORT env-тэйгээр эсвэл `.env`-ийг
  засварлахаас өмнө эхэлсэн хуучин процесс) байв. **Энэ бол Branch
  цэвэрлэлтийн script-ээс ОГТ ХАМААРАЛГҮЙ** (зөвхөн Postgres-ийн
  `branches` хүснэгтэд л хүрсэн) — баталгаажуулахын тулд backend
  процессыг ОГТ хөндөлгүйгээр `cd apps/mobile && flutter run
  --dart-define=API_BASE_URL=http://10.0.2.2:3001 -d emulator-5554`-ээр
  mobile апп-ыг бодит ажиллаж буй порт руу шууд заалгаж дахин ачаалснаар
  шийдсэн. **Анхаарах зүйл:** хэрэв ирээдүйд ижил "Сүлжээний холболт
  амжилтгүй боллоо" алдаа emulator дээр давтагдвал, эхлээд
  `netstat -an | grep LISTEN | grep <порт>`-оор backend бодитоор аль
  порт дээр сонсож байгааг, `.env`-ийн `PORT`-той (болон mobile-ийн
  `resolveApiBaseUrl()`-ийн анхдагч утгатай) таарч байгаа эсэхийг
  шалга — код/өгөгдлийн алдаа гэж яараад бүү шийд.
- **(2026-08-20, Cart→Checkout→QPay) Сагс→Захиалга→QPay төлбөр→бодит
  цагийн урсгал бүрэн дууссан** (`docs/plan.md` §8, өмнөх "Сагс + Mobile
  cart/branch-select"-ийн шууд үргэлжлэл — "Захиалах" товч placeholder-ийг
  жинхэнэ checkout болгов):
  - **Хэсэг A (backend):** ⚠️ **Чухал засвар:** `OrderService.checkout()`
    урьд нь захиалгын item-үүдийг ШУУД HTTP body-оос авдаг байсныг (§7
    модуль #5-ийн Redis сагс аль хэдийн бэлэн байсан ч checkout ЭНЭ
    сагсыг огт ашигладаггүй, зэрэгцээ 2 эх сурвалж байсан зөрчил) засаж,
    `CartService.listForCheckout()`-аар зөвхөн Redis-ийн `cart:{userId}`-аас
    л уншдаг болгов (`CheckoutOrderDto`-оос `items` талбарыг бүрмөсөн
    устгасан) — checkout амжилттай commit хийгдсэний ДАРАА (SearchIndexer/
    NotificationTrigger-тэй ЯГ ижил `onCommit()`-гэйт зарчим, cart цэвэрлэх
    Redis DEL rollback-ийн эрсдэлтэй тул) сагс автоматаар цэвэрлэгдэнэ.
    Үнэ (`resolveEffectivePrice()`) өмнө нь ч клиентийн оролтод итгэдэггүй
    байсан тул аюулгүй байдлын цоорхой БИШ байсан ч, "cart бол цорын ганц
    checkout эх сурвалж" гэсэн архитектурын нийцтэй байдлын зорилготой.
    `PaymentProvider.createInvoice()`-ийн `CreateInvoiceResult`-д
    `qrText`/`bankDeeplinks` (`{bankName, link}[]`) нэмэгдэв —
    `MockPaymentProvider` dummy утга (`mock-qr:...`, хоосон массив)
    буцаадаг, `QPayProvider` боломжтой бол (`qr_text`/`urls`, ЭХ СУРВАЛЖ
    БАТАЛГААЖААГҮЙ тул хамгаалалттай fallback-тайгаар) уншина.
    6 e2e-spec файл (`orders`/`payment`/`delivery-routing`/`realtime`/
    `reports`/`returns`) checkout дуудлага бүрийн өмнө эхлээд
    `POST /cart/items`-ээр сагсаа бичдэг болгож шинэчлэгдэв.
    ⚠️ **Шинэ RLS цоорхой (е2е тестээр Mobile-ийн шаардлагаар илэрсэн):**
    `GET /orders/:id/route`-ийг CUSTOMER-д (зөвхөн ӨӨРИЙН DELIVERY
    захиалгад — OrderTrackingScreen-д зам харуулах ёстой тул) нээхэд
    2 өөр RLS блок дараалан илэрсэн: (1) `branches_select` RLS CUSTOMER-д
    ХЭЗЭЭ Ч мөр буцаадаггүй (Branch debris цэвэрлэлтийн Phase-д аль хэдийн
    нээгдсэн ЯГ ижил язгуур шалтгаан, `app_public_branches()`-г шийдвэрлэсэн
    байсан ч `OrderService.getRoute()` тэр функцийг ашигладаггүй байсан) —
    `app_public_branches()`-г (`20260820130000` migration, DROP+CREATE,
    буцаах TABLE бүтэц өөрчлөгдсөн тул) `latitude`/`longitude` баганa +
    сонголтот `p_branch_id` параметрээр өргөтгөж, `OrderService.
    findBranchForRoute()`-д CUSTOMER-ийн үед ашигласан (staff хэвээр RLS-ээр
    шууд). (2) Салбарын байршил зөв уншсаны ДАРАА route-ийн кэшийг
    `tx.order.update()`-ээр бичихэд `orders_update` RLS-ийн WITH CHECK
    CUSTOMER-д ЗӨВХӨН `status='CANCELLED'`-руу шилжихийг л зөвшөөрдөг тул
    (status-той огт хамааралгүй энэ метадата бичилт) "new row violates
    row-level security policy" алдаа шидсэн — ADR 005-ийн WRITE ангилалд
    (`app_adjust_inventory_for_order()`-тэй ижил загвар: зөвшөөрлийг
    `orders_select`-тэй ижил нөхцлөөр функц дотроо шалгаад RLS-ийг тойрч
    бичнэ) шинэ `app_cache_order_route()` функц (`20260820140000` migration)
    нэмж шийдвэрлэв. Хоёулаа `order.service.spec.ts`/
    `delivery-routing.e2e-spec.ts`-д (CUSTOMER ӨӨРИЙН DELIVERY захиалгаа
    харна, өөр хэрэглэгчийнхийг харахгүй) тусад нь баталгаажуулсан.
  - **Хэсэг B (Mobile):** шинэ `features/checkout/` — `CheckoutDraft`
    (`Notifier<CheckoutDraft?>`, DeliveryMethod→Address→Review 3 алхмын
    дундуур PICKUP/DELIVERY+хаяг/координат хуримтлуулна, PICKUP руу буцахад
    хуучин хаяг ЗААВАЛ цэвэрлэгдэнэ — backend DTO validation-той нийцүүлэх).
    `DeliveryMethodScreen` (`SegmentedButton`) → `AddressScreen`
    (`flutter_map` OSM tile + Nominatim geocoding хайлт debounce 300мс +
    газрын зургийн ТӨВД тогтмол pin — чирэхэд `onPositionChanged`-аар
    координат уншина, `docs/adr/009-flutter-map-nominatim.md`) →
    `OrderReviewScreen` (эцсийн нийт дүнг `CartItem.estimatedLineTotal`
    (ойролцоо) БИШ, `cartBranchValidationProvider`-аас — ADR 005-ийн "ганц
    газар л шийднэ" зарчим Mobile талд ч мөн хамаарна) → `POST /orders`
    (`items` талбар ОГТ илгээхгүй) → `PaymentScreen` (`qr_flutter` QR +
    bank deeplink товчнууд + WebSocket `order:${orderId}` room-д нэгдэж
    `order.payment_confirmed` хүлээх, зөвхөн `kDebugMode`-д "Mock төлбөр
    симуляц" товч) → `OrderSuccessScreen` (2.5 секундын дараа автомат
    шилжилт) → `OrderTrackingScreen` (`order.status_changed`-ээр бодит
    цагийн `OrderStatusTimeline`, DELIVERY-д `OrderRouteMap` —
    admin-web-ийн `DeliveryRouteMap.tsx`-тэй ЯГ ижил `[lng,lat]→[lat,lng]`
    хөрвүүлэлтийн зарчим). ⚠️ **Чухал заль (WebSocket client lifecycle):**
    `OrderEventsClient`-д ЗОРИУДАА Riverpod provider бичээгүй — зөвхөн
    `ref.read()`-ээр ашиглавал `Provider.autoDispose` ямар ч listener
    бүртгэгдээгүй тул дараагийн microtask-д шууд dispose хийчихэж болзошгүй
    (watch хийхгүй бол autoDispose-ийн зарчим шууд хэрэгждэг) — тул
    PaymentScreen/OrderTrackingScreen screen бүр `State.initState()`-д
    шууд өөрөө үүсгэж, `State.dispose()`-д өөрөө хаадаг. pubspec.yaml:
    `flutter_map`/`latlong2`/`qr_flutter`/`url_launcher` нэмэгдэв.
    Тест: `checkout_draft_test.dart` (PICKUP↔DELIVERY branching, cleanup),
    `order_status_timeline_test.dart`, `delivery_method_screen_test.dart`,
    `order_review_screen_test.dart` (checkout амжилттай/OUT_OF_STOCK алдаа)
    — `flutter analyze` 0 алдаа, `flutter test` бүгд ногоон.
  ⚠️🔴 **Ноцтой олдвор — Android emulator дээр бодитоор турших үед олдсон,
  widget тестээр ОГТ илрээгүй логикийн цоорхой:** PaymentScreen-ийн debug
  "Mock төлбөр симуляц хийх" товч анхны хувилбарт ЗӨВХӨН
  `POST /payment/mock/simulate-paid/:id`-г дуудаж байсан — энэ нь
  `MockPaymentProvider`-ийн ДОТООД (санах ойн) статусыг PAID болгодог ч,
  Order.paidAt-г ЖИНХЭНЭ тавьж `order.payment_confirmed` WebSocket
  event-ийг өдөөдөг цорын ганц газар бол `POST /payment/webhook/:orderId`
  (docs/adr/006-ийн "verify don't trust" урсгал) байсныг мартсанаас болж,
  товч дархад QR дэлгэц мөнхөд "Холбогдож байна..."/"Төлбөр хүлээгдэж
  байна..." төлөвт зогсч байв (backend талд ЯМАР Ч алдаа гарахгүй, зөвхөн
  чимээгүй "юу ч болохгүй" — HTTP 200 буцаадаг тул Flutter талд ч алдаа
  барих боломжгүй байсан). Бодит QPay-ийн урсгалд энэ асуудал байхгүй
  (QPay-ийн сервэр өөрөө webhook-ыг дуудна), зөвхөн ЭНЭ debug-only
  симуляцид л хамааралтай байсан. **Засвар:**
  `CheckoutRepository.simulatePaid()`-г 2 дараалсан HTTP дуудлага хийдэг
  болгов (1. simulate-paid, 2. webhook) — 2 дахь алхмыг НЭМЭЭГҮЙ бол
  1-р алхам дангаараа ямар ч бодит захиалгын төлөв өөрчлөхгүй гэдгийг
  тодорхой тайлбарласан. **Сургамж:** widget тест (fake repository)
  зөвхөн "API дуудагдсан эсэх"-ийг шалгадаг тул ийм 2-алхамт орхигдсон
  дуудлагын алдааг барьж чадахгүй — end-to-end (бодит backend + бодит
  WebSocket) турших ЗААВАЛ шаардлагатай байсныг батлав.
  ✅ **Android emulator (dark + light mode) дээрх бүрэн урсгалын
  баталгаажуулалт:** Cart (item +/- , "Захиалах") → BranchSelectionScreen
  (Branch debris цэвэрлэлтийн дараа зөвхөн "Мобайл демо салбар" ганцаараа
  харагдаж, сонголт хялбар болсныг ажиглав) → DeliveryMethodScreen
  (PICKUP↔DELIVERY toggle зөв ажиллав) → AddressScreen (**flutter_map
  OSM tile бодитоор ачаалж Улаанбаатарын газрын зураг харагдав, Nominatim
  хайлт "Sukhbaatar" гэж бичихэд бодит Cyrillic үр дүн (Сүхбаатар аймаг
  г.м.) буцаав, газрын зургийг чирэхэд төвийн pin тогтмол үлдэж зөвхөн
  дэвсгэр зураг шилжсэнийг screenshot-аар баталгаажуулав**) →
  OrderReviewScreen (нийт дүн `cartBranchValidationProvider`-аас зөв
  тооцогдов) → `POST /orders` бодитоор дуудагдаж → PaymentScreen (**бодит
  QR код `qr_flutter`-ээр зурагдав**, debug товч дээрх засвар хийсний
  дараа) → OrderSuccessScreen (WebSocket `order.payment_confirmed`-ээр
  автоматаар гарч ирэв) → 2.5 секундын дараа автомат шилжилт →
  OrderTrackingScreen (`OrderStatusTimeline` зөв зурагдав) →
  **staff эрхээр (`PATCH /orders/:id/status` → CONFIRMED) backend-ээс
  шууд дуудаж, апп ДАХИН АЧААЛАХГҮЙгээр (зөвхөн WebSocket `order.
  status_changed` event-ээр) дэлгэц дээрх timeline бодит цагт "Баталгаажлаа"
  алхам руу шинэчлэгдэхийг screenshot-оор баталгаажуулав** — энэ бол
  бүхэл Cart→Checkout→QPay→бодит цагийн архитектурын хамгийн чухал
  батламж. Light/Dark хоёуланд нь (Тохиргоо дэлгэцээр сольж) Cart/
  BranchSelection/DeliveryMethod/AddressScreen дэлгэцүүдийг screenshot-оор
  харьцуулж, cobalt-indigo дизайны палет хоёр горимд адил цэвэрхэн
  харагдахыг нотолсон. ⚠️ **Turших явцад олдсон, кодтой шууд холбоогүй
  орчны зөвлөмжүүд:** (1) `adb shell input text` Cyrillic тэмдэгт огт
  дэмждэггүй (KeyEvent-д суурилсан симуляци тул зөвхөн идэвхтэй keyboard
  layout-д байгаа тэмдэгтийг л явуулж чаддаг, Android-ийн танигдсан
  хязгаарлалт) — Cyrillic UI текст бичих турших шаардлагатай бол Redis/DB
  руу шууд бичих эсвэл Latin түлхүүр үг ашиглах хэрэгтэй. (2) `adb shell
  cmd uimode night <yes|no>` систем түвшний horим сольсон нь Flutter-ийн
  Impeller GPU renderer-тэй хослохдоо screenshot foolage-г түр
  гажуудуулсан (апп доторх Тохиргоо дэлгэцээр өнгө сольсон нь ийм
  асуудалгүй) — систем түвшний horим биш апп доторх theme toggle-ийг
  ашиглах нь илүү найдвартай. (3) Riverpod-ийн `AsyncNotifierProvider`
  (autoDispose БИШ, `cartProvider` шиг) апп бүхэл ажиллах хугацаанд НЭГ
  удаа л `build()`-ээ дуудаж кэшилдэг тул Redis/DB-д гаднаас шууд бичсэн
  өөрчлөлт апп-ийн аль хэдийн үүссэн provider instance-д ХАРАГДАХГҮЙ
  (зөвхөн апп доторх action, жиш `CartNotifier.setQuantity()`, шинэ
  утгаар state-ээ ШУУД дарж бичдэг тул харагдана) — E2E турших/debug
  хийхдээ гаднаас өгөгдөл өөрчилсний дараа апп-ыг бүрэн (`force-stop`
  + дахин `start`) дахин ачаалах ёстойг санах.
- **(2026-08-21) AddressScreen — захиалагчийн бодит GPS байршлыг анхны pin
  болгож ашиглах дууссан** (§7 модуль #5-ийн үргэлжлэл, ⚠️ доорх backlog-ийн
  "geolocation auto-routing" (хамгийн ойрхон салбар АВТОМАТААР сонгох)-той
  ОГТ ХОЛБООГҮЙ — энэ бол зөвхөн DELIVERY хаягийн pin-ийг эхлүүлэх зорилготой,
  тэр backlog зүйл хэвээрээ үлдсэн): `geolocator: ^14.0.3` dependency,
  Android (`ACCESS_FINE_LOCATION`/`ACCESS_COARSE_LOCATION`)/iOS
  (`NSLocationWhenInUseUsageDescription`) зөвшөөрөл нэмэгдэв.
  `features/checkout/data/location_service.dart` (`LocationService` —
  `CartRepository`/`CatalogRepository`-тэй ижил DI Provider загвар, geolocator-ийн
  static метод шууд дуудахын оронд widget тестэд орлуулах боломжтой
  болгосон). `AddressScreen.initState()`-д зөвшөөрөл асууж, зөвшөөрөгдвөл
  `LocationAccuracy.medium`-аар GPS байршил авч pin/газрын зургийн төвийг
  ЭНЭ рүү шилжүүлнэ; татгалзсан/алдаа гарвал ХУУЧИН fallback (сонгосон
  салбар → тодорхойгүй бол хотын төв) хэвээр ажиллаж, апп хэзээ ч блокдохгүй
  (`_locationResolving` flag-аар салбарын fallback-effect-ийг GPS оролдлого
  дуустал түр зогсоож, "анивчих" зөрчлөөс сэргийлсэн). "Миний байршил руу
  очих" `FloatingActionButton.small` (`Icons.my_location`, газрын зургийн
  буланд) — дахин дуудахад л алдааны SnackBar ("Байршил тодорхойлж
  чадсангүй") харуулна, ачааллах үед FAB дотроо өөрөө жижиг spinner
  (тусдаа overlay нэмээгүй). Тест: `test/support/fake_location_service.dart`
  (granted/denied/error 3 тохиолдол) + `address_screen_test.dart`-д 4 шинэ
  widget тест (GPS амжилттай/татгалзсан/өөр алдаа/FAB дахин дуудах).
  ⚠️ **Чухал нээлт (Android emulator дээр бодитоор турших үед илэрсэн,
  кодын алдаа БИШ):** Android emulator-ийн симуляцлагдсан GPS-ийн "cold
  start" (эхний, идэвхгүй байснаас хойшхи) хүсэлт ихэвчлэн (энэ орчинд
  давтан ажиглагдсан) МУУДАГ (татгалзаагүй ч, `getCurrentPosition()`
  дотооддоо алдаа шидэж чимээгүй fallback руу орно) — жинхэнэ утасны GPS
  чипийн "Time-To-First-Fix" (TTFF) үзэгдэлтэй адилтгаж болно, real
  device дээр ихэвчлэн сүлжээ-туслалцаатай (network-assisted) хурдан fix
  авдаг тул ийм зэрэгцээ саатал ажиглагдахгүй байх магадлалтай. Гэвч
  APP-ийн ХЭДИЙ НЭГ удаа амжилттай GPS хүсэлт хийсний ДАРАА (жиш: "Миний
  байршил руу очих" товч дарсны дараа) дараагийн хүсэлтүүд (тэр ч байтугай
  ШИНЭ `AddressScreen` instance дээр ч) бас л ижил "эхний удаагийн"
  саатлыг дахин үзүүлж болохыг ажиглав (жиш: emulator-ийг удаан идэвхгүй
  орхисны дараа) — өөрөөр хэлбэл найдвартай бус, харин "Миний байршил руу
  очих" FAB **яг ийм тохиолдолд зориулсан сэргээх механизм** болж бодитоор
  ажилласныг Android emulator дээр (`adb emu geo fix <lng> <lat>`-ээр
  байршил тохируулж) screenshot-оор баталгаажуулсан. **Сургамж:** GPS
  timeout/warm-up-той холбоотой "заримдаа удаа/бүтэлгүйтдэг" зан төлөв
  ХАРИЛЦАГЧИЙН талд аюулгүй (chimeeгүй fallback + гараар сэргээх товч)
  тул кодыг цаашид тохируулах (жиш: retry logic автоматжуулах) ШААРДЛАГАГҮЙ
  гэж үзсэн — даалгаврын анхны зааврын "1-2 секунд" гэсэн урьдчилсан
  таамаглал бодит утсанд илүү нийцтэй байх магадлалтай, зөвхөн emulator-ийн
  симуляцлагдсан GPS-д илүү удаан татагдсан гэж дүгнэв.
  ✅ **Android emulator дээрх баталгаажуулалт (light+dark):** `adb pm revoke`-оор
  зөвшөөрөл цуцалж → AddressScreen нээхэд дахин зөвшөөрлийн prompt гарч,
  "Don't allow" дарахад алдаагүйгээр хуучин fallback (хотын төв pin) руу
  шилжсэнийг screenshot-оор баталгаажуулав (light горим) → тэр TÖлөвт FAB
  дарахад "Байршил тодорхойлж чадсангүй" SnackBar зөв харагдав → зөвшөөрөл
  дахин олгож (`adb pm grant`), "While using the app" сонгоод, эхний
  оролдлого дээрх TTFF-ийн улмаас хотын төвд буцаад, харин FAB-аар дахин
  дуудахад `emu geo fix`-ээр тохируулсан GPS координатад (өргөн гудамжны
  нэр/дэлгүүрийн icon зэрэг street-level нарийвчлалтай) ЯГ тохирсон
  байршилд шилжсэнийг баталгаажуулав → Тохиргоо дэлгэцээр dark горимд
  сольж, FAB болон fallback дэлгэцийг dark горимд screenshot-оор мөн
  баталгаажуулсан (контраст зөв). `flutter analyze` 0 алдаа, `flutter
  test` бүх (74/74) тест ногоон.
- **(2026-08-21) Захиалгын түүх, Буцаалт хүсэх, Профайл + Mobile
  навигацийг цэгцлэх дууссан** (§7 модуль #6, #9 — CUSTOMER-ийн талыг
  ЭНЭ Phase-д гүйцээв, "Харилцагчийн буцаалт хүсэх зөвхөн API/e2e
  түвшинд шалгасан, Flutter UI ороогүй" гэсэн өмнөх тэмдэглэл ЭНЭ
  Phase-ээр хуучирсан):
  - **Хэсэг A (навигаци):** `lib/app/router.dart`-ийг `StatefulShellRoute.
    indexedStack`-руу шинэчилж (`MainShell` widget, Material 3
    `NavigationBar`, 4 branch: `/home`/`/catalog`/`/orders`/`/profile`)
    доод navigation bar нэмэв — гүнзгий route-ууд (`/orders/:id`,
    `/orders/:id/return`, `/products/:id` гэх мэт) shell-ийн ГАДНА,
    bottom nav-гүй бүтэн дэлгэц хэвээр (Android emulator дээр screenshot
    цуврал баталгаажуулсан). Сагсны icon (badge-тэй) шинэ
    `lib/app/widgets/cart_app_bar_action.dart`-д нэгтгэж 4 tab-ийн
    AppBar бүрд (`HomeScreen`/`CatalogScreen`/`OrderListScreen`/
    `ProfileScreen`) дахин ашигласан — HomeScreen-ийн хуучин Тохиргоо/
    Гарах icon-ыг ProfileScreen рүү зөөв.
  - **Хэсэг B (захиалгын түүх):** `features/orders/` шинэ модуль —
    `OrderListScreen` (`GET /orders`, идэвхтэй/түүх 2 бүлэг, skeleton/
    empty/error 3 төлөв, pull-to-refresh, `OrderListCard`: дугаар
    (`OrderSummaryCard.shortOrderId()` дахин ашигласан)/огноо/дүн/
    `OrderStatusBadge`/барааны товч жагсаалт "Бүтээгдэхүүн Вариант ×N
    +M өөр"). ⚠️ **Backend өргөтгөл:** `order.service.ts`-ийн
    `findAll`/`findOne`-ийн `items` include-д `variant: { include:
    { product: true } }` нэмэв (ADR 005: Product/ProductVariant аль
    аль нь `*_select` RLS-ээр бүх нэвтэрсэн хэрэглэгчид нээлттэй тул
    шинэ SECURITY DEFINER функц/RLS өөрчлөлт ШААРДАГГҮЙ) — Mobile-ийн
    `OrderItemLine`-д `id`/`productName`/`variantName`/`displayName`
    нэмэв, `OrderDetail`-д `createdAt`/`completedAt`/`canRequestReturn`
    (7 хоногийн цонх, backend-ийн `RETURN_WINDOW_DAYS`-тэй ЯГ тохирсон
    UI-ийн урьдчилсан шийдвэр).
  - **Хэсэг C (буцаалт хүсэх):** `features/returns/` шинэ модуль —
    `OrderTrackingScreen`-д COMPLETED захиалганд `_ReturnSection`:
    буцаалт байхгүй бол "Буцаалт хүсэх" товч (`canRequestReturn`),
    байвал хамгийн сүүлийн (`requestedAt`) хүсэлтийн `ReturnStatusBadge`
    (slate/blue/red/emerald/amber, `AvailabilityBadge`-тэй ЯГ ижил
    brightness-based хатуу өнгөний загвар — эдгээр семантик өнгө
    `Theme.colorScheme`-д байхгүй тул). `ReturnRequestScreen`: item
    сонголт (checkbox, идэвхтэй/REFUNDED буцаалттай item идэвхгүй),
    шалтгаан (заавал), "Илгээх" → `POST /returns` (олон item сонговол
    дараалан дуудна, DTO нэг мөрөөр л хүлээн авдаг тул) → SnackBar →
    `context.pop()` → tracking дэлгэц дээр badge шууд харагдана.
    WebSocket `return.status_changed` (аль хэдийн байсан event, Phase
    3c-ээс) `orderReturnsProvider`-ийг invalidate хийж staff зөвшөөрөх/
    татгалзахад badge бодит цагт шинэчлэгддэг.
  - **Хэсэг D (профайл):** `features/profile/` — утасны дугаар, "Тохиргоо"
    (одоо байгаа `/settings`), "Гарах" (HomeScreen-ээс зөөв).
  - ⚠️🔴 **Ноцтой олдвор — backend-ийг бүхэлд нь унагаадаг байсан,
    ЭНЭ ажлын шууд өргөтгөлөөс болж дэлгэгдсэн (гэхдээ язгуур нь
    ӨМНӨ ЧЬ БАЙСАН) production-хэлбэрийн асуудал:** тестийн
    `+97688112233` (Mobile emulator баталгаажуулалтад тогтмол дахин
    ашигладаг акаунт, `[[dev-test-customer-account]]` санах ойг үз)
    dev DB-д **7758 захиалга** хуралт (олон удаагийн туршилтын debris,
    2 хоногийн дотор) хуримтлагдсан байсныг олов. `GET /orders`-ийн
    pagination байхгүй (санаатай, backlog-д тэмдэглэсэн шийдвэр) дээр
    дээрх `variant`/`product` join нэмэгдсэнээр 7758 мөрийн query
    RlsMiddleware-ийн interactive transaction-ийн 5000ms timeout-ийг
    ДАВСАН (6000-6200ms) — энэ нь `rls.middleware.ts`-ийн ӨМНӨ НЬ
    БАЙСАН, огт ӨӨР (`ERR_STREAM_WRITE_AFTER_END`, timeout-ийн дараа
    хариу бичихийг оролдох) алдааны боловсруулалтын цоорхойг өдөөж,
    **бүхэл Node процессыг унагаасан** (2 удаа тусад нь давтан
    баталгаажуулсан). Яаралтай засвар (энэ ажлын хамрах хүрээнээс
    гадуур том рефактор — `RlsMiddleware`-ийн timeout-ийн алдааны
    боловсруулалтыг бүрэн засах — тул хийгээгүй): dev DB-ийн энэ
    debris-ийг **хэрэглэгчийн зөвшөөрлөөр** шууд SQL-ээр (`DELETE FROM
    orders WHERE "customerId"='...'`, `return_requests` холбоогүй эсэхийг
    урьдчилж баталгаажуулсан) цэвэрлэж шийдвэрлэв — 7758-аас 0 болгосны
    дараа `GET /orders` 0.1с-д багтав. Дэлгэрэнгүй (яагаад дахин гарч
    болзошгүй, яаж шалгах): `[[dev-test-customer-account]]` санах ой.
    **Branch debris мөн давхар дэлгэгдсэн** (өмнө нь баримтжуулсан,
    удаан хугацаанд дахин цэвэрлэгдээгүй) — `pnpm --filter api run
    cleanup:branch-debris`-ийг дахин ажиллуулж 45→1 идэвхтэй Branch
    болгов (`docs/plan.md`/CLAUDE.md-ийн "Branch debris цэвэрлэлт"
    хэсгийн зөвлөсөн "тогтмол давтамжтай дахин ажиллуулж болно" зарчмыг
    практикт нотолсон жишээ).
  - ✅ **Android emulator дээрх баталгаажуулалт (`+97688112233`
    акаунтаар, light+dark):** нэвтрэх → 4 tab-ийн доод navigation bar
    зөв ажиллаж (Нүүр/Каталог/Захиалгууд/Профайл), сагсны icon
    badge-тэй бүх tab-д хадгалагдав → бодит checkout (Ariel угаалгын
    нунтаг, "Мобайл демо салбар", PICKUP, mock төлбөр симуляц) хийж
    шинэ захиалга үүсгэв → Postgres руу шууд орж (`UPDATE orders SET
    status='COMPLETED'`) COMPLETED болгов → апп-ыг force-stop+дахин
    ачаалсны дараа (Riverpod-ийн кэшийн зарчмын дагуу) Захиалгууд tab-д
    "Түүх" бүлэгт ногоон "Дуссан" badge-тэй карт, барааны нэр ("Ariel
    угаалгын нунтаг 3кг ×1"), дүн зөв харагдав → карт дээр дарж
    OrderTrackingScreen-д бүх алхам гүйцэтгэсэн timeline + "Буцаалт
    хүсэх" товч харагдав → товч дарж item сонгож, шалтгаан бичиж
    Илгээхэд SnackBar + автомат буцаж badge ("Хүсэлт гаргасан") шууд
    солигдов → Профайл tab (утасны дугаар, Тохиргоо, Гарах) → Тохиргоо
    → Гэрэл горимд сольж дээрх бүх дэлгэцийг (Захиалгууд/Захиалгын явц/
    Профайл) дахин screenshot-оор баталгаажуулав (контраст зөв, cobalt-
    indigo палет хоёр горимд адил цэвэрхэн). `flutter analyze` 0 алдаа,
    `flutter test` 87/87 (шинэ: `main_shell_test.dart`,
    `order_list_screen_test.dart`, `order_list_provider_test.dart`,
    `return_request_screen_test.dart`, `profile_screen_test.dart`).
    Backend: `order.service.spec.ts` 13/13, `test/orders.e2e-spec.ts` +
    `test/returns.e2e-spec.ts` 39/39 (бүтэн e2e suite 132/137 — 5 алдаа
    зөвхөн `delivery-routing.e2e-spec.ts`-д, амьд OSRM public demo
    сервертэй харьцуулалт, ЭНЭ ажилтай ХОЛБООГҮЙ, `docs/adr/007`-ийн
    мэдэгдэж буй хязгаарлалт).
- **(2026-08-21) Урамшуулал/купон (§7 модуль #10) дууссан** (backend +
  admin-web + Mobile, §6.1 матрицын "Урамшуулал/купон" мөрийг код болгов:
  SUPER_ADMIN CRUD, OWNER RU, ALL_BRANCH_MANAGER CRUD (бүх), BRANCH_ADMIN
  R, BRANCH_MANAGER/SALESPERSON "—", CUSTOMER R зөвхөн идэвхтэй+хугацаанд
  байгаа мөр):
  - **Backend:** `Coupon`/`CouponRedemption` Prisma загвар + 2 migration
    (`add_coupons` — схем, `enable_coupons_rls` — RLS policy + шинэ
    `app_redeem_coupon()` SECURITY DEFINER функц). `src/coupons`
    (`CouponService`/`Controller`) — `GET/POST/PATCH/DELETE /coupons`,
    `GET /coupons/validate?code=&orderAmount=` (мутациГҮЙ, checkout-ийн
    ӨМНӨ харилцагч урьдчилан шалгах зорилготой, `CouponService.
    validateForCheckout()`-г checkout-той хамт дахин ашигладаг — ADR
    005-ийн "ганц газар л шийднэ" зарчим). `Order.couponCode`/
    `discountAmount` талбар (RETURN_FEE_PERCENT/refundAmount-тай ижил
    "snapshot" зарчим — купон дараа нь өөрчлөгдсөн ч захиалгын түүхэн
    дүн хэвээр үлдэнэ).
    ⚠️ **Чухал загварын шийдвэр — coupons_select RLS-д CUSTOMER-ийг
    BRANCH_MANAGER/SALESPERSON-ээс ("—") ялгах арга:** CUSTOMER
    хэрэглэгчид ХЭЗЭЭ Ч `user_branch_roles` мөр байдаггүй (branch/
    order.service.ts-ийн `app_public_branches()`-ийн адилхан нээлт) тул
    "user_branch_roles-д ЯМАР Ч мөргүй = CUSTOMER" гэдгийг шошго болгон
    ашиглав: `NOT EXISTS (SELECT 1 FROM user_branch_roles WHERE
    "userId" = app_current_user_id())` нөхцөлтэй мөрд л (`isActive=true
    AND now() BETWEEN validFrom AND validTo`) SELECT зөвшөөрнө. Мөн
    OWNER-д Create/Delete байхгүй (SUPER_ADMIN/ALL_BRANCH_MANAGER-аас
    ЯЛГААТАЙ) тул `app_has_global_scope()`-г (SUPER_ADMIN/OWNER/
    ALL_BRANCH_MANAGER-ыг адилхан хамардаг) coupons_insert/delete-д
    ашиглаж болохгүй — эдгээрт inline `role IN ('SUPER_ADMIN',
    'ALL_BRANCH_MANAGER')` (`branchId IS NULL`) шалгалт ашигласан,
    харин coupons_update-д (SUPER_ADMIN/OWNER/ALL_BRANCH_MANAGER гурав
    аль аль нь U эрхтэй тул) `app_has_global_scope()` ЯГ таарсан.
    ⚠️ **Race-ийн хамгаалалт (usageCount хэзээ ч usageLimit-ээс
    хэтрэхгүй байх, даалгаврын шууд заавар) — returns PR #7-ийн "claim"
    (`updateMany` + status шалгалт) загвараас ЗОРИУДАА ӨӨР арга сонгосон:**
    `app_redeem_coupon()` дотор `SELECT ... FOR UPDATE`-ээр coupons мөрийг
    шууд түгжинэ (зэрэг ирсэн 2 дахь дуудлага энэ мөр чөлөөлөгдтөл —
    RlsMiddleware-ийн бүхэл хүсэлтийн транзакц COMMIT/ROLLBACK хийгдэх
    хүртэл, ADR 001 — блоклогдоно), дараа нь committed `usageCount`/
    `usageLimitPerCustomer`-ийг харж шийднэ. Учир нь энд (буцаалтаас
    ЯЛГААТАЙ) хоёр тусдаа нөхцөл (нийт usageLimit БОЛОН тухайн
    хэрэглэгчийн `usageLimitPerCustomer`) НЭГ л түгжигдсэн цонхон дотор
    удаа дараалан шалгагдах ёстой байсан тул "УPDATE...WHERE" нэг
    илэрхийлэл хангалтгүй байв. `CouponRedemption`-ий
    `@@unique([couponId, customerId])` нь `usageLimitPerCustomer=1`
    (MVP-ийн цорын ганц дэмжигдсэн утга) үед DB түвшний нэмэлт
    хамгаалалт өгдөг ч, `usageLimitPerCustomer > 1` тохиолдолд зөвхөн
    функц доторх `COUNT()` шалгалт л хамгаална (schema.prisma-д
    тэмдэглэсэн мэдэгдэж буй хязгаарлалт, backlog).
    ⚠️ **Checkout-ийн дараалал (`OrderService.checkout()`):** invoice
    (`PaymentProvider.createInvoice()`) үүсгэхээс ӨМНӨ (READ-ONLY)
    `CouponService.validateForCheckout()`-оор subtotal-аас хямдрал
    тооцож эцсийн (хямдарсан) дүнгээр л төлбөрийн invoice үүсгэдэг —
    харилцагч ХЭЗЭЭ Ч хямдралгүй дүнгээр төлдөггүй. Бодит "redeem"
    (`app_redeem_coupon()` дуудах) нь withSavepoint дотор, Order мөр
    аль хэдийн үүссэний ДАРАА л явагдана (функцийн "p_order_id нь
    p_customer_id-ийн ЖИНХЭНЭ захиалга байх ёстой" зөвшөөрлийн шалгалт
    үүнийг шаарддаг) — race-д ялагдвал (0 буцвал) ConflictException
    шидэж withSavepoint-ийг бүхэлд нь ROLLBACK хийлгэнэ (Order/
    OrderItem/inventory decrement бүгд буцна), гэхдээ (checkout-ийн
    orphaned-invoice эрсдэлтэй ЯГ адил, ADR 006-д аль хэдийн тэмдэглэсэн)
    invoice талд "эзэнгүй" үлдэж болзошгүй — MVP-д зөвшөөрөгдөх эрсдэл.
    ⚠️ **`prisma/cleanup-debris.ts`-д олдож, ЗАСАГДСАН шинэ FK асуудал:**
    `CouponRedemption.orderId`-ийн `onDelete: Restrict` тул debris Order
    устгах script (`cleanupOrders()`) coupon redemption-той debris Order
    дээр `Foreign key constraint violated: coupon_redemptions_orderId_fkey`
    алдаагаар унасныг e2e тестийн дараа script-ийг бодитоор ажиллуулж
    олов — `ReturnRequest`-ийг эхэлж устгадагтай ЯГ ижил зарчмаар
    `CouponRedemption`-ийг Order устгахаас ӨМНӨ эхэлж устгадаг болгож
    засав (`Coupon.usageCount`-ыг ЗОРИУДАА буцааж бууруулаагүй —
    debris Order-ийн купон хэрэглэлт бодитоор "хэрэглэгдсэн" явдал
    хэвээр байсан гэж үзсэн).
    Тест: unit (`coupon-discount.util.spec.ts` — PERCENTAGE/FIXED_AMOUNT/
    maxDiscountAmount/сөрөг дүн хамгаалалт, `coupon.service.spec.ts` —
    validateForCheckout-ийн бүх татгалзах зам, create/update validation)
    + e2e (`test/coupons.e2e-spec.ts`, 18 тест: RBAC 7 дүр тус бүрээр,
    coupons_insert/update RLS policy-г шууд SQL-ээр (INSERT алдаа
    шиддэг, UPDATE 0 мөр өөрчилдөг — CLAUDE.md-ийн "Тестийн стандарт"
    зарчмын дагуу), `GET /coupons/validate`-ийн бүх алдааны зам, checkout
    нэгтгэл, **ЗААВАЛ шаардлагатай race-тест: Promise.all-аар ЗЭРЭГ 2 ӨӨР
    хэрэглэгч сүүлчийн 1 ашиглалттай купон дээр checkout хийхэд ЗӨВХӨН
    НЭГ нь 201, нөгөө нь 409, `usageCount` хэзээ ч 1-ээс хэтрээгүй,
    `coupon_redemptions` яг 1 мөртэй** гэдгийг баталгаажуулсан).
  - **Admin-web:** `/coupons` дэлгэц (`CouponsPage.tsx`) — жагсаалт
    (код, хямдрал, ашиглалт X/Y, хугацаа, "Идэвхгүй"/"Хугацаа дууссан"
    badge), `CouponDialog.tsx` (Нэмэх/Засах, PERCENTAGE/FIXED_AMOUNT
    сонголт, `datetime-local` input-ууд) — Category/Product-той ЯГ ижил
    "Устгах товч ЗОРИУДАА байхгүй, зөвхөн isActive toggle" зарчим
    (backend-д `DELETE /coupons/:id` route байгаа ч admin-web UI-д
    дуудагдахгүй). `roles.ts`-д `COUPON_CREATE_ROLES`/`COUPON_UPDATE_ROLES`
    (backend-ийн `@Roles()`-той ЯГ тохирсон). Vitest+RTL smoke тест
    (`CouponsPage.test.tsx` — role-оор "Купон нэмэх" товч харуулах/нуух).
  - **Mobile:** `features/coupons/` (`CouponRepository`/`CouponValidation`,
    checkout_repository.dart/checkout_result.dart-тай ижил DI+JSON загвар)
    — `OrderReviewScreen`-д "Купон код" талбар + "Ашиглах"/"Хасах" товч:
    амжилттай бол шугамдсан дэд дүн + "Хямдрал (КОД)" мөр + шинэ (бодит,
    `CouponValidation.discountAmount`-аас тооцсон, зөвхөн ХАРУУЛАХ
    зорилготой ойролцоо) нийт дүн харагдана — эцсийн жинхэнэ dutn/
    discount ГАНЦ газар (backend) л шийддэг зарчим (ADR 005) энд ч
    хэвээр: checkout амжилттай болмогц `CheckoutResult.discountAmount`
    (бодит) нь UI-ийн урьдчилсан тооцоог орлоно. Алдаатай код бол
    backend-ийн монгол алдааны мессежийг (`error.message`, тусдаа map
    шаардлагагүй) талбарын дор шууд харуулна. Widget тест: 2 шинэ (хүчинтэй
    код амжилттай, алдаатай код) `order_review_screen_test.dart`-д, `test/
    support/fake_coupon_repository.dart` (Dio-г бүрэн тойрсон fake).
  `flutter analyze` 0 алдаа, `flutter test` 93/93. Backend: `pnpm --filter
  api test` 41/41 suite (261/261), `test:e2e` 15/16 suite (154/155 — ганц
  алдаа зөвхөн `delivery-routing.e2e-spec.ts`-ийн амьд OSRM demo
  харьцуулалт, дээрх адил ХОЛБООГҮЙ). admin-web: `vitest` 13/13 suite
  (29/29), `tsc -b`/`oxlint`/`vite build` цэвэр.
- **(2026-08-25/26) super.admin-ийн Postgres users мөр дутуу байсан
  инцидент → оношилгоо + засвар + сэргийлэлт (Ажилтны удирдлага, Аудит
  лог UI, JWT decode аюулгүй байдлын аудит) дууссан**:
  - **Инцидент диагноз/засвар:** `super.admin@order-system.mn`-ээр
    admin-web-д нэвтэрхэд "Эрх оноогдоогүй" гарч байсныг 3 давхаргаар
    (Keycloak `local_user_id` attribute → Postgres `users` мөр → `audit_logs`)
    дараалан шалгаж, `users` мөр (зөвхөн `user_branch_roles` биш) бүхэлдээ
    байхгүй байсныг олов. **Язгуур шалтгаан цэвэрлэлтийн script (`cleanup-debris.ts`)
    БИШ** гэдгийг батлав (script `users`/`user_branch_roles`-д огт хүрдэггүй,
    `User` модель схемийн root тул cascade-delete зам байхгүй) — харин
    `infra/keycloak/setup-realm.sh`-ийн 3 алхамт ГАР журмаас 1/3-р алхам
    (Postgres тал) хийгдээгүй, зөвхөн Keycloak тал л тохируулагдсан дутуу
    гар тохиргоо байв. Дутуу 2 мөрийг superuser холболтоор нөхөж, `curl`
    (login→/auth/me→roles) БОЛОН Playwright (admin-web дээр бодитоор
    нэвтэрч Агуулах/Захиалгууд/Буцаалтууд 3 дэлгэц) хоёуланд нь
    баталгаажуулав. Дэлгэрэнгүй (schema/audit_logs-ийн нотолгоо,
    засварын SQL): `docs/adr/002-jwt-identity-only-authorization-from-db.md`-ийн
    "Инцидент (2026-08-25)" хэсэг.
  - **Хэсэг A (JWT decode аюулгүй байдлын аудит, шаардсан):** `decodeJwt`
    (verify-гүй, `jose`) ашигладаг 3 газрыг бүгдийг нь (`grep`) шалгаж,
    **ГУРВУУЛАНГ НЬ АЮУЛГҮЙ** гэж баталгаажуулав: (1)
    `token-verifier.service.ts`-ийн `decodeJwt(rawToken).iss` нь КЛИЕНТЭЭС
    ирсэн Authorization header дээр ажилладаг цорын ганц газар боловч,
    зөвхөн HS256/RS256 аль замаар баталгаажуулахаа сонгох "чиглүүлэлт"
    зорилготой — бодит `localUserId` ХЭЗЭЭ Ч ЭНЭ decode-оос биш, дараагийн
    `jwtVerify()` (гарын үсэг + issuer бүрэн шалгасан) payload-аас л ирдэг;
    (2) `auth-staff.controller.ts`/`auth-customer.controller.ts`-ийн
    `recordIdFromIssuedToken()` хоёул `@Audit()`-ийн `recordId`-д зориулж
    зөвхөн **backend ӨӨРӨӨ дөнгөж гаргасан (клиентээс огт ирээгүй) response
    body**-ийн `accessToken`-г л decode хийдэг (audit.interceptor.ts-ийн
    `concatMap(async (responseBody) => ...)`-аар баталгаажуулсан — 2-р
    параметр нь ХАРИУ, хүсэлт биш). **Ноцтой асуудал олдоогүй, шинэ засвар
    шаардлагагүй гэдгийг тодорхой баталгаажуулав.**
  - **Хэсэг B (Ажилтны удирдлага, backlog-ийн "Staff/ажилтны удирдлагын
    UI" даалгавар):** migration `add_staff_management_functions` — шинэ
    `app_can_manage_staff(branchId)` (BRANCH_MANAGER-ыг ЗОРИУДАА ХАСНА,
    `app_can_manage_branch()`-аас өөр учир §6.1 матриц/даалгаврын заавар
    "ажилтан удирдах эрх зөвхөн SUPER_ADMIN/ALL_BRANCH_MANAGER/тухайн
    салбарын BRANCH_ADMIN") + `app_create_staff_member()`/
    `app_update_staff_member()` SECURITY DEFINER функц (ADR 005 WRITE
    ангилал — `users_insert`/`ubr_insert` одоо байгаа RLS аль аль нь энэ
    endpoint-ийн шаардлагад тохирохгүй байсан: эхнийх нь branch-scoped
    дуудагчид өөр хэрэглэгчийн мөр огт insert хийх зөвшөөрдөггүй, хоёр
    дахь нь BRANCH_MANAGER-ыг ч зөвшөөрдөг тул хэт өргөн). `src/staff`
    (`KeycloakAdminService`, `StaffService`, `StaffController`) —
    `POST /staff` нь `infra/keycloak/setup-realm.sh`-ийн 3 гар алхмыг
    (яг ЭНЭ инцидентийг дахин үүсгэхээс сэргийлэх зорилготой) НЭГ АТОМИК
    код зам болгож нэгтгэв: Keycloak хэрэглэгч олдвол дахин ашиглаж,
    олдоогүй бол шинээр үүсгээд `local_user_id` attribute + түр (random,
    `temporary=false` — ROPC required-action дэмждэггүй тул) нууц үг
    тохируулаад, ТҮҮНИЙ ДАРАА Postgres талыг (`users`+`user_branch_roles`
    ХАМТ) SQL функцээр бичнэ; Postgres тал REJECT (`FORBIDDEN` буцаах
    ЭСВЭЛ email давхардлын алдаа) хийвэл, **ЗӨВХӨН ЭНЭ дуудлагаар ШИНЭЭР
    үүссэн** Keycloak хэрэглэгчийг rollback (устгах)-аар цэвэрлэнэ (олдож
    ДАХИН АШИГЛАСАН хуучин Keycloak хэрэглэгчийг хэзээ ч устгахгүй).
    ⚠️ **Шинэ escalation зам олдож, урьдчилан хаасан:** `RolesGuard`/
    `resolveUserRoleNames()` `role`-ийг ЗӨВХӨН НЭРЭЭР шалгадаг,
    `branchId`-тай хамт шалгадаггүй (`app_has_global_scope()`-ийн
    "branchId IS NULL AND role IN (...)"-ээс ЯЛГААТАЙ) гэдгийг олов —
    хэрэв branch-scoped (BRANCH_ADMIN) дуудагчид `role='SUPER_ADMIN'`
    (branchId-той ч) оноох боломж олговол, тэр хэрэглэгч ЖИНХЭНЭ
    `app_has_global_scope()`-аар хамгаалагдсан зүйлд хандахгүй ч, ЗӨВХӨН
    `@Roles('SUPER_ADMIN')`-ээр хамгаалагдсан (нэмэлт RLS-гүй) ямар ч
    endpoint-ыг дуудах боломжтой болно байсан — `app_create_staff_member()`/
    `app_update_staff_member()` аль алинд нь branch-scoped дуудагчийг
    глобал нэртэй role (SUPER_ADMIN/OWNER/ALL_BRANCH_MANAGER) оноохоос
    ЗААВАЛ хориглодог болгож хаав, `roles.guard.ts`-д ирээдүйд ижил
    endpoint зохиогчдод зориулсан ⚠️⚠️ коммент нэмэв. `GET /staff` (`role`/
    `branchId`-аар шүүх), `PATCH /staff/:id` (дүр/салбар сольж, isActive
    idэвхжүүлэх/идэвхгүй болгох — Category/Product-той ижил "Устгах
    товчгүй" зарчим). Admin-web: `/staff` дэлгэц (жагсаалт+Нэмэх/Засах
    dialog), `temporaryPassword`-ийг ЗӨВХӨН НЭГ Л УДАА (dialog хаагдтал)
    харуулна — хаана ч (Postgres/Keycloak) хадгалагдахгүй. Тест: unit
    (`staff.service.spec.ts`, `keycloak-admin.service.spec.ts` — HTTP mock)
    + **e2e (`test/staff.e2e-spec.ts`, 10 тест, БОДИТ Keycloak+Postgres-той:
    амжилттай атомик үүсгэлт, BRANCH_ADMIN cross-branch/escalation оролдлого
    ХОЁУЛАНГ нь 403+Keycloak rollback-аар баталгаажуулсан, Postgres email
    давхардлын rollback, RolesGuard gate, GET/PATCH)**.
    ⚠️ **prisma-errors.ts-ийн шинэ нээлт:** `$queryRaw`-аар дамжуулсан
    unique constraint violation Prisma-д typed `.create()`-ийн P2002 БИШ,
    `isCheckConstraintViolation()`-ийн раw-query gotcha-тай ЯГ ижил
    зарчмаар P2010 (`message`-даа л "23505" агуулсан) шидэх нь e2e тестээр
    батлагдсан — `isUniqueConstraintViolation()`-ыг хоёуланг нь шалгах
    болгож өргөтгөв (backward-compatible, P2002 хэвээр шалгасаар).
  - **Хэсэг C (Аудит лог UI):** `src/audit` (`AuditLogController`) — шинэ
    `GET /audit-logs` (`tableName`/`action`/`recordId`/`userId`/`from`/`to`/
    `limit` filter), шинэ RLS/SECURITY DEFINER функц ШААРДААГҮЙ (`audit_select`
    policy-г л дахин ашигласан). ⚠️ **§6.1 матрицын "Аудит лог" мөрийн
    "BRANCH_ADMIN R (өөрийн)" анхны төлөвлөгөө ОДООГООР бүрэн хэрэгжих
    боломжгүй гэдгийг олов** — `AuditInterceptor.writeAuditLog()`
    `branchId` баганыг ХЭЗЭЭ Ч populate хийдэггүй (INSERT-д үргэлж `null`)
    тул `audit_select`-ийн "branchId IS NOT NULL AND app_can_manage_branch()"
    нөхцөл ямар ч мөрд хэзээ ч биелэхгүй — иймд endpoint-ыг ЗОРИУДАА зөвхөн
    3 глобал-эрхийн дүрд (`@Roles('SUPER_ADMIN','OWNER','ALL_BRANCH_MANAGER')`)
    хязгаарлав (branch-scoped дүрд зөвшөөрвөл ЗӨВХӨН хоосон жагсаалт харагдах
    байсан тул тодорхой 403 өгөх нь илүү зөв). Admin-web: `/audit-logs`
    дэлгэц (ReportsPage-ийн ерөнхий Card+шүүлт загвар, chart/export
    зохиогоогүй). Тест: e2e (`test/audit-log.e2e-spec.ts`, 4 тест) +
    admin-web smoke (`AuditLogsPage.test.tsx`).
  - Backend: `pnpm --filter api test` 43/43 suite (276/276),
    `pnpm --filter api test:e2e` **CI дээр 18/18 suite (175/175), 100%
    ногоон** (`gh run view --json jobs`-ээр PR #23-ийн бодит CI логоос
    баталгаажуулсан). ⚠️ **Засвар (2026-08-26, анх буруу бичсэн):** энэ
    бичлэгийн анхны хувилбарт "17/18 suite (174/175) — ганц алдаа
    `delivery-routing.e2e-spec.ts`-ийн амьд OSRM demo, flaky" гэж
    буруу бичсэн байсан — энэ нь ЛОКАЛ `pnpm --filter api test:e2e`
    ажиллуулгын үр дүн байсныг CI-ийн үр дүн мэт андуурсан алдаа
    (тайлангийн алдаа, CI/кодын алдаа биш). Бодит шалтгаан: локал
    `apps/api/.env`-д `ROUTING_PROVIDER=osrm` (баримт бичгийн `docs/adr/007`-ийн
    заасан анхдагч `mock`-аас гажсан, өмнөх ямар нэг сешнд гар аргаар
    тавьсан) тохируулагдсан байсан тул `delivery-routing.e2e-spec.ts`-ийн
    `toEqual([[branch.lng,branch.lat],[106.93,47.925]])` гэсэн (2 цэгтэй,
    mock provider-т зориулсан) шалгалт бодит OSRM-ийн олон цэгт замын
    геометртэй **ЗААВАЛ (flaky биш, 100% детерминистаар)** зөрчилддөг —
    "заримдаа унадаг" биш, `ROUTING_PROVIDER=osrm` идэвхтэй бол ХЭЗЭЭ Ч
    амжилттай болохгүй. `ROUTING_PROVIDER=mock`-оор 20 удаа дараалан
    ажиллуулж 20/20 (200/200 тест) амжилттай болохыг тусад нь баталгаажуулсан.
    ⚠️⚠️ **Сануулга (ирээдүйд ижил төстэй "flaky" гэж яаравчлан бичихээс
    сэргийлэх):** `test/delivery-routing.e2e-spec.ts`-ийг ЛОКАЛ дээр
    ажиллуулахын өмнө `apps/api/.env`-ийн `ROUTING_PROVIDER` утга
    заавал `mock` эсэхийг шалга (`docs/adr/007`-ийн баримтжуулсан
    анхдагч, `.github/workflows/ci.yml`-ийн `ROUTING_PROVIDER: mock`-той
    таарна) — `osrm` бол ЭНЭ ТЕСТ детерминистаар (CI-той хамааралгүй,
    зөвхөн локал орчны тохиргооноос болж) унана, "flaky" гэж бүү дүгнэ.
    admin-web: `vitest` 15/15 suite (34/34), `tsc -b`/`oxlint`/`vite build`
    цэвэр. `feature/coupon-system` (аль хэдийн main-руу merge хийгдсэн
    хуучин branch) дээр биш, шинэ `feature/staff-management-and-security-hardening`
    (`origin/main`-аас) branch дээр хийгдэв.
  - **(backlog, шинээр нэмэгдсэн)** `AuditInterceptor.writeAuditLog()`-д
    `branchId`-г бөглөх (§6.1 матрицын "BRANCH_ADMIN R (өөрийн)" бүрэн
    хэрэгжүүлэх, `docs/plan.md` Phase 6-ийн checklist-д тэмдэглэв); staff
    удирдлагын dialog нэг ажилтны ГАНЦ (role, branchId) хосыг л удирдана
    (олон дүртэй ажилтныг бүрэн удирдах UI биш, MVP хэмжээнд зориудаар
    хязгаарласан); шинэ ажилтны түр нууц үгийг Keycloak
    `required action`-аар (ROPC биш browser-based auth урсгал нэмэгдвэл)
    сольж баталгаажуулах урсгал болгох боломж (одоогоор ROPC-ийн
    хязгаарлалтаас болж дэмжигдэхгүй).
  - **(2026-08-26 нэмэлт) Инцидентийн эцсийн БҮТЦИЙН хамгаалалт:**
    `user_branch_roles`-д `chk_global_role_no_branch` CHECK constraint
    нэмэв (migration `20260826070000_add_global_role_branch_check_constraint`)
    — "role∈{SUPER_ADMIN,OWNER,ALL_BRANCH_MANAGER} ⇔ branchId IS NULL"
    хослолыг код замаас (application/SECURITY DEFINER функц/RolesGuard)
    ҮЛ ХАМААРАН DB түвшинд бүрмөсөн хориглоно — `RolesGuard`-ийн role-ийг
    branchId-гүйгээр нэрээр нь л шалгадаг сул талыг (дээр дурдсан) ямар ч
    ирээдүйн код зам ашиглаж чадахгүй болгосон "сүүлчийн шугам". Migration-оос
    өмнө одоо байгаа өгөгдөл (1078 мөр) зөрчихгүй эсэхийг шалгаж
    баталгаажуулсан, гараар зөрчсөн INSERT оролдож 23514 алдаа шидэхийг
    psql-ээр батлав. `test/staff.e2e-spec.ts`-д 3 давхаргын тест нэмэв:
    PATCH-ийн HTTP escalation, SQL функцийн (DTO тойрсон) escalation,
    БОЛОН **service/SECURITY DEFINER функц АЛЬ АЛИНЫГ Ч тойрсон, шууд
    superuser raw INSERT-ээр constraint-ийг ӨӨРИЙГ нь** шалгасан 3 тест
    (глобал+branchId, салбарын+branchId-гүй хоёул 23514 шиднэ; зөв
    хослол хэвийн ажиллана). Дэлгэрэнгүй: `docs/adr/002`-ийн "Инцидентийн
    эцсийн, БҮТЦИЙН хамгаалалт (2026-08-26)" хэсэг.
- **(2026-08-26) Сэтгэгдэл/үнэлгээ (§7 модуль #11) дууссан** (backend +
  admin-web + Mobile): §6.1 матрицад тусгайлан мөр байхгүй тул
  даалгаврын шууд заавраар код болгов.
  - **Backend:** `Review` Prisma загвар (customerId/productId FK,
    `@@unique([customerId, productId])`, rating 1-5 CHECK constraint
    `reviews_rating_range` — defense-in-depth, class-validator
    `@Min/@Max`-ийн ард) + 2 migration (`add_reviews` — схем,
    `enable_reviews_rls` — RLS). ADR 005-ийн зарчмаар шинэ SECURITY
    DEFINER функц ЗОХИОГООГҮЙ — `app_current_user_id()`/
    `app_has_global_scope()`-г л дахин ашиглав, INSERT-ийн EXISTS join
    хэв маяг `return_requests_insert`-ийн (Phase 3c) ЯГ ижил загварыг
    дахин ашигласан:
    `reviews_select` (бүх нэвтэрсэн) / `reviews_insert`
    (`customerId=app_current_user_id() AND EXISTS(order_items→orders→
    product_variants join-оор энэ productId-той COMPLETED захиалга)`)
    / `reviews_update` (зөвхөн өөрийн) / `reviews_delete` (өөрийн ЭСВЭЛ
    `app_has_global_scope()` — модераци).
    `src/reviews` модуль: `ReviewService.hasVerifiedPurchase()` (ГАНЦ
    газар бичигдэж, `create()`-ийн UX-friendly pre-check БОЛОН
    `ProductService.findOne()`-ийн canReview тооцооллын аль алинд нь
    дахин ашиглагдана — ADR 005 "ганц газар л шийднэ" зарчим),
    `getCustomerReviewContext()` ({canReview, myReview}),
    `findForProduct()` (paginated + Prisma `aggregate` `_avg`-аар
    averageRating тооцоолно, ДЕНОРМАЛИЦ ХИЙХГҮЙ). Route:
    `POST/GET /products/:id/reviews` (nested controller,
    `ProductImageController`-тэй ижил хэв маяг), `PATCH/DELETE
    /reviews/:id` (typed Prisma `.update()`/`.delete()` — RLS-ийн 0-мөр
    → Prisma P2025 → 404, custom filter шаардлагагүй), `GET /reviews`
    (модераци, зөвхөн `SUPER_ADMIN/OWNER/ALL_BRANCH_MANAGER` —
    `audit-log.controller.ts`-ийн "3 глобал-эрхийн дүр" загвар дахин
    ашигласан). `ProductController.findOne()` (`CouponController.
    validate()`-ийн "roles-оор customerId тодорхойлох" загвар дахин
    ашигласан) CUSTOMER-д зориулж `canReview`/`myReview`-г нэгтгэнэ —
    staff/каталогийн жагсаалт хариунд ЭДГЭЭР ТАЛБАР ОГТ ОРОХГҮЙ
    (customerId өгөгдөөгүй бол `ReviewService` ОГТ дуудагдахгүй).
  - **Admin-web:** `/reviews` модераци дэлгэц (AuditLogsPage-ийн ерөнхий
    Card+шүүлт загвар) — жагсаалт (үнэлгээ ★, бүтээгдэхүүний нэр,
    сэтгэгдэл, огноо), "Устгах" товч. ⚠️ Category/Product-ийн
    "isActive toggle, Устгах товч ЗОРИУДАА байхгүй" зарчмаас ЯЛГААТАЙ —
    энд ЖИНХЭНЭ DELETE (`window.confirm()` баталгаажуулалттай), учир нь
    энэ бол бизнес объектын амьдралын мөчлөгийн soft-deactivate биш,
    харин ХАРИЛЦАГЧИЙН БИЧСЭН КОНТЕНТИЙН модераци (`reviews_delete`
    RLS-ийн 2-р нөхцөл яг ЭНЭ зорилготой).
  - **Mobile:** `features/reviews/` — `ReviewSummaryBadge` (★4.5 (23
    сэтгэгдэл), ProductDetailScreen-ийн нэрийн доор), "Сэтгэгдлүүд" хэсэг
    (эхний 3-ыг товч харуулж, олон бол "Бүгдийг харах" →
    `ProductReviewsScreen`), `ReviewFormScreen` (`existingReview`
    параметрээр бичих/засварлах хоёрыг НЭГ дэлгэцэд нэгтгэсэн — 5 одны
    `StarRatingInput` + тайлбар талбар, `ReturnRequestScreen`-тэй ЯГ
    ижил `Column([Expanded(ListView), footer])` layout зарчим —
    CLAUDE.md-ийн "cart Phase"-ийн `Scaffold.bottomNavigationBar`
    зөрчлийн сургамжийг ЗОРИУДАА дахин баримталсан). `canReview==true`
    үед л "Үнэлгээ өгөх"/"Үнэлгээгээ засварлах" товч (`myReview` байгаа
    эсэхээр нэрээ сольдог) харагдана. Тест: 11 шинэ widget/unit тест
    (`review_form_screen_test.dart`, `product_reviews_screen_test.dart`,
    `product_detail_screen_test.dart`-д нэмэлт 5) — `flutter analyze` 0
    алдаа, `flutter test` 104/104.
  - Backend: `pnpm --filter api test` 44/44 suite (290/290),
    `pnpm --filter api test:e2e` 19/19 suite (193/193, шинэ
    `test/reviews.e2e-spec.ts` 18 тест — verified-purchase 403,
    unique constraint 409, average rating тооцоолол, `reviews_insert`/
    `reviews_update` RLS policy-г service давхаргыг тойрч шууд SQL-ээр).
    admin-web: `vitest` 17/17 suite (41/41, шинэ `ReviewsPage.test.tsx`
    4 тест).
  - ⚠️ **Android emulator тогтворгүй байдал (энэ ажлын явцад олдсон,
    кодтой ХОЛБООГҮЙ орчны асуудал, ирээдүйд давтагдвал зориулж
    тэмдэглэв):** UI баталгаажуулалтын үед `flutter run`-ий `adb install`
    "Broken pipe" алдаагаар 2 удаа дараалан амжилтгүй болов —
    `adb shell pm list packages` ч мөн "Broken pipe" өгч, emulator-ийн
    `system_server`/package service бүхэлдээ хариу өгөхгүй болсныг
    (хэрэглэгч emulator-ийг гараар унтраасны дараа) илрүүлэв. `adb reboot`
    (`-avd` snapshot-той) ч засаагүй (`screencap` хүртэл зогсонги
    болсон) — эцэст нь emulator процессыг бүрэн `taskkill` хийж,
    `-no-snapshot-load -gpu swiftshader_indirect` (host GPU/Vulkan-ийн
    оронд software renderer) флагтайгаар цэвэр (cold boot) дахин
    асаасны дараа л тогтворжсон. **Сургамж:** энэ орчинд Vulkan/host-GPU
    render нь удаан (>1 цаг) ажилласны/гэнэт унтраасны дараа тогтворгүй
    болдог шинжтэй тул ижил "Broken pipe"/зогсонги adb алдаа гарвал
    эхлээд `adb kill-server && adb start-server`-ийг (хурдан, ихэвчлэн
    хангалтгүй), дараа нь ШУУД `-gpu swiftshader_indirect`-тэй cold
    boot-ыг (`-no-snapshot-load`) оролдох нь цаг хэмнэнэ.
  - ⚠️ **UI координат тааруулах — screenshot-ийн дүрсийг нүдээр хэмжихийн
    оронд `adb shell uiautomator dump` ашигла (энэ ажлын явцад олдсон,
    ирээдүйд ижил автоматжуулалт хийхэд зориулж тэмдэглэв):**
    screenshot-ийн дүрс дэх товчны байрлалыг (харагдах 900x2000 →
    жинхэнэ 1080x2400 масштаб хөрвүүлэлт) нүдээр тааж 3 удаа дараалан
    буруу товшсоны эцэст `uiautomator dump`-ийн XML-ээс `bounds="[x1,y1]
    [x2,y2]"`-г ШУУД уншиж төвийг нь тооцоолох нь БҮРЭН нарийвчлалтай,
    хамаагүй хурдан болохыг тогтоов — цаашид Android emulator дээр
    тодорхой widget (товч, star icon гэх мэт) товшихдаа screenshot
    нүдээр хэмжихийн ОРОНД эхлээд `uiautomator dump`-аар bounds олох нь
    зөв арга. Мөн MSYS/Git Bash-ийн зам хөрвүүлэлт `adb pull`-ийн
    ЗАЙЛШГҮЙ Windows-хэлбэрийн (`D:/...`) очих замыг устгадаг тул
    (`MSYS_NO_PATHCONV=1`-тэй хамт ч) заавал `D:/...` (POSIX `/d/...`
    БИШ) бичих ёстойг тэмдэглэв.
- **(2026-08-26/27) Сэтгэгдэл өгөх урсгалыг каталогоос хайхаас Захиалгууд
  хуудас руу шилжүүлэх дууссан** (§7 модуль #6/#11-ийн шууд үргэлжлэл,
  каталог дахь `ProductDetailScreen`/`ReviewFormScreen`-ийн бичих/
  засварлах боломжийг ЗОРИУДАА ХЭВЭЭР үлдээв — шинэ bottom sheet-ийг
  тэнд дахин ашиглах боломжтой байсан ч (§7 модуль #11-ийн даалгаврын
  "аль тохиромжтойг чи шийд" гэсэн зөвшөөрлийн дагуу) бүтэн дэлгэцийн
  хувилбар аль хэдийн ажиллаж байсан тул хөндөөгүй, зөвхөн ШИНЭ
  Захиалгын түүхийн замыг нэмэв):
  - **Backend:** `OrderService.hydrateOrder()` (шинэ private метод,
    `findAll()`/`findOne()` хоёуланд нь дахин ашигласан) OrderItem
    бүрд `productImageUrl` (эхний `ProductImage`, `MinioService.
    getPublicUrl()` — `ProductService.hydrateProduct()`-тэй ЯГ ижил
    дуудлага) БОЛОН `myReview` (зөвхөн `order.status==='COMPLETED'`
    үед, бусад статуст ЗОРИУДАА `null`) нэмнэ. `ORDER_ITEM_VARIANT_INCLUDE`-д
    `variant.product.images` (`take: 1, orderBy: displayOrder`) нэмэгдэв.
    `ReviewService.findManyForCustomer(customerId, productIds)` (шинэ,
    export хэвээр) — нэг захиалгын ХЭД ХЭДЭН item-тэй бол ч ГАНЦ batch
    query-ээр (`productId IN (...)`, `customerId`-аар шүүсэн тул
    зөвшөөрлийн асуудалгүй, `reviews_select` RLS "бүх нэвтэрсэн" аль
    хэдийн зөвшөөрдөг) бүх review-г нэг дор татна — item тус бүрд
    тусдаа дуудахгүй. `OrderModule`-д `StorageModule`/`ReviewModule`
    (аль хэдийн `ReviewModule`-ийн `exports: [ReviewService]`-ээр
    бэлтгэгдсэн байсан, `CatalogModule`-той адил зарчмаар) нэмэгдэв.
    ⚠️ **Build-ийн цоорхой (`nest build`-ээр л илэрсэн, `tsc --noEmit`/
    unit тестээр анзаарагдаагүй):** `hydrateOrder()`-ийн буцаах
    `HydratedOrderItem` interface-ийг эхэндээ export хийгээгүй байснаас
    `OrderController`-ийн public метод (`findAll`/`findOne`/`checkout`/
    `updateStatus`) TS4053 ("named external module type-ийг export
    хийхгүйгээр public method-ийн буцаах төрөл болгож болохгүй") алдаа
    өгсөн — зөвхөн `pnpm --filter api run build` (declaration file
    үүсгэдэг тул) дээр л илэрдэг, `pnpm test`/`tsc --noEmit` (test
    файлуудын хувьд аль хэдийн өөр учир шалтгаантай олон алдаа өгдөг
    байсан тул шинэ алдаа анзаарагдахгүй байсан) дээр илрээгүй байсан.
    **Сургамж:** service-ийн private хэлхэлтийн буцаах утгын хэлбэрийг
    нэмэлт/өөрчлөх бүрд `pnpm test`-ээс гадна `pnpm run build`-ийг ч
    ЗААВАЛ ажиллуулж шалгах хэрэгтэй. Тест: unit (3 шинэ `describe`
    `order.service.spec.ts`/`review.service.spec.ts`-д, mock structure
    `variant.product.images`-тэй нийцүүлсэн) + e2e (`test/
    orders.e2e-spec.ts`-д шинэ `describe` — ProductImage+Review бодит
    мөр үүсгэж, COMPLETED/идэвхтэй захиалга хоёуланд productImageUrl/
    myReview зөв ирэхийг, GET /orders (жагсаалт) БОЛОН GET /orders/:id
    хоёуланд ижил үр дүн ирэхийг баталгаажуулав).
  - **Mobile:** `OrderListScreen` section-based (Идэвхтэй/Түүх нэг
    `ListView`-д бүлэглэгдсэн) байдлаа жинхэнэ `TabController`+
    `TabBarView`-руу шилжүүлэв (`AppBar.bottom: TabBar`,
    swipe/tap хоёулаа ажиллана). `OrderListCard` (`ConsumerWidget`-ээс
    `StatelessWidget` хэвээрээ, зөвхөн параметр нэмэгдсэн): эхний
    барааны `productImageUrl`-ийг `CachedNetworkImage`-ээр (56×56,
    `ProductImagePlaceholder` fallback) харуулна; COMPLETED захиалгад
    (`onReviewTap` параметр өгөгдсөн үед л, Идэвхтэй tab-д `null`
    дамжуулагдана тул тэнд ОГТ харагдахгүй) бараа бүрд `_ItemReviewRow`
    — `myReview` байвал 5 одыг шууд, байхгүй бол "★ Үнэлэх" текст товч.
    `QuickReviewBottomSheet` (шинэ, `features/reviews/presentation/
    widgets/`) — `ReviewFormScreen`-ийн (бүтэн дэлгэц) логиктой ЯГ ижил
    (verified-purchase эцсийн шалгалт үргэлж backend талд), зөвхөн UI
    нь `showModalBottomSheet`. ⚠️ **Загварын шийдвэр (coupling
    зайлсхийх):** `QuickReviewBottomSheet` ЗОРИУДАА `OrderListNotifier`-ийг
    огт мэдэхгүй — амжилттай хадгалагдсан `Review`-г зөвхөн
    `Navigator.pop(review)`-оор буцаадаг, `showQuickReviewBottomSheet()`
    туслах функц үүнийг хүлээж аваад дуудагч талын `onReviewSaved`
    callback-ыг дуудна (`OrderListScreen._openReview()`-д
    `orderListProvider.notifier.applyLocalReview()` дуудаж SnackBar
    харуулна) — ирээдүйд өөр дэлгэцээс (жиш: ProductDetailScreen) дахин
    ашиглахад ямар ч орон нутгийн state мэдэхгүй цэвэр widget хэвээр
    үлдэнэ. `OrderListNotifier.applyLocalReview(productId, review)`
    (шинэ) — `GET /orders`-г ДАХИН дуудахгүйгээр, `state.value`-ийн БҮХ
    захиалгын (ижил бүтээгдэхүүн олон захиалгад давтагдаж болзошгүй)
    харгалзах `OrderItemLine.myReview`-г шууд (local, `copyWith()`)
    шинэчилнэ. `OrderItemLine`/`OrderDetail`-д `copyWith()` нэмэгдэв
    (`@freezed` ашиглаагүй энгийн класс тул гараар). Тест: widget
    (`order_list_screen_test.dart`-д 2 шинэ — tab шилжилт+COMPLETED
    карт харагдах, "Үнэлэх"→bottom sheet→илгээх→UI шинэчлэгдэх (API
    дахин дуудагдаагүйг `listOrdersCallCount`-аар баталгаажуулсан)),
    шинэ `quick_review_bottom_sheet_test.dart` (create/update/алдааны
    зам 3 тест), unit (`order_list_provider_test.dart`-д
    `applyLocalReview()`-ийн тест).
  - ✅ **Android emulator дээрх баталгаажуулалт (light+dark, бодит
    backend+DB, `+97688112233` акаунтаар):** Захиалгууд → Түүх таб →
    COMPLETED захиалгын карт дээр эхний барааны зураг (MinIO-аас, Coca-
    Cola-ийн улаан өнгөтэй бодит thumbnail) харагдав → "★ Үнэлэх" дарж
    bottom sheet нээгдэв → 5 од сонгож Илгээх дарахад SnackBar
    ("Үнэлгээ илгээгдлээ") + карт дээрх "★ Үнэлэх" ШУУД 5 одоор солигдов
    (backend лог дээр endpoint бүрийн дуудлагыг тусгайлан бичдэггүй тул
    оронд нь Postgres-руу шууд орж `reviews` хүснэгтэд шинэ мөр
    (rating=5) бодитоор бичигдсэнийг баталгаажуулсан) → Тохиргоо →
    Харанхуй горим сонгож дахин Захиалгууд
    → Түүх таб (dark mode-д TabBar indicator, badge, зураг бүгд зөв
    контраст) → 2 дахь (аль хэдийн 2 одтой) захиалгын item дээр дарж
    ЗАСВАРЛАХ горимын bottom sheet (title "Хадгалах", 2 од+хуучин
    тайлбар урьдчилан бөглөгдсөн) харагдав.
  - ⚠️🔴 **Энэ ажлын явцад олдсон, БҮХ Android emulator UI баталгаажуулалтад
    хамаарах чухал засвар/тодруулга (өмнөх сессийн "uiautomator dump
    ашигла" зөвлөмжийг ЗАСВАРЛАВ):** энэ session-д `adb shell uiautomator
    dump` Flutter апп дээр ХООСОН (`text=""` бүх нод) XML буцаасан —
    учир нь Flutter анхдагчаар (TalkBack/бодит accessibility service
    идэвхгүй үед) semantics tree-ээ ОГТ populate хийдэггүй тул
    uiautomator-ийн (Android-ийн native accessibility framework дээр
    суурилсан) dump зүгээр л Flutter-ийн render хийсэн canvas widget-үүдийг
    "харахгүй" (зөвхөн Flutter engine-ийн ГАДНА орших native view-үүдийг
    л). Мөн screenshot-ийг нүдээр хэмжсэн координат (жиш: доод navigation
    bar-ийн "Захиалгууд" tab) 3-4 удаа дараалан буруу байсан (икон/лэйбл
    мөрийг бодит байрлалаас өндөр гэж андуурсан). **Бодитоор ажилласан
    шийдэл:** `System.Drawing` (PowerShell, .NET native, гуравдагч сан
    суулгах шаардлагагүй)-ээр screenshot-ийн тодорхой хэсгийг (жиш:
    доод 500px)-ийг тусад нь `crop`-лож, тэр жижиг crop-ыг Read tool-оор
    ДАХИН харж, дотор нь харьцангуй байрлалаар (%, жишээ нь "товчны
    төв нь crop-ын 84% доош") нарийвчлан тооцоолох нь тогтвортой
    ажиллав. **Сургамж:** Flutter (Android emulator, semantics идэвхгүй)
    орчинд UI автоматжуулалт хийхдээ ЭХЛЭЭД `uiautomator dump`-ыг
    турших ч (заримдаа native widget-т (жиш: TextField-ийн keyboard)
    ажиллаж магадгүй), Flutter-ийн өөрийн canvas-аар зурсан widget
    (товч, tab, icon) дээр ХООСОН dump буцвал ШУУДДАА screenshot crop
    + харьцангуй байрлал тооцоолох аргад шилжих нь цаг хэмнэнэ (нүдээр
    үнэмлэхүй пиксель тааж 3-4 удаа алдахаас хамаагүй хурдан).
  - ⚠️ **(2026-08-27, Харилцагчийн үйлчилгээ Phase-д нээгдсэн) Дээрх
    "uiautomator dump ХООСОН буцаана" дүгнэлт ЭНЭ Phase-д БУРУУ болохыг
    (ижил апп, ижил emulator орчинд) бодитоор давтан турших үед олов —
    `adb shell uiautomator dump` нь `ListTile`/`NavigationBar`/
    `OutlinedButton.icon`/`TextFormField` зэрэг Material widget-үүдийн
    `content-desc`/`text`/`bounds`-ыг БҮРЭН, тодорхой (жиш: "Профайл
    Tab 4 of 4" bounds="[810,2127][1080,2337]") буцаасан — үнэмлэхүй
    нарийвчлалтай (screenshot нүдээр хэмжихээс хамаагүй найдвартай) tap
    координат олоход ашигласан. **Яагаад өмнөх дүгнэлт буруу байсныг
    тодорхой тогтоогоогүй** (Flutter/Android SDK хувилбар шинэчлэгдсэн
    эсэх, эсвэл өмнөх session-ий тухайн үеийн тодорхой дэлгэц/төлөв
    өөр байсан эсэх — аль нь ч батлагдаагүй). **Шинэ зөвлөмж (өмнөхийг
    орлуулна):** цаашид ижил orчинд (энэ project, Android emulator)
    UI автоматжуулалт хийхдээ ЭХЛЭЭД `uiautomator dump`-ыг ЗААВАЛ турш
    (screenshot crop-оос ХАМААГҮЙ хурдан бөгөөд нарийвчлалтай) — зөвхөн
    БОДИТООР хоосон/ашиггүй dump буцвал л screenshot crop аргад шилж.
    Мөн: dump-ийг зөв уншихдаа нүдээр screenshot дээрх зай хэмжиж
    координат тооцоолохоос ЗАЙЛСХИЙ (энэ Phase-д хэдэн удаа яг ийм
    аргаар буруу tap хийсэн — жиш: доод navigation bar-ыг y≈1740 гэж
    таамагласан ч bounds нь бодитоор y=2127-2337 байсан, ~500px-ийн
    зөрүү) — dump-ийн `bounds="[x1,y1][x2,y2]"`-г ШУУД ашиглаж төвийг
    нь тооцоол ((x1+x2)/2, (y1+y2)/2).
  - **(2026-08-27 нэмэлт засвар) QuickReviewBottomSheet-ийн доод
    зай/сүүдэр сайжруулав:** `OrderListScreen` нь `StatefulShellRoute`-ийн
    "Захиалгууд" branch дотор байрладаг тул `showModalBottomSheet`-ийг
    (`Navigator.of(context)`-ийн ХАМГИЙН ОЙР — branch-ийн дотоод, root
    БИШ) `MainShell`-ийн `Scaffold.body`-ийн дотор л (`bottomNavigationBar`-ын
    ГАДНА биш) нээдэг тул анхны хувилбарт "Хадгалах"/"Илгээх" товч доод
    navigation bar-тай бараг шүргэлцдэг байсан. Засвар: `build()`-д
    `SafeArea(top: false)` нэмж, доод padding-ийг `viewInsets.bottom +
    16`-аас `+ 20`-руу нэмэгдүүлэв (клавиатур нээгдэх/хаагдахаас
    үл хамааран ЯГ 20px тодорхой зай); `showModalBottomSheet()`-д
    `elevation: 12` (M3-ийн анхдагч ~1-ээс хамаагүй тод) +
    `clipBehavior: Clip.antiAlias` + дугуй булант `shape` нэмж, sheet-ийн
    дээд ирмэгийн сүүдэр дэвсгэрээс тод "лифт" болж харагдахаар болгов.
    Android emulator дээр (light+dark) screenshot-ийн тодорхой хэсгийг
    (`System.Drawing` crop) шалгаж, "Хадгалах" товч ба navigation bar
    хоорондын зай (~100px, шаардсан 16-24px-ээс хамаагүй илүү) БОЛОН
    sheet-ийн дээд ирмэгийн тод сүүдэр (дугуй булан + `elevation`-ийн
    ил харагдах градиент) хоёуланг нь баталгаажуулав.
- **(2026-08-27) Харилцагчийн үйлчилгээ (тасалбар, §7 модуль #13) дууссан**
  (backend + admin-web + Mobile) — текст-зөвхөн MVP, бодит цагийн чат.
  §6.1 матрицад тусгайлан мөр байхгүй тул даалгаврын шууд зааврыг код
  болгов, `feature/support-tickets` branch дээр (`origin/main`-аас).
  - **Backend:** `SupportTicket` (customerId, orderId nullable,
    subject, category enum, status enum default OPEN, resolvedAt/
    closedAt) + `SupportMessage` (ticketId, senderId, body) Prisma
    загвар + 2 migration (схем, RLS). ADR 005-ийн зарчмаар шинэ SECURITY
    DEFINER функц ЗОХИОГООГҮЙ — `app_current_user_id()`/
    `app_has_global_scope()`/`app_can_manage_branch()`-г л дахин
    ашиглав, SALESPERSON-ийн inline EXISTS шалгалт
    `return_requests_select`-ийн (Phase 3c) ЯГ ижил загвар.
    ⚠️ **Чухал ялгаа (UPDATE-ийн global scope шалгалт):** OWNER-д
    "зөвхөн R бүх" (UPDATE-д ОРОХГҮЙ) тул `support_tickets_update`
    policy-д `app_has_global_scope()` (SUPER_ADMIN/OWNER/
    ALL_BRANCH_MANAGER-г адилхан хамардаг) ашиглаж БОЛОХГҮЙ —
    coupons_insert/delete-тэй (Phase 6) ЯГ ижил шалтгаанаар inline
    `role IN ('SUPER_ADMIN','ALL_BRANCH_MANAGER') AND branchId IS NULL`
    ашигласан. `support_messages_insert`-ийн WITH CHECK: CUSTOMER
    ЗӨВХӨН `ticket.status != 'CLOSED'` үед л бичнэ (staff-д ийм
    хязгаарлалт байхгүй, task-ийн шууд заавар). `src/support` модуль:
    `POST/GET /support-tickets`, `GET /support-tickets/:id`
    (мессежүүдтэй хамт), `POST /support-tickets/:ticketId/messages`,
    `PATCH /support-tickets/:id` (staff-only статус шилжилт,
    `support-ticket-state-machine.ts` — OPEN→{IN_PROGRESS,RESOLVED,
    CLOSED}, IN_PROGRESS→{RESOLVED,CLOSED}, RESOLVED→{CLOSED,
    IN_PROGRESS} (дахин нээх), CLOSED нь эцсийн). ⚠️ **Route param
    заль:** `POST .../:ticketId/messages`-ийн param-ыг ЗОРИУДАА `:id`
    БИШ `:ticketId` гэж нэрлэв (`ProductImageController`-ийн
    `:productId`-тэй ижил зарчим) — `AuditInterceptor`-ийн анхдагч
    `req.params.id` fallback ЭНД тасалбарын id-г (шинэ мессежийн ӨӨРИЙН
    id-ийн оронд) recordId болгож санамсаргүй авчихгүй байх зорилготой.
    WebSocket: шинэ gateway ЗОХИОГООГҮЙ — `OrderEventsGateway`-д
    (`/ws/orders` namespace) `subscribe:ticket`/`support.message.created`
    нэмж (`ticket:${id}` room, branchRoom ЗОРИУДАА ХАМРААГҮЙ — ерөнхий
    orderId=null тасалбарт "аль салбар" гэдэг ойлголт байхгүй),
    `OrderEventsPublisher`-ийн ижил `onCommit()`-гэйт загвараар нийтэлнэ.
  - **Admin-web:** "Тусламжийн төв" (`/support` жагсаалт+шүүлт,
    `/support/:id` чат UI — өөрийн/бусдын мессежийг өнгөөр ялгаж,
    статус шилжих товч), `AuthContextValue`-д `userId` нэмэв (GET
    /auth/me-д аль хэдийн байсан талбар, зөвхөн энэ Phase-д анх
    хэрэглэгдэв — чатны "өөрийн мессеж" тодорхойлоход). `useSupportTicketEvents()`
    (realtime.ts, шинэ ТУСДАА socket холболт — `useOrderEvents()`-ийн
    staff-ийн автомат branchRoom-оор дамжихгүй тул тусдаа
    `subscribe:ticket` шаардлагатай). Staff CLOSED тасалбарт ч мессеж
    бичиж болно (зөвхөн CUSTOMER-д хязгаарлалттай, backend-тэй нийцнэ).
  - **Mobile:** `features/support/` — Профайл tab-д "Тусламжийн төв" мөр
    → `SupportTicketListScreen` (жагсаалт, skeleton/empty/error 3
    төлөв) → `NewTicketScreen` (гарчиг/ангилал dropdown/эхний мессеж,
    2 дараалсан дуудлага: `POST /support-tickets` → амжилттай бол
    `POST .../messages`) → `SupportTicketDetailScreen` (чат,
    `OrderTrackingScreen`-тэй ЯГ ижил "screen өөрөө WS client
    lifecycle-аа удирддаг" зарчим — `OrderEventsClient`-д
    `subscribeToTicket()` нэмэв, Riverpod provider ЗОРИУДАА
    бичээгүй). "Өөрийн" мессежийг `senderId==ticket.customerId`-аар
    (JWT/auth state-ээс userId унших ШААРДЛАГАГҮЙ — Mobile ЗӨВХӨН
    харилцагчид зориулагдсан тул энэ харьцуулалт хангалттай) ялгана.
    CLOSED тасалбарт композер идэвхгүй болж "Хаагдсан тасалбарт мессеж
    бичих боломжгүй" гэсэн тайлбар харагдана. `OrderTrackingScreen`-д
    "Тусламж хүсэх" товч (АЛЬ Ч захиалгын төлөвт харагдана — буцаалтын
    "зөвхөн COMPLETED"-ээс ЯЛГААТАЙ, учир нь харилцагч хүлээж байх
    үедээ ч тусламж хэрэгтэй байж болно) `/support/new`-руу
    `orderId`+`category=ORDER_ISSUE`-г `extra` (Map) дамжуулна.
    ⚠️ **Dart 3.8 lint заль:** `if (orderId != null) 'orderId': orderId`
    маягийн collection literal дотрох nullable утгатай conditional
    entry `use_null_aware_elements` lint-ийг өдөөдөг (`flutter analyze`
    ЭНЭ орчинд info-г ч fatal (`exit 1`) гэж үздэг) — гэвч Dart-ийн
    null-aware `?`-маркер ЗӨВХӨН КИЛ-ийн nullability-д зориулагдсан
    (VALUE nullable үед key рүү `?` тавибал "key can't be null" алдаа
    өгдөг), тул value-conditional entry-д ямар ч зөв `?`-syntax олдсонгүй
    — imperative `final data = {...}; if (x != null) data['k'] = x;`
    хэлбэрт шилжүүлж лint-ийг бүрмөсөн зайлсхийсэн (зөвхөн ЭНЭ нэг
    тохиолдол, ерөнхий дүрэм биш — цаашид ижил lint таарвал эхлээд
    key/value аль нь nullable болохыг ялгаж үз).
  - ✅ **Android emulator (light+dark) БОЛОН бодит backend+WebSocket-оор
    бүрэн урсгал баталгаажуулав:** `+97688112233` (dev test customer,
    `[[dev-test-customer-account]]`) акаунтаар нэвтэрч → Профайл →
    Тусламжийн төв (хоосон) → "+" → Latin текстээр (Cyrillic
    `adb shell input text` дэмждэггүй тул) тасалбар үүсгэв → чат
    дэлгэц дээр ӨӨРИЙН мессеж (indigo, баруун тал) харагдав → **staff
    эрхээр (`super.admin@order-system.mn`-ийн ЖИНХЭНЭ Postgres id-аар
    HS256 "customer-auth" загварын тест JWT mint хийж (e2e тестийн
    `mintAccessToken()`-тэй ЯГ ижил арга — `TokenVerifierService`
    identity-г зөвхөн `iss`-ээр ялгадаг тул authProvider=KEYCLOAK
    хэрэглэгчид ч мөн адил ажиллана), `curl`-аар шууд `POST
    /support-tickets/:id/messages` дуудаж (admin-web-ийн яг адилхан
    HTTP action) staff хариу бичихэд**, Flutter апп ХИЙХГҮЙ ДАХИН
    ачаалалгүйгээр (зөвхөн WebSocket) staff-ийн мессежийг ЗҮҮН талд
    шууд харуулав → staff PATCH-аар CLOSED болгоход тасалбарын
    жагсаалт+дэлгэрэнгүй дээр "Хаагдсан" badge (улаан) харагдаж,
    композер "Хаагдсан тасалбарт мессеж бичих боломжгүй" болж идэвхгүй
    болсныг баталгаажуулав (§7 модуль #13, 6б-ийн шаардлагатай тест UI
    түвшинд давхар нотлогдов) → OrderTrackingScreen дээр "Тусламж
    хүсэх" товч дарахад `NewTicketScreen`-д "Захиалга №...-тай
    холбоотой" chip + ангилал автоматаар "Захиалгын асуудал" болж
    урьдчилан бөглөгдсөнийг баталгаажуулав → Тохиргоо → Харанхуй горим
    сонгож дээрх бүх дэлгэцийг (жагсаалт badge, чат bubble, идэвхгүй
    композер) dark mode-д screenshot-оор давтан баталгаажуулав.
    **Admin-web-ийн React рендер (Playwright-гүйгээр)** зөвхөн
    vitest smoke тест (`SupportPage.test.tsx`, 3 тест;
    `SupportTicketDetailPage.test.tsx`, 5 тест — `socket.io-client`
    mock хийсэн, `Layout.test.tsx`-тэй ижил загвар) + build/lint-ээр
    баталгаажсан — бодит browser-т (Playwright ad hoc суулгах цаг
    хэмнэх үүднээс) ОРООГҮЙ, харин backend+WebSocket+Mobile-ийн бодит
    интеграцийг дээрх `curl`-аар (admin-web-ийн ашигладаг ЯГ ЗАМ
    endpoint-ийг шууд дуудсан) баталгаажуулсан нь эрсдэлийг хангалттай
    бууруулсан гэж үзсэн.
  - Тест: backend unit (`support-ticket-state-machine.spec.ts` 100%,
    `support-ticket.service.spec.ts`, `order-events.gateway.spec.ts`/
    `order-events.publisher.spec.ts`-д нэмэлт) + e2e
    (`test/support.e2e-spec.ts`, 25 тест — RBAC дүр тус бүрээр (SUPER_ADMIN/
    OWNER/BRANCH_ADMIN×2 салбар/SALESPERSON/CUSTOMER×2), **ЗААВАЛ
    шаардлагатай (а) branch staff зөвхөн өөрийн салбарын orderId-той
    тасалбарыг харна (HTTP + service давхаргыг тойрсон raw SQL хоёуланд
    нь), (б) CLOSED тасалбарт CUSTOMER мессеж нэмэхийг оролдвол
    татгалзана (HTTP 403 + raw SQL RLS INSERT rejection хоёуланд нь)**,
    WebSocket `support.message.created` бодит TCP socket-оор). Mobile:
    unit+widget (`support_ticket_list_screen_test.dart` 4,
    `new_ticket_screen_test.dart` 4 — `FakeSupportRepository`,
    `Dio`/HTTP давхарга бүрэн тойрсон; `SupportTicketDetailScreen`
    OrderTrackingScreen-тэй ижил шалтгаанаар (бодит socket холболт)
    widget тестгүй, Android emulator дээр л баталгаажуулсан).
    Backend: `pnpm --filter api test` 46/46 suite (323/323),
    `pnpm --filter api test:e2e` 19/19 suite (211/211, зөвхөн
    `delivery-routing.e2e-spec.ts` локал `ROUTING_PROVIDER=osrm`
    орчны тохиргооноос болж алгассан — өмнөх Phase-үүдийн "flaky биш,
    орчны тохиргоо" тэмдэглэлтэй нийцнэ). admin-web: `vitest` 18/18
    suite (46/46), `tsc -b`/`oxlint`/`vite build` цэвэр. Mobile:
    `flutter analyze` 0 алдаа, `flutter test` 118 тест бүгд ногоон.
  - **(яаралтай бус, тэмдэглэл)** `cleanup-branch-debris.ts`-ийн ЯГ ижил
    "тогтмол давтамжтай гараар цэвэрлэдэг" зарчмыг `SupportTicket`/
    `SupportMessage`-д ч ЗОРИУДААР ХЭРЭГЖҮҮЛЭЭГҮЙ (`cleanup-debris.ts`
    скриптэд нэмээгүй) — `ReturnRequest`-тэй адил зарчмаар эдгээр нь
    "хамааралтай" (dependent) өгөгдөл (`orderId` SetNull тул debris
    Order устгагдвал тасалбар өөрөө хэвээр үлдэнэ) бөгөөд эзгүй
    (orphaned) debris хуримтлал бага хэмжээний тул (нэг session бүрд
    цөөхөн тасалбар) шаардлагагүй гэж үзсэн; хэрэв ирээдүйд их хэмжээгээр
    (мянгаараа) хуримтлагдвал `[[dev-test-customer-account]]`-ийн
    Order debris-тэй адилхан зарчмаар цэвэрлэх шаардлагатай болно.
- Дараагийн ажил: geolocation auto-routing (backlog, "should-have" — Phase
  4-ийн хүргэлтийн ЧИГЛҮҮЛЭЛТЭЭС (аль хэдийн сонгогдсон захиалганд зам/зай
  тооцох) ОГТ ӨӨР, "хамгийн ойрхон салбарыг АВТОМАТААР сонгох" гэсэн
  хараахан хэрэгжээгүй зүйл хэвээр — Cart→Checkout→QPay бүрэн урсгал
  (доорх "(2026-08-20, Cart→Checkout→QPay)" бичлэгийг үз) ДУУССАН), push
  notification (Mobile апп push
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
