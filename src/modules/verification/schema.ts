/**
 * verification 요청 본문 검증 — docs/spec.md §5.
 *
 * 소유: 박재경 (CLAUDE.md §3).
 */

import { z } from "zod";

/**
 * POST /api/verifications/:id/answer
 *
 * 빈 문자열을 막지 않는다. 시간이 다 돼서 화면이 자동 제출하는 경우가 있고,
 * 빈 답은 ai 모듈의 grade 가 이미 "답을 못 썼네"로 처리한다.
 * 상한은 1분 남짓 타이핑할 수 있는 양보다 넉넉하게 잡았다 — 붙여넣기 방어가 아니라
 * 프롬프트에 과도한 길이가 들어가는 걸 막는 용도다.
 */
export const answerSchema = z.object({
  answer: z.string().max(2000),
});

/**
 * POST /api/checkpoints  { book_id, chapter_no } (docs/spec.md §5b)
 *
 * 체크포인트는 그 장을 실제로 읽었을 때만 뜬다. 어느 장인지는 서버가 본문에서
 * 질문을 만드는 데 쓰므로(AI #6) 범위를 여기서 막는다 — chapter_no 는 1부터고
 * 0014 의 `chapter_no >= 1` 제약과 같은 값이다.
 */
export const createCheckpointSchema = z.object({
  book_id: z.string().uuid(),
  chapter_no: z.number().int().min(1),
});

/**
 * POST /api/checkpoints/:id/answer  { answer } (docs/spec.md §5b)
 *
 * 검증 답안(answerSchema)과 상한은 같지만 **빈 답을 막는다.** 검증은 제한 시간이
 * 있어 화면이 자동 제출하는 경우가 있어서 빈 문자열을 통과시키지만, 체크포인트는
 * 시간 제한이 없다 (spec §2b). 그래서 빈 답이 올라오는 건 실수뿐이고, 그걸 AI 에
 * 보내 "답을 못 썼네" 를 받는 것보다 화면에서 막는 쪽이 빠르고 싸다.
 *
 * 화면은 이미 빈 답이면 버튼을 잠근다 (CheckpointPanel) — 여기는 그 뒤의 방어선이다.
 */
export const checkpointAnswerSchema = z.object({
  answer: z.string().trim().min(1).max(2000),
});
