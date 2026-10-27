# Production assessment rollout — 27 October 2026

Production migration, deployment and live Judge0/API/browser verification completed on 27 October 2026 (Asia/Bangkok). The owner explicitly authorized preserving existing data **without a new backup** and deploying production while keeping [PR #2](https://github.com/Jixgo-cloud/last-project/pull/2) open. No merge or auto-merge was performed. The earlier [readiness HOLD](PRODUCTION_ROLLOUT_READINESS_20261027.md) is historical and superseded by this execution record.

## Deployed release

- Runtime commit: `15ee7a22370788f4f5108a90febb3d10b1892e99`. Subsequent documentation commits do not change this runtime revision.
- [Release CI passed](https://github.com/Jixgo-cloud/last-project/actions/runs/40462532552): build, lint, security 20 + UAT 157, regression 44, and release integration for both 1→2 and 2→2 banks.
- Railway: project `soothing-love`, service `@smartcareer/api`, production deployment `ce50b076-2d9a-46f8-88b9-c4da259fbfa4`. [API readiness](https://smartcareerapi-production.up.railway.app/api/health/ready) returned HTTP 200, connected database and the pinned revision.
- Vercel: project `last-project`, production deployment `dpl_2DkdX4vFPwWBLaDvnYwaXZPCNg35`, READY at the same commit. [Production website](https://smartcareerplatform.vercel.app) and its `/api/health/ready` proxy served the new API revision.
- Railway source branch is temporarily `codex/assessment-based-matching`, with **auto-deploy disabled**, Wait for CI enabled and `/api/health/ready` configured as the deployment healthcheck. Vercel's production branch remains `main`; production was explicitly built from the pinned SHA. Future branch pushes must not be mistaken for a new production rollout.
- API build/start remain `npm run build --workspace=@smartcareer/api` and `npm run start --workspace=@smartcareer/api`. Client generation occurs during build; startup no longer runs `db push`.

## Database changes actually applied

Target: Supabase `smartcareer-db` (`ivxsgbjvqutgyvakqfyt`), PostgreSQL 17.11. The old Railway API writer was suspended before schema changes and replaced by the new deployment; the old container was not resumed. No active timed attempts existed in the target bank. Pending reviews in other banks were left unchanged.

Reviewed SQL was applied through Supabase's migration API in this order, with session-local lock timeout 10 seconds and statement timeout 60 seconds. The tool supplied the transaction wrapper; redundant outer transaction statements were removed where applicable. The enum additions were committed in their own migration before later steps.

| Repository SQL | Recorded Supabase migration |
| --- | --- |
| `scripts/sql/assessment-framework.sql` | `20261027064350 assessment_framework_metadata` |
| `prisma/migrations/202610270001_assessment_matching/migration.sql` | `20261027064351 assessment_matching_nullable_scores` |
| `prisma/migrations/202610270002_skill_categories/migration.sql` | `20261027064352 assessment_skill_categories` |
| `prisma/migrations/202610270003_assessment_bank_revisions/migration.sql` | `20261027064353 assessment_bank_revisions_private` |

These were recorded at 13:43:50–53 ICT. Prisma schema diff against the pinned release returned **No difference detected / exit 0**. Supabase migration history is authoritative for these executions; `_prisma_migrations` was not fabricated. Do not run blind `prisma migrate deploy`, reset, broad seed or `db push --accept-data-loss` against this database. See [the upgrade runbook](PRODUCTION_ASSESSMENT_UPGRADE.md) for the repeatable SQL and future release procedure.

The new bank archive has RLS enabled, no PUBLIC grants, and no SELECT access for `anon` or `authenticated`. The security advisor returned 30 INFO `rls_enabled_no_policy` notices consistent with the backend-only access model, with no WARN/ERROR findings in that check. This is a scoped check, not a comprehensive security certification.

## Bank expansion and preservation evidence

The deployed release script first produced a read-only plan, then applied the explicitly authorized exception:

```text
node scripts/release-javascript-assessment.cjs --expand-single-question
node scripts/release-javascript-assessment.cjs --expand-single-question --apply --expected-hash 6287e1ad28da3151910f9cf5e1d2d527c90b632304f438c36057f0b478f4b4ac --skip-backup
node scripts/release-javascript-assessment.cjs --expand-single-question
```

Result: `APPLIED`, version 2, `backupFile: null`, `backupSkipped: true`, attempts/answers unmodified. The final plan returned `ALREADY_CURRENT`. The exception retains fresh-hash, active-attempt and transaction guards and the private in-database version archive. That archive is application history, **not a new disaster-recovery backup**.

`coding-algorithm-sandbox` now has Two Sum (5 cases) and Palindrome (6 cases), 50 points each. The original Two Sum ID is retained; one question and one private version-1 archive were added. Totals changed from 25 assessments / 37 questions to 25 / 38. Existing 50-point attempts keep their original scores, denominator, version and snapshots; legacy results without eligible skill provenance remain history rather than inferred skill evidence.

Before/after comparisons, repeated after all production QA, matched for every original row. New QA attempts/answers are excluded and application comparison uses the original columns, excluding the newly added snapshot column.

| Original records | Count preserved | Matching MD5 fingerprint |
| --- | ---: | --- |
| Attempts | 50 | `584de43580736e33eb4827bbb2dbff24` |
| Answers | 73 | `a8bbff9f558559375cf738375238d3a6` |
| Applications | 23 | `858642f4b72d827114266ac75aa1c9b0` |

Fingerprints verify preservation; they cannot restore records. No fresh backup or new recovery point was created.

## Production API and browser verification

A dedicated candidate fixture, `Production Rollout QA 2026-10-27`, exercised the production web → API → database → public Judge0 (`https://ce.judge0.com`, JavaScript language 63) path. The selected active job was **Full Stack Developer**, SKY ICT, with eight required skills. The candidate had no GitHub skill evidence. No external application was sent.

| State | Assessment | Matching API and UI | Courses API and UI |
| --- | --- | --- | --- |
| Before assessment | JavaScript `NOT_ASSESSED`, score null | Score null, `AWAITING_ASSESSMENT`, 0/8 | Assessment first, no fabricated gap/course recommendation |
| Measured gap | 50/100; Two Sum 5/5, Palindrome 0/6 | 71, `PRELIMINARY`, 1/8 | JavaScript `GAP`; skill-gap API returned 3 catalog records and UI showed the measured gap/recommendations |
| Passing browser retake | 100/100; Two Sum 5/5 and Palindrome 6/6 | 100, still `PRELIMINARY`, 1/8 | JavaScript `ASSESSED`; gap list and job-detail recommended courses empty; course plan shows 100 and assessment-first prompts for unknown skills |

Coverage is 1/8 = 12.5%, **rounded to 13% by both API and UI**. The other seven job skills remain `NOT_ASSESSED` with null scores throughout; matching 100 is preliminary evidence for the assessed portion, not full job suitability. Job JavaScript threshold is 70; the career-oriented course plan uses the maximum relevant job threshold of 75. The general course catalog remains visible independently of personalized gap recommendations. Existing duplicate catalog titles were observed; three returned records do not mean three unique courses.

The gap attempt was submitted through the API and inspected in the browser. The passing retake was started, edited, run and submitted entirely through the browser; persisted results survived reload. Each question's three visible test cases passed, followed by all **11/11 grading cases**. Database verification confirmed version 2, two-question scope, JavaScript skill binding, criteria hash and `Judge0-Isolated-Container` execution evidence. Job list/detail/match APIs were consistent. No browser error/warning entries were returned in the final console check.

Audit attempt IDs:

- Provider failure: `7ff34373-0903-4e14-b38c-4d2bae99bfc8`.
- Gap: `416fc20c-fe7e-4a77-8112-64f502685aa9`.
- Browser pass: `b79206a9-8b6e-477a-b8d2-e704a9ddf01c`.

One first grading request exceeded the 9-second Judge0 timeout and returned HTTP 503 `JUDGE_UNAVAILABLE`. It persisted as `SYSTEM_ERROR` with null score/percentage and no answers, not a skill failure or zero. A new attempt succeeded; this smoke test does not establish provider reliability or capacity. A browser editor input replacement mistake caused an initial visible-test failure; after correcting the draft, visible and grading tests passed without submitting that incorrect draft.

Authentication scope: an operator-provisioned short-lived one-use exchange grant created the designated QA session through the normal exchange endpoint. Development mock authentication stayed disabled, role guards/signing secrets were unchanged, and no other person's account was used. The real GitHub/Google provider OAuth round trip was **not** verified by this session. QA records remain identifiable test data.

Sanitized local evidence is under `output/production-rollout/`: `before.json`, `gap.json`, `pass.json`, and before/gap/pass screenshots of profile, results, jobs and courses. These artifacts and the separate private QA token file are not committed. No tokens, answer keys or database connection strings are included in this report.

## Remaining owner/expert decisions

- The bank remains `PENDING_EXPERT_REVIEW_AND_PILOT`. Execution tests do not establish assessment validity; expert review, pilot calibration and hiring-use policy remain outstanding.
- Railway displayed roughly four trial days and $3.57 credit remaining at inspection. The owner must arrange hosting continuity; no paid upgrade was performed.
- Plan real-provider OAuth verification and Judge0 reliability/capacity work before wider use. Other unassessed skills require reviewed assessments, not inferred GitHub scores.
- PR #2 remains open with auto-merge disabled. A later merge and restoration of the intended Railway branch/auto-deploy policy require an explicit release decision.
- Recovery must preserve additive schema and historical archives and use a compatible release/fix-forward. Do not roll back to an old image that runs `db push` or assumes non-null match scores. This rollout intentionally has no fresh backup to restore.
