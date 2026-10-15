## 0. Prerequisites

- [x] 0.1 Confirm `add-foundations`, `add-a11y-foundations`, `add-button` (`button-like-element`) and `add-checkbox` (`hidden-form-input`, `control-label`, implicit-submission helper) are merged

## 1. Machine

- [x] 1.1 `switch.machine.ts`: states `unchecked`/`checked` bound to controllable `checked`, events `TOGGLE`/`RESET`/`FOCUS`/`BLUR`, guards `canToggle` and `defaultIsChecked`
- [x] 1.2 Node tests: uncontrolled and controlled toggle, refused proposal, `RESET` in both modes with `reason: "RESET"`, disabled and read-only guards

## 2. Connect

- [x] 2.1 `switch.connect.ts`: Control via `button-like-element` with `role="switch"`, `aria-checked` true/false, `aria-readonly/required/invalid`, Space-only press rule, Enter delegated to implicit submission, accessibility-critical `type`/`role`
- [x] 2.2 Root, Thumb, Label, Description and hidden input props; `data-*` per part as in the spec

## 3. React parts

- [x] 3.1 `Switch.Root`, `Control`, `Thumb`, `Label`, `Description` in `@rind-ui/react`; Root renders the hidden input last; `render` on every part
- [x] 3.2 React tests: wrapping `<label>` name and single toggle (BU#4122), one form entry and no `name` on the Control (BU#2762), ancestor `onClick` runs once (zag#633), SSR + hydration

## 4. Contract and driver

- [x] 4.1 `switch.contract.ts`: anatomy, locate, actions `toggle`/`clickLabel`/`resetForm`, queries, states, events, trait `form-associated`
- [x] 4.2 `switchInvariants`: never `mixed`, name stable across states, Thumb hidden, single toggle per activation; broken-wrapper fixtures prove each fails
- [x] 4.3 `getSwitch` exported from `@rind-ui/testing`; driver tests passing unchanged in `browser`, `jsdom` and Playwright

## 5. Model-based tests

- [x] 5.1 `testMachine(switchContract, …)` over all transitions in pointer, keyboard, touch and virtual, with `disabled`/`readOnly` configurations
- [x] 5.2 Scenario tests not covered by the model: Enter submits in a form and does nothing outside (ark#2946), held Space toggles once, move-off cancels (bits#789), click focuses without ring (kobalte#230), initial value silent (RX#2419), reset (RX#3177), `onCheckedChange` sees updated FormData (HUI#3760), no scroll overflow in RTL (RX#4041, RX#3588), `type="submit"` warning (HUI#2935)

## 6. Theme

- [x] 6.1 `packages/theme/src/switch.css` on `data-*` and tokens only: ≥ 24×24 target, thumb position + border cue, forced-colors rules, logical-property thumb for RTL, duration tokens; imported from `index.css`
- [x] 6.2 Playwright captures under forced colors (ARK#3421) and `dir="rtl"`

## 7. Stories

- [x] 7.1 Stories: default, checked, disabled, focusable-when-disabled, read-only, in a form (with reset button), with description, RTL, driver example; state stories for `unchecked`/`checked` with ARIA snapshots; axe clean

## 8. Docs

- [x] 8.1 Docs page (generated API facts): anatomy, props, `data-*`, keyboard table (Space toggles, Enter submits), switch vs checkbox vs toggle button guidance, driver example, known AT quirks, `llms.txt` entry

## 9. Proof

- [x] 9.1 `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green

## Amendments (from add-field)

- [x] A.1 `field-control` binding in `Switch.Root`: register once (hidden input as validity element), Field ARIA on the Control only, OR-merged `disabled` / `readOnly` / `required` / `invalid` with Field and Fieldset, change reports, focus target, `field-associated` trait, Field prop × control matrix test
