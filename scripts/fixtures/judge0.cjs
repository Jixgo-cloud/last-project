// Protocol fixture for the isolated regression only. Never executes submitted code.
const http = require('http');
exports.createJudgeFixture = () => http.createServer(async (req, res) => {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  res.setHeader('Content-Type', 'application/json');
  if (!req.url.startsWith('/submissions') || req.method !== 'POST') {
    res.writeHead(404); res.end('{}'); return;
  }
  try {
    const input = JSON.parse(raw);
    const source = input.source_code || '';
    const known = source.includes('return a + b;') && ['5', '30'].includes(input.expected_output);
    if (!known) { res.writeHead(422); res.end('{"message":"Unknown fixture input"}'); return; }
    res.end(JSON.stringify({ status: { id: 3, description: 'Accepted' }, stdout: input.expected_output + '\n', stderr: null, time: '0.001', memory: 4096 }));
  } catch { res.writeHead(400); res.end('{}'); }
});
