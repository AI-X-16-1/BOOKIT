# CLAUDE.md — 책잇 (Bookit)

AI reading-comprehension verification service for Korean elementary/middle school students (초1~중3).
Flow: pick book → write review → AI finds logic gaps → AI asks one follow-up question (timed) → AI grades → award points (책갈피).

Contest: 원티드 AI Championship 2026. Submit by 2026-09-20. Deployed link must stay up through 2026-10-05.

---

## 1. Stack (fixed — do not substitute)

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router, TypeScript) |
| DB | Supabase PostgreSQL (RLS always on) |
| Auth | Supabase Auth, Google OAuth only. (Judging exception: `/auth/demo` signs the seeded demo student/teacher in without Google while `DEMO_LOGIN_ENABLED=true`, closes after 2026-10-17 — see `modules/auth/server/demo.ts`) |
| Serverless | Vercel Route Handlers only. NO Supabase Edge Functions |
| LLM | Anthropic Claude, `claude-sonnet-5`. One vendor only, server-side only. (Switched from Gemini on 2026-09-16 — Google's generative-AI terms bar services likely to be accessed by under-18s, both Gemini API and Vertex AI. See #54) |
| Deploy | Vercel |
| Storage | Not used. No file uploads anywhere |
| Package manager | npm (`package-lock.json` is the lockfile; CI runs `npm ci`. Decided in #7 — do not add a pnpm/yarn lockfile) |

Never call the LLM from the client. Never expose API keys to the browser. All LLM calls go through an authenticated Route Handler.

Every LLM call goes through `callJson()` in `modules/ai/server/llm.ts` - never call a vendor SDK directly. It owns JSON-schema enforcement, defensive re-parsing, one re-ask on a malformed response, transient retry, and model fallback. Vendor differences live in `providers.ts`; `LLM_PROVIDER` keeps exactly one alive.

---

## 2. Repo layout

```
docs/           spec.md (schema + API contract), design-tokens.md, prompts.md
src/app/        routes only — thin, no business logic
  (auth)/       login, onboarding
  (main)/       home, write, me, library, challenge
  (teacher)/    teacher dashboard (desktop only)
  api/          route handlers, one folder per module
src/modules/    domain logic — one owner each (see §3)
src/shared/     ui/, styles/, supabase/, types/  — shared, restricted
supabase/migrations/
```

Module internals: `components/`, `server/`, `schema.ts`, `index.ts`.

**Import rule:** cross-module imports go through `index.ts` only. Never reach into another module's internal files.
**Shared rule:** `src/shared/` and `supabase/migrations/` are owned by 김민경. Do not edit them in another owner's session — request the change instead.

---

## 3. Module ownership

| Module | Owner | Scope |
|---|---|---|
| `ai` | 강민구 | 4 prompts (writing helper, gap analysis, question generation, grading), LLM client, genre-tag normalization |
| `reader` | 강민구 | 책잇 서재 — public-domain text rendering, word-tap dictionary (국립국어원 API) |
| `auth` | 김민경 | Google OAuth, profiles, role split, onboarding, class codes, RLS policies, PWA, deploy |
| `teacher` | 김민경 | Class ranking aggregation, per-student progress view (desktop only) |
| `books` | 이승환 | 알라딘 / 국립어린이청소년도서관 / 국립중앙도서관 APIs, search, genre-adjacent recommendation, link-out to 책잇 서재 for public-domain books |
| `review` | 박재경 | Review editor, autosave, draft state |
| `verification` | 박재경 | Gap-analysis screen, timed question screen, grading result, retry flow |
| `rewards` | 문민재 | 책갈피 ledger, 알라딘 links. (열람권 exchange retired — #58; ledger enum kept for history) |
| `growth` | 문민재 | Streak, 책나무, genre stamp board, levels/badges |
| `ranking` | 문민재 | Class-vs-class ranking (student side), challenges |
| `guardian` | 문민재 | Read-only guardian share link |

Names above are the only Korean in this file. Everything else stays English.

---

## 4. Data model (agreed day 1 — see docs/spec.md for the authoritative version)

Core tables: `profiles`, `classes`, `class_members`, `books`, `reading_logs`, `reviews`, `verifications`, `points_ledger`, `streaks`, `genre_stamps`, `challenges`, `guardian_links`.

Key rules:
- `profiles.role` is `'student' | 'teacher'`.
- A teacher creates a class and gets a 6-character join code. Students join by entering that code during onboarding. Free-text school/class input is NOT allowed — it would let anyone read another class's data.
- `points_ledger` is append-only. Never mutate a balance column; sum the ledger.
- Points are awarded only on a passing verification. A failed attempt writes a `verifications` row with `+0`.

---

## 5. RLS policies (non-negotiable)

| Actor | Can read |
|---|---|
| Student | Own rows only |
| Teacher | Rows of students in classes they own — scores, pass/fail, completion counts only. **Never review body text** |
| Guardian link | Anonymous read-only, scoped to one student by token — completion, points, comprehension score, book list. **Never review body text** |

Review body text is private to the student unless the student explicitly opts to share a specific review. This applies to teachers and guardians alike.

Write every policy in the migration that creates the table. Do not defer RLS.

---

## 6. AI pipeline

Four server-side calls, all in `modules/ai`:

1. **Writing helper** — before writing, returns one guiding question.
2. **Gap analysis** — compares the review against the book's content. Returns up to 3 gaps, each with `quote`, `type`, `reason`. Types: `unsupported_claim` (근거 없이 단정), `vague_statement` (뭉뚱그린 문장), `feeling_only` (감상만 남음).
3. **Question generation** — takes one gap, quotes the student's own sentence, asks why they thought so. Interpretation/reasoning questions only. Never trivia ("what was the character's name") and never hypotheticals ("what if").
4. **Grading** — three axes: `logic_consistency`, `specificity`, `style_consistency`. Not right-or-wrong. Returns pass/fail plus short feedback in the student's voice.

Anti-cheat: the question is generated fresh on every submission, and the answer window is 30-60 seconds. On retry, generate a NEW question, never the same one.

Performance: generate the question immediately after review submission (during the gap-analysis screen), and start the countdown only after the question is on screen. Stream long responses. Keep the pass threshold in an env var so it can be tuned before the demo.

All prompt output must be strict JSON. Parse defensively — never trust the shape.

---

## 7. Design tokens (extracted from the approved mockups)

Font: `Noto Sans KR` (400/500/700/900).

| Token | Hex |
|---|---|
| bg-cream | `#FDF6EC` |
| bg-rule (notebook line) | `#F4E5D1` |
| surface-card | `#FFFDF9` |
| ink | `#2E241D` |
| panel-dark (verification) | `#2B211B` |
| panel-dark-inner | `#3A2D25` |
| accent (coral) | `#FF6B4A` |
| accent-light | `#FF8F75` |
| yellow | `#FFD866` / bg `#FDF0CD` / text `#7A6320` |
| green | `#3FA778` / bg `#E2F4E9` / text `#3F7F5C` |
| blue | `#7CBBE6` / bg `#E6EEFB` / text `#4A6B9C` |
| border | `#ECDFCD`, `#F0E4D3` |
| text-muted | `#9A8B7C`, `#A99A89` |

Radius: card 14-16px, button 14px, chip 999px, bottom sheet 26px top corners.
The notebook background is `repeating-linear-gradient(#FDF6EC 0 31px, #F4E5D1 31px 32px)` — used on login and result screens only.

The verification screens are intentionally dark. That contrast marks "you are being checked" and must not be flattened to match other screens.

---

## 8. Layout rules

Mobile first, 430px base. Breakpoint at 768px.

- Under 768px: bottom tab bar with 5 items — 홈 / 독후감 / 챌린지 / 나 / 서재. Write + AI panel becomes two sequential steps. Dictionary opens as a bottom sheet.
- 768px and up: left icon rail replaces the bottom tabs. Write + AI panel becomes a side-by-side split. Dictionary opens as a side panel.
- Teacher dashboard is desktop only (1024px+). Do not build mobile layouts for it.

Touch targets 48px minimum. Body copy 16px minimum. Reader body text 18px with `line-height: 2`.

---

## 9. UI copy

Korean, 반말, addressed to a child. Warm, short sentences. Follow the mockups' voice: "오늘도 책갈피 모으러 가볼까?", "네가 쓴 문장", "조금만 더!".

Never make a failed attempt feel like punishment — a failure says what to add, and offers a retry.
Points are always called **책갈피**, never "포인트" in UI text.

---

## 10. Conventions

- Commits: `type(scope): message` where scope is the module name — `feat(verification): add countdown timer`.
- Branches: `feat/<module>-<short>`. No direct pushes to `main`; PR only.
- Book cover art in the mockups is a placeholder gradient. Real covers come from the 알라딘 API image URL.
- Seed data is required for the demo (12 reviews, 3 books read, streak of 7, class ranking). Keep it in `supabase/seed.sql`.
- Never commit `.env`. Update `.env.example` when adding a variable.

---

## 11. Scope guard

Ship first: verification flow (gap analysis → question → grading → retry), reader + dictionary, class ranking, teacher dashboard, rewards.

Cut in this order if time runs short: 챌린지 → 독서성향 리포트 → levels/badges → 책나무·도장판 → genre-adjacent recommendation (degrade to a plain same-tag list).

Do not add features not listed in `docs/spec.md`. If something seems missing, raise it rather than building it.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
