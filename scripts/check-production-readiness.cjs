// Read-only smoke probe. Prints statuses only; no credentials or private responses.
// This is not a scheduler and does not send alerts or consume Judge0 submissions.
const api = 'https://smartcareerapi-production.up.railway.app';
const web = 'https://smartcareerplatform.vercel.app';
(async () => {
  const results = [];
  for (const [url, expected] of [[`${api}/api/health/ready`, 200], [web, 200], [`${api}/api/applications/00000000-0000-0000-0000-000000000000`, 401]]) {
    const start = Date.now();
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(15000), redirect: 'error' });
      const result = { url, expected, status: response.status, elapsedMs: Date.now() - start, passed: response.status === expected };
      if (url.endsWith('/health/ready') && response.ok) {
        const health = await response.json();
        result.passed = result.passed && health.status === 'ok' && health.database === 'connected';
        result.revision = /^[a-f0-9]{40}$/i.test(health.revision || '') ? health.revision : null;
      }
      results.push(result);
    } catch {
      results.push({ url, expected, passed: false, error: 'Request failed or timed out' });
    }
  }
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2));
  if (results.some(r => !r.passed)) process.exitCode = 1;
})();
