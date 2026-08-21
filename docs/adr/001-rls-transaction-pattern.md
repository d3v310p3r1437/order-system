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

## 2026-08-19 нэмэлт: ноцтой засвар — HTTP хариу DB COMMIT-ээс ӨМНӨ клиент рүү явдаг байсан race

**Асуудал (өмнөх §"Middleware доторх алдааны зам" мөрөнд "цаашид тестээр
баталгаажуулах шаардлагатай" гэж зөвхөн тэмдэглэгдээд, бодитоор шалгагдаагүй
үлдсэн эрсдэл бодит алдаа болж илэрсэн жишээ):** `orders.e2e-spec.ts`,
`returns.e2e-spec.ts`, `reports.e2e-spec.ts`, `catalog-inventory.e2e-spec.ts`,
`realtime.e2e-spec.ts`-д давтан (PR #8, #10, #12 — 2026-08-18/19) 404
(`ORDER_NOT_FOUND`)/400 (`INVALID_ORDER_STATUS_TRANSITION`) алдаа "flaky" мэт
санамсаргүй харагдаж байсан. Гүнзгий шинжилгээгээр (3 incident-ийн CI лог
харьцуулалт + `rls.middleware.ts`-ийн кодын дэлгэрэнгүй унших + локал
1000 удаагийн reproduce script) **бүтцийн жинхэнэ race олдсон**:

`RlsMiddleware.use()`-ийн анхны хувилбар:
```ts
this.prisma.runRequestTransaction(userId, (tx) =>
  this.requestContext.run({ tx, userId, afterCommitCallbacks }, async () => {
    next();               // controller ажиллаж, res.json()/res.send() дуудна
    await responseFinished; // res.on('finish')-ийг хүлээнэ (хариу АЛЬ ХЭДИЙН явсан!)
  }),
).then(() => { /* afterCommitCallbacks */ });
```
`res.on('finish')` бол хариу **аль хэдийн клиент рүү бодитоор явсны ДАРАА**
гардаг event. Гэтэл Prisma-ийн `$transaction(fn)` нь `fn`-ийн буцаасан Promise
resolve хийсний ДАРАА л бодит `COMMIT` явуулдаг. Өөрөөр хэлбэл: **энэ кодын
бүтцээр бол HTTP хариу ЗААВАЛ, ямар ч тохиолдолд, DB `COMMIT`-ээс ӨМНӨ клиент
рүү явдаг байсан** — санамсаргүй "заримдаа" биш, детерминистик дараалал.
Ердийн үед клиент (тест эсвэл mobile апп) дараагийн хүсэлтээ илгээх хүртэлх
хугацаа сервэрийн дотоод "commit хүртэлх microtask" хугацаанаас урт байдаг тул
анзаарагдахгүй байсан ч, CI-ийн (Docker дотор Postgres, contention ихтэй
shared runner) орчинд энэ зай нарийсаж/сөрөгждөг тул `checkoutAndComplete()`
шиг "checkout → шууд PATCH .../status" (эсвэл дараалсан статус шилжилтийн
`it()` блокууд хоорондоо) хийдэг тестүүд тогтмол бус унадаг байв.

**Баталгаажуулалт:** `C:\...\scratchpad\repro_order_status_race.cjs`
(jest биш, шууд Node script) — checkout → шууд (0 хүлээлттэй) PATCH
.../status-г 1000 удаа дараалан локал dev backend (docker-compose.dev.yml-ийн
Postgres) эсрэг дуудаж, засварын ӨМНӨ **1/1000 удаа** яг ижил
`ORDER_NOT_FOUND` (404) алдаа гаргаж чадсан (детерминист бус, гэхдээ бодитоор
reproduce хийгдсэн — CI-ийн 20/119 гэсэн илүү өндөр давтамж нь зөвхөн CI-ийн
илүү нарийссан timing margin-аас шалтгаалсан гэж дүгнэсэн).

**Засвар (`src/common/rls.middleware.ts`):** `res.on('finish')`-ийг хүлээхийн
оронд **`res.end()`-ийг өөрийг нь monkey-patch** хийж, controller
`res.end()`-ийг дуудсан МӨЧИД (биш "явуулсан" мөчид) л транзакцын callback-ыг
чөлөөлж (→ Prisma `COMMIT` эхэлнэ), харин **жинхэнэ, бодит `res.end()`
(клиент рүү бодитоор явуулах)-ыг зөвхөн Prisma-ийн `$transaction()` Promise
(COMMIT/ROLLBACK) бүрэн дуусаж СҮҮЛД л** дуудна. Ингэснээр клиент хариу
хүлээн авах мөчид DB транзакц ЗААВАЛ commit (эсвэл rollback) хийгдсэн байх нь
кодын бүтцээр баталгаатай болно (race timing-аас үл хамаарна).

**Тест:** `src/common/rls.middleware.spec.ts` — controller `res.end()`-ийг
дуудсан ч, "commit" (mock-ийн gate) нээгдэх хүртэл жинхэнэ хариу
(`originalEnd`) дуудагдахгүй гэдгийг unit түвшинд тодорхой батална
(регресс болгож дахин оруулахаас сэргийлнэ). Засварын дараа локал e2e бүрэн
suite (13/13, 119/119) болон дээрх reproduce script 1000/1000 амжилттай
гарсныг баталгаажуулсан.

**Ач холбогдол:** энэ засвар `RlsMiddleware`-ийг ашигладаг **бүх** endpoint
(апп даяар, зөвхөн orders/returns биш) дээр нөлөөлдөг — "мутаци хийсний дараа
шууд түүнийг харах/өөрчлөх дараагийн хүсэлт" загвартай ямар ч урсгал (мобайл
апп, admin-web) ижил эрсдэлтэй байсан.

