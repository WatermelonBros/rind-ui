# Toolbar

A row (or column) of controls with one roving tab stop. Tab enters the toolbar on the last control that had focus, arrows move between controls, Tab leaves. The root is `role="toolbar"` named by you; its controls keep their own roles: buttons, links, the items of a hosted [Toggle Group](toggle-group.md) or [Radio Group](radio-group.md), and any other control through `Toolbar.Item`.

## When to use

- **Use it for** a row or column of related controls that should be one stop in the Tab order, such as an editor's formatting bar.
- **Over a plain `<div>` of buttons**: it adds `role="toolbar"`, one roving tab stop that remembers the last control, arrow, Home and End keys, correct key handling around text fields, and hosting of [Toggle Group](toggle-group.md) and [Radio Group](radio-group.md) in the same arrow order. Without it, every button is its own tab stop.
- **Don't use it for** a few unrelated buttons, or for navigation: plain buttons or links in the normal Tab order are simpler. A list of commands that opens on demand is a [Menu](menu.md).

```tsx
import { RadioGroup, ToggleGroup, Toolbar } from "@rind-ui/react"

<Toolbar.Root aria-label="Formatting">
  <ToggleGroup.Root aria-label="Text style" selectionMode="multiple">
    <ToggleGroup.Item value="bold">Bold</ToggleGroup.Item>
    <ToggleGroup.Item value="italic">Italic</ToggleGroup.Item>
  </ToggleGroup.Root>
  <Toolbar.Separator />
  <RadioGroup.Root aria-label="Alignment" orientation="horizontal" defaultValue="left">
    <RadioGroup.Item value="left">
      <RadioGroup.ItemControl><RadioGroup.ItemIndicator /></RadioGroup.ItemControl>
      <RadioGroup.ItemLabel>Left</RadioGroup.ItemLabel>
    </RadioGroup.Item>
    <RadioGroup.Item value="right">
      <RadioGroup.ItemControl><RadioGroup.ItemIndicator /></RadioGroup.ItemControl>
      <RadioGroup.ItemLabel>Right</RadioGroup.ItemLabel>
    </RadioGroup.Item>
  </RadioGroup.Root>
  <Toolbar.Separator />
  <Toolbar.Link href="/help">Help</Toolbar.Link>
  <Toolbar.Item render={<input aria-label="Font size" defaultValue="12" size={4} />} />
</Toolbar.Root>
```

## API

<!-- api:toolbar -->

## Anatomy

| Part | `data-part` | Element |
|---|---|---|
| `Toolbar.Root` | `root` | `<div role="toolbar">`; `data-orientation`, `data-disabled`, `aria-orientation` only when vertical. Name it with `aria-label` or `aria-labelledby` (a development warning logs a nameless toolbar). |
| `Toolbar.Button` | `button` | A [Button](button.md); roving `tabindex`, `data-host="toolbar"`, `data-highlighted` while it is the remembered control and focus is inside, `data-disabled`, plus the button's own `data-focus`, `data-pressed`, `data-hover`. |
| `Toolbar.Link` | `link` | A [Link](link.md) with the same roving attributes. Space activates it once, without scrolling the page; Enter is native. |
| `Toolbar.Item` | `item` | A `<button>` unless `render` substitutes another element; the same roving attributes. |
| `Toolbar.Group` | `group` | `<div role="group">`; `data-disabled`. Name it with `aria-label` when the grouping should be announced. |
| `Toolbar.Separator` | `separator` | A [Separator](separator.md) perpendicular to the toolbar (vertical in a horizontal toolbar); `data-orientation`. |

Every control the toolbar owns, hosted items included, carries `data-host="toolbar"`: that is how the driver and the theme find them.

## Keyboard

| Key | Action |
|---|---|
| Tab / Shift+Tab | The toolbar is one tab stop: the control that last had focus, else the first. |
| Arrow Right / Left | Moves to the next / previous control (wraps unless `loop={false}`); mirrored in RTL. |
| Arrow Down / Up | The same in a vertical toolbar. The perpendicular arrows are never taken. |
| Home / End | Moves to the first / last control. |
| Enter / Space | Activates the focused control (its own behaviour). |

## Key ownership

The toolbar listens on its root and acts only when the key's target is one of its own controls, so keys typed in a popup or in nested content are never taken. It lets go of a key when:

- Alt, Ctrl or Meta is held, an IME composition is in progress, or something already called `preventDefault()` (a slider or number field hosted later keeps its own arrows that way);
- the target is a text field and the key is Home or End (they move the caret);
- the target is a text field and the arrow is not at the caret's edge: Shift is held, text is selected, or the caret is not yet at the start (previous) or the end (next).

Text fields are recognised by tag, `type` and `contenteditable`, never `instanceof`, so a field in a same-origin iframe behaves the same.

## Hosting Toggle Group and Radio Group

Put a `ToggleGroup.Root` or `RadioGroup.Root` directly inside the toolbar (or a `Toolbar.Group`). Nothing else to set: their items join the toolbar's single tab stop and arrow order, and their own value, `aria-pressed` and `aria-checked` are unchanged.

- Arrows only move focus. A hosted radio is never checked by arrows; Enter and Space check it.
- The toolbar's `disabled` and `focusableWhenDisabled` apply to hosted items.
- Inside a `Portal` or an overlay's content the toolbar is ignored, so a group in a popup is a standalone group again.

