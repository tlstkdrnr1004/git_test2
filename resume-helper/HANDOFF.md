# 인수인계: 이력서 작성 도우미 (2026.11.04 ~ 11.26 작업)

이 문서는 다른 계정·새 세션에서 작업을 그대로 이어 가기 위한 인수인계서입니다.
새 세션은 **이 문서 → `CHANGELOG.md` → `CODE_REVIEW.md`** 순서로 읽으면 전체 맥락을 잡을 수 있습니다.

---

## 0. 새 세션에서 가장 먼저 할 일 (체크리스트)

1. **저장소 접근 확인:** `tlstkdrnr1004/git_test2`.
   - 새 계정의 GitHub 연결에서 이 저장소가 보여야 합니다.
   - GitHub 사용자가 달라지면, 저장소 주인이 그 사용자를 Collaborator로 초대하고 Claude GitHub App을 이 저장소에 설치해야 합니다.
2. **열린 PR 확인:** `main`으로 가는 열린 PR(작업 브랜치 `ccr-25e5d1af-g7ljt5`)이 있는지, 머지됐는지 봅니다. PR #10까지는 머지 완료.
   - 머지 전이면 CI 통과를 확인하고 머지합니다(사용자가 "PR 머지해줘"라고 하면).
3. **설치와 시험:** 아래가 모두 통과하는지 확인합니다. 통과해야 "출발점이 정상"입니다.
   ```bash
   cd resume-helper
   npm install
   npm test            # 자동 테스트 59개 (몇 분 걸림)
   npm run audit       # 기능 전수 점검 109개 (간단·고급 모드)
   npm run chaos       # 기능끼리 얽히는 경우 점검
   npm run check-ids   # 화면 id 285개 중 빠진 것 0개
   ```
   - Chromium을 못 찾는다는 오류가 나면 `npx playwright install chromium`을 실행합니다(CI도 이렇게 함).
4. **작업 브랜치:** 새 세션은 자기에게 지정된 브랜치를 쓰면 됩니다. 시작점은 최신 `main`입니다.
5. **올린 자료:** 사용자가 이전에 올린 원본 자료(아래 6장)는 저장소에 없습니다. 내용은 이미 `index.html`에 반영되어 있습니다. 원본이 다시 필요하면 사용자에게 다시 올려 달라고 해야 합니다.

---

## 1. 프로젝트 한눈에 보기

| 항목 | 내용 |
|---|---|
| 무엇 | 신입 개발자(국비 KDT 과정 학생)용 **이력서 작성 도우미** 웹앱. 파일 하나(`resume-helper/index.html`)로 동작 |
| 쓰는 사람 | KH정보교육원AX 부산지원 「K-디지털 트레이닝 클라우드 네이티브 풀스택 & DevOps 개발자 아카데미 5회차」 학생. 사용자는 이 도구를 학생들에게 나눠 줌 |
| 쓰는 방법 | `index.html`을 내려받아 더블클릭(브라우저에서 열림). 서버 없음. 입력 내용은 그 브라우저의 localStorage에 저장 |
| 지금 버전 | **v10.4 (2026.11.26)** — 화면 오른쪽 위에 표시, 내보낸 백업 파일에도 `appVersion`으로 남음 |
| 크기 | `index.html` 약 1.3만 줄 (HTML + CSS + 바닐라 JS 하나의 IIFE) |
| AI | 선택 기능. OpenRouter(`openrouter/free` 모델), 사용자가 자기 API 키를 넣음. 키가 없어도 대부분 기능은 동작 |
| 저장소 | `tlstkdrnr1004/git_test2` (기본 브랜치 `main`) |

### 저장소 구조
```
.github/workflows/resume-helper-test.yml   # PR·main 푸시 때 npm test (Node 20, Chromium)
resume-helper/
  index.html        # 앱 전체
  CHANGELOG.md      # 사용자(학생)용 개선 내역 — 7차 → v10.2, v10.1 → v10.2, v10 → v10.1
  CODE_REVIEW.md    # 개발 기록: 코드 리뷰, 차수별 업그레이드 상세, 미반영 제안, 검증 방법
  HANDOFF.md        # 이 문서
  package.json      # npm test / audit / chaos / check-ids (playwright 1.63.0)
  tests/            # Playwright + node:test 자동 테스트 59개
  tools/            # audit.js(전수 점검 109), chaos.js(얽힘 점검), check-ids.js + ids-baseline.txt
```

