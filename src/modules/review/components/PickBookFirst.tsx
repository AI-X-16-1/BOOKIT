import Link from "next/link";

/**
 * /write 에 열 책이 없을 때. 쓰던 독후감도 없고 ?book= 도 없는 경우다.
 * 책 고르기는 홈(books 모듈)이 한다.
 */
export function PickBookFirst() {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center">
      <div className="text-[19px] font-bold text-ink">어떤 책을 읽었어?</div>
      <p className="mt-2 text-base text-muted">책을 고르면 여기서 독후감을 쓸 수 있어.</p>
      <Link
        href="/home"
        className="mt-6 flex min-h-12 w-full max-w-xs items-center justify-center rounded-btn bg-coral px-5 text-[17px] font-bold text-white"
      >
        책 고르러 가기
      </Link>
    </div>
  );
}
