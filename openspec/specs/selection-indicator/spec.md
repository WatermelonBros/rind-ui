# selection-indicator Specification

## Purpose
Defines how a composite with a sliding selection highlight (Tabs, Segmented Control)
measures its selected item and exposes the result as CSS custom properties and data
attributes, so themes can animate the highlight without JavaScript and without the
measurement bugs every library hit.
## Requirements
### Requirement: Measured Box As Custom Properties

An indicator part SHALL expose the selected item's box relative to its container (the
element the indicator is positioned in) as `--rind-indicator-left`,
`--rind-indicator-right`, `--rind-indicator-top`, `--rind-indicator-bottom`,
`--rind-indicator-width` and `--rind-indicator-height`, in CSS pixels. Offsets SHALL be
layout offsets: they SHALL ignore CSS transforms on the item's ancestors, SHALL be
corrected for the scroll position of elements between the item and the container (but
not the container's own scroll), and SHALL NOT depend on the viewport scroll position.
Width and height SHALL never be rounded up beyond the item's size. The values SHALL reach
the element through the component's connect output (state), never through imperative
style writes.

#### Scenario: Inside a scaling dialog (base-ui#3425, base-ui#4837)

- **WHEN** Tabs are rendered in a dialog whose open animation scales it from 0.9 to 1
- **THEN** the indicator variables equal the selected tab's unscaled offsets and size
  during and after the animation

#### Scenario: Page scrolled (react-spectrum#9931, zag#2810)

- **WHEN** the page or a scroll container around the component is scrolled and the
  selection changes
- **THEN** the variables are the same as they would be without the scroll

#### Scenario: Fractional sizes (base-ui#2235)

- **WHEN** the selected item is 100.4 px wide
- **THEN** `--rind-indicator-width` is not larger than 100.4px and the list does not
  overflow because of the indicator

#### Scenario: Strict mode and hydration (react-spectrum#10570)

- **WHEN** the component is server-rendered and hydrated under React StrictMode
- **THEN** after the first measurement the indicator's variables equal the selected
  item's box and no stale inline style remains

### Requirement: Re-Measurement

The indicator SHALL be re-measured when the selection changes, when items register or
unregister, and when the container or any item changes size, and on the first layout
after mount (including a conditional mount). Measurements SHALL run in the same commit as
the change that caused them, not in a later frame.

#### Scenario: Sibling resizes (base-ui#4156, zag#3100)

- **WHEN** a non-selected tab's label becomes longer and pushes the selected tab to the
  right
- **THEN** the indicator follows the selected tab

#### Scenario: Conditional mount (ark#3435, ark#3703)

- **WHEN** a component with a `defaultValue` is mounted after the first render of the page
- **THEN** the indicator is visible under the default item once laid out, without another
  interaction

### Requirement: Layout Moves Never Animate

The indicator SHALL carry `data-resizing` while its position changes for a reason other
than a selection change (first measurement, container or item resize, items registering),
and SHALL NOT carry it for a move caused by a selection change, so a theme can disable its
transition with `[data-resizing]`. The first measurement SHALL position the indicator
without a transition; the first selection change after it SHALL be animatable.

#### Scenario: No animation on load (base-ui#998)

- **WHEN** the page loads with the second tab selected
- **THEN** the indicator carries `data-resizing` for its first positioning

#### Scenario: First change animates (ark#1129)

- **WHEN** the user selects another item for the first time
- **THEN** the indicator does not carry `data-resizing` for that move

#### Scenario: Window resize (react-spectrum#1462)

- **WHEN** the window is resized while an item is selected
- **THEN** the indicator carries `data-resizing` while it follows the item

### Requirement: Visibility And Semantics

The indicator SHALL carry `hidden` while nothing is selected or no measurement exists
yet (server render, jsdom without layout). It SHALL be decorative: `aria-hidden="true"`,
no role, never focusable, no text content provided by the component. It SHALL carry
`data-scope` of its component, `data-part="indicator"`, `data-orientation` and
`data-state` (`"visible"` or `"hidden"`).

#### Scenario: Nothing selected

- **WHEN** the component's value is `null`
- **THEN** the indicator has the `hidden` attribute and `data-state="hidden"`

#### Scenario: Server render

- **WHEN** a component with a selected item is rendered on the server
- **THEN** the indicator is rendered with `hidden` and no custom properties

