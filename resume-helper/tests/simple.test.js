// 간단 모드(3단계) + 주제·역할 고르기 시작 화면 테스트
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { launch, openPage } = require('./helpers');

const URL = pathToFileURL(path.join(__dirname, '..', 'index.html')).href;
let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser.close(); });

// 저장된 것이 없는 첫 방문 (간단 모드 기본값)
async function firstVisit(viewport = { width: 1400, height: 900 }) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  page.errors = [];
  page.dialogs = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.on('dialog', (d) => { page.dialogs.push(d.message()); d.accept(); });
  await page.goto(URL);
  return page;
}
const text = (page, id) => page.textContent('[data-field-id="' + id + '"]');

test('첫 방문: 주제·역할을 고르면 이력서가 예시로 채워지고 투어가 시작된다', async () => {
  const page = await firstVisit();
  await page.click('#onboarding-starter-btn');
  assert.equal(await page.isDisabled('#starter-apply'), true, '고르기 전에는 채우기 버튼이 잠김');
  const themes = await page.$$eval('.starter-theme', (e) => e.length);
  assert.equal(themes, 4);
  await page.click('.starter-theme[data-theme="crm"]');
  const roles = await page.$$eval('.starter-role strong', (e) => e.map((x) => x.textContent));
  assert.ok(roles.length >= 4, JSON.stringify(roles));
  await page.click('.starter-role:has-text("CRM C")');
  assert.match(await page.textContent('#starter-preview'), /포인트/);
  await page.click('#starter-apply');
  assert.equal(page.dialogs.length, 0, '빈 이력서에서는 확인 창 없이 채움');

  assert.match(await text(page, 'project-1-name'), /방문·포인트·쿠폰/);
  assert.match(await text(page, 'project-1-role'), /포인트/);
  assert.match(await text(page, 'project-1-detail'), /조건부 UPDATE/);
  assert.match(await text(page, 'header-subtitle'), /지원 \|/);
  assert.match(await text(page, 'about-summary'), /CRM|고객/);
  assert.match(await text(page, 'intro-text'), /포인트|고객/);
  assert.match(await text(page, 'skills-backend'), /Spring Boot 3\.4/);
  assert.match(await text(page, 'skills-database'), /MySQL/);
  // 투어가 바로 시작되고, 채운 직후 안내가 보인다
  assert.equal(await page.evaluate(() => GuidedTour.active), true);
  assert.match(await page.textContent('.tour-note'), /예시 문장은 그대로 내면 안 됩니다/);
  assert.deepEqual(page.errors, []);
});

test('주제 4개 모두 역할이 있고, 채우면 주제에 맞는 기술이 들어간다', async () => {
  const page = await openPage(browser, { simple: true });
  for (const [theme, re] of [['food', /Spring Boot/], ['trip', /Spring Boot/], ['crm', /Spring Boot/], ['semi', /Servlet\/JSP/]]) {
    await page.click('#starter-open-btn');
    await page.click('.starter-theme[data-theme="' + theme + '"]');
    assert.ok((await page.$$eval('.starter-role', (e) => e.length)) >= 2, theme + ' 역할 2개 이상');
    await page.click('.starter-role');
    await page.click('#starter-apply');
    assert.match(await text(page, 'skills-backend'), re, theme);
    assert.ok(!/\[.*\]/.test(await text(page, 'project-1-name')), theme + ' 프로젝트 이름이 채워짐');
    await page.click('.tour-close');
  }
  assert.deepEqual(page.errors, []);
});

test('간단 모드: 고급 기능은 접혀 있고, 열면 모두 쓸 수 있으며 상태가 유지된다', async () => {
  const page = await firstVisit();
  await page.click('#onboarding-skip-btn');
  // 간단 영역의 3단계 버튼은 보이고, 고급 영역 버튼은 숨어 있다
  for (const id of ['starter-open-btn', 'guided-tour-btn', 'example-library-btn', 'quick-check-btn', 'pdf-guide-btn']) {
    assert.equal(await page.isVisible('#' + id), true, id + ' 보임');
  }
  for (const id of ['interview-open-btn', 'report-open-btn', 'wizard-start-btn', 'analyze-btn', 'version-save-btn', 'export-json-btn']) {
    assert.equal(await page.isVisible('#' + id), false, id + ' 숨음');
  }
  assert.equal(await page.isVisible('.guide'), false, '섹션 아래 안내 문구 숨김');
  // 숨어 있어도 기능은 살아 있다 (다른 기능이 코드로 누르는 경우)
  await page.evaluate(() => document.getElementById('interview-open-btn').click());
  assert.equal(await page.isVisible('#interview-overlay.active'), true);
  await page.keyboard.press('Escape');

  await page.click('#advanced-toggle-btn');
  assert.equal(await page.isVisible('#interview-open-btn'), true);
  assert.equal(await page.isVisible('.guide'), true);
  assert.match(await page.textContent('#advanced-toggle-btn'), /닫기/);
  await page.reload();
  assert.equal(await page.isVisible('#interview-open-btn'), true, '새로고침 후에도 열린 상태');
  await page.click('#advanced-toggle-btn');
  await page.reload();
  assert.equal(await page.isVisible('#interview-open-btn'), false, '닫은 상태도 유지');
  assert.deepEqual(page.errors, []);
});

test('내용이 있는 이력서: 채우기 전 확인하고, 이름·연락처는 지키며, 되돌릴 수 있다', async () => {
  const page = await firstVisit();
  await page.click('#onboarding-skip-btn');
  await page.click('[data-field-id="header-name"]');
  await page.keyboard.type('김부산');
  await page.click('[data-field-id="about-summary"]');
  await page.keyboard.press('Control+A');
  await page.keyboard.type('내가 직접 쓴 소개입니다.');
  await page.click('#starter-open-btn');
  await page.click('.starter-theme[data-theme="food"]');
  await page.click('.starter-role');
  await page.click('#starter-apply');
  assert.equal(page.dialogs.length, 1, '덮어쓰기 전 확인 창');
  assert.equal(await text(page, 'header-name'), '김부산');
  assert.notEqual((await text(page, 'about-summary')).trim(), '내가 직접 쓴 소개입니다.');
  await page.click('.tour-close');
  await page.click('#simple-undo-btn');
  assert.equal((await text(page, 'about-summary')).trim(), '내가 직접 쓴 소개입니다.');
  assert.equal(await text(page, 'header-name'), '김부산');
  assert.deepEqual(page.errors, []);
});

test('모바일: 시작 화면과 간단 패널이 화면 안에 들어온다', async () => {
  const page = await firstVisit({ width: 390, height: 800 });
  await page.click('#onboarding-starter-btn');
  await page.click('.starter-theme[data-theme="trip"]');
  await page.click('.starter-role');
  const box = await page.$eval('#starter-apply', (e) => e.getBoundingClientRect().toJSON());
  assert.ok(box.right <= 390 && box.bottom <= 800, JSON.stringify(box));
  await page.click('#starter-apply');
  assert.equal(await page.evaluate(() => GuidedTour.active), true);
  assert.deepEqual(page.errors, []);
});
