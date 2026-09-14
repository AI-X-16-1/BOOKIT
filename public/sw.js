/**
 * 서비스 워커 — 설치 가능한 PWA 의 최소 조건이자 오프라인 안내용.
 *
 * 소유: 김민경 (CLAUDE.md §3 auth·PWA).
 *
 * 캐시 정책을 일부러 좁게 잡았다. 데모 중에 옛 화면이 나오는 게 제일 나쁘다.
 *   - /api, /auth  : 절대 캐시하지 않는다. 로그인 상태와 남의 데이터가 섞이면 안 된다 (CLAUDE.md §5)
 *   - 화면 이동     : 네트워크 우선, 실패하면 offline.html
 *   - 정적 자산     : 캐시 우선 (해시가 박힌 /_next/static 과 아이콘뿐)
 *
 * 캐시 이름의 버전을 올리면 옛 캐시는 activate 에서 전부 지워진다.
 */

const VERSION = "bookit-v1";
const PRECACHE = ["/offline.html", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

function isCacheableAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/")
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // 인증·데이터 경로는 손대지 않는다
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) {
    return;
  }

  if (isCacheableAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(VERSION).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match("/offline.html");
        return (
          cached ??
          new Response("오프라인", {
            status: 503,
            headers: { "content-type": "text/plain; charset=utf-8" },
          })
        );
      }),
    );
  }
});