## Triggers through Item

`Toolbar.Item` merges the roving props onto whatever `render` gives, so any control that accepts props and a ref joins the toolbar:

```tsx
<Toolbar.Root aria-label="View">
  <Toolbar.Item render={<MyMenuTrigger />}>Font</Toolbar.Item>
  <Toolbar.Item render={<input type="checkbox" aria-label="Wrap lines" />} />
</Toolbar.Root>
```

Menu, Select, Popover and Tooltip triggers are not shipped yet; when they are, they are used this way and one activation still fires once through the nested substitution.

## Text fields

A text field as a toolbar control (`render={<input … />}`) keeps its caret keys: arrows leave it only at the edge of the text, with no selection. Put it last or in the middle, both work. A disabled text field is focusable and gets `readOnly` with `aria-disabled`, so it takes no input.

## Disabled controls

By default (`focusableWhenDisabled`) a disabled control keeps `aria-disabled="true"` and stays reachable by arrows, so a screen reader user can find it. With `focusableWhenDisabled={false}` it gets the native `disabled` attribute and arrows skip it. `disabled` on the root or a group cascades to every control inside, hosted items included.

## Editor toolbars

A button that must not steal focus from an editor passes `focusOnPress={false}`: pressing it runs the action while the selection stays in the editor.

```tsx
<Toolbar.Root aria-label="Editor tools">
  <Toolbar.Button focusOnPress={false} onClick={toggleBold}>Bold</Toolbar.Button>
</Toolbar.Root>
<div role="textbox" aria-label="Document" aria-multiline="true" contentEditable tabIndex={0} />
```

## Focusing the toolbar from a shortcut

`actionsRef.focus()` moves focus to the toolbar's current tab stop (the remembered control, else the first enabled one). The library registers no shortcut; bind your own:

```tsx
const toolbar = useRef<{ focus(): void }>(null)

useHotkey("Alt+F10", () => toolbar.current?.focus())

<Toolbar.Root aria-label="Formatting" actionsRef={toolbar}>…</Toolbar.Root>
```

## Migrating from Radix

- `Toolbar.Button`, `Toolbar.Link`, `Toolbar.Separator` map one to one; `Toolbar.ToggleGroup` / `Toolbar.ToggleItem` become a plain `ToggleGroup.Root` and `ToggleGroup.Item` inside the toolbar (`type="multiple"` is `selectionMode="multiple"`).
- A Radix `RadioGroup` in a toolbar needed `rovingFocus={false}`; here a hosted Radio Group works with nothing to set.
- `Toolbar.Button asChild` / `Slot` becomes `render`; any other control uses `Toolbar.Item render={…}`.
- `dir` on the root becomes the provider's `dir`; `loop` and `orientation` keep their names.
- Disabled buttons stay focusable by default (`focusableWhenDisabled`); pass `false` for Radix's native behaviour.

## Styling

Style the `data-*` attributes above, or import `@rind-ui/theme/toolbar.css`: structural only (a gapped, wrapping row, or a column for `data-orientation="vertical"`; groups with their own gap; separators drawn as a border, perpendicular to the toolbar and stretched across it; controls of at least `--rind-hit-area`; forced-colors mapping; tier-3 `--rind-toolbar-*` tokens: `bg`, `border`, `radius`, `padding`, `gap`, `group-gap`, `separator-color`, the last falling back to `--rind-separator-color`). Controls keep their own components' styles. The focus ring comes from `base.css`.

## Testing

Contract actions: `tabIn()` (Tab from a button named "Before"), `moveTo(name)` (arrows until it is focused), `press(name)` (pointer and touch click it; keyboard moves to it, then Enter), `tabOut()`, `focusControl(name)`, `arrowNext()`, `leave()` (focuses a button named "After"). Queries: `items`, `focusedItem`, `tabStop`, `isDisabled`, `orientation`.

```tsx
import { getToolbar } from "@rind-ui/testing"

render(<Editor />)
const toolbar = getToolbar(screen, { name: "Formatting" })
await toolbar.tabIn()
await toolbar.moveTo("Italic")
expect(await toolbar.focusedItem()).toBe("Italic")
await toolbar.tabOut()
expect(await toolbar.tabStop()).toBe("Italic") // focus memory
```

Hosted groups keep their own drivers, located by name anywhere in the document (`getToggleGroup(screen, { name: "Text style" })`). A toolbar's separators have the `toolbar` scope: `getSeparator(screen, { within: toolbarElement, host: "toolbar" })`.

`testMachine(toolbarContract, …)` runs the machine graph against your own toolbar; set `toolbarArgs.current = { label: "Bold" }` to choose the control its FOCUS steps act on.

## Accessibility tree

<!-- aria:toolbar--default -->
```yaml
- button "Before"
- toolbar "Formatting":
  - group:
    - group "Text style":
      - button "Bold"
      - button "Italic"
      - button "Underline"
  - separator
  - radiogroup "Alignment":
    - radio "Left" [checked]
    - text: Left
    - radio "Center"
    - text: Center
    - radio "Right"
    - text: Right
  - separator
  - link "Help":
    - /url: "#help"
  - textbox "Font size": "12"
- button "After"
```
<!-- /aria -->

## Tested with

<!-- tested-with:toolbar -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
