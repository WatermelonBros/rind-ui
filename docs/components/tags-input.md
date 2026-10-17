# Tags Input

A text input that turns what the user types into a list of tags (chips). Enter or a delimiter creates a tag, a paste of a list creates several, Backspace and the remove buttons delete them, and a tag can be edited in place. The value is a `string[]`. The input keeps DOM focus while the user types; the chips are a toolbar the user moves through with the arrow keys.

```tsx
import { TagsInput } from "@rind-ui/react"

<TagsInput.Root defaultValue={["rome"]} onValueChange={(tags) => save(tags)}>
  <TagsInput.Label>Cities</TagsInput.Label>
  <TagsInput.Control>
    <TagsInput.Chips />
    <TagsInput.Input />
    <TagsInput.ClearTrigger />
  </TagsInput.Control>
</TagsInput.Root>
```

`Chips` renders one `Chip` per tag, each with `ChipText`, `ChipInput` (only while that tag is edited) and `ChipRemove`. Pass a render function to change a chip: it receives `{ key, text, disabled }`.

```tsx
<TagsInput.Chips>
  {(chip) => (
    <TagsInput.Chip disabled={chip.text === "rome"}>
      <TagsInput.ChipText />
      <TagsInput.ChipInput />
      <TagsInput.ChipRemove />
    </TagsInput.Chip>
  )}
</TagsInput.Chips>
```

The input needs an accessible name: render a `TagsInput.Label`, or pass `aria-label` to `TagsInput.Input`.

## API

<!-- api:tags-input -->

## Anatomy

| Part | `data-part` | Element |
|---|---|---|
| `TagsInput.Root` | none | Renders no element: it owns the state and provides it to the parts. |
| `TagsInput.Label` | `label` | `<label>` for the input. |
| `TagsInput.Control` | `control` | `<div>` wrapping the chips, the input and the clear button. It also renders the screen-reader summary and the hidden form inputs. |
| `TagsInput.Chips` | `chips` | The toolbar of chips. |
| `TagsInput.Chip` | `chip` | One tag; `disabled` makes it unremovable and not editable. |
| `TagsInput.ChipText` | `chip-text` | The tag's text. |
| `TagsInput.ChipInput` | `chip-input` | `<input>` rendered only while the tag is edited. |
| `TagsInput.ChipRemove` | `chip-remove` | `<button>` named "Remove …"; out of the tab order. |
| `TagsInput.Input` | `input` | `<input>` for the draft; keeps DOM focus. |
| `TagsInput.ClearTrigger` | `clear-trigger` | `<button>` that removes every tag; `data-visible` while there are tags. |
| none | `chips-summary`, `hidden-input` | The summary text ("2 tags: rome, paris") and the form inputs, rendered by `Control`. |

State is on the parts. The control has `data-state` (`idle` | `typing` | `editing`), `data-focus`, `data-focus-visible`, `data-disabled`, `data-readonly`, `data-invalid`, `data-empty-value` while there are no tags, and `data-at-max` when `max` is reached. The input has `data-refused="<reason>"` while its draft is refused and `data-empty` while it is empty. A chip has `data-highlighted`, `data-armed`, `data-focus-visible`, `data-disabled` and `data-editing`. The chip input has `data-refused`. The clear trigger has `data-visible`.

## Tags Input or Combobox with `multiple`

Use a Tags Input when the user writes the values: email addresses, keywords, labels. Use a Combobox with `multiple` when the values come from a list the user picks from. A Combobox can accept text that is not in the list (`allowCustomValue`), but its input is a search box over options; a Tags Input has no popup, so the text itself is the value and the delimiters, paste, normalising and validation below are built for it.

## Delimiters

The default delimiter is `","`, so tags with spaces work (`new york`). `delimiter` takes a string, a `RegExp` or a list of them. A string is matched literally, so `"|"` and `"."` mean those characters; use a `RegExp` for patterns.

```tsx
<TagsInput.Root delimiter={[",", ";", /\s{2,}/]} />
```

A delimiter is detected from the text change, not from the key, so it also works on a soft keyboard. When the text holds a delimiter and the caret is at the end, every complete segment before the last delimiter becomes a tag and the rest stays as the draft. A delimiter typed with the caret in the middle of the text is ordinary text. Empty segments are dropped.

## Paste

`addOnPaste` (on by default) takes over a paste only when the pasted text holds a delimiter from `pasteDelimiter`. That defaults to your `delimiter` list plus newline, tab and `;`. The text is split, each segment is checked on its own, accepted segments become tags in order in one change and one announcement says how many. Segments that are refused go back to the draft. A paste without a delimiter is inserted as text by the browser, so repeated pastes and undo keep working. Set `addOnPaste={false}` to always insert as text.

## IME

While a composition is open (Japanese, Chinese, Korean and similar input), no tag is created: Enter and delimiters belong to the composition. When the composition ends, a delimiter or Enter that follows works as usual.

## Normalising, duplicates and the maximum

Every candidate goes through `normalize` first. The default trims surrounding whitespace; pass `(text) => text.toLowerCase().trim()` to change case, or `(text) => text` to keep the text as typed. A candidate that is empty after normalising is never a tag.

Duplicates are refused by default; `compare(a, b)` changes what counts as equal, and `allowDuplicates` lets equal tags coexist (removal and editing act on the chip the user chose). With `max`, a candidate beyond the limit is refused; the input stays enabled at the maximum so tags can still be edited and removed, and the control carries `data-at-max`.

