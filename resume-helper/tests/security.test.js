// 보안 회귀 테스트: 코드 리뷰에서 고친 XSS·개인정보 문제가 다시 생기지 않는지 확인한다.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { launch, openPage, mockAI } = require('./helpers');

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser.close(); });

test('README 미리보기는 javascript: 링크와 속성 탈출을 막는다', async () => {
  const page = await openPage(browser);
  const result = await page.evaluate(async () => {
    window.__xss = 0;
    const box = document.createElement('div');
    box.innerHTML = ReadmeGenerator.markdownToHtml('[a](javascript:window.__xss=1)\n![b](x" onerror="window.__xss=2)\n[ok](https://github.com/a/b)');
    document.body.appendChild(box);
    await new Promise((r) => setTimeout(r, 200));
    return { xss: window.__xss, jsLink: !!box.querySelector('a[href^="javascript"]'), safeLink: !!box.querySelector('a[href="https://github.com/a/b"]') };
  });
  assert.equal(result.xss, 0);
  assert.equal(result.jsLink, false);
  assert.equal(result.safeLink, true);
});

test('가져온 JSON의 위험한 HTML·사진·디자인 값은 정화된다', async () => {
  const page = await openPage(browser);
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rh-')), 'evil.json');
  fs.writeFileSync(file, JSON.stringify({
    version: 2,
    fields: { 'skills-backend': '<span class="skill-tag" onclick="x()">Java</span><img src=x onerror="window.__xss=3">', 'header-name': '테스트' },
    toggles: { __photo: 'javascript:alert(1)', __design: { theme: '<x>', accent: 'red;}' } },
  }));
  await page.evaluate(() => { window.__xss = 0; });
  await page.setInputFiles('#import-file-input', file);
  await page.waitForTimeout(300);
  const r = await page.evaluate(() => ({
    backend: document.querySelector('[data-field-id="skills-backend"]').innerHTML,
    xss: window.__xss,
    photoHidden: document.getElementById('header-photo').hidden,
    theme: document.querySelector('.page').className,
  }));
  assert.equal(r.backend, '<span class="skill-tag">Java</span>');
  assert.equal(r.xss, 0);
  assert.equal(r.photoHidden, true);
  assert.match(r.theme, /theme-classic/);
});

test('AI 점검 결과는 글자로만 표시하고, 연락처는 AI로 보내지 않는다', async () => {
  const page = await openPage(browser);
  const sent = await mockAI(page, () => JSON.stringify({ fields: { 'header-name': { warnings: ['<img src=x onerror="window.__xss=9">경고'] }, nope: { warnings: ['x'] } }, overall: '종합' }));
  await page.evaluate(() => {
    window.__xss = 0;
    document.querySelector('[data-field-id="header-email"]').innerText = 'hong@test.com';
    document.querySelector('[data-field-id="header-phone"]').innerText = '010-1234-5678';
  });
  await page.click('#analyze-btn');
  await page.waitForFunction(() => document.getElementById('overall-text').textContent.includes('종합'));
  const r = await page.evaluate(() => ({ xss: window.__xss, img: !!document.querySelector('.ai-feedback-msg img') }));
  assert.equal(r.xss, 0);
  assert.equal(r.img, false);
  assert.ok(sent.length > 0);
  assert.ok(sent.every((b) => !b.includes('hong@test.com') && !b.includes('010-1234-5678')));
  assert.deepEqual(page.errors, []);
});
