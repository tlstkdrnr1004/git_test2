// v10: PDF 속 주소 링크, 인쇄 모양(A4 판정·머리글), 채용 사이트 양식 5종(사람인·잡코리아·호주·미국·일본)과 번역
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { launch } = require('./helpers');

const URL = pathToFileURL(path.join(__dirname, '..', 'index.html')).href;
const sel = (id) => '[data-field-id="' + id + '"]';
let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser.close(); });

// translator: 'none'이면 브라우저 내장 번역이 없는 것처럼, 함수면 가짜 번역기를 넣는다
async function open(opts = {}) {
  const context = await browser.newContext({ viewport: opts.viewport || { width: 1400, height: 900 } });
  await context.addInitScript((mode) => {
    localStorage.setItem('resume-onboarding-done', 'true');
    if (localStorage.getItem('resume-simple-mode') === null) localStorage.setItem('resume-simple-mode', 'false');
    if (mode === 'none') { try { delete window.Translator; } catch (e) {} window.Translator = undefined; }
    if (mode === 'fake') {
      window.__trCalls = 0;
      window.Translator = {
        availability: async () => 'available',
        create: async (o) => ({ translate: async (t) => { window.__trCalls++; return '<' + o.targetLanguage + '>' + t; } })
      };
    }
  }, opts.translator || 'none');
  const page = await context.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.on('dialog', (d) => d.accept());
  await page.goto(URL);
  return page;
}

