// src/modules/books/server/db.ts
/**
 * books 테이블 접근을 인터페이스 뒤로 감춘다.
 *
 * search.ts/recommend.ts/detail.ts가 이 인터페이스만 알게 해서, Supabase 없이도
 * (인메모리 fake로) 비즈니스 로직을 테스트할 수 있게 한다.
 *
 * 쓰기(findByIsbn 결과가 없을 때의 insertBook)는 반드시 admin(service role) 클라이언트로
 * 호출해야 한다 — supabase/migrations/0002_books.sql이 authenticated insert를 막아뒀다.
 */
import "server-only";

import type { Book } from "@/shared/types";
import type { BookitClient, Database } from "@/shared/supabase";

export type BookInsertRow = Database["public"]["Tables"]["books"]["Insert"];

export interface BooksAdminPort {
  findByIsbn(isbn13: string): Promise<Book | null>;
  insertBook(row: BookInsertRow): Promise<Book>;
}

export interface BooksReadPort {
  listByGrade(gradeLevel: number, limit: number): Promise<Book[]>;
  getById(id: string): Promise<Book | null>;
}

export function createSupabaseBooksAdminPort(
  admin: BookitClient,
): BooksAdminPort {
  return {
    async findByIsbn(isbn13) {
      const { data, error } = await admin
        .from("books")
        .select("*")
        .eq("isbn13", isbn13)
        .maybeSingle();
      if (error) throw new Error(`책 조회 실패: ${error.message}`);
      return data ?? null;
    },
    async insertBook(row) {
      const { data, error } = await admin
        .from("books")
        .insert(row)
        .select("*")
        .single();
      if (error) throw new Error(`책 저장 실패: ${error.message}`);
      return data;
    },
  };
}

export function createSupabaseBooksReadPort(
  supabase: BookitClient,
): BooksReadPort {
  return {
    async listByGrade(gradeLevel, limit) {
      const { data, error } = await supabase
        .from("books")
        .select("*")
        .or(`target_grade_min.is.null,target_grade_min.lte.${gradeLevel}`)
        .or(`target_grade_max.is.null,target_grade_max.gte.${gradeLevel}`)
        .order("title", { ascending: true })
        .limit(limit);
      if (error) throw new Error(`추천 도서 조회 실패: ${error.message}`);
      return data ?? [];
    },
    async getById(id) {
      const { data, error } = await supabase
        .from("books")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(`책 조회 실패: ${error.message}`);
      return data ?? null;
    },
  };
}
