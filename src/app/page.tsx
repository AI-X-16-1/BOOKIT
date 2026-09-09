import { redirect } from "next/navigation";

/**
 * 루트는 홈으로 넘긴다.
 * 로그인 여부에 따른 분기(비로그인 → (auth)/login)는 auth 모듈이 미들웨어에서 붙인다.
 */
export default function RootPage() {
  redirect("/home");
}
