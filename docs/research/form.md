# Form — research

Status: done · Wave: 2 (built right after Field, because server errors, focus-first-invalid
and reset rules shape the Field API)

Read [field.md](field.md) first: the per-field validation model lives there. This note
covers what only a whole form can do: submission, server errors mapped to fields, focus on
the first invalid field, one announcement per failed submit, reset. Cross-cutting:
[accessibility.md](accessibility.md) §7, [native-platform.md](native-platform.md) §14; the
reset and implicit-submission rules of `hidden-form-input` (`add-checkbox`).

## Pattern

- No APG pattern. HTML `<form>`: implicit role `form`, a landmark only when it has an
  accessible name. Native behaviour to keep: implicit submission (Enter), the submitter
  (`SubmitEvent.submitter`, `requestSubmit(submitter)`), interactive constraint validation
  (an `invalid` event per invalid element; the browser focuses the first one whose event
  was not cancelled and shows its bubble), `reset` (restores each control's default),
  `FormData` from successful controls, `novalidate` / `formnovalidate`.
- WCAG: 3.3.1 / 3.3.3 (errors identified and described), 3.3.4 Error Prevention (legal /
  financial: review step — out of scope), 4.1.3 (submission status), 2.4.3 (focus moves to
  the first error).

## How the others built it

### Base UI (`packages/react/src/form/Form.tsx`)

- `<Form>` renders `<form noValidate>`. Props `validationMode` (default `onSubmit`, passed
  to Fields), `errors` (server errors keyed by field `name`), `onFormSubmit(values,
  details)` (calls `preventDefault`, values from the registered fields' typed values),
  `actionsRef.validate(name?)`.
- Submit: `submitCount++`, validate every registered field, `focusFirstInvalid()` (first
  invalid control **by DOM position**, `compareDocumentPosition`; `select()` for inputs);
  if any is invalid → `preventDefault`. After a valid submit, when the `errors` prop
  changes (server answer) it focuses the first field with an error.
- `clearErrors(name)` is called by a field's change → the server error of that field
  disappears on its next change.

### React Aria (`react-aria-components/src/Form.tsx`, `useFormValidation.ts`)

- `<Form validationBehavior="native" | "aria" validationErrors>`: `noValidate` only in
  `aria` mode; in `native` mode each field's `invalid` listener cancels the bubble and
  focuses itself if it is the first invalid element of `form.elements`.
- `useFormValidation` **patches `form.reset`** to detect a reset React requests after a
  form action (no `window.event`, or a `MessagePort` message — React's scheduler) and does
  not reset validation for it, so the errors the action just returned survive
  (RA#6830, RA#7708). Nested forms do not inherit context (RA#10740).

### Radix (`form/src/form.tsx`)

- `Form.Root` `onInvalid` (capturing all controls' `invalid`) focuses the first invalid
  control and cancels the browser UI; `onSubmit` and `onReset` call `onClearServerErrors`;
  a Field's `serverInvalid` focuses the first server-invalid control. `Form.Submit`.
  Validity per field name.

### Ariakit (`form/form.tsx`, `form-store.ts`)

- A store with `values`, `errors`, `touched`, `submitSucceed/submitFailed`;
  `validateOnChange`/`validateOnBlur` default true; `resetOnSubmit` default true;
  `autoFocusOnSubmit` focuses the first invalid item (AK#6305: by mount order until fixed;
  AK#6307: the flag leaked and stole focus later). `FormSubmit`, `FormReset`, `FormPush`/
  `FormRemove` for arrays.

### Reka (`Form/FormRoot.vue`)

- Port of Base UI: `errors`, `validationMode`, `formSubmit` event, focus first invalid,
  `awaitingServerErrors` then focus on server errors, `reset` → each field `resetField()`.

## Accessibility

- **Focus on failure**: one move, to the first invalid control in tree order, with
  keyboard modality (`focusSafely`), so the ring shows and the SR reads the name and the
  describedby error. A radio group is one stop: its checked or first enabled radio
  (RA#3883). Text inputs are not `select()`ed (Base UI/Ariakit do it): selecting
  replaces the text on the next keystroke, which surprises users fixing a typo.
- **One announcement per failed submit** through the Announcer, polite (focus speech comes
  first; assertive would interrupt it): "2 fields have errors" (`messages.invalidSummary`),
  only when more than one field is invalid — with one, the focused field says it all.
  Server errors arriving after a submit: the same focus move and summary.
- **Submission status** (pending/succeeded) is the consumer's (a button's `pending`,
  `add-button`), not the Form's.
- **Nested forms** are invalid HTML; a portalled dialog's form must not inherit the outer
  form's context (RA#10740).

## Bug history

All issues read, open and closed.

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| Base UI | [base-ui#2228](https://github.com/mui/base-ui/issues/2228) | submit after a Field was removed throws on `focus` | unmounted fields never de-registered | closed (#2231) | register/unregister with mount; null-check |
| Base UI | [base-ui#5284](https://github.com/mui/base-ui/issues/5284) | focus lands on a later invalid field | registry Map in insertion order; re-registration moves to the end | closed (#5287) | first invalid by tree order, never registration order |
| Ariakit | [ariakit#6305](https://github.com/ariakit/ariakit/issues/6305) | a field mounted above another is skipped by autofocus | mount order ≠ document order | closed (#6453) | same |
| Ariakit | [ariakit#6307](https://github.com/ariakit/ariakit/issues/6307) | later item changes steal focus into an invalid field | flag armed at submit never cleared on success | closed (#6446) | focus-first-invalid is a one-shot per submit attempt |
| Base UI | [base-ui#5200](https://github.com/mui/base-ui/issues/5200) | invalid submit focuses the first checked checkbox, not the failing one | group registered one focus target | closed (#5216) | the control's `focus()` picks its invalid item |
| Base UI | [base-ui#4952](https://github.com/mui/base-ui/issues/4952) | one checked box makes a group of required boxes valid | one shared input ref | closed (#4958) | group validity aggregated by the group control |
| Base UI | [base-ui#1745](https://github.com/mui/base-ui/issues/1745) | server errors on Select/RadioGroup not cleared on change | only `Field.Control` cleared them | closed (#1755) | clearing lives in Field, for every control |
| Base UI | [base-ui#4095](https://github.com/mui/base-ui/issues/4095) | first change after a server error skips `validate` | early return after dropping the error | closed (#4112) | drop the server error, then still validate |
| Base UI | [base-ui#2142](https://github.com/mui/base-ui/issues/2142) | no validate-on-submit mode | feature gap | closed (#3013) | `"submit"` mode, live after the first attempt — our default |
| React Aria | [react-spectrum#6830](https://github.com/adobe/react-spectrum/issues/6830) | React 19 action reset restores mount-time defaults and wipes returned errors | default captured at mount; reset after the errors render | closed (#8444) | read the current default at reset; keep errors delivered by the same action |
| React Aria | [react-spectrum#7708](https://github.com/adobe/react-spectrum/issues/7708) | `useActionState` errors never show in FieldError | same ordering | closed (dup) | test server errors with `useActionState` |
| React Aria | [react-spectrum#7602](https://github.com/adobe/react-spectrum/issues/7602) | fields reset although `reset` was `preventDefault()`ed | listener ignored `defaultPrevented` | closed (#7603) | honour `defaultPrevented` (as `hidden-form-input` does) |
| React Aria | [react-spectrum#6555](https://github.com/adobe/react-spectrum/issues/6555) | controlled TextField resets and fires `onChange` | internal reset of a controlled value | closed (→ #6830) | controlled fields propose the default with reason `RESET` (parent decides) |
| React Aria | [react-spectrum#7749](https://github.com/adobe/react-spectrum/issues/7749) | reset unchecks only one checkbox per reset in a group | N children wrote from a stale snapshot | closed (#8316; regressed #10643) | groups reset once (`add-checkbox-group`) |
| React Aria | [react-spectrum#10740](https://github.com/adobe/react-spectrum/issues/10740) | a form in a portalled modal inherits the outer form's props | Form both provides and consumes context | closed (#10746) | a Form resets the form context for its subtree |
| Ariakit | [ariakit#2397](https://github.com/ariakit/ariakit/issues/2397) | `validate()` sets errors that never show until submit | display gated on touched | closed, by design | programmatic `validate()` counts as a submit attempt for display |
| Ariakit | [ariakit#3607](https://github.com/ariakit/ariakit/issues/3607) | nested-path server error lands on the top-level key | path resolution | closed (#5685) | server errors map by the exact `name` string (`items.0.name`) |
| Radix | [primitives#2566](https://github.com/radix-ui/primitives/issues/2566) | a cross-field matcher does not rerun when the other field changes; invalid form submits | matchers run on own events only | closed | every validator runs again on submit; `validate` receives all values |
| Radix | [primitives#4155](https://github.com/radix-ui/primitives/issues/4155) | uncontrolled RadioGroup resets to its mount-time value | reset value captured once | open | same as RA#6830 |
| Ark | [ark#4180](https://github.com/chakra-ui/ark/issues/4180) | Vue Field inputs wipe native initial values; FormData empty | component overwrote the DOM value | closed (#4197) | uncontrolled controls keep the native default |
| Ark | [ark#4117](https://github.com/chakra-ui/ark/issues/4117) | `form.reset()` clears inputs instead of restoring | default became an attribute in Vue | closed | test `reset()` against native inputs side by side |
| Kobalte | [kobalte#473](https://github.com/kobaltedev/kobalte/issues/473) | required Checkbox/Select block submit but the error never shows | error UI not tied to the native `invalid` event | open | Field listens to `invalid` (works with a plain `<form>`) |
| Kobalte | [kobalte#164](https://github.com/kobaltedev/kobalte/issues/164) | Select does not reset with its form | no reset listener | closed | every control listens to its form's `reset` (`hidden-form-input`) |
| bits-ui | [bits-ui#1942](https://github.com/huntabyte/bits-ui/issues/1942) | after a SvelteKit enhance reset the RadioGroup hidden input stays empty | not re-synced after reset | open | already `hidden-form-input` (next-frame re-sync) |

## Known pitfalls

- React 19 `<form action>` calls `form.reset()` after the action; errors returned by the
  action render first and are wiped by the reset (RA#6830/#7708). Reset must not clear
  errors that arrived since the submit.
- The current `defaultValue` at reset time, not the mount-time one (RA#6830, RX#4155) —
  this conflicts with `hidden-form-input`'s "default captured at creation"; see
  Requests to other changes in `add-form`.
- Async validators pending at submit: Base UI submits anyway; the result arrives after the
  request is gone.
- `select()` on focus-first-invalid replaces the user's text on the next key.

## Testing notes

- Browser mode for `requestSubmit`, the `invalid` sequence and focus; jsdom can run reset,
  `FormData` and server-error mapping.
- Contract: `submit` (click the submit button by name; keyboard: Enter on it),
  `reset`, queries `invalidFields` (names in tree order), `focusedField`, `submitCount`,
  and the announcements the driver recorded.
- React 19 `useActionState` story with server errors and the automatic reset.

## Decisions

- **Parts**: `Form.Root` (`form`). Submit and reset buttons are `Button`s
  (`type="submit"`/`"reset"`); no `Form.Submit` part (it would be a Button with one prop).
- **Props**: `validationMode` and `validationBehavior` (defaults for its Fields),
  `errors: Record<string, string | string[]>` (server errors by field `name`, read-only
  prop binding), `onFormSubmit(values, details)` (opt-in; calls `preventDefault`), native
  `onSubmit`/`action` untouched.
- **Machine**: `idle` | `validating` (async validators pending after a submit attempt: the
  submission is held and re-requested with the same submitter when they all pass) |
  `awaiting-server` (a valid submit happened; the next `errors` change focuses its first
  field). Events `SUBMIT.ATTEMPT {submitter}`, `FIELD.REGISTER/UNREGISTER`,
  `VALIDATION.SETTLED`, `$sync:errors`, `RESET {userInitiated}`.
- **Focus**: first invalid field by tree order, once per attempt, keyboard modality, no
  `select()`.
- **Announcement**: one polite summary per failed attempt when ≥ 2 fields are invalid.
- **Reset**: a user reset (reset button, `form.reset()` from a user-activated task) clears
  every Field's touched/dirty/submitted/server-error state; a reset React requests after an
  action (no user activation) keeps errors delivered by that action — React Aria's
  heuristic, isolated in the React adapter.
- **Nested Form** resets the form context for its subtree (RA#10740).
- **Contract**: scope `form`, located by role `form` and name, or by `data-scope` when
  unnamed.
- **Different from others**: no `select()`; summary announcement instead of per-field
  alerts; async validation holds the submission (Base UI does not).

## Open questions

- A form-level `validate(values)` for cross-field rules (Ariakit/RHF resolver) — today a
  Field's `validate` receives all values; revisit when a schema integration is requested.
</content>
</invoke>
