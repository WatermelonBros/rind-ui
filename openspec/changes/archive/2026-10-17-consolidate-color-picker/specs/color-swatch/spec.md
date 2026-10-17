## MODIFIED Requirements

### Requirement: Anatomy And Naming

The Color Swatch is a part of the Color Picker (`ColorPicker.Swatch`, `ColorPicker.ValueSwatch`), not a standalone component: no package SHALL export it on its own, and it SHALL be rendered only inside a `ColorPicker.Root`. The requirements of this capability describe that part.

A Color Swatch SHALL render one element (`div` by default) with `role="img"` and `aria-roledescription` from
`messages.swatch` (default "color swatch"), named by the colour name (`color-model` "Colour Names", with the component's
`locale`, `messages` and optional `colorName` function) followed, when the consumer passes `aria-label`, by a comma and that
label; `aria-labelledby` SHALL be honoured as given. A consumer-supplied `colorName` string SHALL replace the computed name
(for design-token or brand names). Alpha 0 SHALL be named by `messages.transparent`. The Swatch SHALL accept children (a
check mark, text) and the `render` prop and SHALL forward its element's attributes. It SHALL NOT be focusable.

#### Scenario: Name

- **WHEN** a Swatch has `color="#FF0000"`
- **THEN** its role is `img` and its accessible name is "vibrant red" (English default)

#### Scenario: Consumer name

- **WHEN** `colorName="Brand red"` and `aria-label="Primary"` are passed
- **THEN** the accessible name is "Brand red, Primary"

#### Scenario: Transparent

- **WHEN** `color="#00000000"`
- **THEN** the name is "transparent"

#### Scenario: Children (react-spectrum#7262)

- **WHEN** a check icon is passed as a child
- **THEN** it renders inside the swatch and the swatch's name is unchanged