### Нэмэлт баталгаажуулалт: АЛДААНЫ (ROLLBACK) зам мөн адил хамрагдсан эсэх

Дээрх засвар зөвхөн АМЖИЛТТАЙ (COMMIT) хариунд хамаарах уу, эсвэл 4xx/5xx
(ROLLBACK) хариунд ч мөн адил хамаарах уу гэдгийг тусад нь баталгаажуулав —
учир нь `res.end()`-ийн monkey-patch нь `res.end()` дуудагдах статус кодоос
ҮЛ ХАМААРАН (200 ч, 404/400 ч ялгаагүй) ажилладаг тул онолын хувьд аль аль
замд нэгэн адил хамаарах ёстой. Практикт: NestJS-ийн controller-оос
шидэгдсэн `HttpException` (жиш: `NotFoundException`, `BadRequestException`)
нь **middleware-ийн `next()`-ийн ГАДУУР (throw-оор) хэзээ ч "тасардаггүй"**
— Nest-ийн глобал `HttpExceptionFilter` (`main.ts`) үүнийг өөрийн дотоод
pipeline-д барьж, `res.end()`-ийг ЯГ амжилттай хариутай адилхнаар шууд
дуудна. Тиймээс `runRequestTransaction`-ийн callback АМЖИЛТТАЙ (resolve)
дуусаж, Prisma COMMIT хийнэ (тухайн хүсэлтийн доторх аль ч бичилт commit
хийгдэнэ — HttpException шидэх нь Prisma transaction rollback-той
ШУУД холбоогүй, зөвхөн Nest-ийн HTTP давхаргын семантик).

**Жинхэнэ ROLLBACK** зөвхөн `runRequestTransaction`-ий callback ӨӨРӨӨ
(жиш: `tx.$executeRaw`-ийн `set_config` SQL шидвэл, эсвэл `next()`-д хүрэхээс
өмнөх код) шидвэл л тохиолддог — энэ тохиолдолд `next()` ХЭЗЭЭ Ч дуудагдахгүй,
харин `runRequestTransaction(...)`-ийн Promise ӨӨРӨӨ REJECT хийж,
`.catch()`-ийн `next(err)` нь Express-ийн стандарт алдааны замаар (Nest-ийн
глобал exception filter-ээр) эцэст нь `res.end()`-ийг дуудна — энэ ч мөн ЯГ
ижил (monkey-patch хийгдсэн) `res.end()`-ээр дамждаг тул `transactionSettled`
(ROLLBACK бүрэн дуусахыг илэрхийлнэ) биелэх хүртэл хойшлогддог.

**Unit тест** (`rls.middleware.spec.ts`): 2 шинэ тест нэмж (a) Nest-ийн
барьсан 4xx хариу ч mock-ийн "rollback gate" нээгдэх хүртэл хойшлогдоно,
(b) `runRequestTransaction` өөрөө REJECT хийх (callback-ийн ГАДУУР) ховор
тохиолдолд ч hang/давхар дуудлагагүйгээр яг 1 удаа алдааны хариу явуулна
гэдгийг баталгаажуулав.

