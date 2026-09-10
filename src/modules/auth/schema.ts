/**
 * auth 요청 본문 검증 — docs/spec.md §5.
 *
 * 소유: 김민경 (CLAUDE.md §3).
 *
 * 라우트는 이 스키마를 통과한 값만 다룬다. 클라이언트가 보낸 것을 그대로 믿지 않는다.
 */

import { z } from "zod";

import type { GradeLevel } from "@/shared/types";

/** 1..9. DB 의 check 제약과 같은 범위다 (docs/spec.md §1) */
export const gradeLevelSchema = z
  .number()
  .int()
  .min(1)
  .max(9)
  .transform((value) => value as GradeLevel);

/**
 * 6자 대문자 영숫자. 헷갈리는 0/O/1/I 는 알파벳에서 빠져 있다
 * (0001 마이그레이션의 generate_join_code 와 같은 32자).
 * 아이가 소문자로 치거나 앞뒤 공백을 남겨도 통과시킨다.
 */
export const joinCodeSchema = z
  .string()
  .transform((value) => value.trim().toUpperCase())
  .refine((value) => /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/.test(value), {
    message: "6자리 코드가 아니야.",
  });

export const studentOnboardingSchema = z.object({
  grade_level: gradeLevelSchema,
  join_code: joinCodeSchema,
});

export const teacherOnboardingSchema = z.object({
  school_name: z.string().trim().min(1).max(40),
  /** 반의 학년. 교사 본인의 profiles.grade_level 은 null 로 둔다 */
  grade_level: z.number().int().min(1).max(9),
  class_no: z.number().int().min(1).max(30),
});

export const updateProfileSchema = z.object({
  grade_level: gradeLevelSchema,
});
