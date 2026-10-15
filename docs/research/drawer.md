# Drawer — research

Status: done · Wave: 1 (used by Reado; see [0002](../decisions/0002-architecture.md#build-order))

A Drawer is a [Dialog](dialog.md) attached to an edge of the viewport that the user
can also move by hand: swipe it away, or drag it between snap points. Everything that
makes it a dialog (layer, focus, naming, inert outside, scroll lock, presence,
portal) is decided in [dialog.md](dialog.md) and
[overlay-infrastructure.md](overlay-infrastructure.md) and only referenced here. This
note covers the edge placement, the gesture, snap points, nested drawers, the
background "indent" effect and the iOS specifics that make or break a bottom sheet.

Sources read (local clones in the research scratchpad, plus Vaul fetched with `gh api`;
paths relative to each repo):

| Library | Files |
|---|---|
| Zag / Ark | `zag/packages/machines/drawer/src/{drawer.machine,drawer.connect,drawer.types,drawer.stack,drawer.registry,utils/session,utils/drawer-session,utils/snap-point}.ts`, `CHANGELOG.md`; `ark/packages/react/src/components/drawer/*` |
| Base UI | `base-ui/packages/react/src/drawer/{root/DrawerRoot.tsx,root/useDrawerSnapPoints.ts,viewport/DrawerViewport.tsx,popup/DrawerPopup.tsx,popup/DrawerPopupDataAttributes.ts,swipe-area/DrawerSwipeArea.tsx,indent/DrawerIndent.tsx,provider/DrawerProvider.tsx,virtual-keyboard-provider/DrawerVirtualKeyboardProvider.tsx}`, `utils/useSwipeDismiss.ts` (shared with Toast) |
| Reka UI | `reka-ui/packages/core/src/Drawer/{DrawerRoot.vue,DrawerContentImpl.vue,composables/useSwipeDismiss.ts,composables/useDrawerSnapPoints.ts,composables/useDrawerVirtualKeyboard.ts}` (a port of Base UI's drawer) |
| Vaul | `emilkowalski/vaul` `src/{index.tsx,constants.ts,helpers.ts,use-snap-points.ts,use-scale-background.ts,use-position-fixed.ts}` — built on Radix Dialog; README: "This repo is unmaintained" |
| Reado | `reado/src/components/atoms/Drawer.tsx` (+ `__tests__/Drawer.uitest.tsx`, `styles/app.css` `.drawer-*`) |

Radix, React Aria, Headless UI, Ariakit, Bits UI and Kobalte ship no drawer (Bits users
take `vaul-svelte`; Spectrum's `Tray` is a styled modal with no gesture). The
[components.md](../components.md) matrix lists Ark, Base UI and Reka.

## Pattern

- WAI-ARIA APG: none of its own. A drawer is the
  [Dialog (Modal)](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) pattern
  (non-modal: same roles, no modality), laid out at an edge. Everything in
  [dialog.md § Pattern](dialog.md#pattern) applies unchanged.
- Roles and attributes: `role="dialog"`, `aria-modal="true"` when modal, name from the
  title, optional description; trigger `aria-haspopup="dialog"`, `aria-expanded`.
- Keyboard: as the dialog (Escape closes, Tab wraps when modal, focus in on open, back
  on close). The gesture adds **no** keys; every gesture result must also be reachable
  without it:
  - WCAG 2.5.1 Pointer Gestures (A): swipe-to-dismiss is a path-based gesture, so a
    single-pointer alternative is required (close trigger, backdrop press).
  - WCAG 2.5.7 Dragging Movements (AA): dragging between snap points needs a
    single-pointer, non-drag alternative (a press that changes the snap point).
  - WCAG 2.1.1 Keyboard (A): the same results by keyboard (Escape, close trigger,
    a focusable control that changes the snap point).

## How the others built it

### Zag / Ark UI

- Source: `zag/packages/machines/drawer/src/*`; Ark `Drawer.Root/RootProvider/Trigger/Backdrop/Positioner/Content/Title/Description/CloseTrigger/Grabber/GrabberIndicator/SwipeArea/Indent/IndentBackground/Stack`.
- State model: `closed | open | closing | swipe-area-dragging | swiping-open`
  (`drawer.machine.ts`). `closing` is its own state that waits for an `exitcomplete`
  DOM event; open-by-swipe from an edge `SwipeArea` adds two states. Context holds
  `dragOffset`, `snapPoint` (bindable), `resolvedActiveSnapPoint`, `contentSize`,
  `viewportSize`, `rootFontSize`, `swipeStrength`, `nestedMetrics`.
- Props: `swipeDirection: "up" | "down" | "start" | "end"` (default `down`, logical
  sides resolved with `dir`), `snapPoints` (default `[1]`), `snapPoint` /
  `defaultSnapPoint` / `onSnapPointChange`, `snapToSequentialPoints`,
  `swipeVelocityThreshold` (500 px/s in `props()`, docs say 700), `closeThreshold`
  (0.5 in `props()`, docs say 0.25), `preventDragOnScroll`, `modal`, `role`, the
  dialog dismiss props, multi-trigger `triggerValue`, an external `stack` store.
- Notable:
  - **Every pointermove is a machine event** (`POINTER_MOVE` → `setDragOffset`), and
    connect writes `--drawer-translate-*`, `--drawer-swipe-movement-*`,
    `--drawer-swipe-progress` as inline style from context, i.e. a re-render per
    frame.
  - `utils/session.ts` has the best-documented velocity code: 100 ms sliding window,
    samples older than 80 ms ignored at release, minimum gesture 50 ms, two samples
    minimum; mouse/pen drags are *deferred* until 6 px of main-axis movement that
    dominates cross-axis movement 1.35:1.
  - `drawer-session.ts` `canStartDrag`: exempt targets (`[data-no-drag]`, editable
    elements, `input[type=range|file]`), an active text selection inside the content,
    scroll-edge checks along the swipe axis summed over scrollable ancestors, and
    `shouldPreventTouchScroll` that claims the touchmove only at the scroll edge.
    Rubber-band: `delta → sqrt(delta)` past the open edge.
  - Snap points (`snap-point.ts`): number ≤ 1 = fraction of the viewport, > 1 = px,
    `"Npx"`/`"Nrem"` strings; clamped to `min(contentSize, viewportSize)`; deduplicated
    within 1 px. Release projects the offset by `0.4 × velocity` when velocity ≥ 400
    px/s; sequential mode advances one point on a ≥ 24 px drag.
  - Nested drawers through a module-global `drawerRegistry` (count in front, front
    height, swiping-after), exposed as `--nested-drawers`, `--drawer-frontmost-height`,
    `data-nested-drawer-open`, `data-nested-drawer-swiping`.
  - Touch tracked through `touch*` events (with `usingTouchEvents` de-dup), mouse/pen
    through pointer events on the document; `visibilitychange → hidden` and
    `lostpointercapture` cancel.
- Problems: the CHANGELOG is a list of controlled-mode and swipe-timing fixes —
  controlled drawers snapping back to open before the close animation (zag#3144),
  flicker with an async `open` setter (zag#3149), `--drawer-swipe-progress` jumping to
  1 at the start of a dismiss, freezing mid-drag when content mounts lazily,
  swipe-to-dismiss ignoring controlled `open` without `onOpenChange`; layer variables
  lost after a drag because connect replaced the style object (zag#3148, ark#3909);
  backdrop rendered over content (zag#3120).

### Base UI

- Source: `base-ui/packages/react/src/drawer/*`, `utils/useSwipeDismiss.ts` (1,126
  lines, **shared with Toast**).
- API: `Drawer.Root` is `useRenderDialogRoot('drawer', …)` — the Dialog store — plus a
  `DrawerRootContext` for swipe, snap points and nested metrics. Parts: `Provider`,
  `Indent`, `IndentBackground`, `Root`, `Trigger`, `Portal`, `Backdrop`, `Viewport`,
  `Popup`, `Content`, `Title`, `Description`, `Close`, `SwipeArea`,
  `VirtualKeyboardProvider`. Props: `swipeDirection` (`up|down|left|right`, default
  `down`), `snapPoints`, `snapPoint`/`defaultSnapPoint`/`onSnapPointChange`
  (cancelable details), `snapToSequentialPoints`, `modal: boolean | 'trap-focus'`,
  `disablePointerDismissal`. Close reasons include `swipe` and `close-watcher`.
- Notable:
  - Dismiss without snap points: velocity ≥ 0.5 px/ms toward the edge, or
    displacement > 50 % of the popup size (`max(size × 0.5, 10)`). With snap points:
    target = current offset + drag, projected by `velocity × 300 ms` (velocity
    clamped to 4 px/ms); closest point; dismiss if past the lowest one.
  - `useSwipeDismiss`: axis lock after 6 px with 2:1 bias, "change of mind" cancel when
    the pointer reverses 10 px, directional damping (`sign × |d|^0.5`) against
    disallowed directions, pointer capture, `buttons: 0` move treated as release,
    first-move rebaseline (iOS first `touchmove` arrives offset), velocity from
    timestamps with an age limit of 80 ms; ignores `button,a,input,select,textarea,
    label,[role=button]` for mouse (configurable for touch).
  - Movement written **imperatively** as `--drawer-swipe-movement-x/y` on the popup
    after base-ui#4863 showed re-rendering per frame lags on low-end Android.
  - `--drawer-swipe-strength` (0.1–1) scales the release transition duration so a
    fast flick finishes fast.
  - Initial focus defaults to the **popup itself** (`resolvedInitialFocus = popupRef`),
    not the first tabbable — a sheet opened by touch must not pop the keyboard.
  - Android back through `CloseWatcher` (Android only), honouring
    `event.cancelable === false` after the first prevented close.
  - `Indent` / `IndentBackground` read a `DrawerProvider` store (any drawer open,
    frontmost swipe progress and height) and write `--drawer-swipe-progress` /
    `--drawer-height` imperatively.
  - `VirtualKeyboardProvider` (909 lines): keyboard inset `--drawer-keyboard-inset`,
    pinning WebKit's reveal scroll, re-aligning the focused field over several frames.
- Problems: see Bug history — most closed within days, which makes it the best
  catalogue of what a drawer gets wrong (≈ 40 drawer issues in 2026 alone).

### Reka UI

- Source: `reka-ui/packages/core/src/Drawer/*` — a Vue port of Base UI's drawer
  (`useSwipeDismiss.ts` with the same constants: 40 px threshold, 10 px reverse cancel,
  6 px axis slop), `useDrawerSnapPoints.ts`, `useDrawerVirtualKeyboard.ts`. Reasons
  `swipe | escape-key | outside-press | trigger-press | close-press | …` with
  `cancel()`.
- Problems: the port surfaced gaps Base UI later fixed — no way to cancel a swipe
  dismissal (reka-ui#2933), the hard-coded ignore selector blocking most of the
  surface (reka-ui#2907), no axis locking on scrollable content (reka-ui#2876), the
  trigger unable to close (reka-ui#2872), keyboard avoidance missing (reka-ui#2877).

### Vaul

- Source: `vaul/src/index.tsx` (1,148 lines) on `@radix-ui/react-dialog`.
- API: `Drawer.Root` (`direction`, `snapPoints`, `activeSnapPoint`, `fadeFromIndex`,
  `closeThreshold` 0.25, `scrollLockTimeout`, `dismissible`, `handleOnly`, `modal`,
  `nested`, `shouldScaleBackground`, `repositionInputs`, `snapToSequentialPoint`,
  `fixed`), `Trigger`, `Portal`, `Overlay`, `Content`, `Handle`, `NestedRoot`, plus a
  `[data-vaul-drawer-wrapper]` element the consumer marks for background scaling.
- Notable (the lessons the newer libraries copied):
  - Dismiss on velocity > 0.4 px/ms or 25 % of the size; drag direction toward the
    open edge is damped (`dampenValue`).
  - `shouldDrag`: never on `select`, `[data-vaul-no-drag]`, highlighted text; not in
    the 500 ms after open (content may still be scrolling); not within
    `scrollLockTimeout` of a scroll inside the drawer; walks scrollable ancestors and
    refuses while one is not at its top.
  - Background scaling: `scale((innerWidth − 26) / innerWidth)`, border radius and a
    translate on the wrapper, proportional to drag progress; nested drawers scale the
    parent by 16 px.
  - `Handle`: tap cycles through snap points (double-tap and long-press cancel), with an
    `aria-hidden` 44 × 44 hit area — **not focusable**, so the snap point has no
    keyboard path.
  - Keyboard: `visualViewport` resize changes the drawer's `height`/`bottom`.
- Problems: body `position: fixed` (`use-position-fixed.ts`) jumps the page, breaks
  standalone PWAs and flashes overflowing content (vaul#435, #505, #455); body
  `pointer-events` and `react-remove-scroll` leftovers (vaul#656, #534); nested
  stacking driven from `onOpenChange` callbacks, so it breaks when controlled
  (vaul#540); focus trapped with `modal={false}` (vaul#497); many open scroll-vs-drag
  issues on iOS (vaul#153, #358, #495, #651).

### Reado

`Drawer.tsx` is **Ark's `Dialog`**, not Ark's drawer: a right-side panel
(`Dialog.Positioner className="fixed inset-y-0 right-0"`) with `aria-label`,
`lazyMount unmountOnExit`, controlled `open` / `onOpenChange(d.open)`, slide keyframes
on `.drawer-content[data-state]`. No gesture. Its test asserts: nothing rendered while
closed, a `dialog` named by `aria-label` while open, Escape requests close. It migrates
to `Drawer` with `side="right"` (gaining swipe for free) or stays a `Dialog`.

## Accessibility

Applies [accessibility.md](accessibility.md) (rules by number) and
[assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md) (causes by
letter). Everything listed for the dialog pattern in that note's §1.4 holds here and is
handled by the Dialog machine (title on open, description, Safari 26 focus regression,
hidden dismiss button only as a quirk).

- **The gesture is invisible to assistive technology.** Screen readers consume swipes
  for navigation (VoiceOver, TalkBack) and never produce pointer drags, so a drawer
  that can only be dismissed or resized by dragging is unusable for them (2.5.1, 2.5.7).
  Consequences: (1) a close path that is a press or a key always exists — close
  trigger, backdrop press when modal, Escape; (2) snap points change through a
  focusable Handle button (Vaul's `aria-hidden` handle is the anti-pattern); (3) the
  gesture fires no announcement and no state an AT user cannot reach otherwise.
- **A drawer with no press-based way out** (non-modal, or outside press disabled, with
  no close trigger rendered) traps touch screen-reader users exactly like a modal with
  no visible close button (AT note §1.4, AK#7310). A development warning is cheap: the
  parts register when mounted.
- **TalkBack/Android back**: without `CloseWatcher`, the system back gesture is a
  history back that leaves the page with the drawer open (Base UI ships CloseWatcher
  on Android for this reason; base-ui#5767 shows the cancel pitfall). Deferred with
  the Dialog (native-platform open question), recorded as a risk.
- **Visually hidden dismiss buttons** are not clicked by TalkBack on some devices
  (RA#3047, cause J) — never the only way out (overlay note rule 29).
- **Names.** The Handle, when it is a control, needs a name from `messages` ("Expand
  drawer" / "Collapse drawer" for the next snap point); when it is only a grab
  affordance it is decorative (`aria-hidden`, not focusable). The Indent parts are
  presentational wrappers of the page and carry no role.
- **Focus.** Dialog rules. Initial focus on a touch-opened drawer goes to the content
  (overlay rule, also Base UI's drawer default) so the virtual keyboard does not pop
  up. A swipe never moves focus; dismissal by swipe restores focus like any close.
- **Focus not obscured (2.4.11)**: on iOS the virtual keyboard covers the bottom of a
  sheet; the focused field must stay visible (base-ui#5596, #4301, reka-ui#2877). The
  drawer exposes the keyboard inset so the theme can keep content above it.
- **Reduced motion.** Following the finger is direct manipulation, not animation, and
  stays. Release animations, background scaling and nested-stack transitions use
  duration tokens that become 0 (accessibility.md §8): the drawer snaps instantly.
- **Forced colors.** The content needs a real border (`CanvasText`) because the shadow
  that separates a sheet from the page disappears; the Handle's grip must be a border
  or `currentColor` glyph, not a background.
- **Target size.** The Handle's visible grip is typically 4 × 32 px; its hit area must
  reach 24 × 24 (2.5.8) via `--rind-hit-area` (Vaul uses 44 × 44).
- **RTL.** `inline-start` / `inline-end` sides resolve with the direction
  (base-ui#4402 asks for logical values; Zag has `start`/`end`); a swipe toward the
  physical edge the drawer sits on dismisses it.
- **Native primitives** ([native-platform.md](native-platform.md)): no
  `<dialog>`/`popover` (dialog decision); `overscroll-behavior: contain` on the
  content (and the iOS `touchmove` policy of the scroll lock) stops scroll chaining;
  `visualViewport` gives the keyboard inset; `CloseWatcher` deferred.

## Bug history

Searched 2026-10-14 with `gh search issues` in mui/base-ui (`drawer`, `drawer swipe`,
`drawer snap`), chakra-ui/zag (`drawer`, `bottom sheet`), chakra-ui/ark (`drawer`),
unovue/reka-ui (`drawer`), emilkowalski/vaul (`scroll`, `iOS`, `snap points`,
`nested`, `scale background`) and, for completeness, radix-ui/primitives,
adobe/react-spectrum, huntabyte/bits-ui, kobaltedev/kobalte, tailwindlabs/headlessui
and ariakit/ariakit (no drawer of their own). About 220 hits, ~70 relevant, the rows
below read in full. **Spec** = a scenario in `openspec/changes/add-drawer`.

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| Base UI | [#5471](https://github.com/mui/base-ui/issues/5471) | With snap points, a mostly horizontal swipe plays the close animation but `onOpenChange` never fires; page dead behind an invisible drawer | Two directions allowed → no primary direction → release dismissed with `direction: undefined` | Fixed | A release with no attributed direction never dismisses (Spec) |
| Base UI | [#5837](https://github.com/mui/base-ui/issues/5837) | A flick snaps at 60 Hz but not at 120 Hz | Velocity divided by a 16 ms floor, halving 8.3 ms samples | Fixed | Velocity from timestamps, independent of input rate (Spec) |
| Base UI | [#4863](https://github.com/mui/base-ui/issues/4863) | Swipe lags on low-end Android | Movement styles set inside React → re-render per frame | Fixed (inline imperative vars) | Continuous movement as CSS vars from `core/dom`, never through the machine (Spec) |
| Base UI | [#5566](https://github.com/mui/base-ui/issues/5566) | Non-modal drawer at a low snap point can't be swiped up when the page scrolls | The page scroller counted as a scrollable ancestor of the target | Fixed | Only scrollers between the target and the drawer gate the gesture (Spec) |
| Vaul | [#651](https://github.com/emilkowalski/vaul/issues/651) | Drawer stuck when the page underneath is scrolled | `shouldDrag` walks every ancestor up to `html` | Open | Same (Spec) |
| Base UI | [#5843](https://github.com/mui/base-ui/issues/5843) | A drag starting on an SVG inside scrolled content swipes the drawer instead of scrolling | Scroll-ancestor walk started only from `HTMLElement` targets | Fixed | Walk from any element, SVG included (Spec) |
| Base UI | [#5255](https://github.com/mui/base-ui/issues/5255), [#4306](https://github.com/mui/base-ui/issues/4306) | Vertical scrolling inside a left/right drawer fails intermittently on iOS | `preventDefault` on the first cancelable `touchmove` before the axis was attributed cancels native scroll for the whole gesture | Fixed | Never claim a touchmove before axis lock (Spec) |
| Reka | [#2876](https://github.com/unovue/reka-ui/issues/2876) | Scrolling a side drawer's content moves the drawer sideways | No axis lock | Fixed | Axis lock (Spec) |
| Base UI | [#4380](https://github.com/mui/base-ui/issues/4380) | Portalled Select/Combobox lists inside a drawer can't be touch-scrolled | React portal events bubble to the drawer's touch handler; global touchmove then prevented | Fixed | A touch whose target is outside the swiped element's DOM is ignored (Spec) |
| Base UI | [#4294](https://github.com/mui/base-ui/issues/4294) | `div onClick` inside a drawer never fires on touch | Swipe tracking consumed every touch that wasn't on a button | Fixed | A touch that never passes the movement threshold leaves the click alone (Spec) |
| Reka | [#2907](https://github.com/unovue/reka-ui/issues/2907) | Most of the drawer surface can't be dragged | Hard-coded `button,a,input,…` ignore list, also for touch | Fixed | Touch swipes may start on buttons and links; only text entry, ranges, selections and an opt-out attribute block them (Spec) |
| Base UI | [#5359](https://github.com/mui/base-ui/issues/5359) | No swipe inside a shadow root | `elementFromPoint` stops at the shadow boundary | Fixed | Use the event's composed path (Spec) |
| Vaul | [#555](https://github.com/emilkowalski/vaul/issues/555) | Opening the iOS dock mid-drag leaves the drawer stuck between snap points | `pointercancel` not handled | Open | Cancel snaps back to the resting snap point (Spec) |
| Zag | [#3144](https://github.com/chakra-ui/zag/issues/3144), [#3149](https://github.com/chakra-ui/zag/issues/3149) | Controlled drawer jumps back open before the close animation; flickers with an async `open` setter | Release reset the offset before the parent applied the close | Fixed | A dismissing release holds its position until the parent applies or refuses (Spec) |
| Reka / Base UI | [RK#2933](https://github.com/unovue/reka-ui/issues/2933), [BU#5570](https://github.com/mui/base-ui/issues/5570) | Swipe dismissal can't be cancelled; cancelling the null snap point still starts the exit | Swipe decided outside the open-change path | Fixed | Swipe dismissal is an ordinary cancelable close request; a refused one snaps back with no exit styles (Spec) |
| Base UI | [#4541](https://github.com/mui/base-ui/issues/4541) (open) | No way to make a drawer non-dismissible by gesture while a nested drag runs | Missing prop | Open (workaround attribute) | `closeOnSwipe` and an opt-out attribute (Spec) |
| Zag / Ark | [ZG#3148](https://github.com/chakra-ui/zag/issues/3148), [ARK#3909](https://github.com/chakra-ui/ark/issues/3909) | `--layer-index` and height vars vanish from backdrop/content after a drag | Drag style writes replaced the style object | Fixed | The gesture writes only its own custom properties (Spec) |
| Base UI | [#4492](https://github.com/mui/base-ui/issues/4492) | A Dialog opened inside a Drawer increments `--nested-drawers` | Nested counting per dialog store | Fixed | Drawers count only drawers (stacking family) (Spec) |
| Vaul | [#245](https://github.com/emilkowalski/vaul/issues/245), [#589](https://github.com/emilkowalski/vaul/issues/589) | Pressing in a Dialog opened over a Drawer closes the drawer; double-clicking a nested drawer's overlay closes the outer dialog | Body pointer-events + separate dismiss stacks | Open / closed | One layer stack with parentage across Dialog and Drawer (Spec) |
| Vaul | [#540](https://github.com/emilkowalski/vaul/issues/540) | No stacking effect when nested drawers are controlled | Stacking applied from `onOpenChange` callbacks | Open | Nested metrics derive from the open layers, not callbacks (Spec) |
| Base UI | [#4201](https://github.com/mui/base-ui/issues/4201) | `--drawer-frontmost-height` smaller than the drawer → scrollbars during transitions | Measured without borders | Fixed | Sizes are border-box (Spec) |
| Base UI | [#5915](https://github.com/mui/base-ui/issues/5915) | Every unmounted drawer retained in memory | Provider kept closed drawers in a queued state update | Fixed | The registry only holds open drawers (Spec) |
| Base UI | [#4509](https://github.com/mui/base-ui/issues/4509) | `Indent` hydration mismatch in Next.js | Client-only inline var in the first render | Closed (not reproduced) | Indent renders identical markup on server and client; vars written after mount (Spec) |
| Vaul | [#616](https://github.com/emilkowalski/vaul/issues/616) | Unsorted snap points drag weirdly | Index arithmetic assumes ascending order | Open | Snap points ordered by resolved size (Spec) |
| Vaul | [#284](https://github.com/emilkowalski/vaul/issues/284) | Fractional snap points wrong after rotation | Viewport read once | Fixed | Re-resolve on viewport resize (Spec) |
| Vaul | [#333](https://github.com/emilkowalski/vaul/issues/333) | Fast flick always skips snap points | Velocity projection without opt-out | Fixed (`snapToSequentialPoint`) | `snapToSequentialPoints` (Spec) |
| Vaul | [#364](https://github.com/emilkowalski/vaul/issues/364) | Cycling snap points with the handle eventually freezes the drawer | Timers racing the cycle | Fixed | Handle press is one machine event, no timers (Spec) |
| Vaul | [#497](https://github.com/emilkowalski/vaul/issues/497) | Focus trapped with `modal={false}` | Radix focus scope stays trapped | Open | Non-modal drawers contain nothing (Dialog rule; Spec) |
| Vaul | [#435](https://github.com/emilkowalski/vaul/issues/435), [#505](https://github.com/emilkowalski/vaul/issues/505), [#455](https://github.com/emilkowalski/vaul/issues/455) | Page scrolls to top on open; PWA unusable; overflow flash on close (iOS) | `position: fixed` on `body` | Open | Overlay scroll lock never uses the fixed-body technique (already specified; cited) |
| Vaul | [#656](https://github.com/emilkowalski/vaul/issues/656), [#397](https://github.com/emilkowalski/vaul/issues/397), [#534](https://github.com/emilkowalski/vaul/issues/534) | Scroll lock never released; lock lost when switching drawers; body `pointer-events` stuck with non-modal | Per-instance body styles | Open | Stack-driven lock and no body `pointer-events` (overlay; Spec scenario for sibling drawers) |
| Ark | [#2974](https://github.com/chakra-ui/ark/issues/2974) | Dismissing a toast closes the open drawer | A press in the toast region counted as an outside press | Closed, not fixed | Toast region presses are not outside presses (owned by `add-toast`; mirrored here) |
| Base UI | [#5596](https://github.com/mui/base-ui/issues/5596), [#4301](https://github.com/mui/base-ui/issues/4301), [#5766](https://github.com/mui/base-ui/issues/5766); [RK#2877](https://github.com/unovue/reka-ui/issues/2877) | The iOS keyboard covers the focused field; content-sized drawer mispositioned when it opens | No / imperfect keyboard handling | Fixed after many rounds (909-line provider) | Expose the keyboard inset; full keyboard choreography deferred (Spec + Open question) |
| Base UI | [#5767](https://github.com/mui/base-ui/issues/5767) | After cancelling a CloseWatcher close, the next Back leaves the page | Watcher not re-created | Fixed | Recorded for the deferred CloseWatcher work |
| Reka | [#2872](https://github.com/unovue/reka-ui/issues/2872) | Trigger can't close an open (non-modal) drawer | Trigger always proposed `true` | Fixed | Trigger toggles a non-modal drawer (Dialog rule) |
| Vaul | [#358](https://github.com/emilkowalski/vaul/issues/358), [#153](https://github.com/emilkowalski/vaul/issues/153), [#495](https://github.com/emilkowalski/vaul/issues/495) | Drag after scrolling unreliable; can't drag to close after scrolling back up; overflow-y content never drags | Time windows and ancestor walks deciding drag vs scroll | Open | Decide per gesture at axis lock, from the scroll edge of scrollers inside the drawer (Spec) |

## Known pitfalls

- **Scroll vs drag arbitration** is where every library still ships bugs (iOS above
  all): only claim the gesture after axis lock, only when every scroller between the
  target and the drawer is at its edge in the swipe direction, never because of the
  page scroller, never on the first cancelable `touchmove` before attribution.
- **Per-frame work through the framework** (Zag's `POINTER_MOVE` events, Base UI before
  #4863) lags; style replacement during a drag drops other custom properties.
- **Controlled mode and the release**: the visual state (position at release, exit from
  there) must survive a parent that applies the close later or refuses it.
- **Direction attribution**: a release with no clear direction, or a reversal ("change
  of mind"), must not dismiss.
- **Nested drawers** counted per family, metrics derived from open layers, not from
  change callbacks.
- **iOS**: body `position: fixed` (never), the keyboard and `visualViewport`, `pointercancel`
  from system gestures (dock, Control Centre), touch events arriving offset from
  `touchstart`, rubber-band overscroll of inner scrollers.
- **Toast and third-party portals inside/over a drawer** must not count as outside.

## Testing notes

- jsdom has no layout: sizes, scroll edges and `visualViewport` are zero; the gesture
  module is unit-tested against plain DOM in browser mode, its arithmetic (velocity,
  axis lock, damping, snap resolution, dismiss decision) as pure functions in Node.
- The contract needs a **drag input** in both adapters (none exists in the foundations
  `Part`): mouse and touch drags with a duration, in steps, so velocity is
  deterministic. Testing Library: `user-event` pointer API plus `TouchEvent` dispatch
  with timestamps under fake timers; Playwright: `mouse.down/move/up`, and dispatched
  `TouchEvent`s for touch (Playwright has no touch-move API).
- Model-based tests cover the dismissing swipe through the contract; settling on a snap
  point (a guarded self-transition) is covered by machine unit tests and browser
  scenarios.
- Real iOS behaviour (keyboard, rubber band, dock `pointercancel`) is a manual device
  check; Playwright WebKit does not emulate iOS scrolling.
- Driver: everything the Dialog driver has, plus `swipe(direction, distance)`,
  `pressHandle()`, queries `snapPoint`, `side`, `isSwiping`.

## Decisions

- **Machine**: a preset of the Dialog machine (`buildDialogMachine`, kind `drawer`),
  states `closed | open` like the Dialog. Swiping is context, not a state: a separate
  `swiping` state would exit `open`, which cleans up and restarts the state-scoped
  overlay effect (layer release, focus restore), and the runtime has no hierarchical
  states (machine-runtime decision). Events added: `SWIPE.START`, `SWIPE` (release:
  `{ direction, offset, velocity, size }`), `SWIPE.CANCEL`, `HANDLE_PRESS`,
  `SNAP_POINT.SET`, `SIZE.CHANGE`, `NESTED.CHANGE`. `SWIPE` closes (reason `SWIPE`,
  kebab `swipe`) when the `swipeDismisses` guard passes, otherwise settles on a snap
  point. New controllable `snapPoint`.
- **Defaults**: `side: "bottom"`; dismiss when the release is toward the side's edge and
  the offset is ≥ 50 % of the size or velocity ≥ 0.5 px/ms (Base UI's tuned values;
  Zag 0.5, Vaul 0.25 / 0.4); snap target projected 300 ms ahead; `closeOnSwipe: true`.
- **Shared gesture module** `core/dom/swipe.ts` (`swipe-gesture` capability), specified
  here and reused by `add-toast` (Base UI shares one `useSwipeDismiss` the same way):
  axis lock, scroll arbitration, pointer capture, damping, input-rate-independent
  velocity, change-of-mind cancel, composed-path targets, continuous CSS custom
  properties, discrete callbacks only.
- **Parts**: Dialog's (`root`, `trigger`, `backdrop`, `positioner`, `content`, `title`,
  `description`, `close-trigger`) plus `handle`, `indent`, `indent-background`.
  `handle` is a button (snap points cycle on press) when snap points exist, otherwise a
  decorative grip. No `SwipeArea` (open by edge swipe) in v1.
- **`data-*`**: Dialog's, plus `data-side` (physical), `data-swiping`,
  `data-swipe-dismiss`, `data-expanded`, `data-snap-point` (index), and on the indent
  parts `data-active`. CSS variables: `--rind-drawer-swipe-x/y`,
  `--rind-drawer-swipe-progress` (gesture module), `--rind-drawer-snap-offset`,
  `--rind-drawer-size`, `--rind-drawer-frontmost-size`, `--rind-drawer-keyboard-inset`,
  plus the layer vars.
- **Contract**: Dialog's actions and queries, plus `swipe`, `pressHandle`, `snapPoint`,
  `side`, `isSwiping`; same traits. Locate by `dialog` role + name.
- **Deliberately different**: no per-frame machine events or renders (Zag); swipe
  dismissal through the ordinary cancelable close path (Reka, Base UI before #5570);
  focusable Handle for snap points (Vaul's is `aria-hidden`); nested metrics from the
  layer stack, not callbacks (Vaul); no `position: fixed` body (Vaul); no Provider part
  needed for the indent (Base UI) — the document's open drawers are the source.

## Open questions

- **Virtual keyboard**: is the exposed inset enough, or do we need Base UI's
  re-alignment of the focused field (WebKit reveal scroll pinning)? Decide after the
  iOS device check; it would be an additive capability, not a spec change.
- **Android back / `CloseWatcher`**: same open question as the Dialog
  (native-platform.md); a drawer is the strongest case for it.
- **Open by edge swipe (`SwipeArea`)**: deferred; it competes with OS edge gestures (iOS
  back, Android back) and adds open-gesture states.
