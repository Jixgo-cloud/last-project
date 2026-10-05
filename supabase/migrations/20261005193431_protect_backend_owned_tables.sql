-- SmartCareer uses NestJS + Prisma, not Supabase client-side table access.
-- Application JWT identities must never be treated as Supabase Auth identities.
-- This atomic migration keeps owner/server access and denies client-role access.
DO $hardening$
DECLARE
  target record;
BEGIN
  IF to_regclass('public.users') IS NULL OR to_regclass('public.job_applications') IS NULL THEN
    RAISE EXCEPTION 'SmartCareer application schema is missing; refusing to change access';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon')
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
    RAISE EXCEPTION 'Supabase client roles are missing';
  END IF;
  FOR target IN
    SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p')
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target.relname);
  END LOOP;
  REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon, authenticated, PUBLIC;
  REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated, PUBLIC;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated, PUBLIC;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated, PUBLIC;
END
$hardening$;
