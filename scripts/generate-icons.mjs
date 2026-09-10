/**
 * PWA 아이콘 생성기 — `npm run icons`
 *
 * 소유: 김민경 (CLAUDE.md §3 auth·PWA).
 *
 * 디자인 원본이 아직 없어서 목업의 마크(어두운 책 표지 + 코랄 책갈피)를
 * 코드로 그린다. 색은 docs/design-tokens.md 값 그대로다.
 * 진짜 아이콘이 나오면 이 스크립트를 지우고 파일만 갈아 끼우면 된다.
 *
 * 의존성 없이 PNG 를 직접 쓴다 (node:zlib 만 사용).
 * 계단 현상을 없애려고 4배 크기로 그린 뒤 평균을 내서 줄인다.
 */

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");
const SS = 4; // supersampling

// docs/design-tokens.md
const CREAM = [0xfd, 0xf6, 0xec];
const INK = [0x2e, 0x24, 0x1d];
const CORAL = [0xff, 0x6b, 0x4a];
const YELLOW = [0xff, 0xd8, 0x66];

/* ── PNG 인코딩 ─────────────────────────────────────── */

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(size, rgb) {
  const stride = size * 3;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ── 마크 ───────────────────────────────────────────── */

/** 둥근 사각형 안인가. 좌표는 0..1 */
function inRoundedRect(x, y, [x0, y0, x1, y1], r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

/**
 * 책갈피 리본: 아래쪽이 V 로 파인 세로 막대.
 * 책잇의 포인트 이름이 책갈피라, 마크도 책갈피다 (CLAUDE.md §9).
 */
function inBookmark(x, y, [x0, y0, x1, y1]) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const notchTop = y1 - (x1 - x0) * 0.55;
  if (y < notchTop) return true;
  const mid = (x0 + x1) / 2;
  const depth = (y - notchTop) / (y1 - notchTop);
  return Math.abs(x - mid) >= ((x1 - x0) / 2) * depth;
}

/**
 * padding 은 마스커블용 여백 비율. 안드로이드는 아이콘을 원형 등으로 잘라내므로
 * 중요한 그림이 가운데 80% 안에 있어야 한다.
 */
function paint(size, { padding = 0, background = CREAM } = {}) {
  const big = size * SS;
  const buf = Buffer.alloc(big * big * 3);

  const s = 1 - padding * 2;
  const at = (v) => padding + v * s;

  const cover = [at(0.2), at(0.14), at(0.8), at(0.86)];
  const bookmark = [at(0.56), at(0.14), at(0.7), at(0.66)];
  const page = [at(0.36), at(0.3), at(0.52), at(0.36)];
  const page2 = [at(0.36), at(0.44), at(0.5), at(0.5)];

  for (let y = 0; y < big; y += 1) {
    for (let x = 0; x < big; x += 1) {
      const u = (x + 0.5) / big;
      const v = (y + 0.5) / big;

      let color = background;
      if (inRoundedRect(u, v, cover, 0.07 * s)) color = INK;
      if (inRoundedRect(u, v, page, 0.02 * s)) color = CREAM;
      if (inRoundedRect(u, v, page2, 0.02 * s)) color = YELLOW;
      if (inBookmark(u, v, bookmark)) color = CORAL;

      const i = (y * big + x) * 3;
      buf[i] = color[0];
      buf[i + 1] = color[1];
      buf[i + 2] = color[2];
    }
  }

  // 4배로 그린 것을 평균 내어 줄인다 = 안티에일리어싱
  const out = Buffer.alloc(size * size * 3);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const sum = [0, 0, 0];
      for (let dy = 0; dy < SS; dy += 1) {
        for (let dx = 0; dx < SS; dx += 1) {
          const i = ((y * SS + dy) * big + (x * SS + dx)) * 3;
          sum[0] += buf[i];
          sum[1] += buf[i + 1];
          sum[2] += buf[i + 2];
        }
      }
      const i = (y * size + x) * 3;
      const n = SS * SS;
      out[i] = Math.round(sum[0] / n);
      out[i + 1] = Math.round(sum[1] / n);
      out[i + 2] = Math.round(sum[2] / n);
    }
  }
  return out;
}

/* ── 출력 ───────────────────────────────────────────── */

mkdirSync(OUT, { recursive: true });

const files = [
  ["icon-192.png", 192, {}],
  ["icon-512.png", 512, {}],
  // 마스커블은 잘려도 마크가 남도록 여백을 크게 준다
  ["icon-maskable-512.png", 512, { padding: 0.12 }],
  // iOS 홈 화면. 투명을 지원하지 않아 배경을 그대로 깐다
  ["apple-touch-icon.png", 180, {}],
];

for (const [name, size, options] of files) {
  writeFileSync(join(OUT, name), encodePng(size, paint(size, options)));
  console.log(`${name}  ${size}x${size}`);
}
