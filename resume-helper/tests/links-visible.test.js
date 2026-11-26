// v10.3: PDF 속 링크가 링크로 보이고(파란색·밑줄), 저장 전에 주소를 하나씩 열어 확인할 수 있다
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch, openPage } = require('./helpers');

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser.close(); });

const setFields = (page, map) => page.evaluate((m) => {
  Object.keys(m).forEach((id) => { document.querySelector('[data-field-id="' + id + '"]').innerText = m[id]; });
  UI.refreshPlaceholders();
}, map);
const pdfLinks = (buf) => [...new Set((buf.toString('latin1').match(/\/URI\s*\(([^)]*)\)/g) || []).map((x) => x.replace(/^\/URI\s*\(|\)$/g, '')))];

test('PDF에서 링크는 파란색·밑줄로 보이고, 보이지 않는 글자가 섞인 주소도 열린다', async () => {
  const page = await openPage(browser);
  await setFields(page, {
    'header-github': 'https://github.com/example-user',
    'project-1-link': 'GitHub: https://github.com/exa​mple-user/demo﻿'
  });
  const style = await page.evaluate(() => {
    window.dispatchEvent(new Event('beforeprint'));
    const a = document.querySelector('[data-field-id="project-1-link"] a.print-link');
    const cs = getComputedStyle(a);
    const out = { href: a.getAttribute('href'), text: a.textContent, color: cs.color, deco: cs.textDecorationLine };
    window.dispatchEvent(new Event('afterprint'));
    return out;
  });
  assert.equal(style.href, 'https://github.com/example-user/demo');
  assert.equal(style.text, 'https://github.com/example-user/demo', '복사해도 보이지 않는 글자가 따라오지 않음');
  assert.equal(style.color, 'rgb(26, 86, 219)');
  assert.equal(style.deco, 'underline');
  assert.ok(pdfLinks(await page.pdf({ preferCSSPageSize: true })).includes('https://github.com/example-user/demo'));
  assert.deepEqual(page.errors, []);
});

test('PDF 저장 창: 누를 수 있게 될 주소 목록(예시 문구·숨긴 섹션 제외)과 PDF 프린터 안내', async () => {
  const page = await openPage(browser);
  await setFields(page, {
    'header-email': 'gildong@example.com',
    'header-github': 'https://github.com/example-user',
    'doc-1-link': 'https://github.com/example-user/demo/blob/main/docs/log.md',
    'cert-1-name': '자격증 확인 https://hidden.example.com/cert'
  });
  // 자격증 섹션을 숨기면 그 주소는 PDF에 없으므로 목록에서 빠진다
  await page.click('.section[data-section-toggle="certification"] .section-toggle-btn');
  await page.click('#pdf-guide-btn');
  const links = await page.$$eval('#pdf-link-check a', (e) => e.map((a) => a.getAttribute('href')));
  assert.ok(links.includes('https://github.com/example-user'), JSON.stringify(links));
  assert.ok(links.includes('https://github.com/example-user/demo/blob/main/docs/log.md'));
  assert.ok(links.includes('mailto:gildong@example.com'));
  assert.ok(!links.some((h) => /hidden\.example|your-id|\[/.test(h)), JSON.stringify(links));
  assert.match(await page.textContent('#pdf-link-check'), /PDF에서 누를 수 있는 주소 \d+개/);
  assert.match(await page.textContent('#pdf-guide-overlay'), /Microsoft Print to PDF/);
  assert.equal(await page.getAttribute('#pdf-link-check a >> nth=0', 'target'), '_blank');
  // 목록을 만들어도 이력서 칸은 바뀌지 않는다
  assert.equal(await page.$$eval('.page a.print-link', (e) => e.length), 0);
  assert.deepEqual(page.errors, []);
});

test('인쇄 신호(beforeprint)가 없어도: "인쇄 화면 열기"·Ctrl+P를 누르는 순간 링크가 만들어진다', async () => {
  const page = await openPage(browser);
  await setFields(page, {
    'header-name': '홍길동', 'header-email': 'gildong@example.com', 'header-phone': '010-1234-5678', 'header-github': 'https://github.com/example-user',
    'project-1-name': '예시 프로젝트', 'project-1-meta': '2026.10 ~ 2026.11 | 팀 5명', 'project-1-result': '주요 기능 동작 확인',
    'project-1-link': 'GitHub: https://github.com/example-user/demo',
    'edu-1-period': '2026.05 ~ 2026.12', 'edu-2-period': '2016.03 ~ 2020.02', 'edu-2-name': 'OO대학교', 'edu-2-detail': '컴퓨터공학과 졸업',
    'intro-text': '배운 것을 기록하고 끝까지 확인하는 개발자가 되겠습니다.'
  });
  // window.print가 beforeprint를 보내지 않는 브라우저를 흉내 낸다
  await page.evaluate(() => { window.print = () => { window.__links = document.querySelectorAll('.page a.print-link').length; }; });
  await page.click('#pdf-guide-btn');
  await page.click('#pdf-do-print');
  await page.waitForFunction(() => window.__links !== undefined);
  assert.ok(await page.evaluate(() => window.__links) >= 2, '인쇄 버튼으로 연 인쇄에 링크가 있음');
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  assert.equal(await page.$$eval('.page a.print-link', (e) => e.length), 0);
  // Ctrl+P
  await page.click('[data-field-id="header-name"]');
  await page.keyboard.press('Control+p').catch(() => {});
  assert.ok(await page.$$eval('.page a.print-link', (e) => e.length) >= 2, 'Ctrl+P를 누르는 순간 링크가 있음');
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  assert.equal(await page.$$eval('.page a.print-link', (e) => e.length), 0);
  assert.deepEqual(page.errors, []);
});
