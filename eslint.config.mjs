import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // 목업 런타임 — 앱 코드가 아니다 (docs/mockups/README-kids-redesign.md)
    "docs/mockups/**",
    "handoff/**",
  ]),
]);

export default eslintConfig;
