# separator Specification

## Purpose
Defines rind-ui's Separator: a static, never-focusable divider between groups of content
or controls, and the shared separator semantics every component that draws a divider
uses — role by context, orientation, decorative mode, attributes and contract.
## Requirements
### Requirement: Anatomy

The Separator SHALL consist of one part, `root`, rendering a `div` by default. The part
SHALL accept the props of the element it renders and SHALL support element substitution
(for example `<hr>`) without a change in behaviour other than the role rule below. When
the rendered element is a void element such as `<hr>`, the part SHALL render no children.
The Separator SHALL have no state machine: its output SHALL be a pure function of its
props and context.

#### Scenario: Rendered as hr on the server

- **WHEN** a Separator rendered as `<hr>` is server-rendered and hydrated
- **THEN** the HTML has no children inside the `hr` and hydration logs no mismatch
  (regression: chakra-ui/ark#3555)

### Requirement: Semantic Separator

By default the Separator SHALL be exposed to assistive technology as a separator: a
`div` (or any element without an implicit separator role) SHALL carry
`role="separator"`; an `<hr>` SHALL carry no `role` attribute, since its implicit role is
`separator`. `aria-orientation="vertical"` SHALL be set only when the orientation is
vertical; a horizontal separator SHALL carry no `aria-orientation`. The Separator SHALL
emit no other role in any configuration.

#### Scenario: Vertical div

- **WHEN** `<Separator orientation="vertical" />` is rendered
- **THEN** the element has `role="separator"` and `aria-orientation="vertical"`

#### Scenario: Horizontal hr

- **WHEN** a horizontal Separator is rendered as `<hr>`
- **THEN** the element has neither `role` nor `aria-orientation` and is exposed as a
  separator (regression: ariakit#721)

#### Scenario: Only two outcomes

- **WHEN** a Separator is rendered in every combination of orientation, decorative mode
  and context
- **THEN** its role is always `separator`, implicit `separator` or `none` (regression:
  huntabyte/bits-ui#2090, radix-ui/primitives#949)

### Requirement: Decorative Separator

With `decorative`, the Separator SHALL carry `role="none"` and no `aria-orientation`,
so it is removed from the accessibility tree, and it SHALL keep its `data-*` attributes
for styling.

#### Scenario: Decorative rule

- **WHEN** `<Separator decorative />` is rendered between two paragraphs
- **THEN** the accessibility tree has no separator between them and the element still
  has `data-orientation="horizontal"`

### Requirement: Orientation

`orientation` SHALL be `horizontal` (default) or `vertical`. An `undefined` value SHALL
mean the default; any other value SHALL fall back to `horizontal` and emit a
development warning naming the value. When a component supplies a default orientation
from its context (a toolbar's separator is perpendicular to the toolbar), an explicit
`orientation` prop SHALL always win. `data-orientation` SHALL always state the
separator's own orientation, not its container's.

#### Scenario: Undefined orientation

- **WHEN** `orientation={undefined}` is passed
- **THEN** the separator is horizontal and nothing is logged (regression:
  radix-ui/primitives#216)

#### Scenario: Explicit orientation in a toolbar

- **WHEN** a separator in a horizontal toolbar is rendered with `orientation="horizontal"`
- **THEN** it is horizontal, although the toolbar default would make it vertical
  (regression: ariakit#6302)

#### Scenario: Toolbar separator orientation

- **WHEN** a separator with no `orientation` is rendered in a horizontal toolbar
- **THEN** it has `data-orientation="vertical"` and `aria-orientation="vertical"`
  (regression: mui/base-ui#4647)

### Requirement: Role By Context

The shared separator semantics SHALL take a context — `content` (default), `menu`,
`toolbar` or `listbox` — supplied by the component that renders the separator. In
`content`, `menu` and `toolbar` the semantic and decorative rules above SHALL apply. In
`listbox` (Listbox, Select, Combobox, Autocomplete popups), where `separator` is not an
allowed child role, the separator SHALL always carry `role="none"` and no
`aria-orientation`, whatever its props.

#### Scenario: Separator in a select popup

- **WHEN** a separator is rendered between two options of an open listbox and the
  popup is checked with axe
- **THEN** the separator has `role="none"` and `aria-required-children` passes
  (regression: mui/base-ui#5398, ariakit#3315)

#### Scenario: Separator in a menu

- **WHEN** a separator is rendered between two groups of menu items
- **THEN** it has `role="separator"` and is not an item of the menu

### Requirement: Never Focusable

The Separator SHALL never be focusable, never be a composite item, never carry
`aria-valuenow`, `aria-valuemin`, `aria-valuemax` or `aria-valuetext`, and SHALL never
respond to keyboard or pointer input. When a consumer passes a `tabIndex` of `0` or
more, or any `aria-value*` attribute, a development warning SHALL say that a focusable
separator is a window splitter and name the Splitter component. Composites SHALL skip
separators in navigation.

#### Scenario: Resizable divider attempt

- **WHEN** a consumer renders `<Separator tabIndex={0} aria-valuenow={50} />`
- **THEN** a development warning names Splitter as the component for resizable dividers

#### Scenario: Toolbar navigation

- **WHEN** focus is on the button before a separator in a toolbar and the user presses
  ArrowRight
- **THEN** focus moves to the control after the separator

### Requirement: Accessible Name

A Separator SHALL have no accessible name by default. A consumer `aria-label` or
`aria-labelledby` SHALL be forwarded on a semantic separator and SHALL NOT be emitted on
a decorative one or in the `listbox` context, where the role is `none`. Text children
SHALL NOT be relied on for a name: the separator role's children are presentational.

#### Scenario: Labelled separator

- **WHEN** `<Separator aria-label="Advanced settings" />` is rendered
- **THEN** it is a separator named "Advanced settings"

#### Scenario: Label on a decorative separator

- **WHEN** `<Separator decorative aria-label="x" />` is rendered
- **THEN** the element carries no `aria-label` and a development warning says decorative
  separators cannot be named

### Requirement: Data Attributes

The `root` part SHALL carry `data-scope="separator"` (or the scope of the component that
renders it, with `data-part="separator"`), `data-part="root"`, `data-instance`,
`data-orientation` (`horizontal` | `vertical`) always, and `data-decorative` when
decorative or when the context forces `role="none"`. It SHALL forward the consumer
attributes `data-variant`, `data-size` and `data-tone` unchanged.

#### Scenario: Styling hooks

- **WHEN** a decorative vertical separator is rendered
- **THEN** it has `data-scope="separator"`, `data-part="root"`,
  `data-orientation="vertical"` and `data-decorative`

### Requirement: Separator Contract

The `separator` contract SHALL locate an instance by role `separator` and exact
accessible name when it is named, and otherwise by `data-scope` and `data-part` inside a
container the driver is given, failing and listing every match when more than one
matches. It SHALL declare no actions and the queries `orientation()` (from
`data-orientation`), `isDecorative()` (true when the element is not exposed as a
separator) and `isExposed()`. It SHALL declare no traits.

#### Scenario: Driver queries

- **WHEN** a test runs `const s = getSeparator(screen, { within: toolbar })` on a
  toolbar with one separator
- **THEN** `await s.orientation()` is `"vertical"` and `await s.isDecorative()` is false

#### Scenario: Same test in Playwright

- **WHEN** the same test runs with `page`
- **THEN** it passes unchanged

### Requirement: Theme Expectations

The theme stylesheet SHALL draw the separator as a border (not a background-filled box),
SHALL make a vertical separator stretch to its container's cross size, and SHALL keep it
visible under `forced-colors: active`. It SHALL read only `--rind-separator-*` tokens
with semantic fallbacks.

#### Scenario: Vertical separator in a flex row

- **WHEN** a vertical separator is placed in a flex row of buttons
- **THEN** it is as tall as the row (regression: radix-ui/primitives#1926)

#### Scenario: High contrast

- **WHEN** the separator story is rendered with `forced-colors: active`
- **THEN** the separator line is visible, because it is a border and not a background

