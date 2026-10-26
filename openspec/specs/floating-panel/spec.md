# floating-panel Specification

## Purpose
TBD - created by archiving change add-floating-panel. Update Purpose after archive.
## Requirements
### Requirement: Floating Panel Anatomy

A Floating Panel SHALL consist of `Root`, `Positioner`, `Content` (`role="dialog"`, labelled by
the `Title`, no `aria-modal`) and `Title`, with optional `Trigger`, `Portal`, `Header`,
`DragTrigger`, `Description`, `Control`, `StageTrigger`, `CloseTrigger`, `Body` and
`ResizeTrigger`s.

#### Scenario: Non-modal dialog

- **WHEN** a Floating Panel titled "Inspector" is open
- **THEN** a dialog named "Inspector" exists without `aria-modal`, and the page behind stays
  interactive

### Requirement: Floating Panel Open and Close

Open and close SHALL follow the non-modal Dialog: a trigger toggles it, the CloseTrigger and
Escape (focus inside, not during a drag) close it, an outside press does not; focus moves into
the panel on open and back to the trigger on close unless it already moved elsewhere.

#### Scenario: Escape during a drag

- **WHEN** a drag is in progress and Escape is pressed
- **THEN** the drag is cancelled, the panel stays open at its previous position

### Requirement: Floating Panel Rect

Position, size and stage SHALL be controllable, with change callbacks once per interaction (and
per keyboard step) carrying a reason. The rect SHALL be clamped on every change and when the
boundary resizes: the size between `minSize` and `maxSize`, at least `minVisible` px inside the
boundary on each axis, the top edge never above the boundary.

#### Scenario: Kept on screen

- **WHEN** the panel is dragged 5000 px to the right
- **THEN** 48 px of it remain inside the boundary

#### Scenario: Boundary shrinks

- **WHEN** the boundary becomes narrower than the panel's right edge
- **THEN** the panel is moved back so that at least `minVisible` px are inside

### Requirement: Floating Panel Move and Resize

A pointer drag SHALL start only from the DragTrigger or a ResizeTrigger (not from buttons in the
header), with pointer capture; it SHALL end on release and be cancelled by pointercancel, a lost
capture, a hidden page or Escape. Per-move position SHALL be applied through CSS variables; the
machine SHALL see the start and the end. Resizing from a west or north edge SHALL keep the
opposite edge fixed.

#### Scenario: West resize

- **WHEN** the west ResizeTrigger is dragged 40 px left
- **THEN** the width grows by 40 and x decreases by 40, the right edge unchanged

### Requirement: Floating Panel Keyboard

The DragTrigger SHALL be a focusable button named "Move panel" and described by a hint; Arrow
keys SHALL move by `step` (10) or `largeStep` (50) with Shift; Alt+Arrow SHALL resize from the
south-east corner; Enter and Space SHALL toggle maximised. ResizeTriggers SHALL be `aria-hidden`
and not focusable.

#### Scenario: Move by keys

- **WHEN** the DragTrigger has focus and ArrowRight is pressed
- **THEN** x increases by 10 and `onPositionChange` reports reason `keyboard`

### Requirement: Floating Panel Stages

Minimised SHALL leave only the header (Body `inert`, focus inside the Body moved to the
DragTrigger); maximised SHALL fill the boundary; restoring SHALL bring back the previous rect.
Stage triggers SHALL be buttons named by what they will do.

#### Scenario: Restore

- **WHEN** a panel at (20, 30) 300×200 is maximised and then restored
- **THEN** it is at (20, 30) 300×200 again

### Requirement: Floating Panel Data Attributes

Parts SHALL carry `data-scope="floating-panel"`, `data-part`, `data-instance`, `data-state`,
`data-stage`, and when they apply `data-dragging`, `data-resizing`, `data-disabled`;
ResizeTriggers `data-axis`; StageTriggers `data-stage-target`. The Positioner SHALL set
`--rind-floating-panel-x`, `-y`, `-width` and `-height`.

#### Scenario: Variables

- **WHEN** the panel is at (20, 30) 300×200
- **THEN** the Positioner's `--rind-floating-panel-x` is `20px` and `-width` is `300px`

### Requirement: Floating Panel Messages

The strings SHALL come from `messages` with English defaults: the DragTrigger's name and hint,
the stage trigger names and the CloseTrigger's name.

#### Scenario: Localised close

- **WHEN** `messages.close` is "Chiudi"
- **THEN** the CloseTrigger is named "Chiudi"

### Requirement: Floating Panel Contract

The contract SHALL locate by the Title's text and provide `open`, `close`, `moveBy`,
`resizeBy`, `minimize`, `maximize`, `restore` and the queries `isOpen`, `position`, `size`,
`stage`, `isDragging`.

#### Scenario: Driver

- **WHEN** a test calls `moveBy(20, 0)`
- **THEN** `position().x` grew by 20

### Requirement: Floating Panel Theme

`@rind-ui/theme` SHALL style the Floating Panel in the `panel` family: a raised surface with a
header that shows it can be dragged, resize handles at the edges and corners with resize
cursors, minimised as a header bar, maximised filling the boundary, transitions only without
reduced motion, and borders under forced colors.

#### Scenario: Reduced motion

- **WHEN** reduced motion is preferred and the panel maximises
- **THEN** no transition runs

