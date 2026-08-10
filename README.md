# naver-blog-automation

**사진만 넣으면 내 말투·형식대로 네이버 블로그 초안을 자동 작성하고 임시저장하는 Playwright 자동화 프로젝트**

맛집 블로그([blog.naver.com/zzul_s](https://blog.naver.com/zzul_s))를 운영하면서, 매번 반복되는 글 작성 패턴(인사말 → 위치/지도 → 사진+후기 섹션 → 마무리 → 태그)을 JSON 데이터 한 파일로 정의하면 스크립트가 네이버 스마트에디터에서 그대로 초안을 만들어 줍니다.

## 기술 스택

- **Playwright** (`@playwright/test`) — 브라우저 자동화
- **Node.js** — 실행 환경

## 동작 방식

1. `data/*.json`에 글 제목, 인사말, 섹션(사진 파일명 + 본문 문장), 장소 정보, 태그를 정의합니다.
2. 스크립트가 저장된 로그인 세션(`naver-auth.json`, 커밋 제외)으로 글쓰기 페이지에 진입합니다.
3. 스마트에디터 iframe 안에서 제목 → 인사말 → 위치(지도 첨부 + 주소/영업시간/전화/주차) → 섹션별 소제목(인용구)·사진·본문 → 마무리 → 스티커 순으로 입력합니다.
4. 발행창에서 주제·태그까지 넣은 뒤 **발행하지 않고 임시저장**합니다.
5. 어떤 단계가 실패해도 멈추지 않고 `[건너뜀]` 로그를 남기고 다음 단계로 진행 — 임시저장까지는 반드시 도달하도록 설계했습니다.

## 실행법

```bash
# 특정 가게 데이터로 실행
$env:POST_DATA='data/samduk-chicken.json'; npx playwright test tests/blog-post.spec.js --headed --project=chromium
```

```bash
# 단일 스크립트 버전
npx playwright test tests/naver-test.spec.js --headed --project=chromium
```

> 최초 1회는 수동 로그인 후 `context.storageState({ path: 'naver-auth.json' })`로 세션을 저장해 두어야 합니다.

## 트러블슈팅 (핵심 구현 포인트)

네이버 스마트에디터는 일반적인 폼이 아니라 iframe 속 contenteditable 기반 에디터라서, 그대로 자동화하면 계속 깨집니다. 겪은 문제와 해결책:

| 문제 | 해결 |
|---|---|
| 에디터 전체가 `iframe[name="mainFrame"]` 안에 있음 | `page.frameLocator()`로 프레임 스코프를 잡고 모든 조작을 그 안에서 수행 |
| `fill()`/`type()`으로 한글 입력 시 글자 깨짐 | IME를 거치지 않는 `keyboard.insertText()` 사용 |
| 이모지와 글자를 같이 넣으면 이모지 뒤 글자가 유실됨 | 이모지 입력 → 대기 → 텍스트 입력으로 분리 |
| 세로라인 인용구(소제목)에 들어가면 커서가 갇힘 | 입력 후 `본문 추가` 버튼으로 명시적으로 본문 복귀 |
| `getByRole('button', { name: '인용구 2' })`가 strict mode 충돌 | `listbox` 범위로 좁혀서 선택 |
| 사진 여러 장 업로드 시 '비슷한 사진 묶기' 팝업이 흐름을 끊음 | `filechooser` 이벤트 가로채기 + 팝업에서 슬라이드/콜라주 자동 선택, 이벤트가 안 오면 `#hidden-file` input에 직접 주입으로 폴백 |
| 지도(장소) 첨부 팝업이 검색 결과에 따라 실패 | 첫 번째 결과 자동 선택, 실패 시 팝업을 확실히 닫고 본문으로 복귀해 나머지 작성 계속 |
| 계정 비밀번호가 코드에 노출될 위험 | 로그인은 `storageState`(세션 파일)로 분리 — 코드에 인증정보 없음, 세션 파일은 `.gitignore` 처리 |

## 주의

개인 학습용 프로젝트입니다. 실제 사용 시 네이버 서비스 약관 및 자동화 정책에 유의하세요.
