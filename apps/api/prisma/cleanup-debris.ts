// Dev DB-д e2e тест/ad-hoc Playwright/curl баталгаажуулалтаас үлдсэн
// debris мөрүүдийг цэвэрлэх script — `cleanup-branch-debris.ts`-ийн
// зарчмыг (2026-08-20) Category/Product/Order-д өргөтгөв (2026-08-21):
// debris 4 дэх удаагаа (энэ удаад Category/Product дахин, "Realtime"/
// "srch" prefix-тэй) гарч, гар аргаар нэг нэгээр нь олж цэвэрлэх нь
// тогтвортой шийдэл БИШ гэдгийг баталсан. `package.json`-ийн
// `posttest:e2e` hook-оор `pnpm test:e2e` амжилттай дуусах БҮРД
// автоматаар ажиллана (pnpm 9.0.0 custom script-ийн post-hook-ыг
// `.npmrc`-д нэмэлт тохиргоо шаардалгүйгээр АВТОМАТААР дэмждэгийг
// бодитоор шалгаж баталгаажуулсан).
//
// ⚠️ ЧУХАЛ (RLS bypass): `branches`/`categories`/`products`/`orders`
// хүснэгтүүд FORCE ROW LEVEL SECURITY идэвхитэй тул seed-catalog-demo.ts-тэй
// ЯГ ИЖИЛ шалтгаанаар `APP_DATABASE_URL` (app_runtime, NOBYPASSRLS) БИШ,
// жинхэнэ Postgres superuser `DATABASE_URL`-ээр шууд холбогдоно.
//
// Debris таних дүрэм (dev DB-г бодитоор шинжилж 2026-08-21-нд гаргасан):
// - **Branch**: нэрэндээ 10+ дараалсан цифр (`cleanup-branch-debris.ts`-ийн
//   анхны дүрэм, `name` баганаар — Branch-д `slug` талбар байхгүй) + хуучин
//   "Mobile демо салбар" (Latin) давхардал.
// - **Category/Product**: `slug` баганад 10+ дараалсан цифр (`name`-д БИШ —
//   зарим debris Product/Category-ийн `name`-д тоо огт байдаггүй, жиш:
//   "Ноолуур цамц", харин `slug`-д ҮРГЭЛЖ timestamp орсон байдаг, жиш:
//   "noolluur-tsamts-1787286529105"). Баталгаажуулалт: канончлогдсон
//   `seed-catalog-demo.ts`-ийн бүх Category/Product `demo-` prefix-тэй,
//   slug-даа ЯМАР Ч тоо агуулаагүй (`demo-coca-cola-500ml` гэх мэт) тул
//   энэ дүрэм 100% давхцалгүй ялгадаг.
// - **Order**: Branch/Category/Product-ээс ЯЛГААТАЙ нь `isActive`/`slug`
//   талбаргүй тул шууд дүрэм тавих боломжгүй — оронд нь **debris Branch-д
//   хамаарах Order бүр debris** гэдгийг дэвшүүлсэн (dev DB-г шалгаж:
//   1841 идэвхтэй Order-ийн 1839 нь debris-нэртэй Branch руу заасан, ердөө
//   2 нь канончлогдсон "Мобайл демо салбар" руу заасан байсныг баталгаажуулсан).
//   Order-д `isActive` талбар байхгүй тул soft-deactivate биш, ШУУД устгана
//   (Category/Product-ийн адил "захиалгын түүхтэй тул soft л зөв" гэсэн
//   зарчим Order ӨӨРӨӨ яг тэр "захиалгын түүх" учраас энд хамаарахгүй —
//   эдгээр нь угаасаа ЖИНХЭНЭ бизнесийн бус, зөвхөн e2e тестийн зориулалттай
//   мөрүүд). `return_requests.orderItemId → order_items.id` бол
//   `onDelete: Restrict` тул debris order-ийн items-тай холбоотой
//   ReturnRequest-ийг ЭХЛЭЭД устгаж, дараа нь Order-ыг устгана (OrderItem
//   Order-оос Cascade-аар автоматаар устана).
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const DEBRIS_NAME_PATTERN = /[0-9]{10,}/;
const LEGACY_SUPERSEDED_DEMO_NAME = 'Mobile демо салбар';
const CANONICAL_DEMO_NAME = 'Мобайл демо салбар';

