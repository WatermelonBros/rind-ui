## MODIFIED Requirements

### Requirement: Logical Keys

rind-ui SHALL map native key events to logical machine events (`NEXT`, `PREV`,
`FIRST`, `LAST`, `PAGE_NEXT`, `PAGE_PREV`, `EXPAND`, `COLLAPSE`, `INCREASE`,
`DECREASE`, `ACTIVATE`, `DISMISS`, `CONTEXT_MENU`, `PREV_ROW`, `NEXT_ROW`) from the event, the direction, the
orientation and the platform, in one function that runs without a DOM. Machines SHALL
be written against logical events. Each logical event SHALL carry `modality:
"keyboard"`, the modifier state and the `composing` flag. In the `"grid"` orientation
(two-dimensional composites such as a calendar) ArrowLeft and ArrowRight SHALL map to
`PREV` and `NEXT` and ArrowUp and ArrowDown SHALL map to `PREV_ROW` and `NEXT_ROW`, so a
machine can tell a move along a row (a day) from a move across rows (a week); the other
orientations SHALL never produce `PREV_ROW` or `NEXT_ROW`.

#### Scenario: Vertical list

- **WHEN** ArrowDown is pressed in a vertical composite
- **THEN** the machine receives `NEXT`

#### Scenario: Context menu keys

- **WHEN** Shift+F10 or the ContextMenu key is pressed on a part
- **THEN** the machine receives `CONTEXT_MENU`

#### Scenario: No DOM needed

- **WHEN** the mapping is called in Node with a plain key description and `dir: "rtl"`
- **THEN** it returns the logical event without touching DOM globals

#### Scenario: Grid day and week moves

- **WHEN** ArrowRight and then ArrowDown are pressed in a `"grid"` composite with `dir: "ltr"`
- **THEN** the machine receives `NEXT` and then `NEXT_ROW`

#### Scenario: Other orientations have no row keys

- **WHEN** ArrowDown is pressed in a vertical composite and in a `"both"` composite
- **THEN** neither produces `PREV_ROW` or `NEXT_ROW`

### Requirement: Right-To-Left Mirroring

Only horizontal arrow keys SHALL be mirrored, and only when the direction is `rtl`:
in a horizontal composite ArrowLeft SHALL map to `NEXT` and ArrowRight to `PREV`;
in a `"grid"` composite ArrowLeft SHALL map to `NEXT` and ArrowRight to `PREV` in the same way,
while ArrowUp and ArrowDown SHALL keep mapping to `PREV_ROW` and `NEXT_ROW`;
`EXPAND` and `COLLAPSE` SHALL swap sides; for value controls Left SHALL increase in
RTL and Right in LTR. Vertical arrows, Home, End, PageUp and PageDown SHALL never be
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

#### Scenario: Calendar grid in RTL

- **WHEN** ArrowLeft is pressed in a `"grid"` composite with `dir="rtl"`
- **THEN** the machine receives `NEXT`

#### Scenario: Grid rows are not mirrored

- **WHEN** ArrowDown is pressed in a `"grid"` composite with `dir="rtl"`
- **THEN** the machine receives `NEXT_ROW`
