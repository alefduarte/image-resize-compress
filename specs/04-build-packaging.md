# Spec 04 — Build, Packaging, Bundle Size

## Problems

1. `exports` map lacks a `types` condition; `require` consumers resolve ESM-flavored `.d.ts` (attw "masquerading as CJS"). `"./types": "./dist/index.d.ts"` is a nonstandard subpath.
2. README's VanillaJS/CDN example references a global `imageResizeCompress` that never exists — `dist/index.js` is ESM and there is no IIFE build.
3. `splitting: true` in tsup is pointless for a single entry; no sourcemaps shipped; `target: esnext` risks syntax newer than stated browser support.
4. No size enforcement — regressions land silently.

## package.json

```jsonc
{
  "name": "image-resize-compress",
  "type": "module",
  "sideEffects": false,
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "unpkg": "./dist/index.global.js",
  "jsdelivr": "./dist/index.global.js",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts", // tsup emits index.d.cts alongside for cjs
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
    },
    "./package.json": "./package.json",
  },
  "files": ["dist"],
  "engines": { "node": ">=18" }, // tooling floor; browser lib, document that
  "packageManager": "pnpm@<pin current>",
}
```

- Remove `"./types"` subpath (breaking, announce in changelog; correct consumers never needed it).
- Keep `README.md`/`LICENSE` implicit (npm always includes them); `files: ["dist"]` is enough.
- Decide lockfile: repo currently has BOTH `pnpm-lock.yaml` and `yarn.lock`. Keep pnpm, delete `yarn.lock`, add `preinstall: npx only-allow pnpm`? — only-allow adds friction for casual contributors; instead just delete `yarn.lock` and state pnpm in CONTRIBUTING (spec 07).

## tsup config

```ts
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs', 'iife'],
  globalName: 'imageResizeCompress', // matches README examples
  dts: true,
  sourcemap: true,
  clean: true,
  minify: true,
  splitting: false,
  target: 'es2020',
});
```

- IIFE output `dist/index.global.js` restores the documented CDN usage:
  `<script src="https://cdn.jsdelivr.net/npm/image-resize-compress@3/dist/index.global.js">` → `imageResizeCompress.fromBlob(...)`.
- `target: es2020` — matches tsconfig, safe for every browser that has `createImageBitmap`.

## Size budget (enforced)

- Dev-dep `size-limit` + `@size-limit/preset-small-lib`:

```jsonc
"size-limit": [
  { "path": "dist/index.js", "limit": "2 kB" },          // esm min+gzip
  { "path": "dist/index.global.js", "limit": "2.5 kB" }
]
```

- `pnpm size` script; CI gate in spec 05. Budget rationale: v2 is ~1.3 kB; specs 01–02 add features but also delete FileReader/relabel code. If an implementation lands over budget, shrink the code, don't raise the limit without maintainer sign-off.
- Spec 08 (worker) raises limits to 3 kB / 3.5 kB when it lands — that bump is pre-approved there, nothing else is.

## Package correctness gates

- `publint` (catches exports-map mistakes) and `@arethetypeswrong/cli` (`attw --pack`, catches types resolution issues) as dev deps, run in CI, both must pass clean.
- `prepublishOnly: "pnpm build"` safety net even though release is CI-driven.

## Type exports

- `index.ts`: `export type { ImageFormat, Size, ResizeOptions, FromURLOptions } from './types'` (explicit `export type`), value exports for the four functions + error classes.

## Acceptance criteria

- [ ] `attw --pack` reports zero problems (no "masquerading as CJS", types resolve for node16/bundler/cjs/esm).
- [ ] `publint` passes with no warnings.
- [ ] `dist/index.global.js` exists; opening a plain HTML file with it defines `window.imageResizeCompress.fromBlob`.
- [ ] `require('image-resize-compress')` works in a Node CJS smoke script (functions exist; calling throws `EnvironmentError`).
- [ ] `pnpm size` passes both limits; sourcemaps emitted for all formats.
- [ ] `yarn.lock` deleted; single lockfile (pnpm).
- [ ] `npm pack --dry-run` tarball contains only `dist/`, `README.md`, `LICENSE`, `package.json`.
