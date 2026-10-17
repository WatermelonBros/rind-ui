## Context

See proposal.md for why. The component-level research and its bug history are in
[docs/research/tour.md](../../../docs/research/tour.md); its Decisions section is binding
unless this document says otherwise. Everything below the component is already specified:

| From | Used for |
|---|---|
| `add-foundations` | `setup()/machine()`, controllable values with proposals, `ChangeDetails.cancel()`, state-scoped effects, `reenter`, `contract()`, drivers, `testMachine` |
| `add-a11y-foundations` | press events with `modality` on Trigger / ActionTrigger / CloseTrigger, `focusSafely`, `data-focus*`, `partId()`, `messages`, logical keys, `notComposing` |
| `add-overlay-infrastructure` | `overlayEffect(env, options)` (layer push, dismiss, initial focus, cleanup order release → un-inert → restore), stack-driven inert / scroll lock / Tab wrap for modal layers, `DismissRequest`, presence machine, `Portal`, `LayerProvider`, layer metadata (`--layer-index`), DOM-clean invariant |
| `add-floating-positioning` | `env.position.track()`, `POSITION.PLACED { first }`, virtual anchors, `sticky`, collision `flip`/`shift`, tracking, first-frame rules, `positionerProps` / `arrowProps`, `positioningQueries`, `fakePositioning()` |
| `add-dialog` / `add-heading` | Title Heading Level (`headingProps`, `Heading.Level`), close-trigger naming and DOM-clean conventions |
| `add-popover` (unarchived) | `trackNonModalTabOrder(env, { trigger, content, layer })` — here with the target as the trigger |
| `announcer` | one injected announcer for step-change messages |
| `hidden-content`, `i18n-messages` | `messages` with English defaults, provider overrides |

## Goals / Non-Goals

**Goals:**
- A small flat machine whose preparation, effect and layer behaviour all come from injected
  infrastructure; the component adds only the step flow, target readiness, the spotlight
  geometry, the step-effect lifetime and per-step modality.
- Every Bug-history lesson that became a scenario has a test that reproduces the original
  bug first.
- Cover every behaviour Reado's two tours rely on (table at the end).

**Non-Goals:** the proposal's Non-goals.

## Decisions

### 1. Machine: four flat states, steps are data

