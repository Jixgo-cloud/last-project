-- Additive AZ-204 assessment reference fields. Existing assessments remain unreferenced.
-- The application also supports its existing prisma db push deployment workflow.
-- Apply before starting the new API; no data backfill or score changes are performed.
BEGIN;
ALTER TABLE "assessments" ADD COLUMN IF NOT EXISTS "frameworkCode" TEXT;
ALTER TABLE "assessments" ADD COLUMN IF NOT EXISTS "frameworkVersion" TEXT;
ALTER TABLE "assessments" ADD COLUMN IF NOT EXISTS "frameworkScope" TEXT;
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "frameworkTopicId" TEXT;
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "frameworkMappingNote" TEXT;
COMMIT;
