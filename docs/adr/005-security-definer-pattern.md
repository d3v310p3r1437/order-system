# ADR 005: Шинэ SECURITY DEFINER SQL функц хэзээ зөвтгөгддөг вэ

- Статус: Хүлээн зөвшөөрсөн (Phase 3a-д WRITE тохиолдлыг нэмж шинэчилсэн)
- Огноо: 2026-08-16 (анхны), шинэчилсэн 2026-08-16 (Phase 3a)
- Холбоотой: `docs/adr/001-rls-transaction-pattern.md`,
  `docs/plan.md` §6.1, §8 Phase 2 (2-р хэсэг), §8 Phase 3a,
  `apps/api/prisma/migrations/20260816031625_add_public_availability_lookup_function`,
  `apps/api/prisma/migrations/20260816095000_add_order_inventory_adjustment_function`,
  `apps/api/src/catalog/inventory-effective.util.ts`,
  `apps/api/src/catalog/product/product.service.ts`,
  `apps/api/src/orders/order.service.ts`

> ⚠️ **Энэ ADR одоо ХОЁР тусдаа ангиллыг хамарна: READ (анхны, доор
> тодорхой) БОЛОН WRITE (Phase 3a-д нэмэгдсэн, доор "WRITE тохиолдол"
> хэсгийг үз). Шинэ SECURITY DEFINER функц зохиохоос ӨМНӨ энэ ADR-ыг
> БҮХЭЛД нь уншиж, өөрийн хэрэгцээ аль ангилалд (READ эсвэл WRITE)
> багтахыг эхлээд тодорхойлно.**

## READ тохиолдол (анхны — Phase 2, `GET /products/:id`)

### Асуудал

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

### Шийдвэр

**Зөвхөн quantity/override зэрэг түүхий (raw) баганыг серверийн санах
ойд буцаадаг, БИЗНЕС ЛОГИК ОГТ АГУУЛААГҮЙ, нарийн хязгаарлагдмал
SECURITY DEFINER SQL функц** нэмнэ (`app_inventory_snapshot_for_variant`,
`20260816031625_add_public_availability_lookup_function` migration) —
`docs/adr/001`-д аль хэдийн тогтоосон `app_can_manage_branch()`,
`app_accessible_branch_ids()` гэх мэт функцүүдтэй **яг ижил зарчмаар**
(migration/DDL-ийг зөвхөн superuser `app` холболтоор хийдэг тул функцийн
эзэмшигч RLS-ийг бүрэн тойрдог — ADR 001-ийн §"Файлууд" хэсгийг үз).

#### Яагаад raw quantity-г SQL түвшинд биш, TS түвшинд redact хийдэг

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

#### "Мөр байхгүй" (no InventoryItem row) тохиолдол

Тухайн branchId-д энэ variant-ийн InventoryItem мөр огт үүсээгүй байж
болно (жиш: тухайн салбар энэ барааг огт захиалж байгаагүй). Энэ
тохиолдлыг **алдаа шидэлгүй** OUT_OF_STOCK гэж эелдэгээр тооцоолохоор
`computeAvailabilityStatus()` өөрөө `item: ... | null | undefined`
параметр авдаг болгосон (`item` falsy бол шууд OUT_OF_STOCK) — SQL
функцийн 0-мөр хариуг дуудагч тал (`ProductService`) тусад нь шалгаж
OUT_OF_STOCK буцаах логик БИЧИХГҮЙ, ганц газар (util) л шийднэ. Нэгж
тест: `src/catalog/inventory-effective.util.spec.ts` ("item null...",
"item undefined ч мөн адил...").

## WRITE тохиолдол (Phase 3a-д нэмэгдсэн — checkout/cancel-ийн inventory decrement/increment)

### Асуудал

