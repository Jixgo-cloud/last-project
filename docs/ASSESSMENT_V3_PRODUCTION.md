# Production rollout: draft assessment v3 — 27 October 2026

The owner explicitly authorized push, PR, green CI, merge, production deployment and the v3 bank upgrade with preserved historical results. All existing production data is designated test data. The bank remains `PENDING_EXPERT_REVIEW_AND_PILOT`; no human validation or pilot calibration is claimed.

## Release identity

- PR: https://github.com/Jixgo-cloud/last-project/pull/4
- Reviewed head: `d7457898dfbcb8c47d8fc6fa839df52b3c95eb63`
- Merge on main: `10c50083f5e1b76c825b40e9e0bc87bf219665f6`
- PR CI passed: https://github.com/Jixgo-cloud/last-project/actions/runs/40481831832
- Main CI: https://github.com/Jixgo-cloud/last-project/actions/runs/40482457726
- Vercel production build: `dpl_4FBfprziwntK8TEV8f6i4ewoSAvh`, READY at the merge SHA.

## Release procedure

Deploy the backward-compatible v3 code while the bank is still v2. Only after verifying the API revision, temporarily deactivate this bank to block new starts, drain existing attempts/reviews, and run the release script with a freshly reviewed hash. Do not change schema or run seeds. Keep the bank inactive until the archive, preservation hashes and API readiness are verified, then re-enable the draft and run designated QA attempts.

A private recovery copy of the exact pre-release v2 bank was saved outside the repository. The release also requires its normal private bank backup and in-database revision archive. These copies cover the affected bank, not a full database/PITR recovery point. Original per-row hashes are verification evidence, not backups.

Pre-release preservation baseline: 56 assessment attempts, 83 answers, 23 applications and 4 company evaluations. Match every original row by ID and complete row hash after upgrade and after QA; exclude only new QA rows, never silently exclude changed old rows.

## Verification record

Completed on 27 October 2026, verified at 09:53 UTC.

- Main CI completed successfully. Railway deployment `c58a8e9e-d68d-48ed-afde-ba1ed0291449` is ACTIVE from main at `10c50083f5e1b76c825b40e9e0bc87bf219665f6`. Both the direct API readiness endpoint and the Vercel `/api/health/ready` proxy return this revision with database connected.
- Maintenance preflight found zero active submissions/attempts/pending reviews. Deactivating only this bank made the real start endpoint return 404 `Assessment not available`.
- The Railway interactive console did not include Node in PATH; the deployed runtime `/mise/installs/node/24.21.0/bin/node` ran the checked-in release script successfully.
- Fresh paused-bank SHA-256: `9207b8b83695864595b14cb55faebf9a0318e36e06eaca96b0afe1926db2b0a3`. Applied with `--apply --expected-hash <reviewed hash> --backup-dir /tmp/assessment-v3-bank-backup`. This container backup is temporary; the independent local recovery copy and database revision archive are retained.
- Release returned `APPLIED`, version 3, attempts/answers unmodified; the next read-only invocation returned `ALREADY_CURRENT`. No schema changes, reset, broad seed or historical regrading occurred.
- Bank v3 is active, with two questions (10 + 12 test cases), 100 total points and draft review/pilot wording. Archived versions 1 and 2 remain private: RLS enabled; neither anon nor authenticated roles have SELECT permission.
- Complete original-row hash checks passed before and after QA: all 56 attempts, 83 answers, 23 applications and 4 company evaluations unchanged. QA added 3 attempts and 6 answers; final totals are 59, 89, 23 and 4 respectively.

### Real Judge0 and API verification

A dedicated synthetic QA candidate exercised the public production API with normal authenticated routes. No mock-auth setting or Judge0 substitute was used.

| Scenario | Assessment | Matching | Course gaps |
| --- | --- | --- | --- |
| Not assessed | null | null, AWAITING_ASSESSMENT, 0/8 | None; recommend assessment first |
| One correct question | 50/100 v3 | 71, PRELIMINARY, 1/8 | JavaScript measured gap, 3 recommendations |
| Both correct | 100/100 v3 | 100, PRELIMINARY, 1/8 | No JavaScript gap or gap-driven job courses |

Visible run tests and full submissions used `Judge0-Isolated-Container`. Correct solutions passed 10/10 and 12/12; the intentionally wrong boolean-return answer passed 0/12. Hidden expected values remain redacted. Job list, detail and match endpoints agree; unknown skill values remain null. New completed attempt IDs: gap `35289807-fe63-4315-b65d-0e3c1facf5e6`, pass `b37b5c83-b6cb-4913-bfad-05a0c7ba9153`.

### Production browser verification

Signed in through GitHub as Jixgo-cloud (UAT QA). The exam first showed the historical v2 score 100/100 with its original version and denominator. A new v3 retake deliberately violated the most-recent-earlier-index criterion: Two Sum scored 15/50 under the essential-criterion cap, while Palindrome scored 50/50. The UI completed at 65/100 (attempt `03eace62-d6cb-485d-8a8c-d8de41bf7d9f`).

Profile showed JavaScript 65%, gap, threshold 70%, version 3; other skills remained unassessed and GitHub remained context only. The existing earned historical badge was retained. The job page showed 93% preliminary match, 1/8 assessed (rounded 13%), seven unassessed skills recommending a test first, and a measured JavaScript gap. The course page showed 65 versus 70 (gap 5), draft wording and separate assessment-first guidance for unassessed skills. No application was submitted and no company evaluation was edited. No Judge0 service errors occurred in these production v3 tests.

Evidence is saved locally under `output/assessment-v3-production/`: API before/gap/pass reports, original/final preservation hashes, release screenshot, historical-v2 screenshot, v3 score screenshot, matching screenshot and profile/course UI text. The rollout record is also appended to PR #4; this local report was created after the merge and is not part of the deployed runtime commit.

### Remaining review and maintenance

- Human subject-matter review and a participant pilot are still required. AI review, automated tests and these synthetic attempts do not validate assessment quality or calibrate the 70% threshold / criterion weights / 30% cap.
- Inherited course catalog duplicates remain visible. Course mapping is by measured skill, not yet by the individual failed rubric criterion; curate relevance and deduplicate separately.
- The profile summary label “ทักษะที่ตรวจแล้ว” counts recorded skills, including unassessed ones; detailed skill rows are correct, but the summary wording should be clarified in a follow-up.
- Railway displayed a trial credit/time limit (about 4 days / $3.56 remaining) during verification; the owner should arrange continued hosting before expiry.
- For a future bank change, repeat inactive/drain/fresh-plan/hash/apply/verify/reactivate. Do not downgrade the database bank to compensate for a code rollback. If a rollback is necessary, first disable new starts and use a release that understands v3 scoring and historical snapshots.

## Local follow-up after rollout

Profile summary wording and shared course deduplication/relevance selection have been deployed through PR #5; see [cleanup report](COURSE_RECOMMENDATION_CLEANUP.md). These changes resolve the first two UI/catalog follow-ups in production, with API and browser evidence in the cleanup report. Historical production verification above remains unchanged. Duplicate database records are retained intentionally; API presentation removes duplicates without destructive migration.
