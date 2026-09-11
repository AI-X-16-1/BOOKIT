/**
 * 서버 전용 응답 헬퍼만 모은다.
 *
 * next/server 를 import 하므로 클라이언트 컴포넌트에서는 이 배럴을 쓰지 않는다.
 * 브라우저에서 라우트를 부를 때는 "@/shared/api/client" 를 직접 import 한다.
 */

export {
  ok,
  fail,
  unauthorized,
  invalidBody,
  serverError,
  readJson,
} from "./respond";
