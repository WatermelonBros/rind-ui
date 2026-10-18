## MODIFIED Requirements

### Requirement: Data Attributes

The swatch group's parts SHALL carry `data-scope="color-picker"` with the `data-part` names `swatch-group` (Root), `swatch-item`, `swatch-trigger` (the radio), `swatch-indicator` and `swatch` (the decorative swatch); no `data-color-swatch-picker` marker is needed.

Items SHALL carry the Radio Group's `data-state` (`checked`, `unchecked`), `data-disabled`, `data-focus`, `data-focus-visible`; `Swatch`
the Color Swatch's attributes; and `Item` the variables `--rind-color` and `--rind-color-opaque`. `data-variant`, `data-size` and
`data-tone` SHALL pass through untouched.

#### Scenario: Checked state

- **WHEN** the matching item is rendered
- **THEN** it has `data-state="checked"` and its Indicator is mounted
