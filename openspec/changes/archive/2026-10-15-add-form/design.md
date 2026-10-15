## Context

[form.md](../../../docs/research/form.md) has the comparison and the bug history. Field
(`add-field`) already does per-field validation, display, `setCustomValidity`, focus on the
first invalid control in a plain form (through the native `invalid` sequence) and
announcements. It also accepts external errors and `SUBMIT.ATTEMPT`. `hidden-form-input`
handles control resets and implicit submission.

## Goals / Non-Goals

**Goals:**
- Form adds only what needs the whole form. Field behaviour is unchanged by the presence of
  a Form, except for defaults and external errors.

**Non-Goals:**
- A values store. Values are read from Fields at submit time.

## Decisions

### 1. Layout

```
packages/core/src/components/form/{form.machine.ts, form.connect.ts, form.contract.ts, form.messages.ts}
packages/react/src/form/form.tsx       Root, FormContext (fresh per Form), action-reset detection
packages/theme/src/form.css
```

### 2. Machine

```ts
type FormEvent =
  | { type: "FIELD.REGISTER"; field: FormField }      // name, element (for tree order), validate(), value(), focus(), status()
  | { type: "FIELD.UNREGISTER"; id: string }
  | { type: "SUBMIT.ATTEMPT"; submitter: HTMLElement | null; native: boolean }
  | { type: "FIELD.SETTLED"; id: string }
  | { type: "RESET"; origin: "user" | "framework" }
  | { type: "SUBMITTED" }                              // submission proceeded

states: {
  idle:              { on: { "SUBMIT.ATTEMPT": [ { guard: "anyValidating", target: "validating", actions: ["cancel", "remember"] },
                                                 { guard: "anyInvalid", actions: ["cancel", "focusFirst", "announceSummary"] },
                                                 { target: "awaiting-server", actions: ["proceed"] } ] } },
  validating:        { on: { "FIELD.SETTLED": [ { guard: "stillValidating" },
                                                { guard: "anyInvalid", target: "idle", actions: ["focusFirst", "announceSummary"] },
                                                { target: "awaiting-server", actions: ["resubmit"] } ],
                             "SUBMIT.ATTEMPT": { actions: ["cancel", "remember"] } } },
  "awaiting-server": { on: { $props: /* errors changed */ { target: "idle", actions: ["applyErrors", "focusFirstServer", "announceSummary"] },
                             "SUBMIT.ATTEMPT": /* same as idle */ } },
}
```

- `SUBMIT.ATTEMPT` comes from the form's `submit` event (capture), from `validate()`
  (`native: false`, no submission), and from the first `invalid` event of an attempt.
  Native validation fires `invalid` events *before* `submit`, and no `submit` follows
  when one fails. The Form groups the `invalid` events of one task into one attempt
  through a microtask. Each Field then skips its own focus move, because the Form makes
  it (Field focuses by itself only when no Form is present).
- Tree order: `firstInvalidInTreeOrder` from `add-field` over the registered Fields'
  elements (`compareDocumentPosition`), never the registry order.
- `resubmit`: `form.requestSubmit(submitter)` when the submitter is still connected and
  enabled, else `requestSubmit()`. The re-request runs a native validation pass again, so
  nothing can slip through.
- `errors` is a read-only prop. A changed `errors` object is applied to Fields as
  `ERRORS.EXTERNAL`, keyed by exact `name`. Applying is idempotent per object identity, so
  re-renders with the same object do not re-apply cleared errors.

### 3. React 19 action resets

`form.reset()` called by React after an action runs with no user activation event in
progress. The React adapter wraps `form.reset` while mounted (React Aria's approach in
`useFormValidation.ts`): a reset with no current event, or inside a `message` event from a
`MessagePort` (React's scheduler), is `origin: "framework"`. A reset from a reset button or
during a user event is `"user"`. The detection lives in the React adapter only (other
adapters define their framework's rule), and is a quirk-registry entry so its removal
condition is tracked.

### 4. Context

`Form.Root` always provides a new context value. It never merges an ancestor's
(react-spectrum#10740). Fields read `validationMode`, `validationBehavior`, the external
error map and the registration functions from it.

### 5. Theme

`form.css`: `:where([data-scope="form"][data-part="root"]) { display: grid; gap:
var(--rind-form-gap, var(--rind-space-4)) }`. No variant family.

## Requests to other changes

- **add-field**: none beyond what it already specifies. Form uses `SUBMIT.ATTEMPT`,
  `ERRORS.EXTERNAL` and registration as defined there. One addition, already in this
  design: a Field skips its own first-invalid focus when a Form handles the attempt.
  `add-field`'s implementation should expose that switch.
- **APPLIED (coordinator, 2026-10-14).** **add-checkbox (`hidden-form-input`)**: the reset target. React 19 action resets and
  react-spectrum#6830 / radix#4155 show that a reset must restore the *current*
  `default*` prop, not the one captured at creation. This is the same request add-field
  lists. **Decided (coordinator, 2026-10-14):** a form reset restores the current
  `default*` prop value (parity with native React inputs, which update `defaultValue`
  when the prop changes); changing a `default*` prop never changes the current value or
  state, only what a reset restores. Applied in add-checkbox `hidden-form-input` "Form
  Reset".
- **add-a11y-foundations (`a11y-quirks`)**: an entry for the React action-reset detection
  (§3) with its removal condition (React exposes a reset reason).

## Risks / Trade-offs

- [Wrapping `form.reset` is a monkey patch on a DOM method] → Scoped to the mounted Form,
  restored on unmount, React adapter only, and a quirk entry. The alternative (clearing
  errors on every reset) breaks `useActionState`.
- [Holding a submission for async validators delays it] → Only while a validator is
  pending. The root carries `data-validating` so the consumer can show progress.

## Migration Plan

None. Reado uses no form library component today.
