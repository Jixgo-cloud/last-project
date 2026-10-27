# Prelaunch readiness review — 27 October 2026

**Decision: not ready for unrestricted public launch yet.** This review implements local fixes and inventories production QA data. It is not an independent penetration test, an assessment-validity certification, or a production deployment.

Branch: `codex/prelaunch-readiness`, based on main `09cd0fdca53d0f376d2fd7823de9bcace1becc0c`. No schema migration is required. No production data was written, hidden, deleted, or re-scored during this review.

## 1. Security and privacy

| Priority | Finding | Remediation / evidence |
|---|---|---|
| P0 before public launch | Authenticated GET /api/applications/:id did not scope the application by caller, and included the complete candidate user row | Controller forwards authenticated user ID/role; service queries candidate ownership or company membership, permits explicit ADMIN access, and returns 404 outside scope. User projection contains only id/email/avatarUrl. Local fix; production still needs release and verification. |
| P1 | The same detail route could expose private candidate development journals to companies | Reuse companyEvaluationView; company-authored feedback remains visible, candidate progress is excluded without modifying stored data. |
| P1 | Application error logs could include Prisma input details, including private cover letters | Preserve intended HTTP errors; replace unexpected exceptions with a generic 500 and log only a generic message, preventing the original database exception from reaching the default exception logger. This is scoped to application submission, not a claim that every log path has been audited. |
| P2 | Notification limit accepted NaN, negative or excessive values | Bound finite limits to integers 1–100; invalid numeric values use 30. Keep the user ownership filter. |
| Verified | Supabase public-schema access | All 30 application tables have RLS; anon/authenticated have no SELECT privileges. Security advisor reported 30 INFO RLS_ENABLED_NO_POLICY entries, consistent with backend-only access. No permissive policies were added. |

Reviewed authentication/role guards, application access, assessment visibility, company evaluation projection, notifications, health endpoint and relevant configuration. Existing auth and assessment regression suites were run. JWT validation checks the current user's active status. Ingestion quota mutation endpoints require ADMIN. Public readiness responses expose connectivity/revision, not database exceptions.

The direct API response did not contain HSTS at inspection; the Vercel frontend did. Review response-header hardening at the API/proxy before broad launch. This does not mean the HTTPS requests failed; they succeeded.

### Verification

- Shared package compilation completed. `npm run build:api` stopped at Prisma generation with Windows EPERM because its engine DLL was in use. No schema changed. `npm run build:app --workspace=@smartcareer/api` independently compiles against the existing generated client successfully.
- `npm test`: **198 passed, 0 failed** (20 security + 178 UAT/regression), including new identity forwarding, ownership query, field projection, journal privacy, exception sanitization and pagination tests.
- `node scripts/verify-application-access.cjs <private-staging-config.json>`: real Prisma queries on the existing isolated localhost staging database pass owner access, member access, both outsider 404 cases and authentication-field exclusion. Attempt count unchanged; zero writes.
- Integration script refuses non-localhost/non-staging URLs and does not print credentials or private results. Unit tests verify role-specific query scopes; the database check verifies Prisma relation filtering actually executes.
- No new OAuth login, Judge0 submission, mobile/accessibility audit or complete production browser regression was performed in this readiness pass. Earlier flow evidence remains in the release reports; it is not relabeled as new testing.

## 2. Operations and service continuity

At 2026-10-27 10:49 UTC (17:49 ICT), the read-only probe returned:

| Check | Result |
|---|---|
| Railway /api/health/ready | 200; database connected; revision 2cc1265fab708be9557be9d94b68450d4c148abe |
| Production web home | 200 |
| Application detail without authentication | 401 |
| Vercel latest production deployment | READY; main 09cd0fdca53d0f376d2fd7823de9bcace1becc0c; dpl_8p85d1UWhZzTkMADSxy4kGDWF2Fx |

