// 화면의 id(버튼·입력 칸 등)가 기준 목록에서 빠지지 않았는지 확인한다.
// 기능을 고치다 실수로 버튼을 지우면 여기서 걸린다.
//   node tools/check-ids.js          → 빠진 id가 있으면 목록을 보여 주고 실패(exit 1)
//   node tools/check-ids.js --update → 지금 index.html의 id로 기준 목록을 새로 만든다 (일부러 지웠을 때만)
const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const baselinePath = path.join(__dirname, 'ids-baseline.txt');
const now = [...new Set(html.match(/id="[^"]*"/g) || [])].sort();
if (process.argv.includes('--update')) {
  fs.writeFileSync(baselinePath, now.join('\n') + '\n');
  console.log('기준 목록을 새로 만들었습니다: ' + now.length + '개');
  process.exit(0);
}
const base = fs.readFileSync(baselinePath, 'utf8').split('\n').filter(Boolean);
const missing = base.filter((id) => !now.includes(id));
const added = now.filter((id) => !base.includes(id));
console.log('기준 ' + base.length + '개 / 지금 ' + now.length + '개 / 빠진 것 ' + missing.length + '개 / 새로 생긴 것 ' + added.length + '개');
if (missing.length) { console.log('빠진 id:\n' + missing.join('\n')); process.exit(1); }
