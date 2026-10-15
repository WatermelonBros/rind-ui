## Purpose

Places an anchored popup (popover, tooltip, menu, listbox, picker, tour step)
next to its anchor, keeps it there while the page scrolls, resizes or zooms,
and keeps it usable in small viewports. Exposes the result as `data-*`
attributes and CSS custom properties so headless consumers can style and
animate it.

## ADDED Requirements

### Requirement: Placement Options

Positioning SHALL accept the following, all read live on every positioning pass:

- `side`: `top`, `right`, `bottom`, `left`, `inline-start` or `inline-end`.
- `align`: `start`, `center` or `end`.
- `sideOffset` and `alignOffset`: in CSS px.
- `collisionPadding`: a number or a per-side object. Default: 8.
- `collisionBoundary`: default is the floating element's clipping ancestors
  and the viewport.
- `collisionAvoidance`: `{ side: flip | shift | none, align: flip | shift |
  none, fallbackAxis: start | end | none }`.
- `sticky`.
- `arrowPadding`.
- `strategy`: `auto`, `absolute` or `fixed`.
- `tracking`: `auto`, `frame` or `none`.
- `sideLock`: `none` or `open`.
- `inline`: for anchors that wrap across lines.
- the anchor, passed as the positioning request's anchor source (the component maps its own `anchor` prop to it), not as a positioning option: see Anchors.
- `mode`: `auto` or `manual`.

Each consuming component SHALL declare its own defaults for these options. A
consumer prop SHALL override a default.

#### Scenario: Preferred placement fits

- **WHEN** a popup with `side: "bottom"`, `align: "start"` and `sideOffset: 4`
  opens and there is room below the anchor
- **THEN** its top edge is 4 px below the anchor's bottom edge
- **AND** its inline-start edge is aligned with the anchor's inline-start edge

#### Scenario: Boundary mounted after open

- **WHEN** `collisionBoundary` is an element that mounts after the popup opened
- **THEN** the next pass uses that element as the boundary

### Requirement: Collision Avoidance

When the popup does not fit within the boundary minus `collisionPadding`, the
side axis SHALL follow `collisionAvoidance.side`:

- `flip`: the popup moves to the opposite side.
- `shift`: the popup slides to stay inside the boundary.
- `none`: the popup keeps its side even if it overflows.

The align axis SHALL follow `collisionAvoidance.align` in the same way: `flip`
swaps `start` and `end`, `shift` slides, and `none` keeps the alignment.

If neither side on the preferred axis fits, `fallbackAxis` SHALL decide whether
the popup moves to the perpendicular axis, and to which logical side.

Shifting SHALL NOT move the popup over its anchor on the side axis, unless
`sticky` is set.

The flip decision SHALL favour the preferred side by 1 px. The bias SHALL NOT
affect where the popup rests or the available size it reports.

#### Scenario: Flip at the bottom edge

- **WHEN** a `side: "bottom"` popup opens from an anchor near the bottom of the
  viewport and fits above it
- **THEN** it is placed above the anchor
- **AND** `data-side` is `top`

#### Scenario: Vertical fallback for a horizontal side

- **WHEN** a `side: "left"` popup with `fallbackAxis: "end"` fits on neither the
  left nor the right, but fits below
- **THEN** it is placed below the anchor and does not overflow horizontally

#### Scenario: Scrollable list caps instead of switching axis

- **WHEN** a list popup with `fallbackAxis: "none"` is taller than the room on
  either side
- **THEN** it stays on its vertical side
- **AND** it reports an available height that the theme uses to cap and scroll it

#### Scenario: Centred input with the on-screen keyboard

- **WHEN** the room above and below the anchor is equal
- **THEN** the popup stays on its preferred side
- **AND** the gap between the popup and the viewport edge equals
  `collisionPadding` exactly

### Requirement: Available Size And Anchor Size

On every pass, positioning SHALL write the following CSS custom properties on
the positioner:

- `--rind-available-width` and `--rind-available-height`: the space left
  between the anchor and the edge of the boundary, minus `collisionPadding`, on
  the placed side.
- `--rind-anchor-width` and `--rind-anchor-height`: the anchor's size, snapped
  to the device-pixel grid at the current `devicePixelRatio`.

