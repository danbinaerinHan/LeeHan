# 공간리한 사이트 — 작업 가이드

빌드 도구 없는 **정적 사이트**. HTML + 바닐라 ES 모듈 + CSS 한 파일.
`main`에 푸시하면 GitHub Pages가 배포한다 (`spaceleehan.kr`, 반영까지 1~2분).

## 이 프로젝트에 적용하지 않는 전역 규칙

`~/.claude/rules/`의 아래 항목은 앱 개발용이라 여기선 **적용하지 않는다**:

- TDD / 80% 커버리지 (테스트 프레임워크 자체가 없음)
- planner·architect·tdd-guide 등 에이전트 선행 호출
- Zod 입력 검증, Repository 패턴, API 응답 규격

적용하는 것: 커밋 메시지 형식(`feat:` / `fix:` / `style:` …), 불변성, 파일 분리.

## 커밋·푸시

**고치면 묻지 말고 바로 커밋하고 `origin main`에 푸시한다.** 확인 요청 없이 진행.
예외 — 먼저 물어볼 것: 파일/섹션 삭제, 데이터 구조 변경, 되돌리기 어려운 대규모 수정.

## 콘텐츠가 어디 있나

문구를 고쳐달라는 요청이 오면 여기부터 본다.

| 내용 | 위치 |
|---|---|
| 전시 정보 (제목·기간·작가·이미지) | `data/exhibitions.json` |
| 홈 편성, 마퀴 문구, 방문 안내 | `data/settings.json` |
| 소개 페이지 설비 캡션 | `about.html` 하단 인라인 `<script>`의 `GROUPS` 배열 |
| 대관 안내·요금·약관 | `rental.html` 본문 (정적 마크업) |
| 공간 스토리 | `story.html` 본문 (정적 마크업) |
| 스타일 전부 | `style.css` (3000줄 단일 파일) |

주의: 소개·대관·스토리 페이지의 문장은 JSON이 아니라 **HTML 안에 하드코딩**돼 있다.
`data/`부터 뒤지지 말고 `grep -rn "문구" . --exclude-dir=.git --exclude-dir=_원본자료` 로 바로 찾는다.

## 페이지와 스크립트

- `index.html` 홈 / `about.html` 소개 / `rental.html` 대관 / `story.html` 스토리
- `exhibitions/*.html` 개별 전시 상세
- `admin/` 관리자 화면 (GitHub API로 `data/*.json`을 직접 커밋)
- `assets/js/` — `data.js`(JSON 로더) · `render*.js`(DOM 빌더) · `ui.js`(스크롤/모바일 메뉴/플로팅 토글)
  · `lightbox.js`(갤러리 확대 보기)
- 렌더는 `el(tag, attrs, ...children)` 헬퍼 사용 (`assets/js/render.js`). 자식으로 배열·노드·`false` 모두 받는다.
- 상세 페이지 갤러리는 `photoGridNode(photos, layout, onOpen)`의 `onOpen(i)`로 라이트박스를 연다.
  넘기기는 버튼·키보드(←/→/Esc)·손가락 드래그 세 가지를 모두 받는다 (`lightbox.js`)

## 전시 제목 표기 규칙

새 전시를 추가할 때 **매번 이 규칙에 맞춰 넣는다.** 기존 전시도 여기서 어긋나면 맞춘다.

### 표제 자리 — 괄호 없이

`title` / `titleHtml` 은 홈 히어로·스케줄 카드·상세 페이지 제목으로 **그 자체가 표제로 서는** 자리다.
`〈〉` `《》` `""` 같은 감싸는 기호를 넣지 않는다.

```json
"title": "평면 조각가의 우연한 공간",
"titleHtml": "평면 조각가의<br>우연한 공간",
```

이유:
- 히어로는 최대 60px / 700 굵기다. 이 크기에서 `〈〉`는 얇은 구두점이 아니라 **굵은 꺾쇠 도형**으로 읽혀
  시선이 글자보다 괄호에 먼저 간다
- 제목은 거의 항상 두 줄로 감싸는데, 그러면 여는 괄호는 1행 맨 앞, 닫는 괄호는 2행 맨 끝으로
  **갈라져서** 짝으로 보이지 않고 2행 오른쪽 끝만 삐죽 튀어나온다
- 무엇보다 스케줄 카드에 여러 전시가 나란히 놓인다. 한 전시만 괄호를 달면 그것만 튄다

### 러닝 텍스트 자리 — 괄호를 쓴다

다른 말과 섞여서 **어디부터 어디까지가 제목인지 구분이 필요한** 자리에는 `〈〉`를 쓴다.
홑화살괄호 본래의 쓰임이다.

- `data/settings.json` 의 마퀴 문구 — `〈평면 조각가의 우연한 공간〉 — NOW SHOWING`
- `og.title` / `exhibitions/*.html` 의 `<title>`·`og:title` — `이정연 초대전 〈…〉 — 공간리한`
- `photos[].alt` 등 설명문

