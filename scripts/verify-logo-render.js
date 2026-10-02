const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '..', 'apps', 'web', '.next', 'server', 'app', 'index.html');
const content = fs.readFileSync(htmlPath, 'utf8');

console.log('--- LOGO RENDERING AUDIT ---');
console.log('HTML Total Size:', content.length, 'bytes');
console.log('Includes Coalition logo URL:', content.includes('remotive.com/job/1749306/logo'));
console.log('Includes IAPWE logo URL:', content.includes('remotive.com/job/1185979/logo'));
console.log('Includes Unio Digital logo URL:', content.includes('remotive.com/job/2091045/logo'));
console.log('Includes Credit Wellness logo URL:', content.includes('remotive.com/job/2086540/logo'));
console.log('Includes iMerit logo URL:', content.includes('remotive.com/job/2091126/logo'));

const imgMatches = content.match(/<img[^>]+src="https:\/\/remotive\.com[^"]+"[^>]*>/g) || [];
console.log('\nTotal real logo <img> tags rendered in HTML:', imgMatches.length);
imgMatches.forEach((tag, i) => {
  console.log(`  [${i + 1}] ${tag}`);
});
