/**
 * level — 읽기 수준 진단 ("레벨테스트"). owner: 박재경
 *
 * ⚠️ **제출(2026-09-20) 범위 밖이다.** 2026-09-18 에 요청이 들어왔지만
 * `docs/spec.md` 에 없는 기능이고(CLAUDE.md §11), 스프린트 막바지에 통합·QA 시간을
 * 뺏지 않기로 했다. 제출 뒤에 붙인다 — `docs/plan-ko.md` 의 향후 계획 항목.
 *
 * 온보딩에서 학생이 고른 학년이 맞는지 짧은 지문 하나로 가늠해 **추천 학년**을 준다.
 * 점수도 합격도 없고, 학생이 받아들일지 고른다.
 *
 * 지키는 것 (붙일 때도 그대로여야 한다):
 *   - 표를 만들지 않는다. 받아들이면 `PATCH /api/profile` 로 grade_level 한 칸이 바뀐다
 *   - 책갈피·스트릭·캐릭터를 건드리지 않는다 (§4 불변)
 *   - 기존 4 프롬프트를 건드리지 않는다. AI #7 로 따로 있다
 *   - 지문을 새로 쓰지 않는다. 서재 공개 도메인 본문에서 뽑는다
 *
 * 라우트:
 *   POST /api/level-test        → { book_id, book_title, author, passage, questions[3] }
 *   POST /api/level-test/grade  { book_id, questions, answers } → { recommended_grade, … }
 *
 * ⚠️ 서버 로직은 여기서 re-export 하지 않는다 — 이 배럴을 클라이언트 컴포넌트가 쓴다.
 *    Route Handler 는 "@/modules/level/server" 를 직접 import 한다.
 */

export { LevelTestScreen, type LevelTestScreenProps } from "./components/LevelTestScreen";
export { levelGradeSchema } from "./schema";
