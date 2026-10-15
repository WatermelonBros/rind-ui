# Popover — research

Status: done · Wave: 1

A button that opens an anchored, positioned panel with arbitrary (often
interactive) content: settings, filters, a small form, a colour picker. Non-modal
by default, modal on request. Built entirely on shared infrastructure —
[overlay-infrastructure.md](overlay-infrastructure.md) (layer stack, dismiss,
focus, inert, scroll lock, presence, portal) and
[floating-positioning.md](floating-positioning.md) — so this note covers the
component and the one shared piece it introduces: **the logical Tab order of a
portalled non-modal layer** (also used by Hover Card; overlay infrastructure left it
to Popover, see its Non-goals).

Cross-cutting notes applied: [accessibility.md](accessibility.md) (rules cited by
number), [assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md)
(causes cited by letter), [native-platform.md](native-platform.md).

## Pattern

- WAI-ARIA APG pattern: **none for "popover"**. The closest are
  [Dialog (Modal)](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) for the
  modal mode (accessibility.md §1.5 maps "Popover (modal mode)" there) and the
  non-modal dialog semantics APG describes but does not ship (a `dialog` without
  `aria-modal`, outside stays operable). The [Disclosure](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/)
  pattern fits only when the panel is plain content in the DOM right after the
  button, which a portalled, positioned panel is not.
- Roles and attributes:
  - Content `role="dialog"`; `aria-modal="true"` only in modal mode.
  - Name: `aria-labelledby` → Title part while rendered; else consumer
    `aria-label`/`aria-labelledby`; `dialog` requires a name (rule 1).
  - `aria-describedby` → Description part while rendered.
  - Trigger: a button; `aria-haspopup="dialog"`, `aria-expanded`,
    `aria-controls` only while the content is mounted.
- Keyboard:
  - Enter / Space on the trigger toggles.
  - Escape closes the topmost layer; focus returns to the trigger.
  - Non-modal: Tab moves through the content in a logical position (right after
    the trigger), and leaving the content by Tab closes it.
  - Modal: Tab / Shift+Tab wrap inside the content (Dialog rules).

## How the others built it

### Zag / Ark UI

- Source: `zag/packages/machines/popover/src/{popover.machine,popover.connect,popover.dom,popover.types}.ts`; Ark `packages/react/src/components/popover/*`.
- Parts: `arrow`, `arrowTip`, `anchor`, `trigger`, `indicator`, `positioner`, `content`, `title`, `description`, `closeTrigger`.
- State: `closed | open`; events `OPEN`, `CLOSE`, `TOGGLE`, `CONTROLLED.OPEN/CLOSE`, `POSITIONING.SET`, `TRIGGER_VALUE.SET`. Props: `modal` (false), `autoFocus` (true), `closeOnInteractOutside` (true), `closeOnEscape` (true), `portalled` (true), `restoreFocus` (true), `initialFocusEl`, `finalFocusEl`, `persistentElements`, multiple triggers via `triggerValue`.
- Effects in `open`: `trapFocus`, `preventScroll`, `hideContentBelow` (`aria-hidden`), only when modal; `trackDismissableElement` (trigger excluded so pressing it toggles); `trackPositioning`; **`proxyTabFocus`** for portalled non-modal content — Tab from the trigger goes into the content and Tab out of the content returns to the element after the trigger.
- Notable: `setFinalFocus` is skipped when the outside interaction landed on a focusable element (`restoreFocus = !(event.detail.focusable || contextmenu)`); `checkRenderedElements` after a frame so `aria-labelledby` never dangles; trigger `aria-expanded` per trigger value.
- Problems: zag#2241 / ark#3287 a popover opened while another is open closes instantly; zag#1746, #1747, #1788 focus not returned on close-trigger / controlled / programmatic close (restore lived on one transition only); zag#2933 Dialog → Popover → Dialog: closing the inner dialog closes all three; ark#2610 stack-order nesting makes a dialog opened after an unrelated popover its child; ark#3492 `onOpenChange` twice for one outside click on a focusable element; ark#4182 title detection only at start, lazy-mounted content unlabelled; ark#1933 interactions inside portalled content counted as outside; ark#3548 portalled popover in a dialog not focusable.

