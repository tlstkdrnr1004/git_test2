// v10 정밀 시험: 경계 사례·오류 상황·조합 (링크, 양식 변환, 번역 실패, A4 판정, 모바일)
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { launch } = require('./helpers');

const URL = pathToFileURL(path.join(__dirname, '..', 'index.html')).href;
let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser.close(); });

async function open(opts = {}) {
  const context = await browser.newContext({ viewport: opts.viewport || { width: 1400, height: 900 }, isMobile: !!opts.isMobile, hasTouch: !!opts.isMobile });
  await context.addInitScript((o) => {
    localStorage.setItem('resume-onboarding-done', 'true');
    if (localStorage.getItem('resume-simple-mode') === null) localStorage.setItem('resume-simple-mode', o.simple ? 'true' : 'false');
    if (o.translator === 'none') window.Translator = undefined;
    if (o.translator === 'unavailable') window.Translator = { availability: async () => 'unavailable', create: async () => { throw new Error('x'); } };
    if (o.translator === 'hang') window.Translator = { availability: () => new Promise(() => {}), create: () => new Promise(() => {}) };
    if (o.translator === 'fake') {
      window.__trCalls = 0;
      window.Translator = { availability: async () => 'available', create: async (c) => ({ translate: async (t) => { window.__trCalls++; return '<' + c.targetLanguage + '>' + t; } }) };
    }
  }, { translator: opts.translator || 'none', simple: !!opts.simple });
  const page = await context.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.on('dialog', (d) => d.accept());
  await page.goto(URL);
  return page;
}
const setFields = (page, map) => page.evaluate((m) => {
  Object.keys(m).forEach((id) => {
    const el = document.querySelector('[data-field-id="' + id + '"]');
    if (el.getAttribute('data-storage-format') === 'html') el.innerHTML = m[id]; else el.innerText = m[id];
  });
  UI.refreshPlaceholders();
}, map);
const pdfLinks = (buf) => [...new Set((buf.toString('latin1').match(/\/URI\s*\(([^)]*)\)/g) || []).map((x) => x.replace(/^\/URI\s*\(|\)$/g, '')))];
const pdfPages = (buf) => (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;

test('링크 판정 표: 어떤 글자를 링크로 만드나', async () => {
  const page = await open();
  const cases = {
    'https://github.com/a': 'https://github.com/a',
    'http://example.com': 'http://example.com',
    'https://example.com/path?q=1&x=2#frag': 'https://example.com/path?q=1&x=2#frag',
    'http://13.125.10.20:8080': 'http://13.125.10.20:8080',
    'https://도메인.한국/경로': 'https://도메인.한국/경로',
    'github.com/me/repo': 'https://github.com/me/repo',
    'me.github.io': 'https://me.github.io',
    'www.naver.com': 'https://www.naver.com',
    'myblog.tistory.com/12': 'https://myblog.tistory.com/12',
    'velog.io/@me': 'https://velog.io/@me',
    'linkedin.com/in/me': 'https://linkedin.com/in/me',
    'example.com': '',
    'Spring.io': '',
    'Node.js': '',
    'a@b.com': '',
    'https://': '',
    'http://localhost:8080': '',
    'javascript:alert(1)': '',
    'JAVASCRIPT:alert(1)': '',
    'data:text/html,<b>x</b>': '',
    '[github.com/your-id]': '',
    'github.com/[your-id]/repo': '',
    'https://github.com/"onmouseover=alert(1)': ''
  };
  const got = await page.evaluate((c) => { const out = {}; Object.keys(c).forEach((k) => { out[k] = PrintLinks.toHref(k); }); return out; }, cases);
  assert.deepEqual(got, cases);
  // 주소 앞뒤에 붙은 글자 떼어내기: [앞, 주소, 뒤]
  const split = {
    '(https://a.com).': ['(', 'https://a.com', ').'],
    '주소(https://a.com)와': ['주소(', 'https://a.com', ')와'],
    'https://velog.io/@me/post에서': ['', 'https://velog.io/@me/post', '에서'],
    '문서:github.com/me': ['문서:', 'github.com/me', ''],
    '“https://a.com/x”를': ['“', 'https://a.com/x', '”를'],
    'https://도메인.한국/경로': ['', 'https://도메인.한국/경로', ''],
    'https://www.notion.so/이력서-abc123': ['', 'https://www.notion.so/이력서-abc123', ''],
    'https://a.com/?q=1&u=https://b.com': ['', 'https://a.com/?q=1&u=https://b.com', '']
  };
  const gotSplit = await page.evaluate((c) => { const out = {}; Object.keys(c).forEach((k) => { const t = PrintLinks.splitToken(k); out[k] = [t.lead, t.core, t.tail]; }); return out; }, split);
  assert.deepEqual(gotSplit, split);
});

test('링크로 감싸기: 괄호·문장부호·조사가 붙은 주소, 한 칸에 여러 주소, 목록 속 주소', async () => {
  const page = await open();
  await setFields(page, {
    'about-summary': '배포 주소(https://a.example.com)와 저장소 https://github.com/me/repo, 그리고 https://velog.io/@me/post에서 회고를 볼 수 있습니다. 끝!',
    'project-1-detail': '<li>문서: github.com/me/repo/docs 참고.</li><li>시연 영상은 https://youtu.be/abc123 입니다</li>',
    'project-1-role': '<strong>담당:</strong> 배포 (http://13.125.10.20:8080)'
  });
  const result = await page.evaluate(() => {
    PrintLinks.apply();
    const links = Array.from(document.querySelectorAll('.page a.print-link')).map((a) => [a.textContent, a.getAttribute('href')]);
    const aboutText = document.querySelector('[data-field-id="about-summary"]').textContent;
    const liCount = document.querySelectorAll('[data-field-id="project-1-detail"] li').length;
    PrintLinks.remove(document.querySelector('.page'));
    return { links, aboutText, liCount, after: document.querySelectorAll('.page a').length, aboutAfter: document.querySelector('[data-field-id="about-summary"]').textContent };
  });
  assert.deepEqual(result.links, [
    ['https://a.example.com', 'https://a.example.com'],
    ['https://github.com/me/repo', 'https://github.com/me/repo'],
    ['https://velog.io/@me/post', 'https://velog.io/@me/post'],
    ['http://13.125.10.20:8080', 'http://13.125.10.20:8080'],
    ['github.com/me/repo/docs', 'https://github.com/me/repo/docs'],
    ['https://youtu.be/abc123', 'https://youtu.be/abc123']
  ]);
  assert.equal(result.aboutText, result.aboutAfter, '링크로 감싸도 글자는 그대로');
  assert.equal(result.liCount, 2);
  assert.equal(result.after, 0);
  assert.deepEqual(page.errors, []);
});

test('인쇄가 끝났다는 신호가 오지 않아도, 저장되는 내용에는 링크가 남지 않는다', async () => {
  const page = await open();
  await setFields(page, { 'header-github': 'https://github.com/me', 'project-1-detail': '<li>https://github.com/me/repo 정리</li>' });
  const before = await page.evaluate(() => UI.buildContentPayload().fields);
  const saved = await page.evaluate(() => {
    window.dispatchEvent(new Event('beforeprint')); // afterprint 없이 저장
    const n = document.querySelectorAll('.page a.print-link').length;
    UI.persistContent({ label: 'test' });
    const stored = JSON.parse(localStorage.getItem('resume-ai-content')).fields;
    window.dispatchEvent(new Event('afterprint'));
    return { n, stored };
  });
  assert.ok(saved.n >= 2);
  assert.equal(saved.stored['header-github'], before['header-github']);
  assert.equal(saved.stored['project-1-detail'], before['project-1-detail']);
  assert.ok(!/<a/i.test(JSON.stringify(saved.stored)));
});

// 필수 칸을 채운 시험용 가짜 이력서 (실제 개인 정보 아님)
const REQUIRED_DUMMY = {
  'header-name': '홍길동', 'header-email': 'gildong@example.com', 'header-phone': '010-1234-5678',
  'header-github': 'https://github.com/example-user', 'header-university': 'OO대학교 컴퓨터공학과 졸업 (2020.02)',
  'project-1-name': '예시 프로젝트', 'project-1-meta': '2026.10 ~ 2026.11 | 팀 5명',
  'project-1-result': '배포 후 주요 기능 12개 동작 확인, 응답 시간 30% 단축', 'project-1-link': 'GitHub: https://github.com/example-user/demo',
  'edu-1-period': '2026.05 ~ 2026.12', 'edu-2-period': '2016.03 ~ 2020.02', 'edu-2-name': 'OO대학교', 'edu-2-detail': '컴퓨터공학과 졸업',
  'intro-text': '배운 것을 기록하고 끝까지 확인하는 개발자가 되겠습니다.'
};

test('"PDF로 저장하기" 버튼 흐름: 필수 칸이 비면 막고, 채우면 인쇄 직전 링크가 생기고 끝나면 사라진다', async () => {
  const page = await open({ simple: true });
  await page.click('#pdf-guide-btn');
  assert.equal(await page.isDisabled('#pdf-do-print'), true, '필수 칸이 예시 문구면 인쇄 버튼이 막혀 있음');
  await page.click('#pdf-guide-close');
  await setFields(page, REQUIRED_DUMMY);
  await page.evaluate(() => {
    window.print = () => {
      window.dispatchEvent(new Event('beforeprint'));
      window.__during = document.querySelectorAll('.page a.print-link').length;
      window.dispatchEvent(new Event('afterprint'));
    };
  });
  await page.click('#pdf-guide-btn');
  await page.click('#pdf-do-print');
  await page.waitForFunction(() => window.__during !== undefined);
  assert.ok(await page.evaluate(() => window.__during) >= 1);
  assert.equal(await page.evaluate(() => document.querySelectorAll('.page a.print-link').length), 0);
});

test('빈 이력서(예시 문구 그대로)도 5개 양식이 오류 없이 만들어지고, undefined·NaN 같은 글자가 없다', async () => {
  const page = await open();
  await page.click('#format-open-btn');
  for (const k of ['saramin', 'jobkorea', 'au', 'us', 'jp']) {
    await page.click('#format-tabs .tool-tab[data-format="' + k + '"]');
    const t = await page.textContent('#format-doc');
    assert.ok(!/undefined|NaN|null|\[object/.test(t), k + ': ' + t.match(/.{0,20}(undefined|NaN|null|\[object).{0,20}/));
    assert.ok((await page.locator('#format-doc .fx-page').count()) >= 1);
  }
  assert.deepEqual(page.errors, []);
});

test('악성 입력이 양식 문서·PDF 인쇄 영역에서 실행되지 않는다', async () => {
  const page = await open({ translator: 'fake' });
  const evil = '<img src=x onerror="window.__xss=1"><script>window.__xss=2</script>';
  await setFields(page, {
    'header-name': evil, 'header-subtitle': evil, 'about-summary': evil, 'intro-text': evil, 'header-military': evil,
    'project-1-name': evil, 'project-1-role': '<b>담당</b> ' + evil.replace(/</g, '&lt;'), 'project-1-result': evil,
    'doc-1-name': evil, 'doc-1-link': 'javascript:window.__xss=3', 'doc-1-desc': evil,
    'cert-1-name': evil, 'edu-2-name': evil + '대학교', 'header-github': 'javascript:window.__xss=4'
  });
  await page.evaluate(() => { window.print = () => {}; window.confirm = () => true; });
  await page.click('#format-open-btn');
  for (const k of ['saramin', 'jobkorea', 'au', 'us', 'jp']) {
    await page.click('#format-tabs .tool-tab[data-format="' + k + '"]');
    await page.waitForFunction(() => !FormatExport.busy);
    const live = await page.$$eval('#format-doc img:not([alt]), #format-doc script, #format-doc [onerror], #format-doc a[href^="javascript"]', (e) => e.length);
    assert.equal(live, 0, k);
  }
  await page.click('#format-print-all');
  assert.equal(await page.$$eval('#format-print-root script, #format-print-root [onerror], #format-print-root a[href^="javascript"]', (e) => e.length), 0);
  assert.equal(await page.evaluate(() => window.__xss), undefined);
  assert.deepEqual(page.errors, []);
});

test('병역 문구 종류별 변환 (사람인 표·미국 Additional·일본 職歴)', async () => {
  const page = await open();
  const rows = [
    ['병역: 군필 (해병 병장 만기전역, 2021.11 ~ 2023.05)', ['군필', '해병대', '병장', '2021.11 ~ 2023.05', '만기전역'], 'Republic of Korea Marine Corps, Sergeant — Honorable discharge (Nov 2021 – May 2023)', ['大韓民国海兵隊　入隊（兵役）', '大韓民国海兵隊　兵長　満期除隊']],
    ['병역: 군필 (육군 상병 의병전역, 2020.03 ~ 2021.01)', ['군필', '육군', '상병', '2020.03 ~ 2021.01', '의병전역'], 'Republic of Korea Army, Corporal — Medical discharge (Mar 2020 – Jan 2021)', ['大韓民国陸軍　入隊（兵役）', '大韓民国陸軍　上等兵　依病除隊']],
    ['병역: 군필 (사회복무요원 소집해제, 2019.01 ~ 2020.12)', ['군필', '사회복무요원', '-', '2019.01 ~ 2020.12', '소집해제'], 'Social Service Personnel (alternative service) — Completed service (Jan 2019 – Dec 2020)', ['社会服務要員　入隊（兵役）', '社会服務要員　召集解除']],
    ['병역: 미필 (입영 예정 2027.03)', ['미필', '-', '-', '-', '-'], null, []],
    ['병역: 면제', ['면제', '-', '-', '-', '-'], null, []]
  ];
  await page.click('#format-open-btn');
  for (const [text, ko, en, ja] of rows) {
    await setFields(page, { 'header-military': text });
    await page.click('#format-reset');
    await page.click('#format-tabs .tool-tab[data-format="saramin"]');
    const cells = await page.$$eval('#format-doc h2', (hs) => {
      const h = hs.find((x) => x.textContent === '병역');
      return h ? Array.from(h.nextElementSibling.querySelectorAll('tbody td')).map((c) => c.textContent.trim()) : null;
    });
    // 미필·면제는 "-"로, 군필인데 정보가 없는 칸은 노란 칸으로
    assert.deepEqual(cells.map((c) => (c === '' ? '-' : c)), ko, text);
    await page.click('#format-tabs .tool-tab[data-format="us"]');
    const us = await page.textContent('#format-doc');
    if (en) assert.ok(us.includes('Military service: ' + en), text + ' → ' + us.slice(us.indexOf('Military'), us.indexOf('Military') + 140));
    else assert.ok(!us.includes('Military service'), text);
    await page.click('#format-tabs .tool-tab[data-format="jp"]');
    const rowsJp = await page.$$eval('.fx-jp-hist tbody tr td:nth-child(3)', (e) => e.map((x) => x.textContent));
    for (const line of ja) assert.ok(rowsJp.includes(line), text + ' → ' + JSON.stringify(rowsJp));
    if (!ja.length) assert.ok(!rowsJp.some((r) => /入隊/.test(r)), text);
  }
  assert.deepEqual(page.errors, []);
});

test('이름 로마자·전화번호·날짜·졸업 구분 변환 표', async () => {
  const page = await open();
  const r = await page.evaluate(() => {
    const F = FormatExport;
    const names = ['홍길동', '김민준', '이서연', '박지훈', '최유나', '남궁민', '황보혜정', '정 다은', 'John Smith', '류현진', '오'].map((n) => F.romanize(n).full);
    const phones = ['010-9876-5432', '01098765432', '011-123-4567', '02-1234-5678', '051-123-4567', '+82 10 1234 5678'].map((p) => F.phoneIntl(p));
    const ranges = [['2026.11.05 ~ 2026.11.30', 'en'], ['2026-03 ~ 2026-08', 'ja'], ['2026년 3월 ~ 현재', 'en'], ['2025.12 ~ 진행 중', 'ko'], ['기간 미정', 'en']].map(([t, l]) => F.fmtRange(F.parsePeriod(t), l));
    const team = ['2026.11 | 팀 5명 (파이널 프로젝트)', '2026.10 | 개인', '2026.09 | 팀 3명 (세미 프로젝트)'].map((t) => { const p = F.parsePeriod(t); return [p.team, p.personal, p.final, p.semi]; });
    const status = [
      { name: '부산대학교', detail: '컴퓨터공학과 졸업', period: '2018.03 ~ 2024.02' },
      { name: '부산대학교', detail: '재학 중', period: '2022.03 ~' },
      { name: '부산대학교', detail: '휴학', period: '2022.03 ~' },
      { name: '부산외국어대학교', detail: '중국어중국학과 제적', period: '2021.03 ~ 2025.06' },
      { name: 'KH정보교육원', detail: '풀스택 과정', period: '2026.05 ~ 2099.12' },
      { name: 'KH정보교육원', detail: '풀스택 과정', period: '2025.01 ~ 2025.06' },
      { name: 'OO고등학교', detail: '', period: '2015.03 ~ 2018.02' }
    ].map((row) => F.eduEndStatus(row, 'ko').text + '/' + F.eduEndStatus(row, 'ja').text);
    return { names, phones, ranges, team, status };
  });
  assert.deepEqual(r.names, ['Gildong Hong', 'Minjun Kim', 'Seoyeon Lee', 'Jihun Park', 'Yuna Choi', 'Min Namgung', 'Hyejeong Hwangbo', 'Daeun Jung', 'John Smith', 'Hyeonjin Ryu', 'Oh']);
  assert.deepEqual(r.phones, ['+82 10-9876-5432', '+82 10-9876-5432', '+82 11-123-4567', '+82 2-1234-5678', '+82 51-123-4567', '+82 10 1234 5678']);
  assert.deepEqual(r.ranges, ['Nov 2026 – Nov 2026', '2026年3月～2026年8月', 'Mar 2026 – Present', '2025.12 ~ 현재', '']);
  assert.deepEqual(r.team, [[5, false, true, false], [null, true, false, false], [3, false, false, true]]);
  assert.deepEqual(r.status, ['졸업/卒業', '재학 중/在学中', '재학 중/在学中', '중퇴/中途退学', '수료 예정/修了見込み', '수료/修了', '졸업/卒業']);
});

test('프로젝트 여러 개·개인 프로젝트·추가 기술 분류가 5개 양식에 모두 들어간다', async () => {
  const page = await open({ translator: 'fake' });
  await setFields(page, {
    'project-1-name': '프로젝트하나', 'project-1-meta': '2026.10 ~ 2026.11 | 팀 5명',
    'project-2-name': '프로젝트둘', 'project-2-meta': '2026.08 ~ 2026.09 | 팀 3명',
    'project-3-name': '개인블로그', 'project-3-meta': '2026.01 ~ 2026.02 | 개인'
  });
  await page.click('#add-team-project-btn');
  await setFields(page, { 'project-4-name': '프로젝트넷', 'project-4-meta': '2025.11 ~ 2025.12 | 팀 4명' });
  await page.click('#add-skill-row-btn');
  await page.click('#skill-preset-menu .skill-preset-chip:text-is("테스트")');
  await page.click('#format-open-btn');
  for (const k of ['saramin', 'jobkorea', 'au', 'us', 'jp']) {
    await page.click('#format-tabs .tool-tab[data-format="' + k + '"]');
    await page.waitForFunction(() => !FormatExport.busy);
    const t = await page.textContent('#format-doc');
    for (const n of ['프로젝트하나', '프로젝트둘', '개인블로그', '프로젝트넷', 'JUnit 5']) assert.ok(t.includes(n), k + ' ' + n);
    if (k === 'us' || k === 'au') assert.ok(t.includes('Personal project'), k);
    if (k === 'jp') assert.ok(t.includes('個人'), k);
  }
  assert.deepEqual(page.errors, []);
});

test('번역 실패: 탭을 열 때는 AI를 쓰지 않음, 버튼을 누르면 AI로, AI 서버 오류, 내장 번역 응답 없음→시간 제한', async () => {
  // 1) 내장 번역 "지원 안 함" + API 키 있음 → 탭을 열 때는 안내만 하고(사용량 드는 AI는 자동으로 안 씀), 버튼을 누르면 AI로
  // (가짜 AI는 한글만 영어로 바꾸고 숫자는 그대로 둔다. "쿼리 101회→1회" 줄만 숫자를 빠뜨려 버려지는지 본다)
  let page = await open({ translator: 'unavailable' });
  await setFields(page, { 'about-summary': '백엔드 개발자입니다. 연락: 010-1234-5678', 'project-1-name': '예시 프로젝트', 'project-1-result': '쿼리 101회→1회로 줄임' });
  let calls = 0;
  let sent = '';
  await page.route('https://openrouter.ai/**', async (route) => {
    calls++;
    const req = JSON.parse(JSON.parse(route.request().postData()).messages[1].content).items;
    sent += JSON.stringify(req);
    const items = req.map((it) => ({ i: it.i, t: /101/.test(it.t) ? 'Reduced queries' : it.t.replace(/[가-힣]+/g, 'EN') }));
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ choices: [{ message: { content: JSON.stringify({ items }) } }] }) });
  });
  await page.evaluate(() => localStorage.setItem('resume-ai-api-key', JSON.stringify('k')));
  await page.click('#format-open-btn');
  await page.click('#format-tabs .tool-tab[data-format="us"]');
  await page.waitForFunction(() => !FormatExport.busy);
  assert.equal(calls, 0, '탭을 열기만 해서는 AI를 부르지 않음');
  assert.match(await page.textContent('#format-status'), /지원하지 않습니다.*"번역하기"를 누르면 AI로/);
  await page.click('#format-tabs .tool-tab[data-format="au"]');
  await page.waitForFunction(() => !FormatExport.busy);
  assert.equal(calls, 0, '다른 영어 탭을 열어도 AI를 부르지 않음');
  await page.click('#format-tabs .tool-tab[data-format="us"]');
  await page.click('#format-translate');
  await page.waitForFunction(() => !FormatExport.busy);
  assert.equal(calls, 1, '버튼을 누르면 AI로 번역');
  assert.ok(!sent.includes('010-1234-5678'), 'AI에는 전화번호를 가려서 보냄');
  const untr = await page.$$eval('#format-doc .fx-untr', (e) => e.map((x) => x.textContent));
  assert.deepEqual(untr, ['쿼리 101회→1회로 줄임'], '숫자를 빠뜨린 번역만 버려지고 나머지는 번역됨');
  // 2) AI 서버 429 → 안내 문구, 버튼 다시 쓸 수 있음
  page = await open({ translator: 'none' });
  await page.route('https://openrouter.ai/**', (route) => route.fulfill({ status: 429, body: '{}', headers: { 'access-control-allow-origin': '*' } }));
  await page.evaluate(() => localStorage.setItem('resume-ai-api-key', JSON.stringify('k')));
  await page.click('#format-open-btn');
  await page.click('#format-tabs .tool-tab[data-format="jp"]');
  await page.click('#format-translate');
  await page.waitForFunction(() => !FormatExport.busy);
  assert.match(await page.textContent('#format-status'), /번역하지 못했습니다: .*1분 뒤/);
  assert.equal(await page.isDisabled('#format-translate'), false);
  // 3) 키도 내장 번역도 없음 → 방법 안내
  page = await open({ translator: 'none' });
  await page.click('#format-open-btn');
  await page.click('#format-tabs .tool-tab[data-format="us"]');
  await page.click('#format-translate');
  assert.match(await page.textContent('#format-status'), /Chrome 최신 버전|API 키/);
  // 4) 내장 번역이 응답하지 않음 → 8초 안팎에 멈추고 안내
  page = await open({ translator: 'hang' });
  await page.click('#format-open-btn');
  const t0 = Date.now();
  await page.click('#format-tabs .tool-tab[data-format="au"]');
  await page.waitForFunction(() => !FormatExport.busy, null, { timeout: 15000 });
  assert.ok(Date.now() - t0 < 12000);
  assert.match(await page.textContent('#format-status'), /응답하지 않습니다/);
  assert.deepEqual(page.errors, []);
});

