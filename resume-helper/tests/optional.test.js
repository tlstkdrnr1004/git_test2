// v10.2: 학력 정보(머리글 오른쪽 2줄)는 선택 칸, 프로젝트 성과에 숫자는 필수가 아님
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch, openPage } = require('./helpers');

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser.close(); });

const sel = (id) => '[data-field-id="' + id + '"]';
async function clearField(page, id) {
  await page.click(sel(id));
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  await page.click(sel('header-name'));
}
// 필수 칸을 채운 시험용 가짜 이력서 (실제 개인 정보 아님). 성과에는 숫자를 넣지 않는다.
const DUMMY = {
  'header-name': '홍길동', 'header-email': 'gildong@example.com', 'header-phone': '010-1234-5678',
  'header-github': 'https://github.com/example-user',
  'project-1-name': '예시 프로젝트', 'project-1-meta': '2026.10 ~ 2026.11 | 팀 5명',
  'project-1-result': '배포 주소에서 회원가입부터 주문까지 주요 기능이 동작하는 것을 확인했습니다',
  'project-1-link': 'GitHub: https://github.com/example-user/demo',
  'edu-1-period': '2026.05 ~ 2026.12', 'edu-2-period': '2016.03 ~ 2020.02', 'edu-2-name': 'OO대학교', 'edu-2-detail': '컴퓨터공학과 졸업',
  'intro-text': '배운 것을 기록하고 끝까지 확인하는 개발자가 되겠습니다.'
};
const setFields = (page, map) => page.evaluate((m) => {
  Object.keys(m).forEach((id) => { document.querySelector('[data-field-id="' + id + '"]').innerText = m[id]; });
  UI.refreshPlaceholders();
}, map);
const preflight = (page) => page.evaluate(() => {
  const p = ValidationEngine.getPdfPreflight(UI.buildContentPayload().fields);
  return { blocking: p.blocking, validation: p.validation.fields, missing: p.report.missing };
});

test('학력 정보: 필수가 아니고, 비우면 접히며 "+ 학력"으로 되살린다. 비워 둬도 PDF 저장이 막히지 않는다', async () => {
  const page = await openPage(browser);
  await setFields(page, DUMMY);
  // 예시 문구 그대로여도 필수 경고·PDF 막힘 없음
  let p = await preflight(page);
  assert.ok(!p.blocking.includes('학력 정보'), JSON.stringify(p.blocking));
  assert.ok(!(p.validation['header-university'] && p.validation['header-university'].warnings.length), '빨간 경고 없음');
  // 비우면 화면에서 접히고 되살리기 버튼이 생김
  await clearField(page, 'header-university');
  assert.equal(await page.isVisible(sel('header-university')), false);
  const chips = await page.$$eval('#restore-chips-header .restore-chip', (e) => e.map((x) => x.textContent));
  assert.ok(chips.includes('+ 학력'), JSON.stringify(chips));
  p = await preflight(page);
  assert.deepEqual(p.blocking, [], '필수 칸을 채웠으면 학력 정보를 비워도 PDF 저장 가능');
  await page.click('#pdf-guide-btn');
  assert.equal(await page.isDisabled('#pdf-do-print'), false);
  await page.click('#pdf-guide-close');
  // 빠른 점검에도 학력 정보 경고가 없다
  await page.click('#quick-check-btn');
  assert.equal(await page.locator('text=학력 정보: 필수 항목').count(), 0);
  // 되살리기
  await page.click('#restore-chips-header .restore-chip:has-text("+ 학력")');
  assert.equal(await page.isVisible(sel('header-university')), true);
  assert.match(await page.textContent(sel('header-university')), /OO대학교/);
  assert.deepEqual(page.errors, []);
});

test('성과에 숫자가 없어도: 빨간 경고가 아닌 (선택) 추천만, PDF 저장 가능, 완성도에도 인정', async () => {
  const page = await openPage(browser);
  await setFields(page, DUMMY);
  const p = await preflight(page);
  assert.ok(!p.blocking.some((b) => /성과/.test(b)), JSON.stringify(p.blocking));
  const r = p.validation['project-1-result'] || { warnings: [], recommendations: [] };
  assert.deepEqual(r.warnings, [], '빨간 경고 없음');
  assert.ok(r.recommendations.some((x) => /^\(선택\)/.test(x)), JSON.stringify(r.recommendations));
  assert.ok(!p.missing.some((x) => /성과/.test(x)), '숫자 없는 성과도 완성도에 인정: ' + JSON.stringify(p.missing));
  await page.click('#pdf-guide-btn');
  assert.equal(await page.isDisabled('#pdf-do-print'), false, '숫자 없이도 PDF 저장 버튼이 열림');
  assert.doesNotMatch(await page.textContent('.page'), /반드시 정량 성과/);
  assert.deepEqual(page.errors, []);
});
