# docs/spec.md — Schema & API Contract

**Status: DRAFT.** Agreed and frozen on day 1 by all five. After freezing, changes go through 김민경 only.
Paste this whole file into your Claude Code session before starting.

---

## 1. Enums

```
profile_role      : 'student' | 'teacher'
review_status     : 'draft' | 'analyzing' | 'questioning' | 'passed' | 'failed'
gap_type          : 'unsupported_claim' | 'vague_statement' | 'feeling_only'
grade_level       : 1..9   -- 1=초1 ... 6=초6, 7=중1, 8=중2, 9=중3
point_reason      : 'verification_pass' | 'ebook_pass' | 'audiobook_pass' | 'admin_adjust'
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

## 3. RLS summary

| Table | Student | Teacher | Guardian token |
|---|---|---|---|
| profiles | own row | own row + students in owned classes (name, grade only) | — |
| classes | own class (read) | owned classes (all) | — |
| reviews | own rows (all columns) | **metadata only, never `body`** | **never `body`** |
| review_gaps | own | no | no |
| verifications | own | scores, passed, attempt_no — not `answer` | scores, passed |
| points_ledger | own | aggregate per student | aggregate |
| guardian_links | own (create/revoke) | no | own token row |

Rule of thumb: `reviews.body` and `verifications.answer` are visible to the student only, unless `reviews.is_shared = true`.

Guardian access goes through a Route Handler with the token, using the service role, never a direct client query.

---

## 4. Points rules

| Event | Delta |
|---|---|
| Verification passed | +50 |
| Verification failed | 0 (row still written) |
| 국회도서관 ebook 열람권 | −300 |
| 오디오북 열람권 | −450 |

Award and deduction happen inside one transaction with the verification/exchange row. Never award twice for the same `verification.id` — enforce with a unique index on `(reason, ref_id)`.

---

## 5. API contract

All under `/api`. All authenticated except the guardian route. All return `{ data }` or `{ error: { code, message } }`.

### auth (김민경)
```
POST /api/onboarding/student   { grade_level, join_code }        → { class }
POST /api/onboarding/teacher   { school_name, grade_level, class_no } → { class, join_code }
PATCH /api/profile             { grade_level }                   → { profile }
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
```

### verification (박재경 · uses 강민구's ai module)
```
POST /api/reviews/:id/question                     → { verification_id, question, quote, seconds }
POST /api/verifications/:id/answer  { answer }      → { passed, scores, feedback, points }
POST /api/reviews/:id/retry                        → { verification_id, question, quote, seconds }
```
The countdown starts client-side when the question renders, but `asked_at`/`answered_at` on the server are authoritative. Reject an answer arriving more than `ANSWER_WINDOW_SEC + 5` after `asked_at`.

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
GET /api/dict?word=                   → { word, definition, source }
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