```ts
type TourCloseReason =
  | "complete" | "skip" | "dismiss" | "escape-key" | "outside-press" | "outside-focus"
  | "target-missing" | "steps-changed" | "api"

type TourEvent =
  | { type: "START"; stepId?: string; modality: Modality }
  | { type: "STEP.NEXT" } | { type: "STEP.PREV" } | { type: "STEP.GOTO"; id: string }
  | { type: "STEP.READY"; visit: StepVisit }         // from the visit effect or step.show()
  | { type: "STEP.MISSING"; why: "timeout" | "effect-error" | "lost" }
  | { type: "TARGET.LOST" } | { type: "TARGET.CHANGED" }
  | { type: "STEPS.SET"; steps: readonly TourStep[] }
  | { type: "DISMISS"; reason: Exclude<TourCloseReason, "complete" | "skip" | "target-missing" | "steps-changed"> }
  | { type: "SKIP" } | { type: "STOP" }
  | { type: "POSITION.PLACED"; side: Side; align: Align; anchorHidden: boolean; first: boolean; anchorRect: Rect }
  | { type: "POSITION.REPOSITION" } | { type: "PARTS.CHANGED"; title: boolean; description: boolean }

tourMachine = setup({ guards: { hasNext, hasPrev, isWait, isPreparing, targetPolicy… }, … }).machine({
  initial: "idle",
  values: {                                           // controllables
    open:   { idle: false, preparing: true, active: true, waiting: true },
    stepId: "context",                                // the *shown* step; null while idle
  },
  states: {
    idle: { on: { START: { target: "preparing", actions: ["recordStart", "setPending"] } } },
    preparing: {                                       // nothing shown; backdrop stays
      effects: ["visit"],                              // resolve target + run step.effect
      on: {
        "STEP.READY": [{ guard: "isWait", target: "waiting", actions: ["adoptVisit"] },
                       { target: "active", actions: ["adoptVisit", "scrollIntoView"] }],
        "STEP.MISSING": { actions: ["applyMissingPolicy"] },   // → preparing (skip) | idle | active (center)
        "STEP.GOTO": { target: "preparing", reenter: true, actions: ["setPending"] },
        // STEP.NEXT / STEP.PREV: no transition in preparing: ignored (scenario "Double press on Next")
        DISMISS: { target: "idle", actions: ["setCloseReason"] }, SKIP: …, STOP: …,
      },
    },
    active: {
      effects: ["overlay", "trackPosition", "watchTarget", "stepKeys", "announceStep", "recoverFocus"],
      exit: ["releaseVisit"],
      on: {
        "STEP.NEXT": [{ guard: "hasNext", target: "preparing", actions: ["setPendingNext"] },
                      { target: "idle", actions: ["completeTour"] }],
        "STEP.PREV": { guard: "hasPrev", target: "preparing", actions: ["setPendingPrev"] },
        "STEP.GOTO": { target: "preparing", actions: ["setPending"] },
        "POSITION.PLACED": [{ guard: "isFirstPlacement", actions: ["setPlacement", "setAnchorRect", "focusInitial"] },
                            { actions: ["setPlacement", "setAnchorRect"] }],
        "TARGET.LOST": { target: "preparing", actions: ["setPendingSame"] },
        "TARGET.CHANGED": { actions: ["markTarget"] },
        "STEPS.SET": [{ guard: "currentStepGone", target: "idle", actions: ["setCloseReasonStepsChanged"] },
                      { actions: ["replaceSteps"] }],
        DISMISS: …, SKIP: …, STOP: …,
      },
    },
    waiting: {                                         // wait step: no card
      effects: ["overlayEscapeOnly"],
      exit: ["releaseVisit"],
      on: { "STEP.NEXT": …, "STEP.PREV": …, "STEP.GOTO": …, DISMISS: …, SKIP: …, STOP: … },
    },
  },
  onProps: { steps: "STEPS.SET" },
})
```

- `open` is controllable and bound to states; `stepId` is controllable too, written by the
  `adoptVisit` transition action (the step that has become shown). A controlled
  `stepId` is a proposal like any controllable: `onStepChange(next, details)` is called
  when `STEP.NEXT` etc. would change it; the machine stays in `active` on the old step until
  the parent passes the new id (scenario "Controlled step"). The pending step lives in context
  (`pendingId`), not in the controllable.
- `preparing` also covers target loss: `TARGET.LOST` re-enters it for the same step, so the
  missing-target policy, the timeout and the hidden card come for free.
- *Alternative:* Zag's nested machine (`running.resolving/scrolling/active/waiting` plus a
  global router with `STEP.ROUTE` and `STEP.CHANGED`) — rejected: the runtime has no nested
  states (machine-runtime.md §4.6) and the router duplicated transitions for the three
  entries into a step (zag#2462 `start(id)` and the `watch` on `stepId` were the same bug
  class).

### 2. The visit: preparation and the user's effect outlive one state

A step's `effect` must start before the card is shown and its cleanup must run when the
step is left — after `preparing → active`. State-scoped effects would stop it at the first
transition, so the machine uses a **handoff**: `visit` (the `preparing` effect) creates a
`StepVisit` (an `AbortController`, the cleanup slot, the resolved target) and sends
`STEP.READY { visit }`; the transition's `adoptVisit` action stores it in context and the
effect's own cleanup, which would abort the visit when `preparing` is exited, sees
`handedOff === true` and does nothing. `releaseVisit` (exit action of `active` / `waiting`)
aborts `signal`, runs the user's cleanup exactly once (also if it arrives later: a promise
of a cleanup is chained) and removes the target mark. Every exit path — next, back, goto,
skip, dismiss, `stop()`, unmount, `steps-changed` — passes through `active`/`waiting`
exit or `preparing` effect cleanup, so cleanup is exactly-once by construction (the zag 1.43.0
"dismiss from inside the effect" class).

