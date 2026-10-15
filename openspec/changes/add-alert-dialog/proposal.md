## Why

An alert dialog interrupts the user to confirm or cancel something consequential
("Delete project?"). It needs the Dialog's behaviour with different defaults —
always modal, never dismissed by a stray click, focus on the least destructive
action — and an `Action` that can keep the dialog open while an async confirm
runs. Libraries that copied Dialog into a separate AlertDialog let the copies drift
(reka-ui#2702: only the AlertDialog became unclickable; mui/base-ui#1165: alert
dialogs not recognised as nested dialogs). rind-ui builds it as a preset of the
Dialog machine.

Research this change is based on:
[alert-dialog](../../../docs/research/alert-dialog.md) (Bug history,
Accessibility, decisions) · [dialog](../../../docs/research/dialog.md) ·
[overlay-infrastructure](../../../docs/research/overlay-infrastructure.md) ·
[native-platform](../../../docs/research/native-platform.md) (why not
`showModal()`: Escape cannot be reliably vetoed without fresh user activation) ·
[accessibility](../../../docs/research/accessibility.md) ·
[assistive-tech-and-a11y-testing](../../../docs/research/assistive-tech-and-a11y-testing.md)

**Depends on `add-dialog`** (its machine builder, connect, parts, contract and every
Dialog requirement not overridden here), and through it on `add-foundations`,
`add-a11y-foundations` and `add-overlay-infrastructure`. Apply after `add-dialog`.

## What Changes

- `@rind-ui/core`: `alertDialogMachine`, built with the Dialog's
  `buildDialogMachine` (kind `alertdialog`, close events `CANCEL_PRESS` and
  `ACTION_PRESS`), its connect and contract.
- Behaviour that differs from Dialog: `role="alertdialog"`; always modal (no `modal`
  prop); outside presses never close it (no `closeOnInteractOutside` prop); Escape
  closes it by default; initial focus on `Cancel`; dev warnings for a missing title
  or description.
- `Action` closes the dialog unless the close is cancelled, so async confirms keep
  it open until the work finishes; `Cancel` and `Action` follow Dialog's
  submit-button rule.
- `@rind-ui/react`: `AlertDialog.Root`, `Trigger`, `Backdrop`, `Positioner`,
  `Content`, `Title`, `Description`, `Cancel`, `Action` (Radix/Base UI names; Ark
  has no alert dialog).
- `@rind-ui/testing`: `getAlertDialog` with `confirm()` and `cancel()`.
- Theme stylesheet, stories (default, destructive confirm, async confirm, nested in
  a dialog, form inside), docs page with "Dialog or Alert Dialog?" guidance.
- New research note `docs/research/alert-dialog.md`.

## Capabilities

### New Capabilities

- `alert-dialog`: the Alert Dialog component — what it changes relative to
  `dialog` (role, modality, dismissal, initial focus, naming), its `Cancel` and
  `Action` parts and async confirmation, attributes, contract and driver.

### Modified Capabilities

None. (`dialog` is introduced by the unarchived `add-dialog`; this capability
refers to it instead of modifying it.)

## Non-goals

- A `pending` state or loading attributes on `Action` (consumers render their own
  pending UI; react-spectrum#4362 needed a pending Button first).
- Disabling Escape by default; consumers may veto it (`closeOnEscape={false}` or
  `onEscapeKeyDown`).
- A non-modal alert dialog; toasts and inline alerts cover non-blocking messages.
- An imperative "confirm()" helper returning a promise (a recipe in the docs, not
  library API).
- Native `<dialog>`; framework adapters other than React; fx.

## Impact

- New code: `packages/core/src/components/alert-dialog/*`,
  `packages/react/src/alert-dialog/*`, testing driver export,
  `packages/theme/src/alert-dialog.css`, stories, generated docs page.
- Reuses Dialog's machine builder; no change to Dialog's behaviour.
- No new runtime dependency.
