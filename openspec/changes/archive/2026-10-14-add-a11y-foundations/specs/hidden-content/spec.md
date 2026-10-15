## Purpose

Defines how rind-ui hides content visually while keeping it for assistive technology,
and how closed-but-mounted content stays findable by find-in-page and fragment
navigation through `hidden="until-found"`.

## ADDED Requirements

### Requirement: Visually Hidden Content

rind-ui SHALL provide one visually hidden style (1 px, clipped with both `clip` and
`clip-path: inset(50%)`, `overflow: hidden`, `white-space: nowrap`, fixed position so
it never causes scroll jumps inside scroll containers) with a variant positioned
absolutely for hidden form inputs, so native validation bubbles anchor near the
control. `@rind-ui/react` SHALL offer a `VisuallyHidden` part with a `focusable`
option that reveals the content while it has focus. Content that must be announced, or
that provides a name from content, SHALL NOT be hidden with `display: none`.

#### Scenario: Read but not seen

- **WHEN** a visually hidden "Close" label is rendered inside an icon button
- **THEN** the button's accessible name is "Close" and the label occupies no visible
  area

#### Scenario: Skip link

- **WHEN** a focusable `VisuallyHidden` link receives keyboard focus
- **THEN** it becomes visible until it loses focus

#### Scenario: Hidden native input

- **WHEN** a component renders a native input for form validation with the input
  variant
- **THEN** the input has `tabIndex=-1` and `aria-hidden="true"` and does not duplicate
  the visible control's role and name

### Requirement: Find-In-Page Reveal

A component that keeps closed content mounted SHALL be able to render it with
`hidden="until-found"`, set imperatively after every render so neither the framework
nor the browser's own removal leaves it in a different state. A `beforematch` event on
that content SHALL send the machine its open event with `reason: "find-in-page"`; if a
controlled consumer refuses the change, the content SHALL return to
`hidden="until-found"`. A reveal from find-in-page SHALL mark the content with
`data-reveal="find-in-page"` for that transition so the theme can skip the opening
animation. Where `until-found` is unsupported the content SHALL behave as plain
`hidden`.

#### Scenario: Find-in-page opens a collapsible

- **WHEN** the user searches the page for text inside a closed collapsible rendered
  with `hidden="until-found"`
- **THEN** the machine receives its open event with `reason: "find-in-page"` and the
  content is open and carries `data-reveal="find-in-page"`

#### Scenario: Controlled consumer refuses

- **WHEN** a controlled consumer does not apply the open value proposed by a
  `beforematch` reveal
- **THEN** the content carries `hidden="until-found"` again in the next frame

Because React 19 serialises `hidden="until-found"` as `hidden=""`, server HTML SHALL
carry `hidden=""` and the client SHALL upgrade it to `until-found` right after
hydration. To keep deep links working, after hydration a component with closed
`until-found` content SHALL check whether the document's current fragment target
(`location.hash`) is inside that content and, if so, send its open event with
`reason: "find-in-page"` and scroll the target into view. Find-in-page before
hydration completes is a documented limitation.

#### Scenario: Server render

- **WHEN** a closed collapsible with `hiddenUntilFound` is rendered on the server
- **THEN** the HTML contains the content with `hidden=""`, and after hydration it carries
  `hidden="until-found"`

#### Scenario: Deep link into closed content

- **WHEN** the page `/faq#refunds` is server-rendered with the `#refunds` heading inside a
  closed accordion panel, and hydration completes
- **THEN** that panel opens with `reason: "find-in-page"` and the heading is scrolled into
  view

### Requirement: Inert Value Across React Versions

`@rind-ui/react`'s prop normalisation SHALL render a boolean `inert` correctly on every
supported React version (an empty-string attribute when true, absent when false).

#### Scenario: React 18

- **WHEN** a part passes `inert: true` under React 18
- **THEN** the element has the `inert` attribute