Before the first pass, the available-size properties SHALL already hold
`100vw` and `100vh`, so that consumer rules using them are valid while the
popup is measured.

#### Scenario: Capped popup measured on the first pass

- **WHEN** a list popup capped with
  `max-height: min(20rem, var(--rind-available-height))` opens in the lower
  half of the viewport, and its capped height fits below the anchor
- **THEN** it opens below the anchor

#### Scenario: Viewport grows back

- **WHEN** the viewport shrinks while a popup is open and then grows again
- **THEN** `--rind-available-width` grows with it

#### Scenario: Reflow at 320 px

- **WHEN** any anchored fixture opens in a 320 × 480 CSS px viewport with the
  default theme
- **THEN** no part of the popup lies outside the viewport
- **AND** content that does not fit scrolls inside the popup

### Requirement: Arrow

When an arrow part exists, positioning SHALL place it on the popup edge that
faces the anchor, centred on the anchor, kept at least `arrowPadding` away from
the popup's corners. When the arrow cannot point at the anchor's centre within
that padding, the arrow SHALL carry `data-uncentered`.

The arrow's size SHALL NOT be added to `sideOffset`.

The arrow SHALL be measured against the positioner, so that animations on the
content do not move it.

#### Scenario: Arrow follows a shifted popup

- **WHEN** a popup is shifted 30 px to stay inside the viewport
- **THEN** its arrow still points at the anchor's centre

#### Scenario: Arrow during a scale animation

- **WHEN** the content plays a scale-in animation
- **THEN** the arrow position written by positioning does not change during
  the animation

### Requirement: Placement Attributes

The positioner, the content and the arrow SHALL carry the following:

- `data-side`: the physical side the popup was placed on (`top`, `right`,
  `bottom` or `left`).
- `data-align`: `start`, `center` or `end`.
- `data-anchor-hidden`: present while the anchor is hidden (see Hidden Anchor).
- `data-placing`: present from the moment the popup opens until its first
  placement is written. Positioner and content only.

The positioner SHALL carry the resolved `dir` of the anchor.

These attributes SHALL be produced by connect from machine state. A change to
side, align or the anchor-hidden state SHALL reach the machine as one event.
A change of coordinates alone SHALL NOT reach the machine.

#### Scenario: Scrolling does not notify the machine

- **WHEN** the page scrolls 500 px while a popup is open, and its side stays
  the same
- **THEN** the machine receives no positioning event
- **AND** the popup stays attached to the anchor

#### Scenario: Flip notifies once

- **WHEN** a resize makes an open popup flip from bottom to top
- **THEN** the machine receives exactly one event, and it carries side `top`

### Requirement: First Frame

Until the first placement of the current open is written, the positioner
SHALL:

- be `position: fixed` at the viewport origin, at opacity 0, without pointer
  events, and still focusable;
- prevent the content's CSS animations from starting.

Coordinates from a previous open, or from a measurement taken while the popup
was hidden, SHALL never be applied.

Positioning SHALL report when the first placement has been written. Components
SHALL move initial focus into the popup only after that report.

Positioning SHALL run only in the browser. Server rendering SHALL output the
first-frame state.

#### Scenario: No flash at a stale position

- **WHEN** a kept-mounted popup is closed and reopened from a different
  trigger
- **THEN** it is never painted, even for one frame, at the coordinates of the
  previous open

#### Scenario: Keyboard open does not scroll the page

- **WHEN** a menu inside a scrolled container is opened with the keyboard
- **THEN** focus moves to the first item after the menu is placed
- **AND** neither the page nor the container changes its scroll position

#### Scenario: Enter animation starts from the placed side

- **WHEN** a popup with a slide-in animation keyed on `data-side` flips to
  `top` on open
- **THEN** the animation starts after `data-side` is `top`

#### Scenario: Open after hydration

- **WHEN** a server-rendered page hydrates and the user opens a menu for the
  first time
- **THEN** the menu is placed against its trigger, not at the viewport origin

### Requirement: Transform Origin

Positioning SHALL write `--rind-transform-origin` on the positioner. The value
SHALL be the point on the popup closest to the anchor:

- with an arrow, the arrow's tip;
- with no arrow and an aligned popup, the aligned edge on the anchor-facing
  side;
