# Combobox

A text input with a popup list of options: the user types to narrow the list, moves through it with the arrow keys and picks one. It covers the select-with-search case (the value is one of the options), the free-text case (`allowCustomValue`), inline completion, grouped and disabled options, and lists filtered by a server. The input keeps focus the whole time; the highlighted option is announced through `aria-activedescendant`. The option parts are the Listbox parts, so keys, attributes and selection match a Listbox.

```tsx
import { Combobox } from "@rind-ui/react"

const cities = [
  { key: "rome", label: "Rome" },
  { key: "paris", label: "Paris" },
]

<Combobox.Root items={cities} onValueChange={(value) => save(value)}>
  <Combobox.Label>City</Combobox.Label>
  <Combobox.Control>
    <Combobox.Input />
    <Combobox.ClearTrigger />
    <Combobox.Trigger />
  </Combobox.Control>
  <Combobox.Positioner>
    <Combobox.Popup>
      <Combobox.List>
        <Combobox.Items>
          {(label) => (
            <>
              <Combobox.ItemText>{label}</Combobox.ItemText>
              <Combobox.ItemIndicator />
            </>
          )}
        </Combobox.Items>
      </Combobox.List>
      <Combobox.Empty>No results</Combobox.Empty>
    </Combobox.Popup>
  </Combobox.Positioner>
</Combobox.Root>
```

The input needs an accessible name: render a `Combobox.Label` (it is a `<label>` for the input), or pass `aria-label` / `aria-labelledby` to `Combobox.Input`.

## API

<!-- api:combobox -->

## Anatomy

| Part | `data-part` | Element |
|---|---|---|
| `Combobox.Root` | none | Renders no element: it owns the state and provides it to the parts. |
| `Combobox.Label` | `label` | `<label>` for the input. |
| `Combobox.Control` | `control` | `<div>` wrapping the input and the buttons; the popup anchors to it. |
| `Combobox.Input` | `input` | `<input role="combobox">`; keeps DOM focus. |
| `Combobox.Trigger` | `trigger` | `<button>` that opens or closes the popup; out of the tab order. |
| `Combobox.ClearTrigger` | `clear-trigger` | `<button>` that clears the value and the text; `data-visible` while there is something to clear. |
| `Combobox.Positioner` | `positioner` | The positioned box around the popup. |
| `Combobox.Popup` | `popup` | The popup surface. |
| `Combobox.List` | `list` | `<div role="listbox">`. |
| `Combobox.Item` | `item` | `<div role="option">`; `value` is its key. |
| `Combobox.ItemText` | `item-text` | `<span>` holding the option's name. |
| `Combobox.ItemIndicator` | `item-indicator` | `<span aria-hidden="true">`; the check, drawn by the theme. |
| `Combobox.Group` / `Separator` | `section`, `section-label` / `separator` | A group of options with its label / a decorative divider. |
| `Combobox.Empty` | `empty` | `<div>` shown while no option is listed. |
| `Combobox.LoadMore` | `load-more` | `<div aria-hidden="true">`, the scroll sentinel after the last item. |
| `Combobox.Items` | none | Data mode: renders every group and item of `items`. |

State is on the parts: `data-state` (`open` | `closed`) on the control, positioner and popup; the input and trigger follow `aria-expanded`. The input has `data-focus` and `data-focus-visible`. The control carries `data-disabled`, `data-readonly`, `data-invalid` and `data-empty-value` while nothing is selected. The popup carries `data-empty`, `data-loading`, `data-side` and `data-align`. An option has `data-highlighted`, `data-selected`, `data-disabled`, `data-focus-visible` and `data-state` (`checked` | `unchecked`).

## Text and selection

The input holds text; the value is a separate thing (a key, or `null`). While the user types, the text changes and the value does not. The value is settled when the popup closes (Enter, Tab with `selectOnTab`, a press outside, blur):

- **The text matches an option exactly** : that option is selected and the text shows its label.
- **The text is empty**: the value is cleared.
- **The text matches nothing and `allowCustomValue` is set**: the text stays and the value is the text.
- **Otherwise**: the text reverts to the label of the selected option, or to empty when none is selected.

Pressing an option selects it and closes the popup. Escape closes the popup and settles the text by the same rules. While the popup is closed, Escape reverts edited text; with nothing to revert it is left to the page, so a dialog around the Combobox can close.

`onValueChange(value, { reason })` and `onInputValueChange(text, { reason })` run once per user action. `value`, `inputValue` and `open` each have a `default…` form and follow the usual controlled and uncontrolled rules. A parent that does not accept a proposed text leaves the input showing the parent's text.

## Custom values

With `allowCustomValue` the user may commit text that is not an option. The value then is that text. Use it for tag-like or address-like inputs where the list is a suggestion, not a limit. Without it, free text never survives the close.

## Filtering

By default the list is narrowed to the options whose label contains the text. The match ignores case. `autoHighlight` highlights the first match as the user types, so Enter picks it. `autoComplete="both"` also completes the text inline and selects the completed part, so the next key replaces it.

