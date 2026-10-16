## Purpose

Defines the shared drag lifecycle for components that move a value along an axis with a
pointer (Slider first; Splitter, Color Area and Angle Slider later): pointer capture,
listeners that live only while a drag is active, cancellation, and the mapping from a
pointer position to a fraction of the axis, so machines stay layout-free.

## ADDED Requirements

### Requirement: Fractions, Not Pixels

The drag module SHALL report positions to its component as a fraction from 0 to 1 along
the component's logical axis: measured from the inline start for a horizontal axis
(mirrored under `dir="rtl"`) and from the bottom for a vertical one, after subtracting
the surface's padding and border, the grab offset recorded at press time, and, when the
component asks for it, half the measured size of the dragged element at each end. A
surface with zero size on the axis SHALL produce no fraction. Machines SHALL receive only
these fractions with the pointer type, never coordinates or elements.

#### Scenario: RTL fraction

- **WHEN** a press lands 30 px from the right edge of a 300 px horizontal surface under
  `dir="rtl"`
- **THEN** the reported fraction is 0.1

#### Scenario: Zero-size surface

- **WHEN** a press lands on a surface whose rect has width 0
- **THEN** the press is reported with no fraction and no `NaN` reaches the component

### Requirement: One Drag At A Time

A drag SHALL start on a primary-button mouse press or a pen/touch press on the surface,
SHALL capture the pointer on the surface when the platform supports it, and SHALL listen
for `pointermove`, `pointerup`, `pointercancel` and `lostpointercapture` on the surface's
owner document only while the drag is active, so moves are tracked whether or not
capture is available. Moves from other pointers SHALL be ignored. A `pointermove` with no
buttons pressed SHALL end the drag as a release.

#### Scenario: Without pointer capture (jsdom)

- **WHEN** `setPointerCapture` is a no-op and `hasPointerCapture` returns false
- **THEN** moves dispatched on the document still reach the component

#### Scenario: Second finger

- **WHEN** a second touch point moves during a drag
- **THEN** its moves are ignored

### Requirement: End And Cancel

A drag SHALL end with a release on `pointerup`, and SHALL be cancelled on
`pointercancel`, on `lostpointercapture` before a `pointerup`, when the document becomes
hidden, and when the component stops tracking. After either, every listener the module
added SHALL be removed and capture released.

#### Scenario: Listeners removed (BU#3311)

- **WHEN** a drag has been released and the user clicks elsewhere
- **THEN** no listener of the module runs

#### Scenario: Capture lost (BU#1910)

- **WHEN** pointer capture is lost without a `pointerup`
- **THEN** the component receives a cancel

### Requirement: Pointer Steps In Test Adapters

Components using the module SHALL be drivable through the pointer steps of
`test-drivers`; a contract action that drags SHALL declare its pointer and touch
implementations with them.

#### Scenario: Step-wise drag

- **WHEN** a driver presses a thumb, moves to two positions and releases
- **THEN** the component receives one start, two moves and one release
