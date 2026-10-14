const test = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios').default;
const { IngestionService } = require('../apps/api/dist/ingestion/ingestion.service');
const { youtubeDurationFromIso } = require('../apps/api/dist/ingestion/youtube-duration');

function harness(t, prisma = {}) {
  const original = axios.get;
  const key = process.env.YOUTUBE_API_KEY;
  process.env.YOUTUBE_API_KEY = 'qa-placeholder-key';
  t.after(() => { axios.get = original; if (key === undefined) delete process.env.YOUTUBE_API_KEY; else process.env.YOUTUBE_API_KEY = key; });
  const service = new IngestionService(prisma, {}, {});
  service.logger = { log() {}, warn() {}, error() {} };
  return service;
}
const id = 'bMknfKXIFA8';
const video = (videoId = id) => ({ id: videoId, snippet: {title: 'React course', description: 'React lessons', channelTitle: 'QA Channel', publishedAt: '2026-01-01T00:00:00Z', liveBroadcastContent: 'none', thumbnails: {high:{url:'https://example.test/thumb.jpg'}}}, contentDetails:{duration:'PT1H2M3S'}, status:{privacyStatus:'public'} });

test('ISO duration uses real hours/minutes/seconds, rejecting unknown or zero duration', () => {
  assert.equal(youtubeDurationFromIso('PT1H2M3S'), '1 ชั่วโมง 2 นาที 3 วินาที');
  assert.equal(youtubeDurationFromIso('P1DT1H'), '25 ชั่วโมง');
  for (const value of [null, '', 'PT0S', 'P', 'invalid', 'PT-1S']) assert.equal(youtubeDurationFromIso(value), null);
});

test('Search sends skill and key, then maps video details without inventing ratings', async t => {
  const service = harness(t);
  const calls = [];
  axios.get = async (url, options) => {
    calls.push({url,options});
    return {data: {items: url.endsWith('/search') ? [{id:{videoId:id}}, {id:{videoId:id}}] : [video()]}};
  };
  const result = await service.fetchYouTubeCourses(10, 'React');
  assert.equal(calls.length, 2);
  assert.equal(calls[0].options.params.key, 'qa-placeholder-key');
  assert.match(calls[0].options.params.q, /React/);
  assert.equal(calls[0].options.params.type, 'video');
  assert.equal(calls[1].options.params.id, id);
  assert.equal(calls[1].options.params.part, 'snippet,contentDetails,status');
  assert.equal(result.length, 1);
  assert.equal(result[0].externalId, id);
  assert.equal(result[0].duration, '1 ชั่วโมง 2 นาที 3 วินาที');
  assert.equal(result[0].rating, null);
  assert.equal(result[0].source, 'QA Channel');
  assert.equal(result[0].publishedAt.toISOString(), '2026-01-01T00:00:00.000Z');
});

test('Paginates beyond 50 results and never repeats a video', async t => {
  const service = harness(t);
  const ids = Array.from({length:51}, (_, i) => `qa${String(i).padStart(9,'0')}`);
  let searches = 0;
  axios.get = async (url, {params}) => {
    if (url.endsWith('/videos')) return {data:{items: params.id.split(',').map(video)}};
    searches++;
    assert(params.maxResults <= 50);
    return {data: params.pageToken ? {items:[{id:{videoId:ids[50]}}]} : {items:ids.slice(0,50).map(videoId=>({id:{videoId}})), nextPageToken:'next'}};
  };
  assert.equal((await service.fetchYouTubeCourses(51, 'Docker')).length, 51);
  assert.equal(searches, 2);
});

test('Successful empty search stays empty; private/live/missing videos are excluded', async t => {
  const service = harness(t);
  service.fetchYouTubeCatalog = async () => assert.fail('Empty results must not become unrelated fallback courses');
  axios.get = async () => ({data:{items:[]}});
  assert.deepEqual(await service.fetchYouTubeCourses(5, 'React'), []);
  for (const bad of [{...video(), status:{privacyStatus:'private'}}, {...video(), snippet:{...video().snippet,liveBroadcastContent:'live'}}, {...video(),contentDetails:{duration:'PT0S'}}, null]) {
    axios.get = async url => ({data:{items:url.endsWith('/search') ? [{id:{videoId:id}}] : bad ? [bad] : []}});
    assert.deepEqual(await service.fetchYouTubeCourses(5, 'React'), []);
  }
});

