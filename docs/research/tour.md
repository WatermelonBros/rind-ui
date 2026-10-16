# Tour — research

Status: done · Wave: 3

A Tour walks the user through a product: a sequence of **steps**, each a card that
points at a real element on the page (dimming the rest and cutting a spotlight around
it) or sits centred as a plain dialog step. Only Ark UI ships a headless one (from
Zag's `tour` machine); the rest of the field are styled libraries — Shepherd.js,
Driver.js, React Joyride, Intro.js — which are the best source of bug history for the
parts that Zag has only just started to fix: target resolution, scrolling, spotlight
tracking, focus and keyboard. Radix, Base UI, React Aria, Headless UI, Ariakit, Reka UI,
Bits UI and Kobalte do not ship a tour; their dialog/popover work is reused through
`add-dialog`, `add-popover`, `add-overlay-infrastructure` and
`add-floating-positioning` rather than re-researched here.

Sources read 2026-10-16. Zag / Ark: local clones
(`zag/packages/machines/tour/src/*`, `ark/packages/react/src/components/tour/*`, the
tour `CHANGELOG.md`). Shepherd, Driver.js, Joyride, Intro.js: source fetched with
`gh api` from each default branch (`shepherd.js/src/{tour,step}.ts` and
`components/shepherd-element.ts`; `packages/driver/src/{driver,popover,highlight,events,overlay,step}.ts`;
`src/hooks/useFocusTrap.ts`, `src/components/Tooltip/index.tsx`, `src/defaults.ts`;
`src/packages/tour/{components/TourTooltip,onKeyDown,option}.ts`). Issue trackers: each
repo's full issue list pulled with `gh issue list --state all` and filtered locally
(search is rate limited), then every cited issue read. Reado's real usage read
read-only: `components/molecules/{ProjectTourButton,TourCard,TourScrim}.tsx`,
`components/organisms/{OnboardingTour,ProjectTourPlayer}.tsx`, `App.tsx`,
`pages/project/useProjectSession.ts`.

## Pattern

- WAI-ARIA APG: none for tours. The closest is [Dialog (Modal)](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
  for centred steps and [Dialog (non-modal)](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
  semantics (`role="dialog"` without `aria-modal`, page operable) for steps that point
  at something the user may need to touch ([accessibility.md §1.5](accessibility.md):
  "Tour (non-modal dialog)"). A tour card is **not** an `alertdialog`: nothing demands
  an immediate response.
- Roles and attributes required: card `role="dialog"` with an accessible name (the step
  title) and description; `aria-modal="true"` only when the step really makes the page
  inert; controls are native `button`s; the backdrop and spotlight are decorative
  (`aria-hidden`); progress is text ("3 of 12"), not a `progressbar`.
- Keyboard interactions required: Escape closes (topmost layer only); Tab reaches the
  card's actions; the card follows its target in the sequential order when non-modal and
  wraps when modal; arrow keys are a convenience (not required by any pattern), so they
  must never fight text fields or Tab; every action is a button operable with Enter and
  Space.

## How the others built it

### Zag / Ark UI

- Source: `zag/packages/machines/tour/src/{tour.machine,tour.connect,tour.types,tour.dom}.ts`,
  `utils/{step,clip-path,rect,wait}.ts`; Ark React `tour*.tsx`, `use-tour.ts`,
  `wait-for-event.ts` (a thin wrapper plus `Tour.Actions` as a render prop).
- API shape: `useTour({ steps, ... })` returns the API; `<Tour.Root tour={tour}>` provides
  it. Parts `Backdrop`, `Spotlight`, `Positioner`, `Content`, `Arrow`, `ArrowTip`, `Title`,
  `Description`, `ProgressText`, `Actions` (render prop of the current step's actions),
  `ActionTrigger` (`action` = `next | prev | dismiss | skip | fn`), `CloseTrigger`, `Control`.
  Steps `{ id, type: tooltip | dialog | wait | floating, target(), title, description,
  placement, offset, backdrop, arrow, actions, effect(args) }`. API: `start(id)`, `next`,
  `prev`, `setStep`, `addStep`/`removeStep`/`updateStep`/`setSteps`, `getProgressText`,
  `getProgressPercent`. Props: `closeOnInteractOutside` (default true), `closeOnEscape`,
  `keyboardNavigation` (arrow keys), `preventInteraction`, `spotlightOffset`,
  `spotlightRadius`, `onStepChange`, `onStatusChange` (`started | dismissed | completed |
  skipped | not-found`), `translations`.
- State model: nested — `tourInactive` and `running` with `resolving → scrolling → active`
  and `waiting`, plus a global `STEP.ROUTE`/`STEP.CHANGED` router. `stepId` is a bindable
  (`sync: true`) so external changes route through a `watch`. Target resolution waits with a
  `MutationObserver` for up to 3 s, then `TARGET.NOT_FOUND` ends the tour. `scrolling`
  calls `scrollIntoView({ block: "nearest", behavior: "instant" })` and then waits a fixed
  100 ms. Step `effect(args)` gets `show`, `update`, `next`, `goto`, `dismiss`, `target`
  and returns a cleanup; a `wait` step shows nothing and relies on its effect to move on.
- Rendering: the backdrop is `position: absolute` over the document and clipped with
  `clip-path: path("…")` — an outer rectangle plus one rounded hole around the target
  (`clip-path.ts`); the spotlight is a separate absolutely positioned ring (`--spotlight-x/y/
  width/height`); the card is positioned with `getPlacement` using the **spotlight-padded
  target rect** as anchor and `restoreStyles: false` (`--x/--y`). Layer CSS variables
  `--tour-layer` 0/1/2 order backdrop, spotlight, positioner. A `requestAnimationFrame` loop
  (`trackBoundarySize`) polls `visualViewport` width and `scrollHeight` for as long as a
  tooltip step is open.
- Accessibility as built: card `role="alertdialog"` + `aria-modal="true"` +
  `aria-live="polite"` + `aria-atomic` + `aria-labelledby` title + `aria-describedby`
  description + `tabindex=-1`; a focus trap over `[content, target]` (so the target stays
  reachable); Escape on the document in capture phase with `stopPropagation`;
  ArrowLeft/ArrowRight on the content only (RTL swapped); `type="button"` on the close and
  action triggers; the close button is named "close tour" and, until zag 1.46, every action
  trigger was too.
- Notable: the **step effect with `show()` / `update()`** (async preparation before a step
  is shown — Reado's project tour is built on it); `spotlightOffset` as the anchor rect
  padding so the card clears the cutout; `data-side`/`data-placement` per part;
  `preventInteraction` marks the target `inert`; the target is re-resolved on every
  positioning pass so a replaced element is followed (1.45).
- Problems: see Bug history. Structural ones read in the source: no collision shift (a card
  that does not fit simply overflows — Reado pulls it back with negative offsets and a
  `-360` constant); **`aria-modal="true"` on every step** while the page behind it stays
  operable; no focus return to the opener (`returnFocusOnDeactivate: false`); progress
  text gets a zero-based `current`; `start()`'s `id` is a step id but the machine resumes
  "wherever it last was" when none is given (`tour.start()` with no id keeps the old step,
  which Reado works around by always passing `"welcome"`); a `wait` step is re-run when the
  user goes back; `closeOnInteractOutside` defaults to true, so one stray click ends an
  onboarding; the polling loop never stops while open; the ring and the backdrop can only
  cut one hole (Reado replaced the backdrop to also cut one around the card).

### Shepherd.js

- Source: `shepherd.js/src/{tour,step}.ts`, `components/{shepherd-element,shepherd-modal}.ts`,
  `utils/{floating-ui,overlay-path}.ts`.
- API shape: `new Shepherd.Tour(options)`, `tour.addStep({ id, title, text, attachTo: {
  element, on }, buttons, advanceOn, canClickTarget, scrollTo, scrollToHandler, showOn,
  skipMissingElement, waitForElement, beforeShowPromise, when, modalOverlayOpeningPadding,
  extraHighlights, label })`, `useModalOverlay`, `exitOnEsc`, `keyboardNavigation`,
  `confirmCancel`.
- State model: imperative; steps are re-created on every show (`_setupElements`).
  `waitForElement` (ms) watches the DOM with a `MutationObserver` before showing;
  `skipMissingElement` advances (or goes back) past steps whose target is absent, completing
  if none remain; `showOn()` filters steps; `beforeShowPromise` delays showing.
- Rendering: the step is a native `<dialog open>` (non-modal) whose Tab handling cycles
  between the **target's focusable descendants and the dialog's** (the target gets
  `tabindex=0`); an SVG overlay path with an opening per highlighted element; the step's
  `aria-label` is used only when it has no title, so the title always names it.
- Notable: `waitForElement` + `skipMissingElement` + `showOn` as three separate, composable
  answers to "the target is not there"; extra highlighted elements; `confirmCancel` hook;
  focus restored to the element that was focused before the tour.
- Problems: focus is forced onto the step container 300 ms after every positioning write
  (#1368, #2117, #3505); the target is skipped by Tab (#3202); the overlay path goes wrong
  with scroll parents and viewports (#1984, #3344, #444); pinch-zoom (#2495, open); touch
  scrolling blocked on the highlight (#1717, open).

### Driver.js

- Source: `packages/driver/src/{driver,popover,highlight,events,overlay,step}.ts`.
- API shape: `driver({ steps, showProgress, allowClose, allowKeyboardControl,
  overlayClickBehavior, stagePadding, smoothScroll, disableActiveInteraction, popoverClass,
  onHighlightStarted, onDestroyStarted … })`; steps `{ element, popover: { title,
  description, side, align, showButtons, progressText }, disableActiveInteraction }`;
  `skipMissingElement`.
- Notable: the highlighted element gets `aria-haspopup="dialog"`, `aria-expanded="true"`,
  `aria-controls` while active (the only one to relate target and card for AT); popover is
  `role="dialog"` + labelledby/describedby; `closeBtnLabel` option (#623); overlay is one SVG
  path; `onDestroyStarted` lets the app veto the exit (confirm); `overlayClickBehavior:
  close | nextStep | fn`.
- Problems: a global `window` keydown listener drives Escape and arrows (so they work on the
  page, not the card), Tab is wrapped by hand between popover and target; focus moves to the
  first focusable of `[popover, target]` after the scroll; `skipMissingElement` leaves the
  previous step saying "Next" instead of "Done" (#616); scrolling ignores fixed headers
  unless the author sets `scroll-padding` (#580, #443).

### React Joyride

- Source: `src/hooks/{useFocusTrap,useTourEngine,useScrollEffect}.ts`, `components/Tooltip/index.tsx`,
  `defaults.ts`.
- API shape (v3): `<Joyride steps run continuous onEvent … options={{ blockTargetInteraction,
  overlayClickAction, dismissKeyAction, targetWaitTimeout, scrollOffset, spotlightPadding,
  spotlightRadius, disableFocusTrap, skipBeacon }} />`; controlled by `stepIndex`; `locale`
  with `nextWithProgress: "Next ({current} of {total})"`; a `useJoyride` hook.
- Notable: tooltip is `role="alertdialog"` + `aria-modal`; the progress is part of the
  primary button's label (fixed after #1074); the focus trap focuses the primary button and
  restores the previous focus on cleanup; `targetWaitTimeout` (1 s) with a
  `target_not_found` event; `scrollOffset` for sticky headers.
- Problems: controlled mode corrupts the lifecycle when the app changes `stepIndex` itself
  (#1206 — closed "works as designed"); overlay
  unmounts between steps and flickers (#914, #1091); target changes position without a window
  resize and the spotlight does not follow (#1158, #1137, closed in v3).

### Intro.js

- Source: `src/packages/tour/{components/TourTooltip,onKeyDown,option}.ts`.
- Notable (as a cautionary tale): the tooltip is a `div` with no `dialog` role; controls are
  `<a role="button">`; bullets are a `tablist` of `<a>` with no names (#1646); progress is a
  custom `role="progress"`; the heading is `role="heading" aria-level=1` with an `aria-label`.
  Keyboard: Enter on the focused button, arrows (not RTL-aware, #2035), Escape;
  `exitOnEsc: false` did not work (#779); the last step's Enter handler threw (#849) and
  Enter on a hidden-but-focused Next did the wrong thing (#2073).

## Accessibility

Apply [accessibility.md](accessibility.md) and
[assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md) (Dialog /
alert dialog rows of "By component pattern": name not spoken in VO + Chrome RX#3348,
description ignored RX#2038, Safari 26 not following `focus()` into new content,
double reading when focus lands after the heading RX#3377).

- **Dialog vs non-modal semantics.** A tour is the one overlay whose point is to let the
  user interact with the page behind it ("click this button now"). Making every step
  `aria-modal` (Zag, Joyride) tells AT that the page is gone while Tab and pointer still
  reach it; making none modal (Shepherd) leaves a centred "Welcome" step with a live page
  behind it (#2959: users cannot tell the card from the page; #1914: authors want the rest
  hidden). rind-ui decision: **per-step modality** — a centred step is a real modal dialog
  (inert page, scroll lock, Tab wraps) through the overlay infrastructure, an anchored step
  is a non-modal dialog (page operable, no `aria-modal`), and either can be forced with
  `modal`. A modal anchored step keeps its target un-inert.
- **Inert background.** For modal steps `inert` (never `aria-hidden`) from
  outside-inert; the target is part of the layer so it stays usable. Non-modal steps
  leave the page alone; the backdrop and spotlight are `aria-hidden` and never take
  focus.
- **Name, description, level.** The card is named by its Title (a heading, shared
  Title Heading Level behaviour); described by Description. A step with no Title would
  fail axe `aria-dialog-name` (Shepherd #2390 added `label` for exactly this): we name it
  "Step 3 of 12" from messages. `alertdialog` is not used.
- **Announcing step changes.** Focus is the announcement for the first step and any step
  reached while focus is inside the card: focus moves to the card (`tabindex=-1`
  `role=dialog`) whose name and description AT then read. When focus stays where it is —
  the user is typing in the highlighted field and the step advances on its own — nothing
  is spoken by focus, so a polite message "Step 3 of 12: <title>" goes through the shared
  announcer instead. The card itself is **not** a live region (Zag's `aria-live` +
  `alertdialog` on top of a focus move reads the content twice in the SR combinations
  RX#3377 describes).
- **Focus management.** Initial focus on the card, not on the first button: Shepherd's
  open #3065 is a debate between Close and Next; both skip the name/description read that
  focus on the dialog gives, and a first-focused "Skip tour" is a destructive default.
  Consumers wanting Joyride's "Enter, Enter" flow pass `initialFocus`. On step change focus
  stays on a persisting control, goes to the card when the control disappeared (the last
  step swaps "Next" for "Done") and is **left alone** when it is outside the card
  (Shepherd #2117/#3505/#1368, Driver #368). Scroll and resize never move
  focus. On exit focus returns to where the tour started unless the user moved on
  (Shepherd #473).
- **Keyboard.** Escape closes the topmost layer only. Arrow keys are scoped to the card
  and ignored in text fields, with `Right` = next in LTR and previous in RTL (Intro #2035);
  they never wrap or finish the tour (Intro #849). `Tab` order: modal steps wrap;
  non-modal steps put the card right after its target through `non-modal-tab-order`, so
  the target is not skipped (Shepherd #3202) and Shift+Tab from the card's first control
  goes back to the target.
- **Target relation.** Driver sets `aria-haspopup/expanded/controls` on the target; that
  edits application DOM and announces "dialog, expanded" on random elements, so rind-ui only
  marks the target with `data-rind-tour-target` (restored exactly) for styling.
- **Forced colors.** A translucent scrim collapses to an opaque system colour in forced
  colors and would hide the page. The theme keeps the backdrop transparent there and draws
  the spotlight ring and the card border with `CanvasText`/`Highlight` instead.
- **Motion.** Spotlight movement between steps is a CSS transition the theme removes under
  `prefers-reduced-motion` (Driver #379 left this to the author); programmatic scrolling
  uses `behavior: "auto"` and `"instant"` under reduced motion.
- **Target size and contrast.** Action buttons and the close button: 24 × 24 CSS px
  minimum (WCAG 2.5.8); the card against the scrim: the theme checks text contrast on
  the card surface, not on the scrim.
- **Auto-advance.** Advancing a tour when a field becomes valid (Ark's "Wait for Input"
  recipe, ark#3910) changes context on input (WCAG 3.2.2) and moves the user past a
  field they have not finished; the recipe becomes "enable Next when valid".
- **Native platform** ([native-platform.md](native-platform.md)): `<dialog>.showModal()` is
  avoided like everywhere else (Tour is on its list of components); the `popover`
  attribute and CSS anchor positioning can place the card but not the cutout, so the
  positioning capability stays the single mechanism; `scrollIntoView` and `scroll-margin` /
  `scroll-padding` do the scrolling and the author's sticky header offsets (Driver #580,
  Joyride #938/#1179 — both ended with an offset option; we read the CSS instead);
  `Element.checkVisibility()` decides whether a target is rendered; `inert` for modal steps;
  `ResizeObserver`/`MutationObserver` for tracking, not rAF polling.

## Bug history

Required. Search of each library's tracker (open and closed); only issues I read are
listed. Ark/Zag first (the component we replace), then the styled tours that carry the
history Zag lacks. Radix, Base UI, React Aria, Headless UI, Ariakit, Reka UI, Bits UI and
Kobalte have no tour; their dialog/popover/focus bugs are in
[dialog.md](dialog.md), [popover.md](popover.md) and
[overlay-infrastructure.md](overlay-infrastructure.md).

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| Zag | [#2462](https://github.com/chakra-ui/zag/issues/2462) | `tour.start("source")` starts at the first step | `START` ignored its value after a refactor | closed | `start({ stepId })` is tested for a mid-tour id and for resume |
| Zag | [#3046](https://github.com/chakra-ui/zag/issues/3046) | Dialog step mispositioned after going to step 2 and back | popper styles from the tooltip step survived the switch (changelog 1.38.1: "popper styles not cleaned up…") | closed | a centred step carries no placement residue from the previous one |
| Zag | [#2901](https://github.com/chakra-ui/zag/issues/2901) | Input inside the spotlight not interactive | focus trap contained only the card; fixed 1.32.0 by trapping `[content, target]` | closed | the target is part of the layer; interaction with it is a first-class case |
| Zag | [#3222](https://github.com/chakra-ui/zag/issues/3222) | `action: "skip"` did nothing | action map had no skip handler | closed (1.43.0) | every action type has a contract action |
| Zag | [#3268](https://github.com/chakra-ui/zag/issues/3268) | Close trigger submitted an ancestor form | missing `type="button"` (changelog 1.43.1) | closed | every button part sets `type="button"` |
| Zag | [PR #3341](https://github.com/chakra-ui/zag/pull/3341) / changelog 1.45.0 | Card, spotlight and backdrop collapse to the top-left when the target element is replaced mid-tour | detached node measured zero | fixed | target re-resolved on every pass; a lost target is a state, not a zero rect |
| Zag | [PR #3340](https://github.com/chakra-ui/zag/pull/3340) | Backdrop leaves part of the page undimmed on resize; spotlight slides on resize; crashes in jsdom and iframes | polled outer `scrollHeight`; bare `visualViewport` global | fixed 1.45.0 | measure through the document's window; the spotlight animates between steps only |
| Zag | changelog 1.43.0 | Dismissing from a step `effect` skipped cleanup and missed `completed` | effect cleanup tied to the old router | fixed | effect cleanup runs on every exit path, including dismiss from inside the effect |
| Zag | changelog 1.46.0 ([PR #3355](https://github.com/chakra-ui/zag/pull/3355)) | "Got it" announced as "close tour" | translation put in `aria-label` on every action trigger | fixed | visible label is the name (WCAG 2.5.3); messages only when empty |
| Zag | changelog 1.33.0 | "Janky scroll behavior" when navigating between steps | not stated; the current machine still waits a fixed 100 ms after `scrollIntoView` | fixed | track scroll through positioning, no fixed waits |
| Ark | [#3910](https://github.com/chakra-ui/ark/issues/3910) | "Wait for Input" recipe advances after two typed letters | auto-advance on first valid state | closed | no auto-advance on input in recipes; enable Next instead (WCAG 3.2.2) |
| Ark | [#4162](https://github.com/chakra-ui/ark/issues/4162) | Backdrop, spotlight and content stack wrongly | `--tour-layer` variables missing/unused | closed | stacking comes from layer metadata, documented and tested |
| Ark | [#3866](https://github.com/chakra-ui/ark/issues/3866) | A `--z-index` override in the Positioner's `style` is ignored | the machine's style is applied over the consumer's | closed | consumer `style` is merged last, except the positioning properties |
| Ark | [#4049](https://github.com/chakra-ui/ark/issues/4049) | Solid: with `lazyMount` + `unmountOnExit`, closing the last step removes the card before its exit animation | adapter did not wait for presence (React did) | closed | exit animation on every close path, in every adapter |
| Shepherd | [#1368](https://github.com/shipshapecode/shepherd/issues/1368) | Any scroll or resize moves focus to the step container | `focus()` inside a position modifier | closed (stale) | positioning never moves focus |
| Shepherd | [#2117](https://github.com/shipshapecode/shepherd/issues/2117), [#3505](https://github.com/shipshapecode/shepherd/issues/3505) | Step steals focus from an input in the highlighted area | unconditional autofocus after 300 ms | open | focus moves only at start and when focus is already in the card |
| Shepherd | [#3202](https://github.com/shipshapecode/shepherd/issues/3202) | Tab skips the highlighted target | target not in the sequential order the step handled; today `element.ts` sets `tabindex=0` on it and cycles | closed | card follows its target in Tab order |
| Shepherd | [#3071](https://github.com/shipshapecode/shepherd/issues/3071), [#3065](https://github.com/shipshapecode/shepherd/issues/3065) | Extra tab stop; focus not visible on start; debate Close vs Next first | inner `tabindex=0` div; focus on container | closed / open | the card is the one focus target; no inner tab stops |
| Shepherd | [#2959](https://github.com/shipshapecode/shepherd/issues/2959), [#1914](https://github.com/shipshapecode/shepherd/issues/1914) | Background reachable by SR; cannot tell the card from the page | plain `div`, no modality | closed (#1914 "out of scope") | modal steps use `inert`; the choice is per step |
| Shepherd | [#2390](https://github.com/shipshapecode/shepherd/issues/2390) | axe `aria-dialog-name`: untitled step has no name | no label when no title | closed (label added) | name fallback from messages |
| Shepherd | [#473](https://github.com/shipshapecode/shepherd/issues/473) | Closing does not return focus to the opener | nothing recorded | closed | focus return is part of the overlay effect |
| Shepherd | [#1076](https://github.com/shipshapecode/shepherd/issues/1076) | Shift+Tab right after start leaves the tour to the last element on the page | focus on the container was not handled by the wrap (today `element.ts` tests for `.shepherd-element`) | closed | wrap/Tab order covers focus on the card container itself |
| Shepherd | [#1873](https://github.com/shipshapecode/shepherd/issues/1873) | Right arrow triggers next instead of the custom action button | arrow handler bypasses the step's own actions | open | arrow keys are the same events as the buttons; steps can opt out |
| Shepherd | [#968](https://github.com/shipshapecode/shepherd/issues/968) | Double click on Next one step before the end skips the last step's work | no guard between steps | closed (stale) | while a step is preparing, Next/Back are ignored |
| Shepherd | [#580](https://github.com/shipshapecode/shepherd/issues/580) | Card at (0,0) when the target is re-rendered | stale element reference | closed | target getter re-resolved |
| Shepherd | [#444](https://github.com/shipshapecode/shepherd/issues/444) | Previous cutout reappears on scroll on a centred step | overlay reused the old opening | closed | cutouts derive from the current step each pass |
| Shepherd | [#1984](https://github.com/shipshapecode/shepherd/issues/1984), [#3344](https://github.com/shipshapecode/shepherd/issues/3344) | Overlay covers a target outside the initial window; extra highlight fails in another scroll parent | `scrollParent` rect without page scroll | closed | cutout from `getBoundingClientRect` in viewport space, clamped, per element |
| Shepherd | [#2495](https://github.com/shipshapecode/shepherd/issues/2495) | Pinch-zoom leaves part of the page undimmed and clickable | overlay fixed to layout viewport | open | manual tier-1 device check; dim the visual viewport |
| Shepherd | [#1717](https://github.com/shipshapecode/shepherd/issues/1717) | Touch scroll impossible on the highlight | overlay blocks touch | open | the backdrop never prevents scrolling of the page or of the target |
| Shepherd | [#2351](https://github.com/shipshapecode/shepherd/issues/2351) | Clicking an element in `show()` dismissed the tour | race in the reporter's code, but shows `show` hooks run user code mid-transition | closed | step effects are run-to-completion safe: a click inside an effect never counts as an outside press |
| Driver.js | [#616](https://github.com/kamranahmedse/driver.js/issues/616) | Skipping a missing last step leaves "Next" on the step before it | label computed before targets are known | closed | missing target at the end completes the tour; docs: filter steps up front |
| Driver.js | [#109](https://github.com/kamranahmedse/driver.js/issues/109) | `allowClose:false` also disabled Escape although `keyboardControl:true` | one flag for several inputs | closed 0.6.1 | independent props: `closeOnEscape`, `closeOnOutsidePress`, `keyboardNavigation` |
| Driver.js | [#580](https://github.com/kamranahmedse/driver.js/issues/580); Joyride [#1179](https://github.com/gilbarbara/react-joyride/issues/1179), [#938](https://github.com/gilbarbara/react-joyride/issues/938) | Target ends up behind a fixed header | `scrollIntoView` without the author's offset | closed ("use `scroll-padding`"; Joyride `scrollOffset`) | use native `scrollIntoView` and document `scroll-margin` |
| Driver.js | [#368](https://github.com/kamranahmedse/driver.js/issues/368) | Target focused before the highlight moved | hook order | closed | focus follows readiness, not intent |
| Driver.js | [#121](https://github.com/kamranahmedse/driver.js/issues/121), [#513](https://github.com/kamranahmedse/driver.js/issues/513) | Async preparation (create the target, then move) unsupported | steps with no element were dropped; no promise | closed by rewrite / open | async step effects are first class |
| Driver.js | [#626](https://github.com/kamranahmedse/driver.js/issues/626) | `target.closest is not a function` on a text-node click | `event.target` assumed to be an Element | closed | event targets are narrowed before use |
| Driver.js | [#623](https://github.com/kamranahmedse/driver.js/issues/623) | Close button's name not translatable | hard-coded `aria-label` | closed (`closeBtnLabel`) | every AT string comes from `messages` |
| Joyride | [#1074](https://github.com/gilbarbara/react-joyride/issues/1074) | Progress visible but not in the button's name | `aria-label` replaced the visible text | closed 2.9.0 | name contains the visible text |
| Joyride | [#551](https://github.com/gilbarbara/react-joyride/issues/551), [#706](https://github.com/gilbarbara/react-joyride/issues/706) | Primary button not focused; alertdialog pattern half implemented | selector race; pattern copied without a title | closed | decide and test the initial focus target |
| Joyride | [#914](https://github.com/gilbarbara/react-joyride/issues/914), [#1091](https://github.com/gilbarbara/react-joyride/issues/1091), [#811](https://github.com/gilbarbara/react-joyride/issues/811) | Overlay unmounts and remounts between steps (flicker); controlled tour invisible in Strict Mode | overlay owned by the step | closed | the backdrop belongs to the tour, not the step; Strict Mode is a test mode |
| Joyride | [#1158](https://github.com/gilbarbara/react-joyride/issues/1158), [#1137](https://github.com/gilbarbara/react-joyride/issues/1137), [#927](https://github.com/gilbarbara/react-joyride/issues/927) | Card/spotlight stay put when the target moves without a window resize, or flips | position measured only on resize/scroll | closed in v3 / "not our job" (#927) | tracking covers layout shifts, ancestor animation ends and size changes |
| Joyride | [#1149](https://github.com/gilbarbara/react-joyride/issues/1149), [#585](https://github.com/gilbarbara/react-joyride/issues/585) | Target not mounted yet breaks production / hangs a tour whose first step has no target | no wait, no policy | closed (v3 `targetWaitTimeout`) | wait with a timeout, then a declared policy (skip, stop, centre) |
| Joyride | [#1206](https://github.com/gilbarbara/react-joyride/issues/1206) | Changing `stepIndex` from outside in controlled mode leaves the overlay-close behaviour inconsistent | two writers for the step | closed ("working as designed") | controllable `stepId` and `open` with proposals and `cancel()`, one writer |
| Joyride | [#1083](https://github.com/gilbarbara/react-joyride/issues/1083) | Double-clicking a button inside the spotlight calls `next()` twice | the spotlight stays interactive during the move | closed ("disable your button") | ignore Next/Back while preparing; shield option for the target |
| Intro.js | [#1017](https://github.com/usablica/intro.js/issues/1017), [#782](https://github.com/usablica/intro.js/issues/782) | Step content not announced by VoiceOver/NVDA/TalkBack | no dialog role/name, no focus move | closed (stale) | role, name, focus move, announcer fallback |
| Intro.js | [#1646](https://github.com/usablica/intro.js/issues/1646), [#1752](https://github.com/usablica/intro.js/issues/1752) | Step bullets have no name; links used as buttons | `<a role="button">`, no text | closed (stale) | native buttons; no bullet navigation in v1 |
| Intro.js | [#2073](https://github.com/usablica/intro.js/issues/2073), [#849](https://github.com/usablica/intro.js/issues/849) | Hidden Next keeps focus and Enter breaks the last step; Right arrow on the last step throws | button hidden, not removed from focus; no end check | open / closed | `aria-disabled` not `hidden` for ends; arrows never act past the end |
| Intro.js | [#2035](https://github.com/usablica/intro.js/issues/2035), [#779](https://github.com/usablica/intro.js/issues/779) | RTL arrows reversed; `exitOnEsc:false` ignored | not direction-aware; option not wired | closed (stale) | logical keys; each option has a scenario |
| Intro.js | [#2136](https://github.com/usablica/intro.js/issues/2136) | Tour does not wait for the async `onBeforeChange` | callback result ignored | closed | async preparation awaited, with a timeout |

## Known pitfalls

- **Spotlight geometry.** Overlapping even-odd holes cancel each other (Reado's comment
  step: card inside the target); holes bigger than the viewport; border radius larger than
  half the target (Reado's `roundedRect` test); stale first-frame geometry (Reado "rejects
  the garbage rect zag reports for a frame"); targets inside `position: fixed`/`sticky`
  ancestors, `transform` ancestors (a transform ancestor breaks `fixed` — Reado renders the
  tour outside its zoom layer); pinch-zoom.
- **Target lifecycle.** Not mounted yet; hidden (`display: none`, zero size, inside a closed
  collapsible); replaced by a re-render; removed mid-step; inside an iframe or shadow root
  (Shepherd #1692, #2240 and Driver #496 are the questions users ask); animating position.
- **Focus.** Programmatic focus after scroll (Safari 26 not following `focus()`); focus on a
  control that disappears with the step; focus inside the highlighted field must not move;
  Strict Mode double effects burning a "seen" flag (Reado's `OnboardingTour` comment).
- **Tab order.** Portalled card vs target position; modal vs non-modal; the last step's
  "Done" replacing "Next"; Shift+Tab immediately after start.
- **Scrolling.** `scrollIntoView` vs sticky headers; smooth scroll in progress while the
  card is positioned; nested scrollers (an editor inside the page — Reado); reduced motion.
- **Keyboard.** Arrow keys in text fields and selects; IME composition; RTL.
- **i18n.** `current` is 0-based in Zag, 1-based in Joyride and Reado's text; RTL parentheses
  in "Next (3 of 12)" (Joyride #591).
- **SSR.** Nothing renders until the client starts the tour; a `defaultOpen` tour must wait
  for targets that only exist on the client.

## Testing notes

Hard to test: spotlight geometry in jsdom (no layout) — the cutout maths is a pure function
with node tests and the DOM is covered in the browser project; async targets (fake
scheduler + a `MutationObserver`); focus recovery when the focused action disappears;
scroll tracking (real scrolling in the browser project, `fakePositioning()` for machine
tests); pinch-zoom (manual tier-1 only). Zag's own tests are Playwright e2e on the docs
site (`e2e/tour.e2e.ts`, `models/tour.model.ts`); Reado has `OnboardingTour.uitest.tsx`
(mocks `visualViewport`, `matchMedia` — [testing.md](testing.md)) and
`ProjectTourButton.uitest.tsx`.

The driver must expose: actions `start`, `next`, `prev`, `skip`, `dismiss`, `pressEscape`,
`pressArrow`, `tab`, `shiftTab`, `waitForStep(id)`, `waitForUnmount`; queries `isOpen`,
`stepId`, `stepIndex`, `totalSteps`, `phase`, `title`, `description`, `progressText`,
`isModal`, `hasFocus`, `target`, `spotlightRect`, `closeReason`, `announcements`, plus the
positioning queries.

## Decisions

- Parts: `Root`, `Trigger`, `Backdrop`, `Spotlight`, `Positioner`, `Content`, `Arrow`,
  `Title`, `Description`, `ProgressText`, `Actions`, `ActionTrigger`, `CloseTrigger`, plus
  the shared `Portal`; hook `useTour`.
- Machine: `idle · preparing · active · waiting`; one layer per shown step through
  `overlayEffect`; controllable `open` and `stepId`; close reasons `complete | skip | dismiss
  | escape-key | outside-press | outside-focus | target-missing | steps-changed | api`.
- `data-*`: `data-state`, `data-phase`, `data-step`, `data-step-type`, `data-modal`,
  `data-side`/`data-align` (positioning), `data-first`/`data-last` on Content, `data-rind-tour-target`
  on the target; cutout and spotlight rect as CSS variables.
- Contract: trigger-located like Dialog; actions `start`, `next`, `prev`, `skip`, `dismiss`,
  `pressEscape`, `pressArrow`, `tab`, `shiftTab`; traits `layer`, `restores-focus`,
  `presence`, `anchored`, `modal` when forced.
- Deliberately different from Zag/Ark, and why: per-step modality and `role="dialog"`
  instead of blanket `alertdialog`+`aria-modal` and `aria-live`; collision-aware card
  (`sticky` to cover the target), no negative-offset hacks; no polling loop; focus returns to
  the opener and is never stolen from outside the card; `outsidePress` and `outsideFocus`
  do **not** dismiss by default; 1-based `progressText({ current, total })`; `start()` always
  begins at the first step unless `stepId` is given; Back skips `wait` steps; a declared
  missing-target policy with a visibility check; the step effect has an `AbortSignal` and may be
  async; Zag's `status` callback is replaced by `onOpenChange` reasons plus `onStepChange`;
  the backdrop belongs to the tour (no flicker) and can cut a second hole around the card;
  `preventTargetInteraction` is a pointer shield, not `inert`, so the target stays in the
  accessibility tree.

## Open questions

- Should `onStatusChange` exist as sugar over `onOpenChange` reasons for Ark migrants?
  (Current answer: no; the migration table in the docs page covers it.)
- Multiple highlighted elements per step (Shepherd `extraHighlights`, Joyride #487) —
  additive later; no consumer yet.
- Iframes: highlighting an element inside a same-origin iframe from a tour in the parent
  (Shepherd #1692, Driver #496 asked). Deferred with the overlay
  infrastructure's iframe work.
- Hints/beacons (Driver `hints`, Intro.js `hint`, Joyride beacon) are a different
  component (Hint/Coachmark); not specified here.
