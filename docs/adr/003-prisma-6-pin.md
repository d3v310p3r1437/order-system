# ADR 003: Prisma 7-оос 6.x руу бууруулж түр зуур PIN хийсэн

- Статус: Хүлээн зөвшөөрсөн
- Огноо: 2026-08-15
- Холбоотой: `docs/adr/001-rls-transaction-pattern.md`,
  `docs/adr/002-jwt-identity-only-authorization-from-db.md`

## Асуудал

Phase 1-ийн явцад Prisma 7.9.1 (шинэ `prisma-client` generator, WASM query
compiler, driver adapter `@prisma/adapter-pg`) ашиглаж байхдаа tooling-ийн
зөрчилтэй **3 удаа** тулгарсан:

1. **RLS spike (ADR 001) үед:** 7.x-ийн шинэ client ESM-only гарц
   (`import.meta.url`) CommonJS project-той зөрчилдөж,
   `generator client { moduleFormat = "cjs" }` гэсэн workaround хийхэд
   хүрсэн.
2. **Auth architecture ажлын явцад (§6.2):** driver adapter шаардлагатай
   болсноор `@prisma/adapter-pg` + `pg` нэмэлт dependency, mолдогдох
   тохиргоо нэмэгдсэн.
3. **Jest тест бичихэд:** Prisma 7-ийн WASM query compiler нь
   `await import(...)` (dynamic import) ашигладаг бөгөөд энэ нь Jest-ийн
   CJS test runner-ийн VM sandbox дотор `--experimental-vm-modules`-гүйгээр
   бүрэн ажилладаггүй. Энэ тохиргоог засах гэж оролдоход `jose` (ESM-only)
   package-тай зөрчилдөж, улмаар бүхэлд нь ESM Jest migration хийхэд хүрэх
   шаардлага гарсан — Phase 1 spike-ийн хамрах хүрээнээс хэт хэтэрсэн ажил.

GitHub дээрх Prisma repo-д Prisma 7-ийн WASM query compiler нь Jest,
Playwright, Vite зэрэг олон tooling-тай өргөн хүрээтэй, шийдэгдээгүй
зөрчилтэй болохыг баталгаажуулсан олон нээлттэй issue байдаг (жиш:
`prisma/prisma` repo дээрх "jest" эсвэл "experimental-vm-modules" гэсэн
түлхүүр үгээр хайхад олон тохиолдол гардаг — Prisma 7 маш саяхан гарсан
(driver adapter-ийг заавал болгосон) том хувилбар тул экосистем бүрэн
дасаагүй байна).

## Шийдвэр

**Prisma-г 6.19.3 (сүүлийн тогтвортой 6.x) руу бууруулж, дараагийн зүйл
шийдэгдэх хүртэл 7.x руу шинэчлэхгүй:**

- `generator client { provider = "prisma-client-js" }` — 6.x-ийн классик
  generator, driver adapter шаардахгүй, native (Rust) query engine binary
  ашигладаг тул WASM dynamic-import асуудал огт байхгүй.
- `PrismaClient` constructor: `datasources: { db: { url: ... } }`
  (`@prisma/adapter-pg` хэрэггүй болсон тул устгасан).
- **Custom `output` зам ("../generated/prisma") бас устгасан**, өгөгдмөл
  байршил (`node_modules/.prisma/client`, `@prisma/client`-ээр import)
  руу буцаасан. Шалтгаан: 6.x классик generator-ийн гаралт нь **pre-built
  .js/.d.ts + native `.node` binary** (7.x-ийн шиг raw `.ts` source биш) тул
  `tsc`-ийн build (`nest build`) үүнийг `outDir`-руу автоматаар хуулдаггүй —
  custom output зам ашигласнаар prod build (`dist/`) дээр
  `MODULE_NOT_FOUND` өгдөг байсныг илрүүлж засав. `@prisma/client`
  bare-specifier import нь node_modules-ээр л resolve хийгддэг тул
  ямар ч build tool-той (tsc, webpack, ts-node) зөрчилдөхгүй.

### Файлын өөрчлөлт
- `apps/api/package.json`: `prisma`, `@prisma/client` → `^6.19.0`;
  `@prisma/adapter-pg`, `pg`, `@types/pg` устгасан
- `apps/api/prisma/schema.prisma`: `datasource db` блокт
  `url = env("DATABASE_URL")` дахин нэмсэн (6.x-д `prisma.config.ts`-ийн
  `datasource` override 7.x шиг дэмжигддэггүй)
- `apps/api/prisma.config.ts`: `datasource` блок хассан (schema.prisma-ийн
  `env("DATABASE_URL")`-ээр хангагдана)
- `src/prisma/prisma.service.ts`, `src/common/request-context.ts`:
  `import ... from '@prisma/client'` (custom generated зам биш)
- `apps/api/.gitignore`: `/generated/prisma` мөр хассан (ашиглагдахгүй
  болсон)

## Баталгаажуулалт

- `pnpm --filter api test` — 20 unit тест бүгд ногоон (Redis, jose-той
  холбоотой тестүүд орсон)
- `pnpm --filter api test:e2e` — **анх удаа бүрэн амжилттай ажиллав**
  (өмнө нь Prisma 7-ийн WASM dynamic-import алдаагаар бүрэн боологддог
  байсан). Шинэ e2e тестүүд нэмэгдсэн (`test/auth.e2e-spec.ts`):
  register → JWT → `/auth/me` (role CUSTOMER), token-гүй
  `/debug/branches` → `[]` (RLS), 5 буруу оролдлого зөвшөөрөгдөж 6 дахь нь
  throttle-д унах.
- `nest build` → `node dist/src/main.js` бодит prod-стиль ачааллаар шалгаж,
  бүх route зөв ажиллаж байгааг баталгаажуулсан (custom output-той үеийн
  `MODULE_NOT_FOUND`-ыг давтан гаргуулж, засвар зөв болохыг нотолсон).

## Мэдэгдэж буй trade-off

- 6.x классик generator нь Rust native binary (`query_engine-*.node`)
  ашигладаг тул хостын архитектур/OS бүрт тохирсон binary татагдах
  шаардлагатай (7.x-ийн WASM зорилго яг үүнээс зайлсхийх байсан) — гэхдээ
  энэ нь Node.js экосистемд олон жил батлагдсан, тогтвортой загвар.
- Driver adapter (жиш: Neon/Cloudflare D1 зэрэг edge orчинд шаардлагатай)
  ашиглах боломжгүй болсон — гэхдээ бид өөрийн Docker Postgres ашигладаг
  тул энэ хязгаарлалт бидэнд хамаагүй.

## Дараагийн алхам

**7.x руу дахин шинэчлэхийн өмнө** дараах нөхцөл хангагдсан эсэхийг
шалгах ёстой:
1. Prisma-ийн албан ёсны Jest-тэй ажиллах жишээ/баримт бичиг гарсан
   (эсвэл `--experimental-vm-modules`-гүйгээр WASM query compiler
   ажилладаг болсон)
2. Эсвэл манай төсөл бүхэлдээ ESM рүү шилжсэн (`"type": "module"`) бөгөөд
   Jest-ийн ESM дэмжлэг (native ESM test runner) тогтворжсон үед
3. Хоёуланг нь `pnpm --filter api test` болон `test:e2e` дээр бодитоор
   турших хүртэл 7.x руу шинэчлэхгүй.
