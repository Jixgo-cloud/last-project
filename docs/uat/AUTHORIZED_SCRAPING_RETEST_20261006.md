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

Pending deployment and actual ingestion through the administrator UI. Local browser access alone is not evidence of Railway access. If the source still refuses the Railway browser, retain the blocked status and seek a provider-supported feed or server permission; do not fabricate job records.
