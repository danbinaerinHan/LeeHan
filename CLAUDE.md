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
- 렌더는 `el(tag, attrs, ...children)` 헬퍼 사용 (`assets/js/render.js`). 자식으로 배열·노드·`false` 모두 받는다.

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

### 소개 페이지 설비 캐러셀 확인 요령

가로 캐러셀 + lazy 이미지라 그냥 스크롤하면 빈 화면이 찍힌다.

1. 뷰포트를 `1280x1800`처럼 세로로 길게 잡으면 3개 그룹이 한 화면에 들어온다
2. 이미지 로딩에 2~3초 기다린 뒤 스크린샷
3. 좌우 화살표(`.fac-nav`)로 슬라이드 이동

## 자잘한 것

- `.claude/`와 `_원본자료/`는 gitignore. `.claude/launch.json` 수정은 커밋에 안 잡힌다
- `admin/credentials.json`은 공개 저장소에 커밋된 암호화 블롭(PBKDF2 + AES-GCM)이다. 평문 토큰·비밀번호를 이 저장소 어디에도 새로 넣지 않는다
- 이미지 원본은 `_원본자료/`, 웹용은 `uploads/<연도>/...`
