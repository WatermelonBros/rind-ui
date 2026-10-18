---
"@rind-ui/core": minor
"@rind-ui/react": minor
"@rind-ui/testing": minor
"@rind-ui/theme": minor
---

**BREAKING** Alert Dialog folds into Dialog. `<Dialog.Root role="alertdialog">` is a confirmation with every former Alert Dialog default: always modal, never closed by an outside press, focus on Cancel, a warning for a missing description. `modal` and `closeOnInteractOutside` are type errors with that role. `Dialog.Cancel` and `Dialog.Action` are Dialog parts usable in any dialog. Migrate as follows:

- `AlertDialog.*` → `Dialog.*` with `role="alertdialog"` on the Root.
- `getAlertDialog(t, a)` → `getDialog(t, { ...a, role: "alertdialog" })`.
- `alertDialogContract` → `alertDialogRoleContract`.
- `@rind-ui/theme/alert-dialog.css` → `dialog.css`, with the same `--rind-alert-dialog-*` tokens.
- Selectors on `data-scope="alert-dialog"` → `[data-scope="dialog"]` and `[role="alertdialog"]`.

`alertDialogMachine`, `alertDialogConnect` and `alertDialogMeta` are removed.
