# Олон салбартай онлайн дэлгүүрийн захиалгын систем — Хөгжүүлэлтийн иж бүрэн төлөвлөгөө

> Хувилбар: **v2.0** (v1.0-г шүүмжлэлт сэтгэлгээгээр нягталж, 19 асуудлыг засварласан) · Огноо: 2026-08-15

---

## Засварын хураангуй (v1.0 → v2.0)

| № | v1.0-д илэрсэн асуудал | v2.0-д хийсэн засвар |
|---|---|---|
| 1 | `security-auditor`-ыг "SessionStart hook-оор долоо хоног бүр" гэж буруу тодорхойлсон | §5.4-т засаж, бодит механизм (GitHub Actions scheduled workflow + Claude Code headless) болгосон |
| 2 | ORM/RLS session variable-ийн хэрэгжилт шийдэгдээгүй | §6.3-т тодорхой шийдвэр (Prisma + request-scoped transaction interceptor) + Phase 0 spike даалгавар нэмсэн |
| 3 | Keycloak дээр утас/имэйл хосолсон identity загвар бодит биш | §6.2-т "2 тусдаа auth зам" архитектурын шийдвэрийг тодорхой үндэслэлтэй бичсэн |
| 4 | Mobile апп дээрх 2 төрлийн login UI Phase 1-д тодорхойгүй байсан | Phase 1 checklist-д тодорхой даалгавар нэмсэн |
| 5 | Аудит лог ямар ч Phase-д даалгавар болоогүй | Phase 1-д суурь аудит лог, Phase 6-д UI нэмсэн |
| 6 | Staging орчин байхгүй | Phase 0-д staging environment нэмсэн, §10-д тусад нь тайлбарласан |
| 7 | Жинхэнэ төхөөрөмж дээрх тест байхгүй | Phase 0 болон Phase 4-т нэмсэн |
| 8 | App store review хугацаа тооцоогүй | Phase 8-д 2-3 долоо хоногийн буфер тусад нь нэмсэн |
| 9 | Хууль эрх зүй, QPay мерчант гэрээ тооцоогдоогүй | Шинэ §11 "Гадаад хамаарал ба параллель урсгал" нэмсэн |
| 10 | Backup drill зөвхөн Phase 7-д | Phase 1-ээс эхлэн сар бүр автомат drill болгосон |
| 11 | CD механизм тодорхойгүй | §10.2-т тодорхой CI/CD урсгал бичсэн |
| 12 | SMS gateway сонголт хийгдээгүй | Phase 1-д vendor үнэлгээ, абстракц interface даалгавар нэмсэн |
| 13 | Дизайн/UX үе шат байхгүй | Шинэ **Phase 0.5** нэмсэн + "дизайн 1 sprint түрүүлж явна" зарчим |
| 14 | Phase 3 хэт ачаалалтай, geolocation дутуу үнэлэгдсэн | Phase 3 → **3a ба 3b** болгож задалсан, MVP чиглүүлэлтийг энгийн болгосон |
| 15 | 80% coverage бүх Phase-д хатуу шаардсан | Прогрессив coverage босго (§9) |
| 16 | Зэрэгцээ ажиллах боломж тооцоогүй | §3.1-д contract-first зарчим нэмсэн |
| 17 | RBAC зөвшөөрлийн матриц дутуу | §6.1-д CRUD-түвшний бүрэн матриц нэмсэн |
| 18 | Refresh token бүх дүрд ижил хугацаатай | §6.2-т дүрээр ялгасан |
| 19 | QPay webhook signature verification checklist-д алга | §4.4-т нэмсэн |

---

## Агуулга

