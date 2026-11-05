// 초안 제안 확대 + 보충자료(전자책 · 검증일지 양식 · 결함 실습) 반영 테스트
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch, openPage } = require('./helpers');

let browser;
// 예시 라이브러리의 "프로젝트 통째로"에서 AI 코드 검수 예시를 골라 넣는다
async function applyPreset(page, target, title) {
  await page.click('#example-library-btn');
  await page.click('#example-tabs .tool-tab:has-text("프로젝트 통째로")');
  await page.click('#example-filters .tool-filter:has-text("AI 코드 검수")');
  await page.selectOption('#example-target', target);
  await page.click('#example-list .tool-item:has-text("' + title + '")');
  await page.click('#example-apply');
}
before(async () => { browser = await launch(); });
after(async () => { await browser.close(); });

test('초안 제안: About·자기소개·성과 초안이 8개 이상이고 조사가 맞다', async () => {
  const page = await openPage(browser);
  const d = await page.evaluate(() => ({
    about: WritingHelper.buildAboutSuggestions(),
    intro: WritingHelper.buildIntroSuggestions(),
    result: WritingHelper.buildProjectResultSuggestions(1)
  }));
  assert.ok(d.about.length >= 8, 'About 초안 ' + d.about.length);
  assert.ok(d.intro.length >= 8, '자기소개 초안 ' + d.intro.length);
  assert.ok(d.result.length >= 8, '성과 초안 ' + d.result.length);
  assert.equal(JSON.stringify(d).match(/\{을\}|\{라는\}|을\(를\)/g), null, '조사 토큰이 남지 않음');
  await page.click('.draft-helper-btn:has-text("About Me 초안")');
  assert.match(await page.textContent('#about-draft-helper, .draft-helper-box.active'), /초안 \d+개/);
  assert.ok(await page.isVisible('.draft-helper-box.active .draft-helper-btn:has-text("예시 라이브러리에서 더 보기")'));
  assert.deepEqual(page.errors, []);
});

test('예시 라이브러리: AI 코드 검수 필터와 역할별 프로젝트', async () => {
  const page = await openPage(browser);
  await page.click('#example-library-btn');
  const count = async (tab) => {
    await page.click('#example-tabs .tool-tab:has-text("' + tab + '")');
    await page.click('#example-filters .tool-filter:has-text("AI 코드 검수")');
    return page.$$eval('#example-list .tool-item', (e) => e.length);
  };
  assert.ok(await count('About Me') >= 6);
  assert.ok(await count('자기소개') >= 6);
  assert.ok(await count('구현') >= 30, '구현 예시 30개 이상');
  assert.ok(await count('성과') >= 12);
  assert.ok(await count('프로젝트 통째로') >= 7);
  await page.selectOption('#example-target', 'new');
  await page.click('#example-list .tool-item:has-text("CRM C")');
  await page.click('#example-apply');
  const names = await page.$$eval('.project-name', (e) => e.map((x) => x.innerText));
  assert.ok(names.some((n) => n.includes('방문·포인트·쿠폰')));
  assert.deepEqual(page.errors, []);
});

test('면접: 꼬리 질문 모범 답안과 60초 결함 이야기', async () => {
  const page = await openPage(browser);
  await applyPreset(page, '1', '맛집 리뷰 B');
  await applyPreset(page, 'new', 'CRM C');
  await page.click('#interview-open-btn');
  const qs = await page.$$eval('.iv-card .iv-q', (e) => e.map((x) => x.textContent));
  assert.ok(qs.some((q) => q.includes('fetch join과 페이징')));
  assert.ok(qs.some((q) => q.includes('비관적 락과 낙관적 락')));
  assert.ok(qs.some((q) => q.includes('60초')));
  const models = await page.$$eval('.iv-model p', (e) => e.map((x) => x.textContent));
  assert.ok(models.length >= 5, '모범 답안 ' + models.length);
  assert.ok(models.some((m) => m.includes('limit')));
  assert.deepEqual(page.errors, []);
});

