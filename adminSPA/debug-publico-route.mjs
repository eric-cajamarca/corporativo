import { chromium } from 'playwright';

const logs = [];
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

page.on('console', (msg) => {
  logs.push({ type: 'console', text: msg.text() });
});

page.on('requestfailed', (req) => {
  if (req.url().includes('7846/ingest')) {
    logs.push({ type: 'ingest-failed', url: req.url() });
  }
});

await page.goto('http://localhost:4202/publico', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3000);

const result = {
  finalUrl: page.url(),
  title: await page.title(),
  hasPublicHome: await page.locator('.public-home').count(),
  hasLogin: await page.locator('app-login-empresa').count(),
  hasInicio: await page.locator('app-inicio').count(),
  bodySnippet: (await page.locator('body').innerText()).slice(0, 300),
  logs: logs.slice(0, 30)
};

console.log(JSON.stringify(result, null, 2));
await browser.close();
