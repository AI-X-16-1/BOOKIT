// src/app/api/books/search/route.ts
/**
 * GET /api/books/search?q= → { books[] }
 *
 * 소유: 이승환 (docs/spec.md §5).
 * 얇게 유지한다 — 판단은 modules/books의 searchAndUpsertBooks가 한다.
 */
import type { NextRequest, NextResponse } from "next/server";

import {
  createSupabaseBooksAdminPort,
  fail,
  getBookSource,
  ok,
  parseSearchQuery,
  searchAndUpsertBooks,
  unauthorized,
} from "@/modules/books";
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

  const query = parseSearchQuery(request.nextUrl.searchParams.get("q"));
  const port = createSupabaseBooksAdminPort(createAdminClient());
  const result = await searchAndUpsertBooks(port, getBookSource(), query);
  if (!result.ok) return fail(result.code, result.message, result.status);
  return ok({ books: result.books });
}