// ⚠️ ЗОРИУДАА идэвхтэй (isActive:true) төдийгүй, БҮХ Branch-ыг шалгана
// (isActive=false болсон эсэхээс үл хамааран) — учир нь `cleanupOrders`-д
// ӨМНӨХ ажиллуулалтаар аль хэдийн isActive=false болсон debris Branch-уудад
// хамаарах, гэвч ЦАГ ХОЙШИЛСОН устгагдаагүй debris Order-уудыг (жиш: энэ
// script анх удаа Order цэвэрлэлт нэмэгдэхээс ӨМНӨ хуримтлагдсан) ч мөн
// хамруулж, "нэг удаагийн catch-up" болон "тогтмол ажиллуулалт" хоёуланд
// нь адил зөв ажиллах ёстой.
async function cleanupBranches(prisma: PrismaClient): Promise<string[]> {
  const allBranches = await prisma.branch.findMany({
    select: { id: true, name: true, isActive: true },
  });

  const debrisBranches = allBranches.filter(
    (b) =>
      b.name !== CANONICAL_DEMO_NAME &&
      (DEBRIS_NAME_PATTERN.test(b.name) ||
        b.name === LEGACY_SUPERSEDED_DEMO_NAME),
  );
  const newlyFoundIds = debrisBranches
    .filter((b) => b.isActive)
    .map((b) => b.id);

  console.log(
    `[Branch] Нийт: ${allBranches.length}, debris (нийт): ${debrisBranches.length}, шинээр идэвхгүй болгох: ${newlyFoundIds.length}`,
  );

  if (newlyFoundIds.length > 0) {
    const result = await prisma.branch.updateMany({
      where: { id: { in: newlyFoundIds } },
      data: { isActive: false },
    });
    console.log(`[Branch] ✅ ${result.count} мөр isActive=false боллоо.`);
  }

  return debrisBranches.map((b) => b.id);
}

async function cleanupCategoriesAndProducts(prisma: PrismaClient) {
  const activeCategories = await prisma.category.findMany({
    where: { isActive: true },
    select: { id: true, slug: true },
  });
  const debrisCategoryIds = activeCategories
    .filter((c) => DEBRIS_NAME_PATTERN.test(c.slug))
    .map((c) => c.id);
  console.log(
    `[Category] Нийт идэвхтэй: ${activeCategories.length}, debris: ${debrisCategoryIds.length}`,
  );
  if (debrisCategoryIds.length > 0) {
    const result = await prisma.category.updateMany({
      where: { id: { in: debrisCategoryIds } },
      data: { isActive: false },
    });
    console.log(`[Category] ✅ ${result.count} мөр isActive=false боллоо.`);
  }

  const activeProducts = await prisma.product.findMany({
    where: { isActive: true },
    select: { id: true, slug: true },
  });
  const debrisProductIds = activeProducts
    .filter((p) => DEBRIS_NAME_PATTERN.test(p.slug))
    .map((p) => p.id);
  console.log(
    `[Product] Нийт идэвхтэй: ${activeProducts.length}, debris: ${debrisProductIds.length}`,
  );
  if (debrisProductIds.length > 0) {
    const result = await prisma.product.updateMany({
      where: { id: { in: debrisProductIds } },
      data: { isActive: false },
    });
    console.log(`[Product] ✅ ${result.count} мөр isActive=false боллоо.`);
  }
}

async function cleanupOrders(prisma: PrismaClient, debrisBranchIds: string[]) {
  if (debrisBranchIds.length === 0) {
    console.log('[Order] Debris Branch олдоогүй тул алгаслаа.');
    return;
  }

  // return_requests → order_items нь onDelete: Restrict тул Order-ыг
  // устгахаас ӨМНӨ debris order-уудын item-тэй холбоотой ReturnRequest-ийг
  // эхлээд устгана.
  const deletedReturns = await prisma.returnRequest.deleteMany({
    where: {
      orderItem: { order: { branchId: { in: debrisBranchIds } } },
    },
  });
  console.log(
    `[Order] ${deletedReturns.count} холбогдох ReturnRequest мөрийг эхлээд устгав.`,
  );

  // OrderItem нь Order-оос onDelete: Cascade тул тусад нь устгах шаардлагагүй.
  const deletedOrders = await prisma.order.deleteMany({
    where: { branchId: { in: debrisBranchIds } },
  });
  console.log(`[Order] ✅ ${deletedOrders.count} debris Order устгагдав.`);
}

async function main() {
  const prisma = new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL } },
  });

  const debrisBranchIds = await cleanupBranches(prisma);
  await cleanupCategoriesAndProducts(prisma);
  await cleanupOrders(prisma, debrisBranchIds);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Debris цэвэрлэлтийн script амжилтгүй боллоо:', err);
  process.exit(1);
});
