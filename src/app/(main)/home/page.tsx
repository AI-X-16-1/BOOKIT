import { HomeScreen } from "@/modules/books";
import { loadWriteSession } from "@/modules/review/server";
import { createServerSupabase } from "@/shared/supabase/server";

/**
 * 홈. 화면은 books 모듈이 그리고, 여기서는 "쓰던 독후감" 카드에 필요한 초고만 찾아 넘긴다.
 *
 * 초고가 없으면 카드를 아예 그리지 않는다 — 예전에는 늘 그려서, 쓰던 글이 없는 학생에게도
 * "쓰던 독후감"이 뜨고 누르면 /write 로 넘어갔다. loadWriteSession 은 읽기만 하고,
 * 이어서 쓸 독후감이 없으면 null 이다 (review/server/session.ts).
 */
export default async function Page() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const session = user ? await loadWriteSession(supabase, user.id) : null;

  return (
    <HomeScreen
      draft={
        session && {
          id: session.book.id,
          title: session.book.title,
          cover_url: session.book.cover_url,
        }
      }
    />
  );
}
