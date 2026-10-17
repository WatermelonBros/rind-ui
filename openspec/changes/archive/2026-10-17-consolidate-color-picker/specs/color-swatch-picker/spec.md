## MODIFIED Requirements

### Requirement: Anatomy

The Color Swatch Picker is a part of the Color Picker (`ColorPicker.SwatchGroup`, `SwatchTrigger`, `SwatchIndicator`), not a standalone component: no package SHALL export it on its own, and it SHALL be rendered only inside a `ColorPicker.Root`. A swatch-only picker is an inline Color Picker with one `SwatchGroup`. The requirements of this capability describe that part.

A Color Swatch Picker SHALL consist of `Root` (the Radio Group root, `role="radiogroup"`), and per swatch an `Item` (the Radio
Group item and its control, `role="radio"`, a button-like element), containing a `Swatch` (`color-swatch`, here decorative) and
an optional `Indicator` (the Radio Group item indicator: decorative, mounted only while the item is checked, for example a
check mark). Each `Item` SHALL take `color` (`string | Color`), an optional `value` (a string key, default the canonical
`#RRGGBBAA` of the colour) and `disabled`. Every part SHALL accept the `render` prop and forward its element's attributes. Items register as static
collection items.

#### Scenario: Radios, not buttons

- **WHEN** a picker with three swatches is rendered
- **THEN** the group has role `radiogroup`, each item has role `radio`, and no `input` is nested inside an element with
  role `radio`
