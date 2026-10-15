# Field — research

Status: done · Wave: 1 (shared form infrastructure: every form control — Text Field,
Checkbox, Switch, Radio Group, Select, Combobox, Slider… — is wired to its label,
description, error and validation through Field)

Cross-cutting rules come from [accessibility.md](accessibility.md) (§2 names and errors,
§7.4 "Field error messages are not live"), [assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md)
(§1.2 I: `aria-errormessage` support) and [native-platform.md](native-platform.md) (§14:
hidden native inputs, no `ElementInternals`). Label activation and the hidden input are
already decided in [checkbox.md](checkbox.md) and specified once in `add-checkbox`
(`control-label`, `hidden-form-input`); this note builds on them. Siblings:
[label.md](label.md), [fieldset.md](fieldset.md), [form.md](form.md),
[text-field.md](text-field.md).

Sources read 2026-10-14 in the local clones (Base UI `5b53c6c`, React Aria `e04377c` via
`git show HEAD:`, Reka `a3629f8`, Ark/Zag, Headless UI, Radix, Ariakit, Kobalte).

## Pattern

- WAI-ARIA APG: none for "field". The relevant rules are WCAG 2.2 **1.3.1** (label,
  description and error programmatically related), **3.3.1** Error Identification (the
  error is identified and described in text), **3.3.2** Labels or Instructions, **3.3.3**
  Error Suggestion, **4.1.2** Name, Role, Value, **4.1.3** Status Messages (an error that
  appears without a focus change is a status message).
