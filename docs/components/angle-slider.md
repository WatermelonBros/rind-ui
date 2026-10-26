# Angle Slider

Picks an angle from 0 to 359 degrees on a dial. A press on the round Control sets the angle and drags it. A visually hidden native range input is the one focusable, announced slider: arrows step, Shift steps further, Home and End reach the ends, and a step past an end wraps around. The angle is submitted with forms.

## When to use

- **Use it for** a direction or a rotation: a gradient's angle, a compass heading, a shadow's direction, an element's rotation.
- **Over a home-made dial**: the slider is a real `<input type="range">` (the platform's role, value and keyboard for every screen reader), the angle is announced in words ("90 degrees"), clockwise stays clockwise in right-to-left layouts, a drag from the Thumb keeps its offset instead of jumping, Escape during a drag puts back the angle from the press, and a form reset restores `defaultValue`.
- **Don't use it for** a value with real ends that does not wrap ([Slider](slider.md)), or an exact number typed from the keyboard ([Number Input](number-input.md)).

```tsx
import { AngleSlider } from "@rind-ui/react"

<AngleSlider.Root name="angle" defaultValue={90} onValueCommit={(v) => save(v)}>
  <AngleSlider.Label>Gradient angle</AngleSlider.Label>
  <AngleSlider.Control>
    <AngleSlider.MarkerGroup>
      {[0, 90, 180, 270].map((v) => (
        <AngleSlider.Marker key={v} value={v} />
      ))}
    </AngleSlider.MarkerGroup>
    <AngleSlider.Thumb>
      <AngleSlider.Input />
    </AngleSlider.Thumb>
  </AngleSlider.Control>
  <AngleSlider.Value />
</AngleSlider.Root>
```

## API

<!-- api:angle-slider -->

## Anatomy

| Part | `data-part` | Element |
|---|---|---|
| `AngleSlider.Root` | `root` | `<div>`; holds the angle; sets `--rind-angle-slider-angle` and `--rind-angle-slider-fraction`. |
| `AngleSlider.Label` | `label` | `<label>`; names the input. |
| `AngleSlider.Control` | `control` | `<div>`; the round surface: a press sets the angle around its centre and drags. |
| `AngleSlider.Thumb` | `thumb` | `<div>`; the handle, rotated by the angle; shows the input's focus. |
| `AngleSlider.Input` | `input` | `<input type="range">`, visually hidden; the one focusable, announced slider. Render it inside the Thumb or the Control. |
| `AngleSlider.Value` | `value` | `<span>`; the formatted angle and a degree sign (hidden from assistive technology). |
| `AngleSlider.MarkerGroup` | `marker-group` | `<div>`; holds the markers (hidden from assistive technology). |
| `AngleSlider.Marker` | `marker` | `<div>`; a tick at `value` degrees, placed by `--rind-angle-slider-marker-angle`; `data-state` is `under-value`, `at-value` or `over-value`. |

Every part carries `data-dragging`, `data-disabled`, `data-readonly` and `data-invalid`. The Thumb and the Input carry `data-focus-visible` while the input has keyboard focus.

## Keyboard

| Key | Action |
|---|---|
| Arrow Right, Arrow Up | One `step` clockwise. |
| Arrow Left, Arrow Down | One `step` counter-clockwise. |
| Shift + an arrow, Page Up, Page Down | One `largeStep` (default 15). |
| Home, End | 0 and the last step before 360. |
| Escape | During a drag: back to the angle at the press. Otherwise not handled, so a surrounding dialog still closes. |

Past an end the angle wraps around (`wrap`, default true). The arrows are not mirrored in right-to-left layouts: clockwise is clockwise.

## Accessibility notes

- **One slider**: only the native range input is focusable and announced. The Control, the Thumb's drawing, the Value and the markers are presentation.
- **The angle in words**: `aria-valuetext` reads "90 degrees". Change it through `messages.valueText`.
- **Focus follows the pointer**: a press on the Control focuses the input, so the keyboard continues from where the pointer left off. The focus ring shows only for keyboard focus.
- **Read-only** keeps the input focusable and submitted, marked `aria-readonly`; the angle does not change. **Disabled** takes the input out of the tab order and the form.
- **Forms**: the input has the `name` and submits the angle; a form reset restores `defaultValue`.

## Testing

```tsx
import { getAngleSlider } from "@rind-ui/testing"

render(<GradientEditor />)
const angle = getAngleSlider(screen, { label: "Gradient angle" })
await angle.step(5)
await angle.toEdge("max")
expect(await angle.value()).toBe(359)
await angle.via("pointer").setAngle(180) // needs layout: a real browser
```

Contract actions: `setAngle`, `step`, `toEdge`. Queries: `value`, `valueText`, `isDragging`.

## Tested with

<!-- tested-with:angle-slider -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
