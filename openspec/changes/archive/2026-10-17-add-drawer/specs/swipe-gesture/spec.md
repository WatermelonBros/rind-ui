## Purpose

Defines the swipe gesture rind-ui components share (Drawer, Toast): when a press becomes
a swipe, how it yields to scrolling and to clicks, how movement is exposed without
re-rendering, how a release is measured and reported to the component, and the drag
input test adapters provide so the gesture can be driven in tests.

## ADDED Requirements

### Requirement: Discrete Events, Continuous Styles

The gesture SHALL report to its component only discrete events: a start, a release
carrying the direction, the offset along the locked axis toward that direction (in CSS
pixels), the release velocity (px/ms) and the swiped element's size on that axis, and a
cancel. Movement during the gesture SHALL be exposed only as CSS custom properties
written on the swiped element — the movement on each axis (`--rind-<prefix>-swipe-x`,
`--rind-<prefix>-swipe-y`) and the progress toward dismissal from 0 to 1
(`--rind-<prefix>-swipe-progress`) — and through an optional per-frame progress
callback; it SHALL NOT send a machine event or cause a framework render per pointer
move. The gesture SHALL write only its own custom properties and SHALL NOT replace or
clear any other inline style. The variables SHALL be reset to zero when a new gesture
starts and when tracking stops.

#### Scenario: Swipe on a low-end device (base-ui#4863)

- **WHEN** a drawer is dragged for 60 pointer moves
- **THEN** the component's machine received one start event and no event per move, and
  the drawer's parts rendered no more than once for the start

#### Scenario: Layer variables survive a drag (zag#3148, ark#3909)

- **WHEN** a drawer whose backdrop and content carry `--layer-index` is dragged and
  released
- **THEN** `--layer-index` and every other inline custom property set by connect are
  still present on both parts

### Requirement: When A Swipe Starts

A swipe SHALL start only from the primary button or a single touch point, on the swiped
element or its descendants in the composed tree (so it works inside shadow roots), and
only once the pointer has moved past a small slop and the movement along one axis
dominates the other (axis lock); before that, nothing is claimed. A second touch point
SHALL cancel the gesture. A swipe SHALL NOT start when the press began on a text-entry
control, a content-editable element, a range or file input, or inside an element marked
`data-rind-no-swipe`, or while a non-collapsed text selection intersects the swiped
element; components MAY name a part that always starts a swipe (a drag handle) even
inside an opted-out subtree. Mouse and pen swipes SHALL NOT start on buttons and links;
touch swipes MAY start anywhere else, including on buttons and links. A press whose
target is outside the swiped element's DOM (for example in a portalled popup rendered
from it) SHALL be ignored.

#### Scenario: Shadow root (base-ui#5359)

- **WHEN** a drawer rendered inside an open shadow root is swiped toward its edge
- **THEN** the gesture starts and the release is reported

#### Scenario: Touch on a button (reka-ui#2907)

- **WHEN** a touch starts on a button inside a drawer and moves 120 px toward the
  drawer's edge
- **THEN** the drawer is swiped, and the button is not activated

#### Scenario: Tap is not a swipe (base-ui#4294)

- **WHEN** a touch taps a `div` with a click handler inside a drawer without moving past
  the slop
- **THEN** no swipe starts and the click handler runs

#### Scenario: Portalled list inside a drawer (base-ui#4380)

- **WHEN** a select opened from inside a drawer renders its list in a portal and the
  user touch-scrolls the list
- **THEN** the list scrolls and the drawer does not move

#### Scenario: Selecting text

- **WHEN** the user has selected text inside a drawer and drags across it
- **THEN** no swipe starts and the selection extends

### Requirement: Scroll Comes First

A swipe SHALL NOT start while any scroll container between the press target and the
swiped element (the target included, whatever its element type, SVG included) can still
scroll in the direction of the movement; scroll containers outside the swiped element,
including the page, SHALL NOT be considered. Once such a container is at its edge, a
movement further in that direction SHALL start the swipe in the same gesture. On touch,
the gesture SHALL claim a `touchmove` (prevent its default) only after axis lock and only
when it starts the swipe, never on the first cancelable `touchmove` before the axis is
known, so a cross-axis scroll is never cancelled for the whole gesture.

#### Scenario: Pull down at the top of a list

