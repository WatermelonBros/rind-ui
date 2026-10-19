# marquee Specification

## Purpose
TBD - created by archiving change add-marquee. Update Purpose after archive.
## Requirements
### Requirement: Anatomy

A Marquee SHALL consist of `Root`, `Viewport` and `Content`, and MAY contain a
`PauseTrigger`. `Content` SHALL render the consumer's element and children once as the
original (index 0), followed by the copies the loop needs, each rendered with the same
element and children. `Root` SHALL have no role of its own and SHALL forward `role`,
`aria-label` and `aria-labelledby`. `PauseTrigger` SHALL be a native `button` with
`type="button"`. Every part SHALL accept the `render` prop. The server render SHALL contain
the original and its copies, and SHALL NOT read `matchMedia` or layout.

#### Scenario: Server render

- **WHEN** a Marquee whose Content renders a `ul` with three `li` is rendered on the server
- **THEN** the HTML contains the `ul` twice, the second with `aria-hidden="true"` and
  `data-copy`, every part has `data-state="idle"`, and hydration produces no warning

#### Scenario: Content keeps its element (RFM#91)

- **WHEN** `Marquee.Content` is given `render={<ul />}`
- **THEN** the original and every copy are `ul` elements

### Requirement: Motion States

The Marquee SHALL be in exactly one of `idle`, `running`, `paused` or `static`, chosen in
this order: `static` while reduced motion is preferred; `idle` until the viewport and one
copy have been measured with non-zero sizes; `paused` while the user pause holds or a
hovering pointer pauses it; otherwise `running`. The motion SHALL NOT start before the
first measurement.

#### Scenario: Measured, then running

- **WHEN** a Marquee mounts and its first measurement reports a viewport of 600 px and a
  copy of 900 px
- **THEN** its state goes from `idle` to `running`

#### Scenario: Zero size

- **WHEN** a running Marquee's viewport is measured at 0 px (for example, inside a
  `display: none` ancestor)
- **THEN** its state is `idle`, and it never computes a duration from a zero size

### Requirement: Pause Control

Pressing the `PauseTrigger` SHALL toggle the user pause. Its accessible name SHALL be
`messages.pause` (default "Pause animation") while the user pause is off and
`messages.play` (default "Play animation") while it holds, unless the consumer gives it a
name. It SHALL NOT carry `aria-pressed`. The user pause SHALL be controllable through
`paused`, `defaultPaused` and `onPausedChange(paused, details)`, with `details.reason`
`"trigger"` or `"focus"`. A controlled Marquee SHALL apply a proposal only when the
parent passes the new `paused`. Resuming SHALL continue from the position where the motion
paused. In `static` the PauseTrigger SHALL be `hidden`.

#### Scenario: Pause and resume in place (WCAG 2.2.2, G4)

- **WHEN** the PauseTrigger of a running Marquee is pressed, then pressed again
- **THEN** the state is `paused` with the trigger named "Play animation", then `running`
  with the trigger named "Pause animation", and the animation's `currentTime` after
  resuming equals its `currentTime` when paused

#### Scenario: Controlled refusal

- **WHEN** a controlled Marquee with `paused={false}` has its PauseTrigger pressed and the
  parent does not apply `true`
- **THEN** `onPausedChange(true, { reason: "trigger" })` is called and the state stays
  `running`

### Requirement: Hover And Focus Pause

With `pauseOnHover` (default `true`), a mouse or pen pointer over the `Viewport` SHALL
pause the motion until it leaves. A touch pointer SHALL never pause by hovering. Leaving
SHALL NOT clear the user pause. Keyboard or virtual focus moving into the `Viewport` SHALL
set the user pause (reason `"focus"`). Focus leaving SHALL NOT resume; only the user
resumes. Pointer or touch focus SHALL NOT set the user pause.

#### Scenario: Hover never clears the user's pause (Zag one-flag bug)

- **WHEN** the user pauses a Marquee with the trigger, then a mouse enters and leaves the
  Viewport
