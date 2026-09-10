# docs/plan.md — 책잇 (Bookit)

Compact English plan for Claude Code sessions. Full Korean version with sources, cost analysis and legal review: `docs/plan-ko.md`.

---

## 1. What we are building

Korean elementary/middle school students (초1~중3) read a book and write a review. AI finds the logic gaps in that review, quotes the student's own sentence back and asks why they thought so, with a 30-60 second answer window. If the answer is consistent with the review and specific enough, it passes and the student earns 책갈피 (points), redeemable for free library access or book purchase links.

Contest: 원티드 AI Championship 2026. Submit by 2026-09-20. The deployed link must stay reachable through 2026-10-05.

## 2. Problem

Korean students read plenty — 36.0 books/year, 95.8% reading rate (2023 national survey). Comprehension is what dropped: 중3 Korean-language proficiency fell from 82.9% (2019) to 66.7% (2024), and 92% of teachers report worse literacy than before.

So the gap in the market is not "make them read more." It is "verify they actually understood." Every existing reading-reward service checks completion on trust — photo proof, self-report, or a checkbox. None verifies comprehension.

We target 초1~중3 because reading habits set early; the game mechanics are tuned for the younger end.

## 3. Core differentiator — the verification loop

The question is anchored to **the student's own sentence**, never to the book in general. For a famous book you can bluff a plot question; you cannot bluff "which scene made you think that?" about a sentence you did not write.

| Question type | Verdict |
|---|---|
| Interpretation / reasoning ("why did you think that?") | **Adopted** — requires on-the-spot reasoning, resists ghostwriting |
| Trivia (character names, plot details) | Rejected — students who did read still forget these |
| Hypothetical ("what if…") | Rejected — answer space too wide to grade |

Anti-cheat: the question is generated fresh on every submission (nothing to leak), the answer window is 30-60s (no time to open another AI), and grading checks consistency with the review, specificity, and sudden style shift — not correctness.

## 4. Feature set

| # | Feature | Notes |
|---|---|---|
| 1 | Gap analysis | Compares review against book content. Up to 3 gaps: `unsupported_claim`, `vague_statement`, `feeling_only` |
| 2 | Follow-up question | One interpretation question built from one gap, quoting the student |
| 3 | Grading + retry | 3 axes; pass → +50 책갈피; fail → 0 and a NEW question on retry |
| 4 | Writing helper | A guiding question before writing, so the blank page is less intimidating |
| 5 | Book search & recommendation | Genre-adjacent: mostly overlapping tags plus one new tag, with the reason shown |
| 6 | 책갈피 rewards | Ledger-based. Spend on 국회도서관 ebook (300) / audiobook (450) vouchers; 알라딘 purchase links |
| 7 | 책잇 서재 | In-app reader for public-domain texts, tap any word for a 국립국어원 dictionary definition |
| 8 | Class-vs-class ranking | Aggregates only AI-verified completions. Class vs class, never individual ranks |
| 9 | Teacher dashboard | Class ranking + per-student progress. Desktop only |
| 10 | Guardian link | Read-only, no account, token-scoped |
| 11 | Growth | Streak, 책나무 (a leaf per book), genre stamp board (3 books = 1 stamp), levels/badges |
| 12 | Challenges | Class cooperative goal + seasonal themed challenge |
| 13 | Reading-profile report | Summary of accumulated reviews. Needs seed data to look real |

## 5. Privacy stance (a product decision, not a nicety)

Review body text is visible to the student only. Not to teachers, not to guardians, unless the student explicitly shares that review. A child who feels watched writes defensively, and a defensive review has no gaps worth questioning — the whole verification loop degrades. Teachers and guardians see scores, pass/fail and completion counts.

Teachers own a class and get a 6-character join code; students enter that code at onboarding. Free-text school/class entry is not used — anyone could type their way into another class's data.

No file uploads anywhere. No behavioral ad targeting (regulated for minors in Korea); content filtering by grade level instead.

## 6. Stack

Next.js (App Router, TypeScript) · Supabase PostgreSQL + Auth (Google only) · Vercel Route Handlers (no Edge Functions) · one LLM vendor, server-side only (Google Gemini, `gemini-3.5-flash`) · Vercel · no Storage.

Key risks: serverless timeout on long AI calls (stream, cap output tokens, paid plan), perceived latency during the countdown (pre-generate the question, start the timer only when it renders), Supabase free-tier project pausing during judging (upgrade or ping), and grading calibration (threshold in an env var, tunable up to demo time).

## 7. Team

| Owner | Modules | Screens |
|---|---|---|
| 강민구 | `ai`, `reader` | 책잇 서재 |
| 김민경 | `auth`, `teacher`, `shared` | Login, onboarding, teacher dashboard. Also schema, RLS, API contract, deploy, integration |
| 이승환 | `books` | Home, search, library handoff |
| 박재경 | `review`, `verification` | Write, gap analysis, question, result |
| 문민재 | `rewards`, `growth`, `ranking`, `guardian` | My page, exchange, 책나무, challenge, guardian link |

Split vertically by screen, not horizontally by layer: each owner holds their own UI and API, so nobody waits on anyone. The one shared surface — schema, `src/shared/`, migrations — is owned by 김민경 alone.

## 8. Priority

Ship first: verification loop (gap analysis → question → grading → retry), 책잇 서재, class ranking, teacher dashboard, rewards.

Cut in this order: challenges → reading-profile report → levels/badges → 책나무/stamps → genre-adjacent recommendation (degrade to a plain same-tag list).

## 9. Out of scope (roadmap, do not build)

Emotional risk detection and counseling referral, voice input, anonymous peer sharing of reviews, publisher licensing for copyrighted books in the reader, formal guardian-consent flow, native app store release.