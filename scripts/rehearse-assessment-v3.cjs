// Upgrade only the already-isolated local staging; prove all historical results unchanged.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');
const cfg = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.codex/smartcareer-assessment-staging.json')));
const url = new URL(cfg.databaseUrl);
assert(['localhost','127.0.0.1'].includes(url.hostname) && url.pathname.startsWith('/smartcareer_assessment_staging_'));
const db = new PrismaClient({ datasources: { db: { url: cfg.databaseUrl } } });
async function snapshot() {
  const result = {};
  for (const table of ['assessment_attempts','assessment_answers','job_applications']) {
    const rows = await db.$queryRawUnsafe(`SELECT to_jsonb(t) AS data FROM ${table} t`);
    result[table] = { count: rows.length, hash: createHash('sha256').update(rows.map(r=>JSON.stringify(r.data)).sort().join('\n')).digest('hex') };
  }
  return result;
}
function release(args) {
  const r = spawnSync(process.execPath, [path.join(__dirname,'release-javascript-assessment.cjs'),...args], {
    cwd: path.resolve(__dirname,'..'), env: {...process.env,DATABASE_URL:cfg.databaseUrl}, windowsHide:true, encoding:'utf8' });
  assert.equal(r.status,0,r.stderr);
  return r.stdout.trim().split('\n').map(line=>JSON.parse(line));
}
(async()=>{
  const before = await snapshot();
  const [plan] = release([]);
  assert.equal(plan.fromVersion,2,'Requires a v2 staging baseline');
  const applied = release(['--apply','--expected-hash',plan.expectedHash,'--backup-dir',cfg.dir]);
  assert.deepEqual(await snapshot(),before);
  const rerun = release([]); assert.equal(rerun[0].status,'ALREADY_CURRENT');
  const archive = await db.assessmentBankRevision.findUniqueOrThrow({where:{assessmentId_version:{assessmentId:plan.assessmentId,version:2}}});
  assert.equal(archive.snapshot.version,2);
  const evidence = { checkedAt:new Date().toISOString(),productionWrites:false,plan,applied,before,after:await snapshot(),rerun,archivedVersion:2 };
  fs.writeFileSync(path.join(__dirname,'../output/assessment-quality-review/v3-migration.json'),JSON.stringify(evidence,null,2));
  console.log(JSON.stringify({preserved:before,archivedVersion:2,targetVersion:3,idempotent:true}));
})().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>db.$disconnect());
