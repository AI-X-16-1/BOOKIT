// src/app/api/books/[id]/route.ts
/**
 * GET /api/books/:id → { book }
 *
 * 소유: 이승환 (docs/spec.md §5).
 */
import type { NextResponse } from "next/server";

import { parseBookId } from "@/modules/books";
import {
  createSupabaseBooksReadPort,
  fail,
  getBookById,
  ok,
  unauthorized,
} from "@/modules/books/server";
import { createServerSupabase } from "@/shared/supabase/server";
import type { ApiResponse, BookDetailResponse } from "@/shared/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<ApiResponse<BookDetailResponse>>> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorized();

  try {
    const { id: rawId } = await params;
    const id = parseBookId(rawId);
    if (!id) return fail("invalid_id", "책 id 형식이 아니야.", 400);

    const port = createSupabaseBooksReadPort(supabase);
    const book = await getBookById(port, id);
    if (!book) return fail("book_not_found", "그 책을 찾을 수 없어.", 404);
    return ok({ book });
  } catch {
    return fail(
      "internal_error",
      "지금은 잘 안 되네. 조금 뒤에 다시 해볼래?",
      500,
    );
  }
}