Railway's refreshed deployment detail identified 4ec779e9 as Active; its service summary simultaneously said no active deployment. Treat that provider UI inconsistency separately from the successful live health response. Do not trigger an unnecessary deployment to resolve a display discrepancy.

Railway still displayed **4 days or $3.56 left**. No subscription, payment, quota or billing setting was changed. Owner must ensure continuity and agree a spending cap.

Judge0 code has request timeouts (9 seconds), memory limits (128000 KB), and bounded execution CPU time (up to 5 seconds in the configurable path). These are execution protections, **not evidence of remaining paid quota or measured concurrency capacity**. Ingestion batch quotas likewise do not prove external provider credits are available.

### Monitoring and recovery gates

A reusable read-only probe is now available:

```powershell
node scripts/check-production-readiness.cjs
```

It checks database readiness, web reachability and anonymous rejection, limits requests to 15 seconds, emits no private response data, and returns nonzero on failures. It is **not scheduled** and no alerts have been sent. Before launch, the operator must wire it to an approved scheduler/monitor, choose a recipient and test a controlled alert. Add provider quota, 5xx/latency and Judge0 failure monitoring; agree thresholds from a staging load test.

Existing private recovery evidence was inspected: archive-rehearsal.json records a successful local restore on 27 October from a **15 October 17:06 UTC** archive, preserved data, no production writes, and owners/grants not restored. This is historical rehearsal evidence, not a fresh recovery point for the current database.

No new backup was taken in this pass, consistent with the earlier no-backup rollout instruction. Before accepting real user data, the owner must explicitly settle backup scope/retention, recovery point and recovery time requirements. The current application dump procedure excludes Supabase-managed schemas and Storage object files. A current restore drill must verify those separately where used, plus permissions and post-backup writes; do not claim complete recovery from the old application archive.

Open operations decisions: Railway payment continuity; actual Supabase/Vercel/Judge0/GitHub/Google/YouTube/AI provider quotas; alert recipient; load/concurrency target; current backup and restore policy. These cannot be inferred from one successful health request.

## 3. QA visibility and historical preservation

See [the exact-ID inventory](QA_HIDE_INVENTORY_20261027.md):

- 20 marked assessments: 18 active, 2 inactive.
- 13 marked jobs: 10 active, 3 inactive.
- 3 active QA-marked candidate accounts and 2 marked companies.
- No course matched the explicit QA-/UAT-/PILOT-QA- prefix query; unmarked seed data still needs owner classification.

This is an inventory proposal only. Existing public-job exclusions do not prove all direct links, assessments and recommendation paths are hidden. Review exact IDs, then deactivate discovery/start paths while retaining authorized history. Company/course tables have no generic isActive flag; do not simulate hiding with deletion.

Production read-only totals remained 59 attempts, 89 answers, 23 applications and 4 company evaluations. No migration, seed or result update ran. Counts corroborate the baseline but do not alone prove identical contents; any future hiding operation must compare content fingerprints as described in the inventory.

Assessment semantics remain unchanged: unassessed is neither 0 nor 100; partial coverage stays preliminary; only measured gaps drive remedial courses. Preserve v3 draft status PENDING_EXPERT_REVIEW_AND_PILOT.

## Release and expert gates

1. Release operator: review this diff, run CI, deploy the access-control fix, then verify anonymous/own/other-candidate/other-company paths on designated QA accounts through API and screens. Until then the P0 production exposure is not resolved.
2. Owner/operator: resolve billing, monitoring, provider capacity and recovery gates above. Approve exact QA visibility IDs; implement and test visibility separately without deleting history.
3. Human domain/assessment experts: review skill/job relevance, original question/rubric/test coverage, threshold fairness and pilot results before removing draft labels. Automated review and synthetic answer testing are supporting evidence, not expert sign-off.
4. Owner with privacy/security reviewers: approve consent, retention/deletion/export handling, incident contact and company access policy before onboarding real users. This report does not assert legal compliance.

