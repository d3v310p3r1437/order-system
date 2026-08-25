-- ============================================================
-- Ажилтны удирдлага (§7 модуль #1-ийн үргэлжлэл, docs/adr/002-ийн
-- "Инцидент (2026-08-25)" — super.admin@order-system.mn-ийн Postgres
-- users мөр дутуу тохируулагдсанаас сэргийлэх зорилготой атомик
-- staff-provisioning урсгал). ADR 005 WRITE ангилал: `users_insert`
-- (`app_has_global_scope() OR id = app_current_user_id()`) БОЛОН
-- `ubr_insert`/`ubr_update` (`app_has_global_scope() OR
-- app_can_manage_branch(branchId)`, ЭНД BRANCH_MANAGER-ыг Ч зөвшөөрдөг)
-- аль аль нь энэ endpoint-ийн шаардлагад ТААРАХГҮЙ:
--   - users_insert: branch-scoped дүр (BRANCH_ADMIN) ӨӨР хэрэглэгчийн
--     мөр огт insert хийж чадахгүй (зөвхөн "id = өөрийн id" зөвшөөрдөг).
--   - ubr_insert/update: BRANCH_MANAGER-ыг Ч зөвшөөрдөг, гэвч §6.1 матриц
--     БОЛОН энэ даалгаврын шууд заавар "зөвхөн SUPER_ADMIN/
--     ALL_BRANCH_MANAGER/тухайн салбарын BRANCH_ADMIN" гэж БҮР ХАТУУ
--     хязгаарласан (BRANCH_MANAGER ажилтан удирдах ЭРХГҮЙ).
-- Тиймээс ЭДГЭЭР одоо байгаа policy-г өргөтгөхийн оронд шинэ, илүү
-- хатуу шалгуурт (app_can_manage_staff — BRANCH_MANAGER-ыг ЗОРИУДАА
-- ХАСНА) тулгуурласан 2 SECURITY DEFINER функц нэмнэ.
--
-- ⚠️⚠️ ЧУХАЛ АЮУЛГҮЙ БАЙДЛЫН ХЯЗГААРЛАЛТ (энэ функц зохиох явцад олдсон,
-- шинэ escalation зам гарахаас урьдчилан хаасан): `RolesGuard`
-- (src/common/roles.guard.ts) БОЛОН `resolveUserRoleNames()`
-- (src/common/user-roles.ts) нь `user_branch_roles.role`-ийг ЗӨВХӨН
-- НЭРЭЭР нь шалгадаг, `branchId`-той ХАМТ шалгадаггүй (`app_has_global_scope()`-ийн
-- "branchId IS NULL AND role IN (...)" нөхцөлтэй ЯЛГААТАЙ!). Иймд хэрэв
-- branch-scoped (жиш: BRANCH_ADMIN) дуудагчид p_role='SUPER_ADMIN' (branchId
-- НЭГ САЛБАРТАЙ ч) оноох боломж олговол, тэр шинэ хэрэглэгч
-- `app_has_global_scope()`-ээр ХЭЗЭЭ Ч ЖИНХЭНЭ глобал эрх авахгүй ч,
-- ЗӨВХӨН @Roles('SUPER_ADMIN')-ээр хамгаалагдсан (нэмэлт RLS-гүй) ямар ч
-- endpoint-ыг дуудах боломжтой болно — энэ бол ЧИНЬ ХАТУУ хаах ёстой
-- privilege-escalation зам. Доорх app_create_staff_member()/
-- app_update_staff_member() аль аль нь "branch-scoped дуудагч зөвхөн
-- BRANCH_ADMIN/BRANCH_MANAGER/SALESPERSON role л оноож болно, ХЭЗЭЭ Ч
-- SUPER_ADMIN/OWNER/ALL_BRANCH_MANAGER биш" гэдгийг ЗААВАЛ шалгана.
-- ============================================================

-- Тухайн p_branch_id-д зориулж ажилтан (users/user_branch_roles)
-- удирдах эрхтэй эсэх: global scope, ЭСВЭЛ тухайн САЛБАРТ БОДИТООР
-- BRANCH_ADMIN (BRANCH_MANAGER БИШ — app_can_manage_branch()-ээс
-- ЗОРИУДАА ӨӨР, дээрх коммент) role-тэй.
CREATE OR REPLACE FUNCTION app_can_manage_staff(target_branch_id text) RETURNS boolean
SECURITY DEFINER SET search_path = public AS $$
  SELECT app_has_global_scope() OR (
    target_branch_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM user_branch_roles
      WHERE "userId" = app_current_user_id()
        AND "branchId" = target_branch_id
        AND role = 'BRANCH_ADMIN'
    )
  );
$$ LANGUAGE sql STABLE;

