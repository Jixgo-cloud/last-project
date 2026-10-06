-- Additive, idempotent provisioning; existing application data is untouched.
BEGIN;
CREATE TABLE IF NOT EXISTS public.ingestion_runs (
  "id" TEXT NOT NULL PRIMARY KEY,
  "requestKey" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "quota" INTEGER NOT NULL,
  "activeKey" TEXT,
  "state" TEXT NOT NULL DEFAULT 'RUNNING',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "heartbeatAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "result" JSONB
);
CREATE UNIQUE INDEX IF NOT EXISTS "ingestion_runs_requestKey_key" ON public.ingestion_runs("requestKey");
CREATE UNIQUE INDEX IF NOT EXISTS "ingestion_runs_activeKey_key" ON public.ingestion_runs("activeKey");
CREATE INDEX IF NOT EXISTS "ingestion_runs_state_heartbeatAt_idx" ON public.ingestion_runs("state", "heartbeatAt");
ALTER TABLE public.ingestion_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ingestion_runs FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON public.ingestion_runs FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON public.ingestion_runs FROM authenticated;
  END IF;
END $$;
COMMIT;
