-- ============================================================
-- Дэлгүүрийн нэр/лого (branding) — Login дэлгэц дээр ч (нэвтрэлтгүй)
-- харагдах ёстой тул `system_settings_select` RLS (app_current_user_id()
-- IS NOT NULL шаарддаг)-ийг тойрох ADR 005-ийн "READ-redact" зарчимтай
-- SECURITY DEFINER функц: app_public_branches()-тэй ЯГ ижил загвар
-- (зөвхөн 2 whitelist-сэн key-г л буцаана, бусад SystemSetting мөр
-- (жиш: RETURN_FEE_PERCENT) ил гарахгүй).
-- ============================================================

CREATE FUNCTION app_public_branding() RETURNS TABLE(
  "key" text,
  "value" text
)
SECURITY DEFINER SET search_path = public AS $$
  SELECT "key", "value"
  FROM system_settings
  WHERE "key" IN ('STORE_NAME', 'STORE_LOGO_URL');
$$ LANGUAGE sql STABLE;
