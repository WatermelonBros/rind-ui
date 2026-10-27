## 0. Research and spec

- [x] 0.1 Research note `docs/research/timer.md` (Zag / Ark source and trackers; platform; a11y)
- [x] 0.2 This change: proposal, design, `specs/timer/spec.md`; `openspec validate add-timer --strict`

## 1. Core

- [x] 1.1 `timer.machine.ts`: states, clock-derived value, aligned ticks, completion timeout, visibility catch-up, `onProps` config changes, normalisation
- [x] 1.2 `timer.format.ts`: rounding toward the start, units, `Intl.NumberFormat` digits, spoken duration (`Intl.DurationFormat` + fallback)
- [x] 1.3 `timer.connect.ts`, `timer.messages.ts`, `timer.meta.ts`, `timer.contract.ts`, `index.ts`; exported from `@rind-ui/core`
- [x] 1.4 Node tests: machine (virtual clock and scheduler), format, meta

## 2. Framework parts

- [x] 2.1 React
- [x] 2.2 Vue
- [x] 2.3 Svelte
- [x] 2.4 Solid
- [x] 2.5 Angular

## 3. Driver and tests

- [x] 3.1 `getTimer` in `@rind-ui/testing`
- [x] 3.2 DOM tests (jsdom and three engines) and model-based tests; per-framework DOM tests

## 4. Theme

- [x] 4.1 `packages/theme/src/timer.css`, `index.css`, `families.ts` (`decoration`), action triggers in `button.css`; browser test

## 5. Site and docs

- [x] 5.1 Site example and skin; docs page `docs/components/timer.md`; `docs/components.md` status; home updated
- [x] 5.2 Changeset

## 6. Proof

- [x] 6.1 `pnpm lint`, `pnpm typecheck`, tests of every touched package, site audit