**Reproduce script** (`repro_error_path_race.cjs`): checkout → CANCEL (200)
→ ШУУД дахин CANCEL (детерминист 400 `INVALID_ORDER_STATUS_TRANSITION`
хүлээгдэнэ, учир нь захиалга аль хэдийн CANCELLED) хэлбэрээр 1000 удаа
дараалан турьшив. **Хуучин (засваргүй) кодоор цэвэр (зэрэгцээ бусад процессгүй,
ганцхан `nest start` instance) орчинд 1000-аас 6 гажиг гарсан** (4×
`firstCancel`-д 404 — өмнөх мэдэгдсэн checkout race, ГЭХДЭЭ мөн **2× `secondCancel`-д
500 Internal Server Error** — шинэ, өмнө нь баримтжуулаагүй шинж тэмдэг: 2
дахь хүсэлт захиалгыг хараахан CANCELLED болоогүй гэж хуучирсан төлөвөөр
харж, ижил мөрд зэрэгцээ UPDATE оролдоход Postgres-ийн зөрчил унхагдаагүй
алдаа болж дэвшин гарсан гэж тайлбарлаж болно). **Засварласан кодоор яг ижил
1000 оролдлого 0 гажигтай** — жинхэнэ санхүүгийн race (хоёр дахин "амжилттай"
cancel) ХЭЗЭЭ Ч ажиглагдаагүй, аль алинд нь. Энэ нь засвар зөвхөн "200
хариуг хойшлуулна" гэсэн хязгаарлагдмал зорилгоор биш, `res.end()`-ийн
БҮХ дуудлагыг (статус кодоос үл хамаарч) тэгш хамарсныг нотолж байна.

## 2026-08-21 нэмэлт: ноцтой засвар — `res.end()`-ийн monkey-patch өөрөө давхар дуудагдаж БҮХЭЛ Node процессыг унагаадаг байсан

**Асуудал (Захиалгын түүх дэлгэц нэмэх ажлын явцад бодит crash-аар илэрсэн):**
`GET /orders`-ийн `items` include-д `variant.product` join нэмэгдсэний
дараа, dev DB-д туршилтын debris (7758 захиалга) хуримтлагдсан нэг
харилцагчийн `GET /orders` query 6000-6200ms үргэлжилж, Prisma-ийн
interactive transaction-ий 5000ms анхдагч timeout-ыг давав. Үр дүнд нь
backend процесс **бүхэлдээ, детерминистикээр (санамсаргүй биш) 2/2 удаа
давтан** унасныг ажиглав:

```
ERROR [RlsMiddleware] RLS transaction алдаа гарлаа
PrismaClientKnownRequestError: Transaction API error: Transaction already
closed: A commit cannot be executed on an expired transaction...
ERROR [HttpExceptionFilter] Internal server error
...
node:events:487
      throw er; // Unhandled 'error' event
Error [ERR_STREAM_WRITE_AFTER_END]: write after end
    at ServerResponse.end (node:_http_outgoing:1047:15)
    at <anonymous> (rls.middleware.ts:84:9)
Emitted 'error' event on ServerResponse instance at: ...
Node.js v24.16.0
```

**Язгуур шалтгаан:** дээрх 2026-08-19-ний засвар `res.end()`-ийг
monkey-patch хийж, controller дуудсан МӨЧИД биш, `transactionSettled`
(COMMIT/ROLLBACK бүрэн дуусах) хүлээгээд л жинхэнэ `originalEnd()`-ийг
дуудна гэдгийг зөв шийдсэн ч, **энэ patch өөрөө идемпотент БИШ** байсан:

```ts
res.end = ((...args) => {
  signalControllerDone();
  void transactionSettled.finally(() => {
    originalEnd(...args);   // ⚠️ res.end() дуудагдах БҮР дахин бүртгэгдэнэ
  });
  return res;
}) as Response['end'];
```

