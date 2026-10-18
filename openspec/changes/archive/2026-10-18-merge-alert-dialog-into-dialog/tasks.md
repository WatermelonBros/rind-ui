## 1. Core

- [x] 1.1 `DialogProps.role`; `dialogPieces` derives modality, outside dismissal, initial focus, the description warning and the layer kind from it; the Dialog machine closes on `CLOSE_TRIGGER_PRESS`, `CANCEL_PRESS` and `ACTION_PRESS`
- [x] 1.2 `dialogConnect`: content role from the input (forcing modal for `alertdialog`), `cancel` / `action` parts and press handlers
- [x] 1.3 Contract: `cancel` / `confirm` actions on the Dialog contract; `alertDialogRoleContract`; meta gains the role prop and the two parts
- [x] 1.4 Remove `components/alert-dialog`; move its machine and connect tests to `dialog-alert-role.*.test.ts`

## 2. React

- [x] 2.1 `Dialog.Root` `role` (generic `DialogRootProps<R>`), `Dialog.Cancel`, `Dialog.Action`; remove `AlertDialog`

## 3. Testing

- [x] 3.1 `getDialog(…, { role: "alertdialog" })`; remove `getAlertDialog`
- [x] 3.2 Move the Alert Dialog DOM, browser, hydration, reading-order, model and type tests to `dialog-alert-role*` (same test counts); the Dialog model fixture renders Cancel and Action

## 4. Theme, site and docs

- [x] 4.1 `dialog.css` confirmation rules; remove `alert-dialog.css` and its family entry; move the theme test
- [x] 4.2 Site examples into `dialog.tsx` (Confirmation…), skin rules on the dialog scope, the ARIA snapshot renamed `dialog--confirmation-open`
- [x] 4.3 Dialog docs "Confirmation (alert dialog)" section with "When to use"; remove `docs/components/alert-dialog.md` and the inventory row; retarget links; manual protocol entry

## 5. Proof

- [x] 5.1 Lint, typecheck, build; the Dialog, Drawer and confirmation suites in node, jsdom, browsers and Playwright; site audit; a breaking changeset
