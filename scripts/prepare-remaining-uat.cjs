// Disposable local manual UAT fixture. Never connects to the deployed database.
// Start: node scripts/prepare-remaining-uat.cjs
// Stop: create `stop` in the directory recorded by outputs/remaining-isolated/current.json.
// Provider login is simulated for local workflow checks; it never proves real OAuth signup.
const fs = require('fs');
const path = require('path');
const http = require('http');
const net = require('net');
const assert = require('assert/strict');
const { spawn, spawnSync } = require('child_process');
const { randomBytes, createHash } = require('crypto');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const root = path.resolve(__dirname, '..');
const rootConfig = dotenv.parse(fs.readFileSync(path.join(root, '.env')));
const local = new URL(rootConfig.DATABASE_URL);
assert(['localhost', '127.0.0.1', '[::1]'].includes(local.hostname), 'Only local PostgreSQL is permitted');
const name = 'smartcareer_remaining_' + Date.now();
const target = new URL(local); target.pathname = '/' + name;
assert(/^smartcareer_remaining_\d+$/.test(name));
const dir = path.join(root, 'outputs', 'remaining-isolated', name);
fs.mkdirSync(dir, { recursive: true });
const environment = {};
for (const key of ['PATH','Path','SystemRoot','WINDIR','TEMP','TMP','HOME','USERPROFILE','APPDATA','LOCALAPPDATA','COMSPEC','PATHEXT']) if (process.env[key]) environment[key] = process.env[key];
// Blank every app dotenv key so the fixture cannot inherit provider credentials.
for (const file of ['.env','apps/api/.env','apps/web/.env','apps/web/.env.local']) {
  const full = path.join(root,file);
  if (fs.existsSync(full)) for (const key of Object.keys(dotenv.parse(fs.readFileSync(full)))) environment[key] = '';
}
Object.assign(environment, {
  DATABASE_URL: target.href, DIRECT_URL: target.href, JWT_SECRET: randomBytes(48).toString('hex'),
  NODE_ENV:'development', ENABLE_DEV_MOCK_AUTH:'true', NEXT_PUBLIC_SHOW_DEMO_LOGIN:'true',
  PORT:'4100', FRONTEND_URL:'http://localhost:3100', API_URL:'http://127.0.0.1:4101/api',
  NEXT_PUBLIC_API_URL:'http://127.0.0.1:4101/api', NEXT_TELEMETRY_DISABLED:'1',
  JUDGE0_BASE_URL:'http://127.0.0.1:42359', JUDGE0_API_KEY:'', RAPIDAPI_KEY:'',
  INGESTION_CONFIG_DIR:path.join(dir,'ingestion-config'), JWT_EXPIRES_IN:'1h',
});
const parent = new PrismaClient({datasources:{db:{url:local.href}}});
const db = new PrismaClient({datasources:{db:{url:target.href}}});
const children = []; const servers = []; let app; let created = false;
const stats = { database:name, isolated:true, sourceRevision:spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',windowsHide:true}).stdout.trim(), verificationFailureResponses:0, verificationSuccessResponses:0, judgeFailures:0, cleanedUp:false };
stats.sourceDiffSha256 = createHash('sha256').update(spawnSync('git',['diff','HEAD'],{cwd:root,encoding:'utf8',windowsHide:true}).stdout).digest('hex');
async function free(port) { await new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',()=>reject(new Error('Fixture port already in use')));s.listen(port,'127.0.0.1',()=>s.close(resolve));}); }
async function listen(server,port) {servers.push(server);await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));}
function json(res,status,data) {res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(data));}
function launch(label,args,cwd) {const fd=fs.openSync(path.join(dir,label+'.log'),'w');const child=spawn(process.execPath,args,{cwd,env:environment,windowsHide:true,stdio:['ignore',fd,fd]});fs.closeSync(fd);children.push(child);return child;}
async function main() {
  stats.phase='ports';
  for (const port of [3100,4100,4101,42359]) await free(port);
  stats.phase='local-database-connection';
  stats.parentCountsBefore={users:await parent.user.count(),jobs:await parent.job.count(),attempts:await parent.assessmentAttempt.count()};
  await parent.$executeRawUnsafe(`CREATE DATABASE "${name}"`);created=true;
  stats.phase='schema';
  const schema=spawnSync(process.execPath,[path.join(root,'node_modules/prisma/build/index.js'),'db','push','--schema',path.join(root,'prisma/schema.prisma'),'--skip-generate'],{cwd:root,env:environment,windowsHide:true,encoding:'utf8'});
  assert.equal(schema.status,0,'Isolated schema initialization failed');
  stats.phase='seed';
  await db.user.create({data:{email:'manual-admin@smartcareer.dev',passwordHash:await bcrypt.hash('admin123',10),role:'ADMIN'}});
  
  const sharp = require('sharp');
  const png = await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="900" height="400"><rect width="900" height="400" fill="white"/><text x="45" y="90" font-family="Arial" font-size="38" fill="red">QA TEST ONLY - NOT A LEGAL DOCUMENT</text><text x="45" y="170" font-family="Arial" font-size="27">Disposable local verification workflow fixture</text><text x="45" y="230" font-family="Arial" font-size="24">No real company, registration or personal information</text></svg>')).png().toBuffer();
  const documentPath = path.join(dir, 'qa-not-a-legal-document.png');
  fs.writeFileSync(documentPath, png);
  const documents = {files:[{name:'qa-not-a-legal-document.png',type:'image/png',size:png.length,dataUrl:'data:image/png;base64,'+png.toString('base64')}]};
  stats.documentPath = documentPath;
  stats.qaCompanies = [];
  for (let i=1;i<=13;i++) {
    const company = await db.company.create({data:{name:'ISOLATED QA Company '+i,slug:'isolated-qa-'+i}});
    const user = await db.user.create({data:{email:'company'+i+'@qa.invalid',role:'COMPANY',companyMembers:{create:{companyId:company.id,role:'OWNER'}}}});
    stats.qaCompanies.push({id:company.id,userId:user.id,email:user.email});
    if (i<=11) await db.companyVerification.create({data:{companyId:company.id,businessRegNo:'0000000000000',documents,status:i===10?'REJECTED':i===11?'VERIFIED':'PENDING',rejectionReason:i===10?'QA fixture rejected - test only':null,createdAt:new Date(Date.now()-i*1000)}});
    if(i===10 || i===11) await db.company.update({where:{id:company.id},data:{verificationStatus:i===10?'REJECTED':'VERIFIED'}});
  }
  await db.user.create({data:{email:'manual-admin2@smartcareer.dev',passwordHash:await bcrypt.hash('admin123',10),role:'ADMIN'}});
  const candidate = await db.user.create({data:{email:'candidate@qa.invalid',role:'CANDIDATE',candidateProfile:{create:{fullName:'ISOLATED QA Candidate'}}},include:{candidateProfile:true}});
  stats.qaJobs=[];
  for (const c of stats.qaCompanies.slice(0,2)) {
    const job=await db.job.create({data:{companyId:c.id,companyName:'ISOLATED QA Company',title:'ISOLATED QA job '+c.email,slug:'qa-job-'+c.id,description:'Disposable isolated UI test. No actual recruitment.'}});
    const application=await db.jobApplication.create({data:{jobId:job.id,candidateId:candidate.candidateProfile.id,coverLetter:'QA only'}});
    stats.qaJobs.push({id:job.id,applicationId:application.id});
  }
  const deleteJob=await db.job.create({data:{companyId:stats.qaCompanies[0].id,companyName:'ISOLATED QA Company 1',title:'ISOLATED-QA-DELETE-JOB',slug:'qa-delete-job',description:'Disposable deletion test only'}});
  stats.deleteJobId=deleteJob.id;
  await db.course.create({data:{title:'ISOLATED-QA-MISSING-COURSE',provider:'UDEMY',url:'http://127.0.0.1:42359/missing-course'}});
  await db.course.create({data:{title:'ISOLATED-QA-LIVE-COURSE',provider:'UDEMY',url:'http://127.0.0.1:42359/live-course'}});
  const skill=await db.skill.create({data:{name:'JavaScript',slug:'javascript',category:'FRONTEND'}});
  const exam=await db.assessment.create({data:{title:'ISOLATED-JUDGE-UNAVAILABLE-QA',slug:'isolated-judge-unavailable-qa',type:'PRACTICAL_CODING',skillId:skill.id,timeLimitMinutes:30,questions:{create:{title:'Add two numbers (isolated QA)',prompt:'Manual QA only. Return a + b. The isolated Judge service intentionally returns 503.',points:50,starterCode:'function solution(a, b) { return a + b; }',testCases:[{input:'[2,3]',expectedOutput:'5',isHidden:false},{input:'[10,20]',expectedOutput:'30',isHidden:true}]}}}});
  stats.assessmentId=exam.id;
  const deleteExam=await db.assessment.create({data:{title:'ISOLATED-QA-DELETE-EXAM',slug:'qa-delete-exam',type:'THEORY',companyId:stats.qaCompanies[0].id,timeLimitMinutes:10,questions:{create:{title:'QA only',prompt:'Pick QA',points:50,choices:{create:[{text:'QA',isCorrect:true},{text:'Other',isCorrect:false}]}}}}});
  stats.deleteAssessmentId=deleteExam.id;
  await listen(http.createServer((req,res)=>{if(req.url==='/missing-course'){res.writeHead(404);res.end('QA course missing');return;} if(req.url==='/live-course'){res.writeHead(200,{'content-type':'text/html'});res.end('<h1>QA course active</h1>');return;} stats.judgeFailures++;json(res,503,{message:'Isolated Judge fixture unavailable'});}),42359);
  let failVerification=false;
  await listen(http.createServer(async(req,res)=>{
    if (req.method==='GET' && req.url.startsWith('/api/admin/verifications')) {
      if (failVerification) {failVerification=false;stats.verificationFailureResponses++;json(res,503,{message:'โหลดรายการไม่สำเร็จ (ระบบ QA แยก) กรุณาลองใหม่'});return;}
      stats.verificationSuccessResponses++;
    }
    try {
      const upstream=http.request({hostname:'127.0.0.1',port:4100,path:req.url,method:req.method,headers:req.headers},result=>{res.writeHead(result.statusCode,result.headers);result.pipe(res);});
      upstream.on('error',()=>json(res,502,{message:'Isolated API unavailable'}));req.pipe(upstream);
    } catch {json(res,500,{message:'Isolated proxy error'});}
  }),4101);
  // API bootstrap binds only loopback and uses the compiled application services.
  Object.assign(process.env,environment);
  stats.phase='api-start';
  const { NestFactory } = require('@nestjs/core');
  const { ValidationPipe } = require('@nestjs/common');
  const { AppModule } = require('../apps/api/dist/app.module');
  const express=require('express');
  app=await NestFactory.create(AppModule,{logger:false});
  app.use(express.json({limit:'10mb'}));app.use(express.urlencoded({extended:true,limit:'10mb'}));
  app.setGlobalPrefix('api');app.enableCors({origin:'http://localhost:3100',credentials:true});
  app.useGlobalPipes(new ValidationPipe({whitelist:true,transform:true,forbidNonWhitelisted:true}));
  await app.listen(4100,'127.0.0.1');
  stats.phase='web-copy';
  const web=path.join(dir,'web');
  fs.cpSync(path.join(root,'apps/web'),web,{recursive:true,filter:src=>!path.relative(path.join(root,'apps/web'),src).split(path.sep).some(part=>part==='.next'||part==='node_modules'||part==='.vercel'||part.startsWith('.env'))});
  fs.symlinkSync(path.join(root,'apps/web/node_modules'),path.join(web,'node_modules'),'junction');
  stats.phase='web-start';
  const child=launch('web',[path.join(root,'node_modules/next/dist/bin/next'),'dev','-p','3100','-H','127.0.0.1'],web);
  for(let i=0;i<50;i++){assert(child.exitCode===null,'Isolated web exited');try{const r=await fetch('http://localhost:3100/login',{signal:AbortSignal.timeout(1500)});if(r.ok)break;}catch{}await new Promise(resolve=>setTimeout(resolve,500));}
  assert((await fetch('http://localhost:3100/login')).ok,'Isolated web failed to start');
  fs.writeFileSync(path.join(dir,'seed.json'),JSON.stringify(stats,null,2));
  fs.writeFileSync(path.join(dir,'ready.json'),JSON.stringify({url:'http://localhost:3100',assessmentId:exam.id,database:name,isolated:true}));
  fs.writeFileSync(path.join(root,'outputs/remaining-isolated/current.json'),JSON.stringify({directory:dir,url:'http://localhost:3100',assessmentId:exam.id}));
  console.log('READY: isolated UAT UI at http://localhost:3100; fixture metadata saved privately');
  await new Promise(resolve=>{const timer=setInterval(()=>{if(fs.existsSync(path.join(dir,'stop'))){clearInterval(timer);resolve();}},500);});
  stats.verifications=await db.companyVerification.findMany({select:{id:true,companyId:true,status:true,rejectionReason:true,reviewedBy:true}}); stats.courses=await db.course.findMany({select:{id:true,title:true}}); stats.notifications=await db.notification.count(); stats.jobsRemaining=await db.job.findMany({select:{id:true,title:true}}); stats.assessmentsRemaining=await db.assessment.findMany({select:{id:true,title:true}});
  stats.attempts=await db.assessmentAttempt.findMany({select:{id:true,status:true,score:true,draftCode:true}});
}
main().catch(error=>{stats.error='Isolated fixture failed; no production connection attempted';stats.errorClass=error.name;stats.errorCode=error.code;console.error(JSON.stringify({error:stats.error,phase:stats.phase,errorClass:stats.errorClass,errorCode:stats.errorCode}));process.exitCode=1;}).finally(async()=>{
  for(const child of children)if(child.exitCode===null)spawnSync('taskkill',['/pid',String(child.pid),'/t','/f'],{windowsHide:true,stdio:'ignore'});
  if(app)await app.close();
  for(const s of servers)await new Promise(resolve=>s.close(resolve));
  await db.$disconnect();
  if(created){assert(/^smartcareer_remaining_\d+$/.test(name));await parent.$executeRawUnsafe('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()',name);await parent.$executeRawUnsafe(`DROP DATABASE "${name}"`);stats.cleanedUp=true;}
  stats.parentCountsAfter={users:await parent.user.count(),jobs:await parent.job.count(),attempts:await parent.assessmentAttempt.count()};
  await parent.$disconnect();fs.writeFileSync(path.join(dir,'result.json'),JSON.stringify(stats,null,2));console.log('Isolated fixture stopped and cleanup recorded');
});
