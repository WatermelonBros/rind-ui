# tour Specification

## Purpose
Defines the Tour component: an ordered list of steps, each a card that points at a real
element (dimming the rest of the page and cutting a spotlight around the element) or sits
centred as a plain dialog, with progress, next / back / skip / close actions, keyboard
navigation, asynchronous and wait-for-element steps, scrolling the target into view, step
effects, per-step modality and a test contract, built on the overlay infrastructure and
floating positioning.
## Requirements
### Requirement: Anatomy

A tour SHALL consist of the parts `Root` (no element), `Trigger` (optional, default
`button`), `Backdrop` (optional, default `div`), `Spotlight` (optional, default `div`),
`Positioner` (default `div`), `Content` (default `div`), `Arrow` (optional, default `div`),
`Title` (optional, default `h2`), `Description` (optional, default `p`), `ProgressText`
(optional, default `span`), `Actions` (no element: it calls its children with the current
step's actions), `ActionTrigger` (default `button`) and `CloseTrigger` (optional, default
`button`), and MAY render `Backdrop`, `Spotlight` and `Positioner` with their descendants
inside the shared `Portal` part. Every rendered part SHALL carry `data-scope="tour"`,
`data-part` with its kebab-case part name and the instance's `data-instance`, whether
portalled or not, so two tours on one page never read each other's parts. `useTour(props)`
SHALL return the tour API and `Root` SHALL accept either that API (`tour`) or the props
directly. Every button part SHALL render `type="button"`. Each part SHALL accept element
substitution without changing behaviour.

#### Scenario: Two tours coexist

- **WHEN** two tours are rendered, the first open and the second idle
- **THEN** the second tour's parts read none of the first's state, and the first's backdrop
  geometry is computed from the first's card and target only (Reado renders an app tour and
  a project tour side by side)

#### Scenario: Buttons never submit a form

- **WHEN** the tour is rendered inside a `form` and the close trigger, an action trigger
  and the trigger are pressed
