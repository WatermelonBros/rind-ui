# Select

A button that opens a list of options and shows the chosen one. Single or multiple selection, sections, descriptions, typeahead on the closed trigger, and form submission. The trigger is a `combobox` named by the label; the popup is a `listbox` built from the same parts as the [Listbox](listbox.md), positioned against the trigger and modal by default (the page behind is inert and does not scroll).

## When to use

- **Use it for** picking one option (or several, with `multiple`) from a list too long to show inline, in a form or a settings panel.
- **Over a native `<select>`**: the same keyboard and form behaviour, plus options with descriptions and sections, custom value text, positioning against the trigger, and `data-*` state attributes you can style. A native `<select>` is enough when you need no styling or rich options.
- **Don't use it for** a list that stays visible: use a [Listbox](listbox.md). Don't use it when the user types to filter or enter free text: use a [Combobox](combobox.md). For two or three options, a [Radio Group](radio-group.md) shows them all at once.

```tsx
import { Select } from "@rind-ui/react"

const fruit = [
  { key: "apple", label: "Apple" },
  { key: "banana", label: "Banana" },
  { key: "cherry", label: "Cherry" },
]

<Select.Root items={fruit} name="fruit" placeholder="Pick a fruit" defaultValue="banana">
  <Select.Label>Fruit</Select.Label>
  <Select.Trigger>
    <Select.ValueText />
    <Select.Indicator>▾</Select.Indicator>
  </Select.Trigger>
  <Select.Portal>
    <Select.Positioner>
      <Select.Content>
        <Select.List>
          <Select.Item value="apple">
            <Select.ItemText>Apple</Select.ItemText>
            <Select.ItemIndicator>✓</Select.ItemIndicator>
          </Select.Item>
          <Select.Item value="banana">
            <Select.ItemText>Banana</Select.ItemText>
            <Select.ItemIndicator>✓</Select.ItemIndicator>
          </Select.Item>
          <Select.Item value="cherry">
            <Select.ItemText>Cherry</Select.ItemText>
            <Select.ItemIndicator>✓</Select.ItemIndicator>
          </Select.Item>
        </Select.List>
      </Select.Content>
    </Select.Positioner>
  </Select.Portal>
</Select.Root>
```

Parts render when the select first opens and unmount after their exit animation; `keepMounted` keeps them in the document, hidden.

## API

<!-- api:select -->

## Anatomy

| Part | `data-part` | Element |
|---|---|---|
| `Select.Root` | none | Renders no element: it owns the state, the layer and the hidden form input. |
| `Select.Label` | `label` | `<span>` naming the trigger and the list. |
| `Select.Trigger` | `trigger` | `<button role="combobox">`; the only tab stop while closed. |
| `Select.ValueText` | `value-text` | `<span>` showing the selected texts, else the placeholder. |
| `Select.Indicator` | `indicator` | `<span aria-hidden="true">`, usually a chevron. |
| `Select.Description` | `description` | `<span>` referenced from the trigger's `aria-describedby`. |
| `Select.Portal` / `Positioner` / `Content` | `positioner`, `content` | The popup, placed against the trigger. |
| `Select.List` | `list` | `<div role="listbox">` inside the content. |
| `Select.Item`, `ItemText`, `ItemIndicator`, `ItemDescription` | `item`, `item-text`, `item-indicator`, `item-description` | The options, as in the Listbox. |
| `Select.Section`, `SectionLabel`, `Separator`, `Empty` | `section`, `section-label`, `separator`, `empty` | Groups, their labels, a divider and the empty message. |

## Naming

Render a `Select.Label`: the trigger takes its name from it (`aria-labelledby`) and so does the list. The trigger is never named by its value, so `getByRole("combobox", { name: "Fruit" })` finds it whatever is selected. A press on the label focuses the trigger and does not open the popup.

Without a visible label, pass `aria-label` or `aria-labelledby` to `Select.Trigger`; the list copies it. Development builds warn when the trigger has no name. Put help text in `Select.Description`.

## Value text

`Select.ValueText` shows the text of the selected option, or the `placeholder` when nothing is selected (the trigger and the value text then carry `data-placeholder`). With `multiple`, the texts are joined as a list in the user's language ("Apple, Pear, and Plum").

A closed select mounts no option, so it cannot read an option's text. Pass `items` (`{ key, label, disabled?, section? }`) to the Root so the value text for a `defaultValue` or `value` is right on first render, and so typeahead on the closed trigger can find a match before the first open. Without `items`, the value text stays empty until the popup has opened once.

To show more than text, give `ValueText` a function child, called with the selected keys:

```tsx
<Select.Root items={colors}>
  <Select.Trigger>
    <Select.ValueText>{(keys) => <Swatch color={keys[0]} />}</Select.ValueText>
  </Select.Trigger>
  {/* popup */}
</Select.Root>
```

## Selection and multiple

`value` / `defaultValue` / `onValueChange(value, { reason })`. Single: a key or `null`; choosing an option selects it and closes the popup. `reason` is `"select"`, `"typeahead"`, `"reset"` or `"autofill"`.

With `multiple`, the value is an array of keys and a choice toggles the option while the popup stays open; Escape or an outside press closes it.

```tsx
<Select.Root multiple items={tags} name="tags" placeholder="Tags">
  {/* same parts */}
</Select.Root>
```

## Keyboard