test('번역은 새로 고침 뒤에도 기억되어 다시 번역하지 않는다', async () => {
  const page = await open({ translator: 'fake' });
  await setFields(page, { 'about-summary': '저장되는 번역 시험 문장입니다.' });
  await page.evaluate(() => UI.persistContent({ label: 't' }));
  await page.click('#format-open-btn');
  await page.click('#format-tabs .tool-tab[data-format="us"]');
  await page.waitForFunction(() => !FormatExport.busy && document.querySelectorAll('#format-doc .fx-untr').length === 0);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('resume-format-translations')));
  assert.ok(stored.en['저장되는 번역 시험 문장입니다.']);
  await page.reload();
  await page.click('#format-open-btn');
  await page.click('#format-tabs .tool-tab[data-format="us"]');
  await page.waitForFunction(() => !FormatExport.busy);
  assert.equal(await page.evaluate(() => window.__trCalls), 0, '새로 고침 뒤 번역 호출 없음');
  assert.match(await page.textContent('#format-doc'), /<en>저장되는 번역 시험 문장입니다\./);
});

test('A4 판정: 디자인·사진·섹션 숨김 조합마다 실제 PDF가 2쪽이 되는 시점과 맞다 (최대 1~2줄 일찍 경고)', async () => {
  const page = await open();
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAOCAYAAAAWo42rAAAAFklEQVR42mNk+M9QzzAKRgWMCowKDAoAAL0ECfQQ6dIQAAAAAElFTkSuQmCC';
  const configs = [
    { name: '클래식', theme: 'classic', photo: false, hideCert: false },
    { name: '모던 + 사진', theme: 'modern', photo: true, hideCert: false },
    { name: '미니멀 + 자격증 숨김', theme: 'minimal', photo: false, hideCert: true }
  ];
  for (const c of configs) {
    await page.click('#design-themes .design-theme-btn[data-theme="' + c.theme + '"]');
    if (c.photo) {
      await page.setInputFiles('#photo-file-input', { name: 'p.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
      await page.waitForFunction(() => !document.getElementById('header-photo').hidden);
    }
    const certHidden = await page.$eval('.section[data-section-toggle="certification"]', (s) => !!s.querySelector('.hidden-section'));
    if (c.hideCert !== certHidden) await page.click('.section[data-section-toggle="certification"] .section-toggle-btn');
    await page.evaluate(() => { const ul = document.querySelector('[data-field-id="project-1-detail"]'); while (ul.children.length > 4) ul.lastChild.remove(); });
    let firstTwoPage = null, firstWarn = null;
    for (let n = 0; n <= 60 && firstTwoPage === null; n += 1) {
      await page.evaluate((k) => { const ul = document.querySelector('[data-field-id="project-1-detail"]'); while (ul.children.length > 4) ul.lastChild.remove(); for (let i = 0; i < k; i++) { const li = document.createElement('li'); li.textContent = '추가 구현 줄 ' + i + ' 길이를 맞추기 위한 문장입니다'; ul.appendChild(li); } }, n);
      if (firstWarn === null && await page.evaluate(() => ValidationEngine.detectPageOverflow().overflow)) firstWarn = n;
      if (pdfPages(await page.pdf({ preferCSSPageSize: true })) > 1) firstTwoPage = n;
    }
    assert.ok(firstTwoPage !== null, c.name + ': 2쪽이 되는 지점을 찾음');
    assert.ok(firstWarn !== null && firstWarn <= firstTwoPage && firstWarn >= firstTwoPage - 2, c.name + ': 경고 ' + firstWarn + '줄, 실제 2쪽 ' + firstTwoPage + '줄');
  }
  assert.deepEqual(page.errors, []);
});

test('휴대폰: 화면은 휴대폰 모양, 인쇄·PDF는 데스크톱 모양이고 링크가 살아 있다', async () => {
  const page = await open({ viewport: { width: 390, height: 800 }, isMobile: true, simple: true });
  await setFields(page, { 'header-github': 'https://github.com/mobile-user' });
  assert.equal(await page.$eval('.header', (e) => getComputedStyle(e).flexDirection), 'column', '화면은 세로로 쌓임');
  await page.emulateMedia({ media: 'print' });
  assert.equal(await page.$eval('.header', (e) => getComputedStyle(e).flexDirection), 'row', '인쇄는 가로');
  await page.emulateMedia({ media: null });
  const pdf = await page.pdf({ preferCSSPageSize: true });
  assert.ok(pdfLinks(pdf).includes('https://github.com/mobile-user'));
  // 양식 창: 버튼이 화면 안에 있고 가로로 넘치지 않음
  await page.evaluate(() => FormatExport.open('saramin'));
  const box = await page.$eval('#format-print', (e) => e.getBoundingClientRect().toJSON());
  assert.ok(box.right <= 391 && box.left >= 0, JSON.stringify(box));
  assert.deepEqual(page.errors, []);
});