- **THEN** the form is not submitted (regression: zag#3268)

#### Scenario: Hook and Root

- **WHEN** a component calls `const tour = useTour({ steps })`, renders `<Tour.Root
  tour={tour}>` and calls `tour.start()` from an effect outside the Root
- **THEN** the tour opens at its first step

### Requirement: Steps

The tour SHALL take `steps`, an array of step definitions. A step SHALL have a unique `id`
and MAY have `title`, `description` (framework content), `target` (a function returning an
element or `null`), `type` (`"tooltip"`, `"dialog"` or `"wait"`), `side`, `align`,
`sideOffset`, `alignOffset`, `sticky`, `backdrop` (default `true`), `arrow` (default `true`
for an anchored step), `modal`, `scroll`, `timeout`, `missingTarget`,
`preventTargetInteraction`, `actions` and `effect`. A step without `type` SHALL be
`"tooltip"` when it has a `target` and `"dialog"` otherwise; `"dialog"` steps are centred
and ignore `target`, `side`, `align` and the offsets. Duplicate ids SHALL be a thrown
configuration error naming the id. Replacing `steps` while the tour runs SHALL replace the
definitions without restarting the current step's preparation or effect, and a step
whose id is no longer present SHALL end the tour with reason `"steps-changed"`. `addStep`,
`removeStep`, `updateStep` and `setSteps` SHALL be available on the API.

#### Scenario: Type inferred from the target

- **WHEN** one step has a `target` and another has none and no `type`
- **THEN** the first is an anchored step and the second a centred dialog step

#### Scenario: Duplicate ids

- **WHEN** two steps share the id `"intro"`
- **THEN** creating the tour throws an error that contains `"intro"`

#### Scenario: Re-created steps array

- **WHEN** the consumer passes a new `steps` array with the same ids on every render
  (Reado memoises on its translator, which changes on language switch) while a step with an
  `effect` is shown
- **THEN** the effect is not run again, its cleanup is not called and the card does not
  move

#### Scenario: Current step removed

- **WHEN** the step being shown is missing from a new `steps` array
- **THEN** the tour closes with `reason: "steps-changed"` and all marks and listeners are
  released

### Requirement: Open State And Reasons

The open state SHALL be a controllable value: `open`, `defaultOpen` (default `false`) and
`onOpenChange(open, details)`, where `details.reason` is `"api"` when opened by `start()` or
`open`, and one of `"complete"`, `"skip"`, `"dismiss"`, `"escape-key"`, `"outside-press"`,
`"outside-focus"`, `"target-missing"`, `"steps-changed"` or `"api"` when closing, and
`details.stepId`, `details.stepIndex` and `details.complete` (`true` only for reason
`"complete"`) describe the step the tour ended on. In controlled mode a request SHALL only
call `onOpenChange`; the tour changes state when `open` changes. `details.cancel()` SHALL keep
the current state. `start()` SHALL open the tour at its first step, or at `{ stepId }`
when given; calling it while open SHALL go to that step. `stop()` SHALL close with reason
`"api"`. A tour that ends SHALL release every effect, mark, listener, inert and lock.

#### Scenario: Start at the first step

- **WHEN** a tour that was stopped at its third step has `start()` called without an id
- **THEN** the first step is shown (zag resumed "wherever it last was", which Reado works
  around by always passing the first id)

#### Scenario: Start at a given step

- **WHEN** `start({ stepId: "source" })` is called on an idle tour
- **THEN** the step `"source"` is shown first and `onStepChange` reports its index
  (regression: zag#2462)

#### Scenario: Controlled refusal

- **WHEN** a controlled tour with `open={false}` has `start()` called and the parent does
  not change `open`
- **THEN** `onOpenChange(true, …)` was called and nothing is rendered

#### Scenario: Completing

- **WHEN** the user presses Next on the last step
- **THEN** `onOpenChange(false, { reason: "complete", complete: true, stepId: <last id> })`
  is called once

### Requirement: Current Step

The current step SHALL be a controllable value: `stepId` (`string | null`), `defaultStepId`
and `onStepChange(stepId, details)`, where `details` has `stepIndex`, `totalSteps`,
`progress` (0–1, counting only steps that are not `"wait"`), `direction` (`"forward"`,
`"backward"` or `"jump"`) and `reason`. `next()`, `prev()` and `goto(id)` SHALL be on the
API; `goto` with an unknown id SHALL log a development error and do nothing. Back SHALL skip
`"wait"` steps (they exist to gate forward progress, so going back to one would re-run its
effect). Next on the last step SHALL complete the tour. Back on the first step SHALL do
nothing. While the tour is preparing a step (see "Preparing A Step"), `next()`, `prev()` and
the arrow keys SHALL be ignored; `goto`, close and skip SHALL still work.

#### Scenario: Controlled step

- **WHEN** a controlled tour has `stepId="a"` and Next is pressed
- **THEN** `onStepChange("b", …)` is called and the shown step stays `"a"` until the parent
  passes `"b"`

#### Scenario: Back over a wait step

- **WHEN** the steps are `intro`, `wait-for-input`, `result` and the user is on `result`
  and presses Back
- **THEN** `intro` is shown

#### Scenario: Double press on Next

- **WHEN** the user presses Next twice quickly and the next step has an asynchronous
  effect
- **THEN** exactly one step is advanced and the effect of the step after it never runs
  (regression: shepherd#968, react-joyride#1083)

#### Scenario: Back at the first step

- **WHEN** Back is pressed on the first step
- **THEN** nothing changes and focus stays on the Back control

### Requirement: Preparing A Step

When a step is entered the tour SHALL be in the `preparing` phase until the step is ready:
its target (if any) resolves to an element that is rendered (connected, not `display:
none`, not `visibility: hidden` through `checkVisibility()`, and with a non-empty box),
and its `effect` (if any) has called `show()`, has settled, or has navigated. If the target
or the effect is not ready within the step's `timeout` (default the tour's `prepareTimeout`,
5000 ms, measured by the injected scheduler) the step's missing-target policy SHALL apply:
`"skip"` (default) moves to the next step in the direction of travel — completing the tour
when none remains forward, closing it with reason `"target-missing"` when none remains
backward —, `"stop"` closes with reason `"target-missing"`, and `"center"` shows the step as
a centred dialog step with `data-target-missing`. `onMissingTarget({ stepId, policy })` SHALL
be called in each case. A target that is not there yet SHALL be waited for with a
`MutationObserver` on the document or shadow root, so it is picked up as soon as it
appears; a step that has no `target` SHALL never be waited for. During `preparing` the
step's card, arrow and spotlight SHALL be hidden, the backdrop SHALL stay mounted at its
last geometry (no flash), and the tour SHALL announce nothing. A step whose target and
effect are ready at once SHALL be shown within the same event, with no `preparing` render.

#### Scenario: Target appears late

- **WHEN** a step's target is inserted into the page 800 ms after the step was entered
- **THEN** the step is shown at once at that moment, not at the end of the timeout

#### Scenario: Target never appears

- **WHEN** a step's target never appears and the policy is the default `"skip"` on a
  middle step
- **THEN** after the timeout the next step is shown and `onMissingTarget` was called with
  policy `"skip"` (regression: react-joyride#585, where a missing first target hung the
  whole tour)

#### Scenario: Last step is missing

- **WHEN** the last step's target never appears and the user presses Next on the step
  before it
- **THEN** the tour completes with reason `"complete"` after the timeout instead of showing
  a step that says "Next" with nowhere to go (regression: driver.js#616)

#### Scenario: Hidden target

- **WHEN** a step's target exists but is inside a collapsed `display: none` region
- **THEN** it is treated as not ready and waited for like a missing one

#### Scenario: Centre policy

- **WHEN** the policy is `"center"` and the target is missing
- **THEN** the step is shown centred as a dialog step with `data-target-missing` on the
  content and without a spotlight

#### Scenario: No flicker between steps

- **WHEN** the user goes from one step to a step whose effect takes 300 ms
- **THEN** the backdrop element is the same node throughout, never unmounted, and is never
  undimmed (regression: react-joyride#914, #1091)

### Requirement: Step Effects

A step's `effect(args)` SHALL run when the step is entered, before it is shown, with
`args` containing `show()`, `update(patch)`, `next()`, `goto(id)`, `dismiss()`, `signal`
(an `AbortSignal` aborted when the step is left), `target` and the helpers
`waitForElement(resolver, options)` and `waitForEvent(target, type, options)`, both of which
honour `signal` and never hang on an absent element. The effect MAY be asynchronous and MAY
return a cleanup function or a promise of one. The step SHALL be shown when the effect calls
`show()`, or — for steps that are not `"wait"` — when it returns or its promise settles
without having called `show()`, `next()`, `goto()` or `dismiss()`. `update(patch)` SHALL
replace fields of the step (title, description, side, align, actions…) and SHALL apply to a
step that is already shown. The cleanup SHALL run exactly once when the step is left by any
path: next, back, goto, skip, close, Escape, completion, `stop()`, unmount, a new `steps`
array that removes it, and a call to `dismiss()` from inside the effect. A cleanup returned
after the step was already left SHALL run immediately. An effect that throws SHALL be
logged, SHALL apply the missing-target policy, and SHALL NOT break the tour.

#### Scenario: Dismissing from inside the effect

- **WHEN** a step effect calls `dismiss()` after registering a cleanup
- **THEN** the cleanup runs once and the tour reports its reason (regression: zag 1.43.0
  "dismissing from a step effect skipped cleanup")

#### Scenario: Async effect

- **WHEN** an effect awaits a 300 ms promise, calls `update({ description })` and then
  `show()`
- **THEN** the card appears once, already with the updated description

#### Scenario: Left before the effect finished

- **WHEN** the user closes the tour while an effect is awaiting and the effect later
  returns a cleanup
- **THEN** `signal` was aborted at close, the cleanup runs as soon as it is returned, and
  `show()` after that is ignored (Reado's project tour guards this with a `live` flag)

#### Scenario: Plain effect

- **WHEN** an effect that opens a menu returns without calling `show()`
- **THEN** the step is shown anyway

#### Scenario: Click inside an effect

- **WHEN** an effect clicks an element elsewhere on the page while the tour is open
- **THEN** the tour does not close (regression: shepherd#2351)

### Requirement: Wait Steps

A step of type `"wait"` SHALL show no card and no spotlight; the tour SHALL be in the
`waiting` phase while it is current, with the backdrop dimmed at its last geometry when
`backdrop` is true. Its effect SHALL be what advances the tour, through `next()`, `goto()` or
`dismiss()`. Wait steps SHALL NOT count in `totalSteps` for progress text or `progress`.
Escape and `stop()` SHALL still close the tour while it waits. Docs and examples SHALL
advance on an explicit completion (a Next that becomes enabled, or a committed field), not
on the first valid keystroke.

#### Scenario: Waiting for a click

- **WHEN** a wait step's effect awaits `waitForEvent(target, "click")` and then calls
  `next()`
- **THEN** no card is rendered until the click, and the next step is shown after it

#### Scenario: Progress ignores wait steps

- **WHEN** a tour has four steps, one of them a wait step, and the last step is shown
- **THEN** the progress text reads "3 of 3"

#### Scenario: Escape while waiting

- **WHEN** Escape is pressed during a wait step
- **THEN** the tour closes with `"escape-key"` and the effect's cleanup runs

### Requirement: Target Replaced Or Lost

The target getter SHALL be re-evaluated on every positioning pass and whenever the
document mutates. When it returns a different element, the card, spotlight and backdrop
SHALL follow it and `data-rind-tour-target` SHALL move to it. When it returns `null`
or an element that is no longer rendered while the step is shown, the tour SHALL go back
to `preparing` for the same step and apply the missing-target policy after the timeout. No
part SHALL ever be painted at the viewport origin because a target was lost.

#### Scenario: Target re-rendered

- **WHEN** a framework replaces the target element with a new one with the same selector
  while its step is shown
- **THEN** the card and spotlight move to the new element and nothing is painted at the
  top-left corner (regression: shepherd#580, zag PR #3341)

#### Scenario: Target removed

- **WHEN** the target is removed and not re-added
- **THEN** after the timeout the policy applies, and during the wait the card and
  spotlight are hidden

### Requirement: Scrolling Into View

When an anchored step becomes ready the tour SHALL scroll its target into view with
`scrollIntoView` using the step's `scroll` option (default `{ block: "nearest", inline:
"nearest" }`; `false` disables it; `behavior` defaults to `"auto"` and is `"instant"` under
reduced motion), so the author's CSS `scroll-margin` and `scroll-padding` for sticky
headers apply. The tour SHALL NOT wait a fixed time for scrolling to end: the card and
spotlight SHALL follow the target while it scrolls, through positioning's tracking. Nested
scroll containers of the target SHALL be scrolled by the same call. Scrolling SHALL never
move focus.

#### Scenario: Sticky header

- **WHEN** the page has `html { scroll-padding-top: 80px }` and a step's target is below
  the fold
- **THEN** after scrolling the target's top is at least 80 px from the viewport top
  (regression: driver.js#580, react-joyride#938)

#### Scenario: Card follows a smooth scroll

- **WHEN** the target scrolls smoothly into view
- **THEN** the card and the spotlight stay attached to it in every frame, never placed
  against the pre-scroll position and left there (regression: zag changelog 1.33.0, "janky
  scroll behavior when navigating between tour steps")

#### Scenario: Reduced motion

- **WHEN** the user prefers reduced motion
- **THEN** the scroll is instant

#### Scenario: Scrolling keeps focus

- **WHEN** focus is on the card's Next button and the page scrolls or the window is resized
- **THEN** focus is still on the Next button (regression: shepherd#1368)

#### Scenario: Scroll disabled for one step

- **WHEN** a step has `scroll: false`
- **THEN** the page does not scroll for that step

### Requirement: Spotlight And Backdrop

For an anchored step with `backdrop: true`, `Backdrop` SHALL dim the viewport and cut out
the target's rectangle, padded by `spotlight.padding` (default 8 px, a number or `{ x, y }`)
and rounded by `spotlight.radius` (default 8 px, clamped to half the cutout's shorter side),
clipped to the viewport. With `spotlight.content` the content's rectangle (padded by its own
`padding`, default 6, and `radius`, default 12) SHALL also be cut out. Cutouts that overlap
each other SHALL be merged into one, never cancel each other out. A centred step SHALL dim
the whole viewport with no cutout. The geometry SHALL be recomputed from the same tracking as
the card (scroll of any ancestor, resize, visual viewport changes, size changes and layout
shifts), in the frame in which the card moves, and never from a polling loop that runs for the
whole time the tour is open. The backdrop and spotlight SHALL NOT be painted before the card's
first placement of the step, and SHALL never use geometry from a previous step: a
centred step after an anchored one has no cutout, also after scrolling. The backdrop
SHALL never prevent scrolling or touch panning of the page or of the target, and SHALL be
`aria-hidden`. `Spotlight` SHALL be an element positioned over the padded target rectangle
(`--rind-tour-spotlight-x`, `-y`, `-width`, `-height` in px), hidden when there is no
target, `pointer-events: none` unless the target interaction shield is on, and SHALL
animate between steps only (never on resize, scroll or content load). Stacking SHALL follow
the layer metadata: backdrop below spotlight below positioner, with `--layer-index` on each.

#### Scenario: Cutout around the target

- **WHEN** an anchored step's target is a 100 × 40 box at (200, 300) and the defaults apply
- **THEN** the backdrop's clip path leaves a rounded rectangle at (192, 292) of size
  116 × 56 un-dimmed and dims everything else

#### Scenario: Card inside the target

- **WHEN** `spotlight.content` is on and the card is placed over the target (the editor
  comment step in Reado)
- **THEN** there is one merged hole, and the card is not re-dimmed by two overlapping
  even-odd holes cancelling

#### Scenario: Target larger than the viewport

- **WHEN** the target is taller and wider than the viewport
- **THEN** the cutout is clamped to the viewport and the page is not entirely dimmed or
  entirely cut out by a negative size

#### Scenario: Tiny target and radius

- **WHEN** the target is 6 × 6 px, `spotlight.padding` is 0 and the radius is 8
- **THEN** the cutout's corner radius is 3 and the clip path is valid (Reado unit-tests the
  same clamp in `roundedRect`)

#### Scenario: Centred step after an anchored one

- **WHEN** an anchored step is followed by a centred step and the page then scrolls
- **THEN** the backdrop shows no opening at any time (regression: shepherd#444)

#### Scenario: Window resize

- **WHEN** the window is resized while a step is shown
- **THEN** the dimmed area covers the whole new viewport in the next frame, and the spotlight
  jumps without animating (regression: zag PR #3340)

#### Scenario: No polling loop

- **WHEN** a step is shown and nothing moves for 5 s
- **THEN** no animation-frame callback or timer of the tour ran after the last placement

#### Scenario: Target moves without a resize

- **WHEN** the target's position changes because a sidebar collapsed
- **THEN** card, spotlight and cutout move with it (regression: react-joyride#1158, #1137)

#### Scenario: Stacking

- **WHEN** a step is shown
- **THEN** the backdrop's `--layer-index` is lower than the spotlight's, which is lower
  than the positioner's (regression: ark#4162)

### Requirement: Target Interaction

By default the target SHALL stay fully usable while its step is shown: pointer, keyboard,
focus and typing, including inside a highlighted form field. With `preventTargetInteraction`
(tour or step) the `Spotlight` SHALL cover the target's rectangle with a transparent
element that receives pointer events (`data-shield`), so a pointer press does nothing to the
target; the target SHALL remain in the accessibility tree and focusable by keyboard, and
SHALL NOT receive `inert`. While a step is shown its target SHALL carry
`data-rind-tour-target`, removed exactly when the step ends or the target changes.

#### Scenario: Typing in the highlighted field

- **WHEN** the target contains a text input and the user clicks it and types
- **THEN** the input receives the text and the tour stays open (regression: zag#2901)

#### Scenario: Shield

- **WHEN** `preventTargetInteraction` is set and the user clicks the target
- **THEN** the target's click handler is not called and the tour stays on its step

#### Scenario: Target not inert

- **WHEN** a shielded step is shown
- **THEN** the target has no `inert` attribute and is still found by role and name

#### Scenario: Mark is removed

- **WHEN** the tour moves to the next step
- **THEN** the previous target has no `data-rind-tour-target` and the new one has it

### Requirement: Positioning

An anchored step's `Positioner` SHALL be positioned through the positioning capability with
the target's padded spotlight rectangle as a virtual anchor (so the card clears the cutout),
`side` default `"bottom"`, `align` default `"center"`, `sideOffset` default 12, collision
avoidance `flip` and `shift` on both axes with collision padding 8, tracking `auto` (or
`frame` when the step asks), and `sticky` per step. A card that does not fit beside its
target SHALL shift into the viewport, and with `sticky` SHALL be allowed to cover the target
instead of leaving the viewport. A centred step's positioner SHALL be centred in the viewport
(logical centre, on a `fixed` positioner, not the previous step's coordinates). The first
placement of every step SHALL follow the first-frame rules of floating positioning: no
paint at a stale or origin position. `Arrow` SHALL render only for an anchored step with
`arrow` true and SHALL be hidden when the card covers the target. The positioner SHALL carry
`data-side`, `data-align` and the `--rind-*` positioning variables of the positioning
capability. Padding SHALL NOT change the target. `reposition()` on the API SHALL run a pass
at once, for targets that move without any observable event.

#### Scenario: Card does not fit beside the target

- **WHEN** the target fills the viewport and the step asks for `side: "left"`, `align:
  "start"`, `sticky: true`
- **THEN** the card is fully inside the viewport, over the target, with no negative offset
  (Reado pulls the card back with `offset.mainAxis = -360`)

#### Scenario: Card keeps its side while the page scrolls

- **WHEN** the target scrolls so that its preferred side no longer fits
- **THEN** the card flips once and `data-side` reports the new side

#### Scenario: Centred step after an anchored step

- **WHEN** the previous step was anchored on the right of the page and the next step is a
  dialog step
- **THEN** the card is centred in the viewport (regression: zag#3046, changelog 1.38.1)

#### Scenario: Manual reposition

- **WHEN** the target is a box drawn over an editor that moves without any DOM mutation
  or resize, and the app calls `reposition()`
- **THEN** the card, spotlight and cutout move to its new rectangle in the next frame
  (Reado dispatches `reado:tour-layout` for this)

#### Scenario: No garbage frame

- **WHEN** a step's first placement has not happened yet
- **THEN** the positioner has opacity 0 and no pointer events, and the card is never painted
  at the top-left corner (Reado's "garbage rect for a frame")

### Requirement: Modality

A step SHALL be modal when `modal` (step, then tour) is true, and by default when it is a
centred dialog step; an anchored step SHALL be non-modal by default. A modal step SHALL make
everything outside its layer inert (through outside-inert), lock page scrolling and wrap Tab
inside the card; its target, when it has one, SHALL be part of the layer so it stays
operable and exposed. A non-modal step SHALL make nothing inert, SHALL NOT lock scrolling and
SHALL leave the page operable. Modality SHALL be re-evaluated on every step, so a tour may
alternate. `aria-modal="true"` SHALL be on the content only while the step is modal.

#### Scenario: Welcome step is modal

- **WHEN** the first step is a centred dialog step
- **THEN** the application root is `inert`, the page does not scroll, Tab wraps inside the
  card and `aria-modal="true"` is on the content

#### Scenario: Anchored step is not modal

- **WHEN** the second step is anchored
- **THEN** `inert` is gone from the application root, the page scrolls and the content has
  no `aria-modal`

#### Scenario: Modal anchored step keeps its target

- **WHEN** an anchored step has `modal: true`
- **THEN** everything except the card, the target and their ancestors' path is inert, and
  the target can be clicked and focused

#### Scenario: Focus does not hop between steps

- **WHEN** the tour moves from a modal step to a non-modal one
- **THEN** focus does not return to the element that opened the tour in between

### Requirement: Dismissal

The tour SHALL register one layer of kind `tour` per shown step, with the content, positioner
and target as its elements and the trigger as its opener. Escape SHALL close the tour, only
when it is the topmost layer, unless `closeOnEscape` is `false`. An outside press SHALL NOT
close the tour by default; with `closeOnOutsidePress` it SHALL, except for presses on the
target. Moving focus outside SHALL NOT close the tour by default; with `closeOnOutsideFocus`
it SHALL. Each request SHALL be reported through `onOpenChange` with its reason and be
vetoable with `cancel()`. A layer opened from the target (a dialog, a menu) SHALL be above
the tour: Escape and outside presses go to it first and the tour keeps its step.

#### Scenario: Stray click

- **WHEN** the user clicks the page outside the card and target with default props
- **THEN** the tour stays open (Zag's default `closeOnInteractOutside: true` ended
  onboardings on a stray click)

#### Scenario: Outside press when enabled

- **WHEN** `closeOnOutsidePress` is set and the user presses the page outside the card and
  target
- **THEN** the tour closes with `"outside-press"`; pressing the target does not close it

#### Scenario: Escape closes only the topmost layer

- **WHEN** the target opens a dialog from inside the tour and Escape is pressed
- **THEN** the dialog closes and the tour stays on its step; a second Escape closes the tour

#### Scenario: Escape disabled

- **WHEN** `closeOnEscape` is `false` and Escape is pressed
- **THEN** nothing happens (regression: intro.js#779, driver.js#109 for independent flags)

#### Scenario: Veto

- **WHEN** `onOpenChange` calls `details.cancel()` on an `"escape-key"` request
- **THEN** the tour stays open and on its step

### Requirement: Initial Focus And Step-Change Focus

When the tour starts, once the first step is shown and placed, focus SHALL move to the
`Content` element (made focusable with `tabindex="-1"`), so its name and description are
read, unless the consumer's `initialFocus` returns another target, `null` (default) or `false`
(do not move). On a later step change focus SHALL: stay on the control that has it when
that control still exists; move to the `Content` when the focused control was removed by the
step change or focus is on `body`; and stay where it is when it is outside the tour (a
highlighted field the user is typing in, or any element on the page). Positioning, scrolling
and resizing SHALL never move focus. Opened by touch, the first focus SHALL still go to the
`Content`.

#### Scenario: Start

- **WHEN** a tour starts from a button
- **THEN** after the first placement the content is focused and its accessible name is the
  title

#### Scenario: Last step swaps the button

- **WHEN** focus is on "Next" and the next step renders "Done" in its place
- **THEN** focus moves to the content, not to `body`

#### Scenario: User is typing in the target

- **WHEN** the tour advances while focus is in an input inside the target
- **THEN** focus stays in the input (regression: shepherd#2117, #3505, driver.js#368)

#### Scenario: Consumer chooses the primary action

- **WHEN** `initialFocus` returns the Next button
- **THEN** the Next button is focused on start

### Requirement: Focus Restore

When the tour ends, focus SHALL return to the element that had it when the tour started (or
the `Trigger`), unless the consumer's `finalFocus(reason)` returns another target or `false`,
or the user has moved focus outside the tour's layer and body since. Restoration SHALL run
after inert and scroll lock were released.

#### Scenario: Close returns focus

- **WHEN** a tour started from a "Take the tour" button is closed with its close trigger
- **THEN** that button has focus (regression: shepherd#473)

#### Scenario: User moved on

- **WHEN** the user clicked into the page's search field during a non-modal step and then
  presses Escape there
- **THEN** focus stays in the search field

#### Scenario: Escape on a modal step

- **WHEN** the tour ends from a modal first step by Escape
- **THEN** focus returns to the opener although it was inert while the step was open

### Requirement: Keyboard Interactions

Escape closes the tour as specified in Dismissal. Tab and Shift+Tab SHALL work as follows:
in a modal step they wrap inside the card (and its target); in a non-modal step the card
follows its target in the sequential order (through the non-modal tab order capability with
the target as the trigger), so Tab from the target enters the card and Tab from the card's
last control continues with the first tabbable element after the target, and Shift+Tab
from the card's first control or from the card itself returns to the target. With
`keyboardNavigation` (default `true`) ArrowRight SHALL act as Next and ArrowLeft as Back when
the event's target is inside `Content`, with the directions swapped in a right-to-left
tour; the keys SHALL be ignored when `defaultPrevented`, with a modifier key, while composing,
when the target is an editable element, `select` or `input` of a type that uses arrows, and
at the ends of the tour (they never complete or close it). Enter and Space on a focused
action trigger or close trigger SHALL activate it natively.

#### Scenario: Tab from the target

- **WHEN** a non-modal anchored step is shown, focus is on a button inside the target and
  the card is portalled to the end of `body`
- **THEN** Tab moves focus to the card's first control, and Tab from its last control
  moves to the first tabbable after the target (regression: shepherd#3202)

#### Scenario: Shift+Tab right after the start

- **WHEN** the card was just focused on the first step and Shift+Tab is pressed
- **THEN** focus goes to the target (non-modal) or wraps to the last control (modal), never
  to the end of the page (regression: shepherd#1076)

#### Scenario: Arrow keys in a text field

- **WHEN** a step's description contains a text input, focus is in it and ArrowRight is
  pressed
- **THEN** the caret moves and the step does not change

#### Scenario: RTL

- **WHEN** the tour is in a right-to-left context and ArrowLeft is pressed on a middle step
- **THEN** the next step is shown (regression: intro.js#2035)

#### Scenario: Arrow on the last step

- **WHEN** ArrowRight is pressed on the last step
- **THEN** nothing happens and no error is thrown (regression: intro.js#849)

#### Scenario: Keyboard navigation off

- **WHEN** `keyboardNavigation` is `false` and ArrowRight is pressed
- **THEN** the step does not change

### Requirement: Roles And ARIA Attributes

`Content` SHALL have `role="dialog"`, `tabindex="-1"`, `aria-labelledby` the title (or an
`aria-label` fallback, see Accessible Name), `aria-describedby` the description when
rendered, and `aria-modal="true"` only for a modal step. It SHALL NOT be an `alertdialog`
and SHALL NOT be a live region. `Backdrop`, `Spotlight` and `Arrow` SHALL be `aria-hidden`.
`Trigger` SHALL have `aria-haspopup="dialog"`, `aria-expanded` and, while the content is
mounted, `aria-controls`. `ActionTrigger` and `CloseTrigger` SHALL be native buttons.

#### Scenario: Roles

- **WHEN** an anchored non-modal step is shown
- **THEN** the content has `role="dialog"`, no `aria-modal`, no `aria-live`, and the
  backdrop and spotlight are `aria-hidden`

#### Scenario: Axe

- **WHEN** axe runs on each contract state
- **THEN** it reports no violation, in particular no `aria-dialog-name` (regression:
  shepherd#2390)

### Requirement: Accessible Name And Description

The `Content` SHALL be named by the `Title` part when it is rendered, else by the consumer's
`aria-label` / `aria-labelledby`, else by `messages.stepLabel({ current, total })`
("Step 3 of 12"). `Title` SHALL render `h{level}` (`level` default 2) with heading
attributes from add-heading's shared helper, and `Content` SHALL wrap its children in a
`Heading.Level` at the title's level + 1. `Description` SHALL describe the content and SHALL
accept any framework content, not only strings. The title and description SHALL be the
current step's, updated by `update()` without remounting the card.

#### Scenario: Untitled step

- **WHEN** a step renders no `Title`
- **THEN** the dialog's accessible name is "Step 2 of 5"

#### Scenario: Title level

- **WHEN** a title has no `level`
- **THEN** it is an `h2` with `data-level="2"`, and a `Heading` inside the content is an `h3`

#### Scenario: Rich description

- **WHEN** a step's description is a React element containing a list
- **THEN** the content's accessible description is the text of that element

### Requirement: Announcements

When a step becomes shown while focus is not moved by the tour (focus stays on a control
inside the card, or outside the tour), the tour SHALL announce
`messages.stepAnnouncement({ current, total, title })` once, politely, through the injected
announcer. When the tour moves focus to the content, nothing SHALL be announced (the
dialog's name and description are read through the focus move). Wait steps and
`preparing` SHALL announce nothing. The announcement SHALL be declared in the contract so
drivers can assert it.

#### Scenario: Focus stays on Next

- **WHEN** focus is on "Next" and the next step keeps a "Next" control
- **THEN** the announcement log has one entry "Step 3 of 5: <title>"

#### Scenario: Focus moved to the content

- **WHEN** the tour starts and focuses the content
- **THEN** the announcement log is empty

#### Scenario: Typing in the target

- **WHEN** the tour advances by itself while focus is in the target's input
- **THEN** one polite announcement is made and focus stays in the input

### Requirement: Actions

`Actions` SHALL call its children with the current step's `actions`, each `{ label, action,
attrs? }` where `action` is `"next"`, `"prev"`, `"dismiss"`, `"skip"` or a function receiving
`{ next, prev, dismiss, skip, goto }`. `ActionTrigger` SHALL run its action on press and
SHALL be named by its visible content; only when it has none SHALL its name come from
`messages` (`next`, `prev`, `finish` for `"next"` on the last step, `skip`, `close`).
`"next"` on the last step SHALL complete the tour; `"dismiss"` on the last step SHALL end it
with reason `"complete"` and on any other step with `"dismiss"`; `"skip"` SHALL end it with
`"skip"`; `CloseTrigger` SHALL end it with `"dismiss"` and be named by `messages.close` when
it has no content. A `"prev"` action on the first step SHALL be `aria-disabled="true"` with
`data-disabled` and SHALL do nothing when pressed, but SHALL stay focusable.

#### Scenario: Visible label wins

- **WHEN** an action trigger with `action: "dismiss"` renders the text "Got it"
- **THEN** its accessible name is "Got it" (regression: zag changelog 1.46.0 / PR #3355,
  react-joyride#1074)

#### Scenario: Icon-only close

- **WHEN** a close trigger contains only an SVG and the consumer passes `messages={{ close:
  "Chiudi" }}`
- **THEN** its accessible name is "Chiudi"

#### Scenario: Skip action

- **WHEN** an action with `action: "skip"` is pressed
- **THEN** the tour ends with reason `"skip"` (regression: zag#3222)

#### Scenario: Custom action

- **WHEN** an action's function calls `goto("settings")`
- **THEN** that step is shown

#### Scenario: Disabled Back keeps focus

- **WHEN** the first step is shown and Back has focus
- **THEN** it still has focus and does not blur (regression: intro.js#2073)

### Requirement: Progress

`ProgressText` SHALL render `messages.progressText({ current, total })` with `current`
**1-based** and `total` counting steps that are not `"wait"`, and the content SHALL expose
`--rind-tour-progress` (0–1) and `data-first` / `data-last`. The default text SHALL be
"{current} of {total}".

#### Scenario: Third of twelve

- **WHEN** the third of twelve steps is shown
- **THEN** the progress text is "3 of 12" and `--rind-tour-progress` is `0.25`

#### Scenario: Translated

- **WHEN** the consumer overrides `progressText` to `({ current, total }) => \`${current}/${total}\``
- **THEN** the text is "3/12" without adding one to `current` (Zag passes a zero-based
  `current`; Reado adds one)

### Requirement: Messages

Every string the tour exposes to assistive technology SHALL come from a typed `messages`
object with English defaults: `next` ("Next"), `prev` ("Back"), `skip` ("Skip tour"),
`close` ("Close tour"), `finish` ("Done"), `progressText`, `stepLabel`,
`stepAnnouncement`. Overrides SHALL be accepted per tour and through the provider.

#### Scenario: Partial override

- **WHEN** a consumer passes `messages={{ next: "Weiter" }}`
- **THEN** an empty `next` action reads "Weiter" and the other strings keep their defaults

### Requirement: Presence And Mounting

`Backdrop` SHALL stay mounted from the start until the tour ends and its exit animation
finishes; `Content`, `Positioner`, `Spotlight` and `Arrow` SHALL be mounted while a step is
shown and unmounted when their exit animations finish, on every close path including
completion, in every adapter. Once closing, the content SHALL be inert. A tour with
`defaultOpen` SHALL render nothing on the server and SHALL start after hydration, when its
targets exist. In React Strict Mode a mount / unmount / mount SHALL start the tour once
and report one first-step `onStepChange`, and the unmounted copy SHALL leave no mark,
listener or layer. Nothing SHALL remain in the document after the tour ends (DOM-clean
invariant).

#### Scenario: Exit animation on the last step

- **WHEN** the last step is completed and the card has a 200 ms exit animation
- **THEN** the card is still in the document with `data-state="closed"` for the animation
  and is removed after it (regression: ark#4049)

#### Scenario: Strict Mode

- **WHEN** a tour with `defaultOpen` is rendered in Strict Mode
- **THEN** one layer, one backdrop and one card exist, `onStepChange` was called once for
  the first step, and unmounting leaves no `data-rind-tour-target`

#### Scenario: Hydration

- **WHEN** a page with a `defaultOpen` tour is server rendered and hydrated
- **THEN** there is no hydration mismatch and the first step is shown after the targets exist

### Requirement: Data Attributes

Every part SHALL carry `data-scope="tour"`, `data-part` and `data-instance`. Additionally:

- `trigger`: `data-state` (`"open"` while the tour runs, else `"closed"`), `data-focus`,
  `data-focus-visible`, `data-pressed`.
- `backdrop`: `data-state`, `data-phase`, `data-step-type`; CSS variables
  `--rind-tour-viewport-width`, `--rind-tour-viewport-height` and `--layer-index`; the
  `clip-path` as an inline style.
- `spotlight`: `data-state`, `data-shield` when the interaction shield is on; the CSS
  variables `--rind-tour-spotlight-x`, `-y`, `-width`, `-height`; `--layer-index`.
- `positioner`: `data-state`, `data-phase`, `data-step-type`, `data-modal`, `data-side`,
  `data-align`, `--layer-index` and the positioning variables.
- `content`: `data-state` (`"closed"` while exiting or not shown), `data-phase`
  (`"preparing"`, `"shown"` or `"waiting"`), `data-step` (the step id), `data-step-type`,
  `data-modal`, `data-first`, `data-last`, `data-target-missing`, `data-close-reason`, `data-focus`,
  `data-focus-visible`, `data-focus-within`; `--rind-tour-progress`.
- `arrow`: `data-side`, `data-align`.
- `action-trigger`: `data-action` (`next`, `prev`, `dismiss`, `skip` or `custom`),
  `data-disabled`, `data-focus`, `data-focus-visible`, `data-pressed`.
- `close-trigger`: `data-focus`, `data-focus-visible`, `data-pressed`.
- The target element: `data-rind-tour-target` while its step is shown.

`title`, `description` and `progress-text` SHALL carry only the scoping attributes.

#### Scenario: Exit animation by reason

- **WHEN** the tour ends by Escape and the card has an exit animation
- **THEN** during the animation the content has `data-state="closed"` and
  `data-close-reason="escape-key"`

#### Scenario: Step styling hooks

- **WHEN** the third step of five is shown
- **THEN** the content has `data-step="<id>"`, neither `data-first` nor `data-last`, and
  `data-phase="shown"`

### Requirement: Tour Contract

The `tour` contract SHALL locate an instance through its trigger (role `button`, name given
by the driver's `name`), because an idle tour has no content. It SHALL declare the traits
`layer`, `restores-focus`, `presence` and `anchored`, plus `modal` when the tour's `modal`
prop is true. It SHALL declare the actions `start`, `next`, `prev`, `skip`, `dismiss`,
`pressEscape`, `pressOutside` (a no-op unless `closeOnOutsidePress`, skipped with that
reason in the default variant), `pressArrow(direction)`, `tab`, `shiftTab`, `waitForStep(id)`
and `waitForUnmount`, each completing when its postcondition holds (for `start`: a step shown
and placed with focus in the card), with pointer, touch, keyboard and virtual
implementations where an element is pressed, and the queries `isOpen`, `stepId`, `stepIndex`,
`totalSteps`, `phase`, `title`, `description`, `progressText`, `isModal`, `hasFocus`,
`isTopmost`, `target`, `spotlightRect`, `closeReason` and `announcements`, plus the
positioning queries. Its states SHALL be `idle`, `preparing`, `active` and `waiting`; its
event map SHALL map `START`, `STEP.NEXT`, `STEP.PREV`, `SKIP`, `DISMISS` and `ESCAPE_KEY` to
those actions and mark prop-only events as skipped with a reason.

#### Scenario: Driver round trip

- **WHEN** a test runs `const t = getTour(screen, { name: "Take the tour" })`, then `await
  t.start()`, `await t.next()`, `await t.pressEscape()`
- **THEN** `start()` resolves once the first step is shown with focus in the card,
  `next()` once the second step is shown, `pressEscape()` once the tour is closed, and
  `await t.closeReason()` is `"escape-key"`

#### Scenario: Same test in Playwright

- **WHEN** the same test runs with `page` instead of `screen`
- **THEN** it passes unchanged

### Requirement: Model-Based Coverage

`testMachine` over the tour contract SHALL cover every transition in every declared
modality, including `virtual`, for `modal` false and true and with a fixture step that has an
asynchronous effect (so `preparing` is reachable), and SHALL pass every generic,
accessibility and overlay invariant. Programmatic events with no contract action (`STEPS.SET`,
`STEP.GOTO`, `TARGET.LOST`, `STEP.MISSING`) SHALL be reported as uncovered and covered by
unit tests of the machine.

#### Scenario: Consumer wrapper drops the title wiring

- **WHEN** `testMachine(tourContract, …)` runs on a wrapper that renders no `Title` and
  passes `aria-labelledby="missing"` on the content
- **THEN** the generic name invariant fails

