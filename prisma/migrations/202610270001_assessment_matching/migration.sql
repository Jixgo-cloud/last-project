-- Preserve legacy scores for audit; missing snapshot means they are not assessment scores.
BEGIN;
ALTER TABLE "job_applications" ALTER COLUMN "matchScoreAtApplication" DROP NOT NULL;
ALTER TABLE "job_applications" ALTER COLUMN "matchScoreAtApplication" DROP DEFAULT;
ALTER TABLE "job_applications" ADD COLUMN IF NOT EXISTS "matchAssessmentSnapshot" JSONB;
COMMIT;