test('결과보고서 6막·체크리스트, 프로젝트 README 뼈대', async () => {
  const page = await openPage(browser);
  await applyPreset(page, '1', '맛집 리뷰 B');
  await page.click('#report-open-btn');
  const report = await page.inputValue('#report-editor');
  assert.match(report, /6막 구조/);
  assert.match(report, /재발 방지/);
  await page.click('#report-tabs .tool-tab[data-mode="checklist"]');
  const check = await page.inputValue('#report-editor');
  assert.match(check, /AI 코드 검수 체크리스트 10문항/);
  assert.match(check, /측정용 SQL 로그/);
  await page.keyboard.press('Escape');

  await page.click('#readme-generator-btn');
  await page.click('#readme-template-btn');
  const md = await page.inputValue('#readme-editor');
  assert.match(md, /## AI 코드 검증 일지/);
  assert.match(md, /\| # \| 결함 \| 발견 근거 \| Before \| 원인 \| 개선 \| After \| 재발 방지 \| 담당 \|/);
  assert.match(md, /## 트러블슈팅 회고 \(3개\)/);
  assert.match(md, /\$\{DB_PASSWORD\}/);
  assert.match(md, /Java-21/);
  assert.deepEqual(page.errors, []);
});

test('자동 입력: 공식 검증일지 양식(xlsx 복사)과 README 표를 읽는다', async () => {
  const page = await openPage(browser);
  await page.click('#autofill-open-btn');
  await page.selectOption('#autofill-type', 'verify');
  const xlsx = [
    '📒 AI 코드 검증 일지',
    '노란 칸만 입력 · 5행은 예시 · 한 줄 = 결함 1개',
    ['번호', '날짜', '주차', '이름', '역할', '기능', '결함 유형', '결함 내용 (무엇이 문제였나)', 'AI 초안?', '발견 근거', 'Before (수치)', '원인', '개선 방법', 'After (수치)', '측정 조건', '재발 방지', '상태', '커밋 · PR 링크'].join('\t'),
    ['1', '46344', '3주차', '예시', 'B', '맛집 목록', '성능(N+1·쿼리)', '예시 줄', '예', '-', '-', '-', '-', '-', '-', '-', '완료', ''].join('\t'),
    ['2', '46345', '3주차', '나', 'C', '포인트 사용', '동시성', '포인트 동시 사용 시 잔액 음수', '예', '100스레드 테스트', '잔액 -30', '읽고-빼고-저장', '조건부 UPDATE', '잔액 0', '고객 1명·100스레드, 로컬 MySQL 8', '동시성 테스트 추가', '완료', 'https://github.com/me/busan-crm/pull/7'].join('\t'),
    ['3', '46346', '3주차', '나', 'C', '쿠폰 사용', '동시성', '쿠폰 동시 2건 모두 사용됨', '예', '동시 2건 요청', '성공 2건', '확인 후 저장', 'where used = false', '성공 1건', '', '동시성 테스트 추가', '완료', ''].join('\t')
  ].join('\n');
  await page.fill('#autofill-source', xlsx);
  await page.click('#autofill-local-btn');
  const v = await page.$$eval('#autofill-result .tool-field textarea', (t) => t.map((x) => x.value));
  const details = v[4].split('\n');
  assert.equal(details.length, 3, '결함 2건 + 재발 방지 1줄 (예시 줄 제외): ' + v[4]);
  assert.match(details[0], /포인트 사용: 포인트 동시 사용 시 잔액 음수 → 조건부 UPDATE/);
  assert.match(details[2], /^재발 방지: 동시성 테스트 추가$/);
  assert.match(v[5], /잔액 -30 → 잔액 0/);
  assert.match(v[5], /고객 1명·100스레드/);
  assert.match(v[5], /결함 2건/);
  assert.equal(v[6], 'github.com/me/busan-crm');

  const readme = '| # | 결함 | 발견 근거 | Before | 원인 | 개선 | After | 재발 방지 | 담당 |\n|---|---|---|---|---|---|---|---|---|\n| 1 | 맛집 목록 N+1 | SQL 로그 | 쿼리 101회 | reviews LAZY | DTO 직접 조회 | 쿼리 1회 | 쿼리 수 테스트 | B |';
  await page.fill('#autofill-source', readme);
  await page.click('#autofill-local-btn');
  const r = await page.$$eval('#autofill-result .tool-field textarea', (t) => t.map((x) => x.value));
  assert.match(r[4], /^맛집 목록 N\+1 → DTO 직접 조회/);
  assert.match(r[5], /쿼리 101회 → 쿼리 1회/);
  assert.deepEqual(page.errors, []);
});
