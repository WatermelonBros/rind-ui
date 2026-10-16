# hover-intent Specification

## Purpose
Decides, from pointer movement, when a hover-opened layer (tooltip, hover card,
and later submenus and navigation menus) opens and closes: open and close delays,
the hover zone that includes the content, descendant layers and a grace area for
travelling between trigger and content, and the rules for scrolling, leaving the
document and touch — written once so every hover-opened layer behaves the same
and satisfies WCAG 1.4.13 (hoverable, persistent).
## Requirements
### Requirement: Pointer Types

Hover intent SHALL react only to `mouse` and `pen` pointers, through the hover
events of `press-interactions`. Touch input, including the emulated `mouse`
events iOS fires after a touch, SHALL never start, keep or end hover intent.

#### Scenario: Tap on a tooltip trigger

- **WHEN** the user taps a tooltip trigger on a touch screen
- **THEN** no hover-intent open starts and the tooltip stays closed

#### Scenario: Emulated mouse after touch

- **WHEN** iOS fires `pointerenter` with `pointerType: "mouse"` right after a touch on
  a hover-card trigger
- **THEN** the hover card does not start opening

### Requirement: Opening Delay And Movement

A hover-opened layer SHALL open after the pointer has moved onto its trigger and
stayed within the trigger for its open delay (an injected-scheduler delay read
when it starts; `0` opens at once). Leaving the trigger before the delay elapses
SHALL cancel the pending open. An element that arrives under a stationary pointer
(the page scrolls, layout shifts) SHALL NOT start the delay until the pointer
moves; a pointer already resting on a trigger when it mounts SHALL start the
delay on its first movement.

#### Scenario: Sweeping across triggers

- **WHEN** the pointer crosses a list of hover-card triggers faster than the open
  delay and leaves the list