### Radix (Reka is a line-by-line Vue port; Bits copies the shape)

- Source: `radix/packages/react/popover/src/popover.tsx` (665 lines); `reka-ui/packages/core/src/Popover`.
- Parts: `Root`, `Trigger`, `Anchor`, `Portal`, `Content`, `Close`, `Arrow`.
- State: `useControllableState`; `modal` (false). `Content` switches between `PopoverContentModal` (`hideOthers`, `RemoveScroll`, `FocusScope trapped`, `disableOutsidePointerEvents`) and `PopoverContentNonModal` (tracks `hasInteractedOutside` / `hasPointerDownOutside` so closing after an outside click does not steal focus back; ignores focus-outside right after a pointer down outside — Safari).
- Notable: cancelable `onOpenAutoFocus` / `onCloseAutoFocus`; `FocusScopeBranch` registry so portalled children of a modal popover are not reclaimed (#3909); `role="dialog"`, `aria-haspopup="dialog"`, `aria-controls` only while open.
- Problems: #4128 (open) `loop` hard-coded, so Tab can never leave a non-modal popover; #2942 clicking outside refocused the trigger; #518 focus not restored when content had an `autoFocus` input; #1159 (open) scrolling a popover inside a dialog; #3009 horizontal scroll broken with `modal`; #2815 nested popover in dialog unfocusable with two copies of focus-scope; #3349 trigger attributes "wrong" for a trapping popover (the real issue: no documented modality); #2248 (open) a tooltip on the first element opens by itself (autofocus); Reka #2803 popover with no tabbable content focuses its wrapper and dismisses itself as "focus outside"; Reka #2597 (open) `aria-controls` points at unmounted content; Reka #603 modal does not stop iOS scroll; Bits #1016 opening popover B does not close A; Bits #1213 trigger shows a focus ring after an outside click; Bits #913 re-focusing a trigger inside a dialog loops.

### React Aria / React Aria Components

- Source: `react-aria/src/overlays/{usePopover,useOverlayTrigger,useOverlay,useCloseOnScroll,ariaHideOutside,usePreventScroll,DismissButton}.ts(x)`; RAC `Popover.tsx`, `Dialog.tsx` (`DialogTrigger` + `Popover` + `Dialog`).
- API: `DialogTrigger` → `Popover` (`placement`, `offset`, `isNonModal`, `isKeyboardDismissDisabled`, `shouldCloseOnInteractOutside`) → `Dialog`.
- **Modal by default**: `ariaHideOutside([popover], { shouldUseInert: true })` + `usePreventScroll` unless `isNonModal`; `isDismissable: !isNonModal`. Non-modal popovers **close on scroll** of the trigger's ancestors (`useCloseOnScroll`). `DismissButton` (visually hidden) before and after content for touch screen readers.
- Notable: the only library where a default popover is modal; `FocusScope contain` for modal; restore to next tabbable if the trigger was removed.
- Problems: #9467 (open) non-modal popover closes on any scroll, including the browser's auto-scroll when the on-screen keyboard opens, forcing modal mode; #10610 restore frame ran before inert cleanup; #10661 (open) open-at-mount restores to `body`; #10662 two nested modal popovers opened in one commit both inert; #10002 (open) `role="dialog"` wrapped around a Menu; #9832 (open, not reproduced) NVDA reads the previous element on Escape; RA note #8998 (DismissButton confuses VO users).

### Base UI

- Source: `base-ui/packages/react/src/popover/{root,trigger,popup,positioner,close,title,description,backdrop,viewport}/*`, `floating-ui-react/components/FloatingFocusManager.tsx`, `utils/popups/*`.
- Parts: `Root`, `Trigger`, `Portal`, `Backdrop`, `Positioner`, `Popup`, `Arrow`, `Title`, `Description`, `Close`, `Viewport` (animated size between detached triggers).
- `modal: boolean | 'trap-focus'` (false); **focus is trapped only when a `Close` part exists** (`focusManagerModal = modal !== false && hasClosePart`) so keyboard users can always get out; `openOnHover` with `delay` 300 (a Hover Card in disguise); `initialFocus` per interaction type (touch → the popup itself); detached triggers with `handle` + `payload`.
- Notable: `onOpenChange(open, details)` with reasons; focus guards around the portal keep the logical tab order and close the popup on Tab out; `role="dialog"` always.
- Problems: #5715 Tab out of a non-modal popup with no focusable content and no other tabbable element → infinite recursion between focus guards; #5410 (open) interacting inside a same-origin iframe does not close a non-modal popover; #5408 Select/Popover in Dialog closed the Dialog (portal check); #5980 (open) deferred restore steals focus that moved elsewhere; #4466 (open) cannot close by clicking a `button` trigger; #5538 `openOnHover` does not open on keyboard focus and reopens after dismissal.

### Headless UI

- Source: `@headlessui-react/src/components/popover/{popover.tsx,popover-machine.ts}`.
- Parts: `Popover`, `PopoverButton`, `PopoverPanel` (`focus`, `portal`, `modal`, `anchor`), `PopoverBackdrop`, `PopoverGroup`, `CloseButton`.
- **No role on the panel** (a disclosure), closes when focus leaves the popover or its `PopoverGroup`; sentinels around portalled panels keep tab order; `modal` only locks scroll.
- Problems: #3231 panel closed while tabbing through it (v2 regression); #3332 nested popovers close one level per outside click (by design); #3853 (open) JAWS virtual cursor leaves a non-modal panel; #2713, #2885, #2842 the button stops toggling with custom components; #1694, #2583, #2862 trigger gets `:focus-visible` after a mouse close; #2856, #2951 shadow DOM outside click and Tab; #3002 (open) third-party picker in a modal cannot be closed.

### Ariakit

- Source: `ariakit-react-components/src/popover/{popover,popover-disclosure,popover-dismiss,popover-heading,popover-description}.tsx`, `portal/portal.tsx`.
- `Popover` extends `Dialog`: `modal` (false), `portal = modal`, `autoFocusOnShow` (true), **`preserveTabOrder`** (portal + non-modal): the portalled content behaves in the Tab sequence as if it were right after the disclosure.
- Problems: #6310 re-opened portalled popover did not focus when a hidden element came first; #7625 a reposition while open moved focus; #7632 / #7646 Escape on a combobox popover inside a dialog closed the dialog too; #3250 iframes do not hide popovers; #4036 combobox traps the VO cursor.

### Kobalte

- Source: `kobalte/packages/core/src/popover/*`.
- Radix/React Aria hybrid: `modal` (false), `preventScroll` defaulting to `modal`, `role="dialog"`, `CloseButton` with a localised "Dismiss" label (`popover.intl.ts`), aria-hidden outside when modal.
- Problems: #549 clicking an SVG outside did not close (target type check).

## Accessibility

- **Two semantics, one component.** Non-modal (default): `role="dialog"` without
  `aria-modal`; the rest of the page stays exposed and operable; screen-reader
  virtual cursors can leave the panel, which is correct for non-modal (HUI#3853,
  AT note §1.3 JAWS row). Modal: identical to Dialog — `aria-modal="true"`, outside
  `inert`, scroll lock, Tab wraps (overlay-infrastructure §3–§5).
- **Name** (rules 1, 5): Title part → consumer `aria-label(ledby)`. Without
  either, a non-modal popover falls back to `aria-labelledby` = the trigger (the
  trigger is not inert, so Chromium resolves it). In modal mode the trigger is
  inert and Chromium returns an empty name for `aria-labelledby` into an inert
  subtree (AT cause E, RA#9737), so a modal popover with no Title and no
  `aria-label` is a development error — the generic "name sources reachable"
  invariant fails it.
- **Focus on open** (rule 11; overlay §3): into the content after the first
  placement (floating-positioning "placed before focus"): `[data-autofocus]` →
  first tabbable → the content itself (`tabindex=-1`); opened by touch → the
  content. Same rule for modal and non-modal (Radix, Zag, Base UI, RA do this;
  Headless UI does not and its panel is then unreachable in portal mode).
- **Logical Tab order for non-modal portalled content** (rule 1.3.2 meaningful
  sequence, accessibility.md §4.3): Tab on the open trigger enters the content;
  Shift+Tab from the first tabbable returns to the trigger; Tab past the last
  tabbable goes to the element after the trigger and closes the popover
  (outside-focus). No sentinel elements: they upset axe (`aria-hidden-focus`)
  and VoiceOver (AT cause F) and caused BU#5715's recursion; key handling on the
  trigger and content does it instead. Open question from the AT note (Q2): does
  this keep the iOS VoiceOver swipe order sensible? Swiping is not Tab, so VO
  follows DOM order — portalled content at the end of `body`. It is a tier-1
  manual check (below); the spec does not depend on the answer.
- **Focus restore** (rule 13): on every close path (trigger, close trigger,
  Escape, controlled, programmatic) — zag#1746/#1747/#1788 — but only when focus
  is inside the popover or on `body`, so an outside click keeps focus where the
  user put it (RX#2942); modality preserved, so a mouse close leaves no ring on
  the trigger (BITS#1213, HUI#1694).
- **Escape** (rule 19) closes only the topmost layer: a select or tooltip inside
  the popover closes first.
- **Touch screen readers** cannot press Escape; a modal popover needs a visible
  `CloseTrigger` (AK#7310 reasoning; Base UI only traps focus when a Close part
  exists). Development warning when a modal popover renders no `CloseTrigger`;
  non-modal popovers are left by moving on.
- **Announcements**: none of its own; opening moves focus, which announces the
  dialog name. VO + Safari 26 did not follow `focus()` into new content (AT cause
  L, RA#9814; fixed in Safari 27) — tracked, not worked around.
- **Virtual activation** (cause A): the trigger opens on a bare `click` (press
  module); a virtual open moves focus like a keyboard open.
- **Forced colors / motion / RTL**: content and arrow are real elements (theme
  draws borders with `currentColor`); presence waits for running animations only;
  logical sides and `dir` on the positioner come from positioning.
- **Native platform** ([native-platform.md §2–§3](native-platform.md)):
  `popover="auto"` would give light dismiss, invoker `aria-expanded` and a tab
  order next to the invoker for free, but light dismiss competes with the layer
  stack and closes unrelated popovers, portals break DOM-ancestry nesting, Safari
  has no `source` before 26, and jsdom has none of it — **avoid**, as decided
  there; `commandfor` likewise. We copy the native behaviour model instead
  (tab order next to the invoker, focus back to the invoker).

## Bug history

Searched open and closed issues in the ten repositories (2026-10-14) with
`gh search issues` for "popover in:title", "popover focus", "popover modal",
"popover nested", "popover scroll" (≈ 450 hits, ≈ 250 unique, ≈ 45 read in full).
Generic overlay bugs already decided in overlay-infrastructure.md are only cited
when the popover case adds something. **Spec** = a scenario in
`openspec/changes/add-popover`.

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| Radix | [#4128](https://github.com/radix-ui/primitives/issues/4128) | Tab never leaves a non-modal popover | `loop` hard-coded on the focus scope | Open | Non-modal never wraps; Tab past the end leaves (Spec) |
| Headless UI | [#3231](https://github.com/tailwindlabs/headlessui/issues/3231) | Panel closes while tabbing inside it | Focus-out check ran against the wrong container after portalling | Fixed | Moving focus within the content (and its descendant layers) never dismisses (Spec) |
| Base UI | [#5715](https://github.com/mui/base-ui/issues/5715) | Tab out of an empty popup with nothing else tabbable: stack overflow | Focus guards are tabbable and find each other modulo the list | Fixed | No sentinels; when nothing follows the trigger, focus leaves to the browser (Spec) |
| Reka | [#2803](https://github.com/unovue/reka-ui/issues/2803) | Popover with no tabbable children closes on open | Fallback focused a wrapper that dismiss read as outside | Fixed | Fallback target is the content itself, which is inside (Spec) |
| Ariakit | [#6310](https://github.com/ariakit/ariakit/issues/6310) | Re-opened portalled popover not focused | First element was hidden | Fixed | First *tabbable*, never a hidden node (overlay infra; test) |
| Radix | [#518](https://github.com/radix-ui/primitives/issues/518) | Focus not restored when content has `autoFocus` input | Restore target read after the input stole focus | Fixed | Opener captured before content mounts (overlay infra; test) |
| Zag | [#1746](https://github.com/chakra-ui/zag/issues/1746), [#1747](https://github.com/chakra-ui/zag/issues/1747), [#1788](https://github.com/chakra-ui/zag/issues/1788) | No focus return for close trigger / controlled / programmatic close | Restore attached to one transition | Fixed | Restore runs on exit of `open`, whatever the reason (Spec) |
| Radix | [#2942](https://github.com/radix-ui/primitives/issues/2942) | Clicking outside steals focus back to the trigger | Unconditional restore | Fixed (non-modal) | Restore only if focus was inside or on body (overlay infra; Spec) |
| Ark | [#3492](https://github.com/chakra-ui/ark/issues/3492) | `onOpenChange` twice for one outside click on a button | Pointer-outside and focus-outside both closed | Fixed (abort signal) | One gesture, one close request (Spec) |
| Bits / Headless UI | [BITS#1213](https://github.com/huntabyte/bits-ui/issues/1213), [HUI#1694](https://github.com/tailwindlabs/headlessui/issues/1694), [HUI#2862](https://github.com/tailwindlabs/headlessui/issues/2862) | Trigger shows a focus ring after a mouse close | Restore did not preserve the pointer modality | Fixed | Restore through `focusSafely`, modality kept (Spec) |
| Zag / Ark | [ZG#2241](https://github.com/chakra-ui/zag/issues/2241), [ARK#3287](https://github.com/chakra-ui/ark/issues/3287) | Opening popover B while A is open: B closes instantly | B's opening click processed as an outside press for B | Fixed | A press that starts before registration is never outside (overlay infra); scenario with two triggers (Spec) |
| Bits | [#1016](https://github.com/huntabyte/bits-ui/issues/1016), [#784](https://github.com/huntabyte/bits-ui/issues/784) | Opening B leaves A open | B's trigger treated as inside A | Fixed | Another popover's trigger is outside A (Spec) |
| Headless UI / Base UI / Radix | [HUI#2713](https://github.com/tailwindlabs/headlessui/issues/2713), [BU#4466](https://github.com/mui/base-ui/issues/4466), [RX#3682](https://github.com/radix-ui/primitives/issues/3682) | Pressing the trigger of an open popover does not close it, or closes and reopens | Trigger press seen both as outside press and as toggle | Fixed / open | The trigger is inside for dismissal; its press toggles once (Spec) |
| Ark | [#2610](https://github.com/chakra-ui/ark/issues/2610) | Dialog opened after an unrelated popover is closed with it | Stack order treated as nesting | Closed (by design) | Explicit parentage: a layer opened from outside the popover is its sibling (Spec) |
| Zag | [#2933](https://github.com/chakra-ui/zag/issues/2933) | Dialog → Popover → Dialog: closing the last closes all | Restore/outside handling cascaded through the chain | Fixed | Closing a child layer leaves the popover and its parent open (Spec) |
| Base UI | [#5408](https://github.com/mui/base-ui/issues/5408) | Popover inside Dialog closes the Dialog | Portal check by DOM marker | Fixed | Inside by parentage (overlay infra) |
| Headless UI | [#3332](https://github.com/tailwindlabs/headlessui/issues/3332) | Outside click closes only the innermost nested popover | One level per press, by design | Closed | We cascade (overlay infra cascade rule); scenario (Spec) |
| React Aria | [#10662](https://github.com/adobe/react-spectrum/issues/10662) | Two nested modal popovers opened in one commit: both inert | Each hid the other's portal | Fixed | Outside hiding recomputed from the stack (overlay infra) |
| Radix / Zag | [RX#3046](https://github.com/radix-ui/primitives/issues/3046), [ZG#3042](https://github.com/chakra-ui/zag/issues/3042) | Modal popover with only radios: Tab escapes | One tab stop not handled | Fixed / open | Overlay infra single-stop rule |
| Radix / Reka | [RX#1159](https://github.com/radix-ui/primitives/issues/1159), [RX#3009](https://github.com/radix-ui/primitives/issues/3009), [RK#603](https://github.com/unovue/reka-ui/issues/603) | Scroll broken in popover inside dialog / horizontal scroll / iOS | Wheel/touch blocking library | Open / fixed | Scroll lock only for modal, from the stack (overlay infra) |
| React Aria | [#9467](https://github.com/adobe/react-spectrum/issues/9467) | Non-modal popover closes on any scroll, incl. keyboard auto-scroll | `useCloseOnScroll` | Open | Popover never closes on scroll; positioning keeps it attached (Spec) |
| Headless UI | [#3853](https://github.com/tailwindlabs/headlessui/issues/3853) | JAWS virtual cursor leaves a non-modal panel | Non-modal by design | Open (question) | Expected; document; `modal` for containment |
| Ark | [#4182](https://github.com/chakra-ui/ark/issues/4182) | Lazy-mounted content not labelled by its Title | Title presence checked once | Fixed | Labelling follows the parts rendered in each open (Spec) |
| Reka | [#2597](https://github.com/unovue/reka-ui/issues/2597) | `aria-controls` references unmounted content | Static id | Open | `aria-controls` only while mounted (Spec) |
| Radix | [#3349](https://github.com/radix-ui/primitives/issues/3349) | Trigger says "expandable" while focus is trapped | Modality undocumented on the trigger | Closed | Trigger attributes identical; modality visible via `aria-modal` + `data-modal` |
| Kobalte | [#549](https://github.com/kobaltedev/kobalte/issues/549) | Clicking an outside SVG does not close | `instanceof HTMLElement` target check | Fixed | Outside test on `Element` (overlay infra; test) |
| Bits | [#2160](https://github.com/huntabyte/bits-ui/issues/2160), [#2162](https://github.com/huntabyte/bits-ui/issues/2162) | Whole page unselectable after using a popover | Body `user-select` set for selection containment, not restored | Fixed | No body style mutation (no selection containment) |
| Ariakit | [#7625](https://github.com/ariakit/ariakit/issues/7625) | Repositioning while open moved focus | Focus tied to every placement | Fixed | Focus on the first placement only (positioning; test) |
| Base UI | [#4520](https://github.com/mui/base-ui/issues/4520), [#3259](https://github.com/mui/base-ui/issues/3259) | Opening scrolls the page to the top / changes scroll position (autofocused input) | Focus moved into the portalled popup before it was placed | Fixed | Initial focus waits for the first placement, `preventScroll` (Spec) |
| Base UI / Ariakit | [BU#5410](https://github.com/mui/base-ui/issues/5410), [AK#3250](https://github.com/ariakit/ariakit/issues/3250) | Interacting inside an iframe does not close a non-modal popover | No pointer events from the frame; focus moves with `relatedTarget = null` | Open / fixed | Known gap of the dismiss layer (Open questions) |
| Radix / Ark | [RX#2815](https://github.com/radix-ui/primitives/issues/2815), [ARK#3548](https://github.com/chakra-ui/ark/issues/3548) | Popover inside a dialog cannot take focus | Two focus-scope stacks / dialog trap reclaimed focus | Fixed | One stack per document, parentage (overlay infra) |

## Known pitfalls

- **Tab order of portalled content** — the biggest popover-specific class
  (RX#4128, HUI#3231, BU#5715, Ariakit's `preserveTabOrder`, Zag's
  `proxyTabFocus`): every library either traps by accident, loses the content at
  the end of the document, or adds sentinels that break elsewhere.
- **The trigger as an outside target** (toggle vs dismiss races: HUI#2713,
  RX#3682, ZG#2241, BITS#1016).
- **Focus restore coverage** — every close path, never after an outside click on
  something focusable, modality preserved.
- **Initial focus side effects** — the first focusable element of the content may
  be a tooltip trigger (RX#2248, ARK#2565); Tooltip handles it (focus moved by a
  layer does not open a tooltip, see tooltip.md).
- **Closing on scroll** (RA#9467) makes non-modal popovers unusable on mobile
  where the browser scrolls inputs into view.
- **Modal without a way out** on touch screen readers.
- **Iframes** — pointer events inside a frame never reach the host document.

## Testing notes

- Everything from overlay-infrastructure's testing notes applies (jsdom: no
  inert, no layout; browser mode for Tab order, inertness, scroll lock).
- The logical Tab order is browser-only behaviour; jsdom tests check that the key
  handlers move focus to the expected element (user-event `tab()` follows DOM order
  and does not know about it, so the driver presses Tab through the adapter's key
  input, which dispatches the keydown our handlers react to).
- Driver: located by the **trigger** (role `button` + name), because the content
  does not exist while closed. Actions await their effect: `open()` → content
  placed and focus inside; `close()` → `data-state="closed"`. Traits `layer`,
  `restores-focus`, `presence`, `anchored`; `modal` when the `modal` prop is set
  (the runner receives props).
- Model-based paths cover modal × non-modal, nested popover, popover in dialog,
  sibling popovers, and the virtual modality for every press.

## Decisions

### Parts

| Part | Element | Notes |
|---|---|---|
| `Root` | none | Provides the machine and the layer context. |
| `Trigger` | `button` | `aria-haspopup="dialog"`, `aria-expanded`, `aria-controls` while mounted. One trigger per root (multiple triggers deferred). |
| `Anchor` | `div` | Optional; positions against it instead of the trigger. |
| `Indicator` | `span` | Optional, `aria-hidden`, carries `data-state` (Ark's chevron hook). |
| `Portal` | generic | Shared adapter part (overlay infra). |
| `Positioner` | `div` | Floating-positioning part. |
| `Content` | `div` | `role="dialog"`, `tabindex=-1`, `aria-modal` when modal, labelling. |
| `Arrow` | `div` | Floating-positioning arrow; `aria-hidden`. |
| `Title` | `h2` | `aria-labelledby` only while rendered. |
| `Description` | `p` | `aria-describedby` only while rendered. |
| `CloseTrigger` | `button` | Name from content or `messages.close`. |

Ark naming (Reado migrates from Ark), same as Dialog.

### Machine

Two states, like Dialog; presence is the shared presence machine.

```ts
type PopoverCloseReason =
  | "trigger" | "close-trigger" | "escape-key" | "outside-press" | "outside-focus"
  | "parent-dismissed" | "api"
type PopoverEvent =
  | { type: "OPEN"; modality: Modality }
  | { type: "CLOSE"; reason: PopoverCloseReason }
  | { type: "TOGGLE"; modality: Modality }
  | { type: "POSITION.PLACED"; side: Side; align: Align; anchorHidden: boolean; first: boolean }
  | { type: "POSITION.REPOSITION" }
  | { type: "PARTS_CHANGED"; title: boolean; description: boolean; closeTrigger: boolean }
states: closed → open (OPEN, TOGGLE), open → closed (CLOSE, TOGGLE)
open.effects: overlay (layer + dismiss + containment when modal), trackPosition, nonModalTabOrder (non-modal only)
open.on["POSITION.PLACED" first]: focusInitial
```

- `open` / `defaultOpen` / `onOpenChange(open, details)` (controllable; reason =
  the close reason or `"trigger"` for opening).
- `modal` (false). Modal ⇒ the overlay effect registers a modal layer (inert
  outside, scroll lock, Tab wrap); non-modal ⇒ layer + dismiss + logical Tab order.
- `closeOnEscape` (true), `closeOnInteractOutside` (true), `persistentElements`
  (inside for dismissal), `initialFocus`, `finalFocus` (overlay infra semantics),
  `positioning` (preset `popup`: bottom/center, `sideOffset` 8).
- Never closes on scroll.

### `data-*`

- All parts: `data-scope="popover"`, `data-part`.
- Trigger, Indicator, Positioner, Content: `data-state="open|closed"`.
- Positioner, Content: `data-side`, `data-align`, `data-placing`, `data-anchor-hidden`
  (positioning); Content also `data-modal`, `data-nested`, `data-has-nested`,
  `--layer-index`, `--nested-layer-count`, `data-close-reason`.
- Arrow: `data-side`, `data-uncentered`.
- Trigger, CloseTrigger: press and focus attributes from a11y foundations
  (`data-pressed`, `data-focus`, `data-focus-visible`).

### Contract

`popoverContract`: locate the trigger by role `button` + name. Actions `open`,
`close`, `toggle`, `closeWithButton`, `pressEscape`, `pressOutside`, `tab`,
`shiftTab`, `waitForUnmount`; queries `isOpen`, `isModal`, `title`, `description`,
`hasFocus`, `isTopmost`, plus the positioning fragment (`side`, `align`,
`isAnchorHidden`, `isPlaced`). Traits `layer`, `restores-focus`, `presence`,
`anchored`, and `modal` when the `modal` prop is true.

### Deliberately different from the others, and why

1. **Logical Tab order without sentinels** as a reusable capability
   (`non-modal-tab-order`), specified here and used by Hover Card — Ariakit's
   `preserveTabOrder` behaviour, without its focus-trap elements.
2. **Non-modal by default** (8 of 9 libraries; React Aria is the outlier), and
   non-modal never closes on scroll (RA#9467).
3. **Name fallback to the trigger for non-modal; error for unnamed modal**, so
   the generic name invariants hold without copying text.
4. **Dev warning for a modal popover without `CloseTrigger`** instead of Base
   UI's "trap only if there is a Close part" — trapping must not depend on
   markup, but the author must hear about the touch screen-reader exit.
5. **No `openOnHover`** — that is Hover Card (Base UI's option duplicates it).

## Open questions

- iOS VoiceOver swipe order for portalled non-modal content (AT note Q2): manual
  tier-1 check in this change; if VO reaches the content only at the end of the
  page, the fix is a portal-target option (render inline after the trigger), not
  a spec change.
- Iframe interactions (BU#5410): the dismiss layer could treat
  `document.activeElement` becoming an `<iframe>` outside every layer as outside
  focus. That is an `add-overlay-infrastructure` decision; until then documented
  as a limitation.
- Multiple triggers per popover (Zag `triggerValue`, Base UI detached triggers):
  additive later (`value` on `Trigger`), decided with Dialog's multi-trigger work.
