-- ============================================================
-- RLS Helper функцууд
-- SECURITY DEFINER ашигласан шалтгаан: policy дотроос
-- user_branch_roles хүснэгтийг уншихад тухайн хүснэгтийн ӨӨРИЙНХ
-- нь RLS-тэй мөргөлдөж (recursive) алдаа өгдөг тул, эдгээр функц
-- нь RLS-ийг тойрч, зөвхөн шаардлагатай мэдээллийг буцаана.
-- ============================================================

CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS text AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '');
$$ LANGUAGE sql STABLE;

-- SUPER_ADMIN / OWNER / ALL_BRANCH_MANAGER эсэхийг шалгана (branchId IS NULL мөр)
CREATE OR REPLACE FUNCTION app_has_global_scope() RETURNS boolean
SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_branch_roles
    WHERE "userId" = app_current_user_id()
      AND "branchId" IS NULL
      AND role IN ('SUPER_ADMIN', 'OWNER', 'ALL_BRANCH_MANAGER')
  );
$$ LANGUAGE sql STABLE;

-- Одоогийн хэрэглэгчийн харах эрхтэй бүх салбарын id-г буцаана
CREATE OR REPLACE FUNCTION app_accessible_branch_ids() RETURNS SETOF text
SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM branches WHERE app_has_global_scope()
  UNION
  SELECT "branchId" FROM user_branch_roles
  WHERE "userId" = app_current_user_id() AND "branchId" IS NOT NULL;
$$ LANGUAGE sql STABLE;

-- Тухайн салбарыг удирдах эрхтэй эсэх (BRANCH_ADMIN/BRANCH_MANAGER эсвэл global)
CREATE OR REPLACE FUNCTION app_can_manage_branch(target_branch_id text) RETURNS boolean
SECURITY DEFINER SET search_path = public AS $$
  SELECT app_has_global_scope() OR EXISTS (
    SELECT 1 FROM user_branch_roles
    WHERE "userId" = app_current_user_id()
      AND "branchId" = target_branch_id
      AND role IN ('BRANCH_ADMIN', 'BRANCH_MANAGER')
  );
$$ LANGUAGE sql STABLE;

-- ============================================================
-- RLS идэвхжүүлэх
-- ЧУХАЛ: FORCE ROW LEVEL SECURITY заавал хэрэгтэй, эс бөгөөс
-- хүснэгтийн эзэмшигч (ихэвчлэн миграци хийсэн connection user,
-- жиш "app") RLS-ийг АВТОМАТААР тойрдог болохыг Postgres баримт
-- бичигт онцолсон байдаг.
-- ============================================================

ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches FORCE ROW LEVEL SECURITY;

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;

ALTER TABLE user_branch_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_branch_roles FORCE ROW LEVEL SECURITY;

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;

-- ============================================================
-- branches
-- ============================================================
CREATE POLICY branches_select ON branches FOR SELECT
  USING (app_has_global_scope() OR id IN (SELECT app_accessible_branch_ids()));

CREATE POLICY branches_insert ON branches FOR INSERT
  WITH CHECK (app_has_global_scope());

CREATE POLICY branches_update ON branches FOR UPDATE
  USING (app_has_global_scope() OR app_can_manage_branch(id))
  WITH CHECK (app_has_global_scope() OR app_can_manage_branch(id));

CREATE POLICY branches_delete ON branches FOR DELETE
  USING (app_has_global_scope());

-- ============================================================
-- users
-- ============================================================
CREATE POLICY users_select ON users FOR SELECT
  USING (
    app_has_global_scope()
    OR id = app_current_user_id()
    OR EXISTS (
      SELECT 1 FROM user_branch_roles ubr
      WHERE ubr."userId" = users.id
        AND ubr."branchId" IN (SELECT app_accessible_branch_ids())
    )
  );

-- Шинэ ажилтан/харилцагч бүртгэх нь app-ийн өөрийн auth service-ээр
-- (trusted context) дамжина тул global scope эсвэл өөрийгөө бүртгэх
-- (харилцагчийн self-signup)-г зөвшөөрнө.
CREATE POLICY users_insert ON users FOR INSERT
  WITH CHECK (app_has_global_scope() OR id = app_current_user_id());

CREATE POLICY users_update ON users FOR UPDATE
  USING (app_has_global_scope() OR id = app_current_user_id())
  WITH CHECK (app_has_global_scope() OR id = app_current_user_id());

CREATE POLICY users_delete ON users FOR DELETE
  USING (app_has_global_scope());

-- ============================================================
-- user_branch_roles
-- ============================================================
CREATE POLICY ubr_select ON user_branch_roles FOR SELECT
  USING (
    app_has_global_scope()
    OR "userId" = app_current_user_id()
    OR ("branchId" IS NOT NULL AND "branchId" IN (SELECT app_accessible_branch_ids()))
  );

CREATE POLICY ubr_insert ON user_branch_roles FOR INSERT
  WITH CHECK (app_has_global_scope() OR app_can_manage_branch("branchId"));

CREATE POLICY ubr_update ON user_branch_roles FOR UPDATE
  USING (app_has_global_scope() OR app_can_manage_branch("branchId"))
  WITH CHECK (app_has_global_scope() OR app_can_manage_branch("branchId"));

CREATE POLICY ubr_delete ON user_branch_roles FOR DELETE
  USING (app_has_global_scope() OR app_can_manage_branch("branchId"));

-- ============================================================
-- audit_logs (өөрчлөгдөшгүй лог: UPDATE/DELETE policy огт үгүй
-- тул Postgres анхдагчаар аль алиныг нь бүрэн хориглоно)
-- ============================================================
CREATE POLICY audit_select ON audit_logs FOR SELECT
  USING (
    app_has_global_scope()
    OR ("branchId" IS NOT NULL AND app_can_manage_branch("branchId"))
  );

CREATE POLICY audit_insert ON audit_logs FOR INSERT
  WITH CHECK (true); -- бичлэгийг зөвхөн AuditInterceptor (§4.4) үүсгэнэ, chat/end-user шууд бичихгүй