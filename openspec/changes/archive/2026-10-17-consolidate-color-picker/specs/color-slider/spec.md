## MODIFIED Requirements

### Requirement: Anatomy

The Color Slider is a part of the Color Picker (`ColorPicker.ChannelSlider` and its `ChannelSlider*` parts, `TransparencyGrid`), not a standalone component: no package SHALL export it on its own, and it SHALL be rendered only inside a `ColorPicker.Root`. The requirements of this capability describe that part.

A Color Slider SHALL consist of `Root`, `Label`, `ValueText`, `Control`, `Track`, `Thumb` and an optional `Description`,
each rendering the Slider part of the same name (a single `Thumb`, its native `<input type="range">` inside) with the
binding below; `Control` is optional: without it `Root` is the pointer surface (a request to `add-slider`, design.md); the Slider's `Indicator` and markers are not exposed. A `TransparencyGrid` part (decorative,
`aria-hidden`, `pointer-events: none`, filling its parent) SHALL be available to draw a checkerboard under a gradient
that has transparency. Every part SHALL accept the `render` prop. The Slider's anatomy and attribute rules apply.

#### Scenario: One slider

- **WHEN** a Color Slider for `hue` is rendered with Root, Control, Track and Thumb
- **THEN** exactly one element has role `slider` and it is an `input[type=range]`
