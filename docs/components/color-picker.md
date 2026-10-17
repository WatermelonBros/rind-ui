# Color Picker

A trigger and a popover (or an inline panel) holding a colour area, channel sliders, channel and hex inputs, swatches, an eye dropper and a format switch, all bound to one colour. The picker owns the colour, the display format and the open state; every part inside is the component of its own ([Color Area](color-area.md), [Color Slider](color-slider.md), [Color Field](color-field.md), [Color Swatch Picker](color-swatch-picker.md), [Color Swatch](color-swatch.md)), bound to the picker.

```tsx
import { ColorPicker } from "@rind-ui/react"

<ColorPicker.Root defaultValue="#3D8BFF" name="background">
  <ColorPicker.Label>Background</ColorPicker.Label>
  <ColorPicker.Control>
    <ColorPicker.Trigger>
      <ColorPicker.ValueSwatch />
    </ColorPicker.Trigger>
  </ColorPicker.Control>
  <ColorPicker.Portal>
    <ColorPicker.Positioner>
      <ColorPicker.Content>
        <ColorPicker.Area>
          <ColorPicker.AreaBackground />
          <ColorPicker.AreaThumb />
        </ColorPicker.Area>
        <ColorPicker.ChannelSlider channel="hue">
          <ColorPicker.ChannelSliderTrack>
            <ColorPicker.ChannelSliderThumb />
          </ColorPicker.ChannelSliderTrack>
        </ColorPicker.ChannelSlider>
        <ColorPicker.ChannelInput channel="hex" />
      </ColorPicker.Content>
    </ColorPicker.Positioner>
  </ColorPicker.Portal>
</ColorPicker.Root>
```

## API

<!-- api:color-picker -->
### Anatomy

| Part | `data-part` | Element | Description |
|---|---|---|---|
| `ColorPicker.Root` | `root` | `<div>` | A Field host: owns the colour, the format and the open state. |
| `ColorPicker.Label` | `label` | `<label>` | Names the Control, the Trigger and the content. |
| `ColorPicker.Control` | `control` | `<div>` | `role="group"`: the Popover's anchor. |
| `ColorPicker.Trigger` | `trigger` | `<button>` | Opens the content; named with the colour. |
| `ColorPicker.Portal / Positioner / Content` | `content` | `<div>` | The Popover's (inline: `role="group"`, in place). |
| `ColorPicker.Area / AreaBackground / AreaThumb` | `root` | `<div>` | A Color Area bound to the picker. |
| `ColorPicker.ChannelSlider (+ Label, ValueText, Track, Thumb)` | `root` | `<div>` | A Color Slider bound to the picker. |
| `ColorPicker.ChannelInput` | `input` | `<input>` | `hex` / `css`: a Color Field; a channel: a Color Channel Field. |
| `ColorPicker.SwatchGroup / SwatchTrigger / SwatchIndicator` | `root` | `<div>` | A Color Swatch Picker bound to the picker. |
| `ColorPicker.Swatch / ValueSwatch` | `root` | `<div>` | A Color Swatch; ValueSwatch shows the picker's colour. |
| `ColorPicker.EyeDropperTrigger` | `eye-dropper-trigger` | `<button>` | Hidden where the browser has no EyeDropper. |
| `ColorPicker.FormatSelect / FormatTrigger` | `format-select` | `<select / button>` | Set or cycle the format. |
| `ColorPicker.View` | `view` | `<div>` | Renders its children only for its `format`. |
| `ColorPicker.ValueText` | `value-text` | `<span>` | The colour in the current format. |
| `ColorPicker.HiddenInput` | `hidden-input` | `<input>` | The form value (rendered automatically). |

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `value` | `string \| Color` | — | The colour (controlled). |
| `defaultValue` | `string \| Color` | `"#000000"` | The initial colour. |
| `onValueChange` | `(color: Color, details) => void` | — | Each change, in the space of `format`. |
| `onValueCommit` | `(color: Color, details) => void` | — | Once at the end of each interaction. |
| `format` | `"hex" \| "rgb" \| "hsl" \| "hsb"` | — | Display and emission format (controlled). |
| `defaultFormat` | `format` | — | Default: from the first colour (a hex string gives `hex`). |
| `onFormatChange` | `(format) => void` | — | The format changed. |
| `open` | `boolean` | — | Open (controlled). |
| `defaultOpen` | `boolean` | `false` | Open at first. |
| `onOpenChange` | `(open, details) => void` | — | Popover reasons plus `select`. |
| `inline` | `boolean` | `false` | The content in place: no Popover, no layer, no listeners. |
| `closeOnSelect` | `boolean` | `false` | A swatch pick closes the Popover. |
| `modal` | `boolean` | `false` | As Popover. |
| `name` | `string` | — | Submits `#RRGGBB(AA)` (or `formFormat`). |
| `formFormat` | `"hex" \| "rgb" \| "hsl" \| "hsb" \| "css"` | — | The submitted text's format. |
| `disabled` | `boolean` | `false` | Disables every part and closes. |
| `readOnly` | `boolean` | `false` | Focusable, changes nothing. |
| `messages` | `Partial<ColorPickerMessages>` | — | Every string of the picker and its children. |

