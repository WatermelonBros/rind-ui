# Color Picker

A colour picker: a trigger and a popover, or an inline panel, holding the parts you choose (a colour area, channel sliders, hex and channel inputs, swatches, an eye dropper, a format switch), all bound to one colour. It is one component: the parts compose any picker, from a full panel to a single hex field or a row of swatches. The picker owns the colour, the display format and the open state.

## When to use

- **Use it for** choosing one colour from a trigger and popover (or an inline panel) that combines a colour area, sliders, channel inputs, swatches, an eye dropper and a format switch.
- **Over `<input type="color">`**: it owns the colour and display format, lets you pick which controls to show, and binds every part to one value. The native input is enough when the browser's own picker suffices.
- **For a single hex field or a fixed palette**, keep it small: an `inline` Color Picker with only a `ChannelInput channel="hex"`, or only a `SwatchGroup`, has no trigger and no popover.

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
| `ColorPicker.Area / AreaBackground / AreaThumb` | `area / area-background / area-thumb (its inputs: area-input)` | `<div>` | The colour area: two channels as a 2D surface. |
| `ColorPicker.ChannelSlider (+ Label, ValueText, Track, Thumb)` | `channel-slider (+ -label, -value-text, -control, -track, -thumb)` | `<div>` | One channel on a slider, its track painted with the channel's gradient. |
| `ColorPicker.ChannelInput` | `channel-input (its wrapper: channel-input-root)` | `<input>` | `hex` / `css`: a colour text field; a channel: a number field for it. |
| `ColorPicker.SwatchGroup / SwatchTrigger / SwatchIndicator` | `swatch-group / swatch-trigger / swatch-indicator` | `<div>` | A palette (a radio group of colours); the indicator is the one selected mark. |
| `ColorPicker.Swatch / ValueSwatch` | `swatch / value-swatch` | `<div>` | A colour chip named by its colour; ValueSwatch shows the picker's colour. |
| `ColorPicker.TransparencyGrid` | `transparency-grid` | `<div>` | A checkerboard under a colour with transparency (decorative). |
| `ColorPicker.EyeDropperTrigger` | `eye-dropper-trigger` | `<button>` | Hidden where the browser has no EyeDropper. |
| `ColorPicker.FormatSelect / FormatTrigger` | `format-select` | `<select / button>` | Set or cycle the format. |
| `ColorPicker.View` | `view` | `<div>` | Renders its children only for its `format`. |
| `ColorPicker.ValueText` | `value-text` | `<span>` | The colour in the current format. |
| `ColorPicker.HiddenInput` | `hidden-input` | `<input>` | The form value (rendered automatically). |

### Props