- **WHEN** a bottom drawer's list is scrolled to the top and the user drags down on it
- **THEN** the drawer follows the finger instead of the list bouncing

#### Scenario: Scrolled list

- **WHEN** the same list is scrolled halfway and the user drags down
- **THEN** the list scrolls and the drawer does not move until the list reaches its top

#### Scenario: Scrollable page behind a non-modal drawer (base-ui#5566, vaul#651)

- **WHEN** a non-modal drawer rests at a lower snap point over a page taller than the
  viewport, and the user swipes up on it
- **THEN** the drawer follows the finger; the page's own scroll position does not block
  the gesture

#### Scenario: Drag starting on an SVG (base-ui#5843)

- **WHEN** a touch drag starts on an SVG icon inside scrolled content of a drawer
- **THEN** the content scrolls exactly as for a drag started on text

#### Scenario: Vertical scroll in a side drawer on iOS (base-ui#5255, reka-ui#2876)

- **WHEN** the user scrolls vertically inside a right-side drawer, including drags whose
  first move is shorter than the axis-lock slop
- **THEN** the content scrolls every time and the drawer does not move sideways

### Requirement: Movement And Damping

During a swipe, movement toward an allowed direction SHALL follow the pointer one to one;
movement against it, or along a direction the component does not allow, SHALL be damped
(it moves less than the pointer, and increasingly so). The first move after the press
SHALL be measured from where the gesture locked, so the element does not jump when the
first touch move arrives offset from the touch start.

#### Scenario: Pull against the edge

- **WHEN** a bottom drawer is dragged 100 px upward
- **THEN** `--rind-drawer-swipe-y` is negative and smaller in magnitude than 100 px

### Requirement: Release Measurement

On release the gesture SHALL report the direction the gesture travelled, or no direction
when it never locked onto an allowed direction or reversed back toward its start by more
than a small "change of mind" distance; the offset along the locked axis; the velocity
computed from the time each event arrived on the environment's clock (so a fake clock in
tests makes it deterministic; event timestamps cannot be faked in a real browser) over the
last part of the gesture, ignoring samples older than a short age, so that the same
physical speed yields the same velocity at any input rate; and the element's border-box size on that axis. Components SHALL NOT dismiss on a
release that reports no direction.

#### Scenario: Horizontal flick on a bottom sheet with snap points (base-ui#5471)

- **WHEN** a bottom drawer with snap points receives a mostly horizontal flick
- **THEN** the release reports no direction and the drawer stays open, at its snap
  point, with no exit styles

#### Scenario: 120 Hz input (base-ui#5837)

- **WHEN** the same 1 px/ms flick is replayed with move events 16.7 ms apart and 8.3 ms
  apart
- **THEN** both releases report a velocity within 10 % of 1 px/ms

#### Scenario: Change of mind

- **WHEN** the user drags a drawer 150 px toward its edge and back 40 px before
  releasing
- **THEN** the release reports no direction

### Requirement: Cancellation

`pointercancel`, loss of pointer capture to an element outside the swiped element, a
second touch point, the document becoming hidden, or tracking stopping SHALL cancel the
gesture and report a cancel, never a release.

#### Scenario: iOS dock opens mid-drag (vaul#555)

- **WHEN** a drag on a drawer is interrupted by `pointercancel`
- **THEN** the component receives a cancel and the drawer returns to its resting snap
  point

### Requirement: No Page-Level Blocking

The gesture SHALL NOT add wheel listeners, SHALL NOT block browser zoom or the
two-finger gestures of the platform, and SHALL listen to document-level moves only while
a gesture is pending or active.

#### Scenario: Idle drawer

- **WHEN** a drawer is open and no pointer is down on it
- **THEN** the gesture has no document-level pointer or touch listener installed

### Requirement: Drag Input In Test Adapters

The test drivers' part handle SHALL offer a drag of a given vector, by mouse or by touch,
over a given duration and number of steps, in both the Testing Library and the Playwright
adapter, with event timestamps that make the reported velocity deterministic (driven by
the adapter's time-advance function under fake timers). A contract action that drags
SHALL declare it as its pointer or touch implementation.

#### Scenario: Same swipe in both environments

- **WHEN** a drawer driver's `swipe` action runs in the browser project and in
  Playwright
- **THEN** both reach the same closed state with close reason `swipe`
