## MODIFIED Requirements

### Requirement: Right-To-Left Mirroring

Only horizontal arrow keys SHALL be mirrored, and only when the direction is `rtl`:
in a horizontal composite ArrowLeft SHALL map to `NEXT` and ArrowRight to `PREV`;
`EXPAND` and `COLLAPSE` SHALL swap sides; for value controls Left SHALL increase in
RTL and Right in LTR. For value controls in the `value: "vertical"` mode ArrowLeft and
ArrowRight SHALL map to `PREV` and `NEXT` (not to value keys), mirrored in RTL like a
horizontal composite (ArrowLeft maps to `NEXT` and ArrowRight to `PREV`). Vertical arrows, Home, End, PageUp and PageDown SHALL never be
mirrored, and ArrowUp SHALL always increase.

#### Scenario: Tabs in Arabic

- **WHEN** ArrowLeft is pressed in a horizontal tab list with `dir="rtl"`
- **THEN** the machine receives `NEXT`

#### Scenario: Home is not mirrored

- **WHEN** Home is pressed with `dir="rtl"`
- **THEN** the machine receives `FIRST`

#### Scenario: Slider in RTL

- **WHEN** ArrowLeft is pressed on a horizontal slider with `dir="rtl"`
- **THEN** the machine receives `INCREASE`

#### Scenario: Segment in RTL

- **WHEN** ArrowLeft is pressed on a `value: "vertical"` control with `dir="rtl"`
- **THEN** the machine receives `NEXT`, not `INCREASE`

## ADDED Requirements

### Requirement: Vertical Value Mode

Value controls SHALL accept a `value` option of `true` (all arrows step, as today) or
`"vertical"`. In the `"vertical"` mode ArrowUp SHALL map to `INCREASE` and ArrowDown to
`DECREASE`, PageUp, PageDown, Home and End SHALL map as in the other value modes, and
ArrowLeft and ArrowRight SHALL map to `PREV` and `NEXT` so a segmented control (Date Field,
Time Field) steps the value vertically and moves between segments horizontally.

#### Scenario: Step a segment

- **WHEN** ArrowUp and then ArrowDown are pressed on a `value: "vertical"` control
- **THEN** the machine receives `INCREASE` and then `DECREASE`

#### Scenario: Move between segments

- **WHEN** ArrowRight is pressed on a `value: "vertical"` control with `dir="ltr"`
- **THEN** the machine receives `NEXT` and no `INCREASE`

#### Scenario: Plain value mode unchanged

- **WHEN** ArrowRight is pressed on a horizontal slider with `value: true` and `dir="ltr"`
- **THEN** the machine receives `INCREASE`
