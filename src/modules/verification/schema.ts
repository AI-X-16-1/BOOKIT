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
