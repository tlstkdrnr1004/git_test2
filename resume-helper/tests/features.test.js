// 기능 회귀 테스트: 리뷰에서 고친 버그와 추가한 기능이 계속 동작하는지 확인한다.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch, openPage } = require('./helpers');

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser.close(); });

test('위자드: 자격증 건너뛰기, 미리보기에서 돌아가기, 대표 프로젝트 유지', async () => {
  const page = await openPage(browser);
  await page.evaluate(() => Wizard.start());
  const fill = (k, v) => page.fill(`[data-wkey="${k}"]`, v);
  await fill('name', '홍길동'); await fill('email', 'a@b.com'); await fill('phone', '010-1234-5678'); await fill('github', 'github.com/hong');
  await page.evaluate(() => Wizard.next());
  await fill('university', 'OO대'); await fill('major', 'C++ & 컴공'); await fill('gradYear', '2025.02');
  await page.evaluate(() => Wizard.next());
  await fill('trainingOrg', 'KH'); await fill('trainingName', '과정'); await fill('trainingPeriod', '2025'); await fill('trainingHours', '900시간');
  await page.evaluate(() => { Wizard.next(); Wizard.data.projects = undefined; Wizard.goToStep(5); });
  await fill('cert1Name', '정보처리기사');
  await page.evaluate(() => Wizard.skip());
  assert.equal(await page.evaluate(() => Wizard.data.cert1Name), '');
  await page.fill('[data-ikey="why"]', '이유');
  await page.evaluate(() => { Wizard.data.projects = undefined; Wizard.finish(); Wizard.goToStep(0); });
  assert.equal(await page.evaluate(() => Wizard.data.intro.why), '이유');
  assert.equal(await page.evaluate(() => document.querySelectorAll('.project-item')[0].style.display), '');
  assert.match(await page.evaluate(() => document.querySelector('[data-field-id="header-university"]').innerHTML), /C\+\+ &amp; 컴공/);
});

test('예시 라이브러리: 여러 개 한 번에 넣기와 되돌리기', async () => {
  const page = await openPage(browser);
  await page.click('#example-library-btn');
  const counts = await page.$$eval('#example-tabs .tool-tab', (tabs) => tabs.map((t) => parseInt(t.querySelector('.tool-tab-count').textContent, 10)));
  assert.ok(counts.every((n) => n >= 10), '모든 분류에 예시가 10개 이상');
  await page.click('#example-tabs .tool-tab:has-text("자격증")');
  for (const n of [0, 2, 7]) await page.click(`#example-list .tool-item >> nth=${n}`);
  await page.click('#example-apply');
  const certs = () => page.$$eval('.cert-row .cert-name', (e) => e.map((x) => x.innerText));
  assert.deepEqual(await certs(), ['정보처리기사', 'SQLD (SQL 개발자)', 'AWS Certified Cloud Practitioner']);
  await page.click('#undo-change-btn');
  assert.equal((await certs()).length, 2);
});

test('자동 입력: README·커밋 기록·주간보고서를 규칙으로 분석한다', async () => {
  const page = await openPage(browser);
  await page.click('#autofill-open-btn');
  const values = async () => page.$$eval('#autofill-result .tool-field textarea', (t) => t.map((x) => x.value));
  for (const type of ['readme', 'commits', 'weekly']) {
    await page.selectOption('#autofill-type', type);
    await page.click('#autofill-sample');
    await page.click('#autofill-local-btn');
    const v = await values();
    assert.ok(v[4].split('\n').length >= 3, `${type}: 구현 내용 3줄 이상`);
    assert.match(v[5], /51\S* → /, `${type}: 숫자 성과`);
  }
});

test('면접 질문·버전 관리·채용공고 점검', async () => {
  const page = await openPage(browser);
  await page.click('#example-library-btn');
  await page.click('#example-tabs .tool-tab:has-text("프로젝트 통째로")');
  await page.selectOption('#example-target', '1');
  await page.click('#example-list .tool-item >> nth=0');
  await page.click('#example-apply');
  await page.click('#interview-open-btn');
  const qs = await page.$$eval('.iv-card .iv-q', (e) => e.map((x) => x.textContent));
  assert.ok(qs.length >= 20);
  assert.ok(qs.some((q) => q.includes('N+1')));
  await page.keyboard.press('Escape');

  page.promptAnswer = '기본 버전';
  await page.click('#version-save-btn');
  await page.evaluate(() => { document.querySelector('[data-field-id="header-subtitle"]').innerText = '바뀐 소개'; });
  await page.selectOption('#version-select', { index: 1 });
  await page.click('#version-load-btn');
  assert.notEqual(await page.textContent('[data-field-id="header-subtitle"]'), '바뀐 소개');

  await page.click('#jobmatch-open-btn');
  await page.click('#jobmatch-sample');
  await page.click('#jobmatch-run');
  const rows = await page.$$eval('.jm-table tr', (e) => e.length - 1);
  assert.ok(rows >= 10);
});

test('결과보고서·문장 다듬기·디자인·인쇄', async () => {
  const page = await openPage(browser);
  await page.click('#example-library-btn');
  await page.click('#example-tabs .tool-tab:has-text("프로젝트 통째로")');
  await page.selectOption('#example-target', '1');
  await page.click('#example-list .tool-item >> nth=0');
  await page.click('#example-apply');
  await page.click('#report-open-btn');
  const report = await page.inputValue('#report-editor');
  assert.match(report, /문제 해결 \(Before → After\)/);
  assert.match(report, /51회 → 1회/);
  await page.keyboard.press('Escape');

  await page.evaluate(() => { document.querySelector('[data-field-id="about-summary"]').innerText = '스프링부트와 mysql로 할수있는 것을 만들었습니다.'; });
  await page.click('#polish-open-btn');
  await page.click('#polish-fix-all');
  assert.equal(await page.textContent('[data-field-id="about-summary"]'), 'Spring Boot와 MySQL로 할 수 있는 것을 만들었습니다.');
  await page.keyboard.press('Escape');

  await page.click('.design-theme-btn[data-theme="modern"]');
  assert.match(await page.evaluate(() => document.querySelector('.page').className), /theme-modern/);

  await page.click('.section[data-section-toggle="certification"] .section-toggle-btn');
  await page.emulateMedia({ media: 'print' });
  const print = await page.evaluate(() => ({
    cert: getComputedStyle(document.querySelector('.section[data-section-toggle="certification"]')).display,
    addBtn: getComputedStyle(document.querySelector('.project-add-wrap')).display,
    badgeBg: getComputedStyle(document.querySelector('.header-right .badge')).backgroundColor,
  }));
  assert.equal(print.cert, 'none', '숨긴 섹션은 인쇄하지 않는다');
  assert.equal(print.addBtn, 'none', '편집 버튼은 인쇄하지 않는다');
  assert.notEqual(print.badgeBg, 'rgba(0, 0, 0, 0)', '배지 배경이 인쇄된다');
  assert.deepEqual(page.errors, []);
});
