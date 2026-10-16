## Context

See proposal.md for motivation and specs/alert-dialog/spec.md for behaviour; research
in [alert-dialog.md](../../../docs/research/alert-dialog.md). Everything not listed
here is the Dialog's design (`add-dialog/design.md`): overlay effect, parentage,
submit-type close parts, connect rules, React presence, contract shape.

## Goals / Non-Goals

**Goals:**
- One machine definition for Dialog and Alert Dialog; Alert Dialog adds two events
  and different defaults, nothing else.
- The Alert Dialog contract and driver add `cancel()` / `confirm()` and run every
  Dialog invariant.

**Non-Goals:**
- A pending state; a promise-returning `confirm()` helper.

## Decisions

### 1. Machine preset

```ts
export const alertDialogMachine = buildDialogMachine({
  kind: "alertdialog",
  closeEvents: ["CANCEL_PRESS", "ACTION_PRESS"],   // added to open.on → closed
  defaults: { modal: true, closeOnInteractOutside: false, closeOnEscape: true, initialFocus: "cancel" },
  fixed: ["modal", "closeOnInteractOutside"],      // removed from the public props type
})
```

States: `closed | open` (as Dialog). Events: Dialog's, minus `CLOSE_TRIGGER_PRESS`,
plus `{ type: "CANCEL_PRESS"; modality }` and `{ type: "ACTION_PRESS"; action:
string; modality }`. `TRIGGER_PRESS` never closes (always modal: trigger is inert).
`initialFocus: "cancel"` is a part name the builder resolves lazily (at focus time,
from the live part registry, skipping disconnected nodes — bits-ui#2136), falling
back to the content. Overlay effect: kind `alertdialog`, `dismiss.outsidePress =
false`.

*Alternatives:* a `role` prop on Dialog (Zag) — rejected: modality and dismissal
would be boolean forks and the contract could not differ; a separate copied machine
(Radix/Reka/Bits/Kobalte) — rejected: copies drift (reka-ui#2702).

### 2. Action semantics

`ACTION_PRESS` is a normal close proposal: uncontrolled, it closes unless
`details.cancel()`; controlled, the parent decides. Async confirm = cancel, do the
work, close through the API or the `open` prop. *Alternatives:* Radix (Action always
closes; async needs a plain button — radix#1747) and Bits UI (Action never closes —
bits-ui#1008, users called it a regression). Ours keeps the common case one line
and the async case explicit.

### 3. Connect and parts

As the Dialog's, with: scope `alert-dialog`; content `role="alertdialog"`,
`aria-modal="true"` always; `data-modal` always; `cancel` and `action` parts
(`type=button`, press handlers, focus attributes; submit-type rule from Dialog);
`nameCheck` also warns for a missing description. React: `AlertDialog.Root`,
`Trigger`, `Backdrop`, `Positioner`, `Content`, `Title`, `Description`, `Cancel`,
`Action`. Title and Content use Dialog's heading rules (from add-heading): `h{level}`
(default `h2`) via `headingProps`, content children in a `Heading.Level` one deeper.

### 4. Contract

`alertDialogContract` reuses the Dialog contract's actions and queries through a
shared helper, with `locate: { role: "alertdialog", name: true }`, traits `layer`,
`modal`, `restores-focus`, `presence`, actions `cancel`, `confirm(name?)`, and a
`pressOutside` whose postcondition is "still open". Event map: `CANCEL_PRESS →
cancel`, `ACTION_PRESS → confirm`, plus Dialog's `TRIGGER_PRESS`, `ESCAPE_KEY`.

## Risks / Trade-offs

- [Escape closes by default, so "must answer" dialogs need an explicit veto] →
  APG keeps Escape for alertdialog; documented; `closeOnEscape={false}` exists.
- [Depends on add-dialog's builder API] → task 0.1 blocks until it lands.
- [VO + Chrome may not read the description on open (radix#2038, #3348)] → keep the
  message short and in the description; manual tier-1 check.

## Migration Plan

New API. Reado has no alert dialog today (confirmations use `Modal`); the docs page
shows the port of a confirmation `Modal` to `AlertDialog`.
