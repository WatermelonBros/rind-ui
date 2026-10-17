## MODIFIED Requirements

### Requirement: Anatomy

The Color Area is a part of the Color Picker (`ColorPicker.Area`, `AreaBackground`, `AreaThumb`), not a standalone component: no package SHALL export it on its own, and it SHALL be rendered only inside a `ColorPicker.Root` (inline or in the content). The requirements of this capability describe that part.

A Color Area SHALL consist of `Root` (a `div` with `role="group"` and the pointer surface), `Background` (a
decorative element showing the gradient) and `Thumb` (the positioned handle). `Thumb` SHALL render exactly two
native `<input type="range">` elements, the **x input** and the **y input**, in that DOM order; they are the only
elements with role `slider`. Neither `Root`, `Background` nor `Thumb` SHALL be focusable. `Background` SHALL be
`aria-hidden`. Every part SHALL accept the `render` prop and forward its element's attributes (reka-ui#2545).
`Thumb` SHALL be positioned from the value in the server render (no measuring).

#### Scenario: Two sliders, nothing else

- **WHEN** a Color Area is rendered
- **THEN** exactly two elements have role `slider`, both `input[type=range]`, and no other element inside the
  Area is focusable

#### Scenario: Server render

- **WHEN** a Color Area with `defaultValue="#336699"` is rendered on the server
- **THEN** the Thumb's position styles, both input values, `aria-valuenow` and the Background's gradient are in
  the HTML and hydration produces no warning

#### Scenario: Attributes forwarded

- **WHEN** `data-testid="area"` and a class are passed to `Root`
- **THEN** they appear on the rendered element
