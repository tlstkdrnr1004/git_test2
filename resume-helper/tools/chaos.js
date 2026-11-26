// 기능끼리 얽히는 경우 점검: 옛 백업 가져오기, 버전 전환, 시작 화면, 모바일, Esc, 내보내기 버전 표시
const fs = require('node:fs');
const { launch, openPage } = require(require('node:path').join(__dirname, '..', 'tests', 'helpers'));
const sel = (id) => '[data-field-id="' + id + '"]';
const results = [];
const check = async (name, fn) => {
  try { const r = await fn(); results.push((r ? 'PASS ' : 'FAIL ') + name + (r === true || r === false ? '' : ' -> ' + JSON.stringify(r))); }
  catch (e) { results.push('FAIL ' + name + ' -> ' + e.message.split('\n')[0]); }
};
(async () => {
  const b = await launch();
  const page = await openPage(b, { acceptDownloads: true });
  page.promptAnswer = '회사A';

  await check('옛 백업(v1 형식) 가져오기: 추가 행 복원', async () => {
    const old = { fields: { 'header-name': '홍옛날', 'skills-extra-1': '<span class="skill-tag">Kotlin</span>', 'edu-3-name': '추가교육', 'cert-3-name': '추가자격', 'doc-3-name': '추가문서' }, toggles: {} };
    await page.setInputFiles('#import-file-input', { name: 'old.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(old)) });
    await page.waitForTimeout(500);
    return (await page.textContent(sel('edu-3-name'))) === '추가교육' && (await page.textContent(sel('cert-3-name'))) === '추가자격' && (await page.textContent(sel('doc-3-name'))) === '추가문서' && (await page.textContent(sel('skills-extra-1-tags'))).includes('Kotlin');
  });

  await check('버전 저장·불러오기: 문서 행·삭제한 프로젝트 상태까지 복원', async () => {
    await page.locator('.project-item').nth(2).locator('.static-delete-btn').click();
    await page.click('#version-save-btn');
    await page.click('.restore-chip:has-text("프로젝트 3 되살리기")');
    await page.locator('.doc-row[data-dynamic-item="true"] .dynamic-delete-btn').click();
    const mid = (await page.locator('.project-item').nth(2).isVisible()) && (await page.locator(sel('doc-3-name')).count()) === 0;
    await page.click('#version-load-btn');
    return mid && !(await page.locator('.project-item').nth(2).isVisible()) && (await page.textContent(sel('doc-3-name'))) === '추가문서';
  });

  await check('삭제한 프로젝트가 있어도 주제·역할로 채우기', async () => {
    await page.click('#starter-open-btn');
    await page.click('.starter-theme[data-theme="trip"]');
    await page.click('.starter-role');
    await page.click('#starter-apply');
    await page.click('.tour-close');
    return /여행|코스/.test(await page.textContent(sel('project-1-name'))) && !(await page.locator('.project-item').nth(2).isVisible());
  });

  await check('Esc로 양식 창 닫기', async () => {
    await page.click('#format-open-btn');
    const open = await page.isVisible('#format-overlay.active');
    await page.keyboard.press('Escape');
    return open && !(await page.isVisible('#format-overlay.active'));
  });

  await check('양식 탭 5개 모두 열리고 오류 없음', async () => {
    await page.click('#format-open-btn');
    for (const k of ['saramin', 'jobkorea', 'au', 'us', 'jp']) await page.click('#format-tabs .tool-tab[data-format="' + k + '"]');
    await page.waitForFunction(() => !FormatExport.busy, null, { timeout: 30000 });
    await page.keyboard.press('Escape');
    return page.errors.length === 0;
  });

  await check('백업 파일에 앱 버전 기록', async () => {
    const [d] = await Promise.all([page.waitForEvent('download'), page.click('#export-json-btn')]);
    const j = JSON.parse(fs.readFileSync(await d.path(), 'utf8'));
    return /^v10/.test(j.appVersion || '') && (await page.textContent('#app-version')).startsWith('v10');
  });

  await check('되돌리기: 추가 문서 행 삭제 → 되돌리면 다시 생김', async () => {
    await page.click('#add-doc-btn');
    const n = await page.locator('.doc-row[data-dynamic-item="true"]').count();
    await page.locator('.doc-row[data-dynamic-item="true"] .dynamic-delete-btn').last().click();
    await page.click('#undo-change-btn');
    return (await page.locator('.doc-row[data-dynamic-item="true"]').count()) === n;
  });

  await check('붙여넣기는 글자만 (서식 제거)', async () => {
    await page.click(sel('about-summary'));
    await page.keyboard.press('Control+A');
    await page.evaluate(() => {
      const dt = new DataTransfer();
      dt.setData('text/plain', '붙여넣은 글');
      dt.setData('text/html', '<b style="color:red">붙여넣은 글</b>');
      document.activeElement.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    });
    const html = await page.$eval(sel('about-summary'), (e) => e.innerHTML);
    return html.includes('붙여넣은 글') && !/<b|style=/.test(html);
  });

  // 모바일
  const m = await openPage(b, { viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true });
  await check('모바일: 가로로 넘치는 화면 없음 (이력서·양식 창)', async () => {
    const w1 = await m.evaluate(() => document.scrollingElement.scrollWidth);
    await m.evaluate(() => FormatExport.open('jp'));
    await m.waitForFunction(() => !FormatExport.busy, null, { timeout: 30000 });
    const overlay = await m.evaluate(() => { const c = document.querySelector('#format-overlay .tool-card').getBoundingClientRect(); return c.right; });
    return w1 <= 391 && overlay <= 391 ? true : { pageWidth: w1, overlayRight: overlay };
  });
  await check('모바일: 오류 없음', async () => m.errors.length === 0 || m.errors);
  console.log(results.join('\n'));
  console.log('page errors:', page.errors);
  await b.close();
})();
