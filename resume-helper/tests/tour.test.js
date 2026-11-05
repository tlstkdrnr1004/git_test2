// 말풍선 따라 쓰기 투어 테스트
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { launch } = require('./helpers');

const URL = pathToFileURL(path.join(__dirname, '..', 'index.html')).href;
let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser.close(); });

// 첫 방문 화면(온보딩)을 건너뛰지 않고 연다
async function firstVisit(viewport = { width: 1400, height: 900 }) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.on('dialog', (d) => d.accept());
  await page.goto(URL);
  return page;
}
const title = (page) => page.textContent('.tour-title');
const goTo = async (page, word) => {
  for (let i = 0; i < 40 && !(await title(page)).includes(word); i++) await page.click('#tour-next');
};

test('첫 화면에서 투어 시작 → 칸 강제 포커스 · 빈칸 경고 · 예시 창 동안 잠시 숨김', async () => {
  const page = await firstVisit();
  await page.click('#onboarding-tour-btn');
  assert.match(await page.textContent('.tour-count'), /^1 \/ \d+$/);
  await page.click('#tour-next');
  assert.equal(await title(page), '이름');
  const focused = () => page.evaluate(() => document.activeElement.getAttribute('data-field-id'));
  assert.equal(await focused(), 'header-name');
  // 어두운 영역을 눌러도 포커스는 현재 칸에 남는다
  await page.mouse.click(700, 850);
  assert.equal(await focused(), 'header-name');
  // 예시 문구 그대로 다음 → 한 번은 경고, 다시 누르면 넘어감
  await page.click('#tour-next');
  assert.match(await page.textContent('#tour-warn'), /예시 문구/);
  await page.keyboard.type('김부산');
  await page.click('#tour-next');
  assert.equal(await title(page), '한 줄 소개');
  assert.equal(await page.textContent('[data-field-id="header-name"]'), '김부산');
  // 예시 라이브러리를 열면 투어가 숨고, 닫으면 돌아온다
  await page.click('.tour-action');
  await page.waitForTimeout(400);
  assert.equal(await page.$eval('#tour-bubble', (e) => e.style.display), 'none');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  assert.equal(await page.$eval('#tour-bubble', (e) => e.style.display), '');
  assert.deepEqual(page.errors, []);
});

test('끝내기 후 이어서 하기, 마지막 단계에서 남은 칸으로 이동', async () => {
  const page = await firstVisit();
  await page.click('#onboarding-tour-btn');
  await goTo(page, 'About Me');
  await page.click('.tour-close');
  assert.equal(await page.evaluate(() => GuidedTour.active), false);
  assert.match(await page.textContent('#guided-tour-btn'), /이어서 \(5\//);
  await page.click('#guided-tour-btn');
  assert.match(await title(page), /About Me/);
  await page.click('.tour-action:has-text("초안 만들기")');
  assert.ok(await page.isVisible('#about-draft-box.active'));
  await goTo(page, '수고');
  const left = await page.$$eval('.tour-jump', (e) => e.map((x) => x.textContent));
  assert.ok(left.some((t) => t.includes('연락처')), JSON.stringify(left));
  await page.click('.tour-jump:has-text("연락처")');
  assert.match(await title(page), /연락처/);
  await goTo(page, '수고');
  await page.click('#tour-next');
  assert.equal(await page.evaluate(() => GuidedTour.active), false);
  assert.match(await page.textContent('#guided-tour-btn'), /처음이라면/);
  assert.deepEqual(page.errors, []);
});

test('모바일: 말풍선이 화면 아래 시트로 뜬다', async () => {
  const page = await firstVisit({ width: 390, height: 800 });
  await page.click('#onboarding-tour-btn');
  await page.click('#tour-next');
  assert.ok(await page.$eval('#tour-bubble', (e) => e.classList.contains('tour-bubble-sheet')));
  const box = await page.$eval('#tour-bubble', (e) => e.getBoundingClientRect().toJSON());
  assert.ok(box.bottom <= 800 && box.left >= 0 && box.right <= 390, JSON.stringify(box));
  assert.deepEqual(page.errors, []);
});