### titleHtml 의 `<br>`

- **두 줄이 기준.** 한 줄은 허전하고 세 줄은 포스터와의 균형이 깨진다
- 의미 단위로 끊는다 (`평면 조각가의` / `우연한 공간`, `니가가라` / `하와이 사진전`)
- 조사나 어절 중간에서 끊지 않는다
- 제목이 길어 세 줄이 되면 `<br>` 위치를 바꾸기 전에 **제목 자체를 줄일 수 있는지** 본다

### 제목 크기 위계 (건드릴 일이 생기면)

홈은 예고, 상세가 본편이다. 이 순서가 뒤집히지 않게 한다.

| | 최대 | 1280px 기준 |
|---|---|---|
| `.detail-title` (상세 페이지) | 68px | 64px |
| `.hero-title` (홈 히어로) | 60px | 59px |

## 새 전시 추가 체크리스트

`data/exhibitions.json` 의 항목 하나 = 전시 하나. 기존 항목을 복사해 채우는 게 가장 빠르다.

- `id` `slug` — `exh_<YYYYMMDD>_<이름>` / URL에 쓰이는 영문 소문자
- `title` `titleHtml` — 위 표기 규칙대로
- `artist` `kicker` — `이정연 개인전` / `이정연 초대전`
- `startDate` `endDate` `dateDisplay` — 앞 둘은 `YYYY-MM-DD`(상태 자동 계산용), 마지막은 화면 표시용
- `poster` `photos[]` — 웹용 이미지는 `uploads/<연도>/<slug>/`, 포스터는 `posters/`
- `lede` — 홈 히어로와 상세 상단에 함께 쓰이는 한 문단
- `metaStrip` `bodyEyebrow` `bodyHtml` — 상세 페이지 본문
- `og` — 공유 카드용. 여기 제목엔 괄호를 쓴다
- `draft: true` 로 두면 공개되지 않는다

그 다음 `data/settings.json` 도 함께 손본다:

- `homepage.heroExhibitionId` — 홈 히어로(02)에 세울 전시
- `homepage.heroAlsoShow` — `{ id, until }`. **전시 교체 기간용.** 히어로에 두 전시가 9초마다
  옆으로 번갈아 나온다. `until`(YYYY-MM-DD)이 지나면 그 전시는 스스로 빠지고
  `heroExhibitionId` 하나만 남는다. 안 쓸 땐 `id`를 빈 문자열로 둔다
- `homepage.scheduleOrder` — 스케줄(포스터 3개)에 노출할 순서. **여기 없으면 홈에 안 뜬다**
- `marquee.home` — 상단 흐르는 문구

상세 페이지 본체는 `exhibitions/exhibition.html?slug=<slug>` 하나로 공용이다.
`exhibitions/<slug>.html` 은 **공유용 리다이렉트 스텁**일 뿐이니 기존 파일을 복사해
`<title>` · `og:*` 와 리다이렉트 slug 두 군데(`meta refresh`, `location.replace`)를 고친다.

## 자주 쓰는 클래스

- `.page-toggle` — 소개 ↔ 대관 알약형 전환 토글. about·rental 양쪽 상단 중앙에 동일하게 들어간다.
  - 인트로 블록이 있는 페이지(rental)는 `.about-page-intro`가 가운데 정렬을 담당
  - 없는 페이지(about)는 `.page-toggle-bar` 래퍼로 감싼다
- `.rental-fab` — 우하단 플로팅 대관 버튼. 홈·스토리에만 있다 (소개 페이지는 토글이 대신하므로 제거됨)
- `.fac-*` — 소개 페이지 설비 캐러셀 (`.fac-slide` / `.fac-cap` / `.fac-title` / `.fac-desc` / `.fac-note`)
- `.about-page-intro` / `.section-marker` — 페이지 상단 인트로, 섹션 대구분 헤더

## 확인은 어디까지

바꾼 성격에 맞춰서만 확인한다. 과하게 하면 느려진다.

- **문구·오타 수정** → 브라우저 확인 생략. grep으로 반영됐는지만 보고 커밋
- **레이아웃·여백·새 컴포넌트** → 프리뷰 띄워서 데스크톱 + 모바일(375px) 스크린샷
- **JS 동작 변경** → 프리뷰 + 콘솔 에러 확인

## 프리뷰 실행

프리뷰 서버 프로세스는 **iCloud Drive 폴더를 읽지 못한다**(macOS 권한). 직접 서빙하면 전부 404다.
사본을 만들어 서빙한다:

```bash
rsync -a --delete --exclude '.git' --exclude '_원본자료' "$HOME/Library/Mobile Documents/com~apple~CloudDocs/공간리한/" /tmp/leehan-site/
```

