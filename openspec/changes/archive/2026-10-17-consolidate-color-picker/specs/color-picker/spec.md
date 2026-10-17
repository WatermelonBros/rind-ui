## MODIFIED Requirements

### Requirement: Anatomy

The Color Picker SHALL be the only colour component: the colour area, the channel slider, the colour and channel fields,
the swatch and the swatch group exist only as its parts, and `@rind-ui/react` and `@rind-ui/testing` SHALL export no
standalone colour component or driver besides `ColorPicker` and `getColorPicker`. Every capability the parts offer SHALL be
reachable inside a Color Picker; with `inline` they are laid out on the page without a Popover (a field-only, slider-only
or swatch-only picker).

A Color Picker SHALL consist of `Root` (a Field host: not inside a Field it acts as one; inside one it registers as the control),
`Label`, `Control` (`role="group"`, the Popover's anchor), `Trigger` (a button), `Portal`, `Positioner`, `Content`, `Area`,
`AreaBackground`, `AreaThumb`, `ChannelSlider` (with `ChannelSliderLabel`, `ChannelSliderValueText`, `ChannelSliderTrack`,
`ChannelSliderThumb`), `ChannelInput`, `EyeDropperTrigger`, `SwatchGroup`, `SwatchTrigger`, `SwatchIndicator`, `Swatch`, `ValueSwatch`,
`FormatSelect`, `FormatTrigger`, `View`, `ValueText`, `HiddenInput`, `TransparencyGrid`, and optional `Description` and `ErrorMessage`.
`Area*` are the Color Area's parts, `ChannelSlider*` the Color Slider's (the `ChannelSlider` is the slider's `Root`, the pointer surface), `ChannelInput` the Color Field or
Color Channel Field chosen by its `channel`, `SwatchGroup`, `SwatchTrigger` and `SwatchIndicator` the Color Swatch Picker's `Root`, `Item` and
`Indicator`, `Swatch` and `ValueSwatch` the Color Swatch, `Portal`, `Positioner`, `Content` the Popover's. Every part SHALL accept the `render` prop
(ark#1922) and forward its element's attributes. Children bound to the picker SHALL NOT take their own `value`.

#### Scenario: Reado's anatomy

- **WHEN** a picker is rendered with `Content`, `ValueText`, `Area` (`AreaBackground`, `AreaThumb`) and two `ChannelSlider`s (`hue`, `alpha`), each with `ChannelSliderTrack` and
  `ChannelSliderThumb`
- **THEN** it renders without a Trigger, shows the area, both sliders and the value text, and every slider is operable

#### Scenario: `render` on every part

- **WHEN** each part is rendered with `render={<span />}` or another element
- **THEN** it behaves the same and no part throws (ark#1922)

#### Scenario: No standalone exports

- **WHEN** a consumer imports `ColorArea`, `ColorSlider`, `ColorField`, `ColorChannelField`, `ColorSwatch` or
  `ColorSwatchPicker` from `@rind-ui/react`
- **THEN** the import does not compile, and `ColorPicker` has a part for each

#### Scenario: A field-only picker

- **WHEN** an inline Color Picker renders a Label and one `ChannelInput channel="hex"`
- **THEN** one textbox named by the Label edits the colour, with no Trigger and no Popover

## ADDED Requirements

### Requirement: One Selected Swatch Mark

A checked swatch SHALL show exactly one selected mark, centred on the swatch. `SwatchIndicator` is that mark: empty, the
theme draws a ringed dot (visible on any colour); given content (a glyph or an icon), that content is the mark and no dot
is drawn. The theme and the docs site skin SHALL centre it on the swatch whatever the swatch's size.

#### Scenario: The default dot

- **WHEN** a swatch with an empty `SwatchIndicator` is checked
- **THEN** exactly one visible mark is inside the swatch, and its centre is within 1 px of the swatch's centre

#### Scenario: A glyph replaces the dot

- **WHEN** a swatch's `SwatchIndicator` holds "✓" and the swatch is checked
- **THEN** the glyph is the only mark (no dot is drawn) and its box is centred on the swatch

### Requirement: Part Drivers

`getColorPicker` SHALL give the drivers of its parts: `area(name?)`, `slider(channel)`, `input(channel)`, `swatches(name?)`
and `swatch(name)`, with the queries and actions the parts' contracts declare.

#### Scenario: A swatch through the picker's driver

- **WHEN** a test calls `getColorPicker(screen, { name: "Tag colour" }).swatch("vibrant green")`
- **THEN** it gets the swatch's driver, located by its colour name