- Roles and attributes:
  - the control's name from a `<label for>` (labelable control) or `aria-labelledby`
    (non-labelable control, group);
  - description and error text in `aria-describedby` (error **in describedby**, not only
    `aria-errormessage`: VoiceOver macOS/iOS and TalkBack do not read `aria-errormessage`
    reliably — RA#7425, ARK#4150, AT note §1.2 I);
  - `aria-invalid="true"` only while an error is *displayed* and only on roles that allow it
    (textbox, combobox, listbox, checkbox, radiogroup, group, slider, spinbutton,
    switch…; not `button` — RA#8382);
  - `required` (native) or `aria-required` (ARIA control), `disabled` / `aria-disabled`,
    `readonly` / `aria-readonly`.
- Keyboard: none of its own. Enter in a single-line input commits (validation in "blur"
  mode treats Enter like blur, Base UI `FieldControl.tsx`).

## How the others built it

| Library | Field | Validation | Error part | Notes |
|---|---|---|---|---|
| Base UI | `Field.Root/Label/Control/Description/Error/Validity/Item` | native constraints + `validate(value, formValues)` (sync/async, debounce), `validationMode` onSubmit/onBlur/onChange, `setCustomValidity` | `Field.Error` with `match` (validity key) | data-valid/invalid/touched/dirty/filled/focused |
| React Aria | `useField` + per-control hooks; RAC `<TextField>` etc. with `<Label>`, `<Text slot="description">`, `<FieldError>` | `validationBehavior: native \| aria`, `validate(value)`, realtime vs display validation | `FieldError` (render prop over `ValidationResult`) | errors in describedby (#1346) |
| Ark / Zag | `Field.Root/Label/Input/Textarea/Select/HelperText/ErrorText/RequiredIndicator/Item` | none: `invalid` prop only | `Field.ErrorText` (`aria-live="polite"`) | root `role="group"` |
| Headless UI | `Field` (context for Label/Description/disabled) | none | — (`invalid` prop) | `DisabledProvider` |
| Reka | `FieldRoot/Label/Control/Description/Error/Validity` | port of Base UI (onSubmit/onBlur/onChange) | `FieldError` | same data attributes as Base UI |
| Radix | `Form.Field/Label/Control/Message/ValidityState` (inside Form) | native constraints on `invalid`, custom `match` matchers (sync/async) | `Form.Message match` with English defaults | `serverInvalid` |
| Ariakit | `FormLabel/FormInput/FormError/FormDescription` inside a form store | store `validate`/`onValidate`, touched-gated display | `FormError` (`role="alert"`) | |
| Kobalte | `createFormControl` used by every control | `validationState` prop | `ErrorMessage` (rendered while invalid) | errors in describedby, comment cites RA#1346 |

### Base UI

- Source: `packages/react/src/field/root/{FieldRoot.tsx,useFieldValidation.ts}`,
  `field/{control,label,error,description,validity,item}/*`,
  `internals/labelable-provider/{LabelableProvider.tsx,useLabel.ts}`,
  `internals/field-register-control/useFieldControlRegistration.ts`,
  `internals/field-constants/constants.ts`.
- API: `Field.Root` props `name`, `disabled`, `invalid`, `dirty`, `touched` (each
  controllable from outside), `validate(value, formValues)` returning
  `string | string[] | null` or a promise, `validationMode`, `validationDebounceTime`,
  `actionsRef.validate()`. `Field.Control` is an `<input>`; Base UI's other controls
  (Checkbox, Select, NumberField, Slider…) read `FieldRootContext` and register with
  `useFieldControlRegistration`.
- Validation (`useFieldValidation.commit`): resolve a *representative input* (the first
  invalid registered native input, so groups work); clear the custom validity it set last;
  read `ValidityState`; **a lone `valueMissing` is ignored until the field is dirty**
  (no "required" error from tabbing through); run `validate` unless native errors exist (and
  always in onChange mode); on errors call `setCustomValidity(errors.join("\n"))` so native
  submission is blocked too; async results are dropped when a newer commit started
  (`validationCommitIdRef`). `change()` debounces only non-empty values.
- Display: `shouldValidateOnChange = mode === "onChange" || (mode === "onSubmit" &&
  submitCount > 0)` — "validate on submit, then live". `aria-invalid` only when
  `valid === false && !disabled`.
- Error part: rendered when `valid === false` or a Form error exists for the field's name;
  hidden when disabled; `match` renders it only for one validity key; multiple messages
  become a `<ul>`; the last message is kept while an exit transition runs.
- Labelling: `LabelableProvider` keeps one control id (registrations by symbol), the label
  id and the description/error ids (`setMessageIds`), and merges consumer
  `aria-describedby`. `Field.Label` `nativeLabel` (default) → `htmlFor`; otherwise
  `aria-labelledby` and a click that focuses the control with `focusVisible: true`.
- Notable: the initial value is captured **once per field**, not per control registration
  (comment in `useFieldControlRegistration.ts`: re-registering on every value change would
  make a modified field look pristine). Validity data attributes are only `valid` /
  `invalid`, with `null` meaning "not validated yet".
- Problems: BU#3777 (`invalid` back to `undefined` leaves stale attributes), BU#1844
  (validate sees a stale value), BU#1904 (custom and native errors together), BU#1425
  (required never shown when tabbing through a Select in blur mode — by design), BU#1050 and
  BU#4902 (each control wired timing itself; `validate` ran twice), BU#4120 (field ARIA leaked
  onto a popup's search input), BU#4121 (one id for every item of a group), BU#4828
  (validation ran for a change a read-only control refused).

### React Aria

- Source: `packages/react-aria/src/label/{useLabel,useField}.ts`,
  `form/useFormValidation.ts`, `packages/react-stately/src/form/useFormValidationState.ts`,
  `packages/react-aria-components/src/{FieldError,TextField,Form,Label}.tsx`.
- Model: two validation results per field. **`realtimeValidation`** (controlled `isInvalid`
  > server errors > `validate` > built-in) is always current and, in native mode, is pushed
  into `setCustomValidity` (with `title=""` so the browser shows no tooltip).
  **`displayValidation`** is what the UI shows: in `aria` mode it equals realtime; in
  `native` mode it is *committed* only on the input's `invalid` event (submit) and, once an
  error was committed, on each native `change`. The `invalid` listener calls
  `preventDefault()` (no browser bubble), focuses the field if it is the **first invalid
  element of `form.elements`**, and sets the modality to keyboard so the ring shows.
- Server errors (`FormValidationContext`, keyed by `name`) are cleared for a field on its
  next `commitValidation` (user change) and restored when the Form's errors object changes.
- `validationBehavior` default: `aria` in hooks, `native` in RAC.
- `useField`: description id and error id both in `aria-describedby`; ids are
  `useSlotId` (only rendered parts are referenced).
- Problems: RA#6983 (an error shown in native mode does not clear while the user types the
  fix), RA#8659 (controlled value changed programmatically: stale error), RA#9444 (blur
  treated as a change cleared a server error), RA#8328 (Enter-submit on the focused field:
  the new error is not announced — describedby text changes are not re-read), RA#6096
  (RadioGroup errors appear before submit while CheckboxGroup's do not), RA#6229 (two
  descriptions fight over one id → render loop), RA#7317 (hooks default to `aria`, so
  `isRequired` does not block submission).

