# scroll-area Specification

## Purpose
Defines the Scroll Area: a native scroll container whose native scrollbars are hidden and
replaced by custom-drawn, pointer-operable scrollbars, while wheel, touch, momentum,
keyboard scrolling, zoom, find-in-page, RTL and forced colors keep working natively.
## Requirements
### Requirement: Anatomy

A Scroll Area SHALL consist of a Root, a Viewport (the scroll container), a Content
inside the Viewport, zero, one or two Scrollbars (`orientation` `vertical` (default) or
`horizontal`), each containing a Thumb, and an optional Corner. Content SHALL be an
explicit part: no element SHALL be inserted between the Viewport and the consumer's
children other than Content, and no part SHALL receive a layout-changing inline style
(`display`, `width`, `min-width`) beyond positioning of Scrollbars, Thumbs and Corner.
Root and Content SHALL have no role; Scrollbar, Thumb and Corner are presentational
(see "Scrollbars Hidden From Assistive Technology").

#### Scenario: Minimal scroll area

- **WHEN** a consumer renders Root > Viewport > Content with 50 paragraphs, and a
  vertical Scrollbar > Thumb, inside a 200 px high Viewport
- **THEN** the content scrolls natively, the custom thumb tracks the position, and no
  native scrollbar is painted

#### Scenario: Ellipsis and sticky content (radix-ui/primitives#926, #2783)

- **WHEN** Content holds a row with `text-overflow: ellipsis` and a header with
  `position: sticky; inset-inline-start: 0`
- **THEN** the text is truncated at the Viewport's width and the header sticks, as in a
  plain `overflow: auto` element

### Requirement: Native Scrolling Is Kept

The Viewport SHALL scroll through the browser's native scrolling only. The component
SHALL NOT handle any key event, SHALL NOT call `preventDefault` on wheel, touch or
pointer events that target the Viewport or its Content, and SHALL NOT animate scroll
positions in script. Arrow keys, PageUp/PageDown, Home/End and Space/Shift+Space SHALL
scroll the Viewport whenever focus is on the Viewport or inside its Content, exactly as
in an unstyled scroll container.

#### Scenario: Keyboard scrolling

- **WHEN** focus is on the Viewport and the user presses PageDown, then End
- **THEN** the Viewport scrolls by one page, then to the end, and the thumb follows

#### Scenario: Focus scrolls into view

- **WHEN** the user tabs to a button below the visible part of the Content
- **THEN** the Viewport scrolls the button into view natively and the thumb follows

### Requirement: Native Scrollbars Hidden Without Breaking Zoom Or Forced Colors

The component SHALL hide the Viewport's native scrollbars and give it `overflow: auto`
through one rule injected once per document, inside an anonymous cascade layer so that
any consumer rule overrides it, carrying the environment's CSP nonce and written as text
content (never as HTML). The rule SHALL use `scrollbar-width: none` and, for engines
without it, `::-webkit-scrollbar { display: none }`. Wheel events with `ctrlKey` (browser
zoom and trackpad pinch) SHALL never be intercepted, and the Viewport's `touch-action`
SHALL stay the default so pinch-zoom works over it. A consumer SHALL be able to restore
native scrollbars (for example under `forced-colors: active`) with one rule of their own.

#### Scenario: Firefox hides the native bar (huntabyte/bits-ui#540, unovue/reka-ui#317)

- **WHEN** a Scroll Area renders in Firefox
- **THEN** no native scrollbar is painted next to the custom one

#### Scenario: Strict CSP (mui/base-ui#3550, radix-ui/primitives#3117)

- **WHEN** the page sends `Content-Security-Policy: style-src 'nonce-abc'; require-trusted-types-for 'script'` and the environment's nonce is `abc`
- **THEN** the injected rule applies with no CSP or Trusted Types violation

#### Scenario: Ctrl+wheel over a scrollbar zooms

- **WHEN** the user holds Ctrl and turns the wheel with the pointer over a custom
  scrollbar
- **THEN** the event is not prevented and the Viewport does not scroll

#### Scenario: Native bars in forced colors