`GET /orders`-ийн query (`handler(tx)`, controller) АМЖИЛТТАЙ дуусаж, Nest
`res.end('...200 OK JSON...')`-ийг ЭХЭЛЖ дуудсан ч (patch-ийн 1-р дуудлага,
`originalEnd` хараахан ажиллаагүй, зөвхөн ХОЙШЛУУЛСАН), яг тэр мөчид Prisma
өөрөө COMMIT хийхээр оролдоход **5000ms аль хэдийн давсан байсан тул COMMIT
ӨӨРӨӨ REJECT** хийсэн — `runRequestTransaction(...)`-ийн Promise иймд REJECT
хийж, `RlsMiddleware`-ийн `.catch()` (§"Асуудал" мөрийн 119-127 мөр) ажиллаж
`next(err)`-ийг дуудсан. Энэ нь Nest-ийн `HttpExceptionFilter`-ээр дамжиж
**`res.end()`-ийг ХОЁР ДАХЬ удаа** (500 алдааны биетэй) дуудуулсан. Патчийн
хуучин хувилбарт `res.end()`-ийн дуудлага БҮРД шинэ, тусдаа
`transactionSettled.finally(() => originalEnd(...))` бүртгэгддэг байсан тул
хоёр дахь дуудлага ХОЁР ДАХЬ `originalEnd()` дуудлага болж, эхнийх нь аль
хэдийн урсгалыг "төгсгөсөн" байхад Node.js-ийн `ServerResponse` дахин
бичихийг оролдож `ERR_STREAM_WRITE_AFTER_END`-г **'error' event-ээр**
(throw-оор биш) шидсэн — `res`-д ЯМАР Ч `'error'` listener бүртгэгдээгүй
байсан тул Node.js-ийн стандарт зарчмаар (listener-гүй EventEmitter дээр
'error' emit хийвэл unhandled exception болж процессыг унагана) **бүхэл
процесс crash хийсэн**, зөвхөн тухайн НЭГ HTTP хүсэлт биш.

⚠️ **Чухал ялгаа өмнөх (2026-08-19) олдвороос:** тэр удаагийн бүх race
(ROLLBACK/4xx зам орсон ч) `runRequestTransaction`-ий callback (`handler(tx)`)
АМЖИЛТТАЙ дуусаж, `$transaction()`-ий Promise ЧАМ ч бас АМЖИЛТТАЙ (resolve)
дуусдаг байсан тохиолдлуудыг л хамарсан (§"Нэмэлт баталгаажуулалт" хэсгийг
үз) — `res.end()` ямар ч тохиолдолд **ГАНЦ УДАА** л дуудагддаг гэсэн
ДАРАЛТ (implicit assumption) дор зөв ажилладаг байсан. Энэ удаагийн олдвор
бол **тэр дарлагыг зөрчсөн, шинэ тохиолдол**: `handler(tx)` АМЖИЛТТАЙ
дуусаад ч, Prisma-ийн COMMIT ӨӨРӨӨ (callback-аас ХАРААТ бусаар, зөвхөн
хугацаанаас шалтгаалж) REJECT хийж болдгийг 2026-08-19-ний засвар (мөн
түүний unit тестүүд) тооцоогүй байв.

**Баталгаажуулалт 1 (unit, детерминист):** `rls.middleware.spec.ts`-д шинэ
тест нэмж (`runRequestTransaction`-ийн mock: `handler(tx)` АМЖИЛТТАЙ
дуусаад л, ДАРАА нь `throw` хийдэг болгосон — яг Prisma-ийн жинхэнэ
"COMMIT-ийн үед timeout" зан төлөвтэй ижил), засварын ӨМНӨ **`originalEnd`
яг 2 удаа дуудагдсаныг** (`toHaveBeenCalledTimes(1)` → бодит 2, тест FAIL)
шууд нотолсон.

**Баталгаажуулалт 2 (бодит HTTP, live pg_sleep):** түр зуурын
`GET /debug/slow-query` endpoint (`this.prisma.tx.$queryRaw\`SELECT
pg_sleep(6)\``, засвар баталгаажсаны дараа commit хийгдэлгүй устгасан)-ыг
бодит ажиллаж буй dev backend (`localhost:3100`)-д curl-аар дуудаж:
- Засварын ӨМНӨ (кодыг түр буцааж шалгах шаардлагагүй болсон — 2/2 бодит
  crash аль хэдийн CI бус, ЭНЭ Захиалгын түүх дэлгэц нэмэх ажлын явцад
  бодитоор ажиглагдсан байсан, дээрх "Асуудал"-ыг үз).
- **Засварын ДАРАА:** `curl http://localhost:3100/debug/slow-query` →
  6.2 секундын дараа `HTTP 500` (`{"error":{"code":"INTERNAL_ERROR",...}}`)
  цэвэр хариу авав (hang/silent drop БИШ). **Яг үүний дараа**
  `curl http://localhost:3100/health` → `200 {"status":"ok"}` ШУУД
  хариулж, `netstat`-аар порт хэвээр LISTENING байгааг баталгаажуулсан —
  өөрөөр хэлбэл **процесс бүхэлдээ амьд, дараагийн хүсэлтэд хэвийн хариу
  өгч байгааг бодит HTTP хүсэлтээр нотолсон**.

