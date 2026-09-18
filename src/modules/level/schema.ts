/**
 * level 요청 본문 검증. owner: 박재경
 *
 * 진단 결과를 서버에 쌓지 않으므로, 채점 요청이 지문 id 와 문항을 되보낸다.
 * 본문은 되받지 않는다 — book_id 로 서버가 다시 읽는다 (server/test.ts 머리말).
 */

import { z } from "zod";

/** 답 한 칸의 상한. 검증 답안(2,000)보다 짧다 — 진단은 한두 문장이면 된다 */
const ANSWER_MAX = 600;

export const levelGradeSchema = z.object({
  book_id: z.guid(),
  /** 문항 셋. 서버가 저장하지 않아 화면이 받은 것을 그대로 되보낸다 */
  questions: z.array(z.string().min(1).max(500)).length(3),
  /** 빈 답을 막지 않는다 — 건너뛴 것도 정보다 (LEVEL_JUDGE_SYSTEM 이 읽는다) */
  answers: z.array(z.string().max(ANSWER_MAX)).length(3),
});
