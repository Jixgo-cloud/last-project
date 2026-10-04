# SmartCareer security and regression review — 4 October 2026

## Changes

- Public registration accepts Candidate and Company only, with the same check inside the authentication service. Existing administrator accounts continue to use email sign-in.
- Browser sessions use HttpOnly cookies through the web API proxy. Responses omit bearer tokens; old localStorage sessions are verified and migrated once. Cross-origin writes are refused.
- Social sign-in uses random, expiring, browser-bound state and single-use exchange codes with a verifier. Redirect origins are exact; verified provider email is required. Administrator and inactive accounts cannot use social sign-in. Account creation and its profile or organization are atomic.
- JWT_SECRET is required, with a minimum length and rejection of the known placeholder. There is no built-in signing key.
- Public job personalization uses the verified, active database identity rather than unsigned JWT parsing.
- Candidate updates pick only editable fields. Job and company assessment requests validate nested inputs, salaries, quotas, scoring ranges and assessment ownership. Zero salaries and zero passing scores are preserved. Job skill replacement is transactional.
- Applicant code is never executed inside the API process. Provider outages return a clear service-unavailable response. The built-in provider credential and Node VM fallback were removed. With no provider key or explicit URL, execution uses the public Judge0 endpoint; a dedicated provider can be configured for production capacity.
- Next.js is updated to 15.5.27 with React 19, compatible chart and icon packages, bounded remote image hosts, and patched dependency overrides.
- GitHub Actions installs from the lockfile, builds, lints, runs security tests and runs the isolated application regression. API prestart synchronizes the additive schema, including OAuth state and login rate-limit tables, without accepting destructive schema changes.

## Verification

- `npm ci`, `npm run build`, `npm run lint`: passed locally.
- `npm run test:security`: 7 tests passed, including role restrictions, signing-key configuration, exact origins, state expiry/replay/concurrency, exchange verifier/origin/replay, profile ownership fields and safe provider failure.
- `scripts/verify-core-regression.cjs`: 21 checks passed against a disposable local database; source database counts remained unchanged and the fixture database was removed.
- The coding regression uses a deterministic HTTP provider fixture. It validates the application integration without running applicant code locally; it is not a live provider capacity test.
- A separate benign live submission returned Accepted and output 5 from the public Judge0 endpoint and the locally configured RapidAPI provider.
- Computer-use manual checks covered Candidate profile/radar/save/logout, Company dashboard/applicant page/logout, and Administrator dashboard/logout. CSV delivery through the browser proxy returned HTTP 200 with an attachment and CSV content. Browser download-event capture was unavailable, so the actual saved CSV file was not verified through computer use.
- The Railway prestart command was separately verified against the isolated database.

## Deployment requirements and follow-up

- The user rotated the production JWT_SECRET in the live soothing-love service; its 64-character length and rejection-marker absence were verified without recording the value. Rotation invalidates existing sessions and requires users to sign in again.
- The production Railway service uses Railpack with `npm run start --workspace=@smartcareer/api`; the new prestart script supplies the missing schema synchronization.
- Railway configuration now waits for GitHub checks and watches API, Prisma, shared-package, package.json and package-lock.json changes; applied settings were verified.
- Production dependency audit: 0 high, 0 critical, 3 moderate findings. These are the Nest SSE advisory and dependent package notices. Repository search found no SSE route, EventSource or SseStream usage. This is a reachability assessment, not a claim that the dependencies have no vulnerabilities. Upgrade Nest in a separate migration and continue dependency scanning. [Maintainer advisory](https://github.com/nestjs/nest/security/advisories/GHSA-36xv-jgw5-4q75).
- Development tooling still has audit findings; these remain a separate maintenance item. Do not use `npm audit fix --force` without checking the framework migrations.
- Rotate the previously embedded external-provider key with its provider if that credential remains active; removing it from current source does not remove Git history.
- Configure provider capacity, auth monitoring and expired rate-limit-row retention for larger production traffic. Railway currently displays a trial balance; no plan purchase was made.
- Full live Google/GitHub sign-in and a new live application/assessment submission still require post-deployment verification with suitable test accounts. Local test accounts are disposable and are never seeded into production.

- Additional computer-use pointer verification created a company job successfully in a disposable local database. GitHub browser integration checks use text input and DOM button activation; pointer behavior is verified separately. The test harness tolerates a dialog-already-closed event only while retaining the actual deletion assertion.
