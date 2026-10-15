# react-adapter Specification

## Purpose
Defines how `@rind-ui/react` binds framework-agnostic machine services to React so
that parts stay thin, re-render only for the state they read, compose with consumer
props and elements, and render safely on the server.
## Requirements
### Requirement: Binding A Service

The adapter SHALL create one service per component instance, push the latest props
to it on every commit, start it after mount and stop it on unmount, and read its
snapshot through React's external-store mechanism. It SHALL work under React strict
mode, concurrent rendering and server rendering without tearing, duplicate effects
or hydration mismatches.

#### Scenario: Strict mode

- **WHEN** a component mounts under `<StrictMode>`
- **THEN** each effect of the active state is active once after mount, and every
  cleanup has run after unmount

#### Scenario: Server render and hydration

- **WHEN** a component is rendered on the server and hydrated on the client with the
  same props
- **THEN** the markup matches and no effect runs on the server

### Requirement: Per-Part Subscriptions

A part SHALL be able to subscribe to a selected slice of the snapshot and SHALL
re-render only when that slice changes by its equality function.

#### Scenario: Unrelated change

- **WHEN** a state change does not affect the slice a part selects
- **THEN** that part does not re-render

### Requirement: Prop Normalisation

The adapter SHALL convert the framework-neutral props produced by `connect` into
React props (event handler names and types, `class` to `className`, style objects),
in one place shared by every part.

#### Scenario: Neutral attributes reach the DOM

- **WHEN** `connect` produces `aria-*`, `data-*`, `id`, `role` and an event handler
  for a part
- **THEN** the rendered element carries the same attributes and the handler fires on
  the corresponding DOM event

### Requirement: Merging Consumer Props

Every part SHALL accept and forward all props of the element it renders. When a
consumer passes a prop the part also sets: event handlers SHALL both run, the
consumer's first; the consumer SHALL be able to skip the part's handler for that
event explicitly (`event.preventRindHandler()`), independent of
`event.preventDefault()`; class names SHALL be concatenated; style objects SHALL be
merged with the consumer's values winning; refs SHALL be composed; `id` from the
consumer SHALL replace the generated one and be used in every ARIA relation that
references it; for every other attribute the consumer's value SHALL win, except
attributes the component's accessibility depends on, which SHALL produce a
development warning when overridden.

#### Scenario: Both handlers run

- **WHEN** a consumer passes `onClick` to a trigger part
- **THEN** the consumer's handler runs, then the part's, and the machine receives
  its event

#### Scenario: Consumer opts out of the part's handler

- **WHEN** the consumer's handler calls `event.preventRindHandler()`
- **THEN** the part's handler for that event does not run, and native default
  behaviour is unaffected

#### Scenario: Consumer id

- **WHEN** a consumer sets `id="my-title"` on a title part
- **THEN** the element that references the title (`aria-labelledby`) points at
  `my-title`

### Requirement: Element Substitution

Every part SHALL accept a `render` prop that is either an element or a function
receiving the merged props (and, for parts with state, the relevant state) and
returning an element. The rendered element SHALL receive all props, refs and
handlers the part would have applied to its default element, so substituting the
element does not change behaviour.

#### Scenario: Render as a link

- **WHEN** a trigger part is given `render={<a href="/x" />}`
- **THEN** the anchor receives the trigger's ARIA attributes, handlers and ref, and
  activating it sends the trigger's event

### Requirement: Stable Ids

Each component instance SHALL get one root id from React's `useId` (or from the
consumer's `id` on the root), and every part and item id SHALL be derived
deterministically from that root id and the part name or item key, so server and
client render identical ids. Ids SHALL be overridable per part. ARIA relations SHALL
reference only parts that are currently rendered.

#### Scenario: Two instances

- **WHEN** two instances of a component render on one page
- **THEN** no id is shared between them

#### Scenario: Hydration

- **WHEN** a component with items is server-rendered and hydrated
- **THEN** every id matches and React reports no hydration warning

#### Scenario: Unrendered part

- **WHEN** a component's Description part is not rendered
- **THEN** no element references the description's id

### Requirement: Expected Parts

A component's anatomy SHALL be able to declare parts as expected (for example Title
and Description). Part registration SHALL never mutate shared state during render.
For an expected part, the referencing attribute (`aria-labelledby`,
`aria-describedby`, …) SHALL be rendered with the part's derived id on the server
and during hydration, so server HTML carries the relation even when the part renders
after the element that references it. After commit, if an expected part did not
register, the attribute SHALL be removed and a development warning emitted. Parts
that are not expected SHALL be picked up after commit.

#### Scenario: Dialog title inside content on the server

- **WHEN** a dialog with a Title inside its Content is server-rendered open
- **THEN** the server HTML's dialog element has `aria-labelledby` pointing at the
  Title's id, and hydration logs no mismatch

#### Scenario: Render that never commits

- **WHEN** a Title renders in a tree that suspends and never commits
- **THEN** no committed element references the Title's id

#### Scenario: Expected part omitted

- **WHEN** a dialog is rendered without a Title
- **THEN** after commit the dialog has no `aria-labelledby` and a development warning
  names the missing part

### Requirement: Instance Scoping Attributes

Every rendered part SHALL carry `data-scope` (the component), `data-part` (the part
name) and `data-instance` (the instance id), whether or not it is portalled.

#### Scenario: Portalled part

- **WHEN** a part is rendered in a portal outside the root
- **THEN** it still carries the instance's `data-instance` value

