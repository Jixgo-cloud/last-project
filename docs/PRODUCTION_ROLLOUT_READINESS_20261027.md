# Production rollout readiness — 27 October 2026 (Asia/Bangkok)

**Decision: HOLD production rollout and merge.** The application release is CI-green, but the production database and assessment bank are not yet ready for the documented release path. This report records inspection and a local rehearsal, not a production upgrade. No production rows, schema, deployment settings, or secrets were changed.

Read with [the upgrade/recovery runbook](PRODUCTION_ASSESSMENT_UPGRADE.md). [PR #2](https://github.com/Jixgo-cloud/last-project/pull/2) remains open with auto-merge disabled at the owner's request.

**Subsequent preparation:** the owner chose the two-question expansion for isolated staging, with no deploy/merge. See [the expansion and staging evidence](ASSESSMENT_EXPANSION_STAGING.md). The observations below describe the earlier production inspection; production has not been upgraded. The current runbook includes a fourth SQL step for the private revision archive and an explicit one-to-two expansion flag.

## Verified targets and current state

| Component | Observed state | Release implication |
| --- | --- | --- |
| Release code | `85353f25cdd31600d6fd269c20bc8d5fec9e0033`; [CI passed](https://github.com/Jixgo-cloud/last-project/actions/runs/40437225664) | Pin the final reviewed PR head again before release; later documentation commits are not the original CI SHA |
| Railway API | `smartcareerapi-production.up.railway.app`, revision `dac6fc8306fea8d051245e596ffc7456b0c9b222` | `/api/health` and `/api/health/ready` return 200, database connected |
| Actual Railway service | Project `soothing-love` (`dd57e850-bd2a-49f6-9d03-1d73c48ad95b`), service `59ac8505-b5b5-4a2e-aa1e-fbb6567490ee`, environment `c046953c-2230-4f73-bac6-be7856734d2d` | This service owns the public API domain; do not release to the similarly named unexposed service in `fulfilling-manifestation` |
| API deployment | `0f52cdb6-20e0-40aa-a6eb-4ac1abc7a761`, ACTIVE, Railpack, Node 24.21.0, one replica in Southeast Asia | Record this as the old deployment; do not assume rolling back to it is safe after null-score writes |
| API build/start | `npm run build --workspace=@smartcareer/api` / `npm run start --workspace=@smartcareer/api` | Removing `prestart` in this PR removes automatic `db push` from this actual release path; Dockerfile is not the current builder |
| API deployment controls | Git auto-deploy enabled; Wait for CI enabled; no pre-deploy step shown; healthcheck path not visibly configured | Establish a maintenance window and explicit migration step before the merge can trigger deployment; configure and verify `/api/health/ready` as the deployment healthcheck |
| Watched paths | `/apps/api/**`, `/prisma/**`, `/packages/shared/**`, `/package.json`, `/package-lock.json` | This feature triggers a build; script-only release changes need an explicit rebuild or a reviewed `/scripts/**` watch path |
| Production web | `smartcareerplatform.vercel.app`, Vercel `last-project`, deployment `dpl_DJvdgBVE6nE2zisVvJ1w9h4esmbK`, revision `c7482335438293f2a32dbdc2dc833021fdc49fd1` | Production web and API currently differ; release both deliberately |
| Other web deployment | Production deployment for `dac6fc83` was CANCELED | Do not mistake the newest attempted deployment for the currently served web |
| PR preview | `dpl_H3kLy97jPPvUhS9JMqMSVhKi6AuG`, READY, revision `85353f25`, preview target | A successful frontend build is not a staged full-stack production release |
| Supabase | `smartcareer-db`, project `ivxsgbjvqutgyvakqfyt`, ACTIVE_HEALTHY, PostgreSQL 17.11 | Use this verified target for the production schema procedure |

The production homepage rendered in the browser. Read-only requests through the web proxy to health, jobs, and assessments returned 200. Production-origin CORS returned 204 with the correct origin and credentials header. No login, application, assessment submission, or other write was used for this inspection.

## Database and assessment gates

| Gate | Observed evidence | Required action |
| --- | --- | --- |
| Application score schema | `matchScoreAtApplication` is NOT NULL with default 0; `matchAssessmentSnapshot` is absent | Apply `202610270001_assessment_matching` before starting the new API |
| Prerequisite framework fields | All five framework fields already present | Prerequisite SQL remains safe to re-run after backup |
| Skill categories | SALES, COORDINATION, WRITING already present | Enum migration is repeatable and should be a no-op here |
| Migration history | No `public._prisma_migrations`; Supabase migration list empty | Use the explicit reviewed SQL path, not blind `migrate deploy` or a fabricated baseline |
| Client access | All 29 public application tables have RLS; `anon` and `authenticated` have no SELECT grant | Preserve this backend-owned access model; 29 INFO `rls_enabled_no_policy` advisories are consistent with deliberate denial, not a reason to grant client access |
| JavaScript bank | Platform `coding-algorithm-sandbox`, version 1, JavaScript skill, **one** question: Two Sum Target Matcher, 50 points, three cases, no rubric/private solution stored | Existing two-question release script correctly refuses this bank. Do not bypass the guard or run a seed |
| Historical bank data | Six attempts and two answers reference this bank | Preserve assessment/question IDs and every attempt, answer, and existing snapshot in any editorial migration |
| Work in progress | Two IN_PROGRESS attempts, none within their configured time limit at inspection | Recheck immediately before maintenance; do not delete or relabel them as skill failures |
| Import records | 151 COMPLETED, 81 FOLLOWING, two INTERRUPTED; no RUNNING records at inspection | Recheck actual worker activity/heartbeats before stopping service; these counts alone do not prove no background work |

Inspection totals: 25 assessments, 37 questions, 50 attempts, 73 answers, and 23 applications. These are changing operational counts, not a transactionally frozen backup or a release-time fingerprint.

### Required editorial decision for the production bank

The local two-question repair cannot be applied unchanged. Prepare one of these reviewed paths on a **fresh** production clone:

1. Preserve the existing one-question scope and create a versioned, hash-guarded patch for that question, with reviewed rubric, starter, private reference solution, and cases. Preserve its 50-point denominator and historical results. This requires a dedicated patch/manifest; it has not been implemented or approved here.
2. Adopt the two-question bank only after explicit editorial approval of the added Palindrome question and changed total points. Use a targeted versioned migration that preserves the existing question ID and all old attempts, and keeps old results interpretable in their original scope. Do not insert a placeholder question merely to satisfy the script's count check.
3. Release the application with this assessment inactive until review/pilot preparation is complete. Unknown skills will remain unknown; owners must approve the resulting pilot availability.

All options remain pending expert review and pilot calibration. No option was silently chosen or applied during readiness inspection.

## Runtime, staging, and continuity gates

- Railway console confirmed `NODE_ENV=production`, `ENABLE_DEV_MOCK_AUTH` unset, and `DATABASE_URL` present. Secret values were neither displayed nor copied.
- The connection's non-secret metadata identifies the same Supabase project through `aws-0-ap-southeast-1.pooler.supabase.com:5432` (session pooler). Its URL has no explicit `sslmode` parameter; this alone does not establish the negotiated TLS state. Verify the migration runner's SSL configuration. `pg_dump` was not found on the inspected container's PATH, so prepare an external release runner instead of assuming the API container can create the backup.
- Judge0 endpoint/key variables were absent from both service-variable names and the inspected console environment. Current code therefore selects `https://ce.judge0.com`. A read-only request **from the running Railway container** to `/languages` returned HTTP 200 and included JavaScript language 63. This confirms connectivity/language discovery only, not submissions, capacity, or production grading. The prior live test used RapidAPI credentials locally, so it does not prove this production provider path.
- Select the intended production Judge0 provider and provision its required secrets through the service's secret store if applicable. Run real submissions on the isolated staging API first, then the designated production QA account during the approved rollout window. Do not copy credentials into this report, PR, or browser output.
- Vercel metadata showed `NEXT_PUBLIC_API_URL` scoped to production and `NEXT_PUBLIC_SHOW_DEMO_LOGIN` to production/preview. The proxy source falls back to the real production Railway URL when no explicit API URL exists. Treat the current preview as potentially connected to production; do not use it for write tests. Stage with explicit `API_URL`/`NEXT_PUBLIC_API_URL` pointing to an isolated API and database.
- API cron jobs run in process at 00:00, 00:30, and 00:35 Asia/Bangkok; no maintenance/cron-disable flag was found in the inspected code. Stopping only frontend traffic does not stop ingestion. Drain requests, stop every writer/replica, and verify the maintenance mechanism before the final backup and migration. Coordinate an API-first deployment and controlled frontend promotion so old/new instances cannot write concurrently during the transition.
- Railway displayed **4 days or $3.59 left** in the current trial workspace. The owner must arrange service continuity before production rollout; no plan purchase or billing change was made.

## Backup and rehearsal evidence

Supabase organization metadata reports the Free plan. Managed daily backups/PITR were not independently established. Supabase documents daily backups for paid plans and recommends off-site exports for Free projects: [backup documentation](https://supabase.com/docs/guides/platform/backups). Do not claim a recovery point based on the local development backup.

The latest archived production backup located in the existing private backup folder was created **16 October 2026, 00:06:50 ICT** (`2026-10-15T17:06:50.413Z`). Its project reference matches production. SHA-256 was verified:

```text
9e1ab6a030048456a1b669b3fef7e5e2132b0fc63d6b59e7946f26330b23074d
```

Rehearsal completed on 27 October in local PostgreSQL database `smartcareer_rollout_rehearsal_1793068026837`:

- Restored 29 public application tables and 4,414 rows. The archive's duplicate CREATE SCHEMA public entry was excluded from the restore list because the new empty local database already had that schema.
- Applied the three SQL scripts from the runbook successfully. Before/after row counts and content fingerprints match after excluding only newly introduced metadata fields.
- Prisma schema diff: `No difference detected.`
- Bank release plan exited 1 on the one-versus-two question guard, before any bank write. This reproduces the rollout blocker rather than pretending the patch passed.
- The restore used `--no-owner --no-acl`; it verifies schema/data/migration behavior, **not restored ownership/grants**. Production permissions were checked separately through Supabase.
- The archive covers the public application schema only; it excludes Supabase-managed schemas and Storage object files. It is old and cannot serve as the final release recovery point.

Private evidence (not committed): `C:/Users/ayumg/.codex/backups/smartcareer/rollout-preflight-20261027/archive-rehearsal.json`. The restored database remains isolated for inspection. No production data was changed by the rehearsal.

## Prepared execution order and stop conditions

1. **Owner + release operator:** resolve billing continuity, approve a bank path/pilot scope and maintenance window, verify the actual Railway/Vercel release targets above, pin final commit and CI, and prepare a database-capable release runner with a protected direct/session connection. No production connection secret is currently configured in the local review worktree.
2. **Operator:** obtain a fresh production backup with documented scope, permissions, storage coverage, checksums, and recovery instructions. Restore to an isolated database and rerun the schema migration plus the chosen bank patch. Stop if data, RLS/grants, or schema differ unexpectedly.
3. **Operator + QA:** stage the pinned API and frontend against that isolated database. Verify real Judge0 submissions and unknown → measured gap → passing retake, including partial coverage and historical applications. The existing Vercel preview alone does not satisfy this gate.
4. **Operator:** hold automatic releases and public writes using the reviewed provider controls; drain and stop all writers/cron processes. Take the final backup and counts/fingerprints. Recheck unfinished attempts and worker activity. Do not restart an old image that still runs `db push` after the schema is expanded.
5. **Operator:** run the explicit SQL commands in the current [runbook](PRODUCTION_ASSESSMENT_UPGRADE.md#2-apply-the-schema-changes-explicitly), including the subsequently added private bank-revision archive, one at a time with timeouts; require diff exit 0 and unchanged original data. Apply only the separately reviewed bank plan (or agreed inactive-bank path).
6. **Operator:** deploy the pinned API first with the new no-schema-write startup, then the matching frontend. Verify deployment healthcheck, revision, API proxy, OAuth production callbacks, required provider configuration, and permissions before reopening writes.
7. **QA:** run the designated-account smoke test through real Judge0 and both API/screens. Verify null unknowns, measured gaps only, coverage/`PRELIMINARY`, nullable application snapshots, and preserved old records. Only then restore traffic/workers and monitor.
8. **Recovery:** follow the runbook's compatible-version/fix-forward path. An old image may reintroduce GitHub scores and enforce non-null columns through startup `db push`; do not use it as an automatic rollback. Any restore must account for writes after the recovery point.

**Remaining approvals/evidence:** bank scope and expert/pilot decision; fresh backup + restore; isolated full-stack staging with the production Judge0 provider; maintenance/release coordination and billing continuity. Until these are resolved, retain PR #2 open and do not migrate, promote, or merge automatically.
