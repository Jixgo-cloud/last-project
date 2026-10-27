# Production release: assessment-based matching

This is a release procedure, not evidence of a production deployment. The completed live Judge0 verification used a local PostgreSQL clone; see [the evidence report](LIVE_JUDGE0_VERIFICATION.md). Run commands from the repository root using the locked dependencies (Prisma 5.22). API/container startup now starts Node only: it does not run `prisma db push`.

**Owner authorization update, 27 October 2026:** all production records are test data. The owner explicitly approved migration preserving existing data, a production deployment and full Judge0/API/UI verification, **without a new backup and without merging PR #2**. This supersedes the earlier HOLD and fresh-backup gate for this rollout only. Record before/after fingerprints as verification evidence; they are not a restorable backup. The private database bank revision remains required to interpret historical results. The optional release flag `--skip-backup` skips only the external bank backup file, keeps hash/active-attempt/transaction guards, and cannot be combined with `--backup-dir`:

```text
node scripts/release-javascript-assessment.cjs --expand-single-question
node scripts/release-javascript-assessment.cjs --expand-single-question --apply --expected-hash <reviewed-hash> --skip-backup
node scripts/release-javascript-assessment.cjs --expand-single-question
```

The general backup-based procedure below remains the default for future releases. No fresh recovery point is created for this exception; do not claim otherwise.

**27 October readiness check: HOLD production execution/merge.** The owner selected preparation of the two-question expansion. The explicit `--expand-single-question` path now archives version 1 and preserves old results; see [the isolated staging report](ASSESSMENT_EXPANSION_STAGING.md). Production still needs both the application-score and private bank-revision migrations, a fresh verified backup, and coordinated provider rollout. Read [the inspected targets and release gates](PRODUCTION_ROLLOUT_READINESS_20261027.md) before executing this procedure. Staging success is not authorization to change production.

## 1. Prepare and rehearse

- Pin the reviewed release commit and build API/web artifacts before the maintenance window. Run `npm ci`, `npm run build`, `npm test`, and `npm run lint` in CI. Supply build/runtime settings through the deployment secret store.
- Identify the production database and inspect its schema and migration history. This repository contains incremental SQL, **not an initial schema baseline**. Do not run these migrations against an empty database or assume `migrate deploy` can reconstruct the whole schema.
- Use a direct database connection with migration privileges, supplied as `DATABASE_URL` in the release environment. Do not paste credentials into commands, logs, or Git. Use the provider's required SSL settings.
- Verify which provider snapshot/PITR recovery features are actually available and record their recovery window. Production currently reports the Free plan, so do not assume managed backups exist. Obtain a fresh PostgreSQL custom-format backup and document its schema, permissions, and Storage coverage; a public-schema dump does not cover Supabase-managed schemas or Storage object files. Verify restoration to an isolated database. Record table row counts and fingerprints, especially assessments, questions, assessment attempts/answers, and job applications. Rehearse the SQL and the separately approved production bank path on that restored clone first.
- Record the old image versions, migration history, and release evidence in private storage. Restrict access to bank backups because they contain answer keys. Stop new exam starts/submissions, job applications, ingestion workers, and other writes for the final backup and release window. Drain existing requests and coordinate unfinished exam attempts: changed criteria invalidate their later submission, so offer a restart without interpreting it as a failed skill assessment.

## 2. Apply the schema changes explicitly

For an existing database historically managed by `db push`, run the following **separately** and stop on any nonzero exit status. Set finite PostgreSQL lock/statement timeouts for the release session so a busy database cannot leave deployment waiting indefinitely.

```text
npx prisma db execute --schema prisma/schema.prisma --file scripts/sql/assessment-framework.sql
npx prisma db execute --schema prisma/schema.prisma --file prisma/migrations/202610270001_assessment_matching/migration.sql
npx prisma db execute --schema prisma/schema.prisma --file prisma/migrations/202610270002_skill_categories/migration.sql
npx prisma db execute --schema prisma/schema.prisma --file prisma/migrations/202610270003_assessment_bank_revisions/migration.sql
npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --exit-code
```

The first SQL adds missing framework metadata fields. The second allows null application match scores, removes their default 0, and adds `matchAssessmentSnapshot`. The third adds missing skill enum values. The fourth creates the private `assessment_bank_revisions` table with RLS and no public/anon/authenticated grants: its snapshot contains original answer keys. They preserve existing rows and scores, and are repeatable. The enum statements run outside a multi-statement transaction. Verify backend access to the new archive without granting browser roles access.

The final diff must exit **0** (no schema differences); **2** means drift remains and **1** means a command error. Review any other drift before proceeding; do not repair it with `db push --accept-data-loss`, `migrate reset`, or a broad seed. A Prisma diff does not verify RLS policies, grants, or data: compare those separately with the pre-release state.

