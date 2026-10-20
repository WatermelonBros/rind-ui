# timeline Specification

## Purpose
TBD - created by archiving change add-timeline. Update Purpose after archive.
## Requirements
### Requirement: Anatomy

A Timeline SHALL be an `<ol>` (`Root`) of `<li>` (`Item`) events. Each Item MAY contain an
`aria-hidden` `Indicator` and `Connector`, and a `Content` with `Title`, `Description`,
`Time` (`<time datetime>`) and `Opposite`. Every part SHALL accept the `render` prop.

#### Scenario: Ordered list

- **WHEN** a Timeline with three Items is rendered
- **THEN** it is a list of three list items in DOM order

### Requirement: Status

An Item MAY take a `status`: `completed`, `current`, `pending` or `upcoming`. Root `current`
SHALL derive the statuses (completed before, current at, upcoming after), and an Item's own
`status` SHALL win. On a progress timeline, meaning when any status is known, each Title
SHALL end with a visually hidden status text, and the current Item SHALL carry
`aria-current="step"`.

#### Scenario: Not colour alone

- **WHEN** `current={1}` is set on three Items titled Ordered, Shipped and Delivered
- **THEN** the second Item carries `aria-current="step"` and the texts read "Ordered
  (completed)", "Shipped (current)" and "Delivered (not started)"

#### Scenario: Plain log

- **WHEN** no status and no `current` is given
- **THEN** no status text and no `aria-current` is rendered

### Requirement: Layout

`orientation` (vertical, horizontal) and `align` (start, end, alternate) SHALL be exposed as
`data-orientation`, `data-align` and a per-Item `data-side`. The reading order SHALL always be
the DOM order.

#### Scenario: Alternate

- **WHEN** `align="alternate"` is set
- **THEN** Items carry `data-side` start, end, start, … and keep their DOM order

### Requirement: Time

`Time` SHALL render a `<time>` with `dateTime` from a `Date` or string, and the children, or
the date formatted for the locale when there are none.

#### Scenario: Machine-readable

- **WHEN** `<Timeline.Time dateTime={new Date("2026-10-20T09:00:00Z")} />` is rendered
- **THEN** a `time` element carries `datetime="2026-10-20T09:00:00.000Z"`

### Requirement: Data Attributes

Parts SHALL carry `data-scope="timeline"`, `data-part` and `data-instance`. Item parts SHALL
carry `data-status` when known, the Item SHALL carry `data-index` and `data-side`, and the
last Connector SHALL carry `data-last`.

#### Scenario: Last

- **WHEN** three Items are rendered
- **THEN** only the third Item's Connector carries `data-last`

### Requirement: Contract

The Timeline SHALL ship `timelineContract` with the queries `count`, `current`, `status` and
`titles`, and a `getTimeline` driver.

#### Scenario: Driver

- **WHEN** a test reads `current()` with `current={1}`
- **THEN** it is 1

### Requirement: Theme

`@rind-ui/theme` SHALL ship `timeline.css` in `@layer rind.components` with `:where()`
selectors, family `decoration`. The statuses SHALL be told apart by shape (filled, ringed,
hollow, dashed) as well as colour, with reduced-motion and forced-colours support.

#### Scenario: Shape

- **WHEN** completed, current and upcoming Items are rendered
- **THEN** their indicators differ in fill or border, not only in colour

