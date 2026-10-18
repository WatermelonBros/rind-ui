## MODIFIED Requirements

### Requirement: Data Attributes And Variables

The area's parts SHALL carry `data-scope="color-picker"` with the `data-part` names `area` (Root), `area-background`, `area-thumb` and `area-input` (each range input).

`Root`, `Background` and `Thumb` SHALL carry `data-disabled`, `data-readonly` and `data-dragging` while applicable; `Root` and `Thumb`
`data-focus` and `data-focus-visible` for focus of either input. `Root` SHALL carry the CSS variable `--rind-color` (the current
colour, CSS string) and `--rind-color-opaque`; `Background` the inline `background-image` from the model's `areaGradient`
(also as `--rind-color-area-gradient`); `Thumb` the variables `--rind-color-area-x` and `--rind-color-area-y` (percent from the
left/right and from the bottom, mirrored under RTL) and `--rind-color` (the opaque colour under it). The values SHALL be finite. `data-variant`,
`data-size` and `data-tone` SHALL pass through untouched.

#### Scenario: Variables

- **WHEN** saturation is 50 and brightness 25
- **THEN** the Thumb has `--rind-color-area-x: 50` and `--rind-color-area-y: 25` (LTR)