// 사용자가 보내 준 이력서와 비슷한 내용
async function fillResume(page) {
  await page.evaluate(() => {
    const set = (id, t) => { document.querySelector('[data-field-id="' + id + '"]').innerText = t; };
    set('header-name', '홍길동'); set('header-age', '만 29세');
    set('header-subtitle', '클라우드 백엔드 지원 | Spring Boot · AWS EC2(Ubuntu) · S3 · GitHub Actions');
    set('header-email', 'gildong.hong@example.com'); set('header-phone', '010-9876-5432');
    set('header-github', 'https://github.com/example-dev');
    set('header-military', '병역: 군필 (해병 병장 만기전역, 2021.11 ~ 2023.05)');
    set('project-1-name', '고객관리 CRM - 팀 공동 개발을 위한 CRM 웹 서비스');
    set('project-1-meta', '2026.10.28 ~ 2026.11.30 | 팀 5명 (파이널 프로젝트)');
    set('project-1-role', '담당: 부팀장 / CI 구성, AWS 인프라 구축');
    set('project-1-result', 'GitHub Actions → S3 → EC2 배포 흐름 검증, 배포 시간 15분 → 3분');
    set('project-1-link', 'GitHub: github.com/example-dev/busan-crm');
    set('about-summary', '기능 구현에 그치지 않고 AWS 배포와 GitHub Actions 자동 배포까지 직접 구성했습니다. 자세한 기록은 https://velog.io/@example-dev/crm-deploy 에 있습니다.');
    set('edu-2-period', '2021.03 ~ 2025.06'); set('edu-2-name', '부산외국어대학교'); set('edu-2-detail', '중국어중국학과 제적');
    set('cert-1-date', '2012.03'); set('cert-1-name', '디지털정보활용능력(DIAT) 워드프로세서 고급'); set('cert-1-issuer', '한국정보통신진흥협회');
    set('doc-1-name', 'AI 코드 검증일지'); set('doc-1-link', 'http://example.com/ai-verify-log.md'); set('doc-1-desc', '결함 4건 기록');
    UI.refreshPlaceholders();
  });
}
const pdfLinks = (buf) => [...new Set((buf.toString('latin1').match(/\/URI\s*\(([^)]*)\)/g) || []).map((x) => x.replace(/^\/URI\s*\(|\)$/g, '')))];
const pdfPages = (buf) => (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;

test('PDF로 저장하면 이력서의 http·https 주소를 누를 수 있다 (저장 내용은 그대로)', async () => {
  const page = await open();
  await fillResume(page);
  const before = await page.evaluate(() => UI.buildContentPayload().fields);
  const pdf = await page.pdf({ preferCSSPageSize: true });
  const links = pdfLinks(pdf);
  for (const url of ['https://github.com/example-dev', 'https://github.com/example-dev/busan-crm', 'https://velog.io/@example-dev/crm-deploy', 'http://example.com/ai-verify-log.md', 'mailto:gildong.hong@example.com']) {
    assert.ok(links.includes(url), url + ' 링크 없음: ' + JSON.stringify(links));
  }
  assert.ok(!links.some((u) => /tistory|saramin|your-id/.test(u)), '예시 문구 [ ] 가 든 주소는 링크로 만들지 않음: ' + JSON.stringify(links));
  // 인쇄가 끝나면 링크 껍데기는 사라지고 저장 내용은 바뀌지 않는다
  assert.equal(await page.evaluate(() => document.querySelectorAll('.page a.print-link').length), 0);
  assert.deepEqual(await page.evaluate(() => UI.buildContentPayload().fields), before);
  assert.deepEqual(page.errors, []);
});

test('인쇄 모양: 머리글이 휴대폰 모양으로 쌓이지 않고, A4 초과 판정이 실제 PDF 쪽수와 맞다', async () => {
  const page = await open();
  await page.setViewportSize({ width: 703, height: 900 });
  await page.emulateMedia({ media: 'print' });
  assert.equal(await page.$eval('.header', (e) => getComputedStyle(e).flexDirection), 'row');
  await page.emulateMedia({ media: null }); // 'screen'으로 고정하면 page.pdf도 화면 모양으로 찍힌다
  await page.setViewportSize({ width: 1400, height: 900 });
  const verdict = () => page.evaluate(() => ValidationEngine.detectPageOverflow().overflow);
  assert.equal(await verdict(), false);
  assert.equal(pdfPages(await page.pdf({ preferCSSPageSize: true })), 1);
  await page.evaluate(() => {
    const ul = document.querySelector('[data-field-id="project-1-detail"]');
    for (let i = 0; i < 30; i++) { const li = document.createElement('li'); li.textContent = '추가 구현 내용 ' + i + ' - 길이를 늘리기 위한 테스트 문장입니다'; ul.appendChild(li); }
  });
  assert.equal(await verdict(), true);
  assert.ok(pdfPages(await page.pdf({ preferCSSPageSize: true })) >= 2);
  // 페이지 아래쪽에서 재도 스크롤 위치가 튀지 않는다
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const y = await page.evaluate(() => window.scrollY);
  await page.evaluate(() => ValidationEngine.detectPageOverflow());
  assert.equal(await page.evaluate(() => window.scrollY), y);
  assert.deepEqual(page.errors, []);
});

test('양식 5종: 항목 순서와 나라별 규칙 (사진·나이·병역·비자·年/月 표)', async () => {
  const page = await open();
  await fillResume(page);
  await page.click('#format-open-btn');
  const tabs = await page.$$eval('#format-tabs .tool-tab', (e) => e.map((x) => x.getAttribute('data-format')));
  assert.deepEqual(tabs, ['saramin', 'jobkorea', 'au', 'us', 'jp']);
  const h2 = () => page.$$eval('#format-doc h2', (e) => e.map((x) => x.textContent));
  const text = () => page.textContent('#format-doc');

  // 사람인
  let heads = await h2();
  assert.deepEqual(heads.slice(0, 4), ['기본정보', '희망근무조건', '학력', '경력']);
  assert.ok(heads.includes('병역') && heads.indexOf('병역') < heads.indexOf('자기소개서'));
  let t = await text();
  assert.match(t, /만 29세/);
  assert.match(t, /해병대병장2021\.11 ~ 2023\.05만기전역/);
  assert.match(t, /부산외국어대학교중국어중국학과 제적중퇴/);
  // 잡코리아
  await page.click('#format-tabs .tool-tab[data-format="jobkorea"]');
  heads = await h2();
  assert.equal(heads[0], '인적사항');
  assert.equal(heads[heads.length - 1], '경력기술서 (프로젝트)');
  assert.ok(heads.includes('취업우대·병역'));
  // 미국: 사진·나이 없음, 이름 로마자, 국제 전화번호, 병역은 영어로
  await page.click('#format-tabs .tool-tab[data-format="us"]');
  t = await text();
  assert.equal(await page.textContent('#format-doc h1'), 'Gildong Hong');
  assert.equal(await page.locator('#format-doc img').count(), 0);
  assert.ok(!/29세|Age/.test(t), '나이 없음');
  assert.match(t, /\+82 10-9876-5432/);
  assert.match(t, /Military service: Republic of Korea Marine Corps, Sergeant — Honorable discharge \(Nov 2021 – May 2023\)/);
  assert.match(t, /Oct 2026 – Nov 2026/);
  assert.ok(!/Referees/.test(t));
  // 호주: 비자 줄과 Referees
  await page.click('#format-tabs .tool-tab[data-format="au"]');
  t = await text();
  assert.match(t, /Work rights:/);
  assert.match(t, /Referees\s*Available upon request\./);
  // 일본: 履歴書 + 職務経歴書, 満年齢, 兵役, 以上
  await page.click('#format-tabs .tool-tab[data-format="jp"]');
  t = await text();
  for (const s of ['履 歴 書', '職 務 経 歴 書', '（満 29 歳）', '大韓民国海兵隊　入隊（兵役）', '兵長', '満期除隊', '以上', 'HONG GILDONG', '中途退学']) assert.ok(t.includes(s), s);
  const histRows = await page.$$eval('.fx-jp-hist tbody tr', (rows) => rows.map((r) => Array.from(r.cells).map((c) => c.textContent.trim()).join('|')));
  assert.ok(histRows.includes('2021|11|大韓民国海兵隊　入隊（兵役）'), JSON.stringify(histRows));
  assert.ok(histRows.includes('2023|5|大韓民国海兵隊　兵長　満期除隊'), JSON.stringify(histRows));
  assert.deepEqual(page.errors, []);
});

test('번역: 브라우저 내장 번역으로 영어·일본어 문장을 바꾸고, 다시 열면 저장된 번역을 쓴다', async () => {
  const page = await open({ translator: 'fake' });
  await fillResume(page);
  await page.click('#format-open-btn');
  await page.click('#format-tabs .tool-tab[data-format="us"]');
  await page.waitForFunction(() => !FormatExport.busy && document.querySelectorAll('#format-doc .fx-untr').length === 0);
  const t = await page.textContent('#format-doc');
  assert.match(t, /<en>기능 구현에 그치지 않고/);
  assert.match(t, /Java|Spring Boot/, '영어 기술 이름은 그대로');
  const calls = await page.evaluate(() => window.__trCalls);
  await page.click('#format-tabs .tool-tab[data-format="au"]');
  await page.waitForFunction(() => !FormatExport.busy);
  assert.equal(await page.evaluate(() => window.__trCalls), calls, '같은 문장은 다시 번역하지 않음');
  await page.click('#format-tabs .tool-tab[data-format="jp"]');
  await page.waitForFunction(() => !FormatExport.busy && document.querySelectorAll('#format-doc .fx-untr').length === 0);
  assert.match(await page.textContent('#format-doc'), /<ja>/);
  assert.deepEqual(page.errors, []);
});

test('AI 번역: 숫자를 바꾼 번역은 쓰지 않고, 연락처는 보내지 않는다', async () => {
  const page = await open({ translator: 'none' });
  await fillResume(page);
  const sent = [];
  await page.route('https://openrouter.ai/**', async (route) => {
    const body = JSON.parse(route.request().postData());
    sent.push(body.messages[1].content);
    const items = JSON.parse(body.messages[1].content).items.map((it) => ({
      i: it.i,
      // 결과 문장의 숫자 15→3을 일부러 바꿔 본다
      t: /15분/.test(it.t) ? 'Cut deploy time from 20 to 3 minutes' : 'EN ' + it.t.replace(/[가-힣]/g, 'x')
    }));
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ choices: [{ message: { content: JSON.stringify({ items }) } }] }) });
  });
  await page.evaluate(() => localStorage.setItem('resume-ai-api-key', JSON.stringify('test-key')));
  await page.click('#format-open-btn');
  await page.click('#format-tabs .tool-tab[data-format="us"]');
  assert.match(await page.textContent('#format-translate'), /번역하기 \(\d+문장\)/);
  await page.click('#format-translate');
  await page.waitForFunction(() => !FormatExport.busy);
  const untr = await page.$$eval('#format-doc .fx-untr', (e) => e.map((x) => x.textContent));
  assert.deepEqual(untr.filter((x) => /15분/.test(x)).length, 1, '숫자가 바뀐 번역은 버리고 한국어로 남김: ' + JSON.stringify(untr));
  assert.equal(untr.length, 1);
  assert.ok(sent.length >= 1 && !sent.join('').includes('010-9876-5432') && !sent.join('').includes('gildong.hong@example.com'));
  assert.deepEqual(page.errors, []);
});

