## 0. Prerequisites

- [x] 0.1 Confirm `add-a11y-foundations` and `add-theme-system` are merged and the `range` theme family request is applied or answered

## 1. Shared model

- [x] 1.1 `components/shared/range-value.ts` per `range-value` and design §2; Node tests for 0, null/undefined, custom range (BU PR#5095), empty and inverted range (RS#10042), out of range, percent vs unit formatting, no `aria-label`, no `NaN`

## 2. Machine

- [x] 2.1 `progress.machine.ts`: one state, `onProps: { value: "VALUE.CHANGE" }`, guard `reachedMax`, actions `announceCompletion`, `remember`; Node tests: 40→90→100 announces once, mount at max silent, 100→40→100 announces twice, flag off silent

## 3. Connect

- [x] 3.1 `progress.connect.ts` and `progress.messages.ts`: parts per design §4, `data-*` per spec, name check (dev error unless `aria-hidden`)
- [x] 3.2 Quirk entry `nvda-progressbar-name` in `core/dom/quirks.ts` with links, test path, removal condition

## 4. React parts

- [x] 4.1 `Progress.Root` (appends the filler span), `Label`, `ValueText`, `Track`, `Indicator`, `Circle`, `CircleTrack`, `CircleIndicator`; `render` on every part
- [x] 4.2 React tests: SSR + hydration with a provider locale (BU#4616), filler span on the server, SVG parts in React (ARK#2589)

## 5. Contract and driver

- [x] 5.1 `progress.contract.ts`: locate, queries, prop steps, announcements, trait `valued` with `values(view)`
- [x] 5.2 Use the `valued` extension shipped by `add-slider` (`model-based-testing` "Valued Trait Expectations"); broken fixture proves it fails for an `aria-valuenow` on an indeterminate bar
- [x] 5.3 `getProgress` exported; same driver test in `browser`, `jsdom` and Playwright

## 6. Model-based tests

- [x] 6.1 `testMachine(progressContract, …)` over the prop-step sequences and configurations of design §7

## 7. Theme

- [x] 7.1 `packages/theme/src/progress.css` per design §8: `@layer rind.components`, `:where()` selectors, `--rind-progress-*` tokens read with fallbacks and never declared, `range` family variants and sizes, `data-tone="danger"`, reduced-motion indeterminate, ring, forced colors; imported from `index.css`
- [x] 7.2 Playwright captures: forced colors (RS#4069), reduced motion, indeterminate bar and ring (ZG#1716)

## 8. Site examples

- [x] 8.1 Site examples (`apps/site/examples/progress.tsx`, skin `apps/site/skins/progress.css`): determinate, indeterminate, complete, custom range and units, ring determinate/indeterminate, vertical, announce completion; state example for `idle`; the driver example is on the docs page

## 9. Docs

- [x] 9.1 Docs page (generated API facts): anatomy, props, `data-*`, Progress vs Meter guidance, completion announcement, ring recipe, known AT quirks (NVDA/JAWS name), driver example, `llms.txt` entry

## 10. Proof

- [x] 10.1 `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green
