## 0. Prerequisites

- [x] 0.1 Confirm `add-progress` (`range-value`, `valued` extension, `nvda-progressbar-name`), `add-a11y-foundations` and `add-theme-system` are merged, and the `range` theme family request is applied or answered

## 1. Machine and zones

- [x] 1.1 `meter.machine.ts` (one state; one internal `VALUE.CHANGE` from `onProps` so prop steps have an edge, see design §5) and `meter.zone.ts` per design §3; Node tests for every optimum position × value region, boundaries, clamped and missing thresholds, no thresholds

## 2. Connect

- [x] 2.1 `meter.connect.ts` and `meter.messages.ts`: parts per design §4, `role="meter"` only, value text with `zone`, name check (dev error unless `aria-hidden`), missing-value dev error

## 3. React parts

- [x] 3.1 `Meter.Root` (appends the filler span), `Label`, `ValueText`, `Track`, `Indicator`; `render` on every part; SSR + hydration test with a provider locale

## 4. Contract and driver

- [x] 4.1 `meter.contract.ts`: locate, queries, prop steps, trait `valued`
- [x] 4.2 `getMeter` exported; same driver test in `browser`, `jsdom` and Playwright

## 5. Model-based tests

- [x] 5.1 `testMachine(meterContract, …)` over the prop-step configurations of design §5; axe check per state (RS#6627)

## 6. Theme

- [x] 6.1 `packages/theme/src/meter.css` per design §6: `@layer rind.components`, `:where()` selectors, `--rind-meter-*` tokens read with fallbacks and never declared, `range` family variants and sizes, `data-tone="danger"`, zone cues beyond colour, forced colors; imported from `index.css`
- [x] 6.2 Playwright captures: each zone, forced colors

## 7. Site examples

- [x] 7.1 Site examples (`apps/site/examples/meter.tsx`, skin `apps/site/skins/meter.css`): default, units, each zone (battery and "lower is better" disk), zone in value text, vertical; state example for `idle`; the driver example is on the docs page

## 8. Docs

- [x] 8.1 Docs page (generated API facts): anatomy, props, regions and the HTML algorithm, Meter vs Progress guidance, known AT quirks, driver example, `llms.txt` entry

## 9. Proof

- [ ] 9.1 `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green
