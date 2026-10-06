const assert = require('node:assert/strict');
const fs = require('node:fs');
const puppeteer = require('puppeteer');
const { openJobVirtualDisplay } = require('../apps/api/dist/ingestion/job-virtual-display');

(async () => {
  const env = {};
  for (const name of ['PATH', 'HOME', 'TMPDIR', 'LANG', 'LC_ALL']) {
    if (process.env[name]) env[name] = process.env[name];
  }
  const display = await openJobVirtualDisplay(env);
  const socket = `/tmp/.X11-unix/X${display.display.slice(1)}`;
  let browser;
  try {
    assert.ok(fs.existsSync(socket));
    browser = await puppeteer.launch({
      headless: false, env: { ...env, DISPLAY: display.display }, timeout: 15000,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    const page = await browser.newPage();
    await page.setContent('<h1>Isolated public job browser</h1>');
    assert.equal(await page.$eval('h1', el => el.textContent), 'Isolated public job browser');
  } finally {
    await browser?.close();
    await display.close();
  }
  assert.equal(fs.existsSync(socket), false);
  console.log('Temporary headful browser and display lifecycle passed without external requests or account data');
})().catch(() => { console.error('Temporary job browser display check failed'); process.exitCode = 1; });
