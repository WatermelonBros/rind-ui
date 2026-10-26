# Editable

Text shown in place that the user can edit: a Preview (a button showing the value) becomes an Input. Enter commits, Escape puts back the value from when editing began, a press outside commits or cancels by `submitMode`, and the focus goes back to the Preview. A hidden input carries the committed value to forms.

## When to use

- **Use it for** a value read far more often than changed, edited where it is shown: a document title, a list name, a table cell's label, a profile field.
- **Over a home-made toggle between a span and an input**: Escape restores the value from the moment editing began (not the last keystroke: zag#3510), an IME composition's Enter never commits, a textarea keeps Enter for newlines, the Preview and the Input share one box so nothing moves, and the Preview is a real button named by its label and its value.
- **Don't use it for** a value that is always being edited ([Text Field](text-field.md)), or for a form whose fields are saved together (a plain form with a Save button).

```tsx
import { Editable } from "@rind-ui/react"

<Editable.Root name="title" defaultValue="Quarterly report" onValueChange={(v) => save(v)}>
  <Editable.Label>Title</Editable.Label>
  <Editable.Area>
    <Editable.Preview />
    <Editable.Input />
  </Editable.Area>
  <Editable.Control>
    <Editable.EditTrigger>Edit</Editable.EditTrigger>
    <Editable.SubmitTrigger>Save</Editable.SubmitTrigger>
    <Editable.CancelTrigger>Cancel</Editable.CancelTrigger>
  </Editable.Control>
</Editable.Root>
```

For several lines, render the Input as a textarea: `<Editable.Input render={<textarea />} />`. Enter is then a newline and Ctrl+Enter (⌘+Enter on Apple platforms) commits.

## API

<!-- api:editable -->

## Anatomy

| Part | `data-part` | Element |
|---|---|---|
| `Editable.Root` | `root` | `<div>`; holds the value; renders the hidden form input. |
| `Editable.Label` | `label` | `<label>`; names the Preview and the Input. |
| `Editable.Area` | `area` | `<div>`; the one cell the Preview and the Input share. |
| `Editable.Preview` | `preview` | `<button>`; the value, else the placeholder; hidden while editing. |
| `Editable.Input` | `input` | `<input>` (or a textarea with `render`); the draft; hidden while previewing. |
| `Editable.Control` | `control` | `<div>`; groups the triggers. |
| `Editable.EditTrigger` | `edit-trigger` | `<button>`; enters edit; hidden while editing. |
| `Editable.SubmitTrigger` | `submit-trigger` | `<button>`; commits; shown while editing. |
| `Editable.CancelTrigger` | `cancel-trigger` | `<button>`; restores; shown while editing. |

Every part carries `data-state` (`preview`, `edit`), `data-empty`, `data-disabled`, `data-readonly` and `data-invalid`.

## Entering and leaving edit

| `activationMode` | Enters edit on |
|---|---|
| `click` (default) | a press on the Preview |
| `dblclick` | a double-click on the Preview |
| `focus` | the Preview receiving focus |
| `none` | the EditTrigger and the controlled `edit` only |

Enter and Space on the Preview always enter edit (it is a button), except with `none`.

| While editing | Result |
|---|---|
| Enter (Ctrl/⌘+Enter in a textarea) | commits the draft |
| Escape | cancels: the value from when editing began |
| SubmitTrigger / CancelTrigger | commits / cancels |
| A press outside the Editable | commits with `submitMode` `both` (default) or `blur`; cancels with `enter` or `none` |

Every `onValueChange` and `onEditChange` carries the reason in `details.event.reason` (`enter-key`, `escape-key`, `outside-press`, `submit-trigger`, `preview-press`…). Calling `details.cancel()` in `onEditChange` keeps the user editing, for validation.

## Keyboard

| Key | Action |
|---|---|
| Enter, Space | On the Preview: enters edit. |
| Enter | In the Input: commits (in a textarea, Ctrl/⌘+Enter). |
| Escape | In the Input: cancels. |

Keys typed during an IME composition belong to the composition: its Enter never commits.

## Accessibility notes

- **The Preview is a button**, named by the Label and the value it shows ("Title Quarterly report"), so a screen reader user knows what pressing it edits.
- **Focus follows**: entering edit focuses the Input (its text selected, `selectOnFocus`); leaving edit returns the focus to the Preview, unless it already moved elsewhere (a press outside).
- **No layout jump**: the Preview and the Input share one grid cell and one box, so editing does not move the content around it.
- **Forms**: only the hidden input has a `name` and submits the committed value; a form reset restores `defaultValue`.

## Testing

```tsx
import { getEditable } from "@rind-ui/testing"

render(<DocumentHeader />)
const title = getEditable(screen, { label: "Title" })
await title.edit()
await title.type("Annual report")
await title.submit()
expect(await title.value()).toBe("Annual report")
```

Contract actions: `edit`, `type`, `submit`, `cancel`. Queries: `isEditing`, `value`, `draft`, `previewText`.

## Tested with

<!-- tested-with:editable -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
