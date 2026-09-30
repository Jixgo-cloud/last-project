const { execSync } = require('child_process');
const cheerio = require('cheerio');

const url = 'https://th.jobsdb.com/job/94619751';
const html = execSync(`curl.exe -s -L "${url}" -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"`, { maxBuffer: 10 * 1024 * 1024 }).toString();

const reduxMatch = html.match(/window\.SEEK_REDUX_DATA\s*=\s*(\{.*?\});/s);
if (reduxMatch) {
  const data = JSON.parse(reduxMatch[1]);
  const job = data?.jobdetails?.result?.job;
  console.log('Title:', job.title);
  console.log('Company:', job.advertiser?.description);
  console.log('Location:', job.location);
  console.log('Bullet points:', job.bulletPoints);
  
  const $content = cheerio.load(job.content || '');
  console.log('Content plain text:\n', $content.text().slice(0, 1000));
}
