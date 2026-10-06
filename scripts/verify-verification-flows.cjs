// Integration checks against the disposable fixture, never the deployed API.
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const {createHash}=require('crypto');
const root=path.resolve(__dirname,'..');
const current=JSON.parse(fs.readFileSync(path.join(root,'outputs/remaining-isolated/current.json')));
const directory=path.resolve(current.directory);
assert(directory.startsWith(path.join(root,'outputs','remaining-isolated')+path.sep));
const seed=JSON.parse(fs.readFileSync(path.join(directory,'seed.json')));
assert(seed.isolated && /^smartcareer_remaining_\d+$/.test(seed.database));
const base='http://127.0.0.1:4100/api';
const checks=[];
let phase='login';
async function call(route, token, method='GET', body) {
  const response=await fetch(base+route,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
  return {response,status:response.status,json:async()=>response.json()};
}
async function admin(email) {const r=await call('/auth/login',null,'POST',{email,password:'admin123'});assert.equal(r.status,201);return(await r.json()).token;}
async function company(number) {const r=await call('/auth/dev-callback',null,'POST',{provider:'google',role:'COMPANY',email:'company'+number+'@qa.invalid',fullName:'ISOLATED QA Company '+number});assert.equal(r.status,201);return(await r.json()).token;}
function passed(name){checks.push({name,passed:true});}
async function run(){
  const a=await admin('manual-admin@smartcareer.dev');const b=await admin('manual-admin2@smartcareer.dev');
  const first=await company(1);const second=await company(2);const empty=await company(13);
  phase='course-confirmation';
  for(const body of [{},{courseIds:[]},{courseIds:['invalid']},{courseIds:['00000000-0000-4000-8000-000000000000'],deleteAll:true}]) {
    assert.equal((await call('/ingestion/cleanup-closed-courses?provider=UDEMY&limit=10',a,'POST',body)).status,400);
  }
  const preview=await(await call('/ingestion/preview-closed-courses?provider=UDEMY&limit=10',a)).json();
  assert.equal(preview.scannedCount,2);assert.equal(preview.closedCount,1);assert.equal(preview.deletedCount,0);
  passed('Course preview keeps data and manual cleanup rejects omitted, empty, invalid or expanded selections');
  const raw=fs.readFileSync(seed.documentPath);
  const body={businessRegNo:'0000000000000',documents:{files:[{name:'qa-not-a-legal-document.png',type:'image/png',size:raw.length,dataUrl:'data:image/png;base64,'+raw.toString('base64')}]}};
  phase='ownership';
  const profile=await(await call('/company/profile',first)).json();
  const filePath=profile.verifications[0].documents.files[0].dataUrl.replace(/^\/api/,'');
  assert(!JSON.stringify(profile).includes('base64,'));
  const download=await call(filePath,first);
  assert.equal(download.status,200);
  assert.equal(download.response.headers.get('cache-control'),'private, no-store');
  assert.equal(download.response.headers.get('x-content-type-options'),'nosniff');
  assert(Buffer.from(await download.response.arrayBuffer()).equals(raw));
  assert.equal((await call(filePath,second)).status,404);
  assert.equal((await call(filePath,null)).status,401);
  passed('Company attachment exact bytes, no embedded content, private headers and cross-company/guest denial');
  assert.equal((await call('/company/applications?jobId='+seed.qaJobs[0].id,second)).status,404);
  const own=await(await call('/company/applications?jobId='+seed.qaJobs[1].id,second)).json();
  assert.equal(own.length,1);assert.equal(own[0].id,seed.qaJobs[1].applicationId);
  assert.equal((await call('/company/applications/'+seed.qaJobs[0].applicationId+'/status',second,'PUT',{status:'REVIEWING'})).status,403);
  passed('Separate company application list and foreign status update rejected');
  phase='submission';
  for(const invalid of [{businessRegNo:'123',documents:body.documents},{...body,documents:{files:[]}},{...body,documents:{files:[{...body.documents.files[0],size:1}]}}])assert.equal((await call('/company/verify',empty,'POST',invalid)).status,400);
  passed('Invalid registration, missing file and truncated bytes rejected');
  const submitted=await Promise.all([call('/company/verify',empty,'POST',body),call('/company/verify',empty,'POST',body)]);
  assert.deepEqual(submitted.map(x=>x.status).sort(),[201,409]);
  const request=await submitted.find(x=>x.status===201).json();
  passed('Concurrent submission creates one request and returns conflict for the duplicate');
  phase='review';
  for(const reason of ['', '123456789', 'Q'.repeat(2001)])assert.equal((await call('/admin/verifications/'+request.id+'/review',a,'PUT',{action:'REJECT',reason})).status,400);
  const rejected=await call('/admin/verifications/'+request.id+'/review',a,'PUT',{action:'REJECT',reason:'QAแก้ไข001'});assert.equal(rejected.status,200);
  const rejectedProfile=await(await call('/company/profile',empty)).json();
  assert.equal(rejectedProfile.verifications[0].rejectionReason,'QAแก้ไข001');assert.equal(rejectedProfile.verificationStatus,'REJECTED');
  const resubmit=await call('/company/verify',empty,'POST',body);assert.equal(resubmit.status,201);const replacement=await resubmit.json();assert.notEqual(replacement.id,request.id);
  assert.equal((await call('/admin/verifications/'+request.id+'/review',b,'PUT',{action:'APPROVE'})).status,409);
  passed('Reason boundaries, rejected result, new resubmission and stale review protection');
  const reviews=await Promise.all([call('/admin/verifications/'+replacement.id+'/review',a,'PUT',{action:'APPROVE'}),call('/admin/verifications/'+replacement.id+'/review',b,'PUT',{action:'REJECT',reason:'QA concurrent loser'})]);
  assert.deepEqual(reviews.map(x=>x.status).sort(),[200,409]);
  const accepted=await reviews.find(x=>x.status===200).json();
  const finalProfile=await(await call('/company/profile',empty)).json();
  assert.equal(finalProfile.verificationStatus,accepted.status);assert.equal(finalProfile.verifications[0].reviewedBy,accepted.reviewedBy);
  const notifications=await(await call('/notifications?limit=25',empty)).json();
  assert((notifications.items||notifications).filter(x=>x.metadata?.verificationId===replacement.id).length===1);
  passed('Two independent administrators cannot overwrite one decision or send duplicate notifications');
  checks.push({name:'Fixture lifecycle',passed:true,company13FinalStatus:accepted.status,downloadSha256:createHash('sha256').update(raw).digest('hex')});
}
run().then(()=>{fs.writeFileSync(path.join(directory,'integration-result.json'),JSON.stringify({isolated:true,productionOAuthTested:false,checks},null,2));console.log('PASS: '+checks.length+' isolated verification integration checks');}).catch(error=>{fs.writeFileSync(path.join(directory,'integration-result.json'),JSON.stringify({isolated:true,checks,failedPhase:phase,errorClass:error.name},null,2));console.error('FAIL: isolated verification check at '+phase);process.exitCode=1;});
