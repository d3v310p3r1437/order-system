# ADR 005: Шинэ SECURITY DEFINER SQL функц хэзээ зөвтгөгддөг вэ

- Статус: Хүлээн зөвшөөрсөн
- Огноо: 2026-08-16
- Холбоотой: `docs/adr/001-rls-transaction-pattern.md`,
  `docs/plan.md` §6.1, §8 Phase 2 (2-р хэсэг),
  `apps/api/prisma/migrations/20260816031625_add_public_availability_lookup_function`,
  `apps/api/src/catalog/inventory-effective.util.ts`,
  `apps/api/src/catalog/product/product.service.ts`

## Асуудал

`inventory_items` хүснэгт дээрх RLS policy (`inventory_items_select`,
`20260816023759_enable_catalog_inventory_rls`) зөвхөн
`app_can_manage_branch(branchId)` шаардлагыг хангасан (BRANCH_ADMIN/
BRANCH_MANAGER/global scope) хэрэглэгчид SELECT зөвшөөрдөг — CUSTOMER
дүр ХЭЗЭЭ Ч биш (§6.1 матриц: "нөөцийн тоо нууц"). PostgreSQL RLS нь
**мөр-түвшний** (row-level), багана-түвшний биш хамгаалалт тул энэ
хязгаарлалтыг "багана сонгож SELECT хийх" (жиш: `SELECT status FROM
inventory_items ...`) аргаар тойрох боломжгүй — CUSTOMER session-д
policy-ийн `USING` нөхцөл барихгүй л бол ямар ч багана сонговол 0 мөр
буцна.

Гэвч `GET /products/:id` (docs/plan.md §8 Phase 2, 2-р хэсэг) нь
CUSTOMER-д ч "бэлэн үү / захиалгаар авах уу" гэдгийг мэдэгдэх ёстой.
Иймд серверийн код (CUSTOMER-ийн нэрийн өмнөөс ажиллаж буй `tx`) ямар нэг
байдлаар RLS-ийг зохион байгуулалттайгаар "тойрох" шаардлагатай болсон.

## Шийдвэр

**Зөвхөн quantity/override зэрэг түүхий (raw) баганыг серверийн санах
ойд буцаадаг, БИЗНЕС ЛОГИК ОГТ АГУУЛААГҮЙ, нарийн хязгаарлагдмал
SECURITY DEFINER SQL функц** нэмнэ (`app_inventory_snapshot_for_variant`,
`20260816031625_add_public_availability_lookup_function` migration) —
`docs/adr/001`-д аль хэдийн тогтоосон `app_can_manage_branch()`,
`app_accessible_branch_ids()` гэх мэт функцүүдтэй **яг ижил зарчмаар**
(migration/DDL-ийг зөвхөн superuser `app` холболтоор хийдэг тул функцийн
эзэмшигч RLS-ийг бүрэн тойрдог — ADR 001-ийн §"Файлууд" хэсгийг үз).

### Яагаад raw quantity-г SQL түвшинд биш, TS түвшинд redact хийдэг

`app_inventory_snapshot_for_variant()` нь `IN_STOCK`/`PRE_ORDER`/
`OUT_OF_STOCK` шийдвэрийг ӨӨРӨӨ гаргадаггүй — зөвхөн
`{branchId, quantity, preOrderEnabledOverride, preOrderLeadDaysOverride}`
түүхий баганыг буцаана. Бодит "IN_STOCK vs PRE_ORDER vs OUT_OF_STOCK"
шийдвэр **зөвхөн** `src/catalog/inventory-effective.util.ts`-ийн
`computeAvailabilityStatus()`-д (ТS тал, ганц газар) бичигдсэн. Учир нь:

1. **Логик давхардуулахгүй байх зарчим** (CLAUDE.md "Кодын стандарт"):
   хэрэв SQL функц дотор `CASE WHEN quantity > 0 THEN 'IN_STOCK' ...`
   гэж бичвэл, яг ижил branching логик хоёр газар (SQL БОЛОН
   `computeAvailabilityStatus()`) — өөр хэлээр (PL/pgSQL vs TypeScript) —
   давхар оршиж, ирээдүйд нэгийг нь өөрчлөөд нөгөөг мартах эрсдэл гарна
   (жиш: preorder leadDays override-ийн тооцоолол өөрчлөгдвөл хоёр
   газарт зэрэг засах шаардлагатай болно).
2. **SQL функцийг аль болох "нарийн" (narrow) байлгах**: SECURITY
   DEFINER функц бол RLS-ийг ухамсартайгаар тойрдог давхаргын цоорхой
   (peephole) тул түүний буцаах өгөгдлийн хэлбэрийг аль болох бага,
   тодорхой зорилготой байлгах нь аудит хийхэд хялбар. Бизнес логик
   (шийдвэр гаргалт) SQL функц дотор байхгүй тусам "энэ функц юу
   зөвшөөрдөг вэ" гэдгийг харахад амархан.