- with a point anchor, the anchor point itself.

#### Scenario: Context menu opened near the bottom-right corner

- **WHEN** a context menu opens at a pointer near the bottom-right corner, so
  it is placed up and to the left of the pointer
- **THEN** `--rind-transform-origin` is the menu corner at the pointer
  (bottom-right), not a top corner

### Requirement: Hidden Anchor

The anchor SHALL count as hidden when it is entirely clipped by the clipping
ancestors of the anchor, or when it has no layout box (`display: none`, or not
connected). While the anchor is hidden, `data-anchor-hidden` SHALL be present.

Positioning SHALL NOT hide the popup, or make it inert, while the popup
contains focus. Whether a component closes when its anchor is hidden is that
component's behaviour.

#### Scenario: Submenu item scrolled out of a scrollable menu

- **WHEN** a submenu's trigger item is scrolled out of view inside its parent
  menu
- **THEN** the submenu carries `data-anchor-hidden`

#### Scenario: Anchor hidden by CSS

- **WHEN** the anchor of an open popup gets `display: none`
- **THEN** the popup carries `data-anchor-hidden` after the next pass

### Requirement: Tracking

While a popup is open and `tracking` is `auto`, it SHALL be repositioned after
any of the following:

- scroll of any scrollable ancestor of the anchor or of the popup;
- window resize;
- `visualViewport` resize or scroll;
- a size change of the anchor or of the popup;
- the anchor moving because of a layout shift;
- a change in the layer stack (scroll lock reserving a scrollbar gutter, for
  example);
- the end of a CSS animation or transition on an ancestor of the anchor.

`tracking: "frame"` SHALL also reposition on every animation frame.
`tracking: "none"` SHALL position once per open, and again only when
`reposition()` is called.

A size change of the popup caused by positioning's own writes SHALL be applied
in a later frame, never inside the same ResizeObserver delivery.

A pass that finishes after the popup closed, after its anchor changed, or after
a newer pass started SHALL write nothing.

A closed popup SHALL hold no observers or listeners, and SHALL do no work on
mount.

#### Scenario: Anchor in a scroll container

- **WHEN** the scroll container holding the anchor of an open popover scrolls
- **THEN** the popover stays attached to the anchor

#### Scenario: Popup grows while open

- **WHEN** an open popup near the bottom of the viewport grows because its
  content changed
- **THEN** it is repositioned and its available height is updated, so it does
  not extend past the viewport

#### Scenario: Flip does not cause a ResizeObserver loop

- **WHEN** a growing anchor makes an open popup using the `popup` preset flip from
  bottom to top
- **THEN** no window `error` event with "ResizeObserver loop" is dispatched

#### Scenario: Dropdown keeps its side while open

- **WHEN** a growing anchor would make an open list using the `dropdown` preset
  (sideLock "open") flip
- **THEN** the list keeps the side it opened on, and only its available size changes

#### Scenario: Anchor inside an animating dialog

- **WHEN** a popup opens inside a dialog that is still playing a scale-in
  animation
- **THEN** after the animation ends, the popup is attached to its anchor

#### Scenario: Scroll lock reserves a gutter

- **WHEN** a modal layer opens and the scroll lock adds a scrollbar gutter
  while a `side: "left"` popup is open
- **THEN** the popup is repositioned and stays attached to its anchor

#### Scenario: Stale pass after a fast sweep

- **WHEN** the pointer sweeps across several hover-card triggers within one
  frame
- **THEN** the hover card that stays open is placed against the last trigger
- **AND** it is never left at the viewport origin

#### Scenario: Many closed popups

- **WHEN** a page mounts 200 closed tooltips
- **THEN** no ResizeObserver, IntersectionObserver or scroll listener exists
  for any of them
- **AND** no positioning event is sent

### Requirement: Side Lock

With `sideLock: "open"`, the side and align chosen on the first placement
SHALL be kept until the popup closes. The popup SHALL keep shifting and
resizing to fit. Scrolling inside the popup's own content SHALL NOT
reposition it, whatever the `sideLock`.

#### Scenario: Filtering does not flip

- **WHEN** a combobox list with `sideLock: "open"` opened above its input, and
  filtering shrinks it until it would fit below