-- Шинэ ажилтныг Postgres талд НЭГ атомик алхамаар (users + user_branch_roles
-- хамт) үүсгэнэ. Дуудагч (StaffService.create()) ЭНЭ функцийг Keycloak
-- талын хэрэглэгч/attribute аль хэдийн амжилттай үүссэний ДАРАА дуудна;
-- хэрэв ЭНЭ функц RETURN 'FORBIDDEN' буцаах ЭСВЭЛ Postgres алдаа (жиш:
-- users_email_key unique violation) шидвэл, StaffService нь ӨӨРӨӨ (SQL
-- гадна, Node талд) Keycloak-ийн шинээр үүсгэсэн хэрэглэгчийг устгаж
-- (зөвхөн дахин ашигласан бол БИШ, ШИНЭЭР үүсгэсэн бол л) rollback хийнэ —
-- 3 тусдаа гар алхмыг НЭГ атомик код зам болгосны гол зорилго яг энэ.
CREATE OR REPLACE FUNCTION app_create_staff_member(
  p_new_user_id text,
  p_email text,
  p_full_name text,
  p_role text,
  p_branch_id text
) RETURNS text  -- 'CREATED' | 'FORBIDDEN'
SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_is_global boolean;
BEGIN
  v_is_global := app_has_global_scope();

  IF NOT v_is_global AND NOT app_can_manage_staff(p_branch_id) THEN
    RETURN 'FORBIDDEN';
  END IF;

  -- Дээрх "чухал аюулгүй байдлын хязгаарлалт" коммент: branch-scoped
  -- дуудагч ХЭЗЭЭ Ч глобал-эрхийн role нэр (SUPER_ADMIN/OWNER/
  -- ALL_BRANCH_MANAGER) оноож чадахгүй.
  IF NOT v_is_global AND p_role IN ('SUPER_ADMIN', 'OWNER', 'ALL_BRANCH_MANAGER') THEN
    RETURN 'FORBIDDEN';
  END IF;

  INSERT INTO users (id, email, "fullName", "authProvider", "isActive", "createdAt", "updatedAt")
  VALUES (p_new_user_id, p_email, p_full_name, 'KEYCLOAK', true, now(), now());

  INSERT INTO user_branch_roles (id, "userId", "branchId", role, "createdAt")
  VALUES (gen_random_uuid()::text, p_new_user_id, p_branch_id, p_role::"RoleName", now());

  RETURN 'CREATED';
END;
$$ LANGUAGE plpgsql;

-- Ажилтны role/branch дахин оноох (нэг branch-ий assignment-ыг НӨГӨӨ
-- (role, branchId) хосоор сольж) БОЛОН/ЭСВЭЛ isActive идэвхжүүлэх/
-- идэвхгүй болгох. p_new_role IS NULL бол role/branch-д хүрэхгүй (зөвхөн
-- isActive), p_is_active IS NULL бол isActive-д хүрэхгүй.
CREATE OR REPLACE FUNCTION app_update_staff_member(
  p_user_id text,
  p_old_branch_id text,
  p_new_role text,
  p_new_branch_id text,
  p_is_active boolean
) RETURNS text  -- 'UPDATED' | 'FORBIDDEN' | 'ASSIGNMENT_NOT_FOUND'
SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_is_global boolean;
  v_deleted_rows integer;
BEGIN
  v_is_global := app_has_global_scope();

  IF NOT v_is_global AND NOT app_can_manage_staff(p_old_branch_id) THEN
    RETURN 'FORBIDDEN';
  END IF;

  IF p_new_role IS NOT NULL THEN
    IF NOT v_is_global AND NOT app_can_manage_staff(p_new_branch_id) THEN
      RETURN 'FORBIDDEN';
    END IF;
    IF NOT v_is_global AND p_new_role IN ('SUPER_ADMIN', 'OWNER', 'ALL_BRANCH_MANAGER') THEN
      RETURN 'FORBIDDEN';
    END IF;

    DELETE FROM user_branch_roles
      WHERE "userId" = p_user_id
        AND "branchId" IS NOT DISTINCT FROM p_old_branch_id;
    GET DIAGNOSTICS v_deleted_rows = ROW_COUNT;
    IF v_deleted_rows = 0 THEN
      RETURN 'ASSIGNMENT_NOT_FOUND';
    END IF;

    INSERT INTO user_branch_roles (id, "userId", "branchId", role, "createdAt")
    VALUES (gen_random_uuid()::text, p_user_id, p_new_branch_id, p_new_role::"RoleName", now());
  END IF;

  IF p_is_active IS NOT NULL THEN
    UPDATE users SET "isActive" = p_is_active, "updatedAt" = now() WHERE id = p_user_id;
  END IF;

  RETURN 'UPDATED';
END;
$$ LANGUAGE plpgsql;
