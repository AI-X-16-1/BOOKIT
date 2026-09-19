/**
 * reader 의 서버 전용 표면. owner: 강민구
 *
 * index.ts 와 나눠 둔 이유는 실행 환경이 다르기 때문이다.
 * 여기 있는 것들은 server-only 를 import 한다 — LibraryScreen 과 한 배럴에 묶으면
 * 클라이언트 번들에 섞이는 순간 빌드가 깨진다.
 * src/shared/supabase 가 같은 이유로 배럴을 나눠 뒀다.
 *
 * 라우트 핸들러와 서버 컴포넌트는 여기서, 화면은 "@/modules/reader" 에서 가져간다.
 */
export {
  getChapter,
  parseChapterNo,
  ChapterError,
  type ChapterErrorKind,
} from "./chapter";
export { listShelf, readMyGrade } from "./shelf";
export { recordChapterRead } from "./progress";
export {
  openCheckpoint,
  answerCheckpoint,
  type CheckpointResult,
} from "./checkpoint";
export { chapterLengths, openWordQuiz } from "./quiz";
export { readBookText, EXCERPT_MAX_CHARS } from "./text";
export { lookup, DictError, type DictErrorKind } from "./dict";
export type { DictSense, ReaderDictResponse } from "../schema";