### Ark / Zag

- Source: `ark/packages/react/src/components/field/{use-field.ts,field-textarea.tsx}`.
- Plain context: ids derived from one id, `hasErrorText`/`hasHelperText` detected with a
  `MutationObserver` + `getElementById`; the root is `role="group"`; the error text is
  `aria-live="polite"`; the required indicator is `aria-hidden`. No validation.
- Problems: ARK#4150 (switching errors to `aria-errormessage` silenced them in VoiceOver),
  ARK#3485 (DOM lookup misses shadow roots), ARK#3824 (dangling `aria-labelledby` when the
  Label is not rendered), ARK#3930 (one control forgot to read the context), ARK#3286 (parts
  carried state attributes inconsistently), ZG#2475 (two controls in one field shared one id).

### Headless UI

- Source: `components/{field,label,description,input,textarea}/*.tsx`,
  `internal/disabled.tsx`. `Field` provides an id (`IdProvider`), label and description
  registries and `DisabledProvider`; every control reads them. No validation, no error part.
- Problems: HUI#3876 / HUI#3883 (label `for` pointing at a `span`, or at a hidden input with
  no id).

### Radix (Form.Field) and Ariakit

- Radix `form/src/form.tsx`: validity per **field name** (RX#2380: two fields with the same
  name share validity), `Form.Message match` for built-in keys with English default
  messages, custom matchers (sync and async) get `(value, formData)`, validity is reset on
  every change (errors vanish while typing), `title=""` on the control.
