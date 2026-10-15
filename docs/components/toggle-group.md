# Toggle Group

A set of [Toggles](toggle.md) that share one roving tab stop and one value. Each Item is a real `<button aria-pressed>`; the group is a `role="group"` named by you. `selectionMode` is `single` (pressing an item replaces the selection, the default) or `multiple`. The value is always a `string[]`.

```tsx
import { ToggleGroup } from "@rind-ui/react"

<ToggleGroup.Root aria-label="Format" selectionMode="multiple" defaultValue={["bold"]} onValueChange={(value) => save(value)}>
  <ToggleGroup.Item value="bold">Bold</ToggleGroup.Item>
  <ToggleGroup.Item value="italic">Italic</ToggleGroup.Item>
  <ToggleGroup.Item value="underline" disabled>Underline</ToggleGroup.Item>
</ToggleGroup.Root>
```

## API

<!-- api:toggle-group -->

## Anatomy

| Part | `data-part` | Element |
|---|---|---|
| `ToggleGroup.Root` | `root` | `<div role="group">`; `data-orientation`, `data-selection-mode`, `data-focus`, `data-disabled`. Name it with `aria-label` or `aria-labelledby` (a development warning logs a nameless group). |
| `ToggleGroup.Item` | `item` | `<button aria-pressed>` (or what `render` gives it); `data-key`, `data-state` (`on` or `off`), `data-highlighted` while it is the roving focus target, and the button-like `data-disabled`, `data-focus`, `data-focus-visible`, `data-pressed` (a press in progress, not "on") and `data-hover`. |

## Keyboard

| Key | Action |
|---|---|
| Tab / Shift+Tab | The group is one tab stop: the first pressed item, else the first enabled one. |
| Arrow Right / Left | Moves focus to the next / previous enabled item (wraps unless `loop={false}`); mirrored in RTL. **Never presses.** |
| Arrow Down / Up | Same as Right / Left in a vertical group. |
| Home / End | Moves focus to the first / last enabled item. |
| Space / Enter | Presses the focused item. |

A vertical group accepts both pairs of arrows (as Tabs do). Disabled items are skipped; with `focusableWhenDisabled` they take focus but do not press.

## Why toggle buttons and not radios

Radix's single mode gave items `role="radio"`, which announces "1 of N" but breaks when the selection can be empty (radix#2254) and cannot express multiple. Here every item is a toggle button in both modes, with `aria-pressed` always `"true"` or `"false"`, and focus never changes the value. Consequence: single mode does **not** convey exclusivity to a screen reader. If the choice must read as "one of N", use a [Segmented Control](radio-group.md#radio-group-segmented-control-or-toggle-group) or a Radio Group.

## Toggle Group, Segmented Control, Radio Group or Tabs

- **Toggle Group**: independent or at-most-one pressed buttons, usually a formatting toolbar. Arrows move focus only; the empty selection is valid unless `disallowEmptySelection`.
- **Segmented Control**: exactly one choice drawn as a joined strip; arrows select. Use it for a view or option switch.
- **Radio Group**: one choice as a form value; arrows check.
- **Tabs**: one choice that shows a panel.

## Migrating from Radix

`type="multiple"` maps to `selectionMode="multiple"`. `type="single"` with a string value maps to `selectionMode="single"` with a one-element array (`value={["bold"]}`, `onValueChange` receives `[]` for none, never `""`). A single-mode group where exactly one option must always be chosen and announced as such is a Segmented Control, not a Toggle Group.

## Styling

Style the `data-*` attributes above, or import `@rind-ui/theme/toggle-group.css`: structural only (a row, or a column for `data-orientation="vertical"`; adjacent items share one border; the pressed cue is an inset outline and a background, never colour alone; items of at least `--rind-hit-area`; forced-colors mapping; tier-3 `--rind-toggle-group-*` tokens). The focus ring comes from `base.css`.

## Testing

Contract actions: `toggle(name)` (pointer and touch press the item; keyboard arrows to it, then Space), `press(name)`, `focusItem(name)`, `arrowNext()`, `leave()` (focuses a button named "After"). Queries: `items`, `pressed`, `focusedItem`, `isDisabled`.

```tsx
import { getToggleGroup } from "@rind-ui/testing"

render(<Formatting />)
const group = getToggleGroup(screen, { name: "Format" })
await group.toggle("Italic")
expect(await group.pressed()).toEqual(["Italic"])
await group.via("keyboard").toggle("Underline")
await group.focusItem("Bold")
expect(await group.pressed()).toEqual(["Italic", "Underline"]) // focus alone never presses
```

The same test runs with a Playwright `page`.

## Accessibility tree

<!-- aria:components-togglegroup--single -->
```yaml
- group "Format":
  - button "Bold"
  - button "Italic" [pressed]
  - button "Underline"
- button "After"
```
<!-- /aria -->

## Tested with

<!-- tested-with:toggle-group -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
