## Context

Alert Dialog folds into Dialog as `role="alertdialog"` (proposal.md). The machine, contract and
parts are the Dialog's; the role fixes a few options at runtime.

## Decisions

- **Initial focus without Cancel goes to the content**, not the first focusable element (APG's
  general rule). This keeps the former Alert Dialog's deliberate choice
  ([research](../../../../docs/research/alert-dialog.md), "Initial focus"): a confirmation with a
  lone "OK" Action must not be activated by a stray Enter right after it opens. A consumer who
  wants the APG default passes `initialFocus` (a function or `"title"`) or `data-autofocus`.
- **A close trigger does not close a confirmation.** It is answered with Cancel, an Action or
  Escape, as the former Alert Dialog was (`closesOnCloseTrigger` guard); its contract variant maps
  `CLOSE_TRIGGER_PRESS` to a skip. Cancel and Action do work in a plain dialog.
- **`DialogRootProps<R>` is generic over the role** rather than a union, so `role="alertdialog"
  modal={false}` fails to compile while `interface X extends DialogRootProps` keeps working.