| Key | Behaviour |
|---|---|
| Enter / Space / ArrowDown | On the trigger: opens on the selected option, else the first. |
| ArrowUp | On the trigger: opens on the selected option, else the last. |
| Characters | Closed (single): selects the matching option without opening. Open: highlights it. |
| Arrow keys / Home / End / Page Up / Page Down | Move the highlight. `loop` wraps at the ends. |
| Enter / Space | Selects the highlighted option. |
| Escape | Closes without changing the value; focus returns to the trigger. |
| Tab | Closes without choosing; focus moves on from the trigger. |

Opening by pointer or touch happens on release, so a touch scroll never opens it.

## Forms and autofill

Give the Root a `name` and the select submits like a native control: a single select submits its key (empty with no selection), a multiple select submits one entry per selected key. `required`, `disabled`, `form`, `readOnly` and `invalid` behave as on a native field, a form reset restores `defaultValue`, and inside a `Field` the trigger takes the Field's description and error ids.

`required` is checked by the browser's own validation on the hidden input; a failing submit scrolls and focuses the trigger.

**Autofill.** `autoComplete` is put on a hidden `<input>` that the browser and password managers can fill. When they write text into it, the select matches it against the option keys and then the option texts, and selects the match (`reason: "autofill"`, and `data-autofill` on the trigger until the next change). Text that matches nothing is ignored.

### Why there is no hidden `<select>`

A hidden native `<select>` would need every `<option>` mounted or rendered from data on each change, duplicates every option's text in the document (a test for the text finds two), and gives the label a second control to point at. The Select keeps one hidden `<input>` instead: no duplicated text, no extra labelled control, and nothing to keep in sync for a long list. The cost is that autofill relies on matching written text, as described above.

## Modal and non-modal

`modal` (the default) makes the page behind inert and locks its scroll while open; an outside press only closes the select. `modal={false}` leaves the page interactive: a press or focus moving outside still closes it, and the press goes through.

## Controlled use and reasons

`open` / `defaultOpen` / `onOpenChange(open, details)`. `details.reason` is `trigger`, `trigger-key` or `api` when opening, and `trigger`, `item-select`, `escape-key`, `tab-key`, `outside-press`, `outside-focus`, `window-blur`, `parent-dismissed` or `api` when closing. `actionsRef` gives `open()` and `close()`. After closing, the content carries `data-close-reason` until the next open.

## Positioning

`positioning` takes the shared options (side, align, offsets, flip, shift, size). The default is bottom-start. The content is at least as wide as the trigger (`--rind-anchor-width`) and as tall as the space available (`--rind-available-height`), then scrolls. The positioner receives `data-side`, `data-align`, `data-anchor-hidden` and `data-placing`. The popup does not align the selected option over the trigger.

## Native select on mobile

On a phone, the operating system's own picker is often the better control. Render a native `<select>` there and the headless one elsewhere; both can submit the same field:

```tsx
function FruitSelect() {
  const coarse = useMediaQuery("(pointer: coarse)")
  if (coarse) {
    return (
      <label>
        Fruit
        <select name="fruit" defaultValue="banana">
          {fruit.map((f) => (
            <option key={f.key} value={f.key}>{f.label}</option>
          ))}
        </select>
      </label>
    )
  }
  return (
    <Select.Root items={fruit} name="fruit" defaultValue="banana">
      {/* parts */}
    </Select.Root>
  )
}
```

`useMediaQuery` is your own hook over `matchMedia`. Keep `name` and the option keys identical so the server sees the same values.

## Accessibility notes

- **Roles.** The trigger is a `combobox` (`aria-expanded`, `aria-controls` only while the list is mounted); the popup is a `listbox` of `option`s, with `group` for sections.
- **Focus.** Focus moves into the list when it opens, on the selected option (centred in view), and returns to the trigger on close, except after Tab or when the window loses focus.
- **Selection.** Options carry `aria-selected` explicitly. A closed-trigger typeahead changes the value text, which a screen reader reads on the focused combobox.
- **Disabled.** A disabled trigger is not focusable unless `focusableWhenDisabled`.

## Styling

Style the `data-*` attributes above: `[data-state="open"]`, `[data-placeholder]`, `[data-invalid]`, `[data-disabled]` and `[data-focus-visible]` on the trigger; `[data-highlighted]`, `[data-selected]` and `[data-disabled]` on items. The theme stylesheet `@rind-ui/theme/select.css` reads `--rind-select-*` tokens, and the item tokens fall back to the Listbox's `--rind-listbox-item-*`.

## Testing

`getSelect(screen, { name })` locates the select by its trigger's role and accessible name. Actions: `open`, `close`, `choose(name)` (opens if needed), `typeahead`, `pressEscape`, `pressOutside`, `tabOut`. Queries: `isOpen`, `valueText`, `hasPlaceholder`, `formValue`, `options`, `selected`, `highlighted`, `closeReason`.

```tsx
import { getSelect } from "@rind-ui/testing"

render(<FruitSelect />)
const fruit = getSelect(screen, { name: "Fruit" })
await fruit.choose("Cherry")
expect(await fruit.valueText()).toBe("Cherry")
expect(await fruit.formValue()).toBe("cherry")
expect(await fruit.isOpen()).toBe(false)
```

`open()` waits for the open state, the first placement and focus inside, in that order. To test the machine without a DOM, `testMachine(selectContract, props)` from `@rind-ui/testing` walks the state graph against the contract's oracle.

## Tested with

<!-- tested-with:select -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
