---
"@rind-ui/core": minor
"@rind-ui/react": minor
---

Tree-shakeable packages: an app now downloads only the components it imports and what they really use. Importing `Button` from `@rind-ui/react` used to bundle about 80% of the library (382 kB gzip); it is now 17 kB, 4.8% of the whole library.

- **Unbundled dist.** `dist/` mirrors `src/`, one file per module, so `"sideEffects": false` lets a bundler drop every module an app never reaches. Top-level factories (`setup`, `contract`, the parts factories) are marked `@__PURE__` / `@__NO_SIDE_EFFECTS__`, and the annotations survive in `dist`.
- **Subpath exports.** Each component also has its own entry, with `types` and `default`: `@rind-ui/react/button`, `@rind-ui/react/select`, …, and `@rind-ui/core/button`, `@rind-ui/core/select`, …. The package root still exports everything, and the public API is unchanged. The `./qr` and `./internal` entries now point to `dist/qr/index.mjs` and `dist/internal.mjs`.
- **`"use client"`.** Every `@rind-ui/react` module that runs hooks starts with `"use client"`, so a Next app can render the components from a Server Component without a wrapper. Pure helpers (`mergeProps`, `normalizeProps`, `renderPart`) stay unmarked and can still be called on the server.
- **Size budgets.** `scripts/size.mjs` runs after the react build. It bundles each component with esbuild (minified, React external), from the root and from its subpath, and fails when the gzip size exceeds its budget in `scripts/size-budgets.json`, or when `Button` exceeds 10% of the whole library.