- **WHEN** a consumer adds `@media (forced-colors: active) { [data-scope="scroll-area"][data-part="viewport"] { scrollbar-width: auto } }`
- **THEN** native scrollbars are painted in forced-colors mode without `!important`

### Requirement: Viewport Tab Stop

The Viewport SHALL have `tabindex="0"` exactly when it has been measured, it overflows
on at least one axis, and its Content contains no element in the sequential focus order;
otherwise it SHALL have no `tabindex` attribute. The tabindex SHALL NOT be present before
the first measurement, and SHALL NOT be removed while the Viewport itself has focus (it
is removed on the next blur). A `tabIndex` given by the consumer SHALL override the rule.
Changes to the Content (added, removed or disabled focusable elements) SHALL re-apply the
rule.

#### Scenario: Text-only content in a modal dialog (adobe/react-spectrum#10395)

- **WHEN** a modal dialog contains a Scroll Area with overflowing text and then a Close
  button, and the user presses Tab from the dialog's first element
- **THEN** focus reaches the Viewport before the button, and ArrowDown scrolls it

#### Scenario: Safari has no native focusable scrollers

- **WHEN** the same text-only Scroll Area renders in Safari
- **THEN** the Viewport is in the tab order and passes axe `scrollable-region-focusable`

#### Scenario: Content with buttons is not an extra stop

- **WHEN** an overflowing Scroll Area contains a list of buttons
- **THEN** the Viewport has no `tabindex`, Tab goes directly to the first button, and
  arrow keys on a button scroll the Viewport

#### Scenario: No overflow, no stop (unovue/reka-ui ScrollAreaViewport)

- **WHEN** the Content fits in the Viewport
- **THEN** the Viewport has no `tabindex`

#### Scenario: Measuring never steals focus (mui/base-ui#4205)

- **WHEN** a dialog opens with a Scroll Area whose content does not overflow
- **THEN** the dialog's initial focus never lands on the Viewport, and focus is not lost
  after the first measurement

#### Scenario: Overflow ends while focused

- **WHEN** the Viewport has focus and its content shrinks so it no longer overflows
- **THEN** the Viewport keeps its `tabindex` and focus until it is blurred, then loses
  the `tabindex`

### Requirement: Viewport Name And Role

The Viewport SHALL have no role by default (never `presentation` or `none`). When the
consumer gives it a name (`aria-label` or `aria-labelledby` on the Viewport) it SHALL
have `role="region"`. In development, a Viewport that is in the tab order without a name
SHALL be reported through the injected logger.

#### Scenario: Focusable viewport is not presentational (mui/base-ui#5812)

- **WHEN** the Viewport is a tab stop
- **THEN** it has no `role="presentation"` and an accessibility checker reports no
  presentational-role conflict

#### Scenario: Named region

- **WHEN** the consumer sets `aria-label="Release notes"` on the Viewport
- **THEN** the Viewport has `role="region"` and the accessible name "Release notes"

### Requirement: Scrollbars Hidden From Assistive Technology

Every Scrollbar, Thumb and Corner SHALL have `aria-hidden="true"`, SHALL contain no
focusable element, and pressing them SHALL NOT move focus (the default action of
`mousedown` is prevented, as native scrollbars do).

#### Scenario: Scrollbar is not an extra item (mui/base-ui#5585)

- **WHEN** a screen-reader user moves the virtual cursor through a Scroll Area
- **THEN** no scrollbar, thumb or corner is reached

#### Scenario: Pressing the thumb keeps focus

- **WHEN** focus is in a text field inside the Content and the user drags the thumb
- **THEN** focus stays in the text field

### Requirement: Overflow Detection

An axis SHALL count as overflowing only when the Viewport's scroll size on that axis
exceeds its client size **and** the Viewport's computed `overflow` on that axis is `auto`
or `scroll`. Until the first measurement, no axis SHALL count as overflowing.

#### Scenario: Consumer hides an axis (unovue/reka-ui#2802)

- **WHEN** the consumer sets `overflow-x: hidden` on the Viewport and the content is
  wider than it
- **THEN** the horizontal Scrollbar is hidden and `data-overflow-x` is absent

