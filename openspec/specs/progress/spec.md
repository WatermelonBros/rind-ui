# progress Specification

## Purpose
Defines rind-ui's Progress: a determinate or indeterminate indicator of a task's
advance, as a bar or a ring, with its parts, ARIA, value text, opt-in completion
announcement, styling attributes, contract and theme. Research:
`docs/research/progress.md`.
## Requirements
### Requirement: Anatomy

A Progress SHALL consist of `Root` (a `div` with `role="progressbar"`), `Label` (a
`span`), `ValueText` (a `span` with `aria-hidden="true"`, whose default content is the
value text), `Track`, `Indicator`, and, for a ring, `Circle` (an `svg` with
`aria-hidden="true"`), `CircleTrack` and `CircleIndicator` (`circle` elements). Every
part SHALL accept the `render` prop. The role SHALL be on Root, never on the Track or
the `svg`.

#### Scenario: Default markup

- **WHEN** a Progress with a Label "Uploading" and value 40 is rendered
- **THEN** exactly one element has role `progressbar`, its accessible name is
  "Uploading", and it has `aria-valuenow="40"`

### Requirement: Value

Progress SHALL take a read-only `value: number | null` (default `null`), `min` (default
0) and `max` (default 100), normalised by `range-value`. `null` or `undefined` SHALL be
indeterminate. The value is never changed by Progress itself.

#### Scenario: Undefined is indeterminate (RX PR#2947)

- **WHEN** `value={undefined}` is passed
- **THEN** the Progress is indeterminate and no error is logged

### Requirement: ARIA Semantics And Name

Root SHALL carry the value attributes of `range-value` and `aria-labelledby` pointing at
the Label while it is rendered; a consumer `aria-label` or `aria-labelledby` SHALL be
used as given. The value text SHALL never be the name. A Progress with no name SHALL
cause a development error, unless Root is `aria-hidden`. Root SHALL contain, as its last
child, a visually hidden `span` with `role="presentation"` and a single character, so
NVDA reports the name (quirk entry `nvda-progressbar-name`, BU#4184, nvda#13904); the
`span` SHALL be rendered on the server too.

#### Scenario: NVDA name (BU#4184)

- **WHEN** a Progress labelled "Uploading" is rendered
- **THEN** Root contains the visually hidden filler span, and the quirks registry lists
  `nvda-progressbar-name` with its repro test and removal condition

#### Scenario: Decorative progress (RS#9987)

- **WHEN** a Progress with `aria-hidden="true"` on Root has no label
- **THEN** no development error is reported

### Requirement: States

Progress SHALL be `indeterminate` when the value is null, `complete` when it equals
`max`, and `loading` otherwise, exposed as `data-state` on every part.

#### Scenario: Complete

- **WHEN** `value` equals `max`
- **THEN** every part has `data-state="complete"`

### Requirement: Value Text

`aria-valuetext` and `ValueText`'s default content SHALL be the value text of
`range-value`, through `messages.valueText({ value, percent, formatted })`. When
indeterminate, `ValueText` SHALL render nothing by default.

#### Scenario: Percent of a custom range

- **WHEN** `min` is 0, `max` is 8 and `value` is 2
- **THEN** `aria-valuetext` is "25%" and `aria-valuenow` is 2

### Requirement: Not A Live Region

No part of a Progress SHALL be a live region. When `announceCompletion` is true, the
Progress SHALL announce `messages.complete` (default "Complete") through the Announcer,
politely and keyed per instance, once each time the value changes to `max` from a value
below it or from indeterminate. It SHALL announce nothing on mount, nothing for other
value changes, and nothing when `announceCompletion` is false (the default).

#### Scenario: Upload completes

- **WHEN** a Progress with `announceCompletion` goes 40 → 90 → 100
- **THEN** exactly one announcement "Complete" is made, after the change to 100

#### Scenario: Mounted complete

- **WHEN** a Progress with `announceCompletion` mounts with `value` equal to `max`
- **THEN** no announcement is made

#### Scenario: No flood (Zag live ValueText)

- **WHEN** the value changes 50 times while loading
- **THEN** no element of the Progress has `aria-live` and no announcement is made

### Requirement: Fill And Ring

The Indicator SHALL carry `--rind-progress-percent` (0–100, unitless) and an inline size
of that percent along its orientation (`inline-size` when horizontal, `block-size` when
vertical), including `0%` at 0; when indeterminate it SHALL carry neither. The
`CircleTrack` and `CircleIndicator` SHALL use `pathLength="100"`; the `CircleIndicator`
SHALL have `stroke-dasharray="100"` and `stroke-dashoffset` equal to `100 − percent`, so
the ring needs no radius computation, and SHALL omit the offset when indeterminate.

#### Scenario: Ring at a quarter

- **WHEN** a ring Progress has value 25
- **THEN** its CircleIndicator has `stroke-dashoffset="75"`

### Requirement: Data Attributes

Every part SHALL carry `data-state` and `data-orientation`; Root SHALL also carry
`data-value` (when determinate), `data-min` and `data-max`. `data-variant`, `data-size`
and `data-tone` SHALL pass through untouched.

#### Scenario: Orientation

- **WHEN** `orientation="vertical"` is set
- **THEN** every part has `data-orientation="vertical"` and Root has no
  `aria-orientation`

### Requirement: Contract

The progress contract SHALL locate an instance by role `progressbar` and exact name, and
SHALL declare no user actions; queries `value()` (number or `null`), `valueText()`,
`percent()`, `state()` and `name()`; prop steps for value changes; the completion
announcement; and the trait `valued` with `values(view)` returning the normalised value.

#### Scenario: Driver reads indeterminate

- **WHEN** `getProgress(screen, { name: "Uploading" }).value()` runs on an indeterminate
  Progress
- **THEN** it returns `null`

### Requirement: Theme

`progress.css` SHALL style the bar and the ring on data attributes and
`--rind-progress-*` tokens: the fill from `--rind-progress-percent`; an indeterminate
animation only under `prefers-reduced-motion: no-preference`, and under reduced motion a
static segment distinguishable from a determinate fill without colour; a ring whose
indeterminate state shows a partial arc, not a full ring; the fill transition through
duration tokens; under `forced-colors: active` a `Highlight` fill or stroke and a
`CanvasText` track edge. It SHALL style its theme family's `data-variant` and `data-size`.

#### Scenario: Indeterminate ring (ZG#1716)

- **WHEN** an indeterminate ring Progress is rendered
- **THEN** it shows a partial arc, animated unless reduced motion is requested

#### Scenario: Forced colors (RS#4069)

- **WHEN** a Progress at 40 is rendered under forced colors
- **THEN** the filled part is visible against the track

