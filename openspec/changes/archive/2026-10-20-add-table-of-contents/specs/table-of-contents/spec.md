## ADDED Requirements

### Requirement: Anatomy

A Table of Contents SHALL consist of `Root` (a `nav` landmark), `List` (`ol`), and an `Item`
with a `Link` per section, and MAY contain `Title` and `Indicator`. `Root` SHALL be named by
`Title` when rendered, else by `messages.label` ("On this page"). `Link` SHALL be an
`<a href="#id">`. Every part SHALL accept the `render` prop.

#### Scenario: Landmark

- **WHEN** a Table of Contents without a Title is rendered
- **THEN** it is a navigation landmark named "On this page" with one link per section

### Requirement: Current Section

Exactly one Link SHALL carry `aria-current="location"`: the section being read. That is the
last heading whose top is above the reading line, at `offset` plus `ratio` (default 1/3) of
the scroll root's remaining height. Before the first heading, the first section SHALL be
current. Within 2 px of the end of the scroll range, the last heading whose top is inside the
root SHALL be current. `value` SHALL be controllable with `onValueChange`.

#### Scenario: Bottom of the page (Starlight #1954, Fumadocs #670)

- **WHEN** the page is scrolled to its end and the last two sections are short
- **THEN** the last section is current

### Requirement: Visible Sections

Every Item and Link whose section intersects the scroll root SHALL carry `data-visible`. Being
visible SHALL NOT make a link current.

#### Scenario: Two visible, one current

- **WHEN** two sections are visible
- **THEN** both links carry `data-visible` and only one carries `aria-current`

### Requirement: Navigation

Activating a Link SHALL navigate natively to `#id` (history and URL included), and SHALL make
that section current at once. Until the scroll settles, scroll positions passed on the way
SHALL NOT change the current section. With keyboard or virtual modality, focus SHALL move to
the heading. Modified and middle clicks SHALL stay native. The jump SHALL be the browser's own, so it
follows the document's `scroll-behavior` and the headings' `scroll-margin-top`.

#### Scenario: No flicker (tocbot #376)

- **WHEN** the user clicks the last link while the first section is current
- **THEN** the last link is current at once and no other link becomes current during the
  scroll

#### Scenario: Focus follows

- **WHEN** a keyboard user activates the "Install" link
- **THEN** focus is on the "Install" heading

### Requirement: Scroll Root And Offset

The scroll root SHALL be the window, or `scrollRoot` when given. `offset` (px) SHALL shift the
reading line below a sticky header. Headings that are missing or not rendered SHALL be skipped.

#### Scenario: Container

- **WHEN** the content scrolls inside a container passed as `scrollRoot`
- **THEN** the current section follows that container's scroll

### Requirement: List Follows

When the List scrolls (overflow), the current Item SHALL be kept in view within the List,
without scrolling the page.

#### Scenario: Long table of contents (Starlight #3617)

- **WHEN** the current item is outside the List's visible area
- **THEN** the List scrolls to show it and the page does not move

### Requirement: Data Attributes

Parts SHALL carry `data-scope="table-of-contents"`, `data-part` and `data-instance`. Item and
Link SHALL carry `data-depth`, `data-current` and `data-visible`. No two parts SHALL share an
id.

#### Scenario: Depth

- **WHEN** an h3 follows an h2
- **THEN** its Item has `data-depth="1"`

### Requirement: Contract

The Table of Contents SHALL ship `tableOfContentsContract`, located by the nav's name, with
the action `follow`, the queries `current`, `visible` and `focusedHeading`, and a
`getTableOfContents` driver.

#### Scenario: Driver

- **WHEN** a test calls `follow("Install")`
- **THEN** `current()` is "Install"

### Requirement: Theme

`@rind-ui/theme` SHALL ship `table-of-contents.css` in `@layer rind.components` with `:where()`
selectors, family `decoration`, the current link distinguished by more than colour (weight and
the indicator), and forced-colours support.

#### Scenario: Not colour alone

- **WHEN** a link is current
- **THEN** it differs from the others in weight and the indicator marks it