#### Scenario: No attributes before measuring (mui/base-ui#3829)

- **WHEN** the component renders on the server or before its first measurement
- **THEN** Root and Viewport carry no `data-overflow-*` attribute

### Requirement: Re-Measuring

Overflow, thumb size and thumb position SHALL be recomputed, coalesced to at most once
per animation frame, when the Viewport scrolls, when the Viewport, the Content or a
direct child of the Content changes size, when children are added to or removed from the
Content's subtree, when the direction changes, and when the consumer calls the exported
`measure()`. Measurement SHALL read the Viewport's scroll and client sizes (never the
Content's box) and SHALL perform all reads before any write. Every recomputation SHALL
update both size and position.

#### Scenario: Collapsible inside (mui/base-ui#4696)

- **WHEN** a Collapsible inside the Content collapses so the content no longer overflows
- **THEN** the Scrollbar hides in the next frame

#### Scenario: Content grows while scrolled to the end (unovue/reka-ui#2303)

- **WHEN** the user is scrolled to the bottom and items are appended
- **THEN** the thumb shrinks and moves to the position matching the new scroll ratio

#### Scenario: Many scroll areas (mui/base-ui#3534)

- **WHEN** a page renders 30 Scroll Areas
- **THEN** mounting causes no interleaved layout read after a style write within one
  frame

### Requirement: Thumb Geometry

The thumb's size along its axis SHALL be the track's inner length (after the Scrollbar's
padding) times client size ÷ scroll size, exposed as `--rind-scroll-area-thumb-size` on
the Thumb; its rendered size (which CSS may raise with a minimum) SHALL be used for
positioning. The thumb's offset SHALL be computed in physical coordinates from a
normalised scroll range: `[−max, 0]` when the axis is reversed (horizontal under
`direction: rtl` XOR `row-reverse`; vertical under `column-reverse`), else `[0, max]`,
with the direction and flex direction read from the Viewport's computed style at each
measure; the offset SHALL be clamped to the track and SHALL never be `NaN`. The Corner
SHALL report the Scrollbars' thicknesses as `--rind-scroll-area-corner-width` and
`-height` on the Root, both `0px` whenever either Scrollbar is hidden.

#### Scenario: RTL page without a provider (mui/base-ui#5300, #1189)

- **WHEN** the document is `dir="rtl"`, no direction is passed to the component, and the
  user scrolls the content horizontally toward its end
- **THEN** the horizontal thumb moves from the right edge toward the left

#### Scenario: Reversed column (radix-ui/primitives#1585, chakra-ui/zag#3073)

- **WHEN** the Viewport is `display: flex; flex-direction: column-reverse` (a chat log)
  and the user scrolls up from the initial position
- **THEN** the thumb starts at the bottom of the track and moves up

#### Scenario: Corner resets (radix-ui/primitives#2383)

- **WHEN** both Scrollbars were visible and the content stops overflowing horizontally
- **THEN** `--rind-scroll-area-corner-width` and `-height` are `0px` and the vertical
  Scrollbar spans the full height

### Requirement: Visibility Types

The Root SHALL take `type` (`hover` (default), `scroll`, `auto`, `always`) and
`hideDelay` (default 600 ms). A Scrollbar SHALL have `data-state="visible"` when: `always`
— always; `auto` — its axis overflows; `hover` — its axis overflows and the pointer is
over the Root, focus is inside the Root, a user scroll happened, a drag is in progress, or
fewer than `hideDelay` ms passed since the last of these ended; `scroll` — its axis
overflows and a user scroll or drag is in progress, the pointer is over a Scrollbar, or
fewer than `hideDelay` ms passed since the last ended. Otherwise `data-state="hidden"`. A
scroll SHALL count as ended 100 ms after the last `scroll` event. Pointer hover SHALL
count only for mouse and pen. A scroll SHALL count as a user scroll only when a wheel,
touch, pointer or key interaction on the Viewport preceded it, or in touch modality;
programmatic scrolls SHALL update the thumb without changing visibility. All delays SHALL
run through the injected scheduler. Scrollbars and Thumbs SHALL stay mounted while their
axis overflows, whatever their visibility, so showing never re-creates them.