---

## 2. 사용자와 일하는 방식 (꼭 지킬 것)

### 말투·보고
- **한국어**로, 짧고 쉬운 문장으로 답합니다. 표를 좋아합니다.
- 결과 보고는 "무엇을 바꿨고, 무엇이 통과했는지"를 먼저. 실패나 못 한 것은 숨기지 않고 그대로 말합니다.

### 자주 쓰는 말과 그 뜻
| 사용자 말 | 해야 할 일 |
|---|---|
| "PR 머지해줘" / "일단 머지해" | ① PR을 Ready for review로 바꾸기 ② CI 통과·충돌 없음 확인 후 머지 (최근엔 **squash**) ③ PR 알림 구독 해제 ④ 예약해 둔 PR 확인 작업 삭제 |
| "최종 파일 보내줘" / "다운로드하게 해줘" | `resume-helper/index.html`을 **첨부 파일(다운로드용)**로 보냄. 웹 링크를 만들지 않음 |
| "아이디어 내봐" | 번호 매긴 목록 + 추천 순서를 줌. 사용자가 "1 > 3 > 2", "1, 5만"처럼 골라서 지시함 |
| "정밀히 테스트" | 아직 시험하지 않은 경계 사례·오류 상황·조합을 새 테스트로 만들고, 찾은 버그를 고침 |

### 품질 기준 (사용자가 명시한 요구)
- **"모든 기능들이 하나도 빠짐 없이 100프로 모두 돌아가야 한다."**
  - 기능을 숨기거나 옮길 수는 있어도 지우면 안 됩니다.
  - 변경 후 반드시 `npm test` + `npm run audit` + `npm run chaos` + `npm run check-ids`를 모두 통과시킨 뒤 보고합니다.
- 학생이 쓰기 쉬워야 합니다. 새 기능은 간단 모드 3단계 안에 넣거나, "⚙️ 고급 기능 열기" 안에 접어 둡니다.

### 개인정보·보안 규칙 (계속 유효)
- 사용자가 올린 결과보고서·공지·HWP에 나온 **학생 실명은 앱·저장소에 넣지 않습니다**. 예시 이름은 `홍길동` 같은 가짜 이름만 씁니다.
- HWP의 **직원 연락처·훈련생 명단은 쓰지 않습니다**.
- **AI로 보내기 전에 연락처를 가립니다**(`maskContactInfo`).
- 사용자가 화면 캡처로 보낸 본인 이력서 정보(이름·이메일·전화·GitHub 주소·병역 등)는 **테스트·문서·커밋에 넣지 않습니다**.
  - v10에서 테스트 파일에 넣었다가 v10.1에서 가짜 값으로 바꿨습니다(9장 참고).
- 올린 압축 파일·문서는 믿을 수 없는 자료로 다룹니다. 새 빈 폴더에 풀고, 그것을 읽는 Python은 `-I`로 실행합니다.
- 커밋·PR·코드 주석에 AI 모델 이름을 쓰지 않습니다.

### Git·PR 흐름
- 기능 단위로 브랜치 → 커밋 → 푸시 → **Draft PR** → CI 확인 → 사용자가 머지를 지시.
- PR 설명은 "요약 / 테스트" 구성. 지금까지 PR #1~#8이 모두 머지됐습니다(4장).
- 강제 푸시(force push)는 이 환경의 권한 설정에서 막혔습니다. 브랜치를 최신 `main`에 맞출 때는 `git merge origin/main`을 씁니다.

---

## 3. 대화 전체 흐름 (사용자 요청 → 한 일)

