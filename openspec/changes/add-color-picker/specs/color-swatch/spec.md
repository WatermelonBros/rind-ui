## Purpose

Defines rind-ui's Color Swatch: a chip that shows a colour and tells assistive technology which colour it is. Used on its
own, as the Color Picker's trigger preview and value swatch, and inside the Color Swatch Picker. Research:
`docs/research/color-picker.md`.

## ADDED Requirements

### Requirement: Anatomy And Naming

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

### Requirement: Colour And Variables

The Swatch SHALL take `color` (`string | Color`, default transparent black) and `respectAlpha` (default true). It SHALL set
`background-color` inline from the colour's CSS string (the opaque colour when `respectAlpha` is false), the variables
`--rind-color` (CSS string) and `--rind-color-opaque`, and `forced-color-adjust: none`. An unparsable `color` SHALL be a
development error and render transparent. The Swatch SHALL carry `data-transparent` when alpha is below 1 so the theme can
draw a checkerboard behind it (`TransparencyGrid` is available as in Color Slider). It SHALL NOT use CSS variables as the colour
value: a colour given as `var(--x)` is not supported (the model needs the numbers).

#### Scenario: Opaque only

- **WHEN** `color="#FF000080"` and `respectAlpha={false}`
- **THEN** the background is `#FF0000` and `data-transparent` is absent

#### Scenario: Alpha

- **WHEN** `color="#FF000080"`
- **THEN** `data-transparent` is present and the background has alpha 0.5

#### Scenario: Forced colours

- **WHEN** rendered with `forced-colors: active`
- **THEN** the swatch keeps its colour (`forced-color-adjust: none`) and is bordered in `CanvasText`

### Requirement: Contract

The Color Swatch contract SHALL locate by role `img` and name, with queries `color(format?)`, `colorName()`, `isTransparent()`, and no
actions. Inside a Color Picker the picker's contract exposes the value swatch through them.

#### Scenario: Query

- **WHEN** `getColorSwatch(screen, { name: "vibrant red" }).color("hex")` runs
- **THEN** it returns `#FF0000`

### Requirement: Theme

`color-swatch.css` SHALL follow the theme convention with `--rind-color-swatch-*` tokens: size (`--rind-color-swatch-size`, default
`--rind-size-md`), radius, a `CanvasText`-based inset border that keeps 3:1 against light and dark backgrounds, the checkerboard from
`--rind-color-checker-*` tokens under `[data-transparent]`, and forced-colors rules. Family `decoration` (look through its own tokens).

#### Scenario: Light swatch on a light page

- **WHEN** a white swatch is rendered on a white surface
- **THEN** its border keeps 3:1 against the surface