Every attribute of the rendered element is accepted and forwarded.

### Data attributes

| Part | Attribute | When |
|---|---|---|
| `root` | `data-scope` | "color-picker" |
| `root` | `data-part` | "root" |
| `root` | `data-instance` | The instance id. |
| `root` | `data-disabled` | Present when disabled. |
| `root` | `data-readonly` | Present when read-only. |
| `root` | `data-invalid` | Present while invalid. |
| `root` | `data-dragging` | Present while a child drags. |
| `root` | `data-inline` | Present in inline mode. |
| `root` | `data-format` | The current format. |

### Keyboard

| Key | Action |
|---|---|
| Enter / Space (Trigger) | Opens the content. |
| Escape | Closes it (after a dirty input reverts first). |

### States

| State | Description |
|---|---|
| `closed` | The content is not shown. |
| `open` | The content is shown in its Popover (an inline picker stays `closed`: its content is always shown in place). |

### Contract

| Action | Modalities |
|---|---|
| `open` | pointer, keyboard |
| `close` | keyboard |
| `pressOutside` | pointer |
| `tab` | keyboard |
| `shiftTab` | keyboard |
| `setFormat` | keyboard |
| `resetForm` | pointer, keyboard |

Queries: `color`, `format`, `valueText`, `colorName`, `isOpen`, `isInline`, `formValue`, `closeReason`, `isEyeDropperAvailable`. Traits: `form-associated`, `field-associated`.
<!-- /api -->

## Value and format

`value` and `defaultValue` accept a colour or any string `parseColor` reads. The **format** (`hex`, `rgb`, `hsl`, `hsb`) is the display and emission format: `ValueText` shows the colour in it and `onValueChange` receives colours in its space (`hex` and `rgb` emit `rgb`), whatever you passed. Changing the format calls `onFormatChange` and no `onValueChange`. The default format follows the first colour (a hex string gives `hex`).

Every change — area, slider, input, swatch, eye dropper — goes through one path: `onValueChange` once per change with `details.reason` and `details.valueAsString`, `onValueCommit` once at the end of each interaction. A `cancel()` keeps the previous colour everywhere. A parent that re-parses the emitted colour every render (a string kept in state) keeps hue and thumbs continuous (see the [Colour model](../guides/color-model.md)).

## Popover and inline

The content is a non-modal [Popover](popover.md) by default: the Trigger opens it, Escape, an outside press and outside focus close it, focus returns to the Trigger. Before it closes, every hex and channel input commits a valid pending edit, so a typed `#111111` survives an outside press. A drag that begins inside and is released outside does not close it. `closeOnSelect` closes it after a swatch pick (reason `select`).

`inline` renders the content in place, always: no popover, no layer, no focus management, no outside-press or Escape handling. The host owns those. The content is then a named `role="group"`.

## Names

The Trigger is named "Choose color, vibrant blue" and by the Label; a `ValueSwatch` inside it is decorative. The content is named by the Trigger and the Label. Every string — the trigger, the eye dropper, the format names, the children's names and value texts, the colour words — comes from `messages` and can be translated in one place.

## Eye dropper

`EyeDropperTrigger` opens the browser's eye dropper where there is one, sets the picked colour (always opaque) and announces it politely. Where the browser has none it stays hidden (server and first render alike), never a dead button. A dismissed dropper changes nothing.

## Forms

The automatic hidden input submits the canonical `#RRGGBB` (`#RRGGBBAA` with alpha) whatever the display format (`formFormat` changes it). A form reset restores `defaultValue`. Inside a [Field](field.md) the Trigger is the one control; every child is embedded and registers nothing.

## Testing

`getColorPicker` has the actions `open`, `close`, `pressOutside`, `tab`, `shiftTab`, `setFormat`, `resetForm`, the queries `color`, `format`, `valueText`, `colorName`, `isOpen`, `isInline`, `formValue`, `closeReason`, `isEyeDropperAvailable`, and its children's drivers: `area()`, `slider(channel)`, `input(channel)`, `swatches()`. `eyeDropper(result | "abort")` installs a fake eye dropper.

```tsx
import { getColorPicker } from "@rind-ui/testing"

const picker = getColorPicker(screen, { name: "Background" })
await picker.open()
await picker.input("hex").fill("3366ff")
expect(await picker.color("hex")).toBe("#3366FF")
```

## Tested with

<!-- tested-with:color-picker -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
