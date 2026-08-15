# Олон салбартай захиалгын систем — CLAUDE.md

## Төслийн зорилго
Салбар тус бүр админ/менежер/худалдагч эрхтэй, бүх салбарыг хариуцсан
менежер/дэлгүүрийн эзэн/супер админ эрхийн давхарга бүхий онлайн дэлгүүрийн
захиалгын систем. Бүрэн төлөвлөгөө: `docs/plan.md`.

## Стек
Node.js 22 + NestJS + Prisma + PostgreSQL (RLS) + Redis + Keycloak (staff auth)
+ custom phone-auth (customer auth) + MinIO + Meilisearch + Flutter + React.

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

## Эрх, нэвтрэлт (docs/plan.md §6.2)
Харилцагч → утасны дугаар + custom auth модуль. Ажилтан/эрх бүхий хэрэглэгч →
и-мэйл + Keycloak. Хоёулаа ижил JWT claim бүтэцтэй (`sub, branch_id, role, exp`),
нэг `JwtAuthGuard`-аар шалгагдана.

## Одоогийн Phase
Phase 1 — Суурь бүтэц, Auth, RLS, аудит лог. Дэлгэрэнгүй: `docs/plan.md` §8.
