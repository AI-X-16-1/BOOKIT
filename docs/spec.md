# docs/spec.md — Schema & API Contract

**Status: DRAFT.** Agreed and frozen on day 1 by all five. After freezing, changes go through 김민경 only.
Paste this whole file into your Claude Code session before starting.

---

## 1. Enums

```
profile_role      : 'student' | 'teacher'
review_status     : 'draft' | 'analyzing' | 'questioning' | 'passed' | 'failed'
gap_type          : 'unsupported_claim' | 'vague_statement' | 'feeling_only' | 'core_claim'
                    -- core_claim: 빈틈 0개일 때 AI 가 고른 핵심 주장 (0013, issue #14). 빈틈이 아니다
grade_level       : 1..9   -- 1=초1 ... 6=초6, 7=중1, 8=중2, 9=중3. 2026-09-20 타겟을 초1~3 으로 좁혔다 — 온보딩은 1·2·3 만 고르게 하고(#192) check 제약은 그대로 둔다 (시드 반 5학년·기존 프로필·서재 target_grade 가 그 위에 있다)
point_reason      : 'verification_pass' | 'ebook_pass' | 'audiobook_pass' | 'admin_adjust' | 'item_purchase'
                    -- item_purchase: 아이템 샵 (0016). delta = -price, ref_id = student_items.id
item_kind         : 'hat' | 'bg' | 'frame'
challenge_kind    : 'class_goal' | 'season'
```

---

## 2. Tables

### profiles
| column | type | note |
|---|---|---|
| id | uuid PK | = `auth.users.id` |
| role | profile_role | default `'student'` |
| display_name | text | from Google |
| grade_level | int | students only, nullable for teachers |
| created_at | timestamptz | |

### classes
| column | type | note |
|---|---|---|
| id | uuid PK | |
| teacher_id | uuid FK → profiles | owner |
| school_name | text | |
| grade_level | int | |
| class_no | int | 예: 2반 |
| join_code | char(6) UNIQUE | uppercase alphanumeric, ambiguous chars excluded (0/O/1/I) |
| created_at | timestamptz | |

### class_members
| column | type | note |
|---|---|---|
| class_id | uuid FK | PK part |
| student_id | uuid FK | PK part |
| joined_at | timestamptz | |

A student belongs to at most one active class.

### books
| column | type | note |
|---|---|---|
| id | uuid PK | |
| isbn13 | text UNIQUE nullable | null for public-domain texts |
| title, author, publisher | text | |
| cover_url | text | 알라딘 image URL |
| tags | text[] | normalized to the app's 10-15 genre tags |
| target_grade_min/max | int | recommendation filter |
| is_public_domain | bool | true → readable in 책잇 서재 |
| library_url | text nullable | 국회전자도서관 deep link |
| aladin_url | text nullable | affiliate link |

### book_contents
For public-domain books only. `book_id`, `chapter_no`, `title`, `body text`.

### reviews
| column | type | note |
|---|---|---|
| id | uuid PK | |
| student_id | uuid FK | |
| book_id | uuid FK | |
| body | text | the review itself |
| char_count | int | |
| status | review_status | |
| is_shared | bool | default false — student opt-in to expose body |
| created_at, updated_at | timestamptz | |

One active review per (student, book). Re-reading creates a new row.

### review_gaps
`id`, `review_id`, `ord` (1-3), `quote text`, `gap_type`, `reason text`.
Produced by AI call #2. Deleted and regenerated if the student edits and resubmits.

### verifications
| column | type | note |
|---|---|---|
| id | uuid PK | |
| review_id | uuid FK | |
| student_id | uuid FK | denormalized for RLS speed |
| attempt_no | int | 1, 2, 3... |
| gap_id | uuid FK | which gap this question came from |
| question | text | |
| answer | text | |
| logic_consistency | text | 'pass' \| 'weak' \| 'fail' |
| specificity | text | same |
| style_consistency | text | 'same' \| 'shifted' |
| passed | bool | |
| feedback | text | shown to the student |
| points_awarded | int | 50 on pass, 0 on fail |
| asked_at, answered_at | timestamptz | server-side timer source of truth |

Never delete a failed attempt. Retry inserts a new row with `attempt_no + 1` and a **new question from a different gap** when one is available.

### points_ledger
`id`, `student_id`, `delta int` (signed), `reason point_reason`, `ref_id uuid`, `created_at`.
**Append-only.** Balance = `sum(delta)`. There is no balance column.

### streaks
`student_id PK`, `current_days`, `longest_days`, `last_passed_on date`.

