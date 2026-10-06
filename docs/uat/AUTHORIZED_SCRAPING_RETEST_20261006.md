# JobsDB / Blognone — authorized educational ingestion retest

Date: 2026-10-06 (Asia/Bangkok).

The project owner reports approval for scraping these sources for this educational project. This records the owner's instruction; it does not independently certify a provider agreement.

## Implementation

- Native HTML remains first choice. An HTTP 403 or a successful page without job markup can use a fresh ordinary headless Chromium browser. Other errors, including HTTP 429, are not retried through a browser.
- Each run uses a temporary browser profile, no user account cookies, and no database, OAuth, JWT or AI credentials in the browser environment. HTTPS navigation and resources are limited to the two sources and verified public asset hosts. No proxies, stealth modifications, CAPTCHA solving or certificate-validation bypass were added.
- Browser runs are serialized in the API process and the browser closes after success or failure. Failed reads preserve stored jobs and return safe error codes.
- JobsDB now reads the current visible job cards, canonicalizes job URLs and deduplicates older embedded-data entries. Hybrid work alone is not labelled fully remote.
- Blognone retains real Contract/Part-time/Internship labels and skips links without job headings. The connector currently reads the first listing page, so its configured quota is a maximum, not a promise to retrieve every listed job.

## Runtime

Puppeteer is an API production dependency. Railpack documents automatic Puppeteer system dependencies and retaining `/root/.cache` in the deployed image: [Node provider](https://railpack.com/languages/node/). The optional Alpine Dockerfile uses packaged Chromium; that Docker route has not been exercised in this round.

Railway runs the API as root. Chromium therefore uses `--no-sandbox` in that Linux root container; container isolation and request restrictions do not provide the same protection as Chromium's process sandbox. Other hosts retain Chromium's default sandbox. A future dedicated non-root browser worker would strengthen isolation.

## Evidence before deployment

- Ordinary local browser access displayed real listings on both sources without an access challenge.
- Public card DOM saved locally parsed 21 complete unique JobsDB entries and 13 complete unique Blognone entries. Blognone displayed 18 total across pages; no claim is made that the first-page connector reads all 18.
- API build and lint passed. Automated security tests: 16 passed. UAT regression tests: 42 passed.
- Existing production UAT remains 154 passed / 31 blocked / 1 failed out of 186 until the new server-side runs are verified. Historical HTTP 403 evidence is retained.

## Production retest

Revision `0747a5a34475b2435fbe36e4a5c4dd68322b819c` passed [GitHub verification](https://github.com/Jixgo-cloud/last-project/actions/runs/37447284915) (full build, lint, 58 security/UAT tests, isolated database checks and UI regression). Railway deployed it as `a03df92a-aaf9-4974-9c1a-9001adb7b716`; `/api/health` confirmed the revision, `status=ok` and `database=connected`.

| Source | UI run timestamp (ICT) | Quota | Result | Created / duplicate / errors |
|---|---|---:|---|---|
| Blognone | 2026-10-06 17:11:17 | 5 | FAILED — SOURCE_HTTP_403 from the browser request | 0 / 0 / 1 |
| JobsDB | 2026-10-06 17:11:59 | 10 | FAILED — SOURCE_HTTP_403 from the browser request | 0 / 0 / 1 |

The renderer reached the remote pages and classified their HTTP response; this was not `SOURCE_BROWSER_UNAVAILABLE`. Local access works, but Railway access remains blocked. The exact provider reason (network origin, automation policy or another rule) is unverified. Educational approval does not itself alter the remote server's access rules.

ADM-039 and ADM-040 remain blocked. Overall UAT remains 154 passed / 31 blocked / 1 failed. No repeated attempts, IP rotation or challenge bypass were performed. Stored jobs were not replaced by sample data. Duplicate ingestion cannot be tested until source access succeeds.

JobsDB quota was restored to 30 and Blognone to 15; all other quotas remained unchanged. The temporary pre-deployment quota settings reverted when Railway replaced the container, so they were reapplied for this retest. Configuration persistence across replacement deployments is a separate observed improvement item, not a scraping success criterion.

Private evidence: `outputs/ingestion-investigation-20261006/authorized-blognone-run-ui.txt`, `authorized-jobsdb-run-ui.txt`, `authorized-browser-final-ui.txt` and `authorized-browser-production-audit.png`. Previous failure evidence and previous registry records are retained. Evidence is not committed to GitHub.

Next useful step: have the source owner confirm an approved feed or access for this Railway server. Until then, use the already tested JSearch, JobThai and Remotive connectors for the trial; no additional key is required for this browser fallback.