1. [Баримт бичгийн зорилго](#1-баримт-бичгийн-зорилго)
2. [Сонгосон технологийн стек](#2-сонгосон-технологийн-стек)
3. [Ажлын арга зүй](#3-ажлын-арга-зүй)
4. [Кодын нэгдсэн стандарт](#4-кодын-нэгдсэн-стандарт)
5. [Claude Code agent-ийн тохиргоо](#5-claude-code-agent-ийн-тохиргоо)
6. [Эрх, дүрийн систем ба нэвтрэлт](#6-эрх-дүрийн-систем-ба-нэвтрэлт)
7. [Системийн модулиуд](#7-системийн-модулиуд)
8. [Үе шат бүрийн ажлын төлөвлөгөө](#8-үе-шат-бүрийн-ажлын-төлөвлөгөө)
9. [Тест ба чанарын баталгаажуулалт](#9-тест-ба-чанарын-баталгаажуулалт)
10. [Ашиглалтад оруулах, CI/CD, хяналт](#10-ашиглалтад-оруулах-cicd-хяналт)
11. [Гадаад хамаарал ба параллель урсгал](#11-гадаад-хамаарал-ба-параллель-урсгал)
12. [Эрсдэл ба нөөц төлөвлөгөө](#12-эрсдэл-ба-нөөц-төлөвлөгөө)
13. [Эхлэх эхний алхмууд](#13-эхлэх-эхний-алхмууд)

---

## 1. Баримт бичгийн зорилго

Энэ баримт бичиг нь олон салбартай онлайн дэлгүүрийн захиалгын системийг эхнээс нь дуустал нэг стандартаар, цэгцтэй үе шаттайгаар хөгжүүлэх төлөвлөгөө юм. v1.0-г бичсэний дараа өөрөө шүүмжлэлт нягталж, техникийн зөрчил, дутуу тусгагдсан ажил, бодит бус хугацааны таамаглалыг олж, засварласан хувилбар нь энэхүү v2.0.

---

## 2. Сонгосон технологийн стек

| Давхарга | Технологи |
|---|---|
| Backend | Node.js 22 LTS + NestJS (TypeScript, strict mode) |
| ORM | **Prisma** (шийдвэр — үндэслэл §6.3) |
| Өгөгдлийн сан | PostgreSQL 17 + Row-Level Security (branch isolation) |
| Кэш / Realtime pub-sub | Redis 7 → v2-т NATS + JetStream |
| Auth / RBAC | Хосолсон загвар: **custom auth модуль** (харилцагч, утасны дугаар) + **Keycloak** (ажилтан, имэйл/OIDC) — үндэслэл §6.2 |
| Файл хадгалалт | MinIO (S3-compatible) |
| Хайлт | Meilisearch |
| Гар утасны апп | Flutter (Dart) |
| Веб удирдлагын самбар | React + TypeScript + TanStack Query + Tailwind + shadcn/ui |
| Reverse proxy / TLS | Traefik + Let's Encrypt |
| Monitoring | Prometheus + Grafana + Loki, self-hosted Sentry |
| Container registry | GitHub Container Registry (ghcr.io) |
| Инфра | Docker Compose (dev/staging/prod тус тусдаа) → k3s (шаардлагатай бол) |
| Төлбөр | QPay (үндсэн), SocialPay (нэмэлт), бэлнээр |
| SMS gateway | Phase 1-д vendor сонгоно (§11.3) — код `SmsProvider` абстракц interface-ээр vendor-независимо байна |

---

## 3. Ажлын арга зүй

### 3.1 Sprint бүтэц ба зэрэгцээ ажиллах зарчим (contract-first)
- 1 sprint = 2 долоо хоног.
- **Дизайн 1 sprint түрүүлж явна:** UX/UI дизайныг тухайн Phase-ийн хөгжүүлэлт эхлэхээс 1 sprint өмнө бэлэн болгоно (Phase 0.5-аас эхэлж тогтмол урсгал болно).
- **API contract-first:** Phase бүрийн эхэнд backend, mobile, web багууд OpenAPI schema дээр тохиролцоно (эсвэл `api-doc` skill-аар stub үүсгэнэ). Дараа нь backend бодит хэрэгжилтээ хийх зэрэгцээ mobile/web фронт **mock server**-тэй ажиллаж эхэлнэ — ингэснээр Phase бүрийн хугацаа 20-30%-иар богиносно.
- Sprint төгсгөл бүрд deployable код гарна.

### 3.2 Definition of Done (DoD)
- [ ] Код CLAUDE.md стандартад нийцсэн
- [ ] Тест бичигдсэн, coverage §9-ийн прогрессив босгыг хангасан
- [ ] `code-reviewer` subagent-ийн шалгалт + 1 хүний review
- [ ] CI бүрэн ногоон
- [ ] RLS/эрхийн өөрчлөлт бол `db-schema-guardian` шалгасан
- [ ] API өөрчлөлт бол OpenAPI баримт шинэчлэгдсэн
- [ ] §4.4 аюулгүй байдлын checklist хангагдсан
- [ ] Аудит лог бичигдэх ёстой mutation бол log дуудалт орсон эсэх шалгагдсан

### 3.3 40-20-40 зарчим (Phase-аар тохируулсан)
- Phase 0-1: төлөвлөлт/дизайнд илүү жин
- Дунд Phase-үүд: тэнцвэртэй
- Phase 7-8: тест/аюулгүй байдалд 40%+

---

## 4. Кодын нэгдсэн стандарт

### 4.1 Repo бүтэц

```
/repo-root
├── CLAUDE.md
├── .claude/{agents,skills,hooks}/
├── apps/{api, admin-web, mobile}/
├── infra/
│   ├── docker-compose.dev.yml
│   ├── docker-compose.staging.yml
│   ├── docker-compose.prod.yml
│   └── migrations/
├── docs/{api-spec, adr, runbook.md, legal/}
└── .github/workflows/{ci.yml, deploy-staging.yml, deploy-prod.yml, weekly-security-audit.yml}
```

### 4.2 Нэршил, хэв маяг
(v1.0-той адил — §4.2, өөрчлөгдөөгүй)

### 4.3 API стандарт
(v1.0-той адил — §4.3, өөрчлөгдөөгүй)

### 4.4 Аюулгүй байдлын checklist (PR бүрт) — **шинэчлэгдсэн**
- [ ] Нууц үг/түлхүүр код дотор байхгүй
- [ ] Шинэ хүснэгт бүрт RLS идэвхжсэн
- [ ] Input validation (DTO + class-validator) байгаа
- [ ] Эрхийн шалгалт (RBAC guard) endpoint бүрт тодорхой заасан
- [ ] Rate-limit шаардлагатай endpoint (auth, OTP) дээр тавигдсан
- [ ] **(шинэ)** Payment webhook (QPay/SocialPay) бүрт **HMAC/signature verification** заавал шалгагдсан, verification амжилтгүй бол 401 буцаана
- [ ] **(шинэ)** Мэдээлэл өөрчилдөг (create/update/delete) endpoint бол audit log дуудалт орсон эсэх

### 4.5 Тестийн стандарт
Прогрессив coverage — §9-ийг үзнэ үү.

---

## 5. Claude Code agent-ийн тохиргоо

### 5.1 CLAUDE.md
(v1.0-той адил)

### 5.2 Custom Skills
(v1.0-той адил — `/new-module`, `/new-screen`, `/migrate`, `/doc-api`, `/release`)

### 5.3 Subagents
(v1.0-той адил бүтэцтэй, доорх нэг мөр засварласан)

| Subagent | Хэзээ ажилладаг | Үүрэг |
|---|---|---|
| `security-auditor` | **§5.4-ыг үзнэ үү (долоо хоног тутмын cron)** эсвэл гараар `/security-audit` | Dependency CVE, auth урсгалын эмзэг тал, secrets, webhook verification шалгана |

### 5.4 Hooks ба автомат аудит — **засварласан**

**Чухал засвар:** Claude Code-ийн `hooks` нь зөвхөн session lifecycle event (`SessionStart`, `PreToolUse`, `PostToolUse` гэх мэт) дээр trigger хийгддэг бөгөөд "долоо хоног бүр" гэсэн **цаг хугацааны давтамж native дэмжигдэхгүй**. Тиймээс:

| Hook/Automation | Trigger | Ажил |
|---|---|---|
| `PostToolUse` | Файл засварласны дараа | lint+format автомат |
| `PostToolUse` | `apps/api/**/*.ts` засварласны дараа | Affected unit тест ажиллуулна |
| `PreToolUse` | `.env`, `docker-compose.prod.yml`, migration файлд бичих оролдлого | Баталгаажуулалтгүй бол блоклоно |
| `SessionStart` | Session эхлэх бүрт | Branch, commit статус, **сүүлийн аюулгүй байдлын аудитын огноог** хэвлэнэ (зөвхөн мэдээлэл, аудит биш) |
| **GitHub Actions scheduled workflow** (`weekly-security-audit.yml`, cron: `0 9 * * 1`) | Долоо хоног бүр Даваа | Claude Code-ийг **headless горимоор** (`claude -p "запусти security-auditor subagent"`) дуудаж, бүрэн аудит хийлгэж, тайланг Slack/имэйлээр илгээнэ |

---

## 6. Эрх, дүрийн систем ба нэвтрэлт

### 6.1 CRUD-түвшний зөвшөөрлийн матриц — **шинэ**

`C`=Create, `R`=Read, `U`=Update, `D`=Delete, `—`=эрхгүй. "Хамрах хүрээ" багана нь тухайн эрх аль өгөгдлийн хүрээнд хүчинтэйг заана.

| Эх сурвалж (resource) | Супер админ | Дэлгүүрийн эзэн | Бүх-салбарын менежер | Салбарын админ | Салбарын менежер | Худалдагч | Харилцагч |
|---|---|---|---|---|---|---|---|
| Салбар (Branches) | CRUD (бүх) | R (бүх) | R (бүх) | RU (өөрийн) | R (өөрийн) | R (өөрийн) | — |
| Бүтээгдэхүүн/каталог | CRUD | R | CRUD (бүх) | CRUD (өөрийн салбарын үнэ) | RU | R | R |
| Агуулах/нөөц | CRUD | R | CRUD (бүх) | CRUD (өөрийн) | RU (өөрийн) | R (өөрийн) | — |
| Захиалга | CRUD (бүх) | R (бүх) | CRUD (бүх) | CRUD (өөрийн) | CRUD (өөрийн) | RU (өөрийн, статус л) | CR (өөрийн) |
| Төлбөр | R (бүх) | R (бүх) | R (бүх) | R (өөрийн) | R (өөрийн) | — | R (өөрийн) |
| Урамшуулал/купон | CRUD | RU | CRUD (бүх) | R | — | — | R (идэвхтэй) |
| Тайлан/аналитик | R (бүх) | R (бүх) | R (бүх) | R (өөрийн) | R (өөрийн) | — | — |
| Ажилтан/эрх (Users) | CRUD (бүх) | R (бүх) | RU (бүх, устгахгүй) | CRUD (өөрийн салбар) | R (өөрийн салбар) | — | — |
| **Аудит лог** | R (бүх) | R (бүх) | R (бүх) | R (өөрийн) | — | — | — |

> Энэ матриц нь Phase 1-ийн RLS policy болон RBAC guard бичихэд шууд ашиглагдана — §8 Phase 1 checklist-д "энэ матрицыг migration болгож хэрэгжүүлэх" гэсэн тодорхой даалгавар байдаг.

### 6.2 Нэвтрэлтийн архитектур — **шийдэгдсэн загвар**

**Асуудал байсан зүйл:** Keycloak нь нэг realm дотор "утасны дугаараар харилцагч, имэйлээр ажилтан" гэсэн ялгаатай identity төрлийг стандартаар дэмждэггүй; үүнийг зөв хийхэд custom SPI (authenticator) бичих шаардлагатай бөгөөд энэ нь Phase 1-д хэт өндөр эрсдэлтэй, цаг ихтэй ажил.

**Шийдвэр (v2.0):** Хоёр тусдаа, гэхдээ **нэг ижил дараах бүтэцтэй JWT** гаргадаг auth зам ашиглана:

| | Харилцагч | Ажилтан/эрх бүхий хэрэглэгч |
|---|---|---|
| Identity provider | Custom NestJS auth модуль (`apps/api/src/auth-customer`) | Keycloak (OIDC, realm client) |
| Identifier | Утасны дугаар (E.164) | И-мэйл |
| Нэвтрэлт (Phase A) | Утас + нууц үг | И-мэйл + нууц үг |
| Нэвтрэлт (Phase B, §6.2.1) | Утас + SMS OTP | И-мэйл + TOTP/имэйл OTP |
| Токен | Өөрийн систем гаргасан JWT (ижил claim бүтэц: `sub, branch_id, role, exp`) | Keycloak гаргасан JWT (mapper-ээр ижил claim бүтэцтэй болгосон) |
| Баталгаажуулалт | Ижил NestJS `JwtAuthGuard`, аль ч эх үүсвэрээс ирсэн ч нэг стандарт claim шалгана | Ижил guard |

Давуу тал: 2 код зам хадгалах "зардал" гарна, гэхдээ Keycloak SPI бичихээс хамаагүй бага эрсдэлтэй, Phase 1 дотор багтаамжтай. **Хоёр систем нэг ижил JWT claim гэрээгээр (contract) уялдсан тул RBAC guard, RLS session variable тохиргоо нэг л удаа бичигдэнэ.**

Refresh token хугацаа (засвар — асуудал #18):
- Харилцагч: 30 хоног
- Худалдагч/салбарын менежер/админ: 14 хоног
- Бүх-салбарын менежер/эзэн/супер админ: **7 хоног** (өндөр эрх тул богино)

#### 6.2.1 OTP өргөтгөл (Phase B, Phase 7-д хэрэгжинэ)
- Утас: SMS OTP (§11.3-т сонгосон vendor-оор)
- И-мэйл: TOTP authenticator эсвэл имэйл OTP
- Эрх бүхий хэрэглэгчид TOTP зөвлөмж

#### 6.2.2 Ирээдүйн сайжруулалт (Phase C, backlog)
Passkey/WebAuthn — өндөр эрхтэй акаунтад.

### 6.3 ORM ба RLS session variable — **шийдэгдсэн загвар**

**Асуудал байсан зүйл:** Prisma зэрэг ORM-ийн connection pooling нь хүсэлт бүрийг өөр connection дээр ажиллуулж болзошгүй тул `SET LOCAL app.branch_id` командыг зөв connection дээр тавихад анхаарал шаардана.

**Шийдвэр:** NestJS **request-scoped interceptor** нь хүсэлт бүрийг `prisma.$transaction(async (tx) => {...})` дотор ороож, transaction эхлэхэд шууд:
```sql
SET LOCAL app.branch_id = $1;
SET LOCAL app.role = $2;
SET LOCAL app.accessible_branches = $3;
```
командыг ажиллуулна. Бүх дараагийн Prisma query нь энэ `tx` объектоор дамжина (module-ууд `tx`-г dependency injection-оор авна). Энэ загварыг Phase 0-ийн төгсгөлд **1 өдрийн spike (турших ажил)**-ээр баталгаажуулж, ADR (`docs/adr/001-rls-transaction-pattern.md`) болгож бичнэ.

---

## 7. Системийн модулиуд

(v1.0-той адил 16 модуль — өөрчлөгдөөгүй, доор Phase-ийн хуваарьт тодорхой холбогдоно)

1. Хэрэглэгч ба эрхийн удирдлага
2. Салбарын удирдлага
3. Бүтээгдэхүүний каталог
4. Агуулах/нөөцийн удирдлага
5. Сагс ба захиалга үүсгэх
6. Захиалгын удирдлага (Orchestration)
7. Төлбөрийн систем
8. Хүргэлт ба хүлээлгэн өгөлт
9. Буцаалт ба нөхөн төлбөр
10. Урамшуулал/купон
11. Сэтгэгдэл/үнэлгээ
12. Мэдэгдэл
13. Харилцагчийн үйлчилгээ
14. Тайлан ба аналитик
15. **Аудит лог** (Phase 1-ээс эхэлж хэрэгжинэ — доор тодорхой)
16. Админ самбар

---

## 8. Үе шат бүрийн ажлын төлөвлөгөө

### Phase 0 — Бэлтгэл (1 долоо хоног) — **өргөтгөсөн**

- [ ] Docker Engine + Compose суулгах
- [ ] `docker-compose.dev.yml`, `docker-compose.staging.yml`, `docker-compose.prod.yml` **гурвыг тусад нь** үүсгэх (шинэ — асуудал #6)
- [ ] Repo, monorepo бүтэц, CLAUDE.md, `.claude/{agents,skills,hooks}` эхний хувилбар
- [ ] ESLint/Prettier/Husky, GitHub Actions CI skeleton
- [ ] **(шинэ)** `.github/workflows/deploy-staging.yml`, `deploy-prod.yml` — GHCR image push + SSH deploy script skeleton (§10.2)
- [ ] **(шинэ)** `.github/workflows/weekly-security-audit.yml` — cron skeleton (§5.4)
- [ ] VS Code + Claude Code өргөтгөл суулгах
- [ ] Node.js 22 + pnpm, Flutter SDK, Android Studio + AVD эмулятор
- [ ] **(шинэ)** 2-3 бодит Android төхөөрөмж (Монголд түгээмэл хямд загвар орсон) тест lab болгож бэлдэх — асуудал #7
- [ ] `docker compose -f docker-compose.dev.yml up -d` бүх сервис healthy
- [ ] **(шинэ)** ORM/RLS spike: Prisma + transaction interceptor загвар турших, ADR бичих (§6.3)

### Phase 0.5 — Дизайн систем ба wireframe (1 долоо хоног, Phase 1-тэй хэсэгчлэн давхцаж эхэлнэ) — **шинэ**

- [ ] Figma (эсвэл ижил төстэй) дээр дизайны систем: өнгө, фонт, компонент (button, input, card, dэлгэцийн загвар)
- [ ] Нэвтрэлт, бүртгэлийн wireframe (харилцагч, ажилтан 2 урсгал)
- [ ] Захиалгын урсгалын (cart→checkout→order status) high-fidelity mockup
- [ ] `frontend-design` зарчмуудыг баримталсан эсэхийг баталгаажуулах
- [ ] **Энэ цагаас хойш дизайн баг үргэлж 1 sprint түрүүлж ажиллана** (§3.1)

### Phase 1 — Суурь бүтэц, Auth, олон-салбарын тусгаарлалт, Аудит лог (3 долоо хоног, +1 долоо хоног v1.0-оос) — **өргөтгөсөн**

- [ ] PostgreSQL схем: `branches`, `users`, `roles`, `user_branch_roles`, **`audit_logs`** + RLS policy — §6.1-ийн матрицаас гаргана
- [ ] Prisma + request-scoped transaction interceptor хэрэгжүүлэх (§6.3 ADR-ийн дагуу)
- [ ] Keycloak realm/client (ажилтны нэвтрэлт), custom claim mapper
- [ ] **Custom customer-auth модуль** (утасны дугаар + нууц үг) — §6.2 загварын дагуу
- [ ] Хоёр эх үүсвэрээс ирсэн JWT-г нэг стандарт `JwtAuthGuard`-аар баталгаажуулах
- [ ] RBAC guard-ыг §6.1 матрицын дагуу бичих
- [x] **(шинэ) Суурь аудит лог:** бүх mutation (create/update/delete) endpoint дээр `AuditInterceptor` — хэн, хэзээ, ямар хүснэгт, өмнөх/дараах утга (JSON diff) хадгална
- [ ] **(шинэ) SMS gateway vendor үнэлгээ:** Монголын 2-3 нийлүүлэгчийг (жиш. Mobicom/Unitel corporate API, 3rd-party aggregator) харьцуулж сонгох, `SmsProvider` абстракц interface бичих (бодит интеграц Phase 7-д)
- [ ] **(шинэ)** Mobile апп: нэвтрэлтийн дэлгэц дээр **"Утасны дугаараар (харилцагч) / И-мэйлээр (ажилтан)"** сонголт эсвэл автоматаар таних логик — асуудал #4
- [ ] Admin-web: салбар удирдах хуудас
- [x] **(шинэ) Ажилтны нэвтрэлт (`auth-staff`):** `POST /auth/staff/login`
      backend proxy (Keycloak Resource Owner Password grant, client secret
      зөвхөн backend талд, admin-web Keycloak руу шууд хандахгүй),
      `LoginThrottleService`-ийг харилцагчийн auth-тай хуваалцаж холбосон
      (namespace-аар тусгаарласан), @Audit("users", "staff.login").
      Admin-web: Vite + React + TS + Tailwind + shadcn/ui + TanStack Query
      scaffold, LoginForm → Dashboard-lite (`GET /auth/me` дуудаж
      "Тавтай морил, \<и-мэйл\>. Дүр: \<role\>" харуулна), access token
      зөвхөн in-memory state-д (localStorage-гүй)
- [ ] **(шинэ)** Backup drill — `pg_dump` автомат sync + сар бүр сэргээх тест **эхлэнэ** (§10.3)
- [ ] Auth + audit unit/integration тест (`test-writer`)

### Phase 2 — Каталог ба агуулах (2-3 долоо хоног)
(v1.0-той бараг адил, доор нэмэлт)

- [x] Бүтээгдэхүүн, ангилал, вариант схем + CRUD API (§6.1 матрицын эрхээр
      хязгаарласан): `Category`/`Product`/`ProductVariant`/`InventoryItem`
      Prisma model + migration (`add_catalog_inventory`,
      `enable_catalog_inventory_rls` — өмнөх `app_current_user_id()`/
      `app_has_global_scope()`/`app_can_manage_branch()` функцүүдийг л дахин
      ашигласан, шинэ SECURITY DEFINER функц нэмээгүй). `RolesGuard`/
      `@Roles()` (§6.1 матрицыг эцэст нь код болгосон — өмнө нь "дараагийн
      ажил" гэж CLAUDE.md-д тэмдэглэгдсэн байсан) endpoint бүрт, DTO
      validation (class-validator), InventoryItem-ийн тоо хэмжээ өөрчлөх нь
      atomic `{ increment: delta }` (+ DB CHECK constraint `quantity >= 0`
      race-safe хамгаалалт).
- [x] **(2-р хэсэг)** Каталог/агуулахын схем өргөтгөл + "бэлэн/захиалгаар"
      логик + салбарын байршил (migration `add_branch_geo_and_catalog_fields`):
      `Branch.district`/`latitude`/`longitude`; `Category`-д `slug`
      (unique)/`description`/`displayOrder`/`isActive`; `Product`-д `slug`
      (unique)/`brand`; `ProductVariant`-д `sku` (unique)/`unit`/`basePrice`
      (өмнөх `price`-ийн нэрийг өөрчилсөн)/`costPrice`/`barcode`/`isActive`/
      `defaultPreOrderEnabled`/`defaultPreOrderLeadDays`; `InventoryItem`-д
      `branchPrice`/`preOrderEnabledOverride`/`preOrderLeadDaysOverride`
      (override) + `lowStockThreshold`-ийн анхны утга 5 болсон. Дундын
      override-resolve util (`src/catalog/inventory-effective.util.ts`):
      `resolveEffectivePrice`/`resolveEffectivePreOrder`/
      `computeAvailabilityStatus` (`IN_STOCK`/`PRE_ORDER`/`OUT_OF_STOCK`).
      "Нийтэд харагдах" `GET /products/:id` (`?branchId=`-аар сонгосон 1
      салбарын, өгөөгүй бол бүх салбараар аггрегатласан) endpoint нь
      InventoryItem-ийн бодит мөрийг (quantity, branchId-ийн жагсаалт)
      ХЭЗЭЭ Ч илгээхгүй, зөвхөн тооцоолсон `{status, leadDays}`-ийг
      буцаана — CUSTOMER ч дуудна (RLS-д мөргөлдөхгүй, учир нь шинэ
      `app_inventory_snapshot_for_variant()` SECURITY DEFINER функц зөвхөн
      серверийн санах ойд зориулсан түүхий баганыг буцаадаг, HTTP хариунд
      квант/салбар шууд гардаггүй; migration `add_public_availability_lookup_function`).
- [ ] MinIO зураг байршуулах endpoint
- [ ] Meilisearch индексжилтийн pipeline
- [x] Салбар тус бүрийн нөөцийн хүснэгт, дутагдлын сэрэмжлүүлэг:
      `InventoryItem.lowStockThreshold` талбар нэмэгдсэн (сэрэмжлүүлэг
      ИЛГЭЭХ мэдэгдлийн урсгал өөрөө Phase 4-ийн мэдэгдлийн модультай хамт
      хэрэгжинэ — энд зөвхөн өгөгдлийн загвар).
- [ ] Admin-web + Mobile: каталог/агуулах UI (Phase 0.5-ийн дизайны дагуу)
- [x] **(шинэ)** Аудит лог: бүтээгдэхүүн/нөөцийн өөрчлөлт бүрт бичигдэж
      байгааг баталгаажуулах тест (`test/catalog-inventory.e2e-spec.ts`)
- [x] **(2-р хэсэг)** §6.1 матрицын дагуу дор хаяж 3 дүр (SUPER_ADMIN,
      BRANCH_MANAGER өөр 2 өөр салбарт, CUSTOMER)-ээр inventory харагдац
      ялгаатай болохыг e2e тестээр батлав (`test/catalog-inventory.e2e-spec.ts`),
      мөн Branch-ийн шинэ геолокацийн талбар, "нийтэд харагдах" availability
      endpoint (IN_STOCK/PRE_ORDER/OUT_OF_STOCK, quantity/branchId
      алдагдаагүй эсэх) — e2e-ээр давхар баталгаажуулав.

### Phase 3a — Сагс ба захиалгын үндсэн урсгал (2 долоо хоног) — **v1.0-ийн Phase 3-аас задарсан**

- [ ] Сагс API, checkout урсгал
- [ ] Захиалгын статусын машин (state machine)
- [ ] **MVP чиглүүлэлт:** эхэндээ **энгийн дүрэм** (харилцагчийн сонгосон салбар шууд = захиалгын салбар; geolocation-т суурилсан автомат чиглүүлэлт биш) — geolocation-based auto-routing-ийг Phase 3b-ийн сүүлд эсвэл backlog-т үлдээнэ
- [ ] Захиалгын CRUD + RBAC guard (§6.1)
- [ ] Аудит лог: захиалгын статус өөрчлөлт бүр

### Phase 3b — Бодит цаг, төлбөр, ухаалаг чиглүүлэлт (2-3 долоо хоног) — **шинэ, тусад нь**

- [ ] WebSocket Gateway + Redis Pub/Sub adapter
- [ ] QPay интеграц: invoice үүсгэх, webhook хүлээн авах
- [ ] **(шинэ) Webhook signature (HMAC) verification** заавал — §4.4
- [ ] Geolocation-д суурилсан автомат чиглүүлэлт (нөөц + зай) — **хэрэв цаг хүрэхгүй бол backlog руу шилжүүлж болох "should-have" ажил** гэж тодорхой тэмдэглэнэ
- [ ] Mobile апп: сагс, checkout, захиалгын түүх, худалдагчийн бодит цагийн мэдэгдэл
- [ ] `qa-e2e-runner`-аар захиалгын бүрэн урсгалын e2e тест

### Phase 4 — Гүйцэтгэл, хүргэлт, мэдэгдэл (2-3 долоо хоног)

- [ ] Худалдагчийн ажлын урсгал
- [ ] Хүргэлт/pickup
- [ ] Мэдэгдлийн модуль (push/SMS/email)
- [ ] **(шинэ)** Бэлэн болсон feature-үүдийг Phase 0-д бэлдсэн **жинхэнэ Android төхөөрөмж дээр** турших — асуудал #7

### Phase 5 — Тайлан ба олон-салбарын удирдлага (1-2 долоо хоног)
(v1.0-той адил)

### Phase 6 — Буцаалт, урамшуулал, дэмжлэг, эрх зүйн бэлтгэл (2-3 долоо хоног) — **өргөтгөсөн**

- [ ] Буцаалт/нөхөн төлбөр
- [ ] Купон/урамшуулал
- [ ] Сэтгэгдэл/үнэлгээ
- [ ] Харилцагчийн үйлчилгээний тасалбар
- [ ] Аудит лог **UI** (админ самбарт хэн юу хийснийг харах хуудас) — §7 модуль #15-ыг эндээс дуусгана
- [ ] **(шинэ) Нууцлалын бодлого, Үйлчилгээний нөхцөл** бичих (§11.1-ийн эрх зүйн зөвлөхтэй хамт)

### Phase 7 — Аюулгүй байдал, OTP өргөтгөл, ачаалалын тест (2-3 долоо хоног)

- [ ] §6.2.1 OTP хэрэгжүүлэлт (сонгосон SMS vendor-оор)
- [ ] `security-auditor` бүрэн аудит (§5.4-ийн cron-оор энэ үеэс тогтмол ажиллаж эхэлсэн байх ёстой)
- [ ] Ачаалалын тест (k6/Artillery) — зэрэгцээ захиалга онцгойлон
- [ ] Backup/restore drill — production-like орчинд бүрэн сэргээлт
- [ ] `release-checklist` skill ажиллуулах

### Phase 8 — Туршилтын нэвтрүүлэлт ба хяналт — **буфер нэмсэн**

- [ ] **(шинэ)** App Store/Google Play submission — review хугацаанд **2-3 долоо хоногийн буфер** тооцно (татгалзах эрсдэлтэй тул давтан илгээх нөөц цаг)
- [ ] 1 салбарт пилот (2 долоо хоног хяналттай)
- [ ] Monitoring идэвхжүүлэх (Prometheus/Grafana/Loki/Sentry)
- [ ] Санал хүсэлт → v1.1 backlog
- [ ] Бусад салбарт үе шаттай нэвтрүүлэх

---

## 9. Тест ба чанарын баталгаажуулалт

### 9.1 Прогрессив coverage босго — **шинэ, засвар #15**

| Phase | Coverage босго (шинэ код) | Тайлбар |
|---|---|---|
| Phase 1-3a | 60% | MVP хурдыг хадгалах, гэхдээ auth/RLS кодод **100%** заавал (аюулгүй байдлын критик хэсэг) |
| Phase 3b-5 | 70% | Систем тогтворжиж эхэлсэн үе |
| Phase 6-8 | 80% | Нэвтрүүлэлтийн өмнөх — чанар хамгийн чухал |

### 9.2 Тестийн түвшин
(v1.0-той адил хүснэгт — Unit/Integration/E2E/Security/Load, хариуцах subagent-ууд)

---

## 10. Ашиглалтад оруулах, CI/CD, хяналт

### 10.1 Орчны 3 түвшин — **шинэ, засвар #6**

| Орчин | Зорилго | Deploy trigger |
|---|---|---|
| `dev` | Хөгжүүлэгчийн локал орчин | Гараар |
| `staging` | QA, pilot demo, QPay sandbox тест | `main` branch merge бүрт автомат |
| `prod` | Бодит хэрэглэгч | Гараар баталгаажуулсны дараа (`release/x.y` tag) |

### 10.2 CI/CD урсгал — **шинэ, засвар #11**

1. PR үүсгэх → CI (lint+typecheck+test+build) + `code-reviewer` subagent тайлан
2. `main` руу merge → GitHub Actions Docker image build → **GHCR (ghcr.io)**-д push
3. Staging руу автомат deploy: SSH action → сервер дээр `docker compose -f docker-compose.staging.yml pull && up -d --wait` → health-check endpoint шалгаж, амжилтгүй бол автомат rollback (өмнөх image tag руу)
4. Prod руу deploy: **гараар баталгаажуулсны дараа** ижил урсгал, гэхдээ `docker-compose.prod.yml`
5. Deploy бүрийн дараа smoke test (`/health`, гол API-уудын хариу) автоматаар ажиллана

### 10.3 Backup drill хуваарь — **засвар #10**
- Phase 1-ээс эхлэн: PostgreSQL өдөр тутмын бүрэн backup + цаг тутмын WAL, MinIO өдөр тутмын sync
- **Сар бүр** автомат сэргээх drill (staging орчинд сэргээж, өгөгдлийн бүрэн бүтэн байдлыг шалгах скрипт)
- Phase 7-д production-like орчинд бүрэн сэргээлтийн эцсийн drill

### 10.4 Monitoring, runbook
(v1.0-той адил)

---

## 11. Гадаад хамаарал ба параллель урсгал

**Энэ хэсэг v2.0-д шинээр нэмэгдсэн** (засвар #9, #12) — учир нь эдгээр ажлууд хөгжүүлэлтийн багаас **гадуур** хугацаа шаарддаг тул Phase 0-ээс эхлэн **зэрэгцээ** урсгал болгож эхлэх ёстой, эс бөгөөс Phase 3b/7/8-д хөгжүүлэлтийг зогсоох эрсдэлтэй.

| Ажил | Хариуцах | Хэзээ эхлэх | Ойролцоо хугацаа | Хамааралтай Phase |
|---|---|---|---|---|
| 11.1 Хувь хүний мэдээлэл хамгаалах хууль, Нууцлалын бодлого/Үйлчилгээний нөхцөлийн эрх зүйн зөвлөгөө | Эрх зүйч (гадаад/дотоод) | Phase 0 | 3-4 долоо хоног (параллель) | Phase 6 (баримт бэлэн байх), Phase 8 (нэвтрүүлэлт) |
| 11.2 QPay мерчант гэрээ, API credential авах | Бизнесийн тал / эзэн | Phase 0 | 2-6 долоо хоног (банк/оператороос хамаарна) | Phase 3b (эсрэг тохиолдолд blocker) |
| 11.3 SMS gateway нийлүүлэгчтэй гэрээ | Бизнесийн тал | Phase 1 (үнэлгээ), гэрээ Phase 3-т эхэлнэ | 2-3 долоо хоног | Phase 7 (OTP хэрэгжилт) |
| 11.4 Apple Developer / Google Play Developer акаунт үүсгэх | Эзэн/админ | Phase 0 | 1-2 долоо хоног (Apple-ийн баталгаажуулалт удаан байж болно) | Phase 8 |
| 11.5 Домэйн, SSL, серверийн эрх (аль хэдийн байгаа full self-hosted сервер) | DevOps хариуцагч | Phase 0 | — | Бүх Phase |

**Дүрэм:** Sprint planning бүрд §11-ийн мөр бүрийн статусыг тэргүүн ээлжинд шалгаж, blocker болох эрсдэлтэй бол эрт дохио өгнө.

---

## 12. Эрсдэл ба нөөц төлөвлөгөө — **шинэчлэгдсэн**

| Эрсдэл | Магадлал | Нөлөө | Бууруулах арга |
|---|---|---|---|
| RLS буруу тохируулснаас мэдээлэл алдагдах | Дунд | Маш өндөр | `db-schema-guardian` + Phase 0 ORM spike + §6.1 матрицаас шууд гаргасан policy |
| **(шинэ)** Хосолсон auth (custom + Keycloak) code duplication-с алдаа гарах | Дунд | Өндөр | Нэг ижил JWT claim contract, нэг ижил guard, интеграцийн тест хоёр эх үүсвэрт адилхан ажиллана |
| **(шинэ)** QPay мерчант гэрээ хугацаандаа бэлэн болохгүй | Дунд | Өндөр (Phase 3b blocker) | Phase 0-ээс эхэлсэн параллель урсгал (§11.2), QPay sandbox дээр эрт турших |
| SMS gateway найдвартай/зардал | Дунд | Дунд | Эхэлж нууц үгтэй хослуулна, олон vendor нөөцлөнө (§11.3) |
| **(шинэ)** App store review татгалзах | Дунд | Дунд | Phase 8-д 2-3 долоо хоногийн буфер, Apple/Google guideline-ийг Phase 6-д урьдчилж шалгах |
| **(шинэ)** Эрх зүйн бичиг баримт хугацаандаа бэлэн болохгүй | Бага | Дунд | Phase 0-ээс эхэлсэн параллель урсгал (§11.1) |
| Sprint хугацаа хэтрэх (scope creep) | Дунд | Дунд | Backlog хатуу тогтоох, "should-have" ажлыг (жиш. geolocation auto-routing) тодорхой тэмдэглэж backlog руу шилжүүлэх боломжтой болгосон |
| Гар утасны орчны асуудал | Бага | Бага | Phase 0-д эмулятор **+ жинхэнэ төхөөрөмж** баталгаажуулна |

---

## 13. Эхлэх эхний алхмууд

1. [ ] Docker суулгах, monorepo, CLAUDE.md, `.claude/{agents,skills,hooks}` эхний хувилбар
2. [ ] **(шинэ)** §11-ийн гадаад хамаарлын 5 мөрийг өнөөдрөөс эхлүүлэх (ялангуяа QPay мерчант хүсэлт, эрх зүйн зөвлөгөө)
3. [ ] `docker-compose.dev/staging/prod.yml` 3 файлыг эхний skeleton-оор бичих
4. [ ] Node.js 22 + pnpm, Flutter SDK, Android Studio + AVD + жинхэнэ төхөөрөмж бэлдэх
5. [ ] VS Code + Claude Code суулгах
6. [ ] **(шинэ)** ORM/RLS transaction pattern spike хийж ADR бичих (§6.3)
7. [ ] Phase 0.5: дизайны системийн эхний framework эхлүүлэх
8. [ ] Phase 1 sprint planning: §6.1 матрицаас RLS/RBAC migration, суурь аудит лог, хосолсон auth загварыг эхний backlog болгож задлах

---

*Амьд баримт бичиг — sprint болгонд §12-ыг хянана, §11-ийн гадаад хамаарлын явцыг тогтмол шалгана.*
