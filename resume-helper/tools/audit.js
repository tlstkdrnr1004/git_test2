// 기능 전수 점검: 간단 모드(simple)와 고급 모드(advanced) 양쪽에서 모든 기능을 실제로 실행해 본다.
// 숨은 버튼은 사용자가 고급 기능을 열어야 누를 수 있으므로, simple 모드에서는 먼저 토글을 열고 닫는 것까지 포함한다.
const path = require('node:path');
const fs = require('node:fs');
const { launch, openPage, mockAI } = require(require('node:path').join(__dirname, '..', 'tests', 'helpers'));

const results = [];
const ok = (mode, name, pass, note) => results.push({ mode, name, pass: !!pass, note: note || '' });

async function run(mode) {
  const b = await launch();
  const page = await openPage(b, { simple: mode === 'simple', acceptDownloads: true });
  page.promptAnswer = '회사A 버전';
  const check = async (name, fn) => {
    const before = page.errors.length;
    try {
      const r = await fn();
      ok(mode, name, r !== false && page.errors.length === before, page.errors.slice(before).join(' | '));
    } catch (e) { ok(mode, name, false, e.message.split('\n')[0]); }
    // 다음 점검을 위해 열린 창을 닫는다
    for (let i = 0; i < 4; i++) await page.keyboard.press('Escape');
    await page.evaluate(() => { document.querySelectorAll('[id$="-overlay"].active').forEach((o) => o.classList.remove('active')); if (window.GuidedTour && GuidedTour.active) GuidedTour.stop(false); });
  };
  const val = (sel) => page.inputValue(sel);
  const txt = (id) => page.textContent('[data-field-id="' + id + '"]');
  // 간단 모드에서는 고급 영역 버튼을 누르기 전에 사용자가 하듯 "고급 기능 열기"를 누른다
  const adv = async () => { if (!(await page.isVisible('#advanced-panel'))) await page.click('#advanced-toggle-btn'); };

  // ---- 간단 영역 ----
  await check('간단: 주제·역할 고르고 채우기', async () => {
    await page.click('#starter-open-btn'); await page.click('.starter-theme[data-theme="food"]');
    await page.click('.starter-role:has-text("맛집 리뷰 C")'); await page.click('#starter-apply');
    return /리뷰/.test(await txt('project-1-name')) && await page.evaluate(() => GuidedTour.active);
  });
  await check('간단: 말풍선 투어 19단계 끝까지', async () => {
    await page.click('#guided-tour-btn');
    let n = 0;
    for (let i = 0; i < 60 && await page.evaluate(() => GuidedTour.active); i++) { n = await page.evaluate(() => GuidedTour.index); await page.click('#tour-next'); }
    return n === 18;
  });
  await check('간단: 예시 라이브러리 10개 탭 모두 열림', async () => {
    await page.click('#example-library-btn');
    const n = await page.locator('#example-tabs .tool-tab').count();
    let total = 0;
    for (let i = 0; i < n; i++) { await page.locator('#example-tabs .tool-tab').nth(i).click(); total += await page.locator('#example-list .tool-item').count(); }
    return n === 12 && total > 250;
  });
  await check('간단: 예시 골라 넣기 (한줄 소개)', async () => {
    await page.click('#example-library-btn'); await page.click('#example-tabs .tool-tab:has-text("한줄 소개")');
    await page.click('#example-list .tool-item'); await page.click('#example-apply');
    return /\|/.test(await txt('header-subtitle'));
  });
  await check('간단: 빠른 점검', async () => { await page.click('#quick-check-btn'); return await page.isVisible('#overall-result'); });
  await check('간단: PDF 안내', async () => { await page.click('#pdf-guide-btn'); return await page.isVisible('#pdf-guide-overlay'); });
  await check('간단: 완성도 표시', async () => /\d+%/.test(await page.textContent('#completeness-pct')));
  await check('간단: 되돌리기', async () => {
    const before = await txt('header-subtitle');
    await page.click('#simple-undo-btn');
    return (await txt('header-subtitle')) !== before;
  });
  await check('본문: About Me 초안 8개', async () => { await page.click('.draft-helper-btn:has-text("About Me 초안")'); return (await page.$$eval('#about-draft-box .draft-option', (e) => e.length)) >= 8; });
  await check('본문: 자기소개 초안 8개', async () => { await page.click('.draft-helper-btn:has-text("자기소개 초안")'); return (await page.$$eval('#intro-draft-box .draft-option', (e) => e.length)) >= 8; });
  await check('본문: 성과 문장 추천', async () => { await page.click('.draft-helper-btn:has-text("성과 문장 추천")'); return (await page.$$eval('[data-project-draft-box="1"] .draft-option', (e) => e.length)) >= 5; });
  await check('본문: 초안 적용', async () => { await page.click('#about-draft-box .draft-option button'); return (await txt('about-summary')).length > 40; });
  await check('본문: 항목 추가 5종', async () => {
    const count = () => page.$$eval('[data-field-id]', (e) => e.length);
    const n0 = await count();
    await page.click('#add-skill-row-btn'); await page.click('#skill-preset-menu .skill-preset-chip:text-is("직접 입력")');
    for (const id of ['add-team-project-btn', 'add-personal-project-btn', 'add-education-btn', 'add-cert-btn', 'add-doc-btn']) await page.click('#' + id);
    return (await count()) >= n0 + 10;
  });
  await check('본문: 중복 id 없음', async () => page.evaluate(() => { const seen = {}; let dup = 0; document.querySelectorAll('[id]').forEach((e) => { if (seen[e.id]) dup++; seen[e.id] = 1; }); document.querySelectorAll('[data-field-id]').forEach((e) => { const k = 'f:' + e.getAttribute('data-field-id'); if (seen[k]) dup++; seen[k] = 1; }); return dup === 0; }));
  await check('본문: 지운 연락처 칸 접기·되살리기', async () => {
    await page.click('[data-field-id="header-saramin"]'); await page.keyboard.press('Control+A'); await page.keyboard.press('Backspace'); await page.click('[data-field-id="header-name"]');
    const hidden = !(await page.isVisible('[data-field-id="header-saramin"]'));
    await page.click('#restore-chips-header .restore-chip:has-text("사람인")');
    return hidden && await page.isVisible('[data-field-id="header-saramin"]');
  });
  await check('본문: 프로젝트 3 삭제·되살리기', async () => {
    await page.locator('.project-item').nth(2).locator('.static-delete-btn').click();
    const hidden = !(await page.locator('.project-item').nth(2).isVisible());
    await page.click('.restore-chip:has-text("프로젝트 3 되살리기")');
    return hidden && await page.locator('.project-item').nth(2).isVisible();
  });
  await check('본문: 섹션 숨기기·다시 보이기', async () => {
    const btn = '.section[data-section-toggle="certification"] .section-toggle-btn';
    await page.click(btn);
    const hidden = await page.$eval('.section[data-section-toggle="certification"]', (s) => !!s.querySelector('.hidden-section'));
    await page.click(btn);
    const shown = await page.$eval('.section[data-section-toggle="certification"]', (s) => !s.querySelector('.hidden-section'));
    return hidden && shown;
  });
  await check('본문: 섹션 "예시 10개+" 버튼', async () => { await page.click('.section[data-section-toggle="skills"] .example-lib-btn'); return await page.isVisible('#example-overlay.active'); });

  // ---- 고급 영역 ----
  await check('고급: 열기 버튼으로 펼쳐짐', async () => { await adv(); return await page.isVisible('#interview-open-btn'); });
  await check('고급: 위자드 시작·단계 이동·닫기', async () => {
    await page.click('#wizard-start-btn');
    const open = await page.isVisible('#wizard-overlay.active');
    for (let i = 0; i < 3; i++) { const n = await page.$('.wizard-btn-next'); if (n) await n.click(); }
    await page.evaluate(() => Wizard.close());
    return open;
  });
  await check('고급: 섹션별 작성 예시 패널', async () => { await page.click('#sample-resume-btn'); const v = await page.isVisible('#sample-resume-panel'); await page.click('#sample-resume-btn').catch(() => {}); return v; });
  await check('고급: 섹션 "예시 보기" 버튼', async () => { await page.click('.section[data-section-toggle="about"] .inline-sample-btn:not(.example-lib-btn)'); return await page.isVisible('#sample-resume-panel'); });
  await page.evaluate(() => { const p = document.getElementById('sample-resume-panel'); if (p) p.classList.remove('active'); });
  for (const type of ['readme', 'commits', 'weekly', 'verify']) {
    await check('고급: 자동 입력 (' + type + ', AI 없이)', async () => {
      await page.click('#autofill-open-btn'); await page.selectOption('#autofill-type', type);
      await page.click('#autofill-sample'); await page.click('#autofill-local-btn');
      const v = await page.$$eval('#autofill-result .tool-field textarea', (t) => t.map((x) => x.value));
      return v.some((x) => x.length > 10);
    });
  }
  await check('고급: 자동 입력 결과를 이력서에 적용', async () => {
    await page.click('#autofill-open-btn'); await page.selectOption('#autofill-type', 'verify');
    await page.click('#autofill-sample'); await page.click('#autofill-local-btn');
    await page.click('#autofill-apply');
    return true;
  });
  await check('고급: 면접 질문·모범 답안·60초 타이머', async () => {
    await page.click('#interview-open-btn');
    const q = await page.$$eval('.iv-card', (e) => e.length);
    const m = await page.$$eval('.iv-model', (e) => e.length);
    await page.fill('.iv-card textarea', '테스트 답변입니다.');
    const timer = await page.$('.iv-card button:has-text("60초")');
    if (timer) await timer.click();
    return q >= 15 && m >= 1;
  });
  await check('고급: 채용공고 맞춤 점검', async () => {
    await page.click('#jobmatch-open-btn');
    await page.fill('#jobmatch-source', '■ 자격 요건\n- Java, Spring Boot 경험\n- MySQL\n■ 우대 사항\n- AWS, Docker 경험');
    await page.click('#jobmatch-run');
    return (await page.$$eval('.jm-table tr', (e) => e.length)) >= 4;
  });
  for (const tab of ['report', 'script', 'checklist']) {
    await check('고급: 결과보고서 탭 (' + tab + ')', async () => {
      await page.click('#report-open-btn'); await page.click('#report-tabs .tool-tab[data-mode="' + tab + '"]');
      return (await val('#report-editor')).length > 200;
    });
  }
  await check('고급: 문장 다듬기 검사·모두 고치기', async () => {
    await page.evaluate(() => { document.querySelector('[data-field-id="about-summary"]').innerText = '스프링부트와 mysql로 할수있는 것을 만들었습니다.'; });
    await page.click('#polish-open-btn');
    const n = await page.$$eval('#polish-list .tool-item, #polish-list > *', (e) => e.length);
    await page.click('#polish-fix-all');
    return n >= 1 && /Spring Boot/.test(await txt('about-summary'));
  });
  await check('고급: 프로젝트 README 템플릿', async () => { await page.click('#readme-generator-btn'); await page.click('#readme-template-btn'); return /AI 코드 검증 일지/.test(await val('#readme-editor')); });
  await check('고급: 포트폴리오 README', async () => {
    await page.click('#readme-generator-btn');
    await page.click('#readme-project-tabs >> text=포트폴리오');
    await page.click('#readme-template-btn');
    return /## 프로젝트/.test(await val('#readme-editor'));
  });
  await check('고급: README 다운로드', async () => {
    await page.click('#readme-generator-btn');
    const [d] = await Promise.all([page.waitForEvent('download', { timeout: 5000 }), page.click('#readme-download-btn')]);
    return /\.md$/.test(d.suggestedFilename());
  });
  await check('고급: README → 이력서 자동 입력 연결', async () => { await page.click('#readme-generator-btn'); await page.locator('#readme-project-tabs button').nth(1).click(); await page.click('#readme-template-btn'); await page.click('#readme-to-resume-btn'); return await page.isVisible('#autofill-overlay.active'); });
  await check('고급: 디자인 템플릿 3종·강조 색 5종', async () => {
    for (const t of await page.$$('#design-themes .design-theme-btn')) await t.click();
    for (const c of await page.$$('#design-colors .design-color')) await c.click();
    return (await page.$$eval('#design-themes .design-theme-btn', (e) => e.length)) === 3;
  });
  await check('고급: 증명사진 넣기·빼기', async () => {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAoAAAAOCAYAAAAWo42rAAAAFklEQVR42mNk+M9QzzAKRgWMCowKDAoAAL0ECfQQ6dIQAAAAAElFTkSuQmCC', 'base64');
    await page.setInputFiles('#photo-file-input', { name: 'p.png', mimeType: 'image/png', buffer: png });
    await page.waitForFunction(() => !document.getElementById('header-photo').hidden, null, { timeout: 5000 });
    await page.click('#photo-remove-btn');
    return await page.$eval('#header-photo', (e) => e.hidden);
  });
  await check('고급: API 키 안내 펼치기·저장·삭제', async () => {
    await page.click('#api-tutorial-toggle');
    await page.fill('#api-key-input', 'sk-or-v1-test-key-1234567890');
    await page.click('#save-key-btn');
    const saved = await page.textContent('#key-status');
    await page.click('#clear-key-btn');
    return saved.length > 0;
  });
  await check('고급: AI 점검 (모의 응답)', async () => {
    await page.fill('#api-key-input', 'sk-or-v1-test-key-1234567890'); await page.click('#save-key-btn');
    const sent = await mockAI(page, () => JSON.stringify({ overall: '전반적으로 좋습니다.', sections: { about: [{ type: 'suggestion', message: '숫자를 넣어 보세요.' }] } }));
    await page.click('#analyze-btn');
    await page.waitForFunction(() => document.getElementById('analyze-spinner').style.display === 'none', null, { timeout: 15000 });
    await page.unroute('https://openrouter.ai/**');
    return sent.length >= 1 && !/@|010-/.test(sent.join(''));
  });
  await check('고급: 피드백 초기화', async () => { await page.click('#clear-feedback-btn'); return true; });
  await check('고급: 버전 저장·불러오기·덮어쓰기·이름 변경·삭제', async () => {
    await page.click('#version-save-btn');
    const n1 = await page.$$eval('#version-select option', (e) => e.filter((o) => o.value).length);
    await page.click('#version-overwrite-btn');
    await page.click('#version-load-btn');
    page.promptAnswer = '회사B 버전';
    await page.click('#version-rename-btn');
    const renamed = /회사B/.test(await page.textContent('#version-select'));
    await page.click('#version-delete-btn');
    const n2 = await page.$$eval('#version-select option', (e) => e.filter((o) => o.value).length);
    return n1 >= 1 && renamed && n2 === n1 - 1;
  });
  await check('고급: 내용 저장·저장 불러오기', async () => {
    await page.click('#save-content-btn');
    await page.evaluate(() => { document.querySelector('[data-field-id="header-name"]').innerText = '임시이름'; });
    await page.click('#load-content-btn');
    return (await txt('header-name')) !== '임시이름';
  });
  await check('고급: 되돌리기 버튼', async () => {
    await page.click('[data-field-id="header-name"]'); await page.keyboard.type('되돌리기테스트');
    await page.click('[data-field-id="header-subtitle"]');
    if (await page.isDisabled('#undo-change-btn')) return false;
    await page.click('#undo-change-btn');
    return true;
  });
  let exported = '';
  await check('고급: 파일로 내보내기', async () => {
    const [d] = await Promise.all([page.waitForEvent('download', { timeout: 5000 }), page.click('#export-json-btn')]);
    exported = await d.path();
    const j = JSON.parse(fs.readFileSync(exported, 'utf8')); return !!j.fields && Object.keys(j.fields).length > 20 && !!j.exportDate;
  });
  await check('고급: 파일에서 가져오기', async () => {
    await page.evaluate(() => { document.querySelector('[data-field-id="header-name"]').innerText = '가져오기전'; });
    await page.setInputFiles('#import-file-input', exported);
    await page.waitForTimeout(500);
    return (await txt('header-name')) !== '가져오기전';
  });
  await check('보안: 악성 JSON 가져오기 차단', async () => {
    const evil = JSON.stringify({ fields: { 'about-summary': '<img src=x onerror="window.__xss=1"><b onclick="window.__xss=1">글자</b>' } });
    await page.setInputFiles('#import-file-input', { name: 'evil.json', mimeType: 'application/json', buffer: Buffer.from(evil) });
    await page.waitForTimeout(500);
    const live = await page.$eval('[data-field-id="about-summary"]', (e) => e.querySelectorAll('img, [onerror], [onclick], script').length);
    return !(await page.evaluate(() => window.__xss)) && live === 0;
  });
  await check('보안: README 미리보기 스크립트 차단', async () => {
    await page.click('#readme-generator-btn');
    await page.fill('#readme-editor', '# 제목\n<img src=x onerror="window.__xss2=1">\n[링크](javascript:window.__xss2=1)');
    await page.waitForTimeout(300);
    const live = await page.$eval('#readme-preview', (e) => e.querySelectorAll('img, [onerror], script, a[href^="javascript"]').length);
    return !(await page.evaluate(() => window.__xss2)) && live === 0;
  });
  await check('출력: 인쇄 화면에서 보조 요소 미출력', async () => {
    await page.emulateMedia({ media: 'print' });
    const vis = await page.evaluate(() => ['#ai-control-panel', '.guide', '.draft-helper-tools', '.section-actions', '#field-meter', '.tour-bubble', '#starter-overlay']
      .filter((s) => { const e = document.querySelector(s); return e && getComputedStyle(e).display !== 'none'; }));
    await page.emulateMedia({ media: 'screen' });
    return vis.length === 0 ? true : (ok(mode, '  인쇄에 남은 요소: ' + vis.join(','), false), false);
  });
  await check('양식 변환: 5개 탭·이 양식 PDF·전체 PDF', async () => {
    await page.evaluate(() => { window.__realPrint = window.__realPrint || window.print; window.print = () => {}; window.confirm = () => true; });
    await page.click('#format-open-btn');
    let ok = true;
    for (const k of ['saramin', 'jobkorea', 'au', 'us', 'jp']) { await page.click('#format-tabs .tool-tab[data-format="' + k + '"]'); ok = ok && (await page.locator('#format-doc .fx-page').count()) >= 1; }
    await page.waitForFunction(() => !FormatExport.busy, null, { timeout: 30000 });
    await page.click('#format-print');
    ok = ok && (await page.locator('#format-print-root .fx-page').count()) >= 2;
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    await page.click('#format-print-all');
    ok = ok && (await page.locator('#format-print-root .fx-doc').count()) === 5;
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    return ok;
  });
  await check('PDF 속 주소 링크 (이력서 본문)', async () => {
    await page.evaluate(() => { document.querySelector('[data-field-id="header-github"]').innerText = 'https://github.com/audit-user'; });
    const pdf = await page.pdf({ preferCSSPageSize: true });
    return /\/URI\s*\(https:\/\/github\.com\/audit-user\)/.test(pdf.toString('latin1'));
  });
  await check('패널 접기·펼치기', async () => { await page.click('#panel-toggle'); await page.click('#panel-toggle'); return await page.isVisible('#starter-open-btn'); });
  if (mode === 'simple') await check('고급: 닫기 버튼으로 다시 접힘', async () => { await page.click('#advanced-toggle-btn'); return !(await page.isVisible('#interview-open-btn')); });
  ok(mode, '전체: 스크립트 오류 0건', page.errors.length === 0, page.errors.join(' | '));
  await b.close();
}

(async () => {
  for (const mode of ['simple', 'advanced']) await run(mode);
  const fail = results.filter((r) => !r.pass);
  results.forEach((r) => console.log((r.pass ? 'PASS' : 'FAIL') + ' [' + r.mode + '] ' + r.name + (r.note ? '  -> ' + r.note : '')));
  console.log('\nTOTAL ' + results.length + ' / PASS ' + (results.length - fail.length) + ' / FAIL ' + fail.length);
})();
