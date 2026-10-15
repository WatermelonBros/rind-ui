## 0. Prerequisites

- [x] 0.1 Confirm `add-foundations`, `add-a11y-foundations`, `add-checkbox` (`control-label`, `hidden-form-input`), `add-label`, `add-fieldset` and `add-overlay-infrastructure` (`presence`, `layer-stack`) are merged — add-checkbox (control-label, hidden-form-input) is not applied yet: Field names its control through its own Label (for / aria-labelledby + label-interaction)

## 1. Constraint validity (`core/dom/constraint-validity.ts`)

- [x] 1.1 `readValidity`, `setOwnCustomValidity` / `clearOwnCustomValidity` (restore a foreign message), `firstInvalidInTreeOrder(form)` over `form.elements`; jsdom tests incl. hidden inputs and radio sets

## 2. Machine (`components/field/field.machine.ts`)

- [x] 2.1 Types (`FieldEvent`, `RegisteredControl`, `ValidationResult`, props) and the machine per design §2: display states, `bindProp` on `invalid`, context flags, sources in order, the display gate, pristine `valueMissing` rule
- [x] 2.2 Async validation: `validating` state, token, `VALIDATED`, stale drop, debounce as a delayed transition; fake-timer node tests
- [x] 2.3 Announce action (once per distinct message, skip on focus move / composing); node tests with a recording announcer
- [x] 2.4 Node tests for every scenario in `field-validation` that needs no DOM (base-ui#1904, #1844, #3777, #1425, #2142, #1745, #4095, react-spectrum#9444, #6983, #8659)

## 3. Binding (`components/shared/field-control.ts`)

- [x] 3.1 `FieldControlBinding`, `mergeFieldProps` (OR booleans, describedby order, `name` fallback, `aria-errormessage` only in `"both"`), second-registration warning
- [x] 3.2 Unit tests: dangling ids never emitted (ark#3824, react-spectrum#2330), error never in labelledby (kobalte#534), `aria-invalid` skipped on `button` (react-spectrum#8382)

## 4. Connect (`components/field/field.connect.ts`)

- [x] 4.1 Root/Label/Description/ErrorMessage props per design §4; Label through `control-label` + `label-interaction`; ErrorMessage content, list rendering, `match`
- [x] 4.2 Focus listeners (`FOCUS.ENTER`/`FOCUS.LEAVE` with the layer rule), `invalid` listener (cancel iff an ErrorMessage is rendered; first-in-tree-order focus with keyboard modality), form `reset` (respect `defaultPrevented`)
- [x] 4.3 `field.messages.ts` (`errorAnnouncement`, validity-key overrides)

## 5. React parts (`packages/react/src/field/`)

- [x] 5.1 `Field.Root` (service + `FieldControlContext`), `Label`, `Description`, `ErrorMessage` (presence); `render` on every part
- [x] 5.2 SSR + hydration test with Label, Description and an initial `invalid`; StrictMode registration test (register once) — the name is in the server HTML (Label `for` = the Field's control id); Description/ErrorMessage relations are added after commit, never to a missing id (ark#3707, as Fieldset)

## 6. Contract and driver

- [x] 6.1 `field.contract.ts`: anatomy, locate by Label text, actions `focus` / `blur`, queries, states, events and prop steps per spec, `fieldInvariants`
- [x] 6.2 `field-associated` trait in `@rind-ui/testing`
- [x] 6.3 `getField` driver with `.control(getX)` composition; same test in `browser`, `jsdom` and Playwright — `.control(getX)` locates the control driver by the name the Field gives it

## 7. Model-based tests

- [x] 7.1 `testMachine(fieldContract, …)` with a Text Field inside, configurations per design §5 (three modes, two behaviours, async with fake timers, `invalid` prop steps), all modalities — partial: driven through the fixture control (fixtures/field/field-input.tsx) until Text Field (add-text-field) lands; `$props:disabled` is skipped in the model (a disabled Field cannot be focused), covered by the browser tests
- [x] 7.2 Broken variants proving invariants fail readably: announces on every key, `aria-invalid` on mount, error in `aria-errormessage` only, validates twice per change

## 8. Browser tests

- [x] 8.1 Plain `<form>`: focus first invalid in tree order (base-ui#5284), bubble kept without ErrorMessage, suppressed with it, `checkValidity` agrees (kobalte#473), `aria` behaviour does not block (react-spectrum#7317), paste/autofill revalidate (radix#2542) — with the fixture control
- [x] 8.2 Touched with a Select popup (keyboard and pointer), reset (react-spectrum#7602, base-ui#5765) — partial: reset covered; the Select-popup touched rule is it.todo for add-select
- [x] 8.3 Field prop × control matrix for Text Field now; other controls are added by their changes — partial: the matrix runs with the fixture control; each control adds its row in its own change

## 9. Theme

- [x] 9.1 `packages/theme/src/field.css`: `@layer rind.components`, `:where()` selectors, `--rind-field-*` tokens read with fallbacks (never declared), no variant family, ErrorMessage icon in `currentColor`, a `data-tone="danger"` capture, forced-colors capture; imported from `index.css`

## 10. Stories

- [x] 10.1 Stories: Text Field with Description and ErrorMessage, each validation mode, `aria` behaviour, async validate (username taken), `match` messages, disabled / read-only / required, inside a disabled Fieldset, with a Checkbox and a Select (once their field-control lands), no ErrorMessage (native bubble); state stories per state with ARIA snapshots; every story passes axe — partial: Checkbox and Select stories come with their field-control changes

## 11. Docs

- [x] 11.1 Generated docs page: anatomy, props, `data-*`, states, validation model (sources, modes, behaviour, async), accessibility (describedby, announcements), "one control per Field; use Fieldset for groups", driver composition example; `llms.txt` entry
- [x] 11.2 Docs section "Implementing field-control" for control authors

## 12. Proof

- [x] 12.1 Manual tier-1 protocol: error read on focus after a failed submit (NVDA, JAWS, VO macOS/iOS, TalkBack), blur-mode announcement spoken once, no double reading — deferred to the manual protocol (docs/accessibility/manual-protocol.md, "Device checklist: Field"); needs the user on devices
- [x] 12.2 `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green

## Amendments (from add-date-field)

- [x] A.1 `field-validation`: a control-owned validity message counts as native validity (source 3) in the source order; test for the "Control-owned message counts as native" scenario
