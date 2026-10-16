# Alert Dialog

A modal dialog that asks the user to confirm or cancel a consequential action. It is the [Dialog](dialog.md) with stricter rules: always modal, `role="alertdialog"`, focus starts on Cancel, and only Escape, Cancel or an action closes it. Everything else (open state and reasons, nesting, forms, mounting, final focus) behaves as the Dialog does; both are built from the same machine.

```tsx
import { AlertDialog } from "@rind-ui/react"

<AlertDialog.Root>
  <AlertDialog.Trigger>Delete project</AlertDialog.Trigger>
  <AlertDialog.Portal>
    <AlertDialog.Backdrop />
    <AlertDialog.Positioner>
      <AlertDialog.Content>
        <AlertDialog.Title>Delete project?</AlertDialog.Title>
        <AlertDialog.Description>This cannot be undone.</AlertDialog.Description>
        <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
        <AlertDialog.Action>Delete</AlertDialog.Action>
      </AlertDialog.Content>
    </AlertDialog.Positioner>
  </AlertDialog.Portal>
</AlertDialog.Root>
```

## Dialog or Alert Dialog?

Use an Alert Dialog when the user must answer before going on: confirm a deletion, discard changes, acknowledge an error. It interrupts the workflow, so a press outside never dismisses it by accident. Use a Dialog for anything the user may walk away from: forms, settings, details. `modal` and `closeOnInteractOutside` are not props of the Alert Dialog (a type error), so it cannot be weakened into a Dialog.

## API

<!-- api:alert-dialog -->

## Escape policy

Escape closes the topmost alert dialog with reason `escape-key`, and focus returns to the trigger. For a choice that must be explicit, turn it off with `closeOnEscape={false}`, or decide per request with `onEscapeKeyDown` and `event.preventDefault()` (for example while a request is running, or after a programmatic open the user has not seen yet). A vetoed Escape closes no layer beneath either. A press on the backdrop or the positioner does nothing and calls no `onOpenChange`.

## Naming and description

An open alert dialog needs an accessible name and a description of the alert message.

- Name: render an `AlertDialog.Title`, or pass `aria-label` / `aria-labelledby` on the content. It is an `h2` by default (`level={3}` changes it; a `Heading` in the content renders one level below).
- Description: render an `AlertDialog.Description` with the message, or pass `aria-describedby`.

A missing name or a missing description each log one development warning and nothing throws. Without a description there is no `aria-describedby`; the screen reader then reads the name and the focused Cancel only.

## Initial focus

Focus moves to `AlertDialog.Cancel` on open, whatever the input: the least destructive choice, and a button never opens the on-screen keyboard. The Cancel element is looked up when focus moves, so a content replaced by your framework in the meantime is not left with a detached node focused. With no Cancel, the content takes focus. `initialFocus` takes `"cancel"` (default), `"content"`, `"title"`, a function, or `false`.

## Async confirm

An action closes the dialog unless the request is cancelled. For work that takes time, cancel the close, show progress in the dialog and close it yourself when the work is done:

```tsx
const actions = useRef<DialogActions>(null)
const [pending, setPending] = useState(false)

<AlertDialog.Root
  actionsRef={actions}
  onOpenChange={(open, details) => {
    if (open || details.reason !== "action") return
    details.cancel()
    setPending(true)
    remove().finally(() => {
      setPending(false)
      actions.current?.close()
    })
  }}
>
  …
  <AlertDialog.Action disabled={pending}>{pending ? "Deleting" : "Delete"}</AlertDialog.Action>
</AlertDialog.Root>
```

While it runs the dialog stays open, the page behind stays inert and Cancel keeps working. A controlled dialog does the same by keeping `open={true}` until the work resolves. After it closes, focus returns to the trigger.

## Forms

An `AlertDialog.Action type="submit"` inside a form runs the form's `submit` while the form is still connected, then closes with `ACTION_PRESS`. An invalid form stays open. `Cancel` and `Action` default to `type="button"`.

## Reasons and styling

`details.reason` is `trigger`, `cancel`, `action`, `escape-key`, `outside-focus`, `parent-dismissed` or `api`, so Cancel, Action and Escape are distinguishable in a controlled `onOpenChange`. After closing, the content and triggers carry `data-close-reason` in kebab case (`action`) until the next open, for exit animations.

Style the `data-*` attributes above, or import `@rind-ui/theme/alert-dialog.css` (included in the theme index): it reuses the Dialog's surface, lays Cancel and Action out as an end-aligned row (render them as direct children of the Content for that default layout), and reads `--rind-alert-dialog-*` tokens that fall back to `--rind-dialog-*`. It turns transitions off under reduced motion and keeps the border and focus ring in forced colors.

## Nesting

An alert dialog opened from a Dialog (or the reverse) is a child layer: Escape or Cancel closes only the child, the parent has `data-has-nested` meanwhile, and focus returns to the button in the parent that opened it. Closing the parent closes the child first with `PARENT_DISMISSED`.

## Testing

Contract actions: `open()`, `cancel()`, `confirm(name?)`, `pressEscape()`, `pressOutside()` (completes with the dialog still open), `tab()`, `shiftTab()`, `waitForUnmount()`. Queries: `isOpen`, `isModal`, `title`, `description`, `hasFocus`, `isTopmost`, `closeReason`. The dialog is located through its trigger (`trigger` defaults to `name`).

```tsx
import { getAlertDialog } from "@rind-ui/testing"

render(<Projects />)
const alert = getAlertDialog(screen, { name: "Delete project?" })
await alert.open()
await alert.confirm("Delete")
expect(await alert.closeReason()).toBe("action")
```

`confirm()` without a name presses the only action. `testMachine(alertDialogContract, …)` runs the machine graph against your own wrapper.

## Tested with

<!-- tested-with:alert-dialog -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
