// 이력서 칸 보완 테스트: 지운 칸 접기·되살리기, 고정 행 삭제, 나이·병역, 기타 문서, 기술 분류 목록
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch, openPage, reloadKeepingStorage } = require('./helpers');

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser.close(); });

const sel = (id) => '[data-field-id="' + id + '"]';
// 사용자가 하듯: 칸을 눌러 전체 선택 → 지우기 → 다른 곳을 눌러 벗어남
async function clearField(page, id) {
  await page.click(sel(id));
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  await page.click(sel('header-name'));
}
const visibleContactItems = (page) => page.$$eval('.contact-info span', (e) => e.filter((x) => x.offsetParent !== null).length);

test('연락처·배지: 칸을 비우면 점과 동그라미가 사라지고, 버튼으로 되살릴 수 있다', async () => {
  const page = await openPage(browser);
  const before = await visibleContactItems(page);
  await clearField(page, 'header-blog');
  await clearField(page, 'header-saramin');
  assert.equal(await visibleContactItems(page), before - 2, '비운 칸의 점도 함께 사라짐');
  assert.equal(await page.isVisible(sel('header-blog')), false);
  // 배지(사진 옆 남색 동그라미)
  await clearField(page, 'header-badge');
  assert.equal(await page.isVisible('.header-right .badge'), false);
  // 되살리기 버튼
  const chips = await page.$$eval('#restore-chips-header .restore-chip', (e) => e.map((x) => x.textContent));
  assert.ok(chips.includes('+ 블로그') && chips.includes('+ 사람인') && chips.includes('+ 지원 배지'), JSON.stringify(chips));
  await page.click('#restore-chips-header .restore-chip:has-text("+ 블로그")');
  assert.equal(await page.isVisible(sel('header-blog')), true);
  assert.match(await page.textContent(sel('header-blog')), /Blog/);
  assert.equal(await page.evaluate(() => document.activeElement.getAttribute('data-field-id')), 'header-blog', '되살린 칸에 바로 입력');
  // 새로 고침해도 비운 상태가 유지된다 (되살린 블로그는 예시 문구라 인쇄에서만 빠진다)
  await page.waitForTimeout(900);
  await reloadKeepingStorage(page);
  assert.equal(await page.isVisible(sel('header-saramin')), false);
  assert.equal(await page.isVisible('.header-right .badge'), false);
  assert.deepEqual(page.errors, []);
});

test('프로젝트: 고정 프로젝트 2·3에도 삭제 버튼이 있고, 지우면 사라지며, 되살릴 수 있다', async () => {
  const page = await openPage(browser);
  assert.equal(await page.locator('.project-item').nth(0).locator('.static-delete-btn').count(), 0, '대표 프로젝트(필수)는 삭제 버튼 없음');
  for (const n of [1, 2]) assert.equal(await page.locator('.project-item').nth(n).locator('.static-delete-btn').count(), 1);
  const third = page.locator('.project-item').nth(2);
  await third.locator('.static-delete-btn').click();
  assert.equal(await third.isVisible(), false, '삭제한 프로젝트 칸이 화면에서 사라짐');
  assert.equal(await page.evaluate(() => document.querySelectorAll('.project-item')[2].getAttribute('data-user-empty')), 'true');
  const chip = page.locator('.restore-chip', { hasText: '+ 프로젝트 3 되살리기' });
  assert.equal(await chip.count(), 1);
  // 저장 후 새로 고침해도 그대로
  await page.waitForTimeout(900);
  await reloadKeepingStorage(page);
  assert.equal(await page.locator('.project-item').nth(2).isVisible(), false);
  // 되살리기
  await page.locator('.restore-chip', { hasText: '+ 프로젝트 3 되살리기' }).click();
  assert.equal(await page.locator('.project-item').nth(2).isVisible(), true);
  assert.match(await page.textContent(sel('project-3-name')), /개인 프로젝트명/);
  // 되돌리기로도 복구된다
  await page.locator('.project-item').nth(1).locator('.static-delete-btn').click();
  assert.equal(await page.locator('.project-item').nth(1).isVisible(), false);
  await page.click('#undo-change-btn');
  assert.equal(await page.locator('.project-item').nth(1).isVisible(), true);
  assert.deepEqual(page.errors, []);
});

test('스크린샷 상황: 직접 지우다 만 프로젝트 칸(기간 예시만 남음)도 접힌다', async () => {
  const page = await openPage(browser);
  for (const id of ['project-3-name', 'project-3-role', 'project-3-detail']) {
    await page.click(sel(id));
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Backspace');
  }
  await page.click(sel('header-name'));
  // 기간 칸(예시 문구)은 남아 있지만 내용이 없으므로 칸 전체가 접힌다
  assert.match(await page.textContent(sel('project-3-meta')), /기간/);
  assert.equal(await page.locator('.project-item').nth(2).isVisible(), false);
  // 일부만 비운 프로젝트 2는 계속 보인다 (예시 문구 그대로인 칸은 안내로 남김)
  assert.equal(await page.locator('.project-item').nth(1).isVisible(), true);
});

