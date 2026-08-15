#!/usr/bin/env bash
# ------------------------------------------------------------------
# Олон салбартай захиалгын систем — төслийн эхний бүтцийг үүсгэх script
# Ажиллуулах: bash bootstrap.sh <project-folder-name>
# ------------------------------------------------------------------
set -euo pipefail

PROJECT_NAME="${1:-order-system}"

if [ -d "$PROJECT_NAME" ]; then
  echo "❌ '$PROJECT_NAME' фолдер аль хэдийн байна. Өөр нэр өгнө үү."
  exit 1
fi

echo "📁 Төслийн фолдер үүсгэж байна: $PROJECT_NAME"
mkdir -p "$PROJECT_NAME"
cd "$PROJECT_NAME"

# --- Дэд фолдерууд ---
mkdir -p apps/api apps/admin-web apps/mobile
mkdir -p infra/migrations
mkdir -p docs/api-spec docs/adr
mkdir -p .claude/agents .claude/skills .claude/hooks
mkdir -p .github/workflows

# --- git эхлүүлэх ---
git init -q

# --- .gitignore ---
cat > .gitignore <<'EOF'
node_modules/
.env
.env.*
!.env.example
dist/
build/
*.log
.DS_Store
apps/mobile/.dart_tool/
apps/mobile/build/
apps/mobile/.flutter-plugins*
coverage/
EOF

# --- .env.example ---
cat > .env.example <<'EOF'
# --- PostgreSQL ---
POSTGRES_USER=app
POSTGRES_PASSWORD=changeme
POSTGRES_DB=order_system
DATABASE_URL=postgresql://app:changeme@localhost:5432/order_system

# --- Redis ---
REDIS_URL=redis://localhost:6379

# --- Keycloak ---
KEYCLOAK_ADMIN=admin
KEYCLOAK_ADMIN_PASSWORD=changeme
KEYCLOAK_REALM=order-system
KEYCLOAK_URL=http://localhost:8080

# --- MinIO ---
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=changeme123
MINIO_URL=http://localhost:9000

# --- Meilisearch ---
MEILI_MASTER_KEY=changeme_master_key
MEILI_URL=http://localhost:7700

# --- Custom customer-auth (§6.2) ---
JWT_SECRET=changeme_dev_only_secret
JWT_ACCESS_EXPIRY=15m
EOF

# --- docker-compose.dev.yml ---
cat > infra/docker-compose.dev.yml <<'EOF'
services:
  postgres:
    image: postgres:17
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-app}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-changeme}
      POSTGRES_DB: ${POSTGRES_DB:-order_system}
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-app}"]
      interval: 5s
      timeout: 5s
      retries: 10

  redis:
    image: redis:7
    restart: unless-stopped
    ports: ["6379:6379"]
    volumes: ["redisdata:/data"]

  # Dev горим: хурдан эхлэхийн тулд embedded H2. Staging/prod дээр
  # эрх бүхий хэрэглэгчийн бодит датаг Postgres backend руу шилжүүлнэ.
  keycloak:
    image: quay.io/keycloak/keycloak:latest
    restart: unless-stopped
    command: start-dev
    environment:
      KEYCLOAK_ADMIN: ${KEYCLOAK_ADMIN:-admin}
      KEYCLOAK_ADMIN_PASSWORD: ${KEYCLOAK_ADMIN_PASSWORD:-changeme}
    ports: ["8080:8080"]

  minio:
    image: minio/minio
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER:-minioadmin}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD:-changeme123}
    ports: ["9000:9000", "9001:9001"]
    volumes: ["miniodata:/data"]

  meilisearch:
    image: getmeili/meilisearch:latest
    restart: unless-stopped
    environment:
      MEILI_MASTER_KEY: ${MEILI_MASTER_KEY:-changeme_master_key}
      MEILI_ENV: development
    ports: ["7700:7700"]
    volumes: ["meilidata:/meili_data"]

volumes:
  pgdata:
  redisdata:
  miniodata:
  meilidata:
EOF

# --- staging/prod compose-ийн эхний skeleton (дараа нь бөглөнө) ---
cat > infra/docker-compose.staging.yml <<'EOF'
# TODO (Phase 0): Traefik + TLS, Keycloak-ийг Postgres backend руу шилжүүлэх,
# resource limit, restart policy нэмнэ. §10.1-ийг үзнэ үү.
EOF
cp infra/docker-compose.staging.yml infra/docker-compose.prod.yml

# --- CLAUDE.md ---
cat > CLAUDE.md <<'EOF'
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
EOF

# --- README.md ---
cat > README.md <<'EOF'
# Order System

Олон салбартай онлайн дэлгүүрийн захиалгын систем.

## Эхлэх
1. `cp .env.example .env` — утгуудыг бөглөнө
2. `docker compose -f infra/docker-compose.dev.yml up -d`
3. Дэлгэрэнгүй төлөвлөгөө: [`docs/plan.md`](docs/plan.md)
4. Claude Code-д зориулсан заавар: [`CLAUDE.md`](CLAUDE.md)
EOF

# --- .claude/agents, skills, hooks: placeholder ---
cat > .claude/agents/README.md <<'EOF'
Энэ фолдерт subagent-уудын markdown файлууд байрлана (жиш: code-reviewer.md,
test-writer.md, db-schema-guardian.md, security-auditor.md, bug-hunter.md,
qa-e2e-runner.md — docs/plan.md §5.3).

Хамгийн хялбар арга: VS Code дээр Claude Code нээгээд шууд бичих:
"docs/plan.md §5.3-т заасан subagent-уудыг .claude/agents/ дотор үүсгэ"
EOF
cat > .claude/skills/README.md <<'EOF'
Энэ фолдерт custom skill-үүд байрлана (docs/plan.md §5.2: backend-module,
flutter-screen, db-migration, api-doc, release-checklist).
EOF
cat > .claude/hooks/README.md <<'EOF'
Энэ фолдерт hook тохиргоо байрлана (docs/plan.md §5.4).
EOF

# --- placeholder root package.json (pnpm workspace) ---
cat > package.json <<'EOF'
{
  "name": "order-system",
  "private": true,
  "packageManager": "pnpm@9.0.0",
  "workspaces": ["apps/*"]
}
EOF
cat > pnpm-workspace.yaml <<'EOF'
packages:
  - "apps/*"
EOF

git add -A
git commit -q -m "chore: initial project scaffold from development plan"

echo ""
echo "✅ Бэлэн! Дараах алхмуудыг хийнэ үү:"
echo "   1. docs/plan.md файлд төлөвлөгөөгөө хуулж тавих"
echo "   2. cp .env.example .env  (утгуудыг бөглөх)"
echo "   3. cd $PROJECT_NAME && code ."
echo "   4. VS Code дотор Claude Code нээгээд Phase 1-ийг эхлүүлэх"
