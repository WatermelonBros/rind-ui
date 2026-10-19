# splitter Specification

## Purpose
Defines the Splitter component: two or more panels on one axis with a focusable handle
between each pair (the WAI-ARIA Window Splitter pattern), resized by pointer drag or
keyboard, with sizes and constraints known before hydration.
## Requirements
### Requirement: Anatomy

A splitter SHALL consist of `Root` (default `div`), one `Panel` per entry of the Root's
`panels` prop (default `div`, prop `index`) and optional `Handle` parts (default `div`,
prop `index`: the boundary between panel `index` and panel `index + 1`). Every part SHALL
carry `data-scope="splitter"`, its `data-part` and the instance's `data-instance`. Every
part SHALL accept a `render` prop.

#### Scenario: Two panels and a handle

- **WHEN** a Root with `panels={[{}, {}]}` renders Panel 0, Handle 0 and Panel 1
- **THEN** the handle is a `separator` between them and the panels share the space

### Requirement: Sizes

Sizes SHALL be one controllable array (`sizes`, `defaultSizes`, `onSizesChange(sizes,
details)`) with one entry per panel, in percent of the panels' space (the Root's content
box minus the handles), summing to 100. A missing or wrong-length array SHALL fall back
to `defaultSizes`, then to an equal split; any array SHALL be scaled to 100 and clamped to
the constraints before it is rendered.

#### Scenario: Equal split

- **WHEN** a Root with three panels has neither `sizes` nor `defaultSizes`
- **THEN** every panel's size is 33.333…

#### Scenario: Invalid controlled sizes (Ark#2967)

- **WHEN** `sizes={[100, 0]}` is passed and panel 1 has `min: 20`
- **THEN** the panels render at 80 and 20 and nothing throws

### Requirement: Constraints

Each entry of `panels` SHALL accept `min` (default 0), `max` (default 100), `collapsible`
(default false) and `collapsedSize` (default 0). A number SHALL be a percent; a string
`"Npx"` SHALL be pixels, resolved against the measured panels' space and re-resolved on
every resize of the Root; `"N%"` SHALL be a percent. Without a measurement a pixel
constraint SHALL be ignored. When the constraints change, the sizes SHALL be clamped to
them again.

#### Scenario: Pixel minimum after a window resize (RRP#720)

- **WHEN** panel 0 has `min: "200px"`, the Root shrinks to 400 px and grows back to
  1000 px
- **THEN** panel 0 is never narrower than 200 px and its minimum is 20 % at 1000 px

### Requirement: Layout Before Hydration

The Root SHALL be a flex container on its orientation (`horizontal`, the default: panels
side by side; `vertical`: stacked). Each panel's style SHALL be computed from the sizes
alone (`flex-grow` equal to its size, a zero basis, a zero minimum on the axis), so the
server render and the hydrated render are identical.

#### Scenario: Server render (RRP#692)

- **WHEN** a Root with `defaultSizes={[30, 70]}` is rendered to a string
- **THEN** the panels' styles carry flex-grow 30 and 70 and hydration changes nothing

### Requirement: Handle Semantics

Each handle SHALL be `role="separator"`, focusable with `tabindex="0"`, with
`aria-valuenow` the size of its primary panel (the one before it), `aria-valuemin` and
`aria-valuemax` the smallest and largest sizes that panel can reach from this handle,
rounded to whole numbers; `aria-orientation` SHALL be `vertical` for a horizontal Root
and `horizontal` for a vertical one; `aria-controls` SHALL name the primary panel. A
handle without `aria-label` or `aria-labelledby` SHALL warn in development.

#### Scenario: Bounds of the second handle (RRP#740)

- **WHEN** three panels have `min: 10` each and sizes `[20, 30, 50]`
- **THEN** handle 1 has `aria-valuenow="30"`, `aria-valuemin="10"`, `aria-valuemax="70"`

#### Scenario: Orientation

- **WHEN** the Root is horizontal
- **THEN** every handle has `aria-orientation="vertical"`

### Requirement: Keyboard

