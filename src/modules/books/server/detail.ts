import "server-only";

import type { Book } from "@/shared/types";
import type { BooksReadPort } from "./db";

export async function getBookById(
  port: BooksReadPort,
  id: string,
): Promise<Book | null> {
  return port.getById(id);
}
