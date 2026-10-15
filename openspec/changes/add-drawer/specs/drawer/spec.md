## Purpose

Defines rind-ui's Drawer: a Dialog attached to an edge of the viewport that the user can
also swipe away or drag between snap points — its parts, placement, gesture rules, snap
points and Handle, nesting, background indent, attributes and contract. It behaves as
the `dialog` capability (`add-dialog`) specifies except where this capability says
otherwise; layer mechanics come from `add-overlay-infrastructure` and the gesture from
`swipe-gesture`, and are not restated.

## ADDED Requirements

### Requirement: Same Behaviour As Dialog Unless Stated

The Drawer SHALL meet every requirement of the `dialog` capability — open state and
reasons, modal by default, non-modal dialogs, dismissal defaults, initial and final
focus, keyboard interactions, roles and ARIA attributes, accessible name, close trigger
name, announcements, nested dialogs, forms, mounting, server rendering — except the
scope name, the parts it adds, the reasons it adds, nesting metadata and the contract.
It SHALL be built from the same machine definition as the Dialog, not from a copy.

#### Scenario: Reado's settings drawer

- **WHEN** Reado's `Drawer` (a right-side panel with `aria-label="Settings"`, controlled
  `open`) is rewritten with `Drawer` parts and `side="right"`
- **THEN** nothing is rendered while closed, a `dialog` named "Settings" is shown while
  open, and Escape calls `onOpenChange(false, details)` with reason `ESCAPE_KEY`

#### Scenario: Shared fix

- **WHEN** a bug in the Dialog machine's focus restore is fixed
- **THEN** the Drawer's model-based tests exercise the fixed path with no change to the
  Drawer

### Requirement: Anatomy

The Drawer SHALL consist of the Dialog's parts (`root`, `trigger`, `backdrop`,
`positioner`, `content`, `title`, `description`, `close-trigger`) plus `handle`
(`button` when the drawer has two or more snap points, otherwise a decorative `div`),
`indent` (`div`) and `indent-background` (`div`). `handle` SHALL be optional and
rendered inside the content; `indent` and `indent-background` SHALL be rendered outside
any drawer, around and behind the application, and SHALL NOT need a provider.

#### Scenario: Bottom sheet

- **WHEN** a drawer renders a handle, a title "Filters", a list and a close trigger, and
  is opened
- **THEN** a modal `dialog` named "Filters" is shown at the bottom edge with focus
  inside it

### Requirement: Placement

`side` SHALL place the drawer at `top`, `bottom` (default), `left`, `right`,
`inline-start` or `inline-end`; logical sides SHALL resolve to the physical side from the
component's direction. Swiping toward the side's edge SHALL be the dismiss direction.
`data-side` SHALL carry the physical side on the positioner and content.

#### Scenario: Inline-start in Arabic (base-ui#4402)

- **WHEN** a drawer with `side="inline-start"` is rendered under `dir="rtl"`
- **THEN** its content has `data-side="right"` and a swipe to the right dismisses it

### Requirement: Swipe To Dismiss

A swipe of the content (per `swipe-gesture`) toward the dismiss direction SHALL request
closing with reason `SWIPE` when the release offset is at least `swipeThreshold` of the
content's size on that axis (default 0.5) or the release velocity toward the edge is at
least `swipeVelocityThreshold` (default 0.5 px/ms), and the release reports a direction.
With snap points, a release projected below the smallest snap point SHALL request
closing instead of settling. The request SHALL be an ordinary close request: consumers
SHALL be able to veto it with `onOpenChange`'s `details.cancel()` or by keeping a
controlled `open`, and a vetoed or refused request SHALL leave the drawer open at its
current snap point without exit styles. `closeOnSwipe={false}` SHALL keep the gesture
for snap points but never request closing. A release that does not close SHALL settle:
the content returns to its resting position (or the new snap point) with a transition.
While the drawer is not open, or while it is closing, no swipe SHALL start.

#### Scenario: Swipe down far enough

- **WHEN** a bottom drawer 400 px tall is dragged down 250 px slowly and released
- **THEN** it closes with `details.reason === "SWIPE"` and `data-close-reason="swipe"`,
  and focus returns to the trigger

#### Scenario: Fast flick

- **WHEN** the same drawer is flicked down 60 px at 1 px/ms
- **THEN** it closes with reason `SWIPE`

#### Scenario: Short drag settles

- **WHEN** the drawer is dragged down 80 px slowly and released
- **THEN** it stays open and returns to its resting position

#### Scenario: Consumer vetoes the swipe (reka-ui#2933, base-ui#5570)