- **THEN** no hover card opens, and none opens later (regression: radix#1248,
  radix#2853)

#### Scenario: Content scrolls under a resting pointer

- **WHEN** the user scrolls with the wheel and a trigger moves under the
  stationary pointer
- **THEN** nothing opens until the pointer moves (regression: ariakit#1662)

#### Scenario: Fake timers

- **WHEN** a test with fake timers moves the pointer onto a trigger with a 700 ms
  open delay and advances 700 ms
- **THEN** the layer opens with no real time elapsed

### Requirement: Hover Zone

While a hover-opened layer is open, the pointer SHALL count as hovering when it
is over the trigger, over the layer's own elements (positioner, content, arrow),
over the elements of any open descendant layer, or inside the current grace area.
Containment SHALL be decided through open shadow roots (the composed path), so
web components inside the content count as inside.

#### Scenario: Pointer over a child layer

- **WHEN** a tooltip opened from a button inside an open hover card is shown in a
  portal outside the card, and the pointer moves onto the tooltip
- **THEN** the hover card stays open (regression: react-spectrum#10460)

#### Scenario: Web component in the content

- **WHEN** the pointer rests on a custom element with an open shadow root inside
  a hover card
- **THEN** the hover card stays open (regression: ariakit#6303)

### Requirement: Grace Area

When the pointer leaves the trigger of an open layer, or leaves the layer's
content, a grace area SHALL be created: the polygon spanned by the exit point
(padded by a few pixels on both sides of the exit direction) and the rectangle of
the element it is heading to (the content, or the trigger). While the pointer stays
inside the polygon the layer SHALL stay open; entering the target SHALL remove the
grace area; leaving the polygon SHALL count as leaving the hover zone. The grace
area SHALL NOT be the hull of both rectangles, so a wide content box does not keep
the layer open while the pointer moves to neighbouring elements. The exit side is
the side nearest the exit point; when that side does not face the target, a side
that does face it SHALL count instead if the pointer's last movement heads towards
that side (a pointer leaving near a corner, towards a flipped submenu).

#### Scenario: Gap between trigger and content

- **WHEN** a hover card is placed 8 px below its trigger and the pointer moves
  from the trigger, through the gap, onto the card
- **THEN** the card never starts closing (regression: zag#3181, reka-ui#771,
  reka-ui#1063)

#### Scenario: Moving sideways off a wide card's trigger

- **WHEN** a hover card much wider than its trigger is open and the pointer leaves
  the trigger horizontally towards a neighbouring link
- **THEN** the pointer is outside the grace area and the card starts closing
  (regression: reka-ui#2203)

#### Scenario: Out near a corner towards a flipped submenu

- **WHEN** a submenu is placed on the left of its full-width trigger and the pointer
  moves down-left from the trigger, leaving it through the bottom edge a few pixels
  from the corner
- **THEN** a grace area towards the submenu is created and the submenu stays open
  (regression: radix#4036)

### Requirement: Placed Target And Rest Timeout

The grace area's target rectangle SHALL be the target element as actually placed
(after flipping or shifting), supplied by the caller, not the requested placement.
A caller MAY set a rest timeout: if the pointer stays inside the grace area without
moving for that long, the grace area SHALL end as if the pointer had left it. Both
options SHALL be additive: callers that set neither behave as before.

#### Scenario: Submenu flipped to the left

- **WHEN** a submenu requested on the right is flipped to the left of its parent and
  the pointer moves left from the submenu trigger towards it
- **THEN** the pointer is inside the grace area and the submenu stays open

#### Scenario: Pointer rests between menus

- **WHEN** a submenu's grace area has a 300 ms rest timeout and the pointer stops
  inside the area for 300 ms
- **THEN** the grace area ends and the hover zone is treated as left

### Requirement: In-Transit Suppression

While the pointer is inside a grace area, other triggers that use hover intent in
the same document SHALL NOT start opening when the pointer crosses them.

#### Scenario: Diagonal move across another trigger

- **WHEN** a tooltip for list item 1 is open above the list and the pointer moves
  diagonally towards it across list item 2, which also has a tooltip
- **THEN** item 1's tooltip stays open and item 2's tooltip does not start opening
  (regression: zag#2850, bits-ui#1979)

### Requirement: Closing Delay

When the pointer leaves the hover zone, the layer SHALL close after its close
delay (`0` closes at once); re-entering the hover zone before then SHALL cancel
the close.

#### Scenario: Brief exit and return

- **WHEN** the pointer leaves an open tooltip's hover zone and returns within its
  300 ms close delay
- **THEN** the tooltip never closes

### Requirement: Open Descendant Layers Keep The Layer Open

While a hover-opened layer has an open descendant layer (a select, a menu, a
nested hover card, a tooltip), leaving the hover zone SHALL NOT close it; the
layer closes through the descendant's dismissal or its own dismiss rules.

#### Scenario: Select inside a hover card

- **WHEN** a select inside an open hover card is opened, its listbox extends below
  the card, and the pointer moves onto an option and then briefly off the listbox
- **THEN** the hover card and the select stay open (regression: radix#3175,
  react-spectrum#10443, mui/base-ui#3129)

### Requirement: Scroll And Layout Re-Evaluate The Zone

When the document or any scroll container scrolls, or the viewport resizes, while
a hover-opened layer is open by hover, the hover zone SHALL be re-evaluated
against the last known pointer position; if the pointer is no longer inside it,
the pointer SHALL count as having left. Scrolling SHALL NOT affect a layer that is
open only because of keyboard focus.

#### Scenario: Container scrolls the trigger away

- **WHEN** a tooltip is open because the pointer rests on its trigger in a
  scrollable list, and the user scrolls the list with the wheel so the trigger
  moves away from the pointer
- **THEN** the tooltip closes after its close delay (regression: ariakit#4058,
  mui/base-ui#1447, reka-ui#2543)

#### Scenario: Focus scrolls the trigger into view

- **WHEN** the user tabs to a tooltip trigger below the fold and the browser
  scrolls it into view
- **THEN** the focus-opened tooltip stays open (regression: radix#1944,
  react-spectrum#10333, zag#1589)

### Requirement: Leaving The Document

The pointer leaving the document, and the window losing focus, SHALL count as
leaving the hover zone.

#### Scenario: Pointer exits the window over the tooltip

- **WHEN** a hoverable tooltip touches the window edge and the pointer leaves the
  window from the tooltip side
- **THEN** the tooltip closes after its close delay (regression: radix#3299)

### Requirement: Testable Without A DOM

Hover intent SHALL reach machines only as events (`HOVER.START`, `HOVER.END`)
from an injected capability, so machines run in Node with a fake that emits them;
geometry (grace area, zone re-evaluation) SHALL be exercised in browser mode.
While closed, hover intent SHALL use only handlers on the trigger element;
document- and window-level listeners and timers SHALL be scoped to the opening,
open and closing states and removed when they are left or the service stops.

#### Scenario: Machine test

- **WHEN** a tooltip machine runs in Node with a fake hover-intent capability that
  emits `HOVER.START` and the test advances the open delay
- **THEN** the machine is open without any DOM

#### Scenario: Nothing left behind

- **WHEN** a hover card closes or is unmounted while open
- **THEN** no pointer, scroll or blur listener and no timer of its hover intent
  remains (regression: bits-ui#2103, bits-ui#2153)