`visit` steps:
1. resolve the target with `isRendered(el)`; if absent, `waitForElement(resolver, { root,
   signal, timeout })` (a `MutationObserver` on the root node — document or shadow root —
   plus a first synchronous attempt; never polling; the timeout is a scheduler delay);
2. call `step.effect(args)` if present; wait for `show()`, a settle (non-wait steps) or a
   navigation call; `update(patch)` sends `STEPS.SET` for that step only (no restart);
3. race all of it with `step.timeout ?? prepareTimeout` → `STEP.MISSING { why: "timeout" }`.

When 1 and 2 are synchronous the effect sends `STEP.READY` while the machine is processing
`START` / `STEP.NEXT`; run-to-completion makes the state `active` before any render, so a
sync step has no `preparing` frame (spec "Preparing A Step").

*Why not zag's approach* (call the effect from an action and keep the cleanup in a `ref`):
actions are supposed to be synchronous bookkeeping and the ref is invisible to the graph and
to model-based tests; here the handoff is an event with a payload.

### 3. Target readiness and the missing-target policy

`isRendered(el)`: `el.isConnected`, `el.checkVisibility?.({ visibilityProperty: true })
!== false` (falls back to a computed-style check) and a non-empty `getBoundingClientRect()`.
Policies are `applyMissingPolicy` outcomes: `skip` → `STEP.NEXT`/`STEP.PREV` in the last
direction of travel (a `preparing → preparing` re-entry with the next pending id; running
off the end completes forward, closes with `target-missing` backward); `stop` → idle with
`target-missing`; `center` → `STEP.READY` with `centered: true` (the step behaves as a
dialog step and carries `data-target-missing`). `onMissingTarget` is a callback, not a
status. *Alternatives:* Shepherd's three separate options (`waitForElement`,
`skipMissingElement`, `showOn`) — their *effects* are all expressible by timeout + policy +
the consumer filtering `steps`, which also keeps "Next / Done" labels correct (driver.js#616).

### 4. Spotlight: a pure path function, geometry from positioning

```ts
// core/components/tour/spotlight-path.ts — pure, node-testable
export interface Cutout { x: number; y: number; width: number; height: number; radius: number }
export function cutoutsFor(options: { target?: Rect; content?: Rect; viewport: Size;
  padding: { x: number; y: number }; radius: number; content: { padding: number; radius: number } | false }): Cutout[]
export function spotlightPath(viewport: Size, cutouts: readonly Cutout[]): string   // M…Z evenodd subpaths
```

- Every cutout is padded, **clamped to the viewport**, dropped when it has no area, and its
  radius is `min(radius, w/2, h/2)`. Cutouts that intersect are replaced by one cutout over
  their bounding rectangle (radius of the larger) — the even-odd rule would otherwise make
  overlapping holes cancel and re-dim the card (Reado's comment step).
- The anchor passed to positioning is a virtual element whose `getBoundingClientRect()`
  resolves the target getter **on every pass** and returns the padded rect (zag's
  `getAnchorRect`), so the card clears the cutout and a replaced target is followed. The
  placed report carries `anchorRect` (request #2) and the machine stores it as
  `spotlightRect`; connect turns it into the Spotlight's variables and the Backdrop's
  `clip-path: path(evenodd, "…")` in the same render as the placement, so card and cutout can
  never disagree by a frame.
- `watchTarget` (`active` effect): a `MutationObserver` on the root node re-runs the getter;
  an identity change sends `TARGET.CHANGED` (the mark moves, positioning re-anchors through the
  virtual anchor), a result that is null or not rendered sends `TARGET.LOST`.
- Backdrop is `position: fixed; inset: 0` so no document-height polling is needed (Zag
  polls `scrollHeight` every frame while open); the viewport size comes from the document's
  own window (`visualViewport` when present, else `documentElement` client size), which is also
  what makes tours in iframes and jsdom measure the right thing (zag PR #3340). The backdrop
  persists across steps and keeps its last cutouts while `preparing` (no flicker).
- The Spotlight is a separate part so themes can ring the target; with
  `preventTargetInteraction` it gets `data-shield` and `pointer-events: auto` (inline) so it
  swallows presses on the target's rectangle. *Alternative:* `inert` on the target (Zag,
  Intro) — removes it from the accessibility tree and from keyboard; rejected.
- *Alternatives:* SVG `<mask>` overlay (Driver, Shepherd) — needs layout in an SVG and a
  second element; `box-shadow: 0 0 0 100vmax` on the spotlight (common CSS trick) — one hole
  only and breaks with `border-radius` clipping; both rejected for `clip-path` with a
  computed path, which Zag and Reado already prove works.

### 5. One layer per shown step, modality per step

`active` runs `overlayEffect(env, { kind: "tour", modal: stepIsModal, parent, opener:
trigger ?? startFocus, elements: [positioner, content, backdrop?, target], dismiss: { escape:
closeOnEscape, outsidePress: closeOnOutsidePress, outsideFocus: closeOnOutsideFocus,
isInside: target + persistent elements }, initialFocus: () => false /* machine focuses on
first placement */, finalFocus })`. Modal vs non-modal is the one boolean passed to the
stack: inert, scroll lock and Tab wrap follow from `topmostModal()`; the target is in
`elements`, so a modal anchored step keeps it exposed. Because the effect belongs to `active`,
each step is a fresh layer; **`finalFocus` returns `false` for the internal re-entries**
(`reason === "step"`) and the captured `startFocus` only for real exits, so focus never hops
to the opener between steps (scenario "Focus does not hop between steps"). Between two
modal steps there is a synchronous release → push: outside-inert recomputes and settles within
the same task.

`kind: "tour"` is a new layer kind (request #1); until it exists the implementer registers
`kind: "popover"` with family `"tour"`.

### 6. Focus policy

- `focusInitial` runs on the first `POSITION.PLACED` of the *tour* (not of each step) with
  the target `Content`; on later steps `recoverFocus` (an `active` effect) runs once after
  the step's first placement: if `document.activeElement` is inside `Content` and still
  connected → nothing; if it was inside `Content` and is gone, or is `body` → focus
  `Content`; otherwise (outside the tour: the highlighted field, the page) → nothing. The
  "was inside" test is recorded at the moment `STEP.NEXT` is handled (`focusWasInside`), because
  the node may already be gone at placement time.
- Positioning writes, scroll and resize never call `focus()`; there is no timer-based focus
  (Shepherd's 300 ms `focusAfterRender`, #1368).
- Touch: first focus still goes to `Content` (a container; it does not open the keyboard).
- `finalFocus` default = `startFocus` (the element focused at `START`) ?? the trigger;
  restore is done by the overlay effect's cleanup (after inert and lock release), skipped
  when focus is outside the tour layer and not on `body` (the user moved on).

### 7. Keyboard

`stepKeys` adds one `keydown` listener on `Content` (bubble phase): ArrowRight/ArrowLeft
map to `STEP.NEXT`/`STEP.PREV` (swapped under `dir="rtl"`), after the guards in the spec
(`defaultPrevented`, modifiers, composing, editable / `select` / arrow-using `input` target,
ends of the tour: `hasNext`/`hasPrev` guard on the *key*, so the last step does not complete
and the first does not blur). Escape is the layer's. `nonModalTabOrder` is a no-op for
modal steps and otherwise `trackNonModalTabOrder(env, { trigger: () => target, content,
layer })` (request #3 asks for non-focusable triggers).

### 8. Announcements

`announceStep` (an `active` effect started after the first placement of a step) compares the
focus decision of §6: when focus was not moved by the tour it calls
`announcer.polite(messages.stepAnnouncement({ current, total, title }))` where `title` is the
`textContent` of the rendered Title element (framework-neutral; works for rich titles). The
first step and any step where `recoverFocus` focused `Content` announce nothing: the dialog's
name and description are read through the focus move. The contract declares the expectation.

### 9. Parts and attributes

Connect owns every attribute listed in the spec; positioner and arrow props come from
`positionerProps` / `arrowProps`; layer metadata from the layer handle's `meta()`. `Content`
is the same element for every step (so focus on a persisting control survives a step
change); `Title` / `Description` / `ProgressText` / `Actions` re-render from the shown step.
`Title` renders `h{level}` through add-heading's `headingProps`. `Trigger` gets no anchor
props (the target is the anchor). `ActionTrigger` computes its name from children, else
`messages`; its `aria-disabled` replaces zag's `disabled` for Back at the first step
(intro.js#2073). `Actions` calls children with `step.actions ?? []`.

### 10. Contract

```ts
export const tourContract = contract("tour", {
  anatomy: ["trigger","backdrop","spotlight","positioner","content","arrow","title","description",
            "progress-text","action-trigger","close-trigger"],
  locate: { part: "trigger", role: "button", name: true },
  actions: {
    start:   { pointer: ({ part }) => part("trigger").click(), keyboard: …, done: q => q.isOpen() && q.phase() === "shown" && q.hasFocus() },
    next:    { pointer: ({ part }) => part("action-trigger", { action: "next" }).click(), keyboard: ({ keyboard }) => keyboard.press("ArrowRight"), done: q => q.stepChanged() || !q.isOpen() },
    prev, skip, dismiss, pressEscape, pressOutside, pressArrow, tab, shiftTab, waitForStep, waitForUnmount,
  },
  queries: { isOpen, stepId, stepIndex, totalSteps, phase, title, description, progressText,
             isModal, hasFocus, isTopmost, target, spotlightRect, closeReason, announcements,
             ...positioningQueries },
  states: { idle: { isOpen: false }, preparing: { isOpen: true, phase: "preparing" },
            active: { isOpen: true, phase: "shown" }, waiting: { isOpen: true, phase: "waiting" } },
  events: {
    START: "start", "STEP.NEXT": "next", "STEP.PREV": "prev", SKIP: "skip", DISMISS: "dismiss",
    "STEP.READY": { skip: "emitted by the visit effect" }, "STEP.MISSING": { skip: "timer driven; unit tests" },
    "STEP.GOTO": { skip: "api and custom actions; unit tests" }, "TARGET.LOST": { skip: "DOM driven; browser tests" },
    "TARGET.CHANGED": { skip: "DOM driven" }, "STEPS.SET": { skip: "prop driven; unit tests" },
    "POSITION.PLACED": { skip: "emitted by positioning" }, "POSITION.REPOSITION": "reposition",
    "$sync:open": { props: (target) => ({ open: target !== "idle" }) },
  },
  traits: ({ props }) => ["layer", "restores-focus", "presence", "anchored", ...(props.modal ? ["modal"] as const : [])],
})
```

The model-based fixture has five steps: centred, anchored, anchored with an async effect
(reaches `preparing`), a wait step advanced by a click, anchored last. `testMachine` runs
with `modal` false and true, in pointer / keyboard / virtual modalities, in the browser and
jsdom projects (jsdom reports unexercised layout invariants).

### 11. Shared modules used

`core/dom`: `overlay`, `layer-stack`, `dismiss`, `focus-scope`, `focus-restore`,
`inert-outside`, `scroll-lock` (via the stack), `presence`, `portal`, `position`, `press`,
`modality`, `focus-safely`, `keyboard`, `non-modal-tab-order`, `announcer`. New, local to
this change: `core/dom/wait-for-element.ts` (`waitForElement`, `waitForEvent`, `isRendered`)
and `core/dom/step-effect.ts` (the visit), both with their own unit and browser tests; no
`core/collection` module.

## Reado coverage

| Reado relies on (file) | Specified in |
|---|---|
| `useTour({ steps })`, `Tour.Root tour`, `tour.start("welcome")`, `tour.open`, `tour.stepIndex` (OnboardingTour, ProjectTourPlayer) | Anatomy, Open State And Reasons, Current Step |
| Step `type: dialog / tooltip`, `target()`, `placement`, `offset` incl. negative `mainAxis`, ReactNode `description` (all steps) | Steps, Positioning (`sticky` replaces the negative-offset hack), Accessible Name And Description |
| `actions: [{ label, action: next / prev / dismiss }]`, `Tour.Actions` render prop, `ActionTrigger action={a}` (TourCard) | Actions |
| `Tour.ProgressText` with `translations.progressText({ current, total })` (+1 workaround) (TourCard) | Progress, Messages |
| `Tour.CloseTrigger aria-label` (TourCard) | Actions, Messages |
| `Tour.Positioner` / `Content` / `Title` / `Description` in a `Portal` outside the zoom layer (App.tsx) | Anatomy, Positioning |
| `closeOnInteractOutside: false`, `keyboardNavigation: true` (ProjectTourPlayer) | Dismissal (defaults), Keyboard Interactions |
| `onStepChange({ stepIndex })`, `onStatusChange({ status: dismissed / completed / skipped })`, "finished" detection (ProjectTourPlayer) | Current Step, Open State And Reasons (`complete`, `skip`, `dismiss`, `details.stepIndex`) |
| Step `effect({ show, update })` that opens a file, waits for the editor (≤ 4 s), lays a target box over a span, updates placement/description, returns cleanup; "live" flag against late completion | Step Effects, Preparing A Step |
| Dynamic `target: () => target.current` (a box that scrolls with the code) and `TOUR_LAYOUT` event when the box re-lays out | Target Replaced Or Lost, Spotlight And Backdrop (tracking), `reposition()` on the API |
| `Tour.Spotlight` kept invisible only so `TourScrim` can read the rect; `TourScrim` with two holes (target + card), merging when the card is inside the target, event-driven re-cut, stable-for-two-frames polling | Spotlight And Backdrop (second cutout, merge, tracking from positioning, no polling) |
| "Reject the garbage rect for a frame" (card at the corner) | Positioning ("No garbage frame") |
| Scrim and spotlight `pointer-events: none` so clicks reach the card and the page | Spotlight And Backdrop, Target Interaction |
| Two tours mounted together, scoped by `data-tour-scope` | Anatomy (instance scoping) |
| Auto-start once per machine with a seen flag, StrictMode burning the flag on the throwaway mount (OnboardingTour) | Presence And Mounting (Strict Mode) |
| `localStorage` gate / resume step / replay (`runNonce`) | app-level through `onStepChange`, `defaultStepId`, `start({ stepId })` |
| `ProjectTourButton`: a Menu to resume / restart / choose another tour, then `play()` | Reado composes Menu + `tour.start({ stepId })`; nothing tour-specific |

## Migration plan (Ark → rind-ui)

| Ark | rind-ui |
|---|---|
| `useTour({ steps, translations, onStepChange, onStatusChange, closeOnInteractOutside, keyboardNavigation })` | `useTour({ steps, messages, onStepChange, onOpenChange, closeOnOutsidePress, keyboardNavigation })` |
| step `placement: "right-start"`, `offset: { mainAxis, crossAxis }` | `side: "right"`, `align: "start"`, `sideOffset`, `alignOffset` (`sticky` instead of a negative offset) |
| `step.type: "tooltip" / "dialog" / "wait" / "floating"` | `tooltip` / `dialog` / `wait`; `floating` = tooltip with `backdrop: false` |
| `step.effect({ show, update, next, goto, dismiss })` | same, plus `signal`, `waitForElement`, `waitForEvent`, async + cleanup promise |
| `onStatusChange({ status })` | `onOpenChange(false, { reason })`: `dismissed` → `dismiss` / `escape-key` / `outside-press`, `completed` → `complete`, `skipped` → `skip`, `not-found` → `target-missing`; `started` → first `onStepChange` |
| `progressText({ current, total })` zero-based | `progressText({ current, total })` one-based |
| `tour.start()` with no id resumes the old step | `start()` begins at the first step; `start({ stepId })` to resume |
| `Tour.Spotlight` + `Tour.Backdrop` (one hole) | `Backdrop` cut by `useTour({ spotlight: { content: true } })` for Reado's second hole; `Spotlight` as ring |
| `Tour.Control` | not provided (a plain `div`) |

## Requests to other changes

Not edited here; each is needed by this change.

1. **`add-overlay-infrastructure` (archived; a follow-up change)** — add `"tour"` to
   `LayerKind` (and its stacking metadata), so tour layers are recognisable in the stack,
   `data-*` and the model-based `layer` trait. Fallback in the meantime: kind `"popover"`,
   family `"tour"`.
2. **`add-floating-positioning` (archived; a follow-up change)** — the placed report SHALL
   include `anchorRect` (the anchor's viewport rectangle used in that pass), so a consumer that
   draws something around the anchor (the tour's spotlight and cutout) stays in the same frame
   as the card. Fallback: the tour measures the same virtual anchor itself in the placement
   callback, at the cost of one extra `getBoundingClientRect()` per pass.
3. **`add-popover` (unarchived) — `non-modal-tab-order`** — `trigger` MAY be a
   non-focusable element or a container: Shift+Tab from the content then focuses the target
   when it is focusable, else the nearest tabbable at or before it (descendants of the
   target count as "on the trigger" for the Tab-forward rule); and the dismissal on leaving
   forward is the layer's own `outsideFocus` option (already how it is described), which
   the tour leaves off.

## Open questions

- `prepareTimeout` default 5000 ms: Zag waits 3 s, Joyride 1 s, Shepherd opt-in. Longer is
  gentler for slow targets, shorter hides a broken tour less. Reado's own effect waits ≤ 4 s.
- Should the missing-target default be `"skip"` (chosen) or `"center"`? A centred card
  describing "this button" without highlighting it can mislead; a skipped step hides
  content. Revisit with the first real tours.
- Whether `Trigger` should exist at all (Ark has none): it exists here for the contract
  and as the default focus-return target; it can be dropped if the owner prefers a
  programmatic-only API.
- Pinch-zoom coverage of the dimmed area (Shepherd #2495, open): needs a device test;
  specified as a manual tier-1 check, not a scenario.

## Risks / Trade-offs

- [A layer is pushed and released per step, so inert and scroll lock toggle between modal
  steps] → both run synchronously from the stack in the same task (no paint between);
  covered by a browser test with a frame callback asserting `inert` never absent between two
  modal steps.
- [`MutationObserver` on the whole document for waiting steps costs on busy pages] →
  active only while a step is `preparing` or `active` with an anchored target; callbacks
  are coalesced to one getter evaluation per microtask.
- [The handoff of `StepVisit` is unusual] → covered by one dedicated machine test for each
  exit path and by the DOM-clean invariant.
- [`clip-path: path()` repaint cost on large pages] → it changes only when the placement
  does; the backdrop is a single composited layer; measured in the site example.
- [Reading `checkVisibility` is not available in older engines] → computed-style fallback,
  tested through the jsdom project.
- [Per-step modality hides the page from AT during a centred step but not an anchored one]
  → intentional; tier-1 manual check with VoiceOver and NVDA of a three-step tour is added
  to the release protocol.

## Migration

New component; Reado migrates from Ark's Tour with the table above. `TourScrim` is deleted
in favour of `Backdrop` with `spotlight.content`; the `-360` offset constants become
`sticky` steps; `tourTranslations` loses its `+ 1`.