Pass `filter` to change the matcher. Pass `filter={null}` to turn filtering off: the list shows exactly the items you give it. Use that when the options are already narrowed, for example by a server.

## Async lists

Fetch as the text changes, give the result as `items` (or `collection`), turn the built-in filter off, and name the query the items answer with `itemsQuery`. Items for another query are stale and are not announced or highlighted.

```tsx
const [query, setQuery] = useState("")
const { data, isLoading } = useCities(query)

<Combobox.Root
  items={data ?? []}
  filter={null}
  itemsQuery={query}
  loading={isLoading ? "loading" : "idle"}
  onInputValueChange={setQuery}
>
  {/* parts as above */}
</Combobox.Root>
```

`loading` is `"idle"`, `"loading"` or `"loading-more"`. For infinite scroll set `onLoadMore` and render `Combobox.LoadMore` after the last item.

## Forms

Give the Root `name` and the selected key (or keys) is submitted; the visible text is not. `inputName` submits the text under another name too. `required`, `disabled`, `readOnly`, `invalid` and `form` work as on a native control, a form reset restores the initial value and text, and inside a Field the Label, description and error message are wired to the input.

## Keyboard

| Key | Behaviour |
|---|---|
| Characters | Type into the input and filter the list; the popup opens. |
| Arrow Down / Up | Opens the popup if closed; otherwise moves the highlight. `loop` wraps at the ends. |
| Home / End | Move the caret in the input (they do not move the highlight). |
| Enter | Selects the highlighted option; with none highlighted, settles the text as above. |
| Escape | Closes the popup and settles the text; while closed, reverts edited text. |
| Tab | Moves focus on; with `selectOnTab`, first selects the highlighted option. |

Disabled options are skipped. IME composition is respected: keys that belong to the composition do not move or select.

## Opening

The popup opens on typing and on Arrow Down or Up. `openOnFocus` opens it when the input gets focus; `openOnInputPress` opens it on a press on the input; the Trigger always toggles it. A click on the Label focuses the input and never opens the popup.

## Empty and loading

Render `Combobox.Empty` inside the Popup: it shows while no option is listed and the status is `idle`. While `loading` is not `idle` the popup carries `data-loading`, and Empty stays hidden. The count of results and the empty state are announced politely; the texts come from `messages`.

## Accessibility notes

- **Roles.** `combobox` on the input, with `aria-expanded`, `aria-controls` and `aria-activedescendant`; `listbox` with `option` children in the popup; groups are `group` named by their label.
- **Focus.** DOM focus stays on the input. The highlight is virtual, so the popup, the Trigger and the Clear button never take focus by arrow keys; the two buttons are out of the tab order and reachable by pointer and touch.
- **Announcements.** Result counts, the empty state and a selection are announced through a live region; the highlighted option is announced by the browser from `aria-activedescendant`.
- **Portal trade-off.** The Positioner renders in place by default, so the popup follows the input in reading order. Where the browser has the Popover API it is shown in the top layer, so no sibling, `z-index` or `overflow` on the page covers or clips it. If you portal it (to escape a clipping ancestor), a touch screen reader's swipe order reaches the popup only after the rest of the page, so the options are far from the input. Portal only when a clipping ancestor leaves no other choice.
- **Target size.** The Trigger, the Clear button and the options are at least 24 by 24 CSS pixels in the theme.

## Styling

Style the `data-*` attributes above. The highlight and the selection are separate: `data-highlighted` is the cursor, `data-state="checked"` the selection. The theme gives the selected option a background, a heavier weight and the check in `ItemIndicator`, so it never relies on colour alone, and under forced colors the highlighted option gets an outline and the selected option a visible check. The Control takes `data-variant` (`outline`, `soft`, `ghost`) and `data-size` (`sm`, `md`, `lg`); the Popup and the Items take them too. Size the popup with `--rind-anchor-width` (the Control's width), `--rind-available-width` and `--rind-available-height`, which positioning writes.

## Testing

`getCombobox(screen, { name })` locates the combobox by role and accessible name. Actions: `type`, `compose` (an IME session), `open`, `close`, `choose`, `clear`, `pressEnter`, `pressEscape`, `tabOut`. Queries: `inputValue`, `isOpen`, `isEmpty`, `items`, `highlighted`, `value`.

```tsx
import { getCombobox } from "@rind-ui/testing"

render(<CityPicker />)
const city = getCombobox(screen, { name: "City" })
await city.type("par")
expect(await city.items()).toEqual(["Paris"])
await city.choose("Paris")
expect(await city.value()).toEqual(["Paris"])
expect(await city.inputValue()).toBe("Paris")
```

To test the machine without a DOM, `testMachine(comboboxMachine, props)` from `@rind-ui/testing` walks the state graph against the contract's oracle.

## Tested with

<!-- tested-with:combobox -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