**Засвар (`src/common/rls.middleware.ts`):**
```ts
let flushed = false;
let pendingEndArgs: Parameters<Response['end']> | null = null;
res.end = ((...args) => {
  signalControllerDone();
  pendingEndArgs = args;               // "сүүлчийн бичилт ялна"
  void transactionSettled.finally(() => {
    if (flushed) return;               // идемпотент хамгаалалт
    flushed = true;
    originalEnd(...(pendingEndArgs as Parameters<Response['end']>));
  });
  return res;
}) as Response['end'];
res.on('error', (err) => {             // дэд хамгаалалт (defense-in-depth)
  this.logger.error('HTTP response стрим алдаа гарлаа (процесс амьд үлдэнэ)', err);
});
```
⚠️ **Яг нэг зарчмаар (2 горим, ЗӨРЧИЛГҮЙ) тодорхойлбол:** `originalEnd()`
(жинхэнэ HTTP header/body бичих цэг) `transactionSettled` СЕТТЛ хийж
`flushed` `true` болтол — өөрөөр хэлбэл ГАНЦ анхны flush бодитоор явагдтал —
ЯГ НЭГ удаа л дуудагддаг тул: **(а) ТЭР НЭГ удаагийн flush-ийн ӨМНӨ** ирсэн
`res.end()`-ийн дуудлага БҮР `pendingEndArgs`-г дахин бичиж, тэдгээрийн
ХАМГИЙН СҮҮЛД ирсэн нь л бодитоор бичигдэнэ ("сүүлчийн бичилт ялна" —
`RlsMiddleware`-ийн success→`.catch()`-ийн 2 зам хоёулаа яг ЭНЭ нэг л
удаагийн flush-ийн ӨМНӨ, Promise microtask дараалал БАТАЛГААТАЙ (алдааны
зам, `next(err)`-ээс scheduling хийгддэг тул, СЕТТЛ хийхээс өмнө ЗААВАЛ)
ирдэг тул controller "амжилттай" гэж эхлээд бодсон ч, транзакц эцэст нь
бодитоор REJECT хийвэл клиент ХУУРАМЧ 200 БИШ, ЖИНХЭНЭ алдааны хариуг л
хүлээн авна); **(б) ТЭР НЭГ удаагийн flush-ийн ДАРАА** ирэх ЯМАР Ч
дуудлага бол headers "бодитоор явсан эсэхээс" (жинхэнэ Node.js урсгалд
яг энэ нь шалтгаан) БИШ, зөвхөн `flushed` flag-аас шалтгаалж зүгээр л
чимээгүй хаягдана — "сүүлчийн бичилт ялна" зарчим ЗӨВХӨН flush-ийн
ӨМНӨХ (ганц удаагийн) цонхонд хамаарна, flush-ийн ДАРАА бол цэвэр
"хамгийн ЭХНИЙХ нь мөнхөд ялсан, дараагийн БҮХ дуудлага (хэдэн ч удаа,
ямар ч аргументтай) алгасагдана" горимд шилждэг. Хоёр горимыг тусад нь
баталгаажуулсан: `rls.middleware.spec.ts`-ийн "controller res.end()-ийг
АМЖИЛТТАЙ дуудсаны ДАРАА..." тест (а)-г, "flush АЛЬ ХЭДИЙН болсны ДАРАА
ирсэн res.end()..." тест (б)-г тус тусад нь нотолсон.

Код нь мөн (3) `res.on('error', ...)` дэд хамгаалалттай — ирээдүйд өөр
(одоо мэдэгдээгүй) замаар double-end гарвал ч БҮХЭЛ процессыг УНАГАХГҮЙ,
зөвхөн лог бичих Node.js-ийн стандарт "unhandled 'error' event = crash"
зарчмаас урьдчилан сэргийлсэн давхарга.

**Ач холбогдол:** энэ засвар мөн `RlsMiddleware`-ийг ашигладаг **бүх**
endpoint дээр нөлөөлдөг (§"2026-08-19 нэмэлт"-тэй адил) — Prisma-ийн 5000ms
timeout-ыг давдаг АЛЬ Ч удаан query (том жагсаалт, pagination-гүй
aggregate, гэх мэт) яг ижил crash-ийн эрсдэлтэй байсан. Одоо ямар ч ийм
удаан query зөвхөн ТУХАЙН хүсэлтэд 500 (эсвэл цаашид тохиргоо нэмвэл 503)
өгөөд, backend бүхэлдээ хэвийн ажиллаж үлдэнэ.