#### Scenario: Hover shows, leave hides after the delay

- **WHEN** `type="hover"`, the pointer enters the Root, then leaves, and 600 ms pass on
  a fake clock
- **THEN** the vertical Scrollbar is `visible` on enter, still `visible` at 599 ms, and
  `hidden` at 600 ms

#### Scenario: Keyboard users see the position

- **WHEN** `type="hover"` and the user tabs onto the Viewport
- **THEN** the Scrollbar is `visible` while focus is inside the Root

#### Scenario: Scroll type ignores hover

- **WHEN** `type="scroll"` and the pointer rests over the Content without scrolling
- **THEN** the Scrollbar stays `hidden`

#### Scenario: Programmatic scroll stays quiet (mui/base-ui#983)

- **WHEN** the app calls `scrollIntoView` on an item at load with `type="scroll"`
- **THEN** the thumb moves to the new position and the Scrollbar stays `hidden`

#### Scenario: Re-hover does not jump the thumb (huntabyte/bits-ui#1374)

- **WHEN** `type="hover"`, the user scrolls to the bottom, leaves, waits until hidden and
  re-enters
- **THEN** the thumb is shown at the bottom without moving from another position

### Requirement: Thumb Drag

Pressing a Thumb with a primary mouse button, a pen or a touch SHALL start a drag through
the `pointer-drag` capability on its Scrollbar, with the grab offset recorded at the
press and the thumb's half size as inset, so the thumb stays under the pointer; each move
SHALL set the Viewport's scroll position on that axis from the reported fraction, mapped
into the normalised physical range. During a drag the Viewport's `scroll-snap-type` SHALL
be `none` and SHALL be restored at the end; no style of `body` or `html` SHALL be
changed. Releasing outside the Scrollbar SHALL keep the new position (no revert). Only
the dragged axis SHALL carry `data-dragging`.

#### Scenario: Drag to the end

- **WHEN** the user presses the vertical thumb and moves the pointer past the end of the
  track
- **THEN** the Viewport is scrolled to its maximum and the thumb sits at the track's end

#### Scenario: Only one axis is dragging (chakra-ui/zag#3418)

- **WHEN** both Scrollbars are shown and the user drags the horizontal thumb
- **THEN** the horizontal Scrollbar and Thumb have `data-dragging` and the vertical ones
  do not

#### Scenario: Snap does not fight the drag (Base UI ScrollAreaRoot)

- **WHEN** the Viewport has `scroll-snap-type: y mandatory` and the user drags the thumb
  slowly
- **THEN** the content follows the pointer without jumping to snap points, and snapping
  resumes after release

#### Scenario: Fast drag leaves the page usable (huntabyte/bits-ui#1900, mui/base-ui#2329)

- **WHEN** the user drags the thumb very fast and releases outside the window
- **THEN** text on the page is selectable afterwards and moving over the Scrollbar does
  not move the thumb

#### Scenario: Hover without a press (mui/base-ui#5371)

- **WHEN** a drag ended without a `pointerup` reaching the page and the pointer moves
  over the thumb with no button pressed
- **THEN** the thumb does not move

#### Scenario: Release outside keeps the position (mui/base-ui#4433)

- **WHEN** the user drags the thumb halfway and releases outside the Scroll Area
- **THEN** the Viewport stays at the dragged position

### Requirement: Track Press

A primary mouse or pen press on a Scrollbar outside its Thumb SHALL, with `trackPress`
`page` (default), scroll the Viewport one client length toward the press; with `jump`,
it SHALL centre the thumb on the press and continue as a drag until release. Touch
presses on the track SHALL do nothing, and the track SHALL keep the default
`touch-action`, so a finger on it pans the page; only Thumbs SHALL have
`touch-action: none`. Scrollbar parts SHALL have `user-select: none`.

#### Scenario: Page toward the press

- **WHEN** the Viewport is at the top and the user clicks the vertical track below the
  thumb
- **THEN** the Viewport scrolls down by its client height

#### Scenario: Horizontal bar on a phone (mui/base-ui#2825)

