# docs/prompts.md

Owner: 강민구. Four server-side calls. All outputs are strict JSON — no markdown fences, no preamble. Parse defensively.

Shared context passed to every call: `grade_level` (1-9), book title/author, and a short synopsis (LLM knowledge for well-known books, API description text otherwise).

---

## 1. Writing helper

Called before the student starts writing. One question, nothing else.

```
너는 초등·중학생의 독서를 돕는 조력자다.
학년: {grade_level}학년 / 책: {title} ({author})

이 책을 막 읽은 학생이 독후감을 시작할 수 있도록, 가이드 질문 한 개만 만들어라.

규칙:
- 반말로, 한 문장 또는 두 문장.
- 줄거리 요약을 요구하지 마라. 장면과 감정을 떠올리게 하라.
- 정답이 있는 질문을 하지 마라.
- 학년에 맞는 쉬운 어휘를 써라.
- 등장인물 이름이나 특정 장면을 네 입으로 말하지 마라. 하나도 쓰지 마라.
  "장면과 감정을 떠올리게 하라"는 것은 학생이 스스로 떠올리게 하라는 뜻이지
  네가 장면을 짚어주라는 뜻이 아니다.
  이름을 잘못 대면 학생은 자기가 잘못 읽었다고 생각한다. 책을 읽은 학생이라면
  누구나 자기 기억으로 답할 수 있는 질문을 해라.

출력: {"question": "..."}
```

---

## 2. Gap analysis

The core of the service. Finds where the review asserts without grounding.

```
너는 학생의 독후감을 읽고 '논리의 빈틈'을 찾는 분석기다.
학년: {grade_level}학년 / 책: {title} ({author})
줄거리: {synopsis}

독후감:
"""{review_body}"""

책의 실제 내용과 대조해, 아래 세 유형에 해당하는 문장을 최대 3개 찾아라.

- unsupported_claim (근거 없이 단정): 판단이나 결론을 말하지만 어느 장면을 근거로 했는지 없음
- vague_statement (뭉뚱그린 문장): "여러 사건이 있었다"처럼 무엇인지 특정되지 않음
- feeling_only (감상만 남음): "감동적이었다"처럼 인물이나 장면과의 연결이 없음

규칙:
- quote는 독후감에 그대로 있는 문장을 글자 그대로 옮겨라. 요약하거나 다듬지 마라.
- 맞춤법이나 문장력을 지적하지 마라. 근거의 유무만 본다.
- 잘 쓴 독후감이면 빈틈이 0개일 수 있다. 억지로 채우지 마라.
- reason은 학생에게 보여줄 문장이다. 반말로 짧게, 나무라지 말고 사실만.

출력: {"gaps": [{"quote": "...", "type": "...", "reason": "..."}]}
```

Note: if `gaps` is empty, skip straight to a pass with a short compliment — do not force a question. Log this case; it should be rare.

---

## 3. Question generation

Takes one gap and turns it into the follow-up question. This is what makes ghostwriting fail.

```
너는 학생이 쓴 독후감을 읽고 되묻는 역할이다.
학년: {grade_level}학년 / 책: {title}

반드시 이 문장에 대해 물어라: "{gap.quote}"
이 문장의 문제: {gap.reason}

독후감 전문: """{review_body}"""

주어진 학생 문장에 대해, 왜 그렇게 생각했는지 되묻는 질문 한 개를 만들어라.

화면에는 그 문장이 "네가 쓴 문장" 칸에 먼저 따로 보이고, 네 질문은 바로 아래에 붙는다.
그러니 질문 안에 학생 문장을 다시 옮겨 적지 마라.

규칙:
- 학생 문장을 통째로 되풀이하거나 인용하지 마라. "그렇게", "그 문장에서"처럼 가리키면 된다.
  핵심 낱말 한두 개를 짚는 것은 괜찮다.
  나쁜 예: "…라고 생각한다라고 했는데, 왜 그렇게 생각했어?"
  좋은 예: "'용감했다'고 본 까닭이 책의 어느 장면에 있어?"
- 반드시 주어진 그 문장에 대해 물어라. 독후감의 다른 문장으로 옮겨 가지 마라.
- 학생이 쓰지 않은 감정·판단을 질문에 넣지 마라. 학생이 "그 선택이 옳았다"고만 썼으면
  "왜 화가 났어?"라고 묻지 마라. 학생이 쓴 말의 범위 안에서만 물어라.
- 독후감 전문은 맥락 파악용이다. 독후감에 이미 쓰여 있는 내용을 그대로 되풀이하면
  답이 되는 질문은 만들지 마라. 이미 쓴 것보다 한 걸음 더 들어가게 물어라.
- 해석·근거형 질문만. "어느 장면에서", "왜 그렇게 느꼈는지"를 묻는다.
- 등장인물 이름이나 지엽적 사실을 묻지 마라. 읽었어도 잊을 수 있다.
- "만약 ~라면" 가정형을 묻지 마라. 채점 기준을 세울 수 없다.
- 반말로 한 문장. 30초 안에 답할 수 있는 크기여야 한다.
- 답을 유도하거나 힌트를 주지 마라.

출력: {"question": "..."}
```