test('미리보기에서 고친 내용은 양식별로 남고, 원래 이력서·되돌리기 기록은 그대로', async () => {
  const page = await open();
  await fillResume(page);
  const name = await page.textContent(sel('header-name'));
  const undo = await page.evaluate(() => UI.undoStack.length);
  await page.click('#format-open-btn');
  await page.click('#format-doc h2 >> nth=1');
  await page.keyboard.press('End');
  await page.keyboard.type(' (수정)');
  await page.waitForTimeout(400);
  await page.click('#format-tabs .tool-tab[data-format="jobkorea"]');
  await page.click('#format-tabs .tool-tab[data-format="saramin"]');
  assert.match(await page.textContent('#format-doc h2 >> nth=1'), /\(수정\)/);
  assert.equal(await page.textContent(sel('header-name')), name);
  assert.equal(await page.evaluate(() => UI.undoStack.length), undo);
  await page.click('#format-reset');
  assert.ok(!/\(수정\)/.test(await page.textContent('#format-doc')));
  assert.deepEqual(page.errors, []);
});

test('양식 PDF: 고른 양식만 인쇄되고 링크가 살아 있으며, 5개 양식을 한 PDF로도 저장한다', async () => {
  const page = await open();
  await fillResume(page);
  await page.evaluate(() => { window.print = () => { window.__printed = (window.__printed || 0) + 1; }; });
  await page.click('#format-open-btn');
  await page.click('#format-tabs .tool-tab[data-format="saramin"]');
  await page.click('#format-print');
  assert.equal(await page.evaluate(() => window.__printed), 1);
  await page.emulateMedia({ media: 'print' });
  assert.equal(await page.isVisible('.page'), false, '원래 이력서는 인쇄하지 않음');
  assert.equal(await page.isVisible('#format-print-root .fx-page'), true);
  assert.equal(await page.locator('#format-print-root .fx-blank').count(), 0, '채우지 않은 칸은 PDF에서 뺌');
  await page.emulateMedia({ media: null }); // 'screen'으로 고정하면 page.pdf도 화면 모양으로 찍힌다
  const one = await page.pdf({ preferCSSPageSize: true });
  assert.ok(pdfLinks(one).includes('https://github.com/example-dev/busan-crm'), JSON.stringify(pdfLinks(one)));
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  assert.equal(await page.evaluate(() => document.body.classList.contains('fx-printing')), false);
  assert.equal(await page.evaluate(() => document.getElementById('format-print-root').innerHTML), '');
  // 호주: 비자 칸을 채우지 않으면 비자 줄은 통째로 빠지고, 일본: 생년월일은 손으로 적을 빈칸으로 남는다
  await page.click('#format-tabs .tool-tab[data-format="au"]');
  await page.waitForFunction(() => !FormatExport.busy);
  await page.click('#format-print');
  const auText = await page.textContent('#format-print-root');
  assert.ok(!/Work rights/.test(auText) && /South Korea/.test(auText) && !/\[City\]/.test(auText), auText.slice(0, 200));
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await page.click('#format-tabs .tool-tab[data-format="jp"]');
  await page.waitForFunction(() => !FormatExport.busy);
  await page.click('#format-print');
  assert.match(await page.textContent('#format-print-root'), /　　　　年　　月　　日生（満 29 歳）/);
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await page.click('#format-print-all');
  assert.equal(await page.locator('#format-print-root .fx-doc').count(), 5);
  assert.ok(pdfPages(await page.pdf({ preferCSSPageSize: true })) >= 6);
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  // 원래 이력서 PDF는 다시 정상
  assert.ok(pdfLinks(await page.pdf({ preferCSSPageSize: true })).includes('https://github.com/example-dev'));
  assert.deepEqual(page.errors, []);
});

test('버전 표시와 행 추가 정리(교육·자격증·문서가 같은 모양으로 만들어짐)', async () => {
  const page = await open();
  assert.match(await page.textContent('#app-version'), /^v10/);
  for (const [btn, cls, kind, parts] of [['#add-education-btn', 'edu-row', 'edu', ['period', 'name', 'detail']], ['#add-cert-btn', 'cert-row', 'cert', ['date', 'name', 'issuer']], ['#add-doc-btn', 'doc-row', 'doc', ['name', 'link', 'desc']]]) {
    await page.click(btn);
    const ids = await page.$$eval('.' + cls + '[data-dynamic-item="true"] [data-field-id]', (e) => e.map((x) => x.getAttribute('data-field-id')));
    assert.deepEqual(ids, parts.map((p) => kind + '-3-' + p));
  }
  assert.deepEqual(page.errors, []);
});
