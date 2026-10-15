## 0. Prerequisites

- [x] 0.1 Confirm `add-foundations`, `add-a11y-foundations`, `add-collections`, `add-button` (`button-like-element`) and `add-checkbox` (`hidden-form-input`, `control-label`) are merged

## 1. Machine

- [x] 1.1 `core/src/components/radio-group/radio-group.machine.ts`: states `idle`/`focused`, collections events + `PRESS`, `FOCUS`/`BLUR`, `FORM.RESET`; controllable `value`; guards `isKeyboard`, `checksOnMove`, `notReadOnly`; no user deselect; export for Segmented Control
- [x] 1.2 Node tests: keyboard `NAVIGATE` checks, virtual/pointer/programmatic `FOCUS` never checks, pressing the checked radio is a no-op, read-only moves without checking, all four arrows with orientation `both`, wrap, disabled skipped, all disabled, reset (uncontrolled and controlled `reason: "RESET"`), `cancel()`

## 2. Connect

- [x] 2.1 `radio-group.connect.ts`: root, label, description, error-message, item, item-control, item-indicator, item-label, item-description props per spec; logical keys with orientation `both`; ignore modified/composing/descendant keys; container tab stop only when no radio is enabled; default `name` from the root id
- [x] 2.2 Dev-only warning for an unnamed group; unit tests for every ARIA and `data-*` attribute per state

## 3. Parts

- [x] 3.1 `packages/react/src/radio-group/`: all parts, static registration, hidden input rendered as the item's last child, exports and types
- [x] 3.2 React tests: no input inside the control (reka-ui#1597), exactly one `radio` per item in the AX tree (radix#1694), label click checks and focuses (kobalte#230), no scroll jump on click (zag#3239), SSR + hydration (labelled root, tab stop; base-ui#5597), `render` substitution keeps role and behaviour

## 4. Forms

- [x] 4.1 Browser and jsdom tests: native form data with nothing / one checked (base-ui#2447), reset (headlessui#2851), required blocks submit and focuses the control (bits-ui#1727), Enter implicit submission (headlessui#394), disabled fieldset (headlessui#1802), two unnamed groups in one form (ariakit#3833), RTL hidden input does not overflow (base-ui#5635)

## 5. Contract and driver

- [x] 5.1 `radio-group.contract.ts`: anatomy, locate by `radiogroup` name, `check` (pointer/touch/keyboard), queries `radios`/`checked`/`focusedRadio`/`isDisabled`/`isReadOnly`/`isRequired`/`isInvalid`/`formValue`, traits `composite-roving`, `selectable`, `directional`
- [x] 5.2 `getRadioGroup` generated driver exported from `@rind-ui/testing`; type tests
- [x] 5.3 Driver tests in the `browser` and `jsdom` projects and through the Playwright adapter: every action in every modality, RTL, read-only, required, virtual click checks once, virtual focus does not check

## 6. Model-based tests

- [x] 6.1 `testMachine(radioGroupContract, …)` over all transitions × pointer/touch/keyboard/virtual × ltr/rtl × argument classes (no value, first disabled, checked disabled, all disabled, read-only, required), with `focus-does-not-commit`, `virtual-parity`, `selectable` and one-tab-stop invariants
- [x] 6.2 Broken variants fail with readable reports: check on focus (radix#938), `orientation` restricting arrows (radix#3622), hidden input exposed (radix#1694), first radio instead of the checked one as tab stop (base-ui#1740)

## 7. Theme

- [x] 7.1 `packages/theme/src/radio-group.css` on data attributes only, reading tier-3 component tokens (`--rind-radio-group-*`, defaulting to semantic tokens; decision 0007, after `add-theme-system`): ring and dot glyphs, forced-colors mapping, 24×24 hit area, shared focus ring; imported from `index.css`
- [x] 7.2 Forced-colors Playwright captures of the state stories

## 8. Stories

- [x] 8.1 `apps/storybook` stories: default, horizontal, with descriptions, disabled item, disabled group, read-only, required + invalid with error message, in a form (submit, reset), RTL, controlled, driver-in-use; state stories with ARIA snapshots; all pass axe

## 9. Docs

- [x] 9.1 Generated docs page (anatomy, props, `data-*`, keyboard table, why focus never checks, forms, read-only/required/invalid and their AT limits, driver example, Radio Group vs Segmented Control vs Toggle Group) and `llms.txt` entry

## 10. Proof

- [x] 10.1 `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green

## Amendments (from add-toolbar)

Hosted mode (former A.1) moved to add-toolbar R.1.

## Amendments (from add-field)

- [x] A.2 `field-control` binding in the group Root: register once as one control (items keep their ids, base-ui#4121), Field ARIA on the root only, own `error-message` defers to the Field's, OR-merged flags with Field and Fieldset, change reports, focus target = checked radio else first enabled (react-spectrum#3883), `field-associated` trait, Field prop × control matrix test