- **WHEN** a drawer guarding unsaved work calls `details.cancel()` for a `SWIPE` request
- **THEN** the drawer stays open, returns to its snap point, never carries
  `data-swipe-dismiss` or `data-state="closed"`, and focus has not moved

#### Scenario: Controlled parent applies the close later (zag#3144, zag#3149)

- **WHEN** a controlled drawer is swiped past the threshold and the parent sets
  `open={false}` 100 ms later
- **THEN** during those 100 ms the content stays at its release position carrying
  `data-swipe-dismiss`, and the exit animation starts from there without first
  returning to the open position

#### Scenario: Not dismissible by gesture (base-ui#4541)

- **WHEN** `closeOnSwipe={false}` and the drawer is dragged past the threshold
- **THEN** it settles back and stays open

### Requirement: Swipe Never The Only Way Out

A drawer's gesture SHALL always have non-gesture alternatives: the Dialog's close
trigger, backdrop press when modal, and Escape. When an open drawer renders no close
trigger and outside-press dismissal is off (non-modal, or `closeOnInteractOutside={false}`),
the drawer SHALL emit one development warning naming the instance, because touch
screen-reader users cannot swipe it away.

#### Scenario: Non-modal drawer without a close trigger

- **WHEN** a non-modal drawer without a close trigger opens
- **THEN** one development warning is logged and nothing is thrown

### Requirement: Snap Points

