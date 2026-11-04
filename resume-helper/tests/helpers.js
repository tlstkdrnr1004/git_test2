// 테스트 공통: 브라우저 하나를 띄우고, 테스트마다 새 컨텍스트(빈 localStorage)로 index.html을 연다.
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const PAGE_URL = pathToFileURL(path.join(__dirname, '..', 'index.html')).href;

async function launch() {
  return chromium.launch();
}

async function openPage(browser, options = {}) {
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 }, ...options });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.accept(d.type() === 'prompt' ? (page.promptAnswer || '') : undefined));
  await page.goto(PAGE_URL);
  if (await page.isVisible('#onboarding-skip-btn')) await page.click('#onboarding-skip-btn');
  page.errors = errors;
  return page;
}

// OpenRouter 호출을 가짜 응답으로 바꾼다. handler(systemPrompt) → 응답 본문 문자열
async function mockAI(page, handler) {
  const sent = [];
  await page.route('https://openrouter.ai/**', async (route) => {
    const body = route.request().postData() || '';
    sent.push(body);
    const system = JSON.parse(body).messages[0].content;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ choices: [{ message: { content: handler(system) } }] }),
    });
  });
  await page.evaluate(() => localStorage.setItem('resume-ai-api-key', JSON.stringify('test-key')));
  return sent;
}

module.exports = { launch, openPage, mockAI, PAGE_URL };
