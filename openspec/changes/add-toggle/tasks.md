## 0. Prerequisites

- [ ] 0.1 Confirm `add-foundations`, `add-a11y-foundations` (press, modality, invariants) and `add-button` (`button-like-element`) are merged

## 1. Machine

- [ ] 1.1 `core/src/components/toggle/toggle.machine.ts`: states `off`/`on`, controllable `pressed` bound to states, `PRESS`/`FOCUS`/`BLUR` events, focus context
- [ ] 1.2 Node tests: uncontrolled toggle, controlled proposal + refusal (`$reverted`), `cancel()`, mode-switch warning on `pressed={undefined}` (radix#721), `reason: "PRESS"` with modality

## 2. Connect

- [ ] 2.1 `toggle.connect.ts`: root props from `button-like-element` + `aria-pressed` (accessibility-critical) + `data-state`; indicator props
- [ ] 2.2 Dev-only accessible-name stability warning; unit test with a label that changes

## 3. Parts

- [ ] 3.1 `packages/react/src/toggle/`: `Toggle.Root`, `Toggle.Indicator` (`fallback`), exports and types
- [ ] 3.2 React tests: `render` as `<span>` (role, tabIndex, `data-disabled`, base-ui#1084), consumer `onClick` runs once (radix#1525), composed with another part writing `data-state` keeps `aria-pressed` (radix#602)

## 4. Contract and driver

- [ ] 4.1 `toggle.contract.ts`: anatomy, locate, `setPressed`, `activateWithEnter`, `isPressed`, `isDisabled`, states, `PRESS` mapping
- [ ] 4.2 `getToggle` generated driver exported from `@rind-ui/testing`; type tests for unknown action / wrong argument type
- [ ] 4.3 Driver tests in `browser` and `jsdom` projects and through the Playwright adapter: every action in every modality, held Space, Enter, virtual click, `focusableWhenDisabled` (base-ui#5834)

## 5. Model-based tests

- [ ] 5.1 `testMachine(toggleContract, …)` over both edges × pointer/touch/keyboard/virtual, uncontrolled and controlled configurations, including the `virtual-parity` and `focus-does-not-commit` invariants
- [ ] 5.2 Broken variants fail with readable reports: label that changes with state, `aria-pressed` absent when off, double toggle on a bare click

## 6. Theme

- [ ] 6.1 `packages/theme/src/toggle.css` on data attributes only: non-colour on cue, forced-colors system colours, 24×24 target, shared focus ring; imported from `index.css`
- [ ] 6.2 Forced-colors and reduced-motion Playwright captures of the state stories

## 7. Stories

- [ ] 7.1 `apps/storybook` stories: default, on, disabled, focusable-when-disabled, icon-only with Indicator, controlled, driver-in-use; state stories for `off`/`on` with ARIA snapshots; all pass axe

## 8. Docs

- [ ] 8.1 Generated docs page (anatomy, props, `data-*`, keyboard, accessibility notes incl. "label must not change" and Toggle vs Switch vs Checkbox, driver example, Base UI `data-pressed` mapping) and `llms.txt` entry

## 9. Proof

- [ ] 9.1 `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green
