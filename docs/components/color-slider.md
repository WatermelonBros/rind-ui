# Color Slider

One channel of a colour (hue, saturation, brightness, lightness, red, green, blue or alpha) edited with a Slider whose track is the channel's gradient. It **is** a [Slider](slider.md): every keyboard, pointer, commit, form and attribute rule of the Slider applies; this page covers the binding.

```tsx
import { ColorSlider } from "@rind-ui/react"

<ColorSlider.Root channel="hue" defaultValue="#3D8BFF">
  <ColorSlider.Track>
    <ColorSlider.Thumb />
  </ColorSlider.Track>
</ColorSlider.Root>
```

## API

<!-- api:color-slider -->
### Anatomy

| Part | `data-part` | Element | Description |
|---|---|---|---|
| `ColorSlider.Root` | `root` | `<div>` | The Slider's Root (`data-scope="slider"`); without a Control it is the pointer surface. |
| `ColorSlider.Label` | `label` | `<label>` | The visible name. |
| `ColorSlider.ValueText` | `value-text` | `<div>` | The channel's value and the colour name. Not a live region. |
| `ColorSlider.Control` | `control` | `<div>` | Optional pointer surface. |
| `ColorSlider.Track` | `track` | `<div>` | Carries the channel's gradient inline. |
| `ColorSlider.Thumb` | `thumb` | `<div>` | The handle and its native range input (role slider). |
| `ColorSlider.Description` | `description` | `<div>` | Help text. |
| `ColorSlider.TransparencyGrid` | `transparency-grid` | `<div>` | A decorative checkerboard under a gradient with transparency. |

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `channel` | `ColorChannel` | — | Required: red, green, blue, hue, saturation, lightness, brightness or alpha. |
| `value` | `string \| Color` | — | The colour (controlled). |
| `defaultValue` | `string \| Color` | `"hsb(0, 100%, 100%)"` | The initial colour (uncontrolled). |
| `onValueChange` | `(color: Color, details) => void` | — | Each applied change, in the space of the colour you passed. |
| `onValueCommit` | `(color: Color, details) => void` | — | Once at the end of each interaction that changed the colour. |
| `colorSpace` | `"rgb" \| "hsl" \| "hsb"` | — | The working space (default: the colour's when it has the channel). |
| `orientation` | `"horizontal" \| "vertical"` | `"horizontal"` | As Slider. |
| `colorName` | `string \| (color) => string` | — | Replaces the colour name in the value text. |
| `messages` | `Partial<ColorSliderMessages>` | — | Channel names, value text and colour words. |

Every attribute of the rendered element is accepted and forwarded.

### Data attributes

| Part | Attribute | When |
|---|---|---|
| `root` | `data-channel` | The channel. |
| `root` | `data-space` | The working space. |

### Keyboard

| Key | Action |
|---|---|
| ArrowLeft / ArrowRight / ArrowUp / ArrowDown | One channel step (as Slider). |
| Shift + arrow, PageUp / PageDown | The channel's page step. |
| Home / End | The channel's minimum / maximum. |

### States

| State | Description |
|---|---|
| `idle` | No pointer drag. |
| `dragging` | A pointer drag is active. |

### Contract

No actions.

Queries: `channel`, `color`, `colorName`, `gradient`. Traits: `valued`, `directional`, `form-associated`, `field-associated`.
<!-- /api -->

## Binding

The slider's value is the channel's value of the colour; its range, step and page step are the channel's. A channel the colour lacks is reached by converting (a hue slider on an `rgb` colour works, and emits `rgb`). The alpha slider keeps the colour, and every slider keeps the other channels. A hue moved at black updates the thumb and the track and emits nothing (the colour is still black).

## Appearance

The Track carries the channel's gradient inline (`background-image` and `--rind-color-slider-gradient`), running `to right`, `to left` in right-to-left, `to top` when vertical; the Thumb carries `--rind-color`, the colour at the thumb. A `TransparencyGrid` placed inside the Track shows a checkerboard through an alpha gradient. `Control` is optional: without it the Root is the pointer surface.

## Names and value text

Without a Label, the slider is named by the channel ("Hue"). The value text reads the channel and the colour: "Hue 240°, blue" (the hue's name only), "Saturation 90%, vibrant blue"; the alpha slider reads only "Alpha 50%". It is never a live region.

## Testing

`getColorSlider` is `getSlider` with the queries `channel()`, `color(format?)`, `colorName()`, `gradient()` and the action `setChannel(value)`.

```tsx
import { getColorSlider } from "@rind-ui/testing"

const hue = getColorSlider(screen, { name: "Hue" })
await hue.step(0, "increase")
expect(await hue.channel()).toBe("hue")
```

## Tested with

<!-- tested-with:color-slider -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