그 다음 `preview_start`로 `leehan` 실행 (`~/.claude/leehan-preview.sh` → `/tmp/leehan-site`를 8765 포트로 서빙).
**파일을 고칠 때마다 rsync를 다시 돌려야** 프리뷰에 반영된다. 편집은 항상 iCloud 원본에서 한다.

### 함정 1 — JS를 고쳤는데 프리뷰가 옛날 코드를 실행한다

Chrome이 `assets/js/*.js`를 캐시하고 재검증하지 않는다. **HTML만 `?v=2` 로 캐시 버스팅해도
모듈은 캐시에서 나온다.** "고쳤는데 결과가 똑같다"면 십중팔구 이것이다. 예전 코드로 몇 번씩
테스트하다 헛다리를 짚게 된다.

가장 확실한 해법은 **새 포트로 서버를 하나 더 띄우는 것**. 캐시는 URL(포트 포함) 단위라 통째로 무효가 된다.

```bash
python3 -m http.server 8791 --directory /tmp/leehan-site
```

의심되면 먼저 이걸로 확인한다 — 코드가 실제로 실행됐는지 전역 마커를 심어 보면 확실하다.

### 함정 2 — 프리뷰 창은 백그라운드 탭이다

프리뷰 창은 렌더링이 멈춘 백그라운드 탭처럼 동작한다. 결과:

- **`requestAnimationFrame`이 아예 안 돈다** (`setInterval`은 ~1초로 스로틀링되며 돌긴 한다)
- 따라서 **부드러운 스크롤(`scroll-behavior: smooth`)이 진행되지 않는다.**
  `style.css`의 `html`에 `smooth`가 걸려 있어서, `window.scrollTo()`나 `scrollIntoView()`를 부른 뒤
  `scrollY`를 읽으면 계속 `0`이다. **이걸 "스크롤이 안 되는 버그"로 오해하지 말 것**
- 스크린샷이 흰 화면으로 찍히는 일이 잦다

**위치 확인은 스크린샷 대신 좌표를 직접 재는 게 빠르고 정확하다:**

```js
el.getBoundingClientRect().top   // 목표 요소가 뷰포트 어디에 있나
document.querySelector('header').getBoundingClientRect().bottom  // 고정 헤더 아래끝(≈87px)
```

관련 코드 주의: `scrollIntoView({behavior:'auto'})`의 `'auto'`는 "즉시"가 아니라
**CSS `scroll-behavior` 값을 따른다**(= 여기선 smooth). 즉시 이동하려면 `'instant'`를 써야 한다.
`assets/js/ui.js`의 `scrollToHash()` 참고.

### 함정 3 — 새로 연 탭은 뷰포트가 0×0이다

`preview_start`로 탭을 새로 열면 `window.innerWidth`가 **0**이고
`document.visibilityState`가 `hidden`인 상태로 뜰 수 있다. 그러면 `clientWidth`·
`getBoundingClientRect()`가 **전부 0으로 나와** 레이아웃이 깨진 것처럼 보인다.

먼저 `window.innerWidth`를 재 보고, 0이면 `resize_window`로 크기를 명시한 뒤 다시 측정한다.
이미 크기가 잡힌 기존 탭을 `navigate`로 재활용하는 게 가장 빠르다.

### 함정 4 — 자동 전환 캐러셀은 "몇 초 기다려 보기"로 판단하면 안 된다

히어로 슬라이드는 9초, 공간 배너는 7초 주기다. 짝수 번 넘어가면 **제자리로 돌아와 있어서**
"안 도는 버그"로 보인다. 주기의 배수만큼 기다려 한 번만 보는 건 근거가 못 된다.

상태를 누적해 확인한다 — 타이머 콜백 안에 `window.__x = (window.__x||0)+1` 같은 마커를 심고
`cur` 값의 변화 이력을 남기면 한 번에 판별된다. 확인이 끝나면 **마커를 반드시 지운다**
(`grep -n "__" assets/js/*.js`).

### 소개 페이지 설비 캐러셀 확인 요령

가로 캐러셀 + lazy 이미지라 그냥 스크롤하면 빈 화면이 찍힌다.

1. 뷰포트를 `1280x1800`처럼 세로로 길게 잡으면 3개 그룹이 한 화면에 들어온다
2. 이미지 로딩에 2~3초 기다린 뒤 스크린샷
3. 좌우 화살표(`.fac-nav`)로 슬라이드 이동

## 자잘한 것

- `.claude/`와 `_원본자료/`는 gitignore. `.claude/launch.json` 수정은 커밋에 안 잡힌다
- `admin/credentials.json`은 공개 저장소에 커밋된 암호화 블롭(PBKDF2 + AES-GCM)이다. 평문 토큰·비밀번호를 이 저장소 어디에도 새로 넣지 않는다
- 이미지 원본은 `_원본자료/`, 웹용은 `uploads/<연도>/...`
