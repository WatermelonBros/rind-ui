# Color Wheel

Picks a colour's hue on a ring. A press on the ring sets the hue and drags it; a press in the centre does nothing. A visually hidden native range input is the one focusable, announced slider, with the Angle Slider's keys. Only the hue changes: saturation and lightness stay, and a grey keeps the hue it was given. With `name`, the colour is submitted as hex.

## When to use

- **Use it for** choosing a hue where its position on the colour circle matters: a theme's accent, a palette's base, a hue next to a [Color Area](color-picker.md) for saturation and brightness.
- **Over a home-made hue ring**: the slider is a real `<input type="range">`, the value is read as "Hue 240°, blue", a press in the empty centre is ignored, a drag keeps following the pointer once it leaves the ring, Escape during a drag puts back the hue from the press, and a form reset restores the whole default colour.
- **Don't use it for** a full colour picker on its own (combine it with a Color Area or use [Color Picker](color-picker.md)), or for a hue on a straight track (Color Slider with `channel="hue"`).

```tsx
import { ColorWheel } from "@rind-ui/react"

<ColorWheel.Root name="accent" defaultValue="#3366ff" onValueCommit={(c) => save(c)}>
  <ColorWheel.Label>Accent hue</ColorWheel.Label>
  <ColorWheel.Track>
    <ColorWheel.Thumb>
      <ColorWheel.Input />
    </ColorWheel.Thumb>
  </ColorWheel.Track>
  <ColorWheel.Value />
</ColorWheel.Root>
```

## API

<!-- api:color-wheel -->

## Anatomy

| Part | `data-part` | Element |
|---|---|---|
| `ColorWheel.Root` | `root` | `<div role="group">`; holds the colour; sets `--rind-color-wheel-angle` and `--rind-color-wheel-thumb-color`; renders the hidden form input. |
| `ColorWheel.Label` | `label` | `<label>`; names the slider. |
| `ColorWheel.Track` | `track` | `<div>`; the ring (`--rind-color-wheel-gradient`); a press on the ring sets the hue and drags. |
| `ColorWheel.Thumb` | `thumb` | `<div>`; the handle on the ring, rotated by the hue; shows the input's focus. |
| `ColorWheel.Input` | `input` | `<input type="range">`, visually hidden; the one focusable slider. Render it inside the Thumb. |
| `ColorWheel.Value` | `value` | `<span>`; the hue and a degree sign (hidden from assistive technology). |

Every part carries `data-space` (`hsl` or `hsb`), `data-dragging`, `data-disabled`, `data-readonly` and `data-invalid`. The Thumb and the Input carry `data-focus-visible` while the input has keyboard focus.

The ring's width is `--rind-color-wheel-thickness` on the Track (default `30px`): the theme draws the ring with it, and the component reads it to tell a press on the ring from one in the centre.

## Keyboard

| Key | Action |
|---|---|
| Arrow Right, Arrow Up | One `step` clockwise. |
| Arrow Left, Arrow Down | One `step` counter-clockwise. |
| Shift + an arrow, Page Up, Page Down | One `largeStep` (default 15). |
| Home, End | Hue 0 and the last step before 360. |
| Escape | During a drag: back to the hue at the press. Otherwise not handled. |

Past 359 the hue wraps to 0.

## Accessibility notes

- **One slider**: the Root is a `group` and the range input is the only focusable element; the ring, the Thumb and the Value are presentation.
- **The hue in words**: `aria-valuetext` names the channel, the angle and the hue ("Hue 240°, blue"), from Color Slider's messages. Without a Label the slider is named "Hue".
- **Focus follows the pointer**: a press on the ring focuses the input. The focus ring shows only for keyboard focus.
- **Forced colours**: the ring keeps its hues and the Thumb's outline uses system colours.
- **Forms**: a hidden input carries `name` and submits the colour as hex; a form reset restores `defaultValue`, every channel.

## Testing

```tsx
import { getColorWheel } from "@rind-ui/testing"

render(<ThemeEditor />)
const hue = getColorWheel(screen, { label: "Accent hue" })
await hue.step(30)
expect(await hue.hue()).toBe(255) // #3366ff is hue 225
await hue.via("pointer").setHue(120) // needs layout: a real browser
```

Contract actions: `setHue`, `step`, `toEdge`. Queries: `hue`, `value` (hex), `valueText`, `isDragging`.

## Tested with

<!-- tested-with:color-wheel -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
