## MODIFIED Requirements

### Requirement: Data Attributes

Every Color Picker part SHALL carry `data-scope="color-picker"` and `data-instance`, the parts built on other components
(the area, the channel slider, the channel and colour inputs, the swatch group, the swatches) included; no part SHALL carry
another component's scope. Their `data-part` names SHALL be:

| Part | `data-part` |
|---|---|
| Area, AreaBackground, AreaThumb, the area's inputs | `area`, `area-background`, `area-thumb`, `area-input` |
| ChannelSlider and its Label, ValueText, Control, Track, Thumb | `channel-slider`, `channel-slider-label`, `channel-slider-value-text`, `channel-slider-control`, `channel-slider-track`, `channel-slider-thumb` (the Slider's indicator, if rendered: `channel-slider-range`) |
| ChannelInput (channel, hex or CSS) and its wrapper | `channel-input`, `channel-input-root` |
| SwatchGroup, its item, SwatchTrigger, SwatchIndicator | `swatch-group`, `swatch-item`, `swatch-trigger`, `swatch-indicator` |
| Swatch, ValueSwatch, TransparencyGrid | `swatch`, `value-swatch`, `transparency-grid` |

Every form input of a part (the channel slider's range input, the inputs' and the swatch group's hidden inputs) keeps
`data-part="hidden-input"`, told apart by its `data-instance`. `ChannelSlider` and a channel input's root SHALL carry
`data-channel`. The parts' own state attributes (`data-state`,
`data-dragging`, `data-focus-visible`, …) are unchanged.

`Root`, `Control`, `Trigger`, `Content` SHALL carry `data-disabled`, `data-readonly`, `data-invalid` and `data-focus`/`data-focus-visible` as applicable; `Root` `data-dragging` while any child
drags, `data-inline` in inline mode, `data-format`, and the variables `--rind-color` (the colour as a CSS string) and `--rind-color-opaque`; `Trigger` and `Content` the Popover's `data-state`
(`open`, `closed`), `data-side`, `data-align` and positioning variables; `View` `data-format`. Parts of children carry their own attributes. `data-variant`, `data-size` and `data-tone` SHALL pass through untouched.

#### Scenario: Colour variable

- **WHEN** the colour is `#336699`
- **THEN** `Root` has `--rind-color` equal to a CSS string of that colour

#### Scenario: One scope

- **WHEN** a picker with an Area, a ChannelSlider, a hex and a channel ChannelInput, a SwatchGroup and a ValueSwatch is rendered
- **THEN** every element with a `data-scope` inside it has `data-scope="color-picker"`, and the swatch trigger has
  `data-part="swatch-trigger"`

#### Scenario: Another component's stylesheet does not reach the parts

- **WHEN** a page styles `[data-scope="slider"][data-part="thumb"]`
- **THEN** a picker's channel slider thumb does not match it
