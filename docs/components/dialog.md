# Dialog

A window layered over the page. It is modal by default: everything outside is inert, the page does not scroll and Tab stays inside. Focus moves in on open and returns to the opener on close. The content is `role="dialog"`, named by its title.

## When to use

- **Use it for** a window over the page that needs the user's attention: an edit form, a confirmation of details, a short task.
- **Over a native `<dialog>`**: it adds inert content behind, scroll lock, Tab kept inside, focus moved in on open and returned to the opener on close, a name from its title, and exit animations through `data-*` state.
- **Don't use it for** a decision that must be answered before anything else: use a [confirmation](#confirmation-alert-dialog) (`role="alertdialog"`). For a small non-modal panel anchored to a button, use a [Popover](popover.md). For a hint on hover, use a [Tooltip](tooltip.md).

```tsx
import { Dialog } from "@rind-ui/react"

<Dialog.Root>
  <Dialog.Trigger>Edit profile</Dialog.Trigger>
  <Dialog.Portal>
    <Dialog.Backdrop />
    <Dialog.Positioner>
      <Dialog.Content>
        <Dialog.Title>Edit profile</Dialog.Title>
        <Dialog.Description>Change your display name.</Dialog.Description>
        <label>Name <input /></label>
        <Dialog.CloseTrigger>Cancel</Dialog.CloseTrigger>
      </Dialog.Content>
    </Dialog.Positioner>
  </Dialog.Portal>
</Dialog.Root>
```

Only `Root` and `Content` are required. `Portal`, `Backdrop` and `Positioner` are optional; the content works inline or portalled. Parts render when the dialog first opens and unmount after their exit animation; `keepMounted` keeps them in the document, hidden.

## API

<!-- api:dialog -->

## Naming

An open dialog needs an accessible name: render a `Dialog.Title`, or pass `aria-label` or `aria-labelledby` on the content. Without one, a single development warning names the dialog (nothing throws). The title and description ids are added to `aria-labelledby` and `aria-describedby` only while those parts are rendered, after any ids you pass yourself. A missing description is fine: no `aria-describedby`, no warning.

`Dialog.Title` is an `h2` by default; `level={3}` changes it, and a `Heading` inside the content renders one level below it. A title substituted through `render={<div />}` gets `role="heading"` and `aria-level`.

An icon-only `Dialog.CloseTrigger` is named by `messages.close` (default "Close"): `<Dialog.Root messages={{ close: "Chiudi" }}>` or through the provider.

## Initial focus

By default focus goes to `data-autofocus`, then the first tabbable element, then the content (the content itself when opened by touch). A dialog opened with a pointer shows no focus ring on its initial target. Choose another target with `initialFocus`:

- `"title"`: for long content (terms, articles) so reading starts at the top; the title gets `tabindex="-1"` only while it is the target.
- `"content"`, a function returning an element, or `false` (focus does not move).
- Framework `autoFocus` inside the content wins: the dialog leaves focus where the app put it.

`finalFocus` is `null` (the trigger that opened it, or the element focused before a programmatic open), a function of the close reason, or `false`.

## Non-modal

`modal={false}` makes nothing inert, locks no scroll and contains no focus; the content has no `aria-modal` and no backdrop is rendered. The page stays usable and a press outside or tabbing out does not close it. Triggers toggle it (reason `TRIGGER_PRESS`). Use a Popover when you want light dismissal.

## Controlled use and reasons

`open` / `defaultOpen` / `onOpenChange(open, details)`. `details.reason` is one of `trigger`, `close-trigger`, `escape-key`, `outside-press`, `outside-focus`, `parent-dismissed`, `api`; `details.cancel()` keeps it open. A controlled dialog only proposes: if the parent keeps `open`, nothing changes. Changing `open` yourself never calls `onOpenChange`. Veto a dismissal early with `onEscapeKeyDown` or `onInteractOutside` and `event.preventDefault()`: no other layer closes either. `actionsRef` gives `open()` / `close()`.

After closing, the content (and triggers) carry `data-close-reason` in kebab case (`escape-key`) until the next open.

## Forms

Enter in a field submits the form natively; the dialog never handles Enter. A `Dialog.CloseTrigger type="submit"` inside a form closes on that form's `submit`, while the form is still connected; an invalid form stays open. A trigger inside a form does not submit it.

## Nesting

A dialog opened from inside another dialog is its child: Escape and a press on the child's backdrop close only the child, focus returns to the button that opened it, and closing the parent closes the child first with `PARENT_DISMISSED`. Parent content has `data-has-nested`, the child `data-nested`, and both expose `--layer-index` and `--nested-layer-count`. A dialog rendered inside a menu item is not the menu's child, so it survives the menu closing.

## Confirmation (alert dialog)

`role="alertdialog"` makes the dialog a confirmation: a question the user must answer before going on. `Dialog.Cancel` and `Dialog.Action` are its buttons.

```tsx
<Dialog.Root role="alertdialog">
  <Dialog.Trigger>Delete project</Dialog.Trigger>
  <Dialog.Portal>
    <Dialog.Backdrop />
    <Dialog.Positioner>
      <Dialog.Content>
        <Dialog.Title>Delete project?</Dialog.Title>
        <Dialog.Description>This cannot be undone.</Dialog.Description>
        <Dialog.Cancel>Cancel</Dialog.Cancel>
        <Dialog.Action>Delete</Dialog.Action>
      </Dialog.Content>
    </Dialog.Positioner>
  </Dialog.Portal>
</Dialog.Root>
```

