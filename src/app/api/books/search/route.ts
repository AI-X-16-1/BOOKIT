// src/app/api/books/search/route.ts
/**
 * GET /api/books/search?q= → { books[] }
 *
 * 소유: 이승환 (docs/spec.md §5).
 * 얇게 유지한다 — 판단은 modules/books의 searchAndUpsertBooks가 한다.
 */
import type { NextRequest, NextResponse } from "next/server";

import { parseSearchQuery } from "@/modules/books";
import {
  createSupabaseBooksAdminPort,
  fail,
  getBookSource,
  ok,
  searchAndUpsertBooks,
  unauthorized,
} from "@/modules/books/server";
import { createAdminClient } from "@/shared/supabase/admin";
import { createServerSupabase } from "@/shared/supabase/server";
import type { ApiResponse, BookSearchResponse } from "@/shared/types";

export async function GET(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<BookSearchResponse>>> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorized();

  try {
    const query = parseSearchQuery(request.nextUrl.searchParams.get("q"));
    if (!query) return ok({ books: [] });

    const port = createSupabaseBooksAdminPort(createAdminClient());
    const result = await searchAndUpsertBooks(port, getBookSource(), query);
    if (!result.ok) return fail(result.code, result.message, result.status);
    return ok({ books: result.books });
  } catch {
    return fail(
      "internal_error",
      "지금은 잘 안 되네. 조금 뒤에 다시 해볼래?",
      500,
    );
  }
}
