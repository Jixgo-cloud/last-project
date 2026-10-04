// Read-only checks against compiled API. Quota writes use a temporary directory.
const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const root = path.resolve(__dirname, '..');
const appModule = path.join(root, 'apps/api/dist/app.module.js');
const quotaModule = path.join(root, 'apps/api/dist/ingestion/ingestion-config.service.js');
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'smartcareer-config-'));
const originalQuotaPath = path.join(root, 'apps/api/config/ingestion-quotas.json');
const originalQuota = fs.readFileSync(originalQuotaPath);
const configured = require('dotenv').parse(fs.readFileSync(path.join(root, '.env')));
const apiEnvPath = path.join(root, 'apps/api/.env');
const apiConfigured = fs.existsSync(apiEnvPath) ? require('dotenv').parse(fs.readFileSync(apiEnvPath)) : {};
const expected = { ...configured, ...apiConfigured };
const inherited = { ...process.env };
for (const key of Object.keys(expected)) delete inherited[key];
delete inherited.INGESTION_CONFIG_DIR;

function runChild(cwd, code, extraEnv = {}) {
  return execFileSync(process.execPath, ['-e', code], {
    cwd, env: { ...inherited, ...extraEnv }, windowsHide: true, encoding: 'utf8',
  });
}

try {
  // Check actual ConfigModule initialization from both supported launch directories.
  const envCheck = `
    const fs = require('fs'), path = require('path'), assert = require('assert/strict');
    const root = ${JSON.stringify(root)};
    const dotenv = require(path.join(root, 'node_modules/dotenv'));
    const localPath = path.join(root, 'apps/api/.env');
    const expected = { ...dotenv.parse(fs.readFileSync(path.join(root, '.env'))),
      ...(fs.existsSync(localPath) ? dotenv.parse(fs.readFileSync(localPath)) : {}) };
    require(${JSON.stringify(appModule)});
    for (const key of Object.keys(expected)) assert.equal(process.env[key] === expected[key], true, 'Environment mismatch: ' + key);
  `;
  for (const cwd of [root, path.join(root, 'apps/api')]) runChild(cwd, envCheck);
  console.log('PASS: API environment files load consistently from root and API directory');
  runChild(root, `require(${JSON.stringify(appModule)}); require('assert/strict').equal(process.env.JWT_EXPIRES_IN, '13m');`, { JWT_EXPIRES_IN: '13m' });
  console.log('PASS: Explicit runtime settings take precedence over environment files');

  const defaultQuotaCheck = `
    const fs = require('fs'), assert = require('assert/strict');
    const { IngestionConfigService } = require(${JSON.stringify(quotaModule)});
    const saved = JSON.parse(fs.readFileSync(${JSON.stringify(originalQuotaPath)}, 'utf8'));
    const actual = new IngestionConfigService().getQuotas();
    for (const [key, value] of Object.entries(saved)) if (actual[key] && typeof value.quota === 'number') {
      assert.equal(actual[key].quota, Math.max(actual[key].min, Math.min(actual[key].max, value.quota)));
    }
  `;
  for (const cwd of [root, path.join(root, 'apps/api')]) runChild(cwd, defaultQuotaCheck);
  console.log('PASS: Saved ingestion settings resolve from both launch directories');

  const quotaEnv = { INGESTION_CONFIG_DIR: temporaryDirectory };
  runChild(root, `const { IngestionConfigService } = require(${JSON.stringify(quotaModule)}); new IngestionConfigService().updateQuotas({ JSEARCH: 27 });`, quotaEnv);
  assert.equal(JSON.parse(fs.readFileSync(path.join(temporaryDirectory, 'ingestion-quotas.json'), 'utf8')).JSEARCH.quota, 27);
  runChild(path.join(root, 'apps/api'), `const { IngestionConfigService } = require(${JSON.stringify(quotaModule)}); require('assert/strict').equal(new IngestionConfigService().getQuotaForSource('JSEARCH'), 27);`, quotaEnv);
  console.log('PASS: Changed ingestion settings survive process restart with a configured storage directory');
  assert(originalQuota.equals(fs.readFileSync(originalQuotaPath)), 'Original quota settings changed');
} finally {
  // Only remove the known file created by this test, then its empty temp directory.
  const testFile = path.join(temporaryDirectory, 'ingestion-quotas.json');
  if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
  fs.rmdirSync(temporaryDirectory);
}