test('Missing key and search/detail failures use the old catalog without logging credentials', async t => {
  const service = harness(t);
  const warnings = [];
  service.logger.warn = text => warnings.push(text);
  service.fetchYouTubeCatalog = async (limit, skill) => { assert.equal(skill,'Docker'); return [{externalId:'legacy'}]; };
  for (const failAt of ['missing','search','videos']) {
    if (failAt === 'missing') delete process.env.YOUTUBE_API_KEY;
    else process.env.YOUTUBE_API_KEY = 'qa-placeholder-key';
    axios.get = async url => {
      if (failAt === 'missing') assert.fail('No request without key');
      if (url.endsWith('/'+failAt)) throw new Error('qa-placeholder-key secret-bearing upstream failure');
      return {data:{items:[{id:{videoId:id}}]}};
    };
    assert.equal((await service.fetchYouTubeCourses(5,'Docker'))[0].externalId,'legacy');
  }
  assert(!warnings.join(' ').includes('qa-placeholder-key'));
});

test('Repeated sync reuses legacy URL IDs, saves new courses and links target skill', async t => {
  const rows = [{id:'legacy',externalId:'yt-old-react',provider:'YOUTUBE',url:`https://www.youtube.com/watch?v=${id}`,duration:null}];
  const links = [];
  const prisma = {
    skill:{findUnique:async()=>({id:'react',name:'React'}), findMany:async()=>[]},
    course:{
      findFirst:async ({where})=> rows.find(row=>row.provider===where.provider && where.OR.some(condition=>Object.entries(condition).every(([k,v])=>row[k]===v))),
      create:async ({data})=>{const row={...data,id:'new'};rows.push(row);return row;},
      update:async ({where,data})=>Object.assign(rows.find(row=>row.id===where.id),data),
    },
    courseSkill:{upsert:async args=>links.push(args)},
    ingestionLog:{create:async ({data})=>data},
  };
  const service = harness(t, prisma);
  const newId='fqMOX6JJhGo';
  axios.get = async url => ({data:{items:url.endsWith('/search') ? [id,newId].map(videoId=>({id:{videoId}})) : [video(),video(newId)]}});
  const first = await service.syncCourses('YOUTUBE',2,'react');
  assert.equal(first.createdCount,1); assert.equal(first.duplicateCount,1); assert.equal(first.updatedCount,1);
  const second = await service.syncCourses('YOUTUBE',2,'react');
  assert.equal(second.createdCount,0); assert.equal(second.duplicateCount,2);
  assert.equal(rows.length,2); assert.equal(links.length,4);
  assert(rows[1].publishedAt instanceof Date);
});

test('A later API failure keeps fetched courses and merges fallback without duplicate URLs', async t => {
  const service = harness(t);
  let searches = 0;
  axios.get = async url => {
    if (url.endsWith('/videos')) return {data:{items:[video()]}};
    if (++searches > 1) throw new Error('quota exhausted');
    return {data:{items:[{id:{videoId:id}}],nextPageToken:'next'}};
  };
  service.fetchYouTubeCatalog = async () => [
    {externalId:'old-id',url:`https://www.youtube.com/watch?v=${id}`},
    {externalId:'other',url:'https://www.youtube.com/watch?v=fqMOX6JJhGo'},
  ];
  const result = await service.fetchYouTubeCourses(2,'React');
  assert.equal(result.length,2);
  assert.equal(result[0].externalId,id);
  assert.equal(result[1].externalId,'other');
});

test('Provider tags normalize optional labels and omit malformed values', () => {
  const {sourceTags, udemySourceTags} = require('../apps/api/dist/ingestion/course-source-tags');
  assert.deepEqual(sourceTags([' React ', 'react', null, 12, {}, '']), ['react']);
  assert.deepEqual(udemySourceTags({course_has_labels:[{label:{display_name:'React'}}],primary_subcategory:{title:'Web Development'},topics:[{title:'TypeScript'}]}), ['TypeScript','React','Web Development']);
  assert.deepEqual(udemySourceTags({}), []);
});

