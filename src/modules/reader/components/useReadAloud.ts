"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { sessionText, splitWords } from "../readAlong";

/**
 * 브라우저 음성 인식으로 아이가 소리 내어 읽는 말을 듣는다. owner: 강민구
 *
 * 9/18 마감 스프린트 ③ STT 낭독 하이라이트. **판정이 아니라 형광펜이 따라가는 연출**이라
 * 인식이 틀려도 괜찮다 — 들린 말은 readAlong 의 느슨한 규칙으로 본문에 맞춘다.
 *
 * 무엇을 지키나 (기획 §3·§6 — 아동 음성 데이터):
 *   - 마이크는 **버튼을 누른 동안만** 켠다. 상시 청취 없음. 화면을 떠나면 끈다
 *   - 들린 말은 **저장하지 않는다.** 색을 바꾸는 데만 쓰고 버린다. 서버로 보내지 않는다
 *   - 다만 브라우저 음성 인식(Web Speech API)은 크롬에서 **구글 서버로 음성을 보내**
 *     글자로 바꾼다. 서비스 코드가 보내는 게 아니라 브라우저가 보내는 것이지만,
 *     아이에게 버튼 옆에 적고 처리방침에도 적는다
 *
 * 크롬·엣지·삼성 인터넷에 있다. 사파리는 설정에 따라, 파이어폭스는 없다 —
 * 없으면 "unsupported" 로 알리고 버튼 자리에 안내만 남긴다.
 */

/** lib.dom 에는 결과 타입만 있고 인식기 자체가 없어서 쓰는 만큼만 적는다 */
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { resultIndex: number; results: SpeechRecognitionResultList }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type ReadAloudState = "idle" | "listening" | "unsupported" | "denied";

/**
 * @param onHeard 새로 확정된 낱말과 아직 듣는 중인 낱말. 확정분은 커서를 옮기는 데,
 *                듣는 중인 것은 그 앞을 미리 칠하는 데 쓴다 — 확정만 기다리면
 *                한 문장이 끝날 때까지 색이 멈춰 있어서 따라가는 느낌이 안 난다.
 *                확정분은 **이번에 새로 붙은 것만** 온다 (같은 말을 두 번 세지 않게)
 */
export function useReadAloud(onHeard: (finalWords: string[], interimWords: string[]) => void) {
  const [state, setState] = useState<ReadAloudState>("idle");
  /** 방금 들은 말 몇 낱말. 화면 안내 줄에만 띄우고 어디에도 남기지 않는다 */
  const [lastHeard, setLastHeard] = useState("");
  /** 지난번까지 넘긴 확정문. 새 확정문이 이걸로 시작하면 뒷부분만 새것이다 */
  const lastFinal = useRef("");
  const recognition = useRef<Recognition | null>(null);
  /** 아이가 끄지 않았는데 인식기가 멈추면(침묵·시간 제한) 다시 켠다 */
  const wanted = useRef(false);
  const handler = useRef(onHeard);
  useEffect(() => {
    handler.current = onHeard;
  });

  const stop = useCallback(() => {
    wanted.current = false;
    recognition.current?.stop();
    recognition.current = null;
    setState((current) => (current === "listening" ? "idle" : current));
  }, []);

  const start = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor) {
      setState("unsupported");
      return;
    }

    const next = new Ctor();
    next.lang = "ko-KR";
    next.continuous = true;
    next.interimResults = true;

    next.onresult = (event) => {
      // 결과 목록 전체를 매번 다시 읽는다. resultIndex 만 믿으면 기기마다 다시 보내는
      // 방식이 달라 같은 말을 두 번 센다. 확정문이 지난번 확정문으로 **시작하면**
      // 뒷부분만 새것이고, 아니면(목록이 새로 시작했거나 최신 것만 오는 브라우저) 전부 새것이다
      const finalText = sessionText(event.results, true);
      const interimText = sessionText(event.results, false);
      let fresh: string[] = [];
      if (finalText) {
        fresh = splitWords(
          finalText.startsWith(lastFinal.current)
            ? finalText.slice(lastFinal.current.length)
            : finalText,
        );
        lastFinal.current = finalText;
      }
      const interim = splitWords(interimText);
      setLastHeard(splitWords(`${finalText} ${interimText}`).slice(-6).join(" "));
      handler.current(fresh, interim);
    };

    // 새 세션이 시작되면 결과 목록도 새로 시작한다
    next.onstart = () => {
      lastFinal.current = "";
    };

    next.onerror = (event) => {
      // 마이크를 막았거나 마이크가 없으면 다시 켜도 소용없다.
      // 침묵(no-speech)·네트워크 끊김 등은 onend 가 이어서 불리고, 거기서 다시 켠다
      if (
        event.error === "not-allowed" ||
        event.error === "service-not-allowed" ||
        event.error === "audio-capture"
      ) {
        wanted.current = false;
        setState("denied");
      }
    };

    next.onend = () => {
      if (!wanted.current) {
        setState((current) => (current === "listening" ? "idle" : current));
        return;
      }
      // 크롬은 침묵이 길거나 한 번에 듣는 시간이 차면 인식을 끝낸다. 끝난 그 자리에서
      // 바로 start 하면 아직 닫히는 중이라 던질 때가 있어서 한 박자 쉬고 다시 켠다
      // (2026-09-18 크롬 실측: end → start 가 0.1초 간격으로 이어졌다)
      window.setTimeout(() => {
        if (!wanted.current || recognition.current !== next) return;
        try {
          next.start();
        } catch {
          // 이미 켜져 있다 — 그대로 둔다
        }
      }, 250);
    };

    wanted.current = true;
    recognition.current = next;
    lastFinal.current = "";
    setLastHeard("");
    next.start();
    setState("listening");
  }, []);

  // 화면을 떠나면 마이크를 끈다
  useEffect(
    () => () => {
      wanted.current = false;
      recognition.current?.abort();
    },
    [],
  );

  return { state, start, stop, lastHeard };
}
