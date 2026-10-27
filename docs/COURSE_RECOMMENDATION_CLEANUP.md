# Profile and course recommendation follow-up — 27 October 2026

Status: merged and deployed to production through PR #5 on 27 October 2026. Production v3 rollout evidence remains in [the rollout report](ASSESSMENT_V3_PRODUCTION.md).

## Profile wording

The Skills summary counts recorded skill rows, including unassessed rows. Its label is now “ทักษะที่บันทึกไว้”, and the internal variable is `recordedSkillsCount`. Individual scores, assessment status, GitHub evidence and historical badges are unchanged. Recording a skill does not establish proficiency.

## Shared course selection

`apps/api/src/recommendations/course-selection.ts` supplies a single URL identity and deduplication policy for catalog, measured skill gaps, job detail recommendations and company development plans.

- Only HTTP(S) URLs without embedded credentials are eligible. Invalid destinations are omitted.
- Identity ignores www, HTTP/HTTPS differences, trailing slashes, fragments and recognized tracking parameters. Other query parameters and path case remain significant.
- YouTube watch, short-link, shorts and embed URLs for the same video share an identity. The original selected destination is returned unchanged.
- Filter relevance before deduplication, then apply limits (3 per skill/development plan, 6 per job). A stale database skill tag alone is insufficient: the skill name or supported alias must appear with word boundaries in title or description.
- Title evidence ranks ahead of description-only evidence, with title and ID tie-breakers for deterministic results. Identical titles with different destinations are not merged.
- Catalog retains its existing filters and newest-first order before deduplication. No rows are deleted or rewritten; original course IDs and references remain intact. No schema migration is needed.

These are text-based, skill-level recommendations. They do not assert course quality, current provider availability, or coverage of a particular failed rubric criterion. Human content review is still needed. Courses recommended from company feedback remain explicitly separate from measured assessment gaps.

## Unassessed policy

Unknown skills retain null scores and assessment-first guidance. Only measured gaps generate assessment-based personalized courses. This change neither creates scores nor changes exam attempts, application matching formulas, assessment coverage or historical results.

## Verification

- API build passed.
- Security and UAT suites: 191 tests passed (20 security + 171 UAT), including new course identity/relevance and development-plan regression cases.
- Web ESLint: no warnings or errors (tool reports the existing Next.js lint command deprecation).
- Web TypeScript validation passed; final targeted regression passed 31/31 after rebuilding the API. Logs are in local `output/course-cleanup-*.log`.
- Existing job recommendation fixture now includes real-shaped HTTP URLs, matching the database URL contract and the new rejection of unusable destinations.

No production data cleanup or live provider course-content validation was performed. The database can retain duplicate imported records safely while all affected API views suppress duplicate destinations.

## Remaining decisions

Human expert review and participant pilot/calibration of the draft v3 exam remain outstanding. A later content-curation task can verify provider pages, map courses to rubric-level topics and consolidate stored records with explicit reference-preservation rules; those actions are not implied by display deduplication.

## Production release verification

- PR #5: https://github.com/Jixgo-cloud/last-project/pull/5
- Reviewed head: `6a9f7ead0a0bb57feb3608f97a68725a9f321424`; runtime merge commit: `2cc1265fab708be9557be9d94b68450d4c148abe`.
- PR CI passed: https://github.com/Jixgo-cloud/last-project/actions/runs/40485679474
- Main CI passed: https://github.com/Jixgo-cloud/last-project/actions/runs/40486244326
- Vercel production `dpl_6jG7KjM3BVYsUbAWFBru9fmqkPSS` READY; Railway `4ec779e9-fc19-443c-bdd8-d0eb71fa9f85` serves the runtime merge revision with database connected. Public site: https://smartcareerplatform.vercel.app.
- API checks completed at 10:16 UTC; authenticated browser checks immediately afterward. No migration, seed, data deletion or exam submission was performed in this release verification.

| Check | Result |
| --- | --- |
| Profile UI | 24 recorded skills; new Thai label present; old verified label absent |
| Profile API | Entire skill array unchanged before/after; Jixgo-cloud JavaScript remains 65 |
| Job detail API/UI | Score remains 93, preliminary coverage 1/8; six unique course destinations; rendered links exactly equal API order |
| Measured gap API | JavaScript remains 65 vs 70; three unique courses; duplicated Bootcamp no longer consumes recommendation slots |
| No-gap QA API | Existing assessment 100 preserved; no measured gaps manufactured |
| Catalog API/UI | 94 cards / 94 unique destinations; Bootcamp appears once |
| Catalog search UI | Searching The Web Developer Bootcamp returns exactly one card |
| Company development API | Existing React plan returns three distinct course destinations |
| Draft/unknown UI | Draft review wording and assessment-first guidance for unassessed skills remain visible |

Local evidence: `output/course-cleanup-production/` contains before/after API reports, UI assertions and screenshots (`profile.png`, `job-courses.png`, `bootcamp-single.png`). Authentication tokens are excluded. API verification first waited for the correct runtime revision; the old deployment remained healthy during rollout. No broad runtime-log audit or external course-content validation is claimed.

The documentation-only follow-up records these results after the runtime deployment. A later documentation commit does not change the assessed runtime behavior above.
