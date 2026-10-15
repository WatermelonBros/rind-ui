# heading Specification

## Purpose
Defines rind-ui's Heading and the shared heading semantics every rind-ui part that is a
heading uses: a level resolved from an explicit prop or from the nesting of
`Heading.Level` sections, native `h1`–`h6` output, the role rule for substituted
elements, clamping, and the contract. Research: `docs/research/heading.md`.
## Requirements
### Requirement: Anatomy

The Heading SHALL consist of one part, `root`, rendering `h{level}` and accepting the
props of the element it renders and the `render` prop. `Heading.Level` SHALL render no
element and only set the level for its descendants. The Heading SHALL have no state
machine: its output SHALL be a pure function of its props and the nearest level
context.

#### Scenario: Default heading

- **WHEN** `<Heading>Settings</Heading>` is rendered outside any `Heading.Level`
- **THEN** an `h2` with the text "Settings" is rendered and it has no `role` or
  `aria-level` attribute

### Requirement: Level Resolution

A Heading's level SHALL be its `level` prop when given; otherwise the level of the
nearest `Heading.Level`; otherwise 2. A `Heading.Level` without `level` SHALL set its
descendants' level to one more than the level around it (2 outside any Level, so a
first Level gives 3); with `level` it SHALL set exactly that level. Levels SHALL follow
the component tree, including into portalled content, not the DOM position.

#### Scenario: Nested sections

- **WHEN** `<Heading>Settings</Heading><Heading.Level><Heading>Profile</Heading><Heading.Level><Heading>Avatar</Heading></Heading.Level></Heading.Level>`
  is rendered
- **THEN** the headings are `h2` "Settings", `h3` "Profile" and `h4` "Avatar"

#### Scenario: Anchored page root

- **WHEN** an app shell renders `<Heading.Level level={1}><Heading>Dashboard</Heading><Heading.Level><Heading>Usage</Heading></Heading.Level></Heading.Level>`
- **THEN** the headings are `h1` "Dashboard" and `h2` "Usage"

#### Scenario: Portalled content (regression: fixed defaults, mui/base-ui#1678)

- **WHEN** a `<Heading>` is rendered through a portal from inside a `Heading.Level` whose
  level is 3
- **THEN** that heading is an `h3`, although its DOM position is at the end of `body`

#### Scenario: Explicit level wins

- **WHEN** `<Heading level={2}>` is rendered inside a section whose level is 4
- **THEN** it is an `h2`

### Requirement: Range

Levels SHALL be integers from 1 to 6. A computed level above 6 SHALL render level 6 and
cause a development warning that the outline is deeper than six levels; an explicit or
Level value outside 1–6 or not an integer SHALL be clamped to the nearest valid level
with a development warning naming the value. `aria-level` SHALL never be emitted above
6.

#### Scenario: Too deep

- **WHEN** a Heading is rendered inside five nested `Heading.Level`s (computed level 7)
- **THEN** it is an `h6` and a development warning is logged once for that heading

### Requirement: Element And Role

When the rendered element is the matching `h{level}`, the part SHALL emit neither
`role` nor `aria-level`. When the rendered element is not a heading element, the part
SHALL emit `role="heading"` and `aria-level` set to the level. When it is a heading
element of another level, the part SHALL emit `aria-level` set to the computed level and
no `role`. The rendered tag SHALL be known on the server (the default element, or the
element given to `render`), so server and client output agree.

#### Scenario: Substituted with a div

- **WHEN** a level-3 Heading is rendered with `render={<div />}`
- **THEN** the element has `role="heading"` and `aria-level="3"`

#### Scenario: Styled with another native heading

- **WHEN** a level-2 Heading is rendered with `render={<h4 />}`
- **THEN** the `h4` has `aria-level="2"` and no `role`, and it is exposed as a heading of
  level 2

#### Scenario: Server rendering

- **WHEN** a Heading inside a `Heading.Level` is server-rendered and hydrated
- **THEN** server and client render the same tag and attributes and hydration logs no
  mismatch

### Requirement: Content

A Heading that is exposed (not `aria-hidden`) and has no text content and no
`aria-label`/`aria-labelledby` SHALL cause a development warning (empty heading). The
Heading SHALL add no `id`-based relations of its own; hosts that label an element with a
heading SHALL own the id and the relation.

#### Scenario: Empty heading

- **WHEN** `<Heading>{""}</Heading>` is rendered
- **THEN** a development warning names the empty heading

#### Scenario: Hidden visual heading

- **WHEN** `<Heading aria-hidden="true">March 2026</Heading>` is rendered beside an
  equivalent accessible label
- **THEN** nothing is logged and the heading is not exposed

### Requirement: Shared Heading Semantics

The level resolution, range and element rules SHALL be available to other rind-ui
parts that render headings (dialog, alert dialog, drawer and popover titles, accordion
headers) and to consumer components, as a framework-neutral function of `{ level, tag }`
in the core and a hook returning the current context level in each framework adapter, so
every heading part follows the same rules.

#### Scenario: Consumer card title

- **WHEN** a consumer's `CardTitle` component renders `h{useHeadingLevel()}` inside a
  section whose level is 3
- **THEN** its title is an `h3`

### Requirement: Data Attributes

The root SHALL carry `data-scope="heading"`, `data-part="root"`, `data-instance` and
`data-level` (`"1"`–`"6"`, the computed level), and SHALL forward `data-variant`,
`data-size` and `data-tone` unchanged. The core SHALL NOT read them.

#### Scenario: Styling hook

- **WHEN** a level-3 Heading is rendered
- **THEN** it has `data-scope="heading"`, `data-part="root"` and `data-level="3"`

### Requirement: Heading Contract

The `heading` contract SHALL locate an instance by role `heading` and exact accessible
name, failing and listing every match when more than one matches. It SHALL declare no
actions, the query `level()` (from `aria-level` or the tag) and no traits.

#### Scenario: Driver reads the level

- **WHEN** a test runs `const h = getHeading(screen, { name: "Profile" })` on the nested
  sections example
- **THEN** `await h.level()` is 3

#### Scenario: Same test in Playwright

- **WHEN** the same test runs with `page`
- **THEN** it passes unchanged

### Requirement: Theme Expectations

The theme stylesheet SHALL size and weight headings from `data-level` with
`--rind-heading-<n>-*` tokens (font size, line height, weight) read with typography
fallbacks, so the default look follows the level, and SHALL let a consumer change the
size with CSS without changing the level. It SHALL read no variant tokens (Heading
belongs to no variant family).

#### Scenario: Size is not level (regression: adobe/react-spectrum#7671, #5077)

- **WHEN** a consumer sets `--rind-heading-2-font-size` on a card to the value of level 4
- **THEN** the card's `h2` titles render at that size and are still exposed at level 2

