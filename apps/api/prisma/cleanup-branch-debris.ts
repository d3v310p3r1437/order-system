// Dev DB-д e2e тест/ad-hoc Playwright/curl баталгаажуулалтаас үлдсэн Branch
// debris мөрүүдийг isActive=false болгох цэвэрлэлтийн script. Устгахгүй
// (Order.branch → onDelete: Restrict тул захиалгын түүхтэй Branch-ыг
// хатуу устгах боломжгүй ч, Category/Product-той адилаар захиалгын
// түүхгүй ч гэсэн зөвхөн isActive=false-оор л хангалттай гэж шийдсэн —
// CLAUDE.md-ийн "Тестийн стандарт" биш, энэ бол зөвхөн dev DB fixture
// цэвэрлэлт).
//
// ⚠️ ЧУХАЛ (RLS bypass): `branches` хүснэгт FORCE ROW LEVEL SECURITY
// идэвхтэй тул seed-catalog-demo.ts-тэй ЯГ ИЖИЛ шалтгаанаар
// `APP_DATABASE_URL` (app_runtime, NOBYPASSRLS) БИШ, жинхэнэ Postgres
// superuser `DATABASE_URL`-ээр шууд холбогдоно.
//
// Debris таних дүрэм (dev DB-г бодитоор шинжилж гаргасан, 2026-08-20):
// бүх e2e-spec (orders/cart/returns/payment/realtime/reports/
// catalog-inventory/delivery-routing/product-image/branch)-ийн үүсгэдэг
// Branch нэр бүр `Date.now()`-ийн 10+ оронтой тоо (эсвэл search.e2e-spec.ts-ийн
// `srch${Date.now()}...` хэлбэрийн tag) агуулдаг тул нэрэндээ 10+ дараалсан
// цифртэй ямар ч Branch = debris. Мөн ad hoc Playwright/Debug/Verify
// session-үүдийн үүсгэсэн Branch (жиш: "Playwright тест салбар...",
// "DebugBranch...", "Verify Хэрэглэгч Хайрцаг...") ч ЯГ ижил
// timestamp-суффикстэй тул энэ ганц дүрмээр аль хэдийн хамрагддаг.
// Цорын ганц үл хамаарах debris мөр бол "Mobile демо салбар" (Latin,
// Phase 2 катологийн анхны ad hoc баталгаажуулалтаар үүссэн, 0
// захиалга/inventory-тай, `seed-catalog-demo.ts`-ийн канончлогдсон
// "Мобайл демо салбар" (Cyrillic)-аар аль хэдийн орлуулагдсан) — нэрэндээ
// тоо агуулаагүй тул тусад нь нэрээр нь зааж өгсөн.
//
// Баталгаажуулалт: энэ дүрмээр (isActive=true) шүүхэд яг л
// "Мобайл демо салбар"-аас бусад бүх идэвхтэй Branch тохирсныг (767
// нийтээс 764 идэвхтэй, 763 нь энэ дүрэмд таарсан) шууд SQL-ээр давхар
// шалгасан — ямар ч "тохирохгүй" үлдэгдэл мөр байгаагүй.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const DEBRIS_NAME_PATTERN = /[0-9]{10,}/;
const LEGACY_SUPERSEDED_DEMO_NAME = 'Mobile демо салбар';
const CANONICAL_DEMO_NAME = 'Мобайл демо салбар';

async function main() {
  const prisma = new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL } },
  });

  const activeBranches = await prisma.branch.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  });

  const debrisIds = activeBranches
    .filter(
      (b) =>
        b.name !== CANONICAL_DEMO_NAME &&
        (DEBRIS_NAME_PATTERN.test(b.name) ||
          b.name === LEGACY_SUPERSEDED_DEMO_NAME),
    )
    .map((b) => b.id);

  const survivors = activeBranches.filter((b) => !debrisIds.includes(b.id));

  console.log(
    `Нийт идэвхтэй Branch: ${activeBranches.length}, debris гэж тодорхойлогдсон: ${debrisIds.length}, идэвхтэй хэвээр үлдэх: ${survivors.length}`,
  );
  console.log(
    'Идэвхтэй хэвээр үлдэх Branch:',
    survivors.map((b) => b.name),
  );

  if (debrisIds.length === 0) {
    console.log('Цэвэрлэх debris олдсонгүй.');
    await prisma.$disconnect();
    return;
  }

  const result = await prisma.branch.updateMany({
    where: { id: { in: debrisIds } },
    data: { isActive: false },
  });

  console.log(`✅ ${result.count} debris Branch isActive=false боллоо.`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Branch debris цэвэрлэлтийн script амжилтгүй боллоо:', err);
  process.exit(1);
});
