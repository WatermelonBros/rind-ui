## Why

Alert Dialog was the Dialog's machine with a few options fixed, shipped as a second component with its own parts, docs page, driver and stylesheet. The user decided against duplicate components: a confirmation is a Dialog with `role="alertdialog"`. One component, one docs page, one driver; Cancel and Action become Dialog parts that any dialog may use.

## What Changes

- **BREAKING** `AlertDialog` (React), `alertDialogMachine`, `alertDialogConnect`, `alertDialogContract`, `alertDialogMeta`, `getAlertDialog` and `@rind-ui/theme/alert-dialog.css` are removed.
- `Dialog.Root` takes `role?: "dialog" | "alertdialog"`. With `"alertdialog"` it applies every Alert Dialog default: always modal, an outside press never closes it, initial focus on Cancel, a development warning for a missing description, `role="alertdialog"` on the content and layer kind `alertdialog`. `modal` and `closeOnInteractOutside` are type errors with that role (`DialogRootProps<R>` is generic over the role, inferred from the JSX attribute).
- `Dialog.Cancel` and `Dialog.Action` are Dialog parts (reasons `cancel` and `action`), usable in either role; the Dialog machine has the three close events.
- `getDialog(target, { name, role: "alertdialog" })` drives a confirmation (`alertDialogRoleContract`): `cancel()`, `confirm(name?)`, outside presses leave it open.
- `dialog.css` styles confirmations (`[role="alertdialog"]`, `--rind-alert-dialog-*` tokens falling back to `--rind-dialog-*`) and Cancel/Action.
- Docs: a "Confirmation (alert dialog)" section with "When to use" on the Dialog page; the Alert Dialog page and inventory row are removed; links are retargeted. Site examples, the open-state ARIA snapshot and tests move to the Dialog (`dialog-alert-role*` test files, same counts).

## Capabilities

### New Capabilities

### Modified Capabilities

- `dialog`: gains the `role` prop, the alert-dialog-role requirements, and the Cancel and Action parts.
- `alert-dialog`: every requirement moves to `dialog`.

## Impact

`@rind-ui/core`, `@rind-ui/react`, `@rind-ui/testing` and `@rind-ui/theme` exports; the docs pages, site examples, skins and the ARIA snapshot name; `docs/components.md`. The Drawer is unchanged.