If the environment already has Prisma Migrate history, reconcile that history with its authoritative release repository first. `db execute` does not update `_prisma_migrations`. Only mark these three incremental migrations as applied after verifying their exact SQL effects, and only when the owner has confirmed the existing baseline/history; the framework SQL remains a separately recorded prerequisite. Do not fabricate an initial baseline or blindly run `migrate deploy` with this incomplete history. See Prisma's [patch/hotfix procedure](https://www.prisma.io/docs/orm/v6/prisma-migrate/workflows/patching-and-hotfixing) and [baselining guide](https://www.prisma.io/docs/orm/prisma-migrate/workflows/baselining).

## 3. Review and update the existing JavaScript bank

Do not run `prisma:seed`, `prisma:seed:prod`, or the local QA scripts on production. The separate release script reads only the supplied `DATABASE_URL` and defaults to a read-only plan:

```text
node scripts/release-javascript-assessment.cjs --expand-single-question
```

It targets only the existing platform `coding-algorithm-sandbox` version 1, bound to the `javascript` skill. The expansion requires exactly one version-1, 50-point automated Two Sum question; it adds the canonical Palindrome question and changes the new-round denominator from 50 to 100. Without the explicit flag a one-question bank is rejected. Existing two-question environments may omit the flag. Review the current bank and the canonical `prisma/assessment-bank/javascript-sandbox.json` diff, including prompt, starter code, private solution, rubric, and test cases. The printed hash identifies the exact current bank; it is not expert approval. If the bank is missing, customized, or has another version, stop and review that environment.

After review, create an access-restricted backup directory outside the repository. Replace both placeholders below with the plan's hash and that directory's absolute path:

```text
node scripts/release-javascript-assessment.cjs --expand-single-question --apply --expected-hash <reviewed-hash> --backup-dir <absolute-private-backup-directory>
node scripts/release-javascript-assessment.cjs --expand-single-question
```

The script saves a private file backup, then locks bank/attempt/answer/archive tables within a serializable transaction. It checks the fresh plan hash and refuses active timed attempts, submitting attempts or pending evaluations/reviews. It inserts the exact version-1 bank into the private archive, updates the existing question in place, adds Palindrome only if absent, and advances the bank to version 2. It preserves existing question IDs, every attempt/answer, raw score, original denominator, percentage, snapshot and application. Expired in-progress rows are not modified by the migration; the new API rejects submissions against an older version even when no criteria hash exists and allows a fresh round without inventing a skill failure.

Re-running the plan must return `ALREADY_CURRENT`. For the one-question production path expect one extra question and one archive row, one updated assessment and one updated question; all other original data must match. Reviewer history uses the archived prompt/criteria, and candidate results show their original version/question count/denominator without answer keys. Old results lacking eligible skill provenance remain history, not newly inferred skill scores. Record version 2 and the private evidence location.

This bank is **PENDING_EXPERT_REVIEW_AND_PILOT**. Judge0 passing test cases confirms execution, not test validity. The owner must decide whether to enable this draft for pilot use; do not present it as a validated hiring instrument. If it is not approved for a pilot, keep the assessment inactive through the existing administration workflow.

## 4. Start the release and verify

- Deploy the pinned API and web artifacts together, using the actual Judge0 endpoint/key from the secret store. Keep development mock authentication disabled. Regenerate Prisma Client during the build, not by changing production schema at startup.
- `ENABLE_SCHEDULED_JOBS=false` omits the scheduler module on process start (used in isolated staging). It is not a live maintenance switch: drain requests and stop already-running writers/cron processes as well. Restore the intended scheduler setting only after QA.
- Check health/readiness, API logs, database permissions/RLS, and schema diff. Use a designated QA account and explicitly recorded QA submissions; never alter a real applicant's results for a smoke test.
- Before an eligible assessment: profile/API must show `NOT_ASSESSED`, jobs must show a null score with `AWAITING_ASSESSMENT`, and courses must suggest assessment first without an invented gap.
- Through the browser, run visible tests and submit the approved pilot exam through real Judge0. Verify persisted skill binding, criteria snapshot/hash, score, and completed attempt. Confirm measured gaps produce relevant courses, a passing retake removes the measured gap, and unassessed skills remain unknown.
- Check both job list/detail APIs and screens: partial coverage must show assessed/total counts and `PRELIMINARY`; a 100 score at 1/11 coverage must not imply complete suitability. Verify new applications save a nullable score plus assessment snapshot; old scalar-only applications display no assessed match score.
- Restore traffic/workers only after these checks. Monitor Judge0 errors, pending reviews, database errors, and client errors. Keep the pre-release backup and verification evidence under the normal retention policy.

## 5. Recovery

If a schema step fails, leave traffic paused, diagnose the specific statement, and rerun only after checking state. The additive SQL can remain in place; do not drop columns or remove enum values as an automatic rollback. If bank patching fails, its transaction rolls back, and the private bank backup remains available for investigation.

If the new application fails, prefer fixing forward. The old binary expects non-null scores and can reinstate GitHub-based matching, so it is not a safe unconditional rollback once new null-score applications exist. Keep matching/submissions unavailable until a compatible version is ready. A full restore requires an owner-approved recovery point and reconciliation of writes after that point; never silently discard new applications or results. The release script does not automatically downgrade a bank or rewrite completed results.