## Validation and refusal feedback

`validate(text, value)` runs on each normalised candidate after the duplicate and `max` checks. Return `true` to accept or a string reason to refuse.

```tsx
<TagsInput.Root
  delimiter={[",", ";"]}
  validate={(text) => text.includes("@") || "not an email"}
  onRefuse={({ reason, text }) => showHint(`${text}: ${reason}`)}
/>
```

A refused candidate stays in the input (or in the chip input while editing). The input carries `data-refused` with the reason (`duplicate`, `max`, `invalid` or your own string) until the draft changes, `onRefuse({ reason, text })` runs, and a polite announcement says what happened; the texts come from `messages`. The theme draws a danger border and text, so the cue is not colour alone. A refusal does not make the field invalid for form validation.

## Blur behaviour

When focus leaves the component, `blurBehavior` decides what happens to a draft that is not empty. `"keep"` (the default) leaves it, so nothing is created without a clear action. `"add"` turns it into a tag, subject to all the checks. `"clear"` empties it. Moving focus between the input, the chips and the buttons is not leaving. Leaving also clears the highlight of a chip.

## Editing a tag

With `editable` (the default), Enter on a focused chip, or a double press on it, replaces its text with a chip input holding the tag, all selected. Enter or blur commits, Escape cancels, and committing an empty text removes the tag. The commit is normalised and checked like a new tag; a refused one keeps the chip input open with `data-refused`. Focus returns to the chip after a commit or a cancel by key. A tag changed this way is announced as updated.

## Keyboard

| Key | Behaviour |
|---|---|
| Enter in the input | Creates a tag from a non-empty draft and does not submit the form. With an empty draft the browser submits the form. |
| Delimiter | Creates the tags before it (see Delimiters). |
| Backspace in an empty input | The first press highlights the last tag; the second removes it. `removeOnBackspace={false}` turns this off. |
| Arrow back at the start of the input | Moves focus to the last tag (Left, or Right in right-to-left). Between tags the arrows move (they follow `dir`). |
| Backspace / Delete on a chip | Remove it; focus moves to a neighbour or the input. |
| Enter on a chip | Edit it. |
| Typing on a chip | Returns to the input with that text. |
| Tab | Leaves the component; the chips and buttons are not tab stops. |

## Forms

Give the Root `name` and one entry per tag is submitted under it, in order (`FormData.getAll("tags")`). The text in the input is not submitted unless `inputName` names it. `required` blocks the submission while there are no tags and moves focus to the input. `disabled`, `readOnly`, `invalid` and `form` work as on a native control, and a form reset restores `defaultValue` and empties the draft. Pending text in the input is not a tag, so it is not submitted either.

## Field

Inside a `Field.Root`, the Field's label, description and error message are wired to the input, and `required`, `invalid` and `disabled` from the Field apply. Put the `TagsInput.Root` in the Field in place of a control and omit `TagsInput.Label` when `Field.Label` is used.

## Accessibility notes

- **Roles.** The input is a textbox named by the label. The chips are a toolbar named "Tags" (`messages.chipsLabel`); each remove button is named after its tag.
- **Focus.** DOM focus is real: it moves from the input to a tag and back by arrow keys. The chips, the remove buttons and the clear button are out of the tab order and reachable by pointer and touch.
- **Summary.** `Control` renders a visually hidden summary of the tags ("2 tags: rome, paris") for screen readers that skip over toolbars.
- **Announcements.** Added, removed, updated and refused tags, and a clear, are announced politely through a live region.
- **Target size.** The chip remove and clear buttons are at least 24 by 24 CSS pixels in the theme.

## Styling

Style the `data-*` attributes above. The Control and each Chip take `data-variant` (`solid`, `soft`, `outline`, `ghost`) and `data-size` (`sm`, `md`, `lg`). A chip always has a border; the highlighted chip has an outline as well as a background, so it survives forced colors. The input grows with its text where `field-sizing: content` is supported and fills the row otherwise. Tokens are `--rind-tags-input-*` (control height, background, border, radius, padding, gap, input minimum width, chip background, border, radius, padding, highlight outline, remove size and the refused text colour); each falls back to the matching Combobox chip or control token.

## Testing

`getTagsInput(screen, { name })` locates the component by role and accessible name. Actions: `type`, `addTag`, `paste`, `compose` (an IME session), `pressEnter`, `editTag`, `removeTag`, `clear`, `tabOut`. Queries: `tags`, `inputValue`, `isAtMax`, `refusal`, `isEditing`.

```tsx
import { getTagsInput } from "@rind-ui/testing"

render(<Cities />)
const cities = getTagsInput(screen, { name: "Cities" })
await cities.addTag("rome")
await cities.paste("paris, oslo")
expect(await cities.tags()).toEqual(["rome", "paris", "oslo"])
await cities.removeTag("oslo")
await cities.editTag("paris", "lyon")
expect(await cities.tags()).toEqual(["rome", "lyon"])
```

`refusal()` returns the reason of a refused draft, or `null`. To test the machine without a DOM, `testMachine(tagsInputMachine, props)` from `@rind-ui/testing` walks the state graph against the contract's oracle.

## Tested with

<!-- tested-with:tags-input -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
