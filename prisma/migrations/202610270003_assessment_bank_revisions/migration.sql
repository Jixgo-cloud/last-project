BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';
CREATE TABLE IF NOT EXISTS "assessment_bank_revisions" (
  "assessmentId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "snapshot" JSONB NOT NULL,
  "contentHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "assessment_bank_revisions_pkey" PRIMARY KEY ("assessmentId", "version"),
  CONSTRAINT "assessment_bank_revisions_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
-- Contains authored answer keys. Preserve backend-only access on Supabase.
ALTER TABLE "assessment_bank_revisions" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "assessment_bank_revisions" FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON "assessment_bank_revisions" FROM anon;
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON "assessment_bank_revisions" FROM authenticated;
  END IF;
END $$;
COMMIT;
