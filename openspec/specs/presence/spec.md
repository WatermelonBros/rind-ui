# presence Specification

## Purpose
Keeps a closing part mounted until its exit animations finish and then removes it,
for CSS transitions, keyframe animations and Web Animations alike, without ever
delaying the closed semantics (layer release, focus restore, unlocks).
## Requirements
### Requirement: Presence States

Every part that can animate out SHALL have a presence with three states: `present`,
`exiting` and `absent`. Opening SHALL make it `present`; closing SHALL make it
`exiting`; it SHALL become `absent` (unmounted) when its exit animations have
finished. Each animated part (content, backdrop, positioner) SHALL have its own
presence, and a portal SHALL stay mounted until all of its parts are absent.

#### Scenario: Backdrop animates out

- **WHEN** a dialog with fade-out animations on both backdrop and content closes
- **THEN** both stay mounted until their own animations end (regression: ark#3675)

### Requirement: Waiting For Exit Animations

An exiting part SHALL wait for the finite animations running on its own element
(CSS transitions, CSS animations and Web Animations, read through
`getAnimations()` after the closed state is applied) and SHALL become absent when
they have all finished or been cancelled without replacement. Infinite animations
and animations on descendants SHALL be ignored, unless descendants are opted in.
When there is nothing to wait for, `getAnimations` is unavailable, or the document
is hidden, the part SHALL become absent without waiting.

#### Scenario: CSS transition

- **WHEN** content has `transition: opacity 200ms` and `[data-state=closed]` sets
  opacity 0
- **THEN** the content unmounts after the transition ends

#### Scenario: Animation already finished before observation

- **WHEN** an exit animation ends before the system starts observing it (WebKit
  fires `animationend` early)
- **THEN** the content still unmounts (regression: zag#3349)

#### Scenario: Spinner inside the dialog

- **WHEN** a dialog containing an infinitely spinning loader closes with no exit
  animation of its own
- **THEN** the dialog unmounts immediately

#### Scenario: jsdom

- **WHEN** a dialog closes in jsdom with `@rind-ui/testing/setup`
- **THEN** it unmounts in the same task, without polyfilled timing

### Requirement: Closed Means Closed Immediately

Closing SHALL NOT wait for presence: the layer is released, focus is restored,
outside hiding and scroll lock are removed, and the trigger's state reflects
"closed" at the moment of closing. Presence only keeps the DOM node around, with
`data-state="closed"` as the exit-animation hook. Entry animations SHALL rely on CSS
(`@starting-style`); presence SHALL NOT add a "starting" attribute.

#### Scenario: Page usable during exit

- **WHEN** a modal dialog closes with a 500 ms exit animation
- **THEN** during the animation the page is not inert, not scroll-locked, and the
  trigger has focus (regression: radix#3645)

### Requirement: Re-Opening During Exit

Opening a part that is exiting SHALL cancel the pending unmount and keep the same
DOM node, so focus, scroll position and form state inside it are preserved.

#### Scenario: Toggle quickly

- **WHEN** a dialog is closed and re-opened before its exit animation finishes
- **THEN** the same content element is reused and ends up `present`

### Requirement: No Flash On Unmount

Adapters SHALL commit the unmount synchronously when the exit wait resolves, so the
browser never paints a frame of the element's resting (non-animated) style between
the end of the animation and its removal.

#### Scenario: Final frame

- **WHEN** an exit animation that ends at opacity 0 finishes
- **THEN** no frame is painted with the content at its resting opacity before it is
  removed (regression: mui/base-ui#979)

### Requirement: Escape Hatches For JavaScript Animation

A part SHALL be able to stay mounted while closed (`keepMounted`), in which case it
is hidden for assistive technology (`hidden` or `inert`) and holds no layer, and the
consumer SHALL be notified when exit completes (`onExitComplete`), so animation
libraries that control unmounting themselves can be used.

#### Scenario: Keep mounted

- **WHEN** a closed dialog's content is kept mounted
- **THEN** it is `hidden` (or `inert` when the consumer animates it), registers no
  layer and locks nothing (regression: radix#1061, radix#3100)

