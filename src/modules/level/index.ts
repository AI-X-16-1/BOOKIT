/**
 * level — 읽기 수준 진단 ("레벨테스트"). owner: 박재경
 *
 * 계약은 `docs/spec.md` §2c·§5c. 2026-09-18 에 한 번 "제출 후" 로 미뤘다가
 * 같은 날 제출 범위로 되돌렸다 — 발자국이 작아서다 (마이그레이션 0, 새 콘텐츠 0,
 * 기존 4 프롬프트 수정 0줄). 경위는 `docs/plan-ko.md` §14-2.
 *
 * 온보딩에서 학생이 고른 학년이 맞는지 짧은 지문 하나로 가늠해 **추천 학년**을 준다.
 * 점수도 합격도 없고, 학생이 받아들일지 고른다.
 *
 * 지키는 것 (붙일 때도 그대로여야 한다):
 *   - 표를 만들지 않는다. 받아들이면 `PATCH /api/profile` 로 grade_level 한 칸이 바뀐다
 *   - 권장할 뿐 덮어쓰지 않는다. 적용은 학생이 누를 때 화면이 한다
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
export { LevelTestEntry } from "./components/LevelTestEntry";
export { levelGradeSchema } from "./schema";
