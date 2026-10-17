# Segmented Control

One choice out of a joined strip of segments. It is a radio group under its own scope: the root is a `role="radiogroup"`, each segment a real `<button role="radio">` with an explicit `aria-checked`, and one hidden `<input type="radio">` per segment submits the value with a form. The value is the selected segment's key (`string | null`).

## When to use

- **Use it for** exactly one choice out of a few short options drawn as a joined strip, usually to switch a view or a mode.
- **Over native `<input type="radio">`**: it gives you the strip look, an indicator you can animate with CSS variables, radio semantics ("radio button, 2 of 3, checked"), and arrow keys that move focus and select. A hidden input per segment submits the value with a form.
- **Don't use it for** independent pressed buttons: use [Toggle Group](toggle-group.md). Don't use it for choices that show a panel: use [Tabs](tabs.md).
- **Don't use it for** longer options that need a description each: use [Radio Group](radio-group.md).

```tsx
import { SegmentedControl } from "@rind-ui/react"

<SegmentedControl.Root aria-label="Range" name="range" defaultValue="week" onValueChange={(v) => save(v)}>
  <SegmentedControl.Item value="day">Day</SegmentedControl.Item>
  <SegmentedControl.Item value="week">Week</SegmentedControl.Item>
  <SegmentedControl.Item value="month" disabled>Month</SegmentedControl.Item>
  <SegmentedControl.Indicator />
</SegmentedControl.Root>
```

An icon-only segment needs `aria-label` (a development warning logs a nameless one).

## API

<!-- api:segmented-control -->

## Anatomy

| Part | `data-part` | Element |
|---|---|---|
| `SegmentedControl.Root` | `root` | `<div role="radiogroup">`; `data-orientation`, `data-disabled`, `data-readonly`, `data-required`, `data-invalid`. Name it with `SegmentedControl.Label`, `aria-label` or `aria-labelledby`. |
| `SegmentedControl.Label` | `label` | Optional `<span>` inside the root that names it (`aria-labelledby`). Not a `<label>`: a radiogroup is not labelable. |
| `SegmentedControl.Item` | `item` | `<button role="radio">`, the segment; `data-key`, `data-orientation`, `data-state` (`checked` or `unchecked`), `data-highlighted` while it is the roving focus target, and the button-like `data-disabled`, `data-focus`, `data-focus-visible`, `data-pressed` and `data-hover`. Its hidden input is its sibling, never inside the button. |
| `SegmentedControl.Indicator` | `indicator` | Optional `<span aria-hidden>` inside the root; `data-state` (`visible` or `hidden`), `data-resizing`. |

## Keyboard

| Key | Action |
|---|---|
| Tab / Shift+Tab | The control is one tab stop: the selected segment, else the first enabled one. |
| Arrow Right / Down | Moves to the next enabled segment and selects it (wraps); mirrored in RTL. |
| Arrow Left / Up | Moves to the previous enabled segment and selects it (wraps). |
| Space | Selects the focused segment. |
| Enter | Submits the owning form; never selects. |

## Why radio semantics

A segmented control is "exactly one of these", which is a radio group drawn as a strip. A screen reader announces "radio button, 2 of 3, checked" and the arrow keys behave as every user of native radios expects: moving selects. Focus alone never selects (a virtual cursor, a script or Tab landing on a segment changes nothing). The scope is `segmented-control`, never `radio-group` (ark#2629), so a stylesheet for one never leaks into the other.

## Segmented Control, Toggle Group, Tabs or Radio Group

- **Segmented Control**: exactly one choice, drawn as a joined strip, no panels; arrows select; submits with a form.
- **Toggle Group**: independent (or at-most-one) pressed buttons, `aria-pressed`; arrows only move focus.
- **Tabs**: one choice that shows a panel; a navigation between views of the same page.
- **Radio Group**: the same semantics with room for a visible control, a label and a description per option; use it for forms with longer options.

## Indicator variables

`SegmentedControl.Indicator` exposes the selected segment's layout box relative to the control as `--rind-indicator-left`, `-right`, `-top`, `-bottom`, `-width` and `-height` (CSS pixels, ignoring transforms and scroll). The offsets are physical, also in RTL: anchor the thumb with `left: 0; top: 0` and a `translate`. It re-measures on selection, registration and resize, and carries `data-resizing` when the change came from layout rather than selection, so you can skip the transition.

```css
[data-scope="segmented-control"][data-part="indicator"] {
  position: absolute;
  left: 0;
  top: 0;
  translate: var(--rind-indicator-left) var(--rind-indicator-top);
  width: var(--rind-indicator-width);
  height: var(--rind-indicator-height);
  transition: translate 180ms, width 180ms, height 180ms;
}
[data-scope="segmented-control"][data-part="indicator"][data-resizing] { transition: none; }
```

## Migrating from Ark Segment Group

- `SegmentGroup.Item` + `ItemText` + `ItemControl` + `ItemHiddenInput` collapse into one `SegmentedControl.Item`: the text is its children, the hidden input is rendered for you.
- `SegmentGroup.Indicator` becomes `SegmentedControl.Indicator`; the CSS variables `--left`, `--top`, `--width` and `--height` are `--rind-indicator-left`, `-top`, `-width` and `-height`.
- The scope is its own (`data-scope="segmented-control"`), not `radio-group`.

## Styling

Style the `data-*` attributes above, or import `@rind-ui/theme/segmented-control.css`: structural only (a pill root; transparent segments of at least `--rind-hit-area` above the indicator; the selected segment is heavier and sits on the indicator, never colour alone; no indicator transition under `data-resizing` or reduced motion; forced-colors mapping with a Highlight border on the selected segment; tier-3 `--rind-segmented-control-*` tokens). The label is drawn above the pill. The focus ring comes from `base.css`.

## Testing

Contract actions: `select(name)` (pointer and touch press the segment; keyboard arrows to it), `press(name)`, `focusSegment(name)`, `arrowNext()`, `leave()` (focuses a button named "After"). Queries: `segments`, `selected`, `focusedSegment`, `isDisabled`, `formValue`.

```tsx
import { getSegmentedControl } from "@rind-ui/testing"

render(<Report />)
const control = getSegmentedControl(screen, { name: "Range" })
await control.select("Week")
expect(await control.selected()).toBe("Week")
expect(await control.formValue()).toEqual([["range", "week"]])
await control.focusSegment("Day")
expect(await control.selected()).toBe("Week") // focus alone never selects
```

The same test runs with a Playwright `page`.

## Accessibility tree

<!-- aria:segmented-control--default -->
```yaml
- radiogroup "Range":
  - radio "Day" [checked]
  - radio "Week"
  - radio "Month"
- button "After"
```
<!-- /aria -->

## Tested with

<!-- tested-with:segmented-control -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
