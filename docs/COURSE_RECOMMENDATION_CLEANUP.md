# Profile and course recommendation follow-up — 27 October 2026

Status: implemented locally on `codex/course-recommendation-cleanup`; not pushed, merged or deployed in this follow-up. Production v3 rollout evidence remains in [the rollout report](ASSESSMENT_V3_PRODUCTION.md).

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
