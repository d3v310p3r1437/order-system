-- ============================================================
-- Инцидентийн эцсийн, БҮТЦИЙН (structural) хамгаалалт (docs/adr/002-ийн
-- "Инцидент (2026-08-25)" + 20260825090000_add_staff_management_functions-ийн
-- "⚠️⚠️ ЧУХАЛ АЮУЛГҮЙ БАЙДЛЫН ХЯЗГААРЛАЛТ" коммент дэх escalation зам).
--
-- `app_create_staff_member()`/`app_update_staff_member()` SQL функц
-- өөрсдийн дотор "branch-scoped дуудагч глобал нэртэй role оноож
-- чадахгүй" гэдгийг ШАЛГАДАГ ч, энэ бол зөвхөн ТҮҮНИЙ л дуудлагын
-- зам дээрх хамгаалалт. `user_branch_roles` мөрийг өөр ЯМАР Ч замаар
-- (одоо байгаа/ирээдүйн өөр endpoint, гар SQL, debug script) бичих
-- боломжтой хэвээр байгаа цагт, "role=SUPER_ADMIN/OWNER/ALL_BRANCH_MANAGER
-- бол branchId ЗААВАЛ NULL, эс бөгөөс branchId ЗААВАЛ NOT NULL" гэсэн
-- логикийн зөрчилтэй мөр (яг `app_has_global_scope()`-ийн "branchId IS
-- NULL AND role IN (...)" нөхцлийг Half-way хангадаг, харин
-- `RolesGuard`/`resolveUserRoleNames()`-ийн НЭРЭЭР ГАНЦААР шалгадаг
-- сул талыг ашиглаж болзошгүй мөр) үүсэх боломж онолын хувьд нээлттэй
-- хэвээр байна.
--
-- Тиймээс код замаас (application, SECURITY DEFINER функц, RolesGuard)
-- ҮЛ ХАМААРАН, ЯМАР Ч INSERT/UPDATE-г (гар SQL-ээр ч) DB түвшинд
-- бүрмөсөн хориглох CHECK constraint нэмнэ — энэ бол ADR 002-ийн
-- инцидентийн язгуур сургамжийг ("гар/дутуу код зам логикийн алдаа
-- гаргаж болно, харин DB constraint үүнийг физикээр боломжгүй болгодог")
-- шууд хэрэгжүүлсэн эцсийн давхарга.
--
-- Migration-оос ӨМНӨ баталгаажуулсан: dev DB-ийн БҮХ 1078 мөр (359
-- SUPER_ADMIN + 7 OWNER + 7 ALL_BRANCH_MANAGER, бүгд branchId NULL;
-- 44 BRANCH_ADMIN + 474 BRANCH_MANAGER + 187 SALESPERSON, бүгд branchId
-- NOT NULL) энэ дүрмийг АЛЬ ХЭДИЙН зөрчихгүй байгааг шууд SQL query-гээр
-- шалгасан тул ADD CONSTRAINT ямар ч одоо байгаа мөрөнд саад болохгүй.
-- ============================================================

ALTER TABLE user_branch_roles
  ADD CONSTRAINT chk_global_role_no_branch CHECK (
    (role IN ('SUPER_ADMIN', 'OWNER', 'ALL_BRANCH_MANAGER') AND "branchId" IS NULL)
    OR
    (role NOT IN ('SUPER_ADMIN', 'OWNER', 'ALL_BRANCH_MANAGER') AND "branchId" IS NOT NULL)
  );
