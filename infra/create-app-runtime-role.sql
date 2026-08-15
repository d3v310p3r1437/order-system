-- ============================================================
-- Апп runtime-д зориулсан хязгаарлагдмал role
-- ЭНЭ НЬ Prisma migration ЕМАП (schema.prisma-той холбоогүй,
-- cluster-level role тул tal migration-аас тусад нь, орчин
-- (dev/staging/prod) бүрт нэг удаа гараар/скриптээр ажиллуулна).
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_runtime') THEN
    CREATE ROLE app_runtime WITH LOGIN PASSWORD 'changeme_runtime_dev_only';
  END IF;
END
$$;

-- superuser БИШ, RLS-ийг тойрох аль ч эрхгүй эсэхийг баталгаажуулах
ALTER ROLE app_runtime NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;

GRANT CONNECT ON DATABASE order_system TO app_runtime;
GRANT USAGE ON SCHEMA public TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_runtime;

-- Ирээдүйд шинэ хүснэгт нэмэгдэх бүрт автоматаар мөн адил эрх өгнө
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime;

-- Баталгаажуулах query (ажиллуулаад хоёулаа "f" (false) гарах ёстой):
-- SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = 'app_runtime';
