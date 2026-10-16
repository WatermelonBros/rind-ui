## Purpose

Defines rind-ui's Color Swatch Picker: a palette of colour swatches of which at most one matches the current colour, chosen
by pointer or keyboard. It is the `radio-group` capability with colours as items: arrow keys move and check, the group is one
tab stop, the value takes part in forms. This capability specifies the colour binding only; every Radio Group rule applies
unchanged and is not repeated. Inside the Color Picker the same parts appear as `SwatchGroup`, `SwatchTrigger`,
`SwatchIndicator` and `Swatch`. Research: `docs/research/color-picker.md`.

## ADDED Requirements

### Requirement: Anatomy

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

### Requirement: Value And Matching

The picker SHALL expose `value` (`string | Color | null`), `defaultValue` (default `null`) and `onValueChange(color, details)` with
`details.value` (the item's key), `details.index`, `details.reason` (`NAVIGATE` or `PRESS`, as Radio Group) and `cancel()`. The
checked item SHALL be derived from the colour: the item the user last chose when its colour is still `isSameColor` as the value,
otherwise the first item (in order) whose colour is `isSameColor` as the value, otherwise none. When no swatch matches the value
**no item is checked** and the value is unchanged (it SHALL NOT select the first or a black swatch). Two items with the same colour
SHALL both be allowed; they are told apart by their `value` keys. A user action SHALL never uncheck the checked item.

#### Scenario: No match (react-spectrum#7918)

- **WHEN** the value is `#123456` and no swatch has that colour
- **THEN** no item has `aria-checked="true"`, whatever the swatches' colours

#### Scenario: Black is selectable only when it matches

- **WHEN** a picker holds a `#000000` swatch and the value is `#FF0000`
- **THEN** the black swatch is unchecked

#### Scenario: Same colour twice, stable keys (react-spectrum#10251)

- **WHEN** two items share `#FF0000` with keys `primary` and `danger` and the user picks the second
- **THEN** `details.value` is `danger` and the second item stays checked while the value is unchanged

#### Scenario: Match across spaces

- **WHEN** the value is `hsb(0, 100, 100)` and a swatch is `#FF0000`
- **THEN** that swatch is checked

### Requirement: Keyboard And Selection

The picker SHALL be the Radio Group's: arrows move focus to the next or previous enabled swatch (wrapping, mirrored under
`dir="rtl"`) and check it in the same step, Space checks, the group is one tab stop (the checked item, else the first enabled), and
pressing the checked swatch changes nothing. Checking an item SHALL call `onValueChange` once with its colour (converted to the
value's emission space), exactly as a Radio Group's change. Two-dimensional grid navigation (Up/Down by row) is not provided.

#### Scenario: Arrow checks

- **WHEN** focus is on the first swatch and ArrowRight is pressed
- **THEN** the second swatch is focused and checked, and `onValueChange` is called once with its colour

#### Scenario: One tab stop

- **WHEN** Tab is pressed into a picker whose third swatch matches the value
- **THEN** the third swatch receives focus

### Requirement: Names

The group SHALL be named by the consumer's `aria-label` or `aria-labelledby`, else by `messages.swatchPickerLabel` (default
"Color swatches"). Each item SHALL be named by its colour name (`color-model`, with an optional `colorName` prop on the item for
design-token names), followed by the consumer's `aria-label`. A checked item SHALL expose the selection by `aria-checked` and by
the `Indicator` (not by colour alone).

#### Scenario: Names

- **WHEN** three items `#FF0000`, `#00FF00`, `#0000FF` are rendered
- **THEN** their names are "vibrant red", "vibrant green" and "vibrant blue" (English defaults)

### Requirement: Disabled, Read-Only And Form

A disabled item SHALL be skipped by navigation and ignore presses; `disabled` and `readOnly` on the Root SHALL be the Radio Group's.
With `name`, the Radio Group's form participation SHALL apply with the checked item's key as the submitted value, so the default
is the canonical hex string.

#### Scenario: Disabled item

- **WHEN** the second swatch is disabled and ArrowRight is pressed on the first
- **THEN** focus moves to the third

#### Scenario: Submitted

- **WHEN** a form has a picker `name="tone"` with the second swatch `#00FF00` checked
- **THEN** the form data contains `tone=#00FF00FF`

### Requirement: Data Attributes

Items SHALL carry the Radio Group's `data-state` (`checked`, `unchecked`), `data-disabled`, `data-focus`, `data-focus-visible`; `Swatch`
the Color Swatch's attributes; and `Item` the variables `--rind-color` and `--rind-color-opaque`. `data-variant`, `data-size` and
`data-tone` SHALL pass through untouched.

#### Scenario: Checked state

- **WHEN** the matching item is rendered
- **THEN** it has `data-state="checked"` and its Indicator is mounted

### Requirement: Contract

`getColorSwatchPicker` SHALL extend `getRadioGroup` with the locate rule (role `radiogroup` and name), queries `colors()`, `selected()` (the
checked item's key and colour, or `null`) and `selectedColor(format?)`, and actions `pick(key | name | index)` and `move("next" | "previous")`.
Traits are the Radio Group's (`form-associated`, `field-associated`, `directional`).

#### Scenario: Driver

- **WHEN** `getColorSwatchPicker(screen, { name: "Palette" }).pick("vibrant green")` runs in jsdom and in Playwright
- **THEN** both resolve with `selected()` naming the green swatch

### Requirement: Theme

`color-swatch-picker.css` SHALL follow the theme convention with `--rind-color-swatch-picker-*` tokens: a wrapping flex or grid of
swatches with a gap, each at least 24×24 px, a checked mark in `currentColor` over a ring that keeps 3:1 against the swatch and the surface,
focus ring from the base, forced-colors rules (`Highlight` ring, glyph mark). Family: the swatch itself `decoration`, the group
inherits `data-size`.

#### Scenario: Selected without colour

- **WHEN** a swatch is checked in forced colours
- **THEN** a visible mark and ring distinguish it from the others
