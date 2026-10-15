# Overlay infrastructure — research

Status: done · Wave: 1 (built with Dialog; see [0002](../decisions/0002-architecture.md#build-order))

Covers the `core/dom` pieces every overlay needs: **layer stack**, **dismiss**
(Escape, outside pointer, outside focus), **focus trap**, **focus restore**,
**outside inert / aria-hidden**, **scroll lock**, **presence** (exit animations),
**portal**. Dialog, Alert Dialog, Drawer, Popover, Menu, Select, Combobox, Tooltip,
Hover Card and Toast consume them. Component-level decisions live in
[dialog.md](dialog.md).

Sources read (local shallow clones; paths relative to each repo):

| Library | Files |
|---|---|
| Zag | `packages/utilities/dismissable/src/{dismissable-layer,layer-stack,pointer-event-outside,escape-keydown}.ts`, `utilities/interact-outside/src/index.ts`, `utilities/focus-trap/src/focus-trap.ts` (port of `focus-trap`), `utilities/remove-scroll/src/index.ts`, `utilities/aria-hidden/src/{aria-hidden,walk-tree-outside,index}.ts`, `machines/presence/src/presence.machine.ts` |
| Radix | `packages/react/{dismissable-layer,focus-scope,focus-guards,presence,portal}/src/*.tsx`, `dialog/src/dialog.tsx` (uses `react-remove-scroll` and `hideOthers`) |
| React Aria | `packages/react-aria/src/overlays/{useOverlay,useModalOverlay,usePreventScroll,ariaHideOutside,Overlay}.ts(x)`, `focus/FocusScope.tsx`, `utils/animation.ts` (fetched from `main`; the local clone is a sparse checkout without `packages/react-aria`) |
| Base UI | `packages/react/src/floating-ui-react/{hooks/useDismiss.ts,components/FloatingFocusManager.tsx,utils/markOthers.ts}`, `packages/utils/src/useScrollLock.ts`, `packages/react/src/internals/{useAnimationsFinished,useTransitionStatus}.ts`, `utils/InternalBackdrop.tsx` |
| Headless UI | `packages/@headlessui-react/src/hooks/{use-inert-others,use-is-top-layer,use-escape,use-outside-click,use-scroll-lock,use-transition}.ts(x)`, `hooks/document-overflow/*` |
| Ariakit | `packages/ariakit-react-components/src/dialog/{dialog.tsx,utils/*}` (tree marking, `disable-tree`, `use-prevent-body-scroll`) |
| Bits UI | `src/lib/bits/utilities/{dismissible-layer,escape-layer,focus-scope,scroll-lock,presence-layer}` |
| Kobalte | `packages/core/src/{dismissable-layer/layer-stack.tsx,primitives/create-focus-scope,primitives/create-hide-outside}`; scroll lock and presence come from `solid-prevent-scroll` / `solid-presence` (Corvu) |
| Reka UI | Vue port of Radix (`packages/core/src/{DismissableLayer,FocusScope,shared/useBodyScrollLock.ts}`) |

## 1. Layer stack

Every library keeps a module-global stack of open layers; the stack is what makes
"Escape closes only the topmost" and "clicking in a nested Select does not close
the Dialog" work.

| Library | Stack(s) | How "nested" is decided |
|---|---|---|
| Zag | `layerStack.layers` + `branches` (`layer-stack.ts`); separate `trapStack` in focus-trap; `lockMap` in remove-scroll; WeakMap counters in aria-hidden | **Stack order**: every layer above me is nested (`getNestedLayers` = `slice(index + 1)`). Writes `--layer-index`, `--nested-layer-count`, `data-nested`, `data-has-nested` on the node and its `layerStyleTargets` (backdrop, positioner). |
| Radix | React context with `layers`, `layersWithOutsidePointerEventsDisabled`, `branches`, `dismissableSurfaces` sets; separate `focusScopesStack`; react-remove-scroll's own stack; `hideOthers` counters | **React tree** (`onPointerDownCapture` sets `isPointerInsideReactTreeRef` — portalled children count as inside because React events bubble through portals). Newer code adds a `FocusScopeBranchRegistry` so portalled non-modal children are scroll shards and focus branches (#3423). |
| React Aria | `visibleOverlays` array (`useOverlay.ts`), separate `focusScopeTree` (React tree), `observerStack` in `ariaHideOutside` | Topmost = last in `visibleOverlays`; FocusScope parentage from React context. |
| Base UI | Floating tree (`FloatingTree`) + per-dialog nested counts passed up via `onNestedDialogOpen` | React tree (floating-ui parent/child nodes). |
| Headless UI | `stackMachines` keyed by scope (`use-is-top-layer.ts`) | Mount order within a scope. |

**Pitfalls**

- Stack order ≠ nesting. Two *sibling* dialogs (one opened from a toast, one from
  the page) are not parent/child, yet Zag treats the later one as nested. Base UI
  had to special-case "multiple modal dialogs that aren't nested in the React tree"
  (`useDialogRoot.ts`, mui/base-ui#1320); Radix had sibling-dialog pointer-events
  breakage (#3648).
- Duplicate registration under React Strict Mode corrupts nested metadata (Zag
  made `add` idempotent per node, `layer-stack.ts`; ark#3842 "scroll-lock and
  pointer-events not restored after conditional Dialog unmount in StrictMode").
- Removing a layer must happen at **close**, not at unmount after the exit
  animation — otherwise the closing layer is still "topmost" and swallows the next
  Escape / outside click, or the click dismisses the dialog beneath it
  (react-spectrum#10291 "closing overlay dismisses the one beneath it during its
  exit animation"; zag#3207 stacked exit animation hidden by z-index reset).
- Removing a parent must dismiss its children (Zag `remove` → `dismiss` nested,
  with a cancellable `layer:request-dismiss` event).
- Focus races while a child closes: Zag keeps `recentlyRemoved` for two frames so
  the parent's deferred `focusin` handler does not see "focus outside" and close
  too. Radix fixed the same for deferred pointer dismissal (#3971, #3461) and for
  controlled parents (#4035).

**Decision for `core/dom`** — one `LayerStack` per document; everything else
(dismiss, trap, inert, scroll lock) *reads* it instead of keeping its own stack.

```ts
// core/dom/layer-stack.ts
export type LayerId = string & { readonly __brand: "LayerId" }
export type LayerKind = "dialog" | "alertdialog" | "drawer" | "popover" | "menu" | "listbox" | "tooltip"

export interface LayerOptions {
  readonly kind: LayerKind
  readonly modal: boolean                 // blocks outside interaction (drives inert + scroll lock)
  readonly parent?: LayerId | undefined   // explicit nesting; adapters pass it from context
  readonly elements: () => readonly Element[] // content + backdrop + positioner (all "inside")
}

export interface LayerHandle {
  readonly id: LayerId
  isTopmost(): boolean
  contains(target: EventTarget | null): boolean // self or any descendant layer
  release(): void                               // idempotent; dismisses descendants first
}

export interface LayerStack {
  push(options: LayerOptions): LayerHandle
  topmost(): LayerHandle | undefined
  topmostModal(): LayerHandle | undefined
  subscribe(fn: () => void): () => void         // trap / inert / scroll-lock recompute on change
}

export function getLayerStack(doc: Document): LayerStack
```

- Nesting is **explicit** (`parent`), with DOM containment as a second signal. A
  layer with no parent is a root; siblings never count as nested.
- `release()` is called by the dialog machine on **close**, not on unmount.
- `push` is idempotent per `id` (Strict Mode).
- Stack metadata for styling (`data-nested`, `data-has-nested`, `--layer-index`,
  `--nested-layer-count`, as Zag) is computed in **connect** from a query on the
  stack, not written to the DOM by `core/dom` — connect owns every `data-*`.

## 2. Dismiss: Escape, outside pointer, outside focus

### How each library does it

- **Zag** (`dismissable-layer.ts`): document `keydown` **capture**, only
  `isTopMost(node)`, skips `isComposing`. Outside pointer on `pointerdown`
  (capture, attached after `setTimeout(0)` so the opening click does not close),
  but for **touch** waits for `click` (`interact-outside/src/index.ts`). Ignores
  disconnected targets, scrollbar clicks (`isEventWithinScrollbar`), points within
  the node's rect (password-manager overlays), `aria-controls`-linked elements,
  `exclude`/`persistentElements`, and iframes (listens on parent window and
  frames). `focusin` outside is ignored while a pointer is down (Safari doesn't
  focus buttons on click). Modal → `pointerBlocking` → `body.style.pointerEvents =
  "none"` with a `data-inert` marker and a `MutationObserver` re-applying
  `pointer-events: auto` on layers.
- **Radix** (`dismissable-layer.tsx`): keydown capture on the topmost layer only,
  skips `isComposing || keyCode === 229` (IME on Safari arrives *after*
  `compositionend`). `pointerdown` outside, deferred to `click` on touch (#2055).
  Inside = React tree. Modal: body `pointer-events: none` + the layer re-enabled
  with `pointer-events: auto`. Dialog ignores right/ctrl-click outside
  (`dialog.tsx`).
- **React Aria** (`useOverlay.ts`): Escape via `onKeyDown` **on the overlay**
  (React bubbling) — so Escape only works while focus is inside. Outside
  interaction = pointerdown *start* + pointerup *end* both outside
  (`useInteractOutside`), topmost only. Blur-outside ignores `relatedTarget ===
  null` (VoiceOver/Chrome, react-spectrum#4130, #4922).
- **Base UI** (`useDismiss`): `outsidePressEvent` = `'intentional'` (needs
  down+up outside: click) when there's a backdrop, `'sloppy'` (pointerdown)
  otherwise; ignores non-primary buttons and multi-touch; modal dialogs close only
  when the press is on *their own* backdrop (#1320). Pointer blocking is an
  invisible full-viewport `InternalBackdrop` (`utils/InternalBackdrop.tsx`), **not**
  body pointer-events.
- **Bits UI**: outside interaction fires on `pointerup`; per-layer
  `escapeKeydownBehavior` / `interactOutsideBehavior` =
  `"close" | "defer-otherwise-close" | "defer-otherwise-ignore" | "ignore"`
  (`escape-layer/types.ts`) — explicit delegation to the parent layer.
- **Ariakit** (`dialog.tsx`): marks the tree present at open time; only elements
  *marked as outside* dismiss on interaction, so nodes injected later (third-party
  widgets, extensions) neither dismiss nor are blocked.

### Pitfalls (cross-library)

- **The `pointer-events: none` on `<body>` class of bugs** (Radix, Kobalte, Zag):
  the original value is captured in one module variable, so overlapping layers
  restore the wrong value and leave the page dead. radix#1241 (remains after
  closing), #3317 (dialog opened from a DropdownMenu item freezes the UI), #1836
  (Dialog.Trigger inside Dropdown.Item), #3648 (sibling dialogs), #3645
  (disabled-set not updated during exit animation), #2122 (conflicts with
  third-party modals). Radix's own test suite now asserts `body.style.pointerEvents
  === ''` after close (`dialog.test.tsx`).
- Opening click closing the overlay immediately (every library defers
  registration: `setTimeout(0)` / rAF).
- Ghost clicks on touch: dismissing on `pointerdown` lets the following `click`
  land on the element underneath (radix#1658, react-spectrum#1513). Wait for
  `click`/`pointerup`.
- Text selection that starts inside and ends outside must not dismiss (React
  Aria's start/end pair, Base UI "intentional").
- Scrollbar clicks dismiss (ark#2925).
- Escape deferred a frame left dialogs undismissable while visible (zag#3248).
- IME: Escape during composition belongs to the IME (`isComposing`,
  `keyCode 229`).
- `stopPropagation` from consumer handlers on the backdrop broke dismissal
  (radix#3346 → "dismiss surfaces").
- Focus moving to `null` (tab switch, VoiceOver) must not count as "focus
  outside".

### Decision for `core/dom`

```ts
// core/dom/dismiss.ts
export type DismissReason = "escape-key" | "outside-pointer" | "outside-focus" | "parent-dismissed"

export interface DismissEvent {
  readonly reason: DismissReason
  readonly originalEvent: Event | undefined
  readonly target: Element | null
  preventDefault(): void            // consumer veto (onEscapeKeyDown / onInteractOutside)
  readonly defaultPrevented: boolean
}

export interface DismissOptions {
  readonly layer: LayerHandle
  readonly onDismiss: (event: DismissEvent) => void   // machine sends CLOSE { reason }
  readonly closeOnEscape?: boolean
  readonly closeOnOutsidePointer?: boolean
  readonly closeOnOutsideFocus?: boolean
  readonly isInside?: (target: Element) => boolean     // persistent elements, triggers
}

export function trackDismiss(options: DismissOptions): () => void
```

- **One** document-level `keydown` listener per document (installed by the stack),
  routed to `topmost()` only. Bubble phase, skipped when `event.defaultPrevented`
  — an inner widget that uses Escape (search input, a non-rind combobox) can
  consume it by calling `preventDefault()`. Skips `isComposing || keyCode === 229`.
- Outside pointer = **pointerdown and pointerup both outside**, fired on
  `pointerup` (`click` for touch). Primary button only, single touch, not on a
  scrollbar, target connected. "Outside" = not in `layer.contains()` and not in
  `isInside`. A modal layer only dismisses when the target is its own backdrop /
  positioner or a non-inert node (siblings of other modals are inert anyway).
- Outside focus: ignore `relatedTarget === null` and focus that lands in a
  descendant layer; ignore during an active pointer gesture.
- No registration delay: a press counts only if its `pointerdown` happened
  **after** the layer was registered, which handles the opening click without a
  timer (deferred registration lost early outside clicks in bits-ui#2141 and
  Escape in zag#3248).
- Pointer tracking runs in the **capture** phase on the document so consumer
  `stopPropagation()` cannot break it (radix#2782).
- Nodes inserted after the topmost modal opened (extensions, password managers,
  third-party portals) are never "outside" (see §4).
- One press dismisses a cascade: from the topmost layer down, every layer that does
  not contain the target, stopping at the containing layer, a veto or a modal
  layer; a modal is dismissed only if it was topmost when the press started
  (radix#4035).
- A press landing on a released-but-exiting layer is not outside for the layers
  beneath (`stack.isExitingAt(x, y)`; the exiting content is inert, so hit-testing
  falls through to it — react-spectrum#10291).
- **No `pointer-events` on `<body>`, ever.** Pointer blocking for modals comes from
  `inert` (§4) plus the backdrop. This removes the most-reported bug class in Radix.

## 3. Focus trap and focus restore

### How each library does it

- **Zag** (`focus-trap.ts`, 932 lines, refactor of `focus-trap`): shared
  `trapStack` (activating one pauses the previous), `keydown` Tab wrapping using
  tabbable groups, `focusin` redirect, `MutationObserver` to re-check when the
  focused node is removed, `delayInitialFocus`, shadow-DOM aware
  (`getShadowRoot: true`). Return focus: `finalFocusEl` → active trigger → first
  trigger → previously focused (`dialog.machine.ts` `setReturnFocus`).
- **Radix** (`focus-scope.tsx` + `focus-guards.tsx`): `focusin`/`focusout` on
  document; `focusout` with `relatedTarget === null` ignored; MutationObserver
  refocuses container when the focused node is removed; Tab wrapping on edges
  (`loop`); auto-focus on mount/unmount via **cancelable custom events**
  (`focusScope.autoFocusOnMount` → `onOpenAutoFocus` / `onCloseAutoFocus`
  `preventDefault()`); unmount focus restore in `setTimeout(0)`. Global focus
  guards (two `tabindex=0` spans at body edges) so focus events fire
  consistently (#2812 reflow cost).
- **React Aria** (`FocusScope.tsx`): a *tree* of scopes mirroring the React tree;
  `activeScope`; Tab handled with a `TreeWalker` over tabbables; restore focus to
  `nodeToRestore`, and if it was removed, to the next tabbable after it
  (react-spectrum#2444, #874). `useDialog` focuses the **dialog container**, then
  blurs/refocuses after 500 ms because iOS VoiceOver doesn't announce otherwise.
- **Base UI** (`FloatingFocusManager.tsx`): focus guards around the portal,
  `previouslyFocusedElements` as a bounded list of `WeakRef`s (falls back to the
  last *connected* one when the trigger is gone); `initialFocus` may be a function
  of the **interaction type** (touch → focus the popup to avoid the virtual
  keyboard); `returnFocus` may be a function of the close type.
- **Headless UI**: `FocusTrap` with bit flags (`InitialFocus`, `TabLock`,
  `FocusLock`, `RestoreFocus`, `AutoFocus` → `[data-autofocus]`).
- **Ariakit**: `autoFocusOnShow/Hide` callbacks, `initialFocus`, `finalFocus`;
  closing dialog made `inert` during its exit animation (`disableTree`, so focus
  can't stay in it).

### Pitfalls

- Trap active while the dialog animates out — focus jumps back in. Radix passes
  `trapFocus={context.open}` ("closed !== unmounted"); Ariakit inerts the exiting
  tree.
- Restoring focus to a trigger that no longer exists (dialog opened from a menu
  item) → focus lost to `<body>` (react-spectrum#2444). Need a fallback chain.
- Non-modal: restoring focus to the trigger after the user clicked elsewhere
  steals focus (Radix `hasInteractedOutsideRef`).
- Escape hatch for third-party widgets that render outside (date pickers, Google
  Input Tools: radix#1859, #3145).
- Shadow DOM (radix#3353 open; react-spectrum#1472).
- Firefox recursion when two traps fight (radix#2390).
- `initialFocusEl` returning `false` must mean "don't move focus" (zag#3346).
- iOS VoiceOver not announcing the dialog / title (radix#3348 open, React Aria's
  500 ms refocus hack).

### Decision for `core/dom`

Because modal layers make the outside `inert` (§4), the outside cannot receive
focus at all; the trap only has to **wrap Tab** at the edges and **recover** when
the focused node is removed. That is far less code than Zag's 932-line port.

```ts
// core/dom/focus-trap.ts
export interface FocusTrapOptions {
  readonly layer: LayerHandle              // active only while layer is the topmost modal
  readonly container: () => HTMLElement | null
}
export function trapFocus(options: FocusTrapOptions): () => void

// core/dom/focus-restore.ts
export type FocusTarget = HTMLElement | null | false  // false = do not move focus

export function focusInitial(container: HTMLElement, pick?: () => FocusTarget): void
// default: [data-autofocus] → first tabbable → container (tabindex=-1); preventScroll: true

export interface FocusReturn { restore(pick?: () => FocusTarget): void }
export function captureFocus(doc: Document): FocusReturn
// remembers activeElement + a bounded WeakRef history; restore() picks:
// pick() → captured element if connected and not inert → latest connected history entry → nothing
```

- Tab wrap via one `keydown` handler (no global focus-guard spans, no reflow at
  mount). Shift+Tab from the container itself goes to the last tabbable. The
  sequential order honours positive `tabindex`, counts a radio group as one stop
  (zag#3042) and includes keyboard-focusable scrollers (react-spectrum#10395);
  every programmatic focus uses `preventScroll` (headlessui#1787, bits-ui#2117).
- Initial focus does nothing if focus already moved after open (ariakit#7033).
- Resuming a paused trap never moves focus (zag#1718); recovery triggers only when
  the last focused element is disconnected, not when `activeElement` reads `body`
  (react-spectrum#7471, TalkBack).
- Restore runs after inert is removed (react-spectrum#10610), only when focus is
  inside the closing layer or on `body`; the opener is a candidate even if it was
  never focused (open at mount, react-spectrum#10661).
- Paused automatically when another modal layer is pushed above (reads stack).
- `MutationObserver` on the container: if the focused node is removed, focus the
  container.
- Initial focus happens **after** the node is connected, in the next frame, with
  `preventScroll: true`; touch-opened dialogs focus the container by default (Base
  UI's rule, keeps the keyboard closed).
- Focus restore happens at **close**, not at unmount; non-modal skips restore when
  the close was an outside pointer interaction.

## 4. Hiding the outside: `inert` / `aria-hidden`

### How each library does it

- **Zag**: `ariaHidden` → `hideOthers` (fork of theKashey/aria-hidden, rAF
  deferred). Walks from body to the targets, sets `aria-hidden` on every sibling
  of the path, ref-counted per element, follows `aria-controls`, skips `script`,
  `[aria-live]`, `[role=status]`, `[data-live-announcer]`. `inertOthers` /
  `suppressOthers` exist (`aria-hidden.ts`) but the dialog uses `aria-hidden`
  plus body `pointer-events`.
- **Radix**: `hideOthers` (aria-hidden) from content; never `inert`.
- **React Aria** (`ariaHideOutside.ts`): `shouldUseInert: true` for modals
  (`useModalOverlay`). Ref-counted; a `MutationObserver` hides nodes **added after
  open**; skips `[data-live-announcer]` and `[data-react-aria-top-layer]`
  (toasts); `keepVisible()` lets an entering child modal stay visible; observer
  stack so only the top modal observes. Deliberately **no `aria-modal`** (WebKit
  bug 211934: Safari in iframes focuses the first focusable on mount).
- **Base UI**: `markOthers(insideElements, { ariaHidden: modal })`.
- **Headless UI**: `useInertOthers` (inert).
- **Ariakit**: tree snapshot at open (`markTreeOutside` /
  `markAndDisableTreeOutside`), inert when supported (`supports-inert.ts`), else
  aria-hidden + tabindex hacks.

### Pitfalls

- Third-party portals appended to body after open (Intercom, Google Translate,
  extensions, toasts) become hidden/inert or block the dialog
  (react-spectrum#8784, #5916; radix#2122).
- A nested dialog ending up under an `aria-hidden` ancestor (zag#3408).
- Live regions inside hidden subtrees stop announcing.
- `aria-hidden` alone leaves outside content clickable and focusable — hence the
  body pointer-events hacks in Zag/Radix.

### Decision for `core/dom`

`inert` (Baseline since 2023) on the outside, never `aria-hidden` alone.

```ts
// core/dom/inert-outside.ts
export function inertOutside(
  keep: () => readonly Element[],     // topmost modal layer + its descendant layers
  options?: { readonly doc?: Document },
): () => void
```

- Driven by the stack: recomputed whenever `topmostModal()` changes, so a child
  modal re-targets it instead of stacking hide-walks.
- Ref-counted per element (WeakMap), restores the author's own `inert`.
- Always kept visible: `[data-rind-top-layer]` (toast region, consumer opt-out),
  `[aria-live]`, `[role=status|alert|log]`, `script`, `style`, `template`.
- Nodes added after open are **left alone** (Ariakit's model, decided after the
  bug history: React Aria's observer that inerts late nodes broke password
  managers, cookie banners and third-party portals — react-spectrum#8784, #5916,
  radix#2219, #2055). Content mounted into an already-inert container is inert by
  inheritance anyway. Late nodes are also not "outside" for dismiss.
- Content `aria-modal="true"` is still set by components (APG); modality never
  depends on it. See Accessibility below for the WebKit iframe bug and the
  announcer.

## 5. Scroll lock

### How each library does it

- **Zag** (`remove-scroll/src/index.ts`): ref-counted per document; scroller is
  `<html>` if it overflows, else `<body>`; `overflow: hidden` + padding equal to
  the scrollbar width on the RTL-correct side, **unless** `scrollbar-gutter:
  stable` is already set; exposes `--scrollbar-width`; iOS: `position: fixed` on
  body with negative `top`/`left` offsets and `scrollTo` on unlock.
- **Radix**: `react-remove-scroll` (wheel/touch listeners, `shards`,
  `allowPinchZoom`) — had to stop blocking ctrl+wheel zoom (#2860); popovers
  inside dialogs not scrollable (#1159 open, #3423).
- **React Aria** (`usePreventScroll.ts`): count; desktop: `overflow: hidden` on
  `<html>` + `scrollbar-gutter: stable` when supported (padding fallback). iOS
  WebKit: no `position: fixed`; prevents `touchmove` whose nearest scrollable
  ancestor is the page or doesn't overflow; injects `* { overscroll-behavior:
  contain }` in an `@layer` (must be in place before `touchstart` since iOS 26);
  allows two-finger pinch, range inputs, text-selection handles; overrides
  `HTMLElement.prototype.focus` to stop keyboard-induced page scroll.
- **Base UI** (`useScrollLock.ts`): `ScrollLocker` singleton, lock/unlock in
  `setTimeout(0)`, **waits** (MutationObserver) when the page is already locked by
  someone else instead of snapshotting a locked state, re-locks on resize,
  `scrollbar-gutter: stable` / `stable both-edges`, skips iOS ("must be
  researched extensively").
- **Headless UI** (`document-overflow/*`): `overflow: hidden` + padding measured
  before/after; iOS: `touchmove` prevention and scroll restoration.
- **Reka UI** (`useBodyScrollLock.ts`): body padding-right + `--scrollbar-width`,
  iOS `touchmove` listener.

### Pitfalls

- Layout shift when the scrollbar disappears; fixed-position elements shift too
  (padding doesn't apply to them; `scrollbar-gutter` on `<html>` helps but users
  complain about the visible gutter: mui/base-ui#4645, #79).
- Wrong scroller: app shells where `<body>` scrolls under `overflow: hidden`
  `<html>` (mui/base-ui#5720 open; Zag's `getScrollContainer`).
- iOS Safari ignores `overflow: hidden` when the toolbar is collapsed; the
  `position: fixed` hack jumps the page and fights the address bar
  (radix#3078); keyboard covers inputs (react-spectrum#5926, #7902); pasting into
  inputs broke (react-spectrum#2030); text selection drag broke (radix#3331).
- Blocking ctrl+wheel / pinch zoom is an accessibility failure (radix#2860).
- Nested / overlapping locks restoring the wrong snapshot (Base UI's
  "already locked" observer, Zag's ref count, ark#3842 Strict Mode).

### Decision for `core/dom`

```ts
// core/dom/scroll-lock.ts
export function lockScroll(doc: Document): () => void   // ref-counted, idempotent release
```

- Applied while the stack has **any** modal layer (not per component).
- Scroller detection as Zag; `overflow: hidden` on the scroller only — no wheel
  or `touchmove` listeners on desktop (so zoom always works).
- Compensation: nothing if the author already has `scrollbar-gutter: stable`;
  otherwise padding on the RTL-correct side. Always expose `--rind-scrollbar-width`
  on `<html>` so fixed elements can compensate.
- iOS: React Aria's `touchmove` policy (prevent only when the touch's scroll
  parent is the page or can't scroll; allow pinch, ranges, selections) plus
  `overscroll-behavior: contain` on layer content. **No** `position: fixed` hack,
  **no** `HTMLElement.prototype.focus` override in v1 (open question).
- Snapshot the inline styles at first lock, restore exactly at last release;
  "DOM clean after close" is a model-test invariant (see Testing). A
  `MutationObserver` adopts foreign changes into the snapshot while locked, so a
  library that releases its own lock late cannot leave the page inverted or stuck
  (mui/base-ui#4640, headlessui#2168).
- Synchronous lock/unlock, no `nextTick`/timeout cleanup (reka-ui#2480,
  bits-ui#2115); styles through CSSOM only, never a `style` attribute string or an
  injected `<style>` (strict CSP, bits-ui#1995). Never set `scrollbar-gutter`
  ourselves. iOS allowed-scroll set is read from the stack at `touchstart`
  (headlessui#3890).

## 6. Presence (exit animations, unmount timing)

### How each library does it

- **Zag** (`presence.machine.ts`) and **Radix** (`presence.tsx`): states
  `mounted → unmountSuspended → unmounted`. Read `animation-name` from a cached
  `getComputedStyle`; if it changed and isn't `none`, wait for `animationend` /
  `animationcancel` on the node itself; set `animation-fill-mode: forwards` during
  exit so the last frame doesn't flash. **CSS keyframes only** — transitions are
  not detected. Zag unmounts immediately when the document is hidden.
- **React Aria** (`utils/animation.ts`): `useEnterAnimation` /
  `useExitAnimation` using `element.getAnimations()` filtered to running
  `DocumentTimeline` animations; `data-entering` / `data-exiting`; falls back to
  instant when `getAnimations` is missing (jsdom).
- **Base UI** (`useAnimationsFinished.ts`, `useTransitionStatus.ts`):
  `getAnimations()` (finite ones only) → `Promise.all(animation.finished)`,
  re-checks when an animation is cancelled and replaced; status
  `starting | idle | ending`; `data-starting-style` / `data-ending-style`;
  `flushSync` the unmount so the browser doesn't paint one frame of the final
  state (mui/base-ui#979, batching #5481). `preventUnmountOnClose()` +
  `actionsRef.unmount()` for JS animation libraries.
- **Headless UI** (`use-transition.ts`): `getAnimations()`, and polyfills it for
  tests with a console warning.

### Pitfalls

- Missed `animationend` because it fired before the listener (zag#3349, WebKit).
- Wrapped content → no exit animation (radix#3324); framer-motion needs
  `forceMount` (radix#1061).
- Re-opening during exit must cancel the unmount and keep the same node.
- Infinite animations (spinners inside the dialog) never finish — filter to
  finite ones, and only on the node itself, not descendants (unless opted in).
- Flash of the final frame before unmount (base-ui#979).
- Backdrop not animating on close (ark#3675) — every animated part needs presence.
- jsdom has no `getAnimations` (see [0003](../decisions/0003-testing.md)).

### Decision for `core/dom`

```ts
// core/dom/presence.ts
export function waitForExit(node: Element, signal: AbortSignal): Promise<void>
// getAnimations({ subtree: false }), finite, running; re-check when an animation is
// cancelled and replaced; resolves immediately when getAnimations is missing,
// the document is hidden, or there is nothing to wait for.
```

- Presence is a small **machine** in core (`present | exiting | absent`), shared
  by every overlay part; `waitForExit` is its injected effect. Handles CSS
  transitions, keyframes and WAAPI the same way.
- Open/close semantics never wait on presence: the dialog is `closed` (stack
  released, focus restored, inert/scroll lock removed, content made `inert`)
  **immediately**; presence only keeps the DOM around. This is what fixes
  react-spectrum#10291 and radix#3645 by construction.
- Adapters commit the unmount synchronously when the promise resolves (React:
  `flushSync`), to avoid base-ui#979.
- Escape hatch for JS animation libraries: `onExitComplete` callback + a
  `forceMount`/`keepMounted` part prop (Radix's `forceMount`, Base UI's
  `keepMounted`).

## 7. Portal

- **Radix** (`portal.tsx`, 38 lines): `createPortal` into `container ?? body`
  after mount (avoids SSR mismatch; radix#1386 hydration failure).
- **React Aria** (`Overlay.tsx`): `UNSAFE_PortalProvider` for container, SSR
  guard; `isExiting` keeps it mounted.
- **Base UI**: `FloatingPortal` with focus guards and `data-base-ui-portal`;
  mui/base-ui#2186 (portal stays mounted when popup removed).
- **Zag/Ark**: generic `<Portal>` component per framework, not per component.

**Decision.** Portal is a **framework concern** (React `createPortal`) plus one
core helper:

```ts
// core/dom/portal.ts
export function getPortalContainer(doc: Document, target?: Element | null): Element
// target ?? doc.body; shadow-root aware via getRootNode()
```

- One generic `Portal` part per adapter (as Ark), renders nothing on the server
  and on the first client render (no hydration mismatch), marks its host
  `data-rind-portal`.
- Layer "inside-ness" never depends on DOM position (it uses the stack), so
  portalling is optional — a dialog rendered inline behaves the same.

## Accessibility

Applies [accessibility.md](accessibility.md) (rules cited by number) and
[assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md) (causes by
letter) to the shared overlay modules. Pattern-level ARIA (roles, names) belongs to
each component's note; this section is about what the infrastructure guarantees.

**Rules this infrastructure enforces**

| Rule | What it means here | Where |
|---|---|---|
| 10 — focus never inside `aria-hidden`/`inert`; no focusable inside `aria-hidden` | We never use `aria-hidden` to hide the outside (only `inert`); closing content becomes `inert` only after focus has left it; restore never targets an inert element | `inert-outside`, `focus-restore` |
| 11 — focus never lost to `body` | Recovery on removal of the focused node; restore fallback chain (opener → WeakRef history → parent layer container) | `focus-scope`, `focus-restore` |
| 13 — closing returns focus to the trigger | Opener first, if connected, not inert, focusable; order "release → un-inert → focus" | `overlay` effect |
| 19 — Escape closes only the topmost layer | One document router, one key = one layer, IME and `defaultPrevented` respected, never deferred; our own composites only `preventDefault` Escape when they act (kobalte#688) | `dismiss` |
| 23 — announcements only via the Announcer | No module renders a live region; dismiss/presence emit no speech of their own | all |
| 25 — announcer exists first and is exempt from inert | `[data-live-announcer]` is in the keep-exposed set; regions are never moved (see decision below) | `inert-outside` |
| 26 — presence completes with zero animations; reduced motion | `waitForExit` resolves immediately when nothing runs; with `prefers-reduced-motion` the theme removes animations, and nothing in JS animates | `presence` |
| 29 — visually hidden content | Any hidden dismiss button (an AT quirk entry only if device testing needs it, AK#7310) uses `core/dom/visually-hidden`; TalkBack does not click visually hidden elements on some devices (RA#3047), so it is never the only way out | components |

**`aria-modal` behaviour.** `aria-modal="true"` tells AT to restrict the virtual
cursor to the dialog, but support is uneven: VoiceOver historically ignored it,
WebKit 211934 focuses the first focusable element in iframes (why React Aria drops
the attribute), and Safari 18.4–26 let the VO cursor reach content behind both ARIA
and native modals (WebKit #311125/#314893, fixed in 27). Hence: modality is made
real with `inert` (keyboard, pointer and AX tree, all engines since 2023) and
`aria-modal` is only an additional hint emitted by components. The `modal`
trait checks inertness, not `aria-modal`.

**Decision — the announcer inside modal dialogs** (accessibility.md open question).
The announcer's regions stay where they are (document level, created eagerly),
exempt from `inert`, and are **never relocated** into the topmost modal. Moving a
live region removes and re-inserts it in the accessibility tree, which breaks the
one rule every announcer bug points to — the region must exist before the message
(cause D: RA#5191, BU#4181, RX#3634) — and would race with a dialog opening and
announcing in the same frame. What we do not know is whether VO + Safari speaks
messages from a region outside an `aria-modal` dialog; it is now a tier-1 manual
check in the Dialog change. If it fails, the fix is a quirks-registry entry (cause
L: removable when fixed) that sends WebKit announcements through
`element.ariaNotify()` on the topmost modal content (Safari 27), behind the same
`Announcer` interface — the specs here do not change.

**Screen reader and browser quirks that hit overlays**

| AT / browser | Quirk | Our handling |
|---|---|---|
| VO iOS / macOS | Dialog title not announced on open (RX#3348), description not read (RX#2038); React Aria refocuses after 500 ms | Initial focus within one frame on the first tabbable or container; no blur/refocus hack until device testing shows we need it (cause G: blur/refocus caused late value speech in BU#5296) |
| VO (Safari 26) | Does not follow `focus()` into new content (RA#9814, cause L) | Tracked as an AT regression; fixed in Safari 27; not worked around |
| VO / Chrome | Extraneous `blur` with `null` `relatedTarget` (chromium 1473752); RA#4130 tab switch | Outside-focus ignores `null` |
| VO iOS, TalkBack | Synthesized taps with no pointer events close a just-opened Select (RX#1343); virtual cursor moves DOM focus (cause C) | A bare `click` is never an outside press; focus events never commit state |
| TalkBack | Cursor pulled back to the first element because `activeElement` is `body` after a rAF (RA#7471) | Recovery keyed on the last focused element being disconnected |
| TalkBack | Visually hidden buttons not clickable (RA#3047) | Never the only dismiss path |
| iPhone VO | Swiping past the last item moves focus outside (BU#5794) | Non-modal: counts as outside focus (expected); modal: outside is inert, so the swipe cannot leave |
| NVDA / JAWS | Browse mode can leave a non-modal popover (HUI#3853) | Expected for non-modal; modal layers are `inert` outside, so the virtual cursor cannot leave |
| NVDA | Heading read twice when initial focus lands after the title (RX#3377) | Component-level (Dialog note) |
| Chromium | `aria-labelledby` into an `inert` subtree yields an empty name (RA#9737) | Label sources of a modal layer live inside it; the generic "name sources reachable" invariant fails otherwise |
| Firefox / Chromium | Keyboard-focusable scrollers are tab stops (RA#10395) | Included in our sequential order |
| WebKit | `animationend` before the listener (zag#3349) | `getAnimations()` read after the state change, no event listeners |

Forced colors and RTL: modules emit no colour; the portal host copies `dir`/`lang`
from the logical parent and scroll-lock compensation goes on the inline-end side.

## Native platform reconciliation

Checked against [native-platform.md](native-platform.md) (its decisions are the
input; nothing here contradicts them):

| Native primitive | Decision for these modules |
|---|---|
| `<dialog>.showModal()`, `closedby`, `requestClose`, `CloseWatcher` | **Not used.** Layers are JS-managed (`role` set by components); we copy the semantics: close is a cancelable request with a reason, focus returns to the previously focused element. Android back button is a follow-up |
| `popover` (`auto`/`hint`) | **Not used**; `manual` as paint-order promotion is the pre-Wave-2 spike and changes none of these modules |
| `inert` | **Used** for the outside and for exiting content; never `aria-hidden` alone, never body `pointer-events` |
| Portal targets | `resolvePortalTarget` renders into the nearest open `dialog:modal`, `:popover-open` or `document.fullscreenElement` containing the logical parent, then the shadow root, then `body` — rind components work inside a consumer's native dialog (otherwise they would be inert there) |
| `@starting-style` | **Used** by the theme for entry; presence adds no starting attribute |
| `overlay` / `allow-discrete` | Theme convenience only; exit stays the presence machine |
| `scrollbar-gutter` / `overscroll-behavior` | Respect the author's `scrollbar-gutter: stable` (no padding then), never set it; `overscroll-behavior: contain` on layer elements while locked, plus the iOS `touchmove` policy |

## Bug history

Searched open and closed issues of the ten libraries (2026-10-14) with `gh search
issues` for: focus trap, restore focus, pointer-events body, scroll lock,
scrollbar layout shift, outside click, escape nested, aria-hidden inert, portal
shadow iframe, exit animation unmount, iOS scroll — about 1,000 hits, ~450 unique,
~80 read in full. Deduplicated; the AT-specific ones are in
[assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md) and only
cited above. **Spec** = the lesson is a scenario in
`openspec/changes/add-overlay-infrastructure`.

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| Radix | [#1241](https://github.com/radix-ui/primitives/issues/1241), [#3645](https://github.com/radix-ui/primitives/issues/3645), [#3317](https://github.com/radix-ui/primitives/issues/3317), [#3141](https://github.com/radix-ui/primitives/issues/3141) | `body { pointer-events: none }` left after closing (dialog from a dropdown item, select + overlay) — page frozen | One module-level "original value" shared by overlapping layers; teardown at unmount during exit | Patched repeatedly; #3897 (2025) reworked overlapping layers | Never mutate body pointer-events (Spec) |
| Radix | [#3648](https://github.com/radix-ui/primitives/issues/3648) | Sibling dialogs: last dialog not interactive | Stack order treated as nesting | Dup of #3645 | Explicit parentage; siblings are roots (Spec) |
| Radix | [#1088](https://github.com/radix-ui/primitives/issues/1088), [#2961](https://github.com/radix-ui/primitives/issues/2961) | Select inside Dialog: outside click breaks the dialog | Two versions of `dismissable-layer` installed → two stacks | "Upgrade/dedupe" | Stack lives on the document under a versioned global key (Spec) |
| React Aria | [#8784](https://github.com/adobe/react-spectrum/issues/8784) | Inert breaks cookie-consent and other external overlays; module loaded twice | Observer inerts late nodes; per-copy `observerStack` | WONTFIX ("don't load twice") | Leave late nodes alone; shared stack (Spec) |
| Radix | [#2219](https://github.com/radix-ui/primitives/issues/2219), [#2055](https://github.com/radix-ui/primitives/issues/2055), [#1859](https://github.com/radix-ui/primitives/issues/1859) | Grammarly, password managers, third-party modals unusable or close the dialog | Late body children are "outside" and blocked | Escape-hatch props | Late nodes are neither inert nor outside (Spec) |
| React Aria / Radix / Ark | [RA#5916](https://github.com/adobe/react-spectrum/issues/5916), [RX#3119](https://github.com/radix-ui/primitives/issues/3119), [ARK#3557](https://github.com/chakra-ui/ark/issues/3557) | Third-party select inside a dialog: options unclickable or dialog closes | Third-party portal to body counted as outside / blocked | Workarounds (portal into the dialog) | Same rule (Spec) |
| React Aria | [#10291](https://github.com/adobe/react-spectrum/issues/10291) | Closing top modal dismisses the one beneath during its exit animation | Overlay stays in `visibleOverlays` until unmount; click passes through | Open | Release at close + `isExitingAt` (Spec) |
| Radix | [#4035](https://github.com/radix-ui/primitives/issues/4035) | Click outside a dropdown inside a controlled dialog calls the dialog's `onOpenChange(false)` | Outside press propagated to every layer | Fixed #3987 | Cascade stops at modal layers (Spec) |
| Base UI | [#1320](https://github.com/mui/base-ui/issues/1320) | Clicking in one of several non-nested modals closes the others | React-tree nesting only | Special-cased | Explicit roots + cascade (Spec) |
| Radix | [#2782](https://github.com/radix-ui/primitives/issues/2782) | After a `stopPropagation` press inside, two outside clicks needed | Pointer tracking relied on bubbling | Open | Capture-phase tracking (Spec) |
| Radix / Headless UI / Ark | [RX#1658](https://github.com/radix-ui/primitives/issues/1658), [HUI#1551](https://github.com/tailwindlabs/headlessui/issues/1551), [ARK#2557](https://github.com/chakra-ui/ark/issues/2557) | Touch: selecting an option / closing a child taps the element behind or closes the parent too | Dismiss on `pointerdown`/`pointerup`; the compatibility `click` lands elsewhere | Partly fixed | Touch dismisses on `click`; one gesture dismisses once (Spec) |
| Ark | [#2925](https://github.com/chakra-ui/ark/issues/2925) | Dialog closes when clicking the page scrollbar | Scrollbar press is a pointerdown on `html` | Fixed | Scrollbar test (Spec) |
| Zag | [#3248](https://github.com/chakra-ui/zag/issues/3248) | Escape does nothing for ≥ 1 frame after open | Whole dismiss setup deferred by rAF | Fixed | Escape active at registration (Spec) |
| Bits UI | [#2141](https://github.com/huntabyte/bits-ui/issues/2141) | Early outside clicks lost while a menu opens | Delayed layer registration | Open | "Down after registration" instead of delays (Spec) |
| Kobalte | [#688](https://github.com/kobaltedev/kobalte/issues/688) | Escape never closes a dialog containing Tabs | Collection `preventDefault`s Escape even when it does nothing | Fix proposed | Our composites only consume keys they act on (Spec) |
| Radix | [#1498](https://github.com/radix-ui/primitives/issues/1498), [#2005](https://github.com/radix-ui/primitives/issues/2005) | Clicked button removed → focus to URL bar, Tab escapes the trap | No recovery on removal | Fixed via MutationObserver (radix-vue port) | Recover to the container (Spec) |
| Zag | [#3042](https://github.com/chakra-ui/zag/issues/3042) | Modal popover with only a radio group: Tab escapes to browser UI | Single tab stop not handled | Fixed | One/zero stops keep focus (Spec) |
| React Aria | [#10395](https://github.com/adobe/react-spectrum/issues/10395) | Scrollable text in a modal cannot be reached/scrolled by keyboard | Own Tab walker ignores keyboard-focusable scrollers | Open | Include them (Spec) |
| Base UI | [#3844](https://github.com/mui/base-ui/issues/3844), [#4205](https://github.com/mui/base-ui/issues/4205) | Positive `tabindex` / non-scrollable scroll area breaks the trap | Order computed differently from the browser | Won't fix / fixed | Follow the browser's sequential order (Spec) |
| Zag | [#2611](https://github.com/chakra-ui/zag/issues/2611) | CSS `reading-flow` makes elements unreachable in a dialog | DOM-order trap vs visual tab order | Closed | Known limitation (design Risks) |
| Zag | [#1718](https://github.com/chakra-ui/zag/issues/1718) | Closing a nested dialog focuses the parent's first element | Resumed trap re-ran initial focus | Fixed | Resume never moves focus (Spec) |
| React Aria | [#2444](https://github.com/adobe/react-spectrum/issues/2444), [#874](https://github.com/adobe/react-spectrum/issues/874) | Dialog from a menu item: focus lost to body on close | Restore target unmounted | Fixed with a scope tree | Fallback chain (Spec) |
| React Aria | [#10661](https://github.com/adobe/react-spectrum/issues/10661) | Popover open at mount restores focus to body | Nothing captured before open | Open | Opener is a restore candidate (Spec) |
| React Aria | [#10610](https://github.com/adobe/react-spectrum/issues/10610) | Modal popover closes without restoring focus | Restore rAF runs before inert removal; `focus()` on inert is a no-op | Closed (not reproduced upstream) | Fixed order: release → un-inert → focus (Spec) |
| Radix | [#2942](https://github.com/radix-ui/primitives/issues/2942) | Clicking outside steals focus back to the trigger | Unconditional restore | Fixed for non-modal | Restore only if focus is inside or on body (Spec) |
| Ariakit / Reka | [AK#7033](https://github.com/ariakit/ariakit/issues/7033), [RK#2886](https://github.com/unovue/reka-ui/issues/2886) | Initial focus pulls focus back from where the app/user moved it | Delayed autofocus without re-check | Fixed | Skip initial focus if focus moved (Spec) |
| React Aria | [#8952](https://github.com/adobe/react-spectrum/issues/8952) | Host and iframe overlays fight over focus | `focusin` redirect across documents | Closed | Containment never pulls focus (Spec) |
| Radix | [#4148](https://github.com/radix-ui/primitives/issues/4148) | Test runs crash after teardown | Uncleared `setTimeout` using realm globals in restore | Fixed | All deferral through the injected scheduler (Spec) |
| Zag / Headless UI | [ZG#3408](https://github.com/chakra-ui/zag/issues/3408), [HUI#2413](https://github.com/tailwindlabs/headlessui/issues/2413) | Open nested dialog under an `aria-hidden` ancestor; every body sibling inerted | Hide walk did not keep ancestors of the new topmost | Fixed | Recompute from the stack; never mark kept ancestors (Spec) |
| Radix | [#4115](https://github.com/radix-ui/primitives/issues/4115), [#1820](https://github.com/radix-ui/primitives/issues/1820) | Toast viewport / live regions swallowed by hide-others | Whole-body walk | Open / fixed | Keep-exposed set (Spec) |
| Ark | [#2715](https://github.com/chakra-ui/ark/issues/2715), [#2844](https://github.com/chakra-ui/ark/issues/2844) | `aria-hidden` set on `body` (blocked by Chrome) | Walk started above body | Fixed | Never mark html/body (Spec) |
| Radix / Ark | [RX#3797](https://github.com/radix-ui/primitives/issues/3797), [ARK#3842](https://github.com/chakra-ui/ark/issues/3842) | Scroll lock / pointer-events stuck after navigating away or Strict-Mode unmount | Cleanup tied to close callbacks, not lifecycle | "Unsupported" (Ark) | `stop()` runs the close path; DOM-clean invariant (Spec) |
| Radix / Headless UI | [RX#3100](https://github.com/radix-ui/primitives/issues/3100), [HUI#2403](https://github.com/tailwindlabs/headlessui/issues/2403) | `forceMount` / `unmount={false}` locks scroll while closed | Lock tied to mount | Workarounds | Mounted-but-closed holds no layer (Spec) |
| Radix / Bits | [RX#3251](https://github.com/radix-ui/primitives/issues/3251), [BITS#1912](https://github.com/huntabyte/bits-ui/issues/1912), [BU#3189](https://github.com/mui/base-ui/issues/3189) | Layout shift when the page already uses `scrollbar-gutter: stable` | Double compensation | Open / fixed | No padding when the author reserves the gutter (Spec) |
| Base UI | [#4645](https://github.com/mui/base-ui/issues/4645) | Visible blank gutter outside a side drawer | Library sets `scrollbar-gutter: stable` on html | Open | Never set it (Spec) |
| Base UI | [#5720](https://github.com/mui/base-ui/issues/5720) | No lock when body is the scroller under `overflow: hidden` html | Treated as "already locked" | Open | Scroller detection (Spec) |
| Base UI / Headless UI / Ariakit | [BU#4640](https://github.com/mui/base-ui/issues/4640), [HUI#2168](https://github.com/tailwindlabs/headlessui/issues/2168), [AK#2528](https://github.com/ariakit/ariakit/issues/2528) | Scroll lock inverted or lost after another lock ends late / successive animated dialogs | Snapshot taken while a foreign or exiting lock was active | Fixed | Adopt foreign changes; lock follows the stack synchronously (Spec) |
| Reka | [#2480](https://github.com/unovue/reka-ui/issues/2480) | Permanent lock on iOS after lock+unlock in one tick | `nextTick` apply after a synchronous reset | Fixed | Synchronous lock/unlock (Spec) |
| Radix / React Aria | [RX#2860](https://github.com/radix-ui/primitives/issues/2860), [RA#1898](https://github.com/adobe/react-spectrum/issues/1898) | Ctrl+wheel / pinch zoom blocked in dialogs | Wheel/touch blocking | Fixed (allow zoom) | No desktop listeners; iOS policy allows two fingers (Spec) |
| Radix / Headless UI | [RX#3078](https://github.com/radix-ui/primitives/issues/3078), [RX#3331](https://github.com/radix-ui/primitives/issues/3331), [HUI#3890](https://github.com/tailwindlabs/headlessui/issues/3890) | iOS: page jumps, text-selection drag broken, sibling dialogs not scrollable | `position: fixed` body; stale allowed-container metadata | Partly fixed | Touch policy read at `touchstart`, no fixed hack (Spec) |
| Base UI | [#1340](https://github.com/mui/base-ui/issues/1340) | Page scrolls to top when a dialog opens with `scroll-behavior: smooth` | Lock/focus caused a smooth scroll | Fixed | Lock never changes the scroll position (Spec) |
| Bits UI | [#1995](https://github.com/huntabyte/bits-ui/issues/1995) | CSP violation under hash-based `style-src` | Reported as runtime inline styles; maintainers dispute which module | Open | CSSOM only, no style strings or injected `<style>` (Spec) |
| Zag | [#3349](https://github.com/chakra-ui/zag/issues/3349) | Element never unmounts in WebKit | `animationend` fired before the listener | Fixed | `getAnimations()` after the state change (Spec) |
| Ark | [#3675](https://github.com/chakra-ui/ark/issues/3675) | Backdrop does not animate on close | Only content had presence | Fixed | Presence per animated part (Spec) |
| Base UI | [#979](https://github.com/mui/base-ui/issues/979) | One frame of the resting style before unmount | Async commit | Fixed (`flushSync`) | Synchronous unmount commit (Spec) |
| Radix | [#3599](https://github.com/radix-ui/primitives/issues/3599) | Changing `container` does not move the portal | Container read once | Open | Reactive container (Spec) |
| Ark / Radix | [ARK#2714](https://github.com/chakra-ui/ark/issues/2714), [RX#3353](https://github.com/radix-ui/primitives/issues/3353), [RA#1472](https://github.com/adobe/react-spectrum/issues/1472) | Dialog in shadow DOM: closes instantly / trap fails | `document.activeElement` instead of deep active element; root not passed | Partly fixed | Root from `getRootNode()`, deep active element (Spec) |
| Base UI | [#2312](https://github.com/mui/base-ui/issues/2312) | Clicks bubble to React ancestors through the portal | Synthetic event tree | Documented | Dismissal never relies on framework bubbling (Spec) |
| Ark | [#3268](https://github.com/chakra-ui/ark/issues/3268) | DatePicker in a dialog closes on selection (Safari, portal) | Focus trap + portal outside the dialog scope | Advice: portal into the dialog | Portalled children are inside by parentage, not DOM (Spec) |
| rind-ui | found in implementation | Focus restore missed the trigger when it was focused before the first layer opened | The focus history was installed lazily, on the first layer | Fixed: the history is kept by the modality tracker from the start | Record focus from page load, not from the first overlay |
| rind-ui | found in implementation | With `<html>` as the scroller, `overflow` was never applied; restoring the `overflow` shorthand dropped an author's `overflow-y` | Scroll lock overwrote its own `<html>` entry (saved value read after the first write) and saved/restored the shorthand | Fixed: one entry per element, merged; longhands saved and restored | Snapshot per element and per longhand; restore exactly what was changed |
| rind-ui | found in implementation | Outside hiding and initial focus found no container on open | The overlay effect ran before the framework mounted the content | Fixed: attach on the next frames and refresh the stack once the elements exist | Never assume the content is in the DOM when the effect runs |
| rind-ui | found in implementation | Initial focus was skipped after the trigger was made inert | Focus lost to `<body>` was read as the user moving focus | Fixed: focus on `<body>` is not a user move | Distinguish focus the user moved from focus the page lost |
| rind-ui | found in review | A modal whose content mounted more than 10 frames late trapped nothing (no focus, no inert) | The overlay effect gave up after a fixed frame count | Fixed: retry every frame until mount or close, dev warning when slow | Never bound a wait on the framework with a frame count |
| rind-ui | found in review | A layer that registers its trigger made its own portal inert | Outside hiding walked once with only the trigger kept and re-walked only when the topmost modal changed | Fixed: re-walk whenever the kept elements change (late nodes stay exposed through the open-time snapshot) | Recompute hiding on element changes, not only on stack order |
| rind-ui | found in review | Nested layers opened at mount, or an alert opened from a closing menu, lost their parent | Parentage was frozen at push; React runs child effects first | Fixed: parentage resolved on read, through exiting and recently disposed parents | Declared parentage must survive registration order |
| rind-ui | found in review | The positioner unmounted the content during its exit animation | Presence on the wrapper waited only for its own animations | Fixed: a wrapper part waits for its subtree | A part that holds animated content waits for the subtree |
| rind-ui | found in review | Model tests warned about act in WebKit | user-event's asyncWrapper, started inside act, restored React's act flag out of order | Fixed in the DOM adapter; paths run in the adapter's async scope | Deferred focus in tests must run in the framework's async scope |

## Known pitfalls

Per-section above. The recurring themes: global style mutations without exact
restore; one stack per concern drifting apart; teardown at unmount instead of
close; touch ghost clicks and iOS scroll; Strict Mode double-mount; third-party
DOM appended to body while a modal is open. Live regions (Toast) only couple via
`inertOutside`'s keep-visible list.

## Testing notes

- jsdom lacks `getAnimations`, real `inert` semantics, layout (scrollbar width)
  and `visualViewport`; `@rind-ui/testing/setup` polyfills `getAnimations` →
  `[]`. Inert, Tab order and scroll lock are only asserted in browser mode.
- Model-based invariants (every machine path, every overlay):
  - Escape dismisses exactly the topmost layer.
  - While a modal layer is open: `document.activeElement` is inside the topmost
    modal or one of its descendant layers; every other body child is `inert`.
  - **DOM clean**: after all layers close, `<html>`/`<body>` `style`, `inert`,
    `aria-hidden` and `data-*` equal the snapshot taken before the first open —
    also under Strict Mode double-mount. This single invariant would have caught
    radix#1241/#3317/#3648/#3645 and ark#3842.
- Each module has unit tests in browser mode against plain DOM (no framework),
  which is what makes Vue/Solid/Svelte adapters cheap later.

## Decisions

- Modules (`core/dom/`): `layer-stack.ts`, `dismiss.ts`, `focus-trap.ts`,
  `focus-restore.ts`, `inert-outside.ts`, `scroll-lock.ts`, `presence.ts`,
  `portal.ts`. Each exports plain functions returning a cleanup; machines use
  them as **injected effects**, never import them directly.
- One `LayerStack` per document is the single source of truth; dismiss, trap,
  inert and scroll lock derive from it.
- `inert` instead of body `pointer-events` and instead of `aria-hidden` alone.
- Outside pointer = down+up outside; Escape in bubble phase, honouring
  `defaultPrevented`, topmost only.
- Close-time teardown, unmount only waits for `getAnimations()`.
- Deliberately different from the others: explicit layer parentage (not stack
  order, not React tree); no body style hacks; no focus-guard spans; a
  "DOM clean after close" invariant shipped to consumers via `testMachine`.

## Open questions

All previous open questions are resolved (see the design of
`add-overlay-infrastructure`, "Resolved open questions"):

- Native `<dialog>` / `popover`: not in v1 (native-platform.md); revisit with the
  `popover="manual"` spike before Wave 2.
- iOS keyboard: no `HTMLElement.prototype.focus` override; touch policy +
  `overscroll-behavior`. Device testing is on the release checklist, not a blocker.
- Compensation: respect `scrollbar-gutter: stable` when present, else padding;
  never set it.
- Late body nodes: left alone and not outside.

Deferrable (no spec impact): CSS `reading-flow` support in Tab wrapping once a
second engine ships it; whether the VO-announcer quirk entry is needed (Dialog
manual check).
