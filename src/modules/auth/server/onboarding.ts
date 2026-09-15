/**
 * 온보딩 도메인 로직 — docs/spec.md §5 auth.
 *
 * 소유: 김민경 (CLAUDE.md §3).
 *
 * 라우트는 얇게 두고(CLAUDE.md §2) 실제 판단은 여기서 한다.
 * 쓰기는 전부 로그인한 사용자 본인 권한으로 한다 — RLS 를 우회하지 않는다.
 * 단 하나의 예외가 학생의 코드 조회다. 아래 joinClassByCode 주석 참고.
 */

import type { User } from "@supabase/supabase-js";

import type { BookitClient } from "@/shared/supabase";
import { createAdminClient } from "@/shared/supabase/admin";
import type { Class, GradeLevel, Profile } from "@/shared/types";

/**
 * 구글이 준 이름. profiles 행은 온보딩에서 처음 만들어지므로 그때 같이 넣는다.
 * 콜백에서 미리 만들 수 없다 — role 기본값이 student 라 grade_level 없이는
 * students_have_grade 제약에 걸린다 (0001).
 */
export function displayNameOf(user: User): string {
  const metadata = user.user_metadata as { full_name?: string; name?: string };
  return metadata.full_name ?? metadata.name ?? "친구";
}

export type OnboardingResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string; status: number };

const failure = (
  code: string,
  message: string,
  status: number,
): OnboardingResult<never> => ({ ok: false, code, message, status });

/**
 * 학생이 6자리 코드로 반에 들어온다.
 *
 * 코드 → class_id 변환만 service role 로 한다. 학생에게는 classes 전체 조회 권한이 없고,
 * 주려면 "코드를 모르는 남의 반"까지 열어야 한다. 0001 마이그레이션의
 * class_members_insert_self 주석에 적어 둔 그대로다.
 * 조회 결과로 하는 일은 "이 코드가 존재하는가" 뿐이고, 실제 가입은 본인 권한으로 쓴다.
 */
export async function joinClassByCode(
  supabase: BookitClient,
  user: User,
  input: { grade_level: GradeLevel; join_code: string },
): Promise<OnboardingResult<Class>> {
  const userId = user.id;
  const admin = createAdminClient();
  const { data: klass, error: lookupError } = await admin
    .from("classes")
    .select("*")
    .eq("join_code", input.join_code)
    .maybeSingle();

  if (lookupError) {
    console.error("[auth] 코드 조회 실패", lookupError);
    return failure("server_error", "잠깐 문제가 생겼어. 다시 해볼까?", 500);
  }
  if (!klass) {
    return failure(
      "invalid_join_code",
      "그런 코드는 없어. 선생님께 다시 물어볼까?",
      404,
    );
  }

  // 첫 온보딩이면 행을 만들고, 다시 온 거면 학년만 갱신한다
  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: userId,
      display_name: displayNameOf(user),
      role: "student",
      grade_level: input.grade_level,
    },
    { onConflict: "id" },
  );

  if (profileError) {
    console.error("[auth] 학생 프로필 갱신 실패", profileError);
    return failure("server_error", "잠깐 문제가 생겼어. 다시 해볼까?", 500);
  }

  // 활성 학급은 하나뿐이다 (docs/spec.md §2). 반을 옮기면 이전 반에서 빠진다
  const { error: leaveError } = await supabase
    .from("class_members")
    .delete()
    .eq("student_id", userId)
    .neq("class_id", klass.id);

  if (leaveError) {
    console.error("[auth] 이전 학급 정리 실패", leaveError);
    return failure("server_error", "잠깐 문제가 생겼어. 다시 해볼까?", 500);
  }

  // 같은 반에 두 번 들어와도 조용히 넘어간다 (뒤로 가기 후 재제출)
  const { error: joinError } = await supabase
    .from("class_members")
    .upsert(
      { class_id: klass.id, student_id: userId },
      { onConflict: "class_id,student_id", ignoreDuplicates: true },
    );

  if (joinError) {
    console.error("[auth] 학급 가입 실패", joinError);
    return failure("server_error", "잠깐 문제가 생겼어. 다시 해볼까?", 500);
  }

  return { ok: true, data: klass };
}

/**
 * 교사가 반을 만들고 6자리 코드를 받는다.
 *
 * 코드 생성은 DB 의 generate_join_code() 를 쓴다 — 중복 확인이 그 안에 있다.
 * 그래도 발급과 삽입 사이에 다른 교사가 같은 코드를 채갈 수 있어서, unique 위반이면 다시 뽑는다.
 */
export async function createClassForTeacher(
  supabase: BookitClient,
  user: User,
  input: { school_name: string; grade_level: number; class_no: number },
): Promise<OnboardingResult<{ class: Class; join_code: string }>> {
  const userId = user.id;

  // classes_insert_as_teacher 정책이 profiles.role = 'teacher' 를 요구한다.
  // 교사 본인의 grade_level 은 null 이다 — 학년은 반이 갖는다 (docs/spec.md §2)
  const { error: roleError } = await supabase.from("profiles").upsert(
    {
      id: userId,
      display_name: displayNameOf(user),
      role: "teacher",
      grade_level: null,
    },
    { onConflict: "id" },
  );

  if (roleError) {
    console.error("[auth] 교사 전환 실패", roleError);
    return failure("server_error", "잠깐 문제가 생겼어. 다시 해볼까?", 500);
  }

  // 이미 반이 있으면 새로 만들지 않는다. 온보딩을 두 번 제출해도 코드가 늘어나면 안 된다
  const { data: existing } = await supabase
    .from("classes")
    .select("*")
    .eq("teacher_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existing) {
    return { ok: true, data: { class: existing, join_code: existing.join_code } };
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data: code, error: codeError } = await supabase.rpc(
      "generate_join_code",
    );

    if (codeError || !code) {
      console.error("[auth] 코드 발급 실패", codeError);
      return failure("server_error", "잠깐 문제가 생겼어. 다시 해볼까?", 500);
    }

    const { data: created, error: insertError } = await supabase
      .from("classes")
      .insert({
        teacher_id: userId,
        school_name: input.school_name,
        grade_level: input.grade_level,
        class_no: input.class_no,
        join_code: code,
      })
      .select()
      .single();

    if (!insertError && created) {
      return { ok: true, data: { class: created, join_code: created.join_code } };
    }

    // 23505 = unique 위반. 코드가 겹친 경우에만 다시 뽑는다
    if (insertError?.code !== "23505") {
      console.error("[auth] 반 생성 실패", insertError);
      return failure("server_error", "잠깐 문제가 생겼어. 다시 해볼까?", 500);
    }
  }

  return failure("join_code_exhausted", "코드 만들기에 실패했어. 다시 해볼까?", 503);
}

/** PATCH /api/profile — 학년만 고친다 */
export async function updateGradeLevel(
  supabase: BookitClient,
  userId: string,
  gradeLevel: GradeLevel,
): Promise<OnboardingResult<Profile>> {
  const { data, error } = await supabase
    .from("profiles")
    .update({ grade_level: gradeLevel })
    .eq("id", userId)
    .select()
    .single();

  if (error || !data) {
    console.error("[auth] 학년 갱신 실패", error);
    return failure("server_error", "잠깐 문제가 생겼어. 다시 해볼까?", 500);
  }

  return { ok: true, data };
}
