# 저학년(초1~3) 개편 목업 · 9·10

만 7~9세 대상으로 다시 그린 화면이다. 반응형 웹 한 벌로 개발한다는 전제이고,
목업 9(태블릿 1194×834)와 10(모바일 430×932)은 **같은 화면의 두 배치**다.

## 넣는 곳

```
docs/mockups/9 저학년 개편 (태블릿).dc.html
docs/mockups/10 저학년 개편 (모바일).dc.html
docs/mockups/support.js              ← 목업 런타임 (기존 목업과 공용이면 덮어쓰지 않아도 된다)
docs/mockups/public/covers/*.webp    ← 목업이 표지를 불러오는 상대 경로. 레포 public/covers 와 같은 파일이다
src/shared/styles/tokens-kids.css    ← 아래 참고
```

브라우저에서 `.dc.html` 파일을 그대로 열면 된다. 빌드는 필요 없다.

`tokens-kids.css` 는 `src/app/globals.css` 에서 기존 토큰 뒤에 얹는다:

```css
@import "../shared/styles/tokens.css";
@import "../shared/styles/tokens-kids.css";
```

## 색은 하나도 바뀌지 않았다

`docs/design-tokens.md` 의 팔레트를 그대로 쓴다. 코랄=주요 행동, 노랑=보상·책갈피,
초록=무료 열람, 파랑=정보. 검증(꼬리질문) 화면만 `--panel` 로 어둡다.

바뀐 것은 **크기·둥글기·모션** 세 가지뿐이다.

| | 기존 | 저학년 개편 |
|---|---|---|
| 본문 | 15~17px | 태블릿 20px / 모바일 18px |
| 제목 | 26px / 700 | 38~52px, Jua |
| 버튼 높이 | 48px | 태블릿 86px / 모바일 70px |
| 카드 라운드 | 14~16px | 22~28px |
| 테두리 | 1px | 3px |
| 상태 표시 | 문장 | 캐릭터 + 진행바 + 아이콘 |

폰트는 제목·숫자·버튼에 **Jua**(Google Fonts)를 더했다. 본문은 Noto Sans KR 그대로다.

## 반응형 규칙 (768px)

| | < 768px (모바일) | >= 768px (태블릿) |
|---|---|---|
| 내비게이션 | 하단 탭 5개 (홈·독후감·도감·서재·나), 92px | 좌측 아이콘 레일 116px |
| 독후감 작성 | 에디터 → 도우미 바텀시트, 순차 2단계 | 에디터 + 도우미 2단 |
| 표지 그리드 | 2열 | 5열 |
| 도감 | 3열 | 5열 |
| 책 상세 | 세로 스택 + 하단 고정 버튼 | 좌우 2단 (표지 / 정보) |
| 화면 패딩 | 22px | 34px |

## 화면 목록

| # | 화면 | 참고한 레포 파일 |
|---|---|---|
| 01 | 온보딩 — 탐험가 등급 + 반 코드 | `0014_gamification.sql` (explorer_rank) |
| 02 | 홈 — 캐릭터 진행, 오늘의 미션, 추천, 이어서 쓰기 | README 화면 3 |
| 03 | 책 검색 — 그림 칩, 바로 읽기 표시 | `shelf-candidates.json` |
| 04 | 책 상세 — 표지 퍼즐 조각 | `reading_progress`, `characters` |
| 05 | 독후감 작성 — 글쓰기 도우미 | README 화면 5 |
| 06 | AI 꼬리질문 — 타이머, 문장 인용 | README 화면 7, `--panel` |
| 07 | 채점 결과 — 책갈피 +50, 진화, 뱃지 | `character_on_pass` 트리거 |
| 08 | 도감 · 책나무 | `student_characters.stage` 0/1/2 |
| 09 | 프로필 · 아이템 샵 | `0016_item_shop.sql` (가격 동일) |
| 10 | 랭킹 — 반 대항전 | README 화면 15 |

## 구현할 때 지킬 것

- 캐릭터 그림은 아직 임시 이모지다. `characters.art_seed` 에 맞춰 일러스트가 들어오면 교체한다
- 진화 단계는 클라이언트가 계산하지 않는다. `student_characters.stage` 를 그대로 읽는다
- 아이템 가격은 `items` 테이블에서만 읽는다 (목업의 100/300/150/250/120/350 은 0016 값)
- 실패 화면은 아직 없다. "다시 답해볼까?" 톤으로 별도 필요
- 모션은 `prefers-reduced-motion` 에서 전부 끈다 (tokens-kids.css 에 포함)