test('교육·자격증 고정 행도 삭제할 수 있다 (필수 교육 1번 행은 제외)', async () => {
  const page = await openPage(browser);
  assert.equal(await page.locator('.edu-row').nth(0).locator('.static-delete-btn').count(), 0);
  assert.equal(await page.locator('.edu-row').nth(1).locator('.static-delete-btn').count(), 1);
  // 두 번째 교육 행(필수 칸)을 지우면 필수 점검과 PDF 점검에서도 빠진다
  await page.locator('.edu-row').nth(1).locator('.static-delete-btn').click();
  assert.equal(await page.locator('.edu-row').nth(1).isVisible(), false);
  const blocking = await page.evaluate(() => ValidationEngine.getPdfPreflight(UI.buildContentPayload().fields).blocking);
  assert.ok(!blocking.some((b) => /교육2/.test(b)), JSON.stringify(blocking));
  assert.equal(await page.locator('.cert-row').nth(0).locator('.static-delete-btn').count(), 1);
  await page.locator('.cert-row').nth(0).locator('.static-delete-btn').click();
  assert.equal(await page.locator('.cert-row').nth(0).isVisible(), false);
  assert.ok(await page.isVisible('.restore-chip:has-text("+ 자격증 1 되살리기")'));
  await page.click('.restore-chip:has-text("+ 자격증 1 되살리기")');
  assert.equal(await page.locator('.cert-row').nth(0).isVisible(), true);
});

test('나이·병역: 입력·저장·내보내기, 비우면 사라지고 인쇄에는 쓴 것만 나온다', async () => {
  const page = await openPage(browser);
  assert.match(await page.textContent(sel('header-age')), /나이/);
  await page.click(sel('header-age'));
  await page.keyboard.type('만 29세');
  await page.click(sel('header-military'));
  await page.keyboard.type('병역: 군필 (해병 병장 만기전역, 2021.11 ~ 2023.05)');
  await page.click(sel('header-name'));
  await page.waitForTimeout(900);
  await reloadKeepingStorage(page);
  assert.equal((await page.textContent(sel('header-age'))).trim(), '만 29세');
  assert.match(await page.textContent(sel('header-military')), /해병 병장 만기전역/);
  const exported = await page.evaluate(() => UI.buildContentPayload().fields);
  assert.equal(exported['header-age'], '만 29세');
  assert.match(exported['header-military'], /2021\.11 ~ 2023\.05/);
  // 인쇄: 쓴 칸은 보이고, 예시 그대로인 블로그는 빠진다
  await page.emulateMedia({ media: 'print' });
  assert.equal(await page.isVisible(sel('header-age')), true);
  assert.equal(await page.isVisible(sel('header-military')), true);
  assert.equal(await page.isVisible(sel('header-blog')), false);
  await page.emulateMedia({ media: 'screen' });
  // 병역 예시 라이브러리
  await page.click('#example-library-btn');
  await page.click('#example-tabs .tool-tab:has-text("병역")');
  assert.ok((await page.$$eval('#example-list .tool-item', (e) => e.length)) >= 10);
  await page.click('#example-list .tool-item:has-text("사회복무요원")');
  await page.click('#example-apply');
  assert.match(await page.textContent(sel('header-military')), /사회복무요원/);
  assert.deepEqual(page.errors, []);
});