test('YouTube provider tags link existing courses even without title evidence and preserve explicit weights', async t => {
  const links = []; const upgrades = [];
  const service = harness(t, {
    skill:{findMany:async()=>[{id:'react',name:'React'},{id:'java',name:'Java'}]},
    course:{findFirst:async()=>({id:'old',title:'Lesson',description:'',url:`https://www.youtube.com/watch?v=${id}`,duration:'1 ชั่วโมง 2 นาที 3 วินาที'})},
    courseSkill:{upsert:async x=>links.push(x),updateMany:async x=>upgrades.push(x)},
    ingestionLog:{create:async ({data})=>data},
  });
  const v = video(); v.snippet.tags = ['ReactJS tutorial','JavaScript'];
  axios.get = async url=>({data:{items:url.endsWith('/search')?[{id:{videoId:id}}]:[v]}});
  const mapped = await service.fetchYouTubeCourses(1);
  assert.deepEqual(mapped[0].sourceTags, v.snippet.tags);
  const result = await service.syncCourses('YOUTUBE',1);
  assert.equal(result.duplicateCount,1);
  assert.equal(result.errorCount,0);
  assert.deepEqual(links.map(x=>x.create.skillId),['react']);
  assert.equal(upgrades[0].where.relevanceScore,0.9);
  assert.equal(upgrades[0].data.relevanceScore,0.95);
});

test('Udemy requests expanded metadata and maps source labels without inventing absent tags', async t => {
  const service = harness(t);
  const saved = [process.env.UDEMY_CLIENT_ID,process.env.UDEMY_CLIENT_SECRET];
  process.env.UDEMY_CLIENT_ID='qa-id';process.env.UDEMY_CLIENT_SECRET='qa-secret';
  t.after(()=>{for(const [i,key] of ['UDEMY_CLIENT_ID','UDEMY_CLIENT_SECRET'].entries()){if(saved[i]===undefined) delete process.env[key]; else process.env[key]=saved[i];}});
  axios.get = async (_url,options)=>{
    assert.equal(options.params['fields[course]'],'@all');
    return {data:{results:[{id:1,title:'Lesson',url:'/course/lesson/',course_has_labels:[{label:{display_name:'Docker'}}]},{id:2,title:'Other',url:'/course/other/'}]}};
  };
  const result = await service.fetchUdemyCourses('Docker',2);
  assert.deepEqual(result[0].sourceTags,['Docker']);
  assert.deepEqual(result[1].sourceTags,[]);
});

test('Udemy rejects placeholder credentials locally and reports permission failures without leaking secrets', async t => {
  const service = harness(t); const warnings=[]; service.logger.warn=m=>warnings.push(m);
  const saved=[process.env.UDEMY_CLIENT_ID,process.env.UDEMY_CLIENT_SECRET];
  t.after(()=>{for(const [i,key] of ['UDEMY_CLIENT_ID','UDEMY_CLIENT_SECRET'].entries()){if(saved[i]===undefined)delete process.env[key];else process.env[key]=saved[i];}});
  process.env.UDEMY_CLIENT_ID='your_client_id';process.env.UDEMY_CLIENT_SECRET='your_client_secret';
  axios.get=async()=>assert.fail('Do not send placeholder credentials');
  await service.fetchUdemyCourses('React',1);
  assert(warnings.some(m=>m.includes('Placeholder credentials')));
  process.env.UDEMY_CLIENT_ID=' qa-real-id ';process.env.UDEMY_CLIENT_SECRET=' qa-real-secret ';
  axios.get=async(_url,options)=>{assert.equal(options.headers.Accept,'application/json');assert.equal(options.headers.Authorization,'Basic '+Buffer.from('qa-real-id:qa-real-secret').toString('base64'));throw {response:{status:403},message:'qa-real-secret'};};
  await service.fetchUdemyCourses('React',1);
  assert(warnings.some(m=>m.includes('Access denied (403)')));
  assert(!warnings.join(' ').includes('qa-real-secret'));
});