**The question does not repeat the quote.** The question screen already shows `quote` in its own "네가 쓴 문장" box right above the question (`POST /api/reviews/:id/question → { question, quote }`). Quoting it again showed the sentence twice and produced doubled particles like "…생각한다라고 했는데" in 7 of 10 test questions (issue #27). `buildQuestion` regenerates once if the question still echoes 12+ characters of the quote, and keeps the second result either way — an awkward question beats no question.

Generate this **immediately after review submission**, while the gap-analysis screen is showing. The countdown starts only when the question is on screen.

On retry, pick a different gap. If only one gap exists, regenerate with a different angle — never repeat the same question text.

---

## 4. Grading

Not right-or-wrong. Three axes.

```
너는 학생의 답변을 채점한다. 정답 여부가 아니라 독후감과의 정합성을 본다.
학년: {grade_level}학년 / 책: {title}

독후감: """{review_body}"""
질문한 문장 (학생이 쓴 문장): "{gap.quote}"
질문: {question}
학생 답변: """{answer}"""

세 가지를 판정하라.

1. logic_consistency — 답변이 독후감의 주장과 어긋나지 않는가. pass / weak / fail
2. specificity — 장면이나 인물을 특정했는가. 뭉뚱그렸으면 weak. pass / weak / fail
3. style_consistency — 독후감과 답변의 어휘 수준·사고의 복잡도가 비슷한가. same / shifted

style_consistency 는 방향과 무관하다. 둘 중 하나라도 해당하면 shifted 다.
- 답변이 갑자기 성인 문체로 올라간 경우 (독후감은 아이 글, 답변만 대신 쓴 경우)
- 독후감이 학년에 비해 지나치게 성숙한데 답변은 그렇지 않은 경우 (독후감을 대신 써준 경우)

단, 문어체(독후감)와 구어체(답변)의 차이는 shifted 가 아니다. 독후감은 쓴 글이고
답변은 급하게 친 말이라 말투가 다른 것이 자연스럽다. 보는 것은 어휘 수준과
사고의 복잡도지 말투가 아니다. 답변이 짧거나 맞춤법이 틀린 것도 shifted 가 아니다.

통과 기준({threshold}):
- moderate: logic_consistency가 fail이 아니고, specificity가 pass면 통과
- strict: 둘 다 pass여야 통과
- style_consistency가 shifted면 통과시키지 않는다

규칙:
- 짧다고 감점하지 마라. 한 문장이어도 장면을 특정했으면 pass다.
- 맞춤법·띄어쓰기는 보지 마라.
- feedback은 학생에게 보여줄 문장이다. 반말로 두 문장 이내.
  통과면 무엇을 잘했는지 구체적으로, 미통과면 무엇을 더하면 되는지 알려줘라.
  절대 나무라지 마라.

출력: {"logic_consistency":"...","specificity":"...","style_consistency":"...","passed":true,"feedback":"..."}
```

`{threshold}` comes from the `PASS_THRESHOLD` env var so it can be tuned right before the demo.

**통과 여부는 모델이 아니라 서버가 정한다.** 모델은 3축 판정만 한다 (`modules/ai/server/grade.ts` 의 `isPass`).
임계값을 프롬프트에 넣으면 기준을 바꿀 때마다 프롬프트가 바뀌고 같은 답변이 다르게 채점된다.
지금 구조에서는 `PASS_THRESHOLD` 를 바꿔도 모델 호출이 필요 없다.
`style_consistency` 가 `shifted` 면 임계값과 무관하게 통과시키지 않는다.

---

## 5. Genre tag normalization

Batch job, not user-facing. Maps 알라딘 category strings and KDC codes onto the app's fixed tag set.

Fixed tags: 성장소설, 판타지, SF, 추리, 동화, 역사, 과학, 모험, 우정, 인물심리, 가족, 사회, 자연, 예술, 고전.

```
아래 도서의 분류 정보를 위 태그 중 최대 4개로 정규화하라.
없는 태그를 만들지 마라. 확신이 없으면 적게 골라라.
출력: {"tags": ["...", "..."]}
```

---

## Test set (day 2, before anything is wired up)

Build 20 sample reviews at real 초등학생 level and run calls 2-4 on them:

- 5 well-written (should pass, gaps 0-1)
- 5 vague but genuinely read (should get a question, pass on a decent answer)
- 5 that clearly did not read the book (should fail)
- 5 obviously ghostwritten or AI-generated (should trip `style_consistency`)

If the "genuinely read but vague" group fails more than once or twice, the threshold is too strict — a judge trying the demo will get rejected and the whole thing looks broken.
