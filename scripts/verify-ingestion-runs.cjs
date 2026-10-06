// Uses only the isolated CI database; no public providers or configured production data.
const assert = require('assert/strict');
const { randomUUID } = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { IngestionService } = require('../apps/api/dist/ingestion/ingestion.service');
const url = new URL(process.env.DATABASE_URL || 'http://invalid');
assert(['localhost', '127.0.0.1'].includes(url.hostname) && url.pathname === '/smartcareer_ci', 'Only isolated smartcareer_ci database is allowed');
const prisma = new PrismaClient();
const config = {getQuotas:()=>({REMOTIVE:{category:'JOB',min:5,max:50,quota:5}})};
const ids = [];
async function main() {
  let release;
  const gate = new Promise(resolve=>{release=resolve;});
  let calls=0;
  const a = new IngestionService(prisma,{},config);
  const b = new IngestionService(prisma,{},config);
  for (const service of [a,b]) service.performJobsSync=async()=>{calls++;await gate;return {id:'isolated-audit',status:'SUCCESS',createdCount:5,errorCount:0};};
  const key=randomUUID();
  const competingKey=randomUUID();
  try {
    const runs = await Promise.all([a.startJobsRun('REMOTIVE',5,key),b.startJobsRun('REMOTIVE',5,competingKey)]);
    ids.push(runs[0].id);
    assert.equal(runs[0].id,runs[1].id);assert.equal(calls,1);
    const reloaded = await b.getJobsRun(runs[0].id);
    assert.equal(reloaded.state,'RUNNING');
    release();
    let final;
    for(let i=0;i<100;i++) {final=await b.getJobsRun(runs[0].id);if(final.state!=='RUNNING')break;await new Promise(resolve=>setTimeout(resolve,50));}
    assert.equal(final.state,'COMPLETED');assert.equal(final.result.createdCount,5);
    assert.equal((await b.startJobsRun('REMOTIVE',5,key)).id,final.id);assert.equal(calls,1);
    assert.equal((await b.startJobsRun('REMOTIVE',5,competingKey)).id,final.id);assert.equal(calls,1);
    assert.equal(await prisma.ingestionRun.count({where:{activeKey:'REMOTIVE'}}),0);
    console.log('PASS: ingestion run uniqueness across API instances, reload, final result and request replay');
  } finally {
    release();
    await new Promise(resolve=>setTimeout(resolve,100));
    await prisma.ingestionRun.deleteMany({where:{requestKey:{in:[key,competingKey]}}});
    await prisma.$disconnect();
  }
}
main().catch(()=>{console.error('Isolated ingestion run verification failed');process.exitCode=1;});
