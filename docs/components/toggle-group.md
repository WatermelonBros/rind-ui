# Toggle Group

A toggle button, alone or in a set. Inside `ToggleGroup.Root`, the items share one roving tab stop and one value. Outside any Root, a lone `ToggleGroup.Item` is the single toggle: a two-state button that says whether it is on with `aria-pressed`, with its own `pressed` state. Each Item is a real `<button aria-pressed>`; the group is a `role="group"` named by you. `selectionMode` is `single` (pressing an item replaces the selection, the default) or `multiple`. The value is always a `string[]`.

## When to use

- **Use it for** a button that stays pressed and changes something now (Bold, Mute, Pin), alone; or a set of related buttons that stay pressed, such as bold, italic and underline, or a view mode where nothing, one or several may be on.
- **Over a few separate `<button aria-pressed>` elements**: alone, it keeps `aria-pressed` always explicit, warns in development when the accessible name changes with the state, and gives the indicator and `data-state` as styleable parts. In a Root it adds one shared value, a single roving tab stop with arrow, Home and End keys, single or multiple selection, and the group role. Arrows move focus without pressing.
- **Don't use it for** exactly one choice drawn as a strip, where arrows select: use a [Segmented Control](segmented-control.md). Don't use it for a choice submitted with a form: use a [Checkbox Group](checkbox-group.md) or a [Radio Group](radio-group.md). For an on/off setting read as "on"/"off", use a [Switch](switch.md); to switch panels, use [Tabs](tabs.md).

## Two shapes

- **Alone.** `ToggleGroup.Item` outside any Root is the single toggle: its own `pressed` / `defaultPressed` / `onPressedChange`, no `value`, no group wrapper and no roving.
- **In a Root.** Inside `ToggleGroup.Root` an Item belongs to the group: its `value` is its key in the group's value.

```tsx
import { ToggleGroup } from "@rind-ui/react"

// Alone
<ToggleGroup.Item defaultPressed onPressedChange={(pressed) => save(pressed)}>
  Bold
</ToggleGroup.Item>

// In a Root
<ToggleGroup.Root aria-label="Format" selectionMode="multiple" defaultValue={["bold"]} onValueChange={(value) => save(value)}>
  <ToggleGroup.Item value="bold">Bold</ToggleGroup.Item>
  <ToggleGroup.Item value="italic">Italic</ToggleGroup.Item>
  <ToggleGroup.Item value="underline" disabled>Underline</ToggleGroup.Item>
</ToggleGroup.Root>
```

## API

<!-- api:toggle-group -->

## API of a lone Item

Alone, an Item takes the props below instead of `value`.

<!-- api:toggle -->

## Anatomy

| Part | `data-part` | Element |
|---|---|---|
| `ToggleGroup.Root` | `root` | `<div role="group">`; `data-orientation`, `data-selection-mode`, `data-focus`, `data-disabled`. Name it with `aria-label` or `aria-labelledby` (a development warning logs a nameless group). |
| `ToggleGroup.Item` | `item` in a Root, `root` alone | `<button aria-pressed>` (or what `render` gives it); `data-key`, `data-state` (`on` or `off`), `data-highlighted` while it is the roving focus target (in a Root), and the button-like `data-disabled`, `data-focus`, `data-focus-visible`, `data-pressed` (a press in progress, not "on") and `data-hover`. |
| `ToggleGroup.ItemIndicator` | `indicator` | `<span aria-hidden>`; renders its children while on and `fallback` while off. |

## Keyboard

| Key | Action |
|---|---|
| Tab / Shift+Tab | The group is one tab stop: the first pressed item, else the first enabled one. |
| Arrow Right / Left | Moves focus to the next / previous enabled item (wraps unless `loop={false}`); mirrored in RTL. **Never presses.** |
| Arrow Down / Up | Same as Right / Left in a vertical group. |
| Home / End | Moves focus to the first / last enabled item. |
| Space / Enter | Presses the focused item. |

A vertical group accepts both pairs of arrows (as Tabs do). Disabled items are skipped; with `focusableWhenDisabled` they take focus but do not press.

A lone Item is one button in the Tab order: Enter and Space both toggle it, as for every button (a checkbox only answers to Space). Disabled, it does nothing; with `focusableWhenDisabled` it stays in the Tab order.

