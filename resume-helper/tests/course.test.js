// 수업 자료(개정 공지 + 세미 프로젝트 결과보고서 3개) 반영 테스트
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch, openPage } = require('./helpers');

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser.close(); });

test('세미 프로젝트 예시: 필터와 프로젝트 통째로 넣기', async () => {
  const page = await openPage(browser);
  await page.click('#example-library-btn');
  await page.click('#example-tabs .tool-tab:has-text("프로젝트 통째로")');
  await page.click('#example-filters .tool-filter:has-text("세미")');
  const titles = await page.$$eval('#example-list .tool-item-title', (e) => e.map((x) => x.textContent));
  assert.ok(titles.length >= 9, '세미 프로젝트 예시 9개 이상');
  assert.ok(titles.some((t) => t.includes('NEXORA')) && titles.some((t) => t.includes('MovieBox')) && titles.some((t) => t.includes('놀러가자')));
  await page.selectOption('#example-target', 'new');
  await page.click('#example-list .tool-item:has-text("가이드 예약·토스 결제")');
  await page.click('#example-apply');
  const names = await page.$$eval('.project-name', (e) => e.map((x) => x.innerText));
  assert.ok(names.some((n) => n.includes('놀러가자')));
});

test('자동 입력: AI 코드 검증일지 표를 구현·성과로 바꾼다', async () => {
  const page = await openPage(browser);
  await page.click('#autofill-open-btn');
  await page.selectOption('#autofill-type', 'verify');
  await page.click('#autofill-sample');
  await page.click('#autofill-local-btn');
  const v = await page.$$eval('#autofill-result .tool-field textarea', (t) => t.map((x) => x.value));
  assert.equal(v[4].split('\n').length, 4, '결함 4건 → 구현 4줄');
  assert.match(v[5], /SQL 51회 → SQL 1회/);
  assert.match(v[5], /검증일지 결함 4건/);
  assert.equal(v[6], 'github.com/your-id/busan-matzip');
});

test('면접 질문·결과보고서·채용공고에 세미 프로젝트 기술이 반영된다', async () => {
  const page = await openPage(browser);
  await page.click('#example-library-btn');
  await page.click('#example-tabs .tool-tab:has-text("프로젝트 통째로")');
  await page.click('#example-filters .tool-filter:has-text("세미")');
  await page.selectOption('#example-target', '1');
  await page.click('#example-list .tool-item:has-text("가이드 예약·토스 결제")');
  await page.click('#example-apply');

  await page.click('#interview-open-btn');
  const qs = await page.$$eval('.iv-card .iv-q', (e) => e.map((x) => x.textContent));
  assert.ok(qs.some((q) => q.includes('Servlet/JSP')), 'Servlet/JSP 질문');
  assert.ok(qs.some((q) => q.includes('결제 금액')), '결제 질문');
  assert.ok(qs.some((q) => q.includes('AI 코드 검증일지')), '검증일지 질문');
  await page.keyboard.press('Escape');

  await page.click('#report-open-btn');
  await page.fill('#report-verify', '3');
  await page.dispatchEvent('#report-verify', 'change');
  assert.match(await page.inputValue('#report-editor'), /AI 코드 검증일지: 내 결함 기록 3건/);
  await page.click('#report-tabs .tool-tab[data-mode="checklist"]');
  assert.match(await page.inputValue('#report-editor'), /제출 파일 5개/);
  await page.keyboard.press('Escape');

  await page.click('#jobmatch-open-btn');
  await page.fill('#jobmatch-source', '■ 자격 요건\n- JSP/Servlet 또는 Spring 경험\n- 결제 연동 경험\n■ 우대 사항\n- Nginx, Tomcat 운영 경험');
  await page.click('#jobmatch-run');
  const rows = await page.$$eval('.jm-table tr', (e) => e.slice(1).map((tr) => tr.children[1].textContent + ':' + tr.children[2].textContent));
  assert.ok(rows.some((r) => r.startsWith('Servlet/JSP') && !r.includes('없음')), JSON.stringify(rows));
  assert.ok(rows.some((r) => r.startsWith('결제 연동') && !r.includes('없음')), JSON.stringify(rows));
  assert.deepEqual(page.errors, []);
});
