## REMOVED Requirements

### Requirement: Storybook Renders Themed Components

**Reason**: Storybook is retired; themed rendering moves to the docs site's examples harness.
**Migration**: see "Themed Examples" below — the `theme-calm` / `theme-crisp` harness skins
replace the brand toolbar, and the axe colour-contrast check runs on them.

## MODIFIED Requirements

### Requirement: Contrast Report

The docs site SHALL include a contrast report page that renders, for each preset and sample
brand, every checked pair from the builder report in light and dark, with ratio, requirement,
pass/fail and any adjustment applied.

#### Scenario: Adjusted sample brand

- **WHEN** the report is opened for the light-yellow sample brand
- **THEN** it lists the adjusted tokens with their original and adjusted colours and
  every pair passes

## ADDED Requirements

### Requirement: Themed Examples

Every component example SHALL render on the examples harness with `@rind-ui/theme` in the
`calm` and `crisp` presets (skins `theme-calm`, `theme-crisp`), including portalled content,
and SHALL pass axe colour-contrast in light and dark in Chromium, Firefox and WebKit.

#### Scenario: Axe in every brand

- **WHEN** the axe run visits every example on `theme-calm` and `theme-crisp` in light and dark
- **THEN** every example passes colour-contrast in all three engines