3. `computeAvailabilityStatus()` нь STAFF-ийн шууд InventoryItem унших
   зам (RLS-ээр аль хэдийн зөвшөөрөгдсөн, жиш ирээдүйн admin-web
   каталог/агуулах UI) БОЛОН энэ SQL snapshot мөр хоёуланд нь ижил
   duck-typed интерфейсээр (`quantity`, `preOrderEnabledOverride`,
   `preOrderLeadDaysOverride`) ажилладаг тул нэг л функцийг хоёр
   context-д дахин ашиглаж болно.

`ProductService.computeVariantAvailability()` нь SQL функцээс ирсэн
мөрийг (эсвэл мөр байхгүй бол `null`-ийг, доорх бүлгийг үз) шууд
`computeAvailabilityStatus()`-д дамжуулж, зөвхөн үр дүн
(`{status, leadDays}`)-ийг HTTP хариунд оруулна — `quantity`/`branchId`
бодит утга JS/TS процессын дотор л амьдарч, JSON.stringify-д хэзээ ч
хүрдэггүй.

### "Мөр байхгүй" (no InventoryItem row) тохиолдол

Тухайн branchId-д энэ variant-ийн InventoryItem мөр огт үүсээгүй байж
болно (жиш: тухайн салбар энэ барааг огт захиалж байгаагүй). Энэ
тохиолдлыг **алдаа шидэлгүй** OUT_OF_STOCK гэж эелдэгээр тооцоолохоор
`computeAvailabilityStatus()` өөрөө `item: ... | null | undefined`
параметр авдаг болгосон (`item` falsy бол шууд OUT_OF_STOCK) — SQL
функцийн 0-мөр хариуг дуудагч тал (`ProductService`) тусад нь шалгаж
OUT_OF_STOCK буцаах логик БИЧИХГҮЙ, ганц газар (util) л шийднэ. Нэгж
тест: `src/catalog/inventory-effective.util.spec.ts` ("item null...",
"item undefined ч мөн адил...").

## Ирээдүйд ижил хэрэгцээ гарвал — ЗАРЧИМ

**Шинэ SECURITY DEFINER функц ЗӨВХӨН дараах БҮХ нөхцөл хангагдсан үед л
зөвтгөгдөнө:**

1. Зорилго нь **зөвхөн тооцоолсон/redact хийсэн утга** (enum, boolean,
   тоолол) буцаах, RLS-ээр хориглогдсон хүснэгтийн **түүхий мөрийг
   бүхэлд нь эсвэл нууц баганыг** (жиш: quantity, үнэ, хувийн мэдээлэл)
   HTTP хариунд шууд гаргах ЗОРИЛГОГҮЙ.
2. Бизнес шийдвэр гаргах логик (branching, тооцоолол) нь функц дотор
   БИШ, TS талд (боломжтой бол одоо байгаа dundын util-д) байрлана —
   SQL функц зөвхөн "read + narrow" хийдэг.
3. Ийм зорилгод **өмнө нь бичигдсэн ижил төстэй функц байхгүй эсэхийг
   эхлээд шалгасан байх ёстой** — `app_can_manage_branch()`,
   `app_accessible_branch_ids()`, `app_inventory_snapshot_for_variant()`
   гэх мэт одоо байгаа функцуудын зорилго давхцаж байвал **шинэ функц
   БҮҮ зохио, байгааг нь дахин ашигла эсвэл параметржүүлж өргөт**.
4. Migration-ийн коммент/тайлбарт яагаад RLS policy өөрөө хангалтгүй
   байсан (ямар дүр ямар өгөгдлийг ямар шалтгаанаар харах ёстой болсон)
   гэдгийг тодорхой бичнэ — ADR 001, ADR 005-ийг заавал ишлэнэ.

Хэрэв (1)-ийг хангахгүй бол (жиш: staff-д зориулсан, RLS-ээр аль хэдийн
зөвшөөрөгдсөн энгийн CRUD унших endpoint) — SECURITY DEFINER огт
хэрэггүй, энгийн `prisma.tx.<model>.findMany()`-г RLS-тэйгээ ажиллуулна.

## Мэдэгдэж буй trade-off

- SECURITY DEFINER функц бол RLS-ийн "сүүлчийн хамгаалалт" зарчмын
  ухамсартай ялгаа (цоорхой) тул шинэ ийм функц нэмэх бүрт код review-д
  онцгой анхаарал шаардана (checklist: §4.4 аюулгүй байдлын checklist-д
  нэмж болох зүйл).
- Функц PUBLIC-д EXECUTE эрхтэй (Postgres анхдагч) тул `app_runtime`
  role үүнийг чөлөөтэй дуудна — параметржих боломжтой аливаа функц
  (жиш: энэ функцэд `p_branch_id` дурын утга дамжуулж болно) SQL
  injection биш ч "дурын variantId/branchId хосыг лавлах" боломж олгодог
  тул зөвхөн "нийтэд харагдах" гэдэгт тохирсон, аль хэдийн олон нийтэд
  ил (жиш: каталогийн бүтээгдэхүүн) объектод л ашиглах ёстой — хувийн
  мэдээлэл агуулсан хүснэгтэд адилхан загвар шууд хуулж болохгүй.