### When to use

- **Use it for** a decision the user must take before anything else: confirm a deletion, discard changes, acknowledge an error. It interrupts the workflow, so a press outside never dismisses it by accident.
- **Over a plain dialog**: the content is `role="alertdialog"`, it is always modal, an outside press never closes it, focus starts on Cancel (the least destructive choice, and a button never opens the on-screen keyboard), and a missing description warns in development. `modal` and `closeOnInteractOutside` are not props of a confirmation (a type error), so it cannot be weakened by accident.
- **Don't use it for** anything the user may walk away from (forms, settings, details): use a plain dialog. A message that needs no answer is an [Alert](alert.md) or a [Toast](toast.md).

### Cancel and Action

`Dialog.Cancel` closes with reason `cancel`; `Dialog.Action` with reason `action` (render several for several choices; `confirm(name)` in tests picks one). Both default to `type="button"`, and both work in a plain dialog too. An `Action type="submit"` inside a form runs the form's `submit` while it is still connected, then closes; an invalid form stays open.

### Escape, naming and focus

Escape closes the topmost confirmation with reason `escape-key`; turn it off with `closeOnEscape={false}` for a choice that must be explicit, or decide per request with `onEscapeKeyDown` and `event.preventDefault()`. A press on the backdrop or the positioner does nothing and calls no `onOpenChange`. A `Dialog.CloseTrigger` does not close a confirmation either: it is answered with Cancel, an Action or Escape.

It needs a name (`Dialog.Title`, or `aria-label` / `aria-labelledby`) and a description of the message (`Dialog.Description`, or `aria-describedby`); each missing one logs a development warning. Focus moves to Cancel on open, looked up when focus moves; with no Cancel, the content takes focus (so a lone "OK" is not activated by a stray Enter; pass `initialFocus` or `data-autofocus` to choose another element). `initialFocus` takes `"cancel"` (the default here), `"content"`, `"title"`, a function, or `false`.

### Async confirm

An action closes the dialog unless the request is cancelled. For work that takes time, cancel the close, show progress and close it yourself when the work is done:

```tsx
const actions = useRef<DialogActions>(null)
const [pending, setPending] = useState(false)

<Dialog.Root
  role="alertdialog"
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
  <Dialog.Action disabled={pending}>{pending ? "Deleting" : "Delete"}</Dialog.Action>
</Dialog.Root>
```

While it runs the dialog stays open, the page behind stays inert and Cancel keeps working.

### Styling and testing

`dialog.css` styles a confirmation narrower, with Cancel and Action as an end-aligned row under the message (render them as direct children of the Content), and reads `--rind-alert-dialog-*` tokens that fall back to `--rind-dialog-*`.

```tsx
const confirm = getDialog(screen, { name: "Delete project?", role: "alertdialog" })
await confirm.open()
await confirm.confirm("Delete")
expect(await confirm.closeReason()).toBe("action")
```

With `role: "alertdialog"`, `pressOutside()` completes with the dialog still open; `cancel()` and `confirm(name?)` press its buttons.

<!-- aria:dialog--confirmation-open -->
```yaml
- button "Delete project"
- alertdialog "Delete project?":
  - heading "Delete project?" [level=2]
  - paragraph: This cannot be undone.
  - button "Cancel"
  - button "Delete"
```
<!-- /aria -->

## Migrating from Reado / Ark

Replace `@ark-ui/react/dialog` imports with `@rind-ui/react`, drop `lazyMount` and `unmountOnExit` (the default), and change `onOpenChange={(d) => … d.open}` to `onOpenChange={(open) => …}`. Radix `Dialog.Overlay` is `Dialog.Backdrop`; `asChild` is `render`.

## Styling

Style the `data-*` attributes above, or import `@rind-ui/theme/dialog.css`: structural only (fixed backdrop, centred scrolling positioner, content surface, close trigger, entry and exit with the duration tokens and none under reduced motion, nested backdrop toning, forced-colors border) with `--rind-dialog-*` tokens.

## Testing

Contract actions: `open()`, `close()`, `pressEscape()`, `pressOutside()`, `tab()`, `shiftTab()`, `waitForUnmount()`. Queries: `isOpen`, `isModal`, `title`, `description`, `hasFocus`, `isTopmost`, `closeReason`. The dialog is located through its trigger (`trigger` defaults to `name`).

```tsx
import { getDialog } from "@rind-ui/testing"

render(<Profile />)
const dialog = getDialog(screen, { name: "Edit profile" })
await dialog.open()
await dialog.pressEscape()
expect(await dialog.closeReason()).toBe("escape-key")
```

Pass `modal: false` for a non-modal dialog. `testMachine(dialogContract, …)` (or `nonModalDialogContract`) runs the machine graph against your own wrapper; a wrapper without a title fails the "named role" invariant.

## Accessibility tree

<!-- aria:dialog--open -->
```yaml
- button "Edit profile"
- dialog "Edit profile":
  - heading "Edit profile" [level=2]
  - paragraph: Make changes to your profile here.
  - textbox "Display name": Ada
  - button "Close"
```
<!-- /aria -->

## Tested with

<!-- tested-with:dialog -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