- **WHEN** on a touch device the user puts a finger on a horizontal Scrollbar's track and
  swipes up
- **THEN** the page scrolls vertically

### Requirement: Wheel Over Scrollbars

A non-passive `wheel` listener on each Scrollbar element (never on the document) SHALL
forward the wheel to the Viewport: the vertical Scrollbar with `deltaY`, the horizontal
one with `deltaX`, else `deltaY`, converting line and page delta modes. When the Viewport
can still scroll in the wheel's direction, the event SHALL be prevented and the Viewport
scrolled. At an edge the event SHALL NOT be prevented (so it chains to the parent
scroller) unless the Viewport's computed `overscroll-behavior` on that axis is `contain`
or `none`, in which case it SHALL be prevented without scrolling. Events with `ctrlKey`
SHALL be ignored.

#### Scenario: Overscroll containment over the track (radix-ui/primitives#1667)

- **WHEN** the Viewport has `overscroll-behavior: contain`, is scrolled to the bottom,
  and the user wheels down over its Scrollbar
- **THEN** the page does not scroll

#### Scenario: Chaining at the edge

- **WHEN** the Viewport has the default `overscroll-behavior`, is at the bottom, and the
  user wheels down over its Scrollbar
- **THEN** the page scrolls

#### Scenario: No listener after unmount (huntabyte/bits-ui#2116, radix-ui/primitives#1973)

- **WHEN** a Scroll Area is mounted and unmounted 100 times
- **THEN** the document has no wheel listener, observer, or animation-frame callback left
  from it

### Requirement: Nested Scroll Areas

Each Scroll Area SHALL measure, forward wheels and track hover and drags for its own parts
only, resolved through its own instance. A wheel over an inner Scrollbar at an inner edge
SHALL chain to the outer Viewport; dragging an inner thumb SHALL NOT change the outer
area's `data-dragging` or position.

#### Scenario: Inner at its end

- **WHEN** an inner Scroll Area inside an outer one is scrolled to its bottom and the
  user wheels down over the inner Scrollbar
- **THEN** the outer Viewport scrolls and the inner position is unchanged

#### Scenario: Independent attributes

- **WHEN** the user drags the inner thumb
- **THEN** only the inner Scrollbar and Thumb carry `data-dragging`

### Requirement: Server Rendering And Hydration

The server render and the first client render SHALL produce identical markup: no
`tabindex` on the Viewport, no `data-overflow-*`, every Scrollbar `data-state="hidden"`
(except `type="always"`, whose Scrollbar is `visible` with its Thumb hidden until
measured), no thumb size or offset variables. The first measurement SHALL run after
hydration.

#### Scenario: No flash of a wrong thumb (mui/base-ui#4103)

- **WHEN** a page with a Scroll Area is server-rendered and hydrated
- **THEN** no thumb is painted before the first measurement, and hydration reports no
  mismatch

### Requirement: Positioned Content

Content SHALL be a containing block for absolutely positioned descendants
(`position: relative` from the injected layered rule), so hidden form inputs and other
absolutely positioned descendants stay inside the scroller.

#### Scenario: Checkbox at the bottom (chakra-ui/ark#3705)

- **WHEN** the user scrolls a Scroll Area to the bottom and checks a Checkbox there
- **THEN** neither the page nor the Viewport jumps

### Requirement: Scroll Area Data Attributes

Parts SHALL expose, with `data-scope="scroll-area"` and their `data-part`:

| Part | Attributes |
|---|---|
| Root | `data-hovering` (mouse/pen over the Root), `data-scrolling` (user scroll in progress, any axis), `data-overflow-x`, `data-overflow-y`, `data-overflow-x-start`, `data-overflow-x-end`, `data-overflow-y-start`, `data-overflow-y-end` (content hidden beyond that logical edge); CSS variables `--rind-scroll-area-corner-width`, `--rind-scroll-area-corner-height` |
| Viewport | the same `data-overflow-*` attributes; `data-focus-visible`; CSS variables `--rind-scroll-area-overflow-x-start`, `-x-end`, `-y-start`, `-y-end` (distance in px still hidden beyond each logical edge) |
| Content | `data-overflow-x`, `data-overflow-y` |
| Scrollbar | `data-orientation`, `data-state` (`visible` / `hidden`), `data-scrolling` (its axis), `data-dragging` (its axis), `data-hovering` |
| Thumb | `data-orientation`, `data-dragging` (its axis); CSS variable `--rind-scroll-area-thumb-size` |
| Corner | `data-state` (`visible` when both Scrollbars are visible, else `hidden`) |

