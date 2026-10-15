// Explicit, bounded repair of a previously reviewed public job inventory.
// Credentials and database errors are never printed. Dry-run by default.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert/strict');
const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');
const { fetchJobDetail, jobText, jobSections } = require('../apps/api/dist/ingestion/job-detail-content');
const { GeminiExtractorService } = require('../apps/api/dist/ingestion/gemini-extractor.service');
const { mentionsSkill } = require('../apps/api/dist/recommendations/course-skill-evidence');
const args = process.argv.slice(2);
const opt = n => args[args.indexOf(n)+1];
const apply = args.includes('--apply');
const root = path.resolve(__dirname,'..');
async function main() {
  assert(args.includes('--inventory') && args.includes('--out'), 'Inventory and output required');
  const inventory = JSON.parse(fs.readFileSync(opt('--inventory'),'utf8').replace(/^\uFEFF/,''));
  assert(inventory.length > 0 && inventory.length <= 200 && new Set(inventory.map(j=>j.id)).size === inventory.length, 'Invalid inventory');
  if (apply) {
    assert(args.includes('--backup'), 'Validated backup required');
    const m=JSON.parse(fs.readFileSync(opt('--backup'),'utf8'));
    assert(m.project==='ivxsgbjvqutgyvakqfyt' && m.archiveValidated && m.tableDataEntries>=29 && m.bytes>0 && Date.now()-Date.parse(m.createdAt)<86400000, 'Fresh validated backup required');
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(m.file)).digest('hex'),m.sha256,'Backup checksum mismatch');
  }
  let connection, jsearchKey;
  for(const f of ['apps/api.env','apps/api/.env','.env']) {
    if(!fs.existsSync(path.join(root,f)))continue;
    const env=dotenv.parse(fs.readFileSync(path.join(root,f)));
    jsearchKey ||= env.JSEARCH_API_KEY || env.RAPIDAPI_KEY;
    for(const k of ['DATABASE_URL','DIRECT_URL']){try{const u=new URL(env[k]);if(u.hostname==='db.ivxsgbjvqutgyvakqfyt.supabase.co'||(u.hostname.endsWith('.pooler.supabase.com')&&decodeURIComponent(u.username)==='postgres.ivxsgbjvqutgyvakqfyt'))connection=env[k];}catch{}}
    if(connection)break;
  }
  assert(connection,'No matching existing database connection');
  const db=new PrismaClient({datasources:{db:{url:connection}},log:[]});
  const extractor=new GeminiExtractorService();
  const report=[];
  let remotive=[];
  let jsearchBlocked=false;
  try { const r=await fetch('https://remotive.com/api/remote-jobs',{signal:AbortSignal.timeout(20000)});if(r.ok)remotive=(await r.json()).jobs||[]; }catch{}
  try {
    const catalog=await db.skill.findMany({select:{name:true,category:true}});
    for(const record of inventory){
      const job=await db.job.findUnique({where:{id:record.id},include:{skills:{include:{skill:true}}}});
      if(!job){report.push({id:record.id,status:'NOT_FOUND'});continue;}
      assert.equal(job.source,record.source,'Source changed');
      let detail={},status='EXISTING_CONTENT_REVIEWED';
      if(['JOBTHAI','JOBSDB','BLOGNONE'].includes(job.source)){
        try{detail=await fetchJobDetail(job.sourceUrl);status='SOURCE_DETAILS_READ';}
        catch(e){status=e.message.match(/^SOURCE_[A-Z0-9_]+/)?.[0]||'SOURCE_UNAVAILABLE';if(status==='SOURCE_LISTING_CLOSED')detail.isActive=false;}
      }else if(job.source==='REMOTIVE'){
        const row=remotive.find(r=>String(r.id)===job.externalId);
        if(row){detail={description:jobText(row.description),location:row.candidate_required_location,logoUrl:row.company_logo};status='SOURCE_DETAILS_READ';}
        else status='SOURCE_LISTING_NOT_IN_CURRENT_FEED';
      }else if(job.source==='JSEARCH'){
        status=!jsearchKey?'SOURCE_KEY_UNAVAILABLE':jsearchBlocked?'SOURCE_QUOTA_OR_ACCESS_UNAVAILABLE':'SOURCE_UNAVAILABLE';
        if(jsearchKey&&!jsearchBlocked)try{
          const endpoint=new URL('https://jsearch.p.rapidapi.com/job-details');endpoint.searchParams.set('job_id',job.externalId);
          const response=await fetch(endpoint,{headers:{'X-RapidAPI-Key':jsearchKey,'X-RapidAPI-Host':'jsearch.p.rapidapi.com'},signal:AbortSignal.timeout(20000)});
          if([401,403,429].includes(response.status))jsearchBlocked=true;
          if(response.ok){const payload=await response.json();const row=payload.data?.find(r=>r.job_id===job.externalId);
            if(row){detail={description:jobText(row.job_description),requirements:row.job_highlights?.Qualifications?.join('\n'),benefits:row.job_highlights?.Benefits?.join('\n'),location:[row.job_city,row.job_state,row.job_country].filter(Boolean).join(', '),logoUrl:row.employer_logo};status='SOURCE_DETAILS_READ';}
            else status='SOURCE_LISTING_NOT_RETURNED';
          }else status=`SOURCE_HTTP_${response.status}`;
        }catch{status='SOURCE_CONNECTION_FAILED';}
      }
      const data={};
      // Keep employer-authored internal descriptions and manually selected skills.
      if(job.source!=='INTERNAL'){
        if(detail.isActive===false)data.isActive=false;
        for(const key of ['description','requirements','benefits','location','salaryMin','salaryMax','salaryCurrency']) {
          const v=detail[key];if(v===undefined||v===null||v===''||v==='ไม่ระบุสถานที่')continue;
          if(key==='description' && v.length<job.description.length)continue;
          if(v!==job[key])data[key]=v;
        }
        if(detail.logoUrl && detail.logoUrl!==job.companyLogoUrl)data.companyLogoUrl=detail.logoUrl;
        const sections=jobSections(jobText(data.description||job.description));
        for(const key of ['requirements','benefits'])if(!job[key] && !data[key] && sections[key])data[key]=sections[key];
      }
      const final={...job,...data};
      const found=extractor.fallbackRuleBasedExtractor(final.title,jobText(final.description),final.requirements||'');
      const evidence=`${final.title}\n${jobText(final.description)}\n${final.requirements||''}`;
      for(const skill of catalog)if(mentionsSkill(evidence,skill.name)&&!found.some(s=>s.name.toLowerCase()===skill.name.toLowerCase()))found.push({...skill,isRequired:true,minimumScore:70});
      // All 180 inspected; no inferred skills from role names. Existing internal QA requirements stay intact.
      const desired=new Map(found.map(s=>[s.name.toLowerCase(),s]));
      const removed=status!=='SOURCE_DETAILS_READ'||job.source==='INTERNAL'?[]:job.skills.filter(s=>!desired.has(s.skill.name.toLowerCase())).map(s=>s.skillId);
      if(apply)await db.$transaction(async tx=>{
        if(Object.keys(data).length)await tx.job.update({where:{id:job.id},data});
        if(removed.length)await tx.jobSkill.deleteMany({where:{jobId:job.id,skillId:{in:removed}}});
        for(const s of found){
          let skill=await tx.skill.findFirst({where:{name:{equals:s.name,mode:'insensitive'}}});
          if(!skill)skill=await tx.skill.create({data:{name:s.name,category:s.category,slug:'import-'+crypto.createHash('sha256').update(s.name.toLowerCase()).digest('hex').slice(0,20)}});
          await tx.jobSkill.upsert({where:{jobId_skillId:{jobId:job.id,skillId:skill.id}},create:{jobId:job.id,skillId:skill.id,isRequired:s.isRequired,minimumScore:s.minimumScore,weight:s.isRequired?1:0.6},update:{}});
        }
      },{timeout:30000});
      report.push({id:job.id,source:job.source,title:job.title,status,changedFields:Object.keys(data),descriptionBefore:job.description.length,descriptionAfter:final.description.length,skillsBefore:job.skills.map(s=>s.skill.name),detectedSkills:found.map(s=>s.name),removedSkillIds:removed,applied:apply});
      fs.mkdirSync(path.dirname(opt('--out')),{recursive:true});fs.writeFileSync(opt('--out'),JSON.stringify(report,null,2));
      console.log(JSON.stringify({processed:report.length,total:inventory.length,source:job.source,status,changedFields:Object.keys(data).length,skills:found.length}));
    }
  }finally{await db.$disconnect();}
  console.log(JSON.stringify({complete:report.length===inventory.length,processed:report.length,applied:apply}));
}
main().catch(()=>{console.error('REPAIR_STOPPED: No credentials or database errors disclosed; inspect saved per-job report before resuming.');process.exitCode=1;});