- **THEN** it stays above

#### Scenario: Arrowing through a menu partly off-screen

- **WHEN** the user arrows through the items of a scrollable menu, and the
  highlighted item scrolls the menu's content
- **THEN** the menu's position does not change

### Requirement: Anchors

The anchor SHALL be one of the following:

- an element (by default, the component's trigger or control);
- a virtual element with `getBoundingClientRect()`, and optionally
  `getClientRects()` and a context element;
- a point `{ x, y }` in viewport coordinates, treated as a 0 × 0 rectangle.

When the anchor changes while open, tracking SHALL restart against the new
anchor. A virtual or point anchor SHALL be repositioned when `reposition()` is
called, or on every frame with `tracking: "frame"`.

With `inline`, an anchor that wraps across lines SHALL be placed against the
line box nearest the pointer, or against the first line if there is no
pointer.

#### Scenario: Context menu at the pointer

- **WHEN** a context menu opens from a right-click at (600, 400) with
  `side: "right"`, `align: "start"`
- **THEN** the menu's top-left corner is at the pointer when there is room

#### Scenario: Moving virtual anchor

- **WHEN** a popover is anchored to a map marker through a virtual element,
  and the map pans and calls `reposition()`
- **THEN** the popover follows the marker

#### Scenario: Wrapped link

- **WHEN** a hover card with `inline` opens from a link that wraps across two
  lines, hovered on its second line
- **THEN** the card is placed against the second line

### Requirement: Positioning Strategy

With `strategy: "auto"`, the popup SHALL use `fixed` positioning when any of
these hold:

- the popup is, or is inside, a top-layer element (open `popover`, modal
  `<dialog>`, fullscreen element);
- the anchor is a point or a virtual element without a context element;
- the anchor has a `position: fixed` ancestor.

Otherwise the popup SHALL use `absolute` positioning.

Coordinates SHALL be rounded to the device-pixel grid. They SHALL be applied
as a translation of the positioner, which consumers SHALL NOT transform.

#### Scenario: Trigger in a fixed header

- **WHEN** a popover opens from a trigger in a fixed header and the page then
  scrolls
- **THEN** the popover stays attached to the trigger

#### Scenario: Portalled into a native modal dialog

- **WHEN** a select inside a consumer's `<dialog>` opened with `showModal()`
  opens its list after the page was scrolled
- **THEN** the list is attached to its trigger
- **AND** collisions are computed against the viewport

#### Scenario: Fractional device pixel ratio

- **WHEN** a popup opens at a `devicePixelRatio` of 1.25
- **THEN** its coordinates and `--rind-anchor-width` are multiples of 0.8 CSS px

### Requirement: Viewports, Zoom And On-Screen Keyboard

The flip decision and the available size SHALL be computed against the visual
viewport, so popups avoid an on-screen keyboard. Shifting SHALL be computed
against the layout viewport, so pinch-zoom does not drag an open popup across
the page.

#### Scenario: Pinch-zoom while open

- **WHEN** the visual viewport is zoomed to scale 2 and panned while a menu is
  open
- **THEN** the menu stays attached to its trigger in page coordinates

#### Scenario: Keyboard shrinks the visual viewport

- **WHEN** the visual viewport shrinks from the bottom while a combobox list is
  open below its input, and the list no longer fits below
- **THEN** the list either flips above the input or caps its height to the
  remaining visual viewport

### Requirement: Right-To-Left

`inline-start` and `inline-end`, and the `start` and `end` alignments, SHALL
resolve against the anchor's direction. A popup placed in a document whose
scrollbar is on the left SHALL be placed exactly as it is with a right-side
scrollbar.

#### Scenario: Submenu in RTL

- **WHEN** a submenu with `side: "inline-end"` opens in a `dir="rtl"` document
- **THEN** it is placed to the left of its trigger
- **AND** `data-side` is `left`

#### Scenario: Portalled content keeps direction

- **WHEN** a `dir="rtl"` subtree contains the trigger of a portalled select
- **THEN** the positioner carries `dir="rtl"` and the list is aligned to the
  trigger's inline-start (right) edge

### Requirement: Documents, Frames And Shadow Roots

Positioning SHALL use the window and document that own the anchor and the
floating element, never global ones. It SHALL work when both live in an
iframe, or in a shadow root. Its listeners SHALL be removed when the popup
closes or its document is discarded.

#### Scenario: Popup inside an iframe

- **WHEN** a popover opens inside a same-origin iframe that is scrolled
- **THEN** it is attached to its trigger within the iframe

#### Scenario: Iframe removed while open

- **WHEN** the iframe that holds an open popup is removed
- **THEN** no listener or observer remains registered on its window

### Requirement: Manual Mode

With `mode: "manual"`, positioning SHALL write no coordinates and no CSS
custom properties. The popup SHALL count as placed as soon as it opens, and
`data-side` and `data-align` SHALL reflect the requested placement.

Whatever the mode, the anchor SHALL carry `anchor-name: --rind-anchor-<id>`
and the positioner `position-anchor: --rind-anchor-<id>`, so that consumers
can position the popup with CSS anchor positioning.

#### Scenario: CSS-positioned popover

- **WHEN** a consumer sets `mode: "manual"` and styles the positioner with
  `position-area: bottom`
- **THEN** rind writes no `top`, `left`, `transform` or `--rind-*` coordinate
  property on the positioner
- **AND** the popover is placed by the consumer's CSS

### Requirement: Accessibility Of Positioning

Positioning SHALL NOT change DOM order, the accessibility tree, roles, names
or focus order. It SHALL NOT animate coordinates. In particular:

- with the default collision padding and the default theme, a popup SHALL
  leave its anchor visible and not covered (WCAG 2.4.11);
- popups SHALL fit a 320 CSS px viewport (accessibility rule 28);
- popups SHALL track text resizing up to 200 % (WCAG 1.4.4).

#### Scenario: Tooltip does not cover its focused trigger

- **WHEN** a tooltip opens for a focused button in a 320 px wide viewport
- **THEN** the tooltip box does not intersect the button's box

#### Scenario: Text resized while open

- **WHEN** the root font size doubles while a popover is open
- **THEN** the popover is repositioned and stays inside the viewport

#### Scenario: Positioning leaves the tree untouched

- **WHEN** a popup opens, is placed, flips, and closes
- **THEN** its role, accessible name, DOM parent and tab order are the same as
  they would be with positioning disabled

### Requirement: Positioning Capability

Machines SHALL reach positioning only through an injected `position`
capability. Given the anchor, the positioner, the options and a callback, the
capability SHALL start tracking and return a cleanup function. Its result
SHALL report the placed side and align, the anchor-hidden state, and the
first placement.

A fake implementation SHALL let a test run a machine in Node and emit
placement results without a DOM. In an environment without layout (jsdom), the
DOM implementation SHALL NOT throw, SHALL report the first placement on open,
and SHALL report the requested side and align.

#### Scenario: Machine test with a fake capability

- **WHEN** an anchored fixture machine runs in Node with a fake `position`
  capability that emits side `top`
- **THEN** connect returns `data-side="top"` for the positioner

#### Scenario: jsdom open resolves

- **WHEN** a driver runs `open()` on an anchored fixture in jsdom with
  `@rind-ui/testing/setup`
- **THEN** the postcondition holds, and `isPlaced()` is true

### Requirement: Positioning Contract And Layout Invariant

Every anchored component's contract SHALL include the queries `side()`,
`align()`, `isAnchorHidden()` and `isPlaced()`. These queries SHALL read the
placement attributes only, never geometry.

`@rind-ui/testing` SHALL provide a layout invariant that runs only in
browser mode. After placement, it SHALL check that:

- the popup lies inside the visual viewport minus `collisionPadding`, or is
  capped to it;
- it does not overlap its anchor on the side axis, unless the component
  allows it;
- it lies on the side reported by `data-side`;
- a centred arrow points at the anchor.

Outside browser mode, the invariant SHALL be skipped and the run summary
SHALL say so.

#### Scenario: Invariant catches an overflowing popup

- **WHEN** a broken fixture places its popup 20 px past the right edge of the
  viewport
- **THEN** the layout invariant fails and names the popup, its side and the
  overflowing edge

#### Scenario: Invariant in jsdom

- **WHEN** the layout invariant runs in jsdom
- **THEN** it is skipped, and the summary reports it as unexercised
