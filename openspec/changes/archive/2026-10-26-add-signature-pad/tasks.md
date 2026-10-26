## 0. Research and spec

- [x] 0.1 Research note `docs/research/signature-pad.md`
- [x] 0.2 This change: proposal, design, `specs/signature-pad/spec.md`; `openspec validate add-signature-pad --strict`

## 1. Core

- [x] 1.1 `dom/svg-raster.ts`: an SVG string → `Image` → canvas → Blob, background, scale, decode errors
- [x] 1.2 `signature-pad.geometry.ts`: dedupe, path, dot, SVG serialiser, data URL
- [x] 1.3 `signature-pad.machine.ts`, `connect`, `messages`, `meta`, `contract`; `dom/stroke-input.ts`; export
- [x] 1.4 Node tests (machine, geometry, serialiser, meta); jsdom stroke-input mapping

## 2. Framework parts

- [x] 2.1 React
- [x] 2.2 Vue
- [x] 2.3 Svelte
- [x] 2.4 Solid
- [x] 2.5 Angular

## 3. Driver and tests

- [x] 3.1 `Part.drawPointers` in the contract Env and the DOM and Playwright adapters; `getSignaturePad`
- [x] 3.2 DOM tests (jsdom and three engines), export pixel checks, model-based tests

## 4. Theme

- [x] 4.1 `signature-pad.css`, `index.css`, `families.ts` (`field`); browser test

## 5. Site and docs

- [x] 5.1 Site example (with a typed-name alternative) and skin; docs page; `docs/components.md`; home
- [x] 5.2 Changeset

## 6. Proof

- [x] 6.1 `pnpm lint`, `pnpm typecheck`, tests of every touched package, site audit