Edges are logical: `x-start` is the inline start (the right side under RTL). Attributes
SHALL be absent, not `"false"`, when their condition is false. The Root SHALL pass the
consumer's `data-variant`, `data-size` and `data-tone` through untouched.

#### Scenario: Fade mask at the bottom

- **WHEN** the Viewport is at the top of overflowing content
- **THEN** the Root has `data-overflow-y-end` but not `data-overflow-y-start`, and
  `--rind-scroll-area-overflow-y-end` equals the hidden distance in px

#### Scenario: Logical edges under RTL

- **WHEN** under `dir="rtl"` the Viewport is at its inline start of wide content
- **THEN** the Root has `data-overflow-x-end` and not `data-overflow-x-start`

### Requirement: Scroll Area Contract

The `scroll-area` contract SHALL locate an instance by its Viewport's `region` role and
exact name, or, for an unnamed area, by text contained in its Content. It SHALL declare
the traits `directional` and these actions: `focusViewport()` (keyboard: Tab to the
Viewport; virtual: programmatic focus); `scroll(axis, to)` with `to` one of `start`,
`end`, `page-forward`, `page-back` (keyboard: focus the Viewport and press Home, End,
PageDown, PageUp on the vertical axis, repeated ArrowRight/ArrowLeft on the horizontal
axis until the postcondition holds; pointer: a track press or a thumb drag to the end);
`dragThumb(axis, fraction)` (pointer and touch through the driver's pointer steps;
keyboard declared as not existing, reason "a fractional position has no key; `scroll`
covers keyboard"); `pressTrack(axis, side)` (pointer; keyboard twin `scroll(axis,
page-*)`); `hover()` / `unhover()` (pointer; keyboard twin `focusViewport()`). Queries:
`hasOverflow(axis)`, `isScrollbarVisible(axis)`, `atStart(axis)`, `atEnd(axis)`,
`isDragging(axis)`, `isTabStop()`. Its invariants SHALL check after every step: the
Viewport-tab-stop rule; Scrollbar, Thumb and Corner are `aria-hidden` and contain no
focusable element; at most one axis has `data-dragging`; the Viewport never has a
presentational role.

#### Scenario: Keyboard scroll through the driver

- **WHEN** a driver test runs `scroll("y", "end")` with the keyboard modality on a
  text-only area
- **THEN** focus is on the Viewport, `atEnd("y")` is true and the scroll position was
  changed by native key handling

#### Scenario: Consumer wrapper removes the tab stop

- **WHEN** `testMachine` runs the contract against a consumer wrapper that passes
  `tabIndex={-1}` to a Viewport with text-only overflowing content
- **THEN** the tab-stop invariant fails and names the Viewport

### Requirement: Theme

`packages/theme/src/scroll-area.css` SHALL style the Scroll Area as a member of the
`decoration` family (no `data-variant`, no `data-size`), reading only
`--rind-scroll-area-*` tokens with semantic fallbacks: scrollbar thickness and padding,
track background, thumb background per state (rest, hover, dragging), thumb radius and
minimum size, corner background, and show/hide duration. Visibility transitions SHALL use
the reduced-motion duration tokens. Under `forced-colors: active` the thumb SHALL be
painted with `CanvasText` and `forced-color-adjust: none`. `data-tone="danger"` on the
Root SHALL tint the thumb with the danger role.

#### Scenario: Forced colors

- **WHEN** a Playwright run emulates `forced-colors: active`
- **THEN** the visible thumb is painted in the system text colour against the canvas

#### Scenario: Reduced motion

- **WHEN** `prefers-reduced-motion: reduce` is set and the Scrollbar hides
- **THEN** it hides without a transition