- **THEN** the state stays `paused` and the trigger stays named "Play animation"

#### Scenario: Keyboard focus stops it for good (APG Carousel)

- **WHEN** the user tabs from the PauseTrigger into a link in the Content, then tabs out
  of the Marquee
- **THEN** the state is `paused` from the moment the link is focused and stays `paused`
  after focus leaves, and `onPausedChange(true, { reason: "focus" })` was called once

#### Scenario: Touch does not hover

- **WHEN** a touch pointer taps the Viewport of a running Marquee
- **THEN** its state stays `running`

### Requirement: Reduced Motion

The Marquee SHALL read reduced motion only from the Environment's `MotionPreference`. It
SHALL read it after hydration and SHALL follow every later change. While reduced motion is
preferred, the state SHALL be `static`: one copy only (the original), no animation, and
a wrapping layout with no clipping, so all of the content is visible.

#### Scenario: Static, everything visible

- **WHEN** a Marquee whose content is wider than its viewport mounts with
  `reducedMotion: true`
- **THEN** its state is `static`, `Content` renders no copy, the original wraps inside the
  viewport with no clipped item, and the PauseTrigger is hidden

#### Scenario: Preference changes at runtime

- **WHEN** reduced motion turns on while a Marquee is running, then turns off
- **THEN** its state becomes `static`, then `running` again (or `paused` if the user pause
  holds)

### Requirement: Copies

Every copy SHALL carry `aria-hidden="true"` and `data-copy`. No element inside a copy
SHALL be tabbable: tabbable elements SHALL get `tabindex="-1"`, including elements a child
renders later. Copies SHALL NOT be `inert`, so a pointer can still activate them. The copy
count SHALL be 1 in `static`. With `autoFill` and a measurement, it SHALL be
`ceil(viewport / copy) + 1`, at most 32. Otherwise it SHALL be 2. In development, an
element with an `id` inside the Content SHALL log a warning, because the copies duplicate
it.

#### Scenario: Read once, tabbed once (RFM#40)

- **WHEN** a Marquee's Content holds three links and the user tabs from the PauseTrigger
- **THEN** Tab visits exactly three links, all in the original, and the accessibility tree
  exposes each link once

#### Scenario: Copies stay clickable

- **WHEN** a pointer clicks a link inside a copy
- **THEN** the link is activated

#### Scenario: Bounded fill (RFM#66)

- **WHEN** an `autoFill` Marquee's copy measures 20 px in a 1000 px viewport
- **THEN** it renders 32 copies in total, and the viewport's size does not depend on its
  copies

### Requirement: Speed

`speed` SHALL be in CSS pixels per second (default 50). The animation duration SHALL be
one copy's size on the axis, including its trailing gap, divided by `speed`. It SHALL be
exposed as `--rind-marquee-duration` on the Viewport. It SHALL be recomputed whenever the
viewport or the copy changes size (resize, font load, new content) or `speed` changes. A
`speed` below 1 or not finite SHALL be treated as 1, with a development warning.

#### Scenario: Speed independent of content length (Zag#3231, RFM#3)

- **WHEN** two Marquees with `speed={100}` have copies of 500 px and 2000 px
- **THEN** their durations are 5 s and 20 s

### Requirement: Timing Continuity

A change of duration SHALL keep the animation's progress, not its elapsed time. A change
of `reverse` SHALL keep the content's position. Both SHALL take effect before the next
paint. The content SHALL NOT jump.

#### Scenario: Resize keeps position (RFM#9, #47)

- **WHEN** a Marquee at 40 % of its loop has its duration change from 10 s to 20 s
- **THEN** its animation is still at 40 % of its loop after the change

#### Scenario: Reverse keeps position (RFM#35, Magic UI#215)

- **WHEN** a paused Marquee at 30 % of its loop gets `reverse`
- **THEN** every copy is at the same translated position before and after the change

### Requirement: Focus Reveal