### genre_stamps
`student_id`, `genre text`, `completed_count int`. 3 completions = one stamp.

### challenges / challenge_progress
`challenges`: `id`, `kind`, `class_id nullable`, `title`, `target int`, `starts_on`, `ends_on`.
`challenge_progress`: `challenge_id`, `student_id`, `value int`.

### guardian_links
`token text PK` (32+ chars, random), `student_id`, `created_at`, `revoked_at nullable`.

---

## 2b. 게임화 (2026-09-18 추가 — 마감 스프린트, `docs/sprint-0918.md`)

**Status: 확정 (2026-09-18, #132 → 0014).** 마이그레이션 `0014_gamification.sql` 하나로 들어간다. 기존 테이블·정책·`record_verification_result`·`points_ledger` 규칙은 건드리지 않는다.
아래 "가정" 은 김민경이 정한 초안이다. 다르게 가야 하면 9/18 오전 안에 말한다 — 그 뒤엔 코드가 시작된다.

### characters — 캐릭터 도감 (카탈로그, 정적)
| column | type | note |
|---|---|---|
| id | uuid PK | |
| book_id | uuid FK books **unique** | **책 한 권 = 캐릭터 한 마리.** `curated` 책(시드 15권 + 서재)에 붙인다 — 데모 학생이 통과한 책이 서재 밖(아몬드·완득이…)이라 서재만으로는 도감이 빈다. 검색 유입분에는 없다. 시드로 넣는다 |
| name | text | 예: 「눈 어두운 포수」→ "안경 사슴" |
| stage_names | text[3] | 알 → 1단계 → 2단계 이름. `['알', '아기 사슴', '안경 사슴']` |
| art_seed | text | 그림이 없으니 `COVER` 그라데이션 + 이모지/색으로 그린다. 표지와 합성해 도감에 보인다 |

**가정: 진화 3단계.** `stage 0` 알(책을 펼치면 받음) → `stage 1` 부화(체크포인트 1개 통과 또는 마지막 장 도달) → `stage 2` 최종(**독후감 검증 통과**). 검증 통과가 유일한 최종 진화 조건이라 "책갈피 = 검증" 규칙과 나란히 간다.

### student_characters — 학생이 가진 캐릭터
| column | type | note |
|---|---|---|
| student_id | uuid FK profiles | |
| book_id | uuid FK books | PK (student_id, book_id) |
| stage | smallint | 0..2. 내려가지 않는다 |
| obtained_at | timestamptz | 알을 받은 때 |
| evolved_at | timestamptz nullable | 마지막 진화 |

`stage` 갱신은 **DB 트리거**로 한다 (0011 과 같은 방식): `reading_progress` 삽입 → 조건 맞으면 1, `points_ledger` 에 `verification_pass` 삽입 → 그 책 캐릭터 2. 검증 응답 시간에 얹지 않는다.

### reading_progress — 서재 읽기 기록 (표지 퍼즐의 재료)
| column | type | note |
|---|---|---|
| student_id | uuid | |
| book_id | uuid | |
| chapter_no | int | PK (student_id, book_id, chapter_no) |
| read_at | timestamptz | |

**가정: 퍼즐 조각 = 읽은 장.** 진행률 = `count(*) / (그 책의 book_contents 장 수)`. 리더 화면이 장 끝에 닿으면 한 번 쓴다 (upsert, 중복 무시). 따로 퍼즐 테이블은 두지 않는다.

### checkpoints — 장 끝 한 문항 (AI #6)
| column | type | note |
|---|---|---|
| id | uuid PK | |
| student_id | uuid | |
| book_id | uuid | |
| chapter_no | int | |
| question | text | AI #6 이 그 장 본문으로 만든 한 문항. 해석형, 정답 있는 퀴즈 아님 |
| answer | text nullable | |
| passed | boolean nullable | AI 가 본문과 대조해 판정 (채점 #4 와 별개, **책갈피 없음**) |
| asked_at / answered_at | timestamptz | 검증과 달리 시간 제한 없음 |

**가정: 체크포인트는 책갈피를 주지 않는다.** 캐릭터 부화(stage 1)와 퍼즐 완성감만 준다. 책갈피는 여전히 검증 통과에서만 나온다 (§4 불변).

### profiles.explorer_rank — 탐험가 등급 (② 온보딩)
`profiles` 에 `explorer_rank text nullable` 한 칸. 값은 `'새싹' | '탐험가' | '대장'` 중 학생이 온보딩에서 고른다 (학년 선택과 같은 수준의 자기 선언, 검증 없음). 화면 톤(인사말·캐릭터 말투)에만 쓴다. **학년(`grade_level`)을 대체하지 않는다** — 학년은 AI 난이도에 쓰이므로 그대로.

### items / student_items — 아이템 샵 (④ 스트레치) — **스키마 0016 깔림, 화면·라우트는 rewards 몫**
`items`: `id`, `code unique`, `name`, `kind item_kind`, `emoji`, `price int > 0`. 카탈로그 6개(모자 2·배경 2·액자 2, 100~350)는 마이그레이션이 넣는다.
`student_items`: `id`, `student_id`, `item_id`, `bought_at`, unique (student, item).
구매는 **`buy_item(p_student_id, p_item_id)` RPC** (service_role 전용, `exchange_points` 와 같은 advisory lock) — 잔액 확인 + `points_ledger(reason 'item_purchase', delta -price, ref_id = student_items.id)` + 지급을 한 트랜잭션으로. 잔액 부족은 `check_violation`, 이미 가짐은 `unique_violation` 으로 던진다. **append-only 규칙 그대로.** 학생 클라이언트는 둘 다 읽기만.

### 데모 시드
`demo@bookit.demo` 에 캐릭터 5마리(stage 2 세 마리 = 통과한 책, stage 1 하나, 알 하나), 읽기 진행 2권(완독 1, 반쯤 1). 도감이 비어 보이면 안 된다.

---

## 2c. 레벨테스트 — 읽기 수준 진단 (2026-09-18 추가, 제출 범위 **안**)

짧은 지문 하나와 문항 셋으로 읽기 수준을 가늠해 **권장 학년**을 낸다.
2026-09-18 에 한 번 "제출 후" 로 미뤘다가 같은 날 제출 범위로 되돌렸다.

**표가 없다.** 진단 이력을 쌓지 않으므로 마이그레이션도 없다 — 학생이 결과를 받아들이면
기존 `PATCH /api/profile` 로 `profiles.grade_level` 한 칸이 바뀌는 것이 전부다.
지문은 서재(공개 도메인) `book_contents` 1장 앞 1,200자를 쓴다. 새 콘텐츠도 없다.

**권장할 뿐 덮어쓰지 않는다.** 판정 라우트는 추천만 돌려주고, 적용은 학생이 누를 때 화면이 한다.
`grade_level` 은 지금도 앞으로도 학생이 고른 값이다.

이름이 비슷한 넷을 섞지 않도록 적어 둔다.

| 이름 | 무엇 | 상태 |
|---|---|---|
| `profiles.grade_level` | 1~9 (온보딩 선택지는 초1~3, 2026-09-20 #192). 학생이 온보딩에서 **고른다.** AI 난이도·서재 필터가 쓴다 | 구현됨 |
| `profiles.explorer_rank` | `새싹·탐험가·대장`. 자기 선언, 검증 없음, 화면 톤 전용 (§2b) | 구현됨 |
| 레벨·뱃지 | 누적 책갈피 기반 등급 (`plan-ko.md` §4-10) | 스키마 없음 · 축소 순서 3번 |
| **레벨테스트** | 지문 + 문항으로 읽기 수준을 가늠해 **권장 학년**을 낸다 (§5c) | 구현됨 · 표 없음 |

### 진입로 — 두 곳 (2026-09-18)

1. **가입(온보딩)** — 학생 온보딩 화면에서 `읽기 수준도 확인해볼까?` 를 **해볼래 / 나중에** 로 고른다.
   기본값은 "해볼래". 끈 학생은 저장 뒤 곧장 `/home` 으로 간다.
   `POST /api/onboarding/student` 의 본문은 바뀌지 않는다 — **고른 값은 서버로 보내지 않고
   화면이 다음 목적지를 정하는 데만 쓴다.** 진단 여부를 저장할 칸이 없고, 저장할 이유도 없다
   (안 한 학생도 '나' 화면에서 언제든 할 수 있으므로 "안 함" 상태가 따로 필요하지 않다).
2. **'나' 화면 맨 위** — 언제든 다시. 시연 로그인(`/auth/demo`)은 온보딩을 건너뛰므로
   심사자에게는 이쪽이 유일한 진입로다.

### 5c. 레벨테스트 라우트

```
POST /api/level-test        → { book_id, book_title, author, passage, questions[3] }
POST /api/level-test/grade  { book_id, questions, answers } → { recommended_grade, confidence, feedback, current_grade }
```

문항 셋은 난이도가 다르다 — 쉬움(지문에 적힌 것 제 말로) · 보통(왜 그랬나 + 어느 대목) ·
어려움(흩어진 대목 묶기). 같은 난이도로만 물으면 "맞았다/틀렸다" 밖에 안 남아
**학년을 어느 쪽으로 옮길지**가 안 나온다. 이 기능의 목적은 측정이 아니라 방향이다.

판정 프롬프트(AI #7)에 **"빈 답으로 학년을 내리지 마라"** 가 들어 있다. 한 번 못 푼 것으로
아이의 책을 쉬운 쪽으로 밀면 진단이 아이를 돕는 게 아니라 가둔다.

진단은 **책갈피·스트릭·캐릭터·검증 테이블을 건드리지 않는다** (§4 불변).
상태를 서버에 두지 않아 채점 요청이 문항을 되보내지만, 지문 본문은 되받지 않고
`book_id` 로 서버가 다시 읽는다.

---

## 3. RLS summary

| Table | Student | Teacher | Guardian token |
|---|---|---|---|
| profiles | own row | own row + students in owned classes (name, grade only) | — |
| classes | own class (read) | owned classes (all) | — |
| reviews | own rows — read all, write `body` / `char_count` / `is_shared` only. `status` is server-only | **metadata only, never `body`** | **never `body`** |
| review_gaps | own | no | no |
| verifications | own — **read only**. All writes go through the service role (attempt insert, `asked_at`, `record_verification_result`) | scores, passed, attempt_no — not `answer` | scores, passed |
| points_ledger | own | aggregate per student | aggregate |
| guardian_links | own (create/revoke) | no | own token row |
| characters (2b) | read all | read all | read all (카탈로그) |
| student_characters · reading_progress · checkpoints (2b) | own — read; `reading_progress` 는 own insert, 나머지 write 는 service role/트리거 | **no** (게임 기록은 성적이 아니다) | `student_characters` 만 stage 집계 (도감 수) |
| items / student_items (2b, ④) | read all / own | no | no |

Rule of thumb: `reviews.body` and `verifications.answer` are visible to the student only, unless `reviews.is_shared = true`.

Guardian access goes through a Route Handler with the token, using the service role, never a direct client query.

---

## 4. Points rules

| Event | Delta |
|---|---|
| Verification passed | +50 |
| Verification failed | 0 (row still written) |
| (exchange — retired, #58) | `ebook_pass` −300 / `audiobook_pass` −450 stay in the enum and `exchange_points` (0010) for ledger history; the UI no longer offers them (#64). No new spend path before submission. |

Award and deduction happen inside one transaction with the verification/exchange row. Never award twice for the same `verification.id` — enforce with a unique index on `(reason, ref_id)`.

---

## 5. API contract

All under `/api`. All authenticated except the guardian route. All return `{ data }` or `{ error: { code, message } }`.

### auth (김민경)
```
POST /api/onboarding/student   { grade_level, join_code, explorer_rank? } → { class }   explorer_rank 는 선택 (§2b)
POST /api/onboarding/teacher   { school_name, grade_level, class_no } → { class, join_code }
GET   /auth/demo?as=student|teacher                             → 302 "/"   심사위원용 시연 로그인. DEMO_LOGIN_ENABLED 일 때만, 아니면 404. 시드 계정으로 세션을 심는다 (매직링크 토큰을 서버 안에서 소비)
GET   /api/profile                                              → { display_name, role, grade_level, explorer_rank, class_label }   내 정보. class_label 은 "5학년 2반" 꼴, 반이 없으면 null
PATCH /api/profile             { grade_level?, explorer_rank? }   → { profile }   둘 중 하나 이상. explorer_rank 는 null 로 지울 수 있다 (§2b)
DELETE /api/profile                                              → { deleted }   계정·데이터 전부 삭제(cascade), 세션 종료. 시드 계정(@bookit.demo)은 403 demo_account
```

### books (이승환)
```
GET  /api/books/search?q=                    → { books[] }
GET  /api/books/recommend                    → { books[], reason_tags[] }
GET  /api/books/:id                          → { book }
```

### review (박재경)
```
POST  /api/reviews             { book_id }                → { review }  (draft)
PATCH /api/reviews/:id         { body }                   → { review }  autosave, debounce 2s
POST  /api/reviews/:id/submit                             → { gaps[] }  triggers AI #2 + pre-generates AI #3
                                                          0 gaps → AI #2b picks one `core_claim` row, flow continues (#14)
POST  /api/reviews/:id/helper                             → { question }  AI #1. On failure the editor renders without the helper box
```
`helper` returns an object so it can grow to `{ questions[] }` if #16 lands.

### verification (박재경 · uses 강민구's ai module)
```
POST /api/reviews/:id/question                     → { verification_id, question, quote, seconds }
POST /api/verifications/:id/answer  { answer }      → { passed, scores, feedback, points }   서재 책이면 본문(≤12k자)을 채점에 넘긴다 — 책과 무관한 답은 logic fail (#120)
POST /api/reviews/:id/retry                        → { verification_id, question, quote, seconds }
```
The countdown starts client-side when the question renders, but `asked_at`/`answered_at` on the server are authoritative. Reject an answer arriving more than `ANSWER_WINDOW_SEC + 5` after `asked_at`.

When no question can be built and the only gap is `core_claim`, these routes return `{ error: { code: "rewrite_needed" } }` and put the review back to `draft`: a gap-free review has no second gap to fall back to, so the editor reopens instead of dead-ending (#14, decided 2026-09-16). Failed attempts are kept.

### ai (강민구) — internal, not routed directly
```
writingHelper(book, grade) → { question }
analyzeGaps(review, book)  → { gaps: [{ quote, type, reason }] }   max 3
buildQuestion(gap, review) → { question }
grade(review, gap, question, answer) → { logic_consistency, specificity, style_consistency, passed, feedback }
```

### reader (강민구)
```
GET /api/reader/:bookId?chapter=1     → { title, body }
GET /api/dict?word=                   → { word, definition, source, senses: [{ definition }] }  senses 1-5, definition = senses[0] (#43)
```

### rewards / growth / ranking / guardian (문민재)
```
GET  /api/points                       → { balance, ledger[] }
POST /api/points/exchange { kind }     → { balance, voucher_url }
GET  /api/growth                       → { streak, tree_stage, leaves, stamps[] }
GET  /api/ranking/class                → { my_class, rows[] }
GET  /api/challenges                   → { class_goal, season }
POST /api/guardian/link                → { url }
GET  /api/guardian/:token              → { summary, books[] }        no auth
```

### 5b. 게임화 (2026-09-18, spec §2b) — DRAFT
```
GET  /api/characters                    → { characters[]: { book_id, name, stage, stage_name, cover_url, obtained_at } }   도감. 강민구(진화 로직) · 박재경(화면)
POST /api/reading/progress { book_id, chapter_no } → { read_chapters, total_chapters, character_stage }   장 끝에서 리더가 호출. 퍼즐 진행률 + (부화했으면) 새 stage. 강민구(reader)
POST /api/checkpoints  { book_id, chapter_no }     → { checkpoint_id, question }        AI #6. 이미 있으면 그대로 돌려준다
POST /api/checkpoints/:id/answer { answer }        → { passed, feedback, character_stage }
PATCH /api/profile     { explorer_rank }           → { profile }                        ② 온보딩에서 고르고(POST /api/onboarding/student 의 explorer_rank), 나중에 이 라우트로 바꾼다 — 구현됨
GET  /api/items                                    → { items[]: Item & { owned }, balance }   ④ 카탈로그 + 내 것
POST /api/items/:id/buy                            → { balance, owned[] }   buy_item RPC. 잔액 부족 402 insufficient_points · 이미 가짐 409 already_owned. rewards(문민재)
```
검증 결과 응답(`POST /api/verifications/:id/answer`)은 **바꾸지 않는다.** 보스전 화면은 그 응답을 그대로 받아 연출만 한다. 통과 뒤 캐릭터가 최종 진화했는지는 화면이 `GET /api/characters` 를 한 번 더 부른다 (트리거가 이미 올려 둔 뒤라 즉시 반영).

### teacher (김민경)
```
GET /api/teacher/class                 → { class, join_code, stats }
GET /api/teacher/students              → { rows[] }   name, passed_count, avg_score, streak, last_active
GET /api/teacher/ranking               → { rows[] }
```
`rows[]` never contains review body text.

---

## 6. Environment

See `.env.example`. Tunable at demo time: `ANSWER_WINDOW_SEC` (default 45), `PASS_THRESHOLD` (default `'moderate'`).

---

## 7. Seed data (required for the demo)

`supabase/seed.sql` must produce: one teacher, one class (한빛초 5학년 2반), ~24 students, 12 reviews for the demo student, 3 passed books with scores 92/88/95, a 7-day streak, 1,240 points, class ranking with 5 classes, and 3-5 public-domain books with chapter text.

Without seed data the 독서성향 리포트, ranking and 책나무 screens are empty and the demo falls flat.