Захиалгын checkout (`POST /orders`) болон cancel (`PATCH /orders/:id/status`,
`CANCELLED`) хийхэд `InventoryItem.quantity`-г CUSTOMER (өөрийн захиалга)
болон SALESPERSON (өөрийн салбарын захиалга) session-ээр atomic
decrement/increment хийх шаардлагатай (docs/plan.md §7 модуль #5, #6).
Гэвч §6.1 матриц ("нөөцийн тоо нууц") тул `inventory_items_select` RLS
policy CUSTOMER/SALESPERSON-д ХЭЗЭЭ Ч SELECT зөвшөөрдөггүй — яг READ
тохиолдолтой (дээрх) адилхан хязгаарлалт.

**Эхний оролдлого (ажиллаагүй):** READ тохиолдолд ашигласантай төстэй
inline-EXISTS join загвараар (жиш: `products_update` policy) зөвхөн
`inventory_items_update` policy-г (`USING`/`WITH CHECK`) өргөтгөж, тухайн
inventory мөр идэвхтэй захиалгын `order_items`-ээр join хийж холбогдсон
эсэхийг шалгах гэж үзсэн — шинэ SECURITY DEFINER функц шаардлагагүй гэж
таамагласан.

⚠️ **Энэ ажиллаагүй, `EXPLAIN (ANALYZE)`-аар нотлогдсон:** PostgreSQL-ийн
албан ёсны баримт бичигт "UPDATE/DELETE командууд одоо байгаа мөрийг
тодорхойлохын тулд тухайн хүснэгтийн SELECT policy-г МӨН шаарддаг" гэж
тодорхой заасан байдаг — энэ нь **RETURNING байх эсэхээс ҮЛ ХАМААРНА**
(зөвхөн **INSERT** RETURNING-гүй үед л SELECT policy-г бүрэн алгасдаг,
`audit.interceptor.ts`-ийн raw INSERT яг энэ ялгаанд тулгуурладаг).
`EXPLAIN ANALYZE`-ийн гаралтад Postgres нь UPDATE policy-ийн `USING`
нөхцөл БОЛОН SELECT policy-ийн `USING` нөхцлийг **AND**-аар нэгтгэсэн
байгааг шууд харсан: `Filter: ((update_using) AND (select_using))`.
`inventory_items_select` нь CUSTOMER/SALESPERSON-г огт оруулаагүй
(`app_can_manage_branch` л) тул update-ийн өргөтгөсөн нөхцөл ХЭДИЙ ҮНЭН
байсан ч AND-ийн нөгөө тал (select_using) худал байснаас бодит UPDATE 0
мөр олсон.

SELECT policy-г мөн адил өргөтгөх нь боломжгүй — тэгвэл CUSTOMER
`GET /inventory-items`-ээр quantity-г шууд харах болно, яг READ
тохиолдлын "нөөцийн тоо нууц" зөрчлийг дахин үүсгэнэ.

### Шийдвэр

READ тохиолдлын зарчмаас (зөвхөн "тооцоолсон утга буцаах") ухамсартайгаар
ГАДУУР, гэхдээ **ижил суурь механизмаар** (superuser `app` эзэмшигчтэй
SECURITY DEFINER, RLS-ийг бүрэн тойрдог) `app_adjust_inventory_for_order()`
функц нэмэв (`20260816095000_add_order_inventory_adjustment_function`).

**Гол ялгаа READ функцтэй харьцуулахад:** READ функц
(`app_inventory_snapshot_for_variant`) ямар ч зөвшөөрлийн шалгалт хийдэггүй (учир нь
"нийтэд харагдах" каталогийн мэдээлэл, зөвхөн redact хийдэг) — харин
WRITE функц ЗӨВШӨӨРЛИЙГ ӨӨРӨӨ ДОТРОО шалгах ёстой, учир нь энд UPDATE
нь RLS-ээр огт хамгаалагдахгүй болж байгаа тул зөвшөөрлийн цорын ганц
хамгаалалт функц дотор байрлана.

**`app_adjust_inventory_for_order(p_order_id, p_variant_id, p_branch_id,
p_delta) RETURNS integer` дотоод логик** (`src/orders/order.service.ts`-ийн
`adjustInventory()`-оос `SELECT app_adjust_inventory_for_order(...)`
байдлаар дуудагдана, checkout-д delta<0, cancel restock-д delta>0):

1. **Зөвшөөрлийн шалгалт (эхлээд):** `orders` хүснэгтийг `order_items`-тэй
   join хийж, дараах БҮГДИЙГ шалгана — (a) `p_order_id`-тай Order
   бодитоор оршин байна, (b) энэ Order-д `p_variant_id`-тай OrderItem
   ЖИНХЭНЭ захиалагдсан байна (санамсаргүй variantId/branchId хос
   дамжуулж дурын мөр өөрчлөхөөс сэргийлнэ), (c) `p_branch_id` нь тэр
   Order-ийн `branchId`-тай таарна, БОЛОН (d) дуудагч нь тухайн Order-ыг
   удирдах эрхтэй: `app_has_global_scope()` ЭСВЭЛ
   `app_can_manage_branch(o."branchId")` (staff) ЭСВЭЛ
   `o."customerId" = app_current_user_id()` (CUSTOMER, өөрийн захиалга)
   ЭСВЭЛ `user_branch_roles`-д тухайн салбарт SALESPERSON эсэх. Эдгээрийн
   аль нэг нь ч биш бол `RAISE EXCEPTION` (ERRCODE 42501, зөвшөөрөлгүй)
   шидэж, УДААГААС гарна — `UPDATE`-д огт хүрэхгүй.
2. **Бичилт (зөвхөн зөвшөөрөл баталгаажсаны дараа):**
   `UPDATE inventory_items SET quantity = quantity + p_delta WHERE
   "variantId" = p_variant_id AND "branchId" = p_branch_id` — RLS-ийг
   бүрэн тойрдог тул SELECT policy шаардахгүй.
   `inventory_items_quantity_nonneg` CHECK constraint (сөрөг тоо руу
   орвол) энд ЭНГИЙН Postgres алдаа хэвээр шидэгдэнэ (23514) —
   `OrderService`-ийн `isCheckConstraintViolation()` үүнийг барьж 409
   `OUT_OF_STOCK` болгоно.
3. **Буцаах утга:** `GET DIAGNOSTICS`-аар авсан бодит өөрчлөгдсөн мөрийн
   тоо (0 эсвэл 1) — 0 бол (жиш: тухайн branch/variant хослолд
   InventoryItem мөр огт үүсээгүй) дуудагч тал (`OrderService`) checkout
   үед 409 `OUT_OF_STOCK`, cancel restock үед зөвхөн warn лог бичээд
   үргэлжлүүлнэ (READ тохиолдлын "мөр байхгүй → OUT_OF_STOCK, алдаа
   шидэхгүй" зарчимтай ижил санаа: 0-мөр хариуг ганц газар шийднэ).

**⚠️ Хэн ч дурын `p_order_id`/`p_variant_id`/`p_branch_id`/`p_delta`
дамжуулж функцийг шууд дуудаж болзошгүй эсэхийг анхаар:** Функц PUBLIC-д
EXECUTE эрхтэй (Postgres анхдагч), SECURITY DEFINER тул RLS-ийг бүрэн
тойрдог — иймд **алхам 1 (зөвшөөрлийн шалгалт) функц дотор байхгүй бол**
энэ нь ЯМАР Ч хэрэглэгчид дурын inventory мөрийг чөлөөтэй өөрчлөх
боломж олгох маш ноцтой цоорхой болно. Функцийн аюулгүй байдал бүхэлдээ
алхам 1-ийн зөв бичигдсэн байхаас хамаарна — энэ бол READ функцээс
(зөвшөөрлийн шалгалтгүй, зөвхөн redact) чухал ялгаа.

## Ирээдүйд ижил хэрэгцээ гарвал — ЗАРЧИМ

Эхлээд өөрийн хэрэгцээ **READ** (тооцоолсон/redact утга буцаах) уу,
эсвэл **WRITE** (RLS-ээр SELECT хориглогдсон хүснэгтэд бичих шаардлагатай)
уу гэдгийг тодорхойл — доорх хоёр жагсаалтын зохих нэгийг баримтал.

### READ — тооцоолсон/redact утга буцаах (жиш: `app_inventory_snapshot_for_variant`)

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

### WRITE — RLS-ээр SELECT хориглогдсон хүснэгтэд бичих (жиш: `app_adjust_inventory_for_order`)

**Шинэ WRITE зориулалттай SECURITY DEFINER функц ЗӨВХӨН дараах БҮХ
нөхцөл хангагдсан үед л зөвтгөгдөнө — READ-ийн нөхцлүүдээс илүү хатуу,
учир нь энд RLS бүхэлдээ тойрогддог:**

1. **Зөвхөн итгэмжлэгдсэн backend code path-аас дуудагдана** (жиш:
   `OrderService`), НЭГ ч endpoint параметрийг ШУУД (validate/join
   хийлгүй) функцэд дамжуулдаггүй — checkout/cancel аль хэдийн
   баталгаажуулсан (variant захиалагдсан, order олдсон) утгаас гарна.
2. **Функц ӨӨРӨӨ (дотроо, эхний алхамд) зөвшөөрлийг шалгана** — дуудагч
   session (`app_current_user_id()`) тухайн бичих гэж буй мөртэй ямар
   домэйн харилцаатай (жиш: "энэ Order-ын ЭЗЭН" эсвэл "энэ салбарыг
   удирдах эрхтэй") болохыг тодорхой SQL нөхцлөөр баталгаажуулна.
   Баталгаажаагүй бол `RAISE EXCEPTION`-ээр ЯАГААД ч UPDATE хүрэхгүй.
3. **Scope нарийн:** зөвхөн НЭГ багана (жиш: `quantity`)-ийг, зөвхөн
   параметрээр өгсөн НЭГ (эсвэл join-оор тодорхой хязгаарлагдсан) мөрийг
   өөрчилдөг — өргөн хүрээний/нөхцөлгүй UPDATE, өөр багана/хүснэгт
   хөндөх ЗОРИЛГОГҮЙ.
4. **Бизнес логик функц дотор байхгүй** (READ-ийн 2-той адил) — зөвхөн
   "authorize + write", шийдвэр гаргалт (жиш: ямар delta байх ёстойг
   тооцоолох) TS талд байна.
5. **Өмнө нь бичигдсэн ижил зорилготой функц байхгүй эсэхийг шалгасан**
   (READ-ийн 3-тай адил) — READ функцүүдийг ч WRITE-д ашиглах боломжгүй
   (эсрэгээрээ ч) тул хайлт хийхдээ WRITE ангиллын функцүүд дунд шал.
6. Migration comment-д (a) яагаад RLS policy-г шууд өргөтгөх боломжгүй
   байсныг (READ-ийн адил "давхар SELECT policy шаардлагатай" зэрэг
   тодорхой техникийн шалтгаан), (b) функц дотроо БҮРЭН ямар
   зөвшөөрлийн нөхцөл шалгадгийг тодорхой бичнэ — ADR 001, ADR 005-ийг
   заавал ишлэнэ.

Хэрэв (1) эсвэл (2)-ыг хангахгүй бол (жиш: параметрийг клиентээс шууд,
validate хийлгүй авах, эсвэл зөвшөөрлийн шалгалтыг функцийн ГАДНА
"боловч найдвартай гэж таамаглах") — WRITE SECURITY DEFINER функц огт
хэрэглэхгүй, оронд нь RLS policy-г (боломжтой бол) сайжруулах эсвэл
архитектурыг дахин бод.

## Мэдэгдэж буй trade-off

- SECURITY DEFINER функц (READ ба WRITE аль аль нь) RLS-ийн "сүүлчийн
  хамгаалалт" зарчмын ухамсартай ялгаа (цоорхой) тул шинэ ийм функц
  нэмэх бүрт код review-д онцгой анхаарал шаардана (checklist: §4.4
  аюулгүй байдлын checklist-д нэмж болох зүйл). **WRITE функцийн хувьд
  энэ эрсдэл ИЛҮҮ өндөр** — READ функц буруу бичигдвэл мэдээлэл алдагдах
  (confidentiality) эрсдэлтэй, WRITE функц буруу бичигдвэл (алхам 1
  дутуу/буруу) ДУРЫН хэрэглэгч ДУРЫН мөрийг өөрчлөх (integrity) эрсдэлтэй
  — илүү ноцтой.
- Функц PUBLIC-д EXECUTE эрхтэй (Postgres анхдагч) тул `app_runtime`
  role үүнийг чөлөөтэй дуудна — параметржих боломжтой аливаа функц
  (жиш: энэ функцэд `p_branch_id` дурын утга дамжуулж болно) SQL
  injection биш ч "дурын variantId/branchId хосыг лавлах" боломж олгодог
  тул READ функцийг зөвхөн "нийтэд харагдах" гэдэгт тохирсон, аль хэдийн
  олон нийтэд ил (жиш: каталогийн бүтээгдэхүүн) объектод л ашиглах
  ёстой — хувийн мэдээлэл агуулсан хүснэгтэд адилхан загвар шууд хуулж
  болохгүй. WRITE функцийн хувьд энэ эрсдэл функцийн ДОТООД зөвшөөрлийн
  шалгалтаар (дээрх "WRITE" 2-р нөхцөл) л зөөлрүүлэгддэг — тиймээс тэр
  шалгалт дутуу/сул байх нь функцийг бүхэлд нь эмзэг болгоно.