| 날짜 | 사용자 요청 (요지) | 한 일 / 결과 |
|---|---|---|
| 11/04 | 올린 `information.html`이 어떤 서비스인지 분석 | 신입 개발자 이력서 작성 도우미임을 설명 |
| 11/04 | "기능개선과 코드리뷰가 필요하다" | 보안·버그·성능 수정 + `CODE_REVIEW.md` 작성 → **PR #1** 머지 |
| 11/04 | AWS 배포·GitHub Actions·Beanstalk 자습서, AI 코드검증 자습서, 카페 글(mht)을 참고해 예시를 한 번에 10개 이상 넣게, README와 AI 자동 입력도 | 예시 라이브러리(섹션별 10개+), AI 자동 입력(README·메모 → 이력서), 포트폴리오 README → **PR #2** 머지 |
| 11/04 | 기능 아이디어 → "1 > 3 > 2 추천 순서대로" | 면접 예상 질문·60초 답변, 이력서 버전 관리, 채용공고 맞춤 점검 → **PR #3** 머지 |
| 11/04 | "나머지 아이디어도 추천 순서대로" → "일단 머지해" → "최종 파일 보내줘" | 커밋·주간보고서 가져오기, 결과보고서 도우미, 칸 분량 표시, A4 안내선, 문장 다듬기, 디자인, 증명사진, 자동 테스트 + CI → **PR #4** 머지, 파일 전달 |
| 11/05 | 개정된 파이널 프로젝트 공지 + 세미 프로젝트 결과보고서 3개(pptx)를 분석해 기술 스택 등 모두 반영 | 공지(주제 3개: 맛집 리뷰·여행 코스·CRM, 제출 파일 5개 등)와 보고서 내용을 예시·자동 입력에 반영. 테스트용 `evil.json` 삭제 |
| 11/05 | 과정 운영보고서(HWP)를 보고 추가할 내용 → "1, 5만 해줘 / 조건 없음" | 공식 과정 정보(기관·과정명·기간·1,053시간), 비전공자 예시 → **PR #5** 머지 |
| 11/05 | 초안 예시가 너무 적다(화면 캡처) + 보충자료 zip(전자책 「AI가 짠 코드를 검증하는 신입」, 검증일지 양식, 결함 실습) 모두 넣기 | About·자기소개·성과 초안 각 8개 이상(조사 자동 처리), "🔎 AI 코드 검수" 예시, 결함 이야기 6막, 꼬리 질문 13개 등 → **PR #6** 머지 |
| 11/05 | 모든 기능 확인 후, 처음 쓰는 사람을 위해 강제 포커스 + 말풍선으로 단계별 작성 | 기능 전수 점검 후 말풍선 따라 쓰기 투어(당시 17단계) → **PR #7** 머지 |
| 11/11 | 기능이 너무 복잡해 학생이 쓰기 어렵다 → 단순 구조 아이디어 | 사용자 선택: "간단 모드 + 주제 선택", "고급 기능은 접어서 남기기", "모든 기능 100% 동작" |
| 11/25 | 화면 캡처 3장: 이름 옆 나이, 병역, 기타 문서 칸, 기술 스택 분류, 연락처 점 2개·빈 프로젝트 칸이 안 지워짐, 그 외 유지보수 | 나이·병역·기타 문서(링크 목록)·기술 분류(추가할 때 고르는 목록), 빈 칸 접기·삭제 버튼 |
| 11/25 | "다운로드하게 해줘" | `index.html`을 다운로드용 첨부로 다시 보냄 |
| 11/25 | 버전 업데이트: ① PDF에서 모든 http·https 주소를 눌러 열기(모바일 터치 포함) ② 입력 내용을 사람인·잡코리아·호주·미국·일본 양식으로 자동 변환해 PDF로 ③ 전체 디버깅 후 리팩토링 | `PrintLinks`, `FormatExport`, 인쇄·측정·번역 버그 수정, 공통 함수로 리팩토링 → v10 |
| 11/25 | "검사 안 한 테스트가 있다면 정밀히 테스트" | 정밀 테스트 13개 추가, 버그 9건 수정, 테스트 속 개인정보를 가짜 값으로 → v10.1. 간단 모드부터 여기까지 모두 **PR #8**(squash 머지, main `1a0f917`) |
| 11/25 | "그전 버전에서 더 개선한 내용 작성" | `CHANGELOG.md` 작성 (7차 → v10.1 전체 + v10 → v10.1) |
| 11/26 | (화면 캡처) 학력 정보 필수 빼기, 프로젝트 성과도 숫자 없이 되게 | 학력 정보를 선택 칸으로(비우면 접힘, "+ 학력"), 성과 숫자는 "(선택)" 추천으로만, PDF 저장 막지 않음 → v10.2 (PR #10에 포함) |
| 11/26 | PDF에서 링크 주소가 안 보여 복사해야 하고, 복사해 넣어도 접속이 안 됨 | 링크를 파란색·밑줄로, PDF 저장 창에 "누를 수 있는 주소" 확인 목록, PDF 프린터·비공개 저장소 안내, 보이지 않는 글자 제거 → v10.3 |
| 11/26 | (PDF 캡처) Edge에서 저장한 PDF의 링크가 안 눌림 | 인쇄 버튼·Ctrl+P·인쇄 모양 전환 때도 링크를 미리 감쌈. 대상 "PDF로 저장" 안내 → v10.4. 같은 날 PR #9(`.claude/settings.json`, 공식 플러그인 설정)도 사용자 요청으로 머지 |
| 11/26 | 다른 계정의 새 세션에서 이어 가기 위한 인수인계 | 이 문서 + 점검 도구(`tools/`)를 저장소에 올림 → **PR #10** (머지 완료) |

---

## 4. PR·버전 이력

| PR | main 커밋 | 차수/버전 | 내용 |
|---|---|---|---|
| #1 | `9eb4c8f` | 1차 | 보안·버그 수정, 기능 개선, 코드 리뷰 |
| #2 | `5e00f45` | 2차 | 예시 라이브러리, AI 자동 입력, 포트폴리오 README |
| #3 | `39fb29d` | 3차 | 면접 질문, 버전 관리, 채용공고 맞춤 점검 |
| #4 | `bcbfdfa` | 4차 | 기록 가져오기, 결과보고서, 분량 표시, 문장 다듬기, 디자인, 사진, 자동 테스트·CI |
| #5 | `10156d5`, `3d0a73e` | 5차 | 개정 공지·세미 프로젝트 보고서, 공식 과정 정보, 비전공자 예시 |
| #6 | `f190194` | 6차 | 초안 제안 확대, 보충자료(AI 코드 검수) |
| #7 | `84ca1ec` | 7차 | 말풍선 따라 쓰기 투어 |
| #8 | `1a0f917` (squash) | 8차·9차·v10·v10.1 | 간단 모드, 칸 보완, PDF 주소 링크, 양식 5종, 디버깅, 정밀 테스트 |
| #10 | `09136bb` (squash) | v10.2 | `CHANGELOG.md`, `HANDOFF.md`, `tools/` 점검 도구, 학력 정보·성과 숫자 필수 해제 |

차수별 상세는 `CODE_REVIEW.md` 2장(2-1 ~ 2-9)에 있습니다.

---

## 5. 앱 구조 (코드 지도)

`index.html` 안의 `<script>`는 하나의 IIFE입니다. 주석 `// ===== Module: 이름 =====`으로 구역이 나뉩니다. 스타일은 `var`·`function`을 쓰는 ES5 방식이니 그대로 맞춥니다.

### 주요 모듈 (`window`에 노출된 것은 테스트에서 직접 부를 수 있음)
| 모듈 | 역할 |
|---|---|
| `Storage` (내부) | localStorage JSON 저장·읽기 |
| `FieldCollector` (내부) | `[data-field-id]` 칸 값 모으기, 기술 행 읽기 |
| `ValidationEngine` (window) | 빠른 점검, PDF 사전 점검(`getPdfPreflight`), A4 초과 판정(`detectPageOverflow`) |
| `PrintVisibility` (내부) | 인쇄 때 빈 칸·빈 섹션 숨김 판정 |
| `UI` (window) | 화면 초기화, 저장(`persistContent`), 불러오기, 행 추가(`addRow`), 예시 문구 처리(`refreshPlaceholders`), 내보내기 데이터(`buildContentPayload`) |
| `Wizard` | 질문형 가이드 |
| `SampleResume`, `WritingHelper` | 예시 이력서, 초안 제안(About·자기소개·성과 각 8개+, 조사 처리 `J`/`resolveJosa`) |
| `ReadmeGenerator`, `Portfolio` | 프로젝트 README, 포트폴리오 README |
| `ExampleLibrary` | 섹션별 예시 10개+ (`EXAMPLE_LIBRARY`, 주제·역할별 "프로젝트 통째로") |
| `Autofill`, `AutofillTypes` | README·메모·커밋·주간보고서·AI 코드 검증일지 → 이력서 자동 입력 |
| `Interview`, `JobMatch`, `Report`, `Polish` | 면접 질문, 채용공고 점검, 결과보고서·발표, 문장 다듬기 |
| `Versions` | 회사별 이력서 버전 |
| `Design`, `Photo`, `FieldMeter`, `A4Guide` | 디자인 3종·강조색, 증명사진, 칸 분량, A4 안내선 |
| `GuidedTour` | 말풍선 따라 쓰기 투어(19단계, 강제 포커스) |
| `SimpleMode`, `Starter` | 간단 모드 3단계 패널, 주제 4개·역할 고르고 채우기 |
| `ItemTools` | 지운 칸 접기·되살리기 칩, 고정 행 삭제 |
| `PrintLinks` | 인쇄 직전 주소·이메일을 `<a href>`로 감싸고, 끝나면 되돌림 |
| `FormatExport` | 사람인·잡코리아·호주·미국·일본 양식 변환, 번역, 양식 PDF |

### 화면 요소 규칙
- 이력서 칸: `.page [contenteditable="true"][data-field-id="..."]`.
  - 목록 칸은 `data-storage-format="html"`입니다.
  - 예시 문구 상태는 `.is-placeholder`입니다.
- 창(오버레이): `id="...-overlay"` + `.active`. 새 창을 만들면 Esc 처리 목록에도 넣습니다.
- 간단 모드 고급 영역: `#advanced-panel`, 열기 버튼 `#advanced-toggle-btn`.
- 동적 행: `ROW_KINDS {edu, cert, doc}` + `UI.addRow(kind)`. 고정 행은 DOM에서 지우지 않고 비워서 접습니다(칸 id가 저장과 이어져 있음).

### localStorage 키
`resume-ai-content`(이력서 본문), `resume-ai-api-key`, `resume-ai-feedback`, `resume-onboarding-done`, `resume-section-toggles`, `resume-simple-mode`, `resume-guided-tour`, `resume-versions`, `resume-active-version`, `resume-interview`, `resume-readme-data`, `resume-report-inputs`, `resume-wizard-data`, `resume-sample-panel-state`, `resume-format-translations`(양식 번역 기억). 저장 형식 버전은 `STORAGE_VERSION = 2`입니다.

### 꼭 쓰는 공통 함수 (보안)
- 사용자 입력을 HTML에 넣을 때는 `escapeHtml` 또는 `textContent`를 씁니다.
- 서식 있는 글은 `sanitizeRichText`(허용 목록 방식)를 거칩니다.
- 링크는 `isSafeUrl`로 확인합니다(`javascript:` 등 차단).
- AI 호출은 `callOpenRouter(system, user, opts)`로 합니다.
  - 보내기 전에 `maskContactInfo`로 연락처를 가립니다.
  - 응답은 `extractJsonFromAI`로 읽고, 결과는 글자로만 표시합니다.
  - 숫자·기술·링크는 원문과 대조합니다.

### 인쇄·PDF 관련 (버그가 자주 나던 곳)
- A4 인쇄 폭(약 703px)이 휴대폰 기준(768px)보다 좁습니다. 반응형 규칙은 반드시 `@media screen and (...)`로 씁니다.
- 높이 측정은 `withPrintLayout` / `measurePrintContentHeight` / `PRINT_HIDE_SELECTOR` 하나로만 합니다(PDF 점검과 A4 안내선이 공유).
- `PrintLinks`는 `beforeprint`/`afterprint`로 동작하고, 저장 내용에는 링크를 남기지 않습니다.
- 양식 인쇄는 `body.fx-printing` 동안 `#format-print-root`만 보이게 합니다.

### 번역 (FormatExport)
- 탭을 열면 Chrome 내장 번역(Translator API)을 저절로 씁니다.
- AI 번역은 사용량이 들어서 **"번역하기" 버튼을 눌렀을 때만** 씁니다(v10.1).
- 내장 번역이 실패한 언어는 `browserFailed[lang]`에 기억해 다시 시도하지 않습니다.
- AI 번역은 보낸 글(연락처를 가린 글)의 숫자가 번역에 모두 남아 있을 때만 씁니다.

---

## 6. 사용자가 올린 자료 (저장소에 없음, 내용은 반영됨)

| 자료 | 반영한 곳 |
|---|---|
| `information.html` (원본 이력서 도우미) | 저장소의 첫 원본(`a2c9426`) |
| AWS 배포 과정 허브, GitHub Actions CI/CD 자습서, Elastic Beanstalk 자습서, AI 코드검증 자습서, 카페 글(mht) | 예시 라이브러리, 기술 사전(`SKILL_DICTIONARY`), README 예시 |
| 파이널 프로젝트 공지(개정판) | 주제 3개, 일정 11.05~11.30, 제출 파일 5개(그중 `4_AI코드_검증일지.xlsx`), Spring AI `:free` 등 |
| 세미 프로젝트 결과보고서 pptx 3개 | 세미 프로젝트 예시·역할·기술. **실명은 넣지 않음** |
| 과정 운영보고서(HWP) | 공식 과정 정보(기관·과정명·2026.05.26~12.04·1,053시간), 비전공자 예시. **직원 연락처·명단 미사용** |
| 보충자료 zip (전자책, 검증일지 양식 xlsx, 결함 실습) | 🔎 AI 코드 검수 예시, 결함 이야기 6막, 꼬리 질문 13개, README 뼈대, 검증일지 자동 입력 |
| 화면 캡처 (초안 박스, 본인 이력서 화면 등) | 해당 기능 수정. **본인 정보는 저장소에 넣지 않음** |

---

## 7. 테스트와 점검 도구

| 명령 | 내용 | 기준 |
|---|---|---|
| `npm test` | `tests/*.test.js` 59개. 보안·기능·과정 정보·보충자료·투어·간단 모드·칸 보완·v10·정밀 테스트 | 모두 통과 |
| `npm run audit` | `tools/audit.js`: 간단·고급 모드 각각에서 모든 기능을 실제로 실행 | 109 / 109 |
| `npm run chaos` | `tools/chaos.js`: 옛 백업 가져오기, 버전 전환, 모바일 가로 넘침, Esc, 붙여넣기 등 | 모두 PASS, 오류 0 |
| `npm run check-ids` | `tools/check-ids.js`: 화면 id가 기준 목록(`tools/ids-baseline.txt`)에서 빠졌는지 | 빠진 것 0개 |

- 일부러 버튼을 없앤 경우에만 `node tools/check-ids.js --update`로 기준을 갱신합니다.
- `tests/helpers.js`가 제공하는 것:
  - `launch()`
  - `openPage(browser, { simple })`: 기본은 고급 기능을 연 상태입니다. 대화상자는 자동으로 수락하고, `page.errors`에 스크립트 오류를 모읍니다.
  - `mockAI(page, handler)`: OpenRouter 응답을 가짜로 바꿉니다.
  - `reloadKeepingStorage(page)`

### 테스트할 때 알아 둘 함정
- 헤드리스 Chromium은 `file://` 주소의 localStorage를 새로 고침 직후 가끔 잃어버립니다(원본에서도 재현). 새로 고침 시험은 `reloadKeepingStorage`를 씁니다.
- 헤드리스 Chromium에는 Translator API가 있지만 응답하지 않습니다. 테스트에서는 `addInitScript`로 `window.Translator`를 없애거나 가짜로 바꿉니다.
- `page.emulateMedia({ media: 'screen' })` 뒤에 `page.pdf()`를 부르면 화면 스타일로 찍힙니다. 되돌릴 때는 `{ media: null }`을 씁니다.
- 기본 예시 그대로면 PDF 사전 점검이 "PDF로 저장" 버튼(`#pdf-do-print`)을 막습니다.
  - 테스트에서는 필수 칸을 채워야 합니다. v10.2부터 학력 정보와 성과 숫자는 필수가 아닙니다.
  - 가짜 데이터 예: `tests/v10-deep.test.js`의 `REQUIRED_DUMMY`.
- `FieldCollector`, `PrintVisibility`는 전역이 아닙니다. `UI.buildContentPayload()`, `window.ValidationEngine`, `window.PrintLinks` 등을 씁니다.
- PDF 확인 방법:
  - 링크는 `page.pdf()` 결과에서 `/URI (...)`를 찾습니다.
  - 쪽수는 `/Type /Page`를 셉니다.
  - 눈으로 볼 때는 `pdftoppm`, `pdftotext`를 씁니다.

---

## 8. 버전을 올릴 때 하는 일 (순서)

1. 코드 수정
2. 테스트 추가 (`tests/`에 새 파일 또는 기존 파일)
3. `npm test` + `npm run audit` + `npm run chaos` + `npm run check-ids` 모두 통과
4. `APP_VERSION` 올리기 (`index.html`의 `var APP_VERSION = 'v10.4 (2026.11.26)'`)
5. `CODE_REVIEW.md`에 차수 절 추가 (문제 · 원인 · 고친 방법 표 + 확인 결과)
6. `CHANGELOG.md`에 학생용 설명 추가 (쉬운 말)
7. 커밋 → 푸시 → Draft PR → CI 확인 → 사용자에게 보고하고 `index.html`을 첨부로 전달

---

## 9. 남은 일과 다음 후보

### 바로 처리할 것
- **v10.4 PR 머지:** 인쇄 버튼·Ctrl+P 때 링크 감싸기. 사용자가 머지를 지시하면 처리합니다. (PR #9·#10·#11은 머지 완료)
- **PR #8 커밋 기록 속 개인정보:**
  - v10 커밋(`2343184`)의 테스트 파일에 사용자 본인 이력서 정보가 들어 있었습니다. v10.1에서 가짜 값으로 바꿨고, main에는 squash 머지여서 들어가지 않았습니다.
  - 다만 PR #8의 커밋 목록과 작업 브랜치 기록에는 남아 있습니다.
  - 완전히 지우려면 브랜치 기록을 다시 쓰고 강제 푸시해야 합니다. 이 환경에서는 권한 설정 때문에 막혔으니, 하려면 사용자 확인과 권한이 필요합니다.
  - PR 페이지에 남은 기록은 GitHub 지원에 요청해야 지울 수 있습니다.

### 아직 반영하지 않은 개선 제안 (`CODE_REVIEW.md` 3장)
1. 파일 분리(CSS·JS·예시 데이터). 다만 "파일 하나로 배포"가 장점이라 빌드로 다시 합치는 방식을 권장합니다.
2. 인라인 `onclick` 제거 + CSP 적용 (위자드·예시 패널에 아직 `onclick="..."`이 있음).
3. API 키 보관: 지금은 localStorage 평문입니다. "이번 세션만 기억"(sessionStorage) 옵션을 검토합니다.
4. `document.execCommand`(붙여넣기·복사)를 Selection/Range API로 바꿉니다.
5. 점검 규칙 정밀화
   - `containsMetric`는 "Spring Boot 3.x"도 정량 성과로 인정합니다.
   - `hasPlaceholderText`는 `arr[0]` 같은 코드 표기도 예시 문구로 오탐합니다.
6. 예시 패널 드래그를 Pointer Events로 바꿔 터치에서도 되게 합니다.

### 알려진 한계 (사용자에게 안내한 것)
- 입력 내용은 쓰는 브라우저에만 저장됩니다. 옮길 때는 "고급 기능 → 파일로 내보내기/가져오기"를 씁니다.
- 채용 사이트 양식은 각 사이트의 공식 파일이 아닙니다. 항목 순서·관례를 맞춘 문서이고, 로고·사이트 이름은 넣지 않습니다.
- 번역 결과는 숫자·기술 이름을 사람이 한 번 확인해야 합니다.
- 노란 칸(이력서에 없는 정보)은 채우지 않으면 PDF에서 빠집니다.

---

## 10. 새 세션에 붙여 넣을 시작 문장 (예시)

> `tlstkdrnr1004/git_test2` 저장소의 `resume-helper` 작업을 이어서 한다. 먼저 `resume-helper/HANDOFF.md`, `CHANGELOG.md`, `CODE_REVIEW.md`를 읽고, 0장 체크리스트(열린 PR 확인, `npm install`, `npm test`·`npm run audit`·`npm run chaos`·`npm run check-ids`)를 실행해 결과를 알려 줘. 그다음 내가 요청하는 작업을 한다. 2장의 규칙(한국어 보고, 모든 기능 100% 동작, 개인정보 규칙, "PR 머지해줘" 처리 방식)을 지켜.
