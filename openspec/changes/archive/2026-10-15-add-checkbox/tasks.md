## 0. Prerequisites

- [x] 0.1 Confirm `add-foundations`, `add-a11y-foundations` (press, modality, visually hidden, ids, invariants) and `add-button` (`core/components/shared/button-like.ts`) are merged

## 1. Hidden form input (`core/dom/hidden-input.ts`, capability `hidden-form-input`)

- [x] 1.1 `FormInputCapability` interface in `core/env` and its `domEnvironment()` implementation; recording fake for node tests
- [x] 1.2 `sync()`: property setters for `checked` / `indeterminate` / `value`, never the `checked` attribute; `input` + `change` dispatch when `dispatch` is true; jsdom tests for zag#3402 (initial indeterminate) and radix#2133 (default attribute unchanged)
- [x] 1.3 `track()`: form `reset` listener resolved from `input.form` (and the `form` prop), `resetsWithForm` option, next-frame re-sync; tests for radix#983, controlled refusal, the `form` prop, and the React 19 action-reset case (radix#3444) in browser mode
- [x] 1.4 Focus forwarding to the visible control with keyboard modality; browser-mode tests for required submission (radix#649), scrolling inside a scroll area (ark#3705, kobalte#452)
- [x] 1.5 `implicitSubmit(form)` following HTML's default-button rule; browser tests in Chromium, Firefox and WebKit comparing against a native checkbox in the same form (headlessui#2958, base-ui#4677, radix#1595); `preventDefault` opt-out
- [x] 1.6 Hidden input style (static-position absolute input variant, `pointer-events: none`) and the `uncheckedValue` companion input; browser layout tests for radix#3588 / #2402 / #4041 in `ltr` and `rtl`; form-data test for base-ui#3239

## 2. Control label (`core/components/shared/control-label.ts`, capability `control-label`)

- [x] 2.1 Label/Description props: `htmlFor` for labelable controls, Description registration and `aria-describedby` merge, state `data-*` mirroring
- [x] 2.2 Label-forwarded click rule in `dom/modality.ts` / `dom/press.ts` (pointer, not virtual; focus via `focusSafely`); jsdom and browser tests with the Label part, a consumer `<label for>` and a wrapping `<label>` (react-spectrum#10299, #3675, kobalte#39)
- [x] 2.3 Non-labelable fallback (`aria-labelledby` + Label press handlers); test with a `<div>` Control (headlessui#3876)
- [x] 2.4 Name tests: wrapping label (base-ui#4122), `aria-label` not doubled (base-ui#5786), no dangling IDREF (ark#3824)

## 3. Machine (`components/checkbox/checkbox.machine.ts`)

- [x] 3.1 Types (`CheckedState`, `CheckboxEvent`, props) and the machine per design §2: three states bound to `controllable("checked")`, `TOGGLE` with `canToggle`, `RESET` to the current `defaultChecked` prop (A.8), focus context, `pendingUserValue` with `$reverted` / `INPUT.SYNCED`
- [x] 3.2 Node tests: every transition, indeterminate → checked, read-only/disabled guards, controlled proposals and refusals (ark#2608, zag#3018), `cancel()`, reset in both modes, `syncHiddenInput` called before `onCheckedChange` (headlessui#3760)

## 4. Connect (`components/checkbox/checkbox.connect.ts`)

- [x] 4.1 Part props per design §5 using `button-like`, `control-label` and `hidden-input` helpers; `TOGGLE` from `PRESS` only; Enter handler calling `implicitSubmit`
- [x] 4.2 Data attributes per the `checkbox` spec (state on Root/Control/Indicator/Label/Description, focus mirrored on Root, `data-pressed` press-in-progress only)
- [x] 4.3 Unit tests: `aria-checked` values, `aria-required` / `aria-invalid` / `aria-readonly`, no `name` on the Control, role kept when the Control is substituted (ariakit#6336)

## 5. React parts (`packages/react/src/checkbox/`)

- [x] 5.1 `Checkbox.Root`, `Control`, `Indicator` (function children), `Label`, `Description`, internal `HiddenInput` (+ `uncheckedValue` input) rendered last; `render` on every part
- [x] 5.2 Post-commit `sync` (dispatch off); SSR + hydration test with `name` and `defaultChecked`, form submission before hydration
- [x] 5.3 React tests: StrictMode, `stopPropagation` in the Control's `onClick` (base-ui#5175), clickable row (radix#3265, zag#633), Safari focus on click (kobalte#230, browser mode)

## 6. Contract and driver

- [x] 6.1 `checkbox.contract.ts`: anatomy, locate, actions `toggle` / `check` / `uncheck` / `clickLabel` / `resetForm`, queries, states, events, trait `form-associated`, `checkboxInvariants`
- [x] 6.2 `Part.checked()` / `Part.indeterminate()` in the DOM and Playwright adapters
- [x] 6.3 `form-associated` trait in `@rind-ui/testing`: property mirror, `aria-hidden` / `tabIndex` / not focused, `change` count vs value-changing steps, ancestor `click` count vs driver clicks
- [x] 6.4 `getCheckbox` driver export; the same driver test passes in the `browser` and `jsdom` projects and through the Playwright adapter against Storybook

## 7. Model-based tests

- [x] 7.1 `testMachine(checkboxContract, …)` over the configurations in design §6 (uncontrolled, indeterminate default, read-only, focusable-disabled, controlled), all modalities including `virtual`, in `browser` and `jsdom`
- [x] 7.2 Broken variants proving the invariants fail readably: toggles on Enter, synthetic `click` from the hidden input, `change` on programmatic update, double toggle on label click, hidden input focusable

## 8. Theme

- [x] 8.1 `packages/theme/src/checkbox.css` on `data-*` only: box, glyph via `currentColor`, indeterminate dash, hit area, focus ring, duration tokens; imported from `index.css`
- [x] 8.2 Forced-colors and reduced-motion Playwright captures of the three states (react-spectrum#4029)

## 9. Stories

- [x] 9.1 Default, with Description, indeterminate, disabled, focusable-disabled, read-only, required + invalid, in a form (submit / reset buttons, form data output), controlled, wrapped in a consumer `<label>`, `render` as `<div>`, in a scrollable container
- [x] 9.2 State stories per contract state with partial ARIA snapshots; a story showing the driver in use; every story passes axe

## 10. Docs

- [x] 10.1 Generated docs page: anatomy, props, `data-*`, states, keyboard, accessibility notes (label wiring, Enter submits, `<form onChange>` caveat), contract actions/queries, driver example, "Tested with" table; `llms.txt` entry
- [x] 10.2 Docs sections for the shared `hidden-form-input` and `control-label` behaviour, linked from the Switch and Checkbox Group pages

## 11. Proof

- [x] 11.1 Manual tier-1 protocol pass (NVDA + Chrome/Firefox, JAWS + Chrome, VO + Safari macOS/iOS, TalkBack + Chrome): name, role, state, mixed, Space, Enter submits, label click — deferred to the manual protocol (docs/accessibility/manual-protocol.md, Checkbox) — needs the user on devices
- [x] 11.2 `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green

## Amendments (from add-select)

- [x] A.1 `hidden-form-input`: declared input element and list value carriers; opt-in adoption of native input (autofill) with `data-autofill`; `form-associated` trait with declared compared properties — tests for each
- [x] A.2 From add-combobox: validity proxy for `required` list-valued components (constraint input invalid exactly when the list is empty); test with a required multiple Select/Combobox
- [x] A.3 From add-slider: "Accessible Native Input" variant (input is the accessible control; exemptions + retained rules); tests with a two-thumb fixture

## Amendments (from add-label)

- [x] A.4 `control-label` adopts add-label's `label-interaction`: double-click guard (only `detail > 1`, never a single `mousedown`), no `click` cancelled, no `for` on a non-labelable Control (fallback focuses through `label-interaction` focus forwarding and still activates once), development warnings; tests for radix#2656 and headlessui#3658 on the Checkbox Label

## Amendments (from add-field, add-form)

- [x] A.5 `control-label`: Field as label and description source when the control is registered with a Field (Field Label names it; describedby = Field Description + ErrorMessage + own + consumer); development warning for an own Label inside a Field; tests
- [x] A.6 `hidden-form-input`: expose the constraint input as the `field-control` validity element; `sync()` and reset re-syncs never touch custom validity; test that a Field-set `setCustomValidity` message survives a re-sync
- [x] A.7 `field-control` binding in `Checkbox.Root`: register once (not as a group item), Field ARIA on the Control only, OR-merged `disabled` / `readOnly` / `required` / `invalid` with Field and Fieldset, change reports, `field-associated` trait, Field prop × control matrix test
- [x] A.8 Reset target decision: `RESET` restores the current `defaultChecked` prop (not the creation default); the hidden input's `defaultChecked` attribute follows the prop; changing the prop never changes the current value; replace `context.initial` with a latest-default read; tests for the "Reset restores the current default" scenario (react-spectrum#6830, radix#4155)

## Amendments (from add-date-field)

- [x] A.9 `hidden-form-input`: control-owned validity message on the validity element, one helper composing with the Field's custom validity; a re-sync never clears it and may call `setCustomValidity` to keep it; test for the "Control-owned message composes with the Field's" scenario

## Amendments (from add-date-range-field)

- [x] A.10 `hidden-form-input`: optional second typed hidden input (`endName`, same declared type, mirrored and reset like the first; first stays the validity element, second never exposed to a Field) for two-part values; the existing list carriers already cover lists but not a typed pair, so only this case is added; tests for the "Two-part value submits two names" and "Second input follows form reset" scenarios