- Ariakit `form/form-control.tsx`: `invalid = error && touched`; `FormError` is
  `role="alert"`; errors appear only after blur (AK#640); programmatic `validate()` does not
  reveal errors until touched (AK#2397).

## Accessibility

- **Name.** Labelable control → `<label for>` (native activation, translated with the page,
  2.5.3). Non-labelable control (a `div` substituted through `render`, a group) →
  `aria-labelledby` + a label press that focuses the control. This is exactly
  `control-label` (`add-checkbox`); Field reuses it with the Field's Label as the source.
  A consumer `aria-label` on the control wins and is not concatenated (BU#5786).
- **Description and error.** Both in `aria-describedby`, in that order, plus consumer ids;
  only ids of *rendered* parts (no dangling IDREF, no `aria-describedby=""` — ARK#3707).
  `aria-errormessage` is emitted **in addition** only when the consumer opts in
  (`errorMessageAttribute: "both"`), never alone: ARIA 1.3 makes it an ID list that must be
  removed when not pertinent, and VO/TalkBack support is still partial (AT note §1.2 I).
  Reading the error twice (describedby + errormessage) on NVDA is why it is off by default.
- **`aria-invalid`.** Only while an error is displayed, never on mount for an empty required
  field (WCAG 3.3.1 talks about *detected* errors), never on a disabled control, never on a
  `button` (RA#8382 — the error text in describedby carries it; the Field root's
  `data-invalid` styles it).
- **Required.** Native `required` where the control has a native element (input, hidden
  input); `aria-required` only for ARIA-only controls in `aria` validation mode. Avoid
  `aria-roledescription` on form controls (iOS VO drops "required", webkit 221065).
- **Announcements (4.1.3).** An error that appears without a focus move is a status
  message. ErrorMessage is **not** a live region (accessibility.md §7.4; rendering a region
  that already contains text is unreliable, cause D, and a `role="alert"` per field floods —
  Ariakit). Instead the Field announces through the injected `Announcer`, **once per
  distinct message**, politely, keyed per field:
  - when its error appears while focus is elsewhere (blur mode after tabbing on, an async
    result, a dependent field's rule);
  - when the focused control's error appears or changes (change mode, Enter-submit on the
    focused field — RA#8328), coalesced by the announcer's key debounce;
  - not when a failed submit moved focus to the field (the focus speaks the name and the
    describedby error) — Form announces one summary instead ([form.md](form.md));
  - never when an error clears.
- **Focus on invalid.** The first invalid control in tree order is focused with keyboard
  modality (ring visible) — RA `useFormValidation` and `hidden-form-input`.
- **Forced colors / colour.** Invalid state is never colour-only: the error text exists and
  the theme adds an icon/border change (1.4.1).
- **Native platform.** Constraint validation (`ValidityState`, `setCustomValidity`,
  `checkValidity`, the `invalid` event, `:user-invalid` — Baseline 2023) is the single
  source of validity, so a plain `<form>`, `FormData`, form libraries and `:invalid`
  agree with what Field shows. `ElementInternals` stays out (native-platform §14).

## Bug history

Collected 2026-10-14; every issue read (open and closed). Field-level entries; form-level
and fieldset entries are in [form.md](form.md) and [fieldset.md](fieldset.md).

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| Base UI | [base-ui#3777](https://github.com/mui/base-ui/issues/3777) | `invalid` back to `undefined` leaves `data-invalid`/`data-valid` stuck; `invalid={false}` only shows `data-valid` after validation | native validity overrode the prop; `undefined` fell back to stale state | open | three-state `invalid` (true/false/undefined) bound as a read-only prop; recompute on every change |
| Base UI | [base-ui#1844](https://github.com/mui/base-ui/issues/1844) | `validate` gets `null` on first blur or a stale value | read the committed state before it flushed | closed (#1850) | validate the value carried by the event |
| Base UI | [base-ui#1904](https://github.com/mui/base-ui/issues/1904) | custom error shown together with `patternMismatch`/`valueMissing` | `validate` and constraints ran independently | closed (#1926) | fixed order: native first, `validate` only when native passes; one message source at a time |
| Base UI | [base-ui#1425](https://github.com/mui/base-ui/issues/1425) | tabbing through an empty required Select in blur mode never shows "required" | deliberate: lone `valueMissing` ignored until dirty | open, by design | keep the rule (no noise while tabbing) but submit always reveals it; document |
| Base UI | [base-ui#1050](https://github.com/mui/base-ui/issues/1050) | onChange mode also validated on blur in some controls | timing wired per control | closed (#1053) | timing decided once, in the Field machine |
| Base UI | [base-ui#4902](https://github.com/mui/base-ui/issues/4902) | Checkbox/Switch/Slider call `validate` twice per interaction | validated from the state change *and* the hidden input's `change` | closed (#4911) | one event source per interaction (`CONTROL.CHANGE`), test that `validate` runs once |
| Base UI | [base-ui#1950](https://github.com/mui/base-ui/issues/1950) | in a Checkbox Group `validate` runs with `"on"` and with the array | the child checkbox validated too | closed (#1959) | inside a group only the group registers as the field control |
| Base UI | [base-ui#1845](https://github.com/mui/base-ui/issues/1845) | range errors never fire: NumberField clamps | clamping and validity share min/max | closed (#3919) | (Number Input) keep "prevent" and "report" separate |
| Base UI | [base-ui#2113](https://github.com/mui/base-ui/issues/2113) | Field.Label no longer focuses the Select trigger | trigger lost the field's control id | closed (#2118) | every control takes the registered id; a label-click test per control |
| Base UI | [base-ui#4120](https://github.com/mui/base-ui/issues/4120) | a Combobox popup search input inherits `aria-invalid`/`aria-describedby` | field props applied to every input in the subtree | closed (#4154) | wiring goes only to the *registered* control; nested inputs opt out |
| Base UI | [base-ui#4121](https://github.com/mui/base-ui/issues/4121) | every radio of a group in a Field gets the same `id` | the single control id was handed to every descendant | closed, by design (`Field.Item`) | one field = one registered control; a second registration warns in dev |
| Base UI | [base-ui#4828](https://github.com/mui/base-ui/issues/4828) | a read-only OTP field still clears Form errors on autofill | Field's change handler ran after the control ignored the change | closed (#4827) | the control reports only changes it accepted |
| React Aria | [react-spectrum#6983](https://github.com/adobe/react-spectrum/issues/6983) | in native mode a shown error does not clear while the user types the fix | display committed only on blur/submit | open | once an error is shown, revalidate on every change |
| React Aria | [react-spectrum#6096](https://github.com/adobe/react-spectrum/issues/6096) | RadioGroup errors show before submit; CheckboxGroup's don't | native `change` committed validation at selection | closed, documented | same display rule for every control type |
| React Aria | [react-spectrum#9444](https://github.com/adobe/react-spectrum/issues/9444) | NumberField blur clears `data-invalid` | commit-on-blur treated as a change | closed (#9798) | a server error clears only on a real value change |
| React Aria | [react-spectrum#8659](https://github.com/adobe/react-spectrum/issues/8659) | controlled value changed by the app: error stays, submit succeeds | validation committed only on DOM events | open (PR #10362) | a controlled value change re-validates a displayed error |
| React Aria | [react-spectrum#7034](https://github.com/adobe/react-spectrum/issues/7034) | `errorMessage` returning `''` hides server errors | `''` means "render nothing" | closed, intended | custom content: `null`/`undefined` = default text; document |
| React Aria | [react-spectrum#7425](https://github.com/adobe/react-spectrum/issues/7425) | request to use `aria-errormessage` | VO macOS does not read it reliably | open | error id always in `aria-describedby` |
| React Aria | [react-spectrum#8328](https://github.com/adobe/react-spectrum/issues/8328) | Enter-submit from the focused invalid field: new error not announced | describedby text changes are not re-read | open | announce through the Announcer when the focused field's error appears |
| React Aria | [react-spectrum#5300](https://github.com/adobe/react-spectrum/issues/5300) | help text in describedby not read by VO | WebKit 262895 | closed (OS fix) | keep the manual SR matrix for description/error |
| React Aria | [react-spectrum#8382](https://github.com/adobe/react-spectrum/issues/8382) | Select `isInvalid` sets `data-invalid` but no `aria-invalid` | `aria-invalid` not allowed on `button` | closed, by design | `aria-invalid` only on roles that support it |
| React Aria | [react-spectrum#6229](https://github.com/adobe/react-spectrum/issues/6229) | two descriptions in a group → infinite render loop | one stored id overwritten by each child | closed | description ids are a registered set |
| React Aria | [react-spectrum#9958](https://github.com/adobe/react-spectrum/issues/9958) | partially cleared required DatePicker validates inconsistently | partial value not defined as empty | open | (date fields) any missing required segment is `valueMissing` |
| Ark | [ark#4150](https://github.com/chakra-ui/ark/issues/4150) | VO stops reading errors after the move to `aria-errormessage` | ~15% of SR users lack support | closed (reverted) | same as RA#7425 |
| Ark | [ark#3485](https://github.com/chakra-ui/ark/issues/3485) | in Shadow DOM the input never references the error text | presence detected with `document.getElementById` | closed | part presence through registration, not DOM queries |
| Ark | [ark#3824](https://github.com/chakra-ui/ark/issues/3824) | Checkbox in a Field without Label → `aria-labelledby` to a missing id | ids wired unconditionally for SSR | closed, by design | reference only registered parts (expected-part rule for SSR) |
| Ark | [ark#3930](https://github.com/chakra-ui/ark/issues/3930) | PasswordInput ignores the Field's invalid/disabled/ids | that control never read the context | closed | one shared `field-control` binding; a field-prop × control matrix test |
| Ark | [ark#3286](https://github.com/chakra-ui/ark/issues/3286) | HelperText lacks `data-disabled` while Label has it | attributes applied part by part | closed (#3304) | every Field part carries the same state attributes |
| Zag | [zag#2475](https://github.com/chakra-ui/zag/issues/2475) | Input + Select in one Field crash | one id for two controls | closed, by design | detect a second control and warn: use Fieldset |
| Headless UI | [headlessui#3876](https://github.com/tailwindlabs/headlessui/issues/3876) | Chrome "label for doesn't match any id" with a Checkbox in a Field | `for` → span; the hidden input had no id | open (PR #3878) | `for` only to labelable elements (`control-label`) |
| Headless UI | [headlessui#3883](https://github.com/tailwindlabs/headlessui/issues/3883) | Radio labels get `for` pointing to a `span` | same | open (PR #3884) | same |
| Radix | [primitives#3294](https://github.com/radix-ui/primitives/issues/3294) | `<Label htmlFor>` + `id` on Select.Trigger not tied to the hidden select | id not forwarded | open | the focusable visible control owns the id; the hidden input takes part in validation |
| Radix | [primitives#2380](https://github.com/radix-ui/primitives/issues/2380) | two fields with the same `name` share `data-invalid` | validity keyed by name | open (PR #4133) | validity per Field instance; `name` only maps server errors |
| Radix | [primitives#2542](https://github.com/radix-ui/primitives/issues/2542) | custom message not rerun after paste/autofill | tied to specific events | open | validate from the `input` event and before submit |
| Ariakit | [ariakit#640](https://github.com/ariakit/ariakit/issues/640) | errors only after the first blur | display gated on touched | closed (stale) | documented trigger: touched or submit attempted, then live |
| Ariakit | [ariakit#2282](https://github.com/ariakit/ariakit/issues/2282) | custom messages lose to native `required` depending on order | errors set in effects, last writer wins | closed (#2319) | merge all sources in one synchronous step with fixed precedence |
| bits-ui | [bits-ui#1021](https://github.com/huntabyte/bits-ui/issues/1021) | required Select exposes no invalid state for styling | validity only on the hidden select | open | mirror displayed validity as `data-invalid` on every part |
| bits-ui | [bits-ui#1727](https://github.com/huntabyte/bits-ui/issues/1727) | "Blocked aria-hidden…" on submit of an empty required RadioGroup | browser focused the aria-hidden native input | closed (#1750) | already `hidden-form-input`; Field's focus goes to the visible control |
| reka-ui | [reka-ui#2013](https://github.com/unovue/reka-ui/issues/2013) | required CheckboxGroup does not block submit; no `name` → no validation | hidden inputs only with `name` | open | already `hidden-form-input` (input always rendered); group validity in the group |
| reka-ui | [reka-ui#3000](https://github.com/unovue/reka-ui/issues/3000) | DateField with seconds fails `stepMismatch` | hidden input without `step` | closed (#3003) | hidden mirrors carry every constraint attribute |

## Known pitfalls

- **Display timing** is the dominant bug class (BU#1425, AK#640, RA#6096, RA#6983,
  RA#8659). One rule, in one place: hidden until a submit attempt (or blur after a change,
  or a change — per mode); once shown, re-validated on every change; cleared as soon as the
  value is valid.
- **Server errors** must be cleared by the shared layer, only on a real accepted change, and
  client validation must still run in the same pass (BU#1745, BU#4095, RA#9444, BU#4828).
- **One field, one control.** Groups register once (the group); a second registration is a
  dev warning (BU#4121, ZG#2475, ARK#2895, BU#1950).
- **Registration, not DOM queries,** for parts (ARK#3485, ARK#3972, ARK#3824).
- **`aria-errormessage` alone is silent** for many users (ARK#4150, RA#7425).
- **Browser validation messages are in the browser's language**, not the app's; Field lets
  `messages` override per validity key.
- **`setCustomValidity` must be cleared** before re-reading native validity, or the custom
  error masks the native result (Base UI clears the message it set and restores a foreign
  one).
- **Async validation races**: drop results of stale commits (Base UI commit id).

## Testing notes

- Field has no visible behaviour of its own; it is tested through the control drivers
  (Text Field first) with Field queries composed on top: `getField(screen, { label })` →
  `isInvalid()`, `errors()`, `isTouched()`, `isDirty()`, `description()`.
- Model-based: the Field machine is driven by the control's actions (type, clear, blur) and
  by prop steps (`invalid`, `errors`, `validationMode`); invariants: `aria-invalid` ⇔
  displayed invalid ⇔ ErrorMessage rendered; `aria-describedby` lists exactly the rendered
  Description and ErrorMessage; announcements once per distinct message.
- A matrix test, Field prop × control (`disabled`, `readOnly`, `required`, `invalid`, label
  click focuses, describedby), for every control that implements `field-control`
  (ARK#3930, BU#2113).
- jsdom implements `ValidityState` and `setCustomValidity`; the `invalid` event on
  `requestSubmit()` and focus behaviour need browser mode.

## Decisions

### Parts

`Field.Root` (`div`), `Field.Label` (`label` — `control-label`'s Label bound to the
registered control), `Field.Description` (`p`), `Field.ErrorMessage` (`p`; renders only
while an error is displayed, through `presence`). No `Field.Control`: the control is any
rind form control (Text Field's Input/Textarea, Checkbox, Select…). No `role="group"` on
the root (Ark): a group with one control adds a level for AT and duplicates the name.

### Shared capabilities introduced here

- **`field-control`** — the binding every rind form control implements: register once (id,
  labelable or not, `focus()`, the native validity element, typed value), receive the
  Field's ids and `disabled/readOnly/required/invalid`, report accepted changes and
  commits. Specified once here; Text Field is its first implementation; the existing
  control changes adopt it (Requests to other changes).
- **`field-validation`** — the validation model (sources, order, timing, display, custom
  validity, async, announcements). Form adds submission-wide behaviour on top of it.

### Machine

States `idle` (nothing displayed), `validating` (async validator pending), `valid`,
`invalid`; the read-only prop binding `invalid` forces `invalid`/`valid`. Events
`CONTROL.REGISTER/UNREGISTER`, `CONTROL.CHANGE {value}`, `CONTROL.COMMIT` (Enter),
`FOCUS.ENTER`, `FOCUS.LEAVE` (logical focus left the field, layers included), `INVALID`
(the native `invalid` event: a submit or `reportValidity`), `SUBMIT.ATTEMPT` (from Form),
`VALIDATED {token, result}`, `ERRORS.SERVER {messages}` (from Form), `RESET`. Context:
`touched`, `dirty`, `filled`, `focused`, `submitAttempted`, `initialValue`, `errors`,
`validity`, `announced`.

### Defaults

- `validationMode`: `"submit"` — validate on the first submit attempt, then live on every
  change (Base UI onSubmit, RHF `reValidateMode: onChange`). Also `"blur"` (after the field
  was changed and left, then live) and `"change"`.
- `validationBehavior`: `"native"` — constraints block submission, the Field shows the
  error and cancels the browser bubble *only if an ErrorMessage part is rendered* (so an
  error is never silent). `"aria"` — never blocks submission, `aria-required` instead of
  `required` (React Aria parity).
- Precedence of sources: controlled `invalid` > server errors > native constraints >
  `validate`; `validate` runs only when native constraints pass (BU#1904).
- A lone `valueMissing` is not displayed in `blur`/`change` modes until the field is dirty;
  a submit attempt always displays it (BU#1425).

### `data-*` attributes

On Root, Label, Description, ErrorMessage, and mirrored onto the registered control's own
root: `data-disabled`, `data-readonly`, `data-required`, `data-valid` / `data-invalid`
(neither before validation), `data-validating`, `data-touched`, `data-dirty`,
`data-filled`, `data-focus`, `data-focus-visible`.

### Contract

Scope `field`; located by its Label text. Queries `isInvalid`, `isValid`, `isValidating`,
`isTouched`, `isDirty`, `isFilled`, `isRequired`, `isDisabled`, `errors`, `description`,
`label`; actions `focus` (Tab to the control) and `blur` (Tab away). Value changes go
through the control's own driver.

### Deliberately different, and why

- Errors in `aria-describedby` (not `aria-errormessage`) — Ark switched and lost users.
- ErrorMessage not live, announcements through the Announcer — Ark's `aria-live` and
  Ariakit's `role="alert"` double-speak or flood.
- Native validity as the one source of truth (`setCustomValidity` for custom and server
  errors) — Radix/Ark keep validity only in JS, so `form.checkValidity()` and the UI
  disagree.
- Validity per Field instance, `name` only for server-error mapping (RX#2380).
- The browser bubble stays when no ErrorMessage is rendered (RA always cancels it).

## Open questions

- `aria-errormessage` "both" mode: re-test VO macOS/iOS, TalkBack, NVDA yearly (quirk
  entry); default stays describedby only.
- Should `messages` ship English defaults for every validity key (Radix) or default to the
  browser's `validationMessage` (React Aria, chosen)? Browser text is in the browser's
  language; an app in another locale should pass `messages`.
</content>
</invoke>
