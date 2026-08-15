# ADR 001: Prisma + PostgreSQL RLS session variable загвар

- Статус: Хүлээн зөвшөөрсөн (Phase 0 spike-аар баталгаажсан)
- Огноо: 2026-08-15
- Холбоотой: `docs/plan.md` §6.3, §11 (эрсдэл)

## Асуудал

PostgreSQL Row-Level Security (RLS) policy-ууд `current_setting('app.user_id', ...)`
маягийн session-local variable дээр тулгуурладаг. Prisma-ийн connection pooling
нь хүсэлт бүрийг өөр connection дээр гүйцэтгэж болзошгүй тул `SET LOCAL`-аар
тавьсан утга нь яг тухайн connection дээрх дараагийн бүх query-д хүчинтэй байхыг
хэрхэн баталгаажуулах вэ гэдэг асуудал байсан.

## Шийдвэр

1. **`app_runtime` гэсэн хязгаарлагдмал Postgres role** (superuser БИШ,
   `NOBYPASSRLS`) үүсгэсэн — зөвхөн энэ role-оор бүх runtime query (migration
   биш) гүйцэтгэнэ (`infra/create-app-runtime-role.sql`,
   `APP_DATABASE_URL` env variable). Migration/DDL нь тусдаа, superuser `app`
   холболтоор (`DATABASE_URL`) хийгдэнэ.
2. **NestJS middleware (`RlsMiddleware`)** хүсэлт бүрийг
   `prisma.$transaction(async (tx) => {...})` дотор ороож, transaction эхлэхэд
   шууд:
   ```sql
   SELECT set_config('app.user_id', $1, true);
   ```
   ажиллуулна (`SET LOCAL`-тай ижил үр дүнтэй, гэхдээ `set_config()` функц нь
   параметрийг аюулгүй bind хийх боломж өгдөг тул SQL injection-с сэргийлдэг —
   raw `SET LOCAL app.user_id = '${userId}'` string interpolation биш).
3. **`AsyncLocalStorage`-д суурилсан `RequestContextService`** нь тухайн
   хүсэлтийн `tx` (transaction client)-ыг дараагийн бүх
   middleware/controller/service давхаргад дамжуулна. `PrismaService.tx`
   getter нь энэ context-оос transaction client-ыг буцаана.
4. RLS helper функцууд (`app_current_user_id()`, `app_has_global_scope()`,
   гэх мэт, `enable_rls_policies` migration) зөвхөн **`app.user_id`**
   session variable-ыг шаарддаг — `branch_id`/`role`/`accessible_branches`-ыг
   session variable болгож тусад нь дамжуулдаггүй. Учир нь эдгээр
   функцууд `SECURITY DEFINER`-ээр `user_branch_roles` хүснэгтээс шууд
   уншдаг тул client талаас `role`/`branch_id`-г "итгэмжлэх" шаардлагагүй
   болсон — зөвхөн `user_id`-г л баталгаатай дамжуулах ёстой (энэ нь §6.3-д
   дурдсан анхны 3-variable загвараас илүү энгийн бөгөөд аюулгүй).

### Файлууд
- `src/prisma/prisma.service.ts` — `PrismaClient` (driver adapter:
  `@prisma/adapter-pg`, `APP_DATABASE_URL`), `runRequestTransaction()`,
  `tx` getter
- `src/prisma/prisma.module.ts` — Global module
- `src/common/request-context.ts` — `AsyncLocalStorage` wrapper
- `src/common/rls.middleware.ts` — хүсэлт бүрийг transaction-д ороох
- `src/debug/debug.controller.ts` — spike баталгаажуулах түр endpoint
  (`GET /debug/branches`, `x-debug-user-id` header)

## Баталгаажуулалт (Phase 0 spike)

- Header-гүй `GET /debug/branches` → `[]` (RLS блоклосон)
- `x-debug-user-id: <SUPER_ADMIN-ий user id>` header-тэй ижил хүсэлт →
  тест branch мөр харагдсан
- `app` (superuser) холболтоор шууд оруулсан мөрүүд `app_runtime` холболтоор
  зөв шүүгдэж байгааг баталгаажуулсан

## Мэдэгдэж буй trade-off / эрсдэл (§11-д тэмдэглэсэн)

- **Connection pool sizing:** хүсэлт бүр interactive transaction нээж, HTTP
  response бүрэн дуустал (`res.on('finish'/'close')`) нээлттэй байлгадаг тул
  нэг зэрэг удаан ажилладаг хүсэлт олон байвал connection pool (`pg.Pool`
  дефолт хэмжээ) хурдан дуусаж болзошгүй. Load test (Phase 7, §9.2) дээр
  onцгойлон анхаарч, шаардлагатай бол pool size-ыг тохируулна эсвэл
  connection-heavy endpoint-уудыг (жиш: файл upload, удаан report query)
  тусад нь mitigat хийх шаардлагатай болж магадгүй.
- **`x-debug-user-id` header нь зөвхөн spike/dev зорилготой** — Phase 1-д
  `JwtAuthGuard` бэлэн болмогц `DebugController`-ыг устгах эсвэл зөвхөн
  SUPER_ADMIN-д хязгаарлана. Prod орчинд header-ээс шууд identity авахыг
  болиулна.
- **Middleware доторх алдааны зам:** `next()`-ийг `AsyncLocalStorage.run()`
  дотор дуудаж, response 'finish'/'close' хүлээж байгаа тул route handler
  дотор шидэгдсэн алдаа Nest-ийн стандарт exception filter-ээр зөв
  боловсруулагдаж байгааг цаашид integration тестээр баталгаажуулах
  шаардлагатай (Phase 1).
- **Prisma 7 driver adapter:** энэ схемийн `generator client` нь
  `moduleFormat = "cjs"` заасан (`@prisma/adapter-pg` ашигладаг тул ESM-эцсийн
  гарц болон CommonJS project (package.json-д `"type": "module"` байхгүй)
  хоорондын зөрчлийг зайлсхийхийн тулд). Хэрэв ирээдүйд төслийг бүхэлд нь ESM
  болговол энэ тохиргоог дахин харах хэрэгтэй.