When keyboard or virtual focus moves to an element in the Content that is not fully
inside the Viewport's box, the Marquee SHALL bring the element into view. It SHALL do so
by seeking the copies' animations so that the element's start sits at the Viewport's
start. The Viewport SHALL clip with `overflow: clip` and SHALL NOT be scrolled by focus or
by the Marquee.

#### Scenario: Focused link not obscured (2.4.11)

- **WHEN** a running Marquee's first link is outside the Viewport and the user tabs to it
- **THEN** the link's box is inside the Viewport's box, the state is `paused`, and the
  Viewport's `scrollLeft` is 0

### Requirement: Direction

Horizontally, the content SHALL move toward the inline start of its direction: leftward
in left-to-right, rightward in right-to-left. Vertically (`orientation="vertical"`), it
SHALL move upward. `reverse` SHALL move it the opposite way. A vertical Marquee SHALL lay
out its content as a column and SHALL NOT rotate it.

#### Scenario: Right to left (RFM#79, Nuxt UI#4813)

- **WHEN** a Marquee renders with `dir="rtl"`
- **THEN** its copies move toward the right, and the loop has no seam

### Requirement: Data Attributes

Every part SHALL carry `data-scope="marquee"`, `data-part`, `data-instance`, `data-state`
and `data-orientation`, and `data-reverse` while reversed. `Content` SHALL carry
`data-index`, and copies `data-copy`. `PauseTrigger` SHALL carry `data-paused` while the
user pause holds.

#### Scenario: Hover pause is not the user pause

- **WHEN** a mouse hovers a running Marquee with `pauseOnHover`
- **THEN** every part has `data-state="paused"` and the PauseTrigger has no `data-paused`

### Requirement: Contract

The Marquee SHALL ship `marqueeContract`, located by `data-scope="marquee"` and
`data-part="root"` and narrowed by the Root's accessible name when it has one. It SHALL
have actions `togglePause`, `hover`, `leave` and `focusContent`, queries `state`,
`isPaused`, `triggerLabel`, `copies` and `duration`, trait `directional`, and a
`getMarquee` driver. `hover` with a touch modality SHALL be a no-op by contract.

#### Scenario: Same driver test in jsdom and a browser

- **WHEN** `getMarquee(screen).togglePause()` runs on a measured Marquee in jsdom and in
  Chromium
- **THEN** both report `isPaused()` true and `triggerLabel()` "Play animation"

### Requirement: Marquee Invariants

After every model step:
- exactly one copy SHALL be exposed to assistive technology;
- every other copy SHALL be `aria-hidden` and SHALL contain no element with
  `tabIndex >= 0`;
- the PauseTrigger's name SHALL agree with the user pause;
- the state SHALL be `static` exactly when reduced motion is preferred, and then there
  SHALL be one copy and a hidden PauseTrigger;
- `running` SHALL imply that the user pause is off and that no hovering pointer pauses
  the Marquee.

#### Scenario: Model walk

- **WHEN** `testMachine(marqueeContract, …)` walks every transition in every
  configuration, modality and direction
- **THEN** every invariant holds after every step

### Requirement: Theme

`@rind-ui/theme` SHALL ship `marquee.css` in `@layer rind.components` with `:where()`
selectors, family `decoration`. It SHALL:
- define the keyframes, mirrored for right to left;
- animate copies only in `data-state="running"`, hold them with
  `animation-play-state: paused` in `paused`, and not animate them in `idle` or `static`;
- keep copies composited (`backface-visibility: hidden`);
- fade the edges with `mask-image` sized by `--rind-marquee-fade`;
- take the gap from `--rind-marquee-gap`;
- remove the animation under `prefers-reduced-motion: reduce`;
- draw the PauseTrigger at least 24 × 24 CSS px, with an outline focus ring that stays
  visible under forced colours.

The sheet SHALL use logical directions only, except in the mirrored keyframes.

#### Scenario: Paused holds position

- **WHEN** a themed running Marquee is hovered
- **THEN** its copies' animations report `playState` `"paused"`, with an unchanged
  `currentTime` until the pointer leaves