On a focused, enabled handle: on a horizontal Root ArrowRight SHALL move the boundary
right and ArrowLeft left; on a vertical Root ArrowDown SHALL move it down and ArrowUp up;
each by `step` percent (default 5). Moving right (left-to-right) or down grows the primary
panel; under `dir="rtl"` the primary panel is on the right, so ArrowLeft grows it. Home
SHALL give the primary panel its smallest reachable size and End its largest. Enter SHALL
collapse a collapsible primary panel, or restore a collapsed one to its size before it
collapsed (else `min`). Arrows of the other axis and keys with Alt, Control or Meta SHALL
be left to the page. A step at `min` of a collapsible panel SHALL collapse it, and a step
from collapsed SHALL expand it to `min`.

#### Scenario: Vertical arrows (zag#2417)

- **WHEN** ArrowUp is pressed on the handle of a vertical Root at sizes `[50, 50]`
- **THEN** the sizes become `[45, 55]`

#### Scenario: Keys after hover (zag#3223)

- **WHEN** the pointer rests on a handle and the user tabs to it and presses ArrowRight
- **THEN** the sizes change

#### Scenario: Enter restores

- **WHEN** a collapsible primary panel at 30 is collapsed with Enter and Enter is pressed
  again
- **THEN** it is 30 again

### Requirement: Pointer Drag

A primary-button mouse press or a pen or touch press on an enabled handle SHALL focus the
handle without a focus ring and start a drag through `pointer-drag`; each move SHALL set
the sizes from the sizes at the press and the distance moved (mirrored in RTL). A release
SHALL end the drag; `pointercancel`, lost capture, a hidden document, Escape and the
Splitter becoming disabled SHALL cancel it and restore the sizes at the press. A second
pointer SHALL not start another drag. While dragging the Root and the dragged handle SHALL
carry `data-dragging`.

#### Scenario: Release over an iframe (RRP#688)

- **WHEN** a drag moves over a panel holding an iframe and the button is released there
- **THEN** the drag ends and no `data-dragging` remains

#### Scenario: Escape

- **WHEN** Escape is pressed during a drag
- **THEN** the sizes return to those at the press and `onSizesCommit` is not called

### Requirement: Collapse

A collapsible panel SHALL snap to `collapsedSize` when a drag would make it smaller than
the halfway point between `collapsedSize` and `min`, and to `min` above it. A collapsible
panel SHALL carry `data-state="collapsed"` at `collapsedSize` and `data-state="expanded"`
otherwise.

#### Scenario: Snap

- **WHEN** a collapsible panel with `min: 20` is dragged to 8
- **THEN** it collapses to 0 and has `data-state="collapsed"`

### Requirement: Commit

`onSizesCommit(sizes, { reason })` SHALL be called once at the end of every interaction
that changed the sizes: a release (`POINTER.UP`), a key (`STEP`, `TO_EDGE`, `TOGGLE`); never
for a cancelled drag, a constraint change or a parent's change.

#### Scenario: One commit per drag

- **WHEN** a handle is dragged through ten moves and released
- **THEN** `onSizesChange` runs per move and `onSizesCommit` once

### Requirement: Disabled

A disabled Root (`disabled`) or handle (`Handle disabled`) SHALL not be focusable, SHALL
carry `aria-disabled="true"` and `data-disabled`, and SHALL ignore keys and presses.

#### Scenario: Disabled handle

- **WHEN** Handle 0 is disabled
- **THEN** it has no `tabindex` and a press on it starts no drag

### Requirement: Nested Splitters

A Root inside a Panel of another Root SHALL be independent: its handles move only its
panels, and a drag of an inner handle SHALL not move an outer one.

#### Scenario: Nested

- **WHEN** an inner vertical Root's handle is dragged inside an outer horizontal Root
- **THEN** only the inner sizes change

### Requirement: Contract

`splitterContract` SHALL locate the instance by a handle (`separator` and its name),
declare `step`, `toEdge`, `toggleCollapse`, `setSize`, `pointerDown`, `pointerMove`,
`pointerUp` and `cancelDrag` with pointer, touch and keyboard implementations or the
reason a keyboard one does not exist, queries `sizes`, `isDragging` and `orientation`,
the `valued` and `directional` traits, and the invariants: sizes sum to 100, every handle's
value lies within its bounds, every `aria-controls` names a rendered panel. `getSplitter`
SHALL drive it.

#### Scenario: Driver

- **WHEN** a test calls `getSplitter(screen, { name: "Sidebar" }).step(0, "increase")`
- **THEN** the first panel grows by one step