test('기타 문서: 추가·삭제·저장 복원, 링크 검사, 예시, 포트폴리오 반영', async () => {
  const page = await openPage(browser);
  // 안 쓴 섹션은 인쇄에서 빠진다
  await page.emulateMedia({ media: 'print' });
  assert.equal(await page.isVisible('.section[data-section-toggle="documents"]'), false);
  await page.emulateMedia({ media: 'screen' });
  // 직접 쓰기
  await page.click(sel('doc-1-name')); await page.keyboard.press('Control+A'); await page.keyboard.type('AI 코드 검증일지');
  await page.click(sel('doc-1-link')); await page.keyboard.press('Control+A'); await page.keyboard.type('github.com/me/repo/blob/main/docs/a.md');
  await page.click(sel('doc-1-desc')); await page.keyboard.press('Control+A'); await page.keyboard.type('결함 4건 기록');
  await page.click('#add-doc-btn');
  assert.equal(await page.locator('.doc-row[data-dynamic-item="true"]').count(), 1);
  await page.click(sel('doc-3-name')); await page.keyboard.press('Control+A'); await page.keyboard.type('위험한 링크');
  await page.click(sel('doc-3-link')); await page.keyboard.press('Control+A'); await page.keyboard.type('javascript:alert(1)');
  await page.click(sel('header-name'));
  const md = await page.evaluate(() => Portfolio.build());
  assert.match(md, /## 기타 문서/);
  assert.match(md, /\[AI 코드 검증일지\]\(https:\/\/github\.com\/me\/repo\/blob\/main\/docs\/a\.md\) — 결함 4건 기록/);
  assert.ok(!/javascript:/.test(md), 'javascript: 링크는 링크로 걸리지 않음');
  assert.match(md, /- 위험한 링크/);
  // 저장 후 새로 고침: 추가한 행이 복원된다
  await page.waitForTimeout(900);
  await reloadKeepingStorage(page);
  assert.equal(await page.locator('.doc-row[data-dynamic-item="true"]').count(), 1);
  assert.equal((await page.textContent(sel('doc-3-name'))).trim(), '위험한 링크');
  // 삭제 (추가한 행)
  await page.locator('.doc-row[data-dynamic-item="true"] .dynamic-delete-btn').click();
  assert.equal(await page.locator('.doc-row[data-dynamic-item="true"]').count(), 0);
  // 예시 라이브러리
  await page.click('#example-library-btn');
  await page.click('#example-tabs .tool-tab:has-text("기타 문서")');
  assert.ok((await page.$$eval('#example-list .tool-item', (e) => e.length)) >= 10);
  await page.click('#example-list .tool-item >> nth=0');
  await page.click('#example-list .tool-item >> nth=1');
  await page.click('#example-list .tool-item >> nth=2');
  await page.click('#example-apply');
  assert.equal(await page.locator('.doc-row').count(), 3);
  assert.match(await page.textContent(sel('doc-3-name')), /결과보고서/);
  // 섹션의 "예시 10개+"·"예시 보기" 버튼
  await page.click('.section[data-section-toggle="documents"] .example-lib-btn');
  assert.ok(await page.isVisible('#example-overlay.active'));
  await page.keyboard.press('Escape');
  await page.click('.section[data-section-toggle="documents"] .inline-sample-btn:not(.example-lib-btn)');
  assert.ok(await page.isVisible('#example-overlay.active'));
  assert.deepEqual(page.errors, []);
});

test('기술 스택: 추가할 때 분류를 고르면 그 이름과 대표 기술이 든 행이 생긴다', async () => {
  const page = await openPage(browser);
  assert.equal(await page.isVisible('#skill-preset-menu'), false);
  await page.click('#add-skill-row-btn');
  assert.equal(await page.isVisible('#skill-preset-menu'), true);
  const labels = await page.$$eval('#skill-preset-menu .skill-preset-chip', (e) => e.map((x) => x.textContent));
  assert.deepEqual(labels, ['클라우드·인프라', 'AI', '테스트', '보안·인증', '협업·도구', '모니터링·기타', '직접 입력']);
  const expected = { '클라우드·인프라': 'AWS EC2', 'AI': 'Spring AI', '테스트': 'JUnit 5', '보안·인증': 'JWT', '협업·도구': 'GitHub Actions', '모니터링·기타': 'MySQL EXPLAIN' };
  let first = true;
  for (const label of Object.keys(expected)) {
    if (!first) await page.click('#add-skill-row-btn'); // 첫 바퀴는 위에서 이미 목록을 열어 둠
    first = false;
    await page.click('#skill-preset-menu .skill-preset-chip:text-is("' + label + '")');
    assert.equal(await page.isVisible('#skill-preset-menu'), false, '고르면 목록이 닫힘');
  }
  const rows = await page.$$eval('.skill-row[data-dynamic-item="true"]', (e) => e.map((r) => [r.querySelector('.skill-cat').innerText, r.querySelector('.skill-tags').innerText]));
  assert.equal(rows.length, 6);
  for (const [label, tag] of Object.entries(expected)) assert.ok(rows.some((r) => r[0] === label && r[1].includes(tag)), label + ' → ' + JSON.stringify(rows));
  // 직접 입력은 예전처럼 빈 행
  await page.click('#add-skill-row-btn');
  await page.click('#skill-preset-menu .skill-preset-chip:text-is("직접 입력")');
  assert.equal(await page.locator('.skill-row[data-dynamic-item="true"]').nth(6).locator('.skill-cat').innerText(), '[카테고리명]');
  // 저장 후 복원, 포트폴리오 기술 표에 반영
  await page.waitForTimeout(900);
  await reloadKeepingStorage(page);
  assert.equal(await page.locator('.skill-row[data-dynamic-item="true"]').count(), 7);
  const md = await page.evaluate(() => Portfolio.build());
  assert.match(md, /\| 테스트 \| JUnit 5, Mockito, MockMvc, AssertJ \|/);
  assert.deepEqual(page.errors, []);
});

test('말풍선 투어에 나이·병역, 기타 문서 단계가 있고, 화면의 id는 중복되지 않는다', async () => {
  const page = await openPage(browser);
  const keys = await page.evaluate(() => GuidedTour.list.map((s) => s.key));
  assert.ok(keys.indexOf('personal') > keys.indexOf('contact') && keys.indexOf('personal') < keys.indexOf('about'));
  assert.ok(keys.indexOf('documents') > keys.indexOf('cert') && keys.indexOf('documents') < keys.indexOf('intro'));
  const dup = await page.evaluate(() => {
    const seen = {}; const out = [];
    document.querySelectorAll('[id]').forEach((e) => { if (seen[e.id]) out.push(e.id); seen[e.id] = 1; });
    document.querySelectorAll('[data-field-id]').forEach((e) => { const k = 'f:' + e.getAttribute('data-field-id'); if (seen[k]) out.push(k); seen[k] = 1; });
    return out;
  });
  assert.deepEqual(dup, [], '중복 id 없음');
});