## The label must not change

The accessible name of a lone Item stays the same in both states; `aria-pressed` conveys the state (APG Button). An Item labelled "Mute" that becomes "Unmute" is announced as "Unmute, pressed", which reads as the opposite. In development a name that changes with the state logs a warning. For an icon-only Item, swap the icon, not the name:

```tsx
<ToggleGroup.Item aria-label="Mute">
  <ToggleGroup.ItemIndicator fallback={<SpeakerIcon />}>
    <SpeakerOffIcon />
  </ToggleGroup.ItemIndicator>
</ToggleGroup.Item>
```

The indicator is `aria-hidden` and renders its children while on, `fallback` while off.

## Why toggle buttons and not radios

Items are never `role="radio"`: a radio announces "1 of N" but breaks when the selection can be empty and cannot express multiple. Every item is a toggle button in both modes, with `aria-pressed` always `"true"` or `"false"`, and focus never changes the value. Consequence: single mode does **not** convey exclusivity to a screen reader. If the choice must read as "one of N", use a [Segmented Control](radio-group.md#radio-group-segmented-control-or-toggle-group) or a Radio Group.

## Toggle Group, Switch, Checkbox Group, Segmented Control, Radio Group or Tabs

- **Toggle Group (alone)**: a button whose pressed state changes something now (formatting, mute). Enter and Space.
- **Switch**: an on/off setting, like a light switch, read as "on"/"off"; Space.
- **Checkbox Group**: a choice that is submitted with a form or selected among others; Space. If it would be submitted with a form, it is not a toggle.
- **Toggle Group (in a Root)**: independent or at-most-one pressed buttons, usually a formatting toolbar. Arrows move focus only; the empty selection is valid unless `disallowEmptySelection`.
- **Segmented Control**: exactly one choice drawn as a joined strip; arrows select. Use it for a view or option switch.
- **Radio Group**: one choice as a form value; arrows check.
- **Tabs**: one choice that shows a panel.

## Coming from Base UI

Base UI's `data-pressed` means "on". Here `data-state` is `on` or `off`, and `data-pressed` is a press in progress (as on every button), so map `[data-pressed]` styles to `[data-state="on"]`.

## Migrating from Radix

`type="multiple"` maps to `selectionMode="multiple"`. `type="single"` with a string value maps to `selectionMode="single"` with a one-element array (`value={["bold"]}`, `onValueChange` receives `[]` for none, never `""`). A single-mode group where exactly one option must always be chosen and announced as such is a Segmented Control, not a Toggle Group.

## Styling

Style the `data-*` attributes above, or import `@rind-ui/theme/toggle-group.css` (a group) and `@rind-ui/theme/toggle.css` (a lone Item). The lone Item sheet is structural only: on is an inner outline plus a background token, so it never relies on colour alone; forced colors map on to `Highlight` and disabled to `GrayText`; the target is at least 24 by 24 px. The group sheet is structural only (a row, or a column for `data-orientation="vertical"`; adjacent items share one border; the pressed cue is an inset outline and a background, never colour alone; items of at least `--rind-hit-area`; forced-colors mapping; tier-3 `--rind-toggle-group-*` tokens). The focus ring comes from `base.css`.

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

A lone Item is driven by `getToggle`:

```tsx
import { getToggle } from "@rind-ui/testing"

render(<ToggleGroup.Item>Bold</ToggleGroup.Item>)
const bold = getToggle(screen, { name: "Bold" })
await bold.setPressed(true)
await bold.isPressed() // true
await bold.via("keyboard").activateWithEnter(false)
```

The same tests run with a Playwright `page`.

## Accessibility tree

A group, then a lone Item off and on:

<!-- aria:toggle-group--single -->
```yaml
- group "Format":
  - button "Bold"
  - button "Italic" [pressed]
  - button "Underline"
- button "After"
```
<!-- /aria -->

<!-- aria:toggle-group--alone-default -->
```yaml
- button "Bold"
```
<!-- /aria -->

<!-- aria:toggle-group--alone-on -->
```yaml
- button "Bold" [pressed]
```
<!-- /aria -->

## Tested with

<!-- tested-with:toggle-group -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