`snapPoints` SHALL accept numbers from 0 to 1 (a fraction of the viewport's extent on the
drawer's axis), numbers greater than 1 (CSS pixels) and strings in `px` or `rem`. Each
SHALL resolve to a visible size clamped to the content's size and the viewport; points
resolving within 1 px of each other SHALL count once; points SHALL be ordered by
resolved size regardless of the order given; points SHALL be re-resolved when the
viewport, the root font size or the content size changes. The active point SHALL be a
controllable value (`snapPoint`, `defaultSnapPoint` — default the first given point —
and `onSnapPointChange(value, details)` with the triggering event as reason and
`cancel()`); each open SHALL start at `defaultSnapPoint` unless controlled. On release,
the drawer SHALL settle on the point closest to the release offset projected 300 ms
ahead by the release velocity, or, with `snapToSequentialPoints`, on the adjacent point
in the drag direction when the drag exceeds a small distance or the velocity threshold.
The content SHALL expose the resting offset as `--rind-drawer-snap-offset`.

#### Scenario: Unsorted snap points (vaul#616)

- **WHEN** `snapPoints={[1, 0.4]}` is given and the drawer is dragged up from 0.4
- **THEN** it settles on 1, exactly as with `[0.4, 1]`

#### Scenario: Rotation (vaul#284)

- **WHEN** a drawer at snap point 0.5 is on a phone rotated from portrait to landscape
- **THEN** its visible size becomes half of the new viewport height

#### Scenario: Flick skips a point, sequential does not (vaul#333)

- **WHEN** a drawer with snap points `[0.25, 0.5, 1]` at 0.25 is flicked up fast
- **THEN** it settles on 1; with `snapToSequentialPoints` the same flick settles on 0.5

#### Scenario: Controlled snap point

- **WHEN** a drawer with controlled `snapPoint={0.5}` is dragged to 1 and the parent
  keeps 0.5
- **THEN** `onSnapPointChange(1, details)` was called with reason `SWIPE` and the drawer
  rests at 0.5

### Requirement: Handle

With two or more snap points the handle SHALL be a button (`type="button"`) whose press
(pointer, touch, keyboard Enter or Space, or a screen reader's activation) moves to the
next larger snap point, wrapping from the largest to the smallest, and never closes the
drawer. Its accessible name SHALL be `messages.expand` ("Expand drawer") when the next
point is larger and `messages.collapse` ("Collapse drawer") when it wraps to a smaller
one. With fewer than two snap points the handle SHALL be decorative: `aria-hidden="true"`,
not focusable, no press behaviour. In both forms a press-and-drag on the handle SHALL
start a swipe, even when the content is marked `data-rind-no-swipe`, so marking the
content gives a handle-only drawer.

#### Scenario: Keyboard changes the snap point (WCAG 2.5.7)

- **WHEN** a keyboard user focuses the handle of a drawer at snap point 0.4 of
  `[0.4, 1]` and presses Enter, then Enter again
- **THEN** the drawer rests at 1 (name was "Expand drawer"), then at 0.4 (name was
  "Collapse drawer"), and it stayed open

#### Scenario: Repeated cycling (vaul#364)

- **WHEN** the handle is pressed 20 times in quick succession
- **THEN** the snap point advanced 20 times and the drawer still responds to swipes

#### Scenario: Handle-only drawer

- **WHEN** the content carries `data-rind-no-swipe` and the user drags the content, then
  the handle
- **THEN** the first drag does nothing and the second moves the drawer

### Requirement: Nested Drawers

A drawer opened from inside another drawer SHALL be its child layer. Nesting metadata
(`data-nested`, `data-has-nested`, `--nested-layer-count`, `--layer-index`) SHALL count
drawers only; a Dialog or Alert Dialog opened inside a drawer SHALL NOT count as a nested
drawer, though it is still the drawer's child layer for Escape, outside presses and
dismissal. The content of a drawer with an open nested drawer SHALL carry
`--rind-drawer-frontmost-size` (the border-box size of the frontmost nested drawer) and,
while that drawer is swiped, `data-nested-swiping`. The metadata SHALL derive from the
open layers, so it is the same for controlled and uncontrolled drawers.

#### Scenario: Dialog inside a drawer (base-ui#4492)

- **WHEN** a drawer opens a nested drawer and that one opens a dialog
- **THEN** the first drawer's `--nested-layer-count` stays 1 and Escape closes only the
  dialog

#### Scenario: Pressing in a dialog over a drawer (vaul#245, vaul#589)

- **WHEN** a dialog opened from a drawer is open and the user presses and double-clicks
  inside it and on its backdrop
- **THEN** only the dialog closes, on the backdrop press; the drawer stays open

#### Scenario: Controlled nested drawers (vaul#540)

- **WHEN** two controlled drawers are nested and the child opens and closes through its
  `open` prop
- **THEN** the parent's content gets `data-has-nested` and `--rind-drawer-frontmost-size`
  on open and loses them on close

#### Scenario: Border-box sizes (base-ui#4201)

- **WHEN** a nested drawer with a 2 px border is 300 px tall including the border
- **THEN** the parent's `--rind-drawer-frontmost-size` is `300px`

### Requirement: Background Indent

`indent` and `indent-background` SHALL carry `data-active` while at least one modal
drawer is open in the document, and `--rind-drawer-swipe-progress` mirroring the
frontmost drawer's swipe progress (0 at rest), so a theme can scale the page behind
the drawer. They SHALL render the same markup on the server and the client, with the
variable written only after mount. Drawers SHALL be known to the document only while
open.

#### Scenario: Scale while dragging

- **WHEN** a modal bottom drawer is open and dragged halfway toward its edge
- **THEN** the indent has `data-active` and `--rind-drawer-swipe-progress` near `0.5`;
  after release it is `0` again

#### Scenario: Hydration (base-ui#4509)

- **WHEN** a page with `indent` and `indent-background` is server-rendered and hydrated
- **THEN** hydration reports no mismatch

#### Scenario: Closed drawers are not retained (base-ui#5915)

- **WHEN** 50 drawers on visited routes mount and unmount without ever opening
- **THEN** the document's drawer registry holds no reference to them

### Requirement: Scroll Lock And Inner Scrolling

A modal drawer SHALL lock page scrolling as a modal layer; switching between two sibling
drawers SHALL keep the page locked throughout. The content SHALL be the layer element on
which overscroll is contained, so scrolling an inner list to its end does not scroll or
bounce the page.

#### Scenario: Switching drawers (vaul#397)

- **WHEN** one drawer closes and a sibling drawer opens in the same handler
- **THEN** the page stays locked while the second is open and is unlocked after it
  closes

### Requirement: Keyboard Inset

While a top or bottom drawer is open, its positioner SHALL expose
`--rind-drawer-keyboard-inset`: the height of the part of the layout viewport covered
by the on-screen keyboard (from the visual viewport), `0px` when none, updated when the
visual viewport resizes.

#### Scenario: Keyboard opens on iOS (base-ui#5596)

- **WHEN** an input in a bottom drawer is focused on iOS and the keyboard covers 300 px
- **THEN** the positioner's `--rind-drawer-keyboard-inset` is about `300px`, and `0px`
  after the keyboard closes

### Requirement: Toasts Over A Drawer

A press or focus inside a toast region (`data-rind-top-layer`) SHALL NOT dismiss an open
drawer.

#### Scenario: Dismissing a toast (ark#2974)

- **WHEN** a modal drawer with outside-press dismissal is open and the user presses a
  toast's close button twice
- **THEN** the drawer stays open

### Requirement: Announcements

The drawer SHALL announce nothing when it opens, closes, is swiped or changes snap
point.

#### Scenario: Swipe dismissal

- **WHEN** a drawer is swiped closed with a recording announcer
- **THEN** the announcement log is empty

### Requirement: Messages

The drawer's `messages` SHALL include the Dialog's `close` plus `expand` (default
"Expand drawer") and `collapse` (default "Collapse drawer").

#### Scenario: Italian handle

- **WHEN** `messages={{ expand: "Espandi" }}` is passed and the handle's next point is
  larger
- **THEN** the handle's accessible name is "Espandi"

### Requirement: Title Heading Level

The `title` part SHALL render `h{level}`, with `level` = the Title's `level` prop ?? 2,
so it stays `h2` by default; its heading attributes SHALL come from add-heading's shared
`headingProps` helper, so a title substituted through `render` with a non-heading
element gets `role="heading"` and `aria-level`. The `content` part SHALL wrap its
children in a `Heading.Level` set to the title's level + 1 (3 by default), so a
`Heading` inside the drawer body renders one level below the title without a `level` prop.

#### Scenario: Title defaults to h2

- **WHEN** a drawer renders a title with no `level` prop
- **THEN** the title is an `h2` with `data-level="2"`

#### Scenario: Heading inside content is one level deeper

- **WHEN** a drawer renders a title with `level={3}` and a `Heading` with no `level`
  inside its content
- **THEN** the inner heading is an `h4`

#### Scenario: Substituted title keeps its level

- **WHEN** the title is rendered with `render={<div />}`
- **THEN** the element has `role="heading"` and `aria-level="2"`

### Requirement: Data Attributes

Every part SHALL carry `data-scope="drawer"`, `data-part` (`trigger`, `backdrop`,
`positioner`, `content`, `title`, `description`, `close-trigger`, `handle`, `indent`,
`indent-background`) and `data-instance` (except `indent` and `indent-background`, which
belong to no instance), with the Dialog's attributes for the Dialog's parts. Additionally:

- `positioner`: `data-side`; `--rind-drawer-keyboard-inset`.
- `content`: `data-side`; `data-swiping` while a swipe is active; `data-swipe-dismiss`
  from a dismissing release until the next open (including while a controlled parent has
  not yet applied it); `data-expanded` at the largest snap point or with no snap points;
  `data-snap-point` (the index of the active point in resolved order) when snap points
  exist; `data-nested-swiping`; `--rind-drawer-swipe-x`, `--rind-drawer-swipe-y`,
  `--rind-drawer-swipe-progress` (from the gesture), `--rind-drawer-snap-offset`,
  `--rind-drawer-size` (border-box size on the axis), `--rind-drawer-frontmost-size`.
- `backdrop`: `data-swiping`; `--rind-drawer-swipe-progress`.
- `handle`: `data-snap-point`; as a button, `data-focus`, `data-focus-visible`,
  `data-pressed`.
- `indent`, `indent-background`: `data-active`; `--rind-drawer-swipe-progress`.

#### Scenario: Styling a swipe

- **WHEN** a drawer is being dragged
- **THEN** the content and backdrop carry `data-swiping`, and removing the attribute on
  release lets the theme's transition run from the dragged position

### Requirement: Drawer Contract

The `drawer` contract SHALL locate an instance by role `dialog` and exact accessible
name, SHALL declare the Dialog's traits (`layer`, `restores-focus`, `presence`, plus
`modal` when modal), actions and queries, and SHALL add the actions `swipe(direction,
distance)` (touch and pointer implementations through the drag input; keyboard declared
as none, with the reason that its keyboard alternatives are `close`, `pressEscape` and
`pressHandle`) and `pressHandle` (pointer, touch and keyboard), and the queries
`snapPoint`, `side` and `isSwiping`. Its event map SHALL map `SWIPE` to a dismissing
`swipe` and `HANDLE_PRESS` to `pressHandle`; the Dialog's mappings stay.

#### Scenario: Driver round trip

- **WHEN** a test runs `const d = getDrawer(screen, { name: "Filters" })`, then
  `await d.open()` and `await d.swipe("down", 300)`
- **THEN** `swipe` resolves once the drawer is closed and `await d.closeReason()` is
  `"swipe"`

### Requirement: Model-Based Coverage

`testMachine` over the drawer contract SHALL cover every transition in every declared
modality including `virtual`, for modal and non-modal props and with and without snap
points, and SHALL pass every generic, accessibility and overlay invariant. Transitions
without a contract action (settling on a snap point, `SNAP_POINT.SET`, `SIZE.CHANGE`,
`NESTED.CHANGE`, `SWIPE.START`, `SWIPE.CANCEL`) SHALL be reported as uncovered and
covered by machine unit tests.

#### Scenario: Wrapper removes the close path

- **WHEN** a consumer wrapper renders a non-modal drawer without a close trigger and runs
  `testMachine`
- **THEN** the run logs the "only way out" development warning