| Part | Prop | Type | Default | Description |
|---|---|---|---|---|
| `ColorPicker.Root` | `value` | `string \| Color` | — | The colour (controlled). |
| `ColorPicker.Root` | `defaultValue` | `string \| Color` | `"#000000"` | The initial colour. |
| `ColorPicker.Root` | `onValueChange` | `(color: Color, details) => void` | — | Each change, in the space of `format`. |
| `ColorPicker.Root` | `onValueCommit` | `(color: Color, details) => void` | — | Once at the end of each interaction. |
| `ColorPicker.Root` | `format` | `"hex" \| "rgb" \| "hsl" \| "hsb"` | — | Display and emission format (controlled). |
| `ColorPicker.Root` | `defaultFormat` | `format` | — | Default: from the first colour (a hex string gives `hex`). |
| `ColorPicker.Root` | `onFormatChange` | `(format) => void` | — | The format changed. |
| `ColorPicker.Root` | `open` | `boolean` | — | Open (controlled). |
| `ColorPicker.Root` | `defaultOpen` | `boolean` | `false` | Open at first. |
| `ColorPicker.Root` | `onOpenChange` | `(open, details) => void` | — | Popover reasons plus `select`. |
| `ColorPicker.Root` | `inline` | `boolean` | `false` | The content in place: no Popover, no layer, no listeners. |
| `ColorPicker.Root` | `closeOnSelect` | `boolean` | `false` | A swatch pick closes the Popover. |
| `ColorPicker.Root` | `modal` | `boolean` | `false` | As Popover. |
| `ColorPicker.Root` | `name` | `string` | — | Submits `#RRGGBB(AA)` (or `formFormat`). |
| `ColorPicker.Root` | `formFormat` | `"hex" \| "rgb" \| "hsl" \| "hsb" \| "css"` | — | The submitted text's format. |
| `ColorPicker.Root` | `disabled` | `boolean` | `false` | Disables every part and closes. |
| `ColorPicker.Root` | `readOnly` | `boolean` | `false` | Focusable, changes nothing. |
| `ColorPicker.Root` | `messages` | `Partial<ColorPickerMessages>` | — | Every string of the picker and its children. |
| `ColorPicker.Root` | `children` | `ReactNode` | — | The picker parts. |
| `ColorPicker.Root` | `positioning` | `PopoverProps["positioning"]` | — | The Popover's positioning: side, align, offsets, flip, shift, size, arrow and mode. |
| `ColorPicker.Root` | `initialFocus` | `PopoverProps["initialFocus"]` | — | Where focus goes once the Popover is placed: a function, or the overlay's rule. |
| `ColorPicker.Root` | `persistentElements` | `PopoverProps["persistentElements"]` | — | Elements whose presses and focus count as inside the Popover (a toast region). |
| `ColorPicker.Root` | `form` | `string` | — | The id of the form the hidden input belongs to. |
| `ColorPicker.Root` | `required` | `boolean` | — | Marks the picker required (Field state, `data-required` on the hidden input). |
| `ColorPicker.Root` | `invalid` | `boolean` | — | Marks the picker invalid (`data-invalid`, the Field's error state). |
| `ColorPicker.Root` | `colorName` | `ColorNameProp` | — | A fixed name or a function replacing the computed colour name (Trigger label, value texts, announcements). |
| `ColorPicker.Root` | `locale` | `string` | `the provider's` | Formats the colour name and the numbers. |
| `ColorPicker.Root` | `dir` | `"ltr" \| "rtl"` | `the provider's` | Reading direction; mirrors the area and sliders. |
| `ColorPicker.Label` | `render` | `RenderProp<ColorPickerState>` | — | Another element or a render function receiving the props and the picker's state. |
| `ColorPicker.Control` | `render` | `RenderProp<ColorPickerState>` | — | Another element or a render function receiving the props and the picker's state. |
| `ColorPicker.Trigger` | `render` | `RenderProp<ColorPickerState>` | — | Another element or a render function receiving the props and the picker's state. |
| `ColorPicker.Portal` | `children` | `ReactNode` | — | The content rendered into the portal host. |
| `ColorPicker.Portal` | `container` | `Element \| ShadowRoot \| null` | — | Where to render (default: resolved from the logical parent, then `body`). |
| `ColorPicker.Portal` | `logicalParent` | `(() => Element \| null)` | — | The element the content belongs to (its trigger): target resolution and dir/lang/theme. |
| `ColorPicker.Portal` | `observe` | `boolean` | `true` | Keeps the host's `dir`, `lang` and theme in step with the logical parent as they change; `false` copies them once. |
| `ColorPicker.Portal` | `render` | `RenderProp` | — | Another element or a render function receiving the props, in place of the host `div`. |
| `ColorPicker.Positioner` | `render` | `RenderProp<undefined>` | — | Another element or a render function receiving the props and the part's state. |
| `ColorPicker.Content` | `render` | `RenderProp<ColorPickerState>` | — | Another element or a render function receiving the props and the picker's state. |
| `ColorPicker.Area` | `children` | `ReactNode` | — | The area's parts (Background, Thumb). |
| `ColorPicker.Area` | `onValueChange` | `(color: Color, details: ColorChangeDetails<ColorAreaReason>) => void` | — | Each applied change, in the space of the colour you passed; not for a change that leaves the emitted colour as it is (hue at black). |
| `ColorPicker.Area` | `onValueCommit` | `(color: Color, details: ColorCommitDetails<ColorAreaReason>) => void` | — | Once at the end of each interaction that changed the colour. |
| `ColorPicker.Area` | `colorSpace` | `ColorSpace` | — | The space of the axes (default: the first colour's space, else `hsb`). |
| `ColorPicker.Area` | `xChannel` | `ColorChannel` | `saturation (hsb, hsl), red (rgb)` | The horizontal channel. |
| `ColorPicker.Area` | `yChannel` | `ColorChannel` | `brightness (hsb), lightness (hsl), green (rgb)` | The vertical channel. |
| `ColorPicker.Area` | `xName` | `string` | — | Submits the x channel under this name. |
| `ColorPicker.Area` | `yName` | `string` | — | Submits the y channel under this name. |
| `ColorPicker.Area` | `form` | `string` | — | The id of the form the inputs belong to. |
| `ColorPicker.Area` | `disabled` | `boolean` | — | Ignores presses and keys. |
| `ColorPicker.Area` | `readOnly` | `boolean` | — | Focusable, changes nothing. |
| `ColorPicker.Area` | `colorName` | `ColorNameProp` | — | Replaces the colour name in the value text. |
| `ColorPicker.Area` | `locale` | `string` | `the provider's locale` | Formats the value text. |
| `ColorPicker.Area` | `dir` | `"ltr" \| "rtl"` | `the provider's direction` | Mirrors the x axis. |
| `ColorPicker.Area` | `messages` | `MessageOverrides<ColorAreaMessages>` | — | Names, role description, value text and colour words. |
| `ColorPicker.Area` | `render` | `RenderProp<ColorAreaState>` | — | Another element or a render function receiving the props and the area's state. |
| `ColorPicker.AreaBackground` | `render` | `RenderProp<ColorAreaState>` | — | Another element or a render function receiving the props and the area's state. |
| `ColorPicker.AreaThumb` | `render` | `RenderProp<ColorAreaState>` | — | Another element or a render function receiving the props and the area's state. |
| `ColorPicker.ChannelSlider` | `children` | `ReactNode` | — | The slider's parts: label, control, thumbs, markers, value text and description. |
| `ColorPicker.ChannelSlider` | `thumbAlignment` | `ThumbAlignment` | `center` | `contain` keeps thumbs inside the track; set `--rind-slider-thumb-size` to the thumb size. |
| `ColorPicker.ChannelSlider` | `orientation` | `SliderOrientation` | `horizontal` | The axis. |
| `ColorPicker.ChannelSlider` | `disabled` | `boolean` | — | Ignores all input; thumbs leave the tab order. |
| `ColorPicker.ChannelSlider` | `readOnly` | `boolean` | — | Keeps focus and value, ignores changes. |
| `ColorPicker.ChannelSlider` | `required` | `boolean` | — | `data-required` only: a range input always has a value. |
| `ColorPicker.ChannelSlider` | `invalid` | `boolean` | — | Sets `aria-invalid` and `data-invalid`. |
| `ColorPicker.ChannelSlider` | `name` | `string` | — | The submitted field name of every thumb. |
| `ColorPicker.ChannelSlider` | `form` | `string` | — | The id of the form the inputs belong to. |
| `ColorPicker.ChannelSlider` | `locale` | `string` | `the provider's` | Locale for formatting. |
| `ColorPicker.ChannelSlider` | `dir` | `"ltr" \| "rtl"` | `the provider's` | Reading direction; mirrors a horizontal Slider. |
| `ColorPicker.ChannelSlider` | `render` | `RenderProp<SliderState>` | — | Another element or a render function receiving the props and the slider's state. |
| `ColorPicker.ChannelSlider` | `channel` | `ColorChannel` | — | The edited channel: red, green, blue, hue, saturation, lightness, brightness or alpha. |
| `ColorPicker.ChannelSlider` | `onValueChange` | `(color: Color, details: ColorChangeDetails) => void` | — | Each applied change, in the space of the colour you passed. |
| `ColorPicker.ChannelSlider` | `onValueCommit` | `(color: Color, details: ColorCommitDetails) => void` | — | Once at the end of each interaction that changed the colour. |
| `ColorPicker.ChannelSlider` | `colorSpace` | `ColorSpace` | `the colour's when it has the channel` | The working space. |
| `ColorPicker.ChannelSlider` | `colorName` | `ColorNameProp` | — | Replaces the colour name in the value text. |
| `ColorPicker.ChannelSlider` | `messages` | `MessageOverrides<ColorSliderMessages>` | — | Channel names, value text and colour words. |
| `ColorPicker.ChannelSliderLabel` | `render` | `RenderProp<SliderState>` | — | Another element or a render function receiving the props and the slider's state. |
| `ColorPicker.ChannelSliderValueText` | `render` | `RenderProp<SliderState>` | — | Another element or a render function receiving the props and the slider's state. |
| `ColorPicker.ChannelSliderTrack` | `render` | `RenderProp<SliderState>` | — | Another element or a render function receiving the props and the slider's state. |
| `ColorPicker.ChannelSliderThumb` | `render` | `RenderProp<SliderState>` | — | Another element or a render function receiving the props and the slider's state. |
| `ColorPicker.ChannelSliderThumb` | `disabled` | `boolean` | — | Disables this thumb only. |
| `ColorPicker.ChannelSliderThumb` | `name` | `string` | — | Submitted under this name instead of the Root's. |
| `ColorPicker.ChannelSliderThumb` | `children` | `ReactNode` | — | The thumb's visible content, rendered before its native range input. |
| `ColorPicker.ChannelInput` | `channel` | `ColorChannel \| "hex" \| "css"` | — | A colour channel (a Color Channel Field), or `hex` / `css` (a Color Field). |
| `ColorPicker.ChannelInput` | `alpha` | `boolean` | — | Accept and show 8-digit hex (default: when the colour has alpha below 1). |
| `ColorPicker.EyeDropperTrigger` | `render` | `RenderProp<ColorPickerState>` | — | Another element or a render function receiving the props and the picker's state. |
| `ColorPicker.SwatchGroup` | `children` | `ReactNode` | — | The group's parts (Label, Items, Description, ErrorMessage). |
| `ColorPicker.SwatchGroup` | `orientation` | `"vertical" \| "horizontal"` | — | Only `aria-orientation` and `data-orientation`: every arrow key moves. |
| `ColorPicker.SwatchGroup` | `disabled` | `boolean` | — | Disables every radio. |
| `ColorPicker.SwatchGroup` | `focusableWhenDisabled` | `boolean` | — | A disabled group stays discoverable: the root is one tab stop. |
| `ColorPicker.SwatchGroup` | `readOnly` | `boolean` | — | Navigable, never changes. |
| `ColorPicker.SwatchGroup` | `required` | `boolean` | — | Valid with one radio checked. |
| `ColorPicker.SwatchGroup` | `invalid` | `boolean` | — | Marks the group invalid; shows the ErrorMessage. |
| `ColorPicker.SwatchGroup` | `name` | `string` | — | Default: derived from the root id (two groups never form one browser group). |
| `ColorPicker.SwatchGroup` | `form` | `string` | — | The id of the form the hidden inputs belong to. |
| `ColorPicker.SwatchGroup` | `render` | `RenderProp<RadioGroupState>` | — | Another element or a render function receiving the props and the group's state. |
| `ColorPicker.SwatchGroup` | `onValueChange` | `(color: Color, details: ColorSwatchPickerChangeDetails) => void` | — | A swatch was checked; `details.value` is its key, `details.index` its index. |
| `ColorPicker.SwatchGroup` | `locale` | `string` | `the provider's` | Formats the swatches' colour names. |
| `ColorPicker.SwatchGroup` | `messages` | `MessageOverrides<ColorSwatchPickerMessages>` | — | The group's label (`swatchPickerLabel`) and the colour words. |
| `ColorPicker.SwatchTrigger` | `disabled` | `boolean` | — | Disables this swatch only. |
| `ColorPicker.SwatchTrigger` | `color` | `ColorInput` | — | The swatch's colour: a colour, or a string `parseColor` reads. |
| `ColorPicker.SwatchTrigger` | `value` | `string` | — | The item's key (default the canonical `#RRGGBBAA`). |
| `ColorPicker.SwatchTrigger` | `colorName` | `ColorNameProp` | — | A fixed name or a function replacing the computed colour name (the swatch's accessible name). |
| `ColorPicker.SwatchIndicator` | `render` | `RenderProp<RadioItemState>` | — | Another element or a render function receiving the props and the part's state. |
| `ColorPicker.Swatch` | `color` | `ColorInput` | — | Default transparent black. |
| `ColorPicker.Swatch` | `respectAlpha` | `boolean` | — | `false`: the opaque colour (default true). |
| `ColorPicker.Swatch` | `colorName` | `ColorNameProp` | — | A fixed name (a design token) or a function replacing the computed name. |
| `ColorPicker.Swatch` | `locale` | `string` | `the provider's locale` | Formats the transparency percentage. |
| `ColorPicker.Swatch` | `messages` | `MessageOverrides<ColorSwatchMessages>` | — | The role description and the colour words. |
| `ColorPicker.Swatch` | `render` | `RenderProp<ColorSwatchState>` | — | Another element or a render function receiving the props and the swatch's state. |
| `ColorPicker.ValueSwatch` | `respectAlpha` | `boolean` | — | `false`: the opaque colour (default true). |
| `ColorPicker.ValueSwatch` | `colorName` | `ColorNameProp` | — | A fixed name (a design token) or a function replacing the computed name. |
| `ColorPicker.ValueSwatch` | `locale` | `string` | `the provider's locale` | Formats the transparency percentage. |
| `ColorPicker.ValueSwatch` | `messages` | `MessageOverrides<ColorSwatchMessages>` | — | The role description and the colour words. |
| `ColorPicker.ValueSwatch` | `render` | `RenderProp<ColorSwatchState>` | — | Another element or a render function receiving the props and the swatch's state. |
| `ColorPicker.FormatSelect` | `render` | `RenderProp<ColorPickerState>` | — | Another element or a render function receiving the props and the picker's state. |
| `ColorPicker.FormatTrigger` | `render` | `RenderProp<ColorPickerState>` | — | Another element or a render function receiving the props and the picker's state. |
| `ColorPicker.View` | `render` | `RenderProp<ColorPickerState>` | — | Another element or a render function receiving the props and the picker's state. |
| `ColorPicker.View` | `format` | `ColorPickerFormat` | — | The format this view is for: the children render only while it is the picker's. |
| `ColorPicker.ValueText` | `render` | `RenderProp<ColorPickerState>` | — | Another element or a render function receiving the props and the picker's state. |
| `ColorPicker.TransparencyGrid` | `render` | `RenderProp<Record<never, never>>` | — | Another element or a render function receiving the props. |
| `ColorPicker.Description` | `render` | `RenderProp<FieldState>` | — | Another element or a render function receiving the props and the Field's state. |
| `ColorPicker.ErrorMessage` | `render` | `RenderProp<FieldState>` | — | Another element or a render function receiving the props and the Field's state. |
| `ColorPicker.ErrorMessage` | `match` | `string` | — | Rendered only when this validity key caused the error (one message per constraint). |
| `ColorPicker.ErrorMessage` | `children` | `ReactNode \| ((messages: readonly string[]) => ReactNode)` | — | Replaces the default text; a function returning null/undefined falls back to it. |

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
| `every part` | `data-scope` | "color-picker": the area, the channel sliders, the inputs and the swatches too |
| `every part` | `data-part` | The part's name (the anatomy table): `area-thumb`, `channel-slider-track`, `swatch-trigger`, … |
| `every part` | `data-channel` | On `channel-slider` and `channel-input-root`: the channel it edits. |

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

## Parts

Compose only the parts a picker needs. With `inline` the parts sit on the page and no Popover is involved, which is how a field-only or swatch-only picker is built.

- **Area** (`Area`, `AreaBackground`, `AreaThumb`): two channels as a 2D surface (`xChannel`, `yChannel`; saturation × brightness by default). Arrow keys step one channel each (Page Up/Down and Shift for large steps, Home/End to the edges); a press moves the thumb there; the x axis mirrors right to left. Each axis is a slider for assistive technology, named and valued.
- **ChannelSlider** (`ChannelSlider`, `ChannelSliderLabel`, `ChannelSliderValueText`, `ChannelSliderTrack`, `ChannelSliderThumb`, `TransparencyGrid`): one channel on a [Slider](slider.md), its track painted with the channel's gradient; `orientation="vertical"` runs it to the top. Unlabelled, the thumb is named by the channel. A channel value the colour model computes off the slider's step (a hex colour's hue) is shown on the step grid; the colour keeps its precision.
- **ChannelInput** (`channel="hex" | "css"` or a channel name): a hex or CSS text field, or a number field for one channel. A text field holds free text until Enter or blur (`#` optional, any case); a draft that is not a colour keeps the last colour and marks the field invalid (`aria-invalid`, `data-invalid`). Channel fields clamp what is typed (999 commits 360° for hue).
- **SwatchGroup** (`SwatchGroup`, `SwatchTrigger`, `SwatchIndicator`): a palette that is a [Radio Group](radio-group.md) of colours: arrows move and pick, the group is one tab stop, at most one swatch matches the colour (a colour no swatch has checks nothing). `SwatchIndicator` is the one selected mark: empty, the theme draws a centred dot; given a glyph or icon, that is the mark instead.
- **Swatch** and **ValueSwatch**: a colour chip with `role="img"`, named by its colour ("vibrant blue", "50% transparent"), drawn over a checkerboard when it is transparent; `ValueSwatch` shows the picker's colour and is decorative inside the Trigger.
- **EyeDropperTrigger**, **FormatSelect** / **FormatTrigger** and **View**, **ValueText**, **HiddenInput**: see the sections below.

## Styling

Every part carries `data-scope="color-picker"`, the parts built on other components included: style the picker with `[data-scope="color-picker"][data-part="…"]` and the part names of the anatomy table (`area`, `area-thumb`, `channel-slider-track`, `channel-slider-thumb`, `channel-input`, `swatch-group`, `swatch-trigger`, `swatch-indicator`, `swatch`, `value-swatch`, `transparency-grid`). A Slider, Number Input or Radio Group stylesheet never reaches the picker's parts, and the picker's sheet never reaches them. `data-channel` on a channel slider and a channel input's root names its channel.

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

`getColorPicker` has the actions `open`, `close`, `pressOutside`, `tab`, `shiftTab`, `setFormat`, `resetForm`, the queries `color`, `format`, `valueText`, `colorName`, `isOpen`, `isInline`, `formValue`, `closeReason`, `isEyeDropperAvailable`, and its parts' drivers: `area()`, `slider(channel)`, `input(channel)`, `swatches()`, `swatch(name)`. `eyeDropper(result | "abort")` installs a fake eye dropper.

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
