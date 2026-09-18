import { HomeScreen } from "@/modules/books";
import { loadContinueReading, loadWriteSession } from "@/modules/review/server";
import { createServerSupabase } from "@/shared/supabase/server";

/**
 * 홈. 화면은 books 모듈이 그리고, 여기서는 두 갈래 카드에 필요한 것만 찾아 넘긴다 —
 * "독후감 쓰기" 의 초고와 "책 읽기" 의 읽던 책 (docs/sprint-0918.md ①).
 *
 * 둘 다 없으면 해당 줄을 그리지 않는다. loadWriteSession 은 읽기만 하고, 이어서 쓸
 * 독후감이 없으면 null 이다 (review/server/session.ts). loadContinueReading 도 같다 —
 * 다 읽은 책은 건너뛰므로, 읽던 책이 없으면 카드가 서재 목록으로 간다.
 */
export default async function Page() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [session, reading] = user
    ? await Promise.all([
        loadWriteSession(supabase, user.id),
        loadContinueReading(supabase, user.id),
      ])
    : [null, null];

  return (
    <HomeScreen
      draft={
        session && {
          id: session.book.id,
          title: session.book.title,
          cover_url: session.book.cover_url,
        }
      }
      reading={
        reading && {
          bookId: reading.bookId,
          title: reading.title,
          readChapters: reading.readChapters,
          totalChapters: reading.totalChapters,
        }
      }
    />
  );
}
