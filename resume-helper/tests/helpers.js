// 테스트 공통: 브라우저 하나를 띄우고, 테스트마다 새 컨텍스트(빈 localStorage)로 index.html을 연다.
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const PAGE_URL = pathToFileURL(path.join(__dirname, '..', 'index.html')).href;

async function launch() {
  return chromium.launch();
}

async function openPage(browser, options = {}) {
  const { simple, ...contextOptions } = options;
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 }, ...contextOptions });
  // 기존 테스트는 고급 영역의 버튼을 직접 누르므로 고급 기능을 연 상태로 시작한다 (simple: true면 간단 모드 그대로)
  if (!options.simple) await context.addInitScript(() => { if (localStorage.getItem('resume-simple-mode') === null) localStorage.setItem('resume-simple-mode', 'false'); });
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

// 새로 고침. 헤드리스 Chromium은 file:// 주소의 localStorage를 새로 고침 직후 가끔 잃어버린다
// (이 앱과 무관하게 수 번에 한 번꼴로 재현됨). 그래서 새로 고침 전 값을 보관했다가 사라졌으면 되돌려 놓고 다시 열어,
// "저장된 내용을 새로 고침 뒤에도 복원하는가"라는 앱의 동작만 시험한다.
async function reloadKeepingStorage(page) {
  const snapshot = await page.evaluate(() => Object.assign({}, localStorage));
  const keys = Object.keys(snapshot);
  for (let attempt = 0; attempt < 5; attempt++) {
    await page.reload();
    const intact = await page.evaluate((k) => k.every((key) => localStorage.getItem(key) !== null), keys);
    if (intact) return;
    await page.evaluate((snap) => { for (const key of Object.keys(snap)) localStorage.setItem(key, snap[key]); }, snapshot);
  }
  await page.reload();
}

module.exports = {
  reloadKeepingStorage, launch, openPage, mockAI, PAGE_URL };
