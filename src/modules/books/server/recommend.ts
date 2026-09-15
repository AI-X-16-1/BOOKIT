import "server-only";

import type { Book } from "@/shared/types";
import type { BooksReadPort } from "./db";

export interface RecommendResult {
  books: Book[];
  reasonTags: string[];
}

export async function recommendBooks(
  port: BooksReadPort,
  gradeLevel: number,
): Promise<RecommendResult> {
  const books = await port.listByGrade(gradeLevel, 10);
  const reasonTags = Array.from(
    new Set(books.flatMap((b) => b.tags)),
  ).slice(0, 5);
  return { books, reasonTags };
}
