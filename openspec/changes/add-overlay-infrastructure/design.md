## Context

See proposal.md for motivation. The research and its bug history are in
[overlay-infrastructure.md](../../../docs/research/overlay-infrastructure.md); the API
sketches there are binding unless this document says otherwise.

This change **depends on `add-foundations`** and uses, from it:

| From `add-foundations` | Used for |
|---|---|
| `machine-runtime`: state-scoped effects with cleanup, run-to-completion `send`, `start`/`stop` | Every module runs as an injected effect of a component machine; `stop()` (unmount, navigation, Strict Mode) runs the same cleanup as close |
| `Environment` (`scheduler`, `dom` root/by-id/active element, `focus`) | Modules never touch globals: the document comes from `env.dom`, frames/timeouts from `env.scheduler` (fake timers, no post-teardown timers — radix#4148) |
| `controllable()` + `ChangeDetails.cancel()` | Dismiss requests become `CLOSE { reason }` events; vetoes use the existing cancel path |
| `component-contract` `Env` (`pointer press outside every layer`, `until`, keyboard) | Overlay driver actions |
| `model-based-testing` traits `layer`, `restores-focus`, generic invariants (rules 10, 11, 19, html/body clean) | Extended by the `modal` and `presence` traits |
| `react-adapter` `useMachine`, ids, `data-instance` | `Portal`, `usePresence`, layer context |
| `@rind-ui/testing/setup` (`getAnimations` → `[]`) | Presence resolves immediately in jsdom |

## Goals / Non-Goals

**Goals:**
- Eight small `core/dom` modules, each usable alone, coordinated only through the
  per-document layer stack.
- Every Bug-history lesson that the specs turned into a scenario has a test that
  reproduces the original bug.
- A test-only `layer` fixture (machine, connect, contract, React parts) that
  exercises modal, non-modal, nested and sibling layers end to end.

**Non-Goals:**
- Positioning; non-modal focus return on Tab-out (Popover); `CloseWatcher`/Android
  back; Base UI's `modal: "trap-focus"` middle mode (no consumer yet).

## Decisions

### 1. JS-managed layers, not `<dialog>.showModal()` / `popover`

Decided in native-platform.md (Recommendation): native modality makes every
portalled child and every toast inert, Escape cannot be vetoed without fresh user
activation, `closedby` is missing in Safari, exit animations need Chrome-only
`overlay`, and jsdom has none of it. We copy native semantics instead (cancelable
close request, close reasons, focus restore to the previously focused element) and
keep interop through portal resolution (§9). *Alternatives:* native dialog
(rejected, above); `popover="manual"` for paint order only — deferred to the Wave 2
spike, it does not change these modules.

### 2. One stack per document, stored on the document

`getLayerStack(doc)` reads `doc[Symbol.for("rind-ui.layer-stack@1")]`, creating it on
first use. Two copies of `@rind-ui/core` therefore share one stack (radix#1088,
radix#2961, react-spectrum#8784 all came from per-copy module state). The `@1`
suffix is bumped only on an incompatible stack shape; a mismatch logs a dev warning
and falls back to a separate stack. *Alternatives:* module-global (breaks with two
copies), framework context (breaks across adapters and portals into other roots).

```ts
// core/dom/layer-stack.ts
export type LayerId = string & { readonly __brand: "LayerId" }
export type LayerKind = "dialog" | "alertdialog" | "drawer" | "popover" | "menu" | "listbox" | "tooltip"

export interface LayerOptions {
  readonly id: LayerId
  readonly kind: LayerKind
  readonly modal: boolean
  readonly parent?: LayerId | undefined          // from the adapter's layer context
  readonly opener?: () => Element | null         // fallback parent by DOM containment; first restore candidate
  readonly elements: () => readonly Element[]    // content, backdrop, positioner
}

export interface LayerHandle {
  readonly id: LayerId
  isTopmost(): boolean
  contains(target: EventTarget | null): boolean  // self + descendant layers
  meta(): { index: number; depth: number; nested: boolean; hasNested: boolean; nestedCount: number }
  release(): void      // close: dismiss children ("parent-dismissed"), leave "open", enter "exiting"
  dispose(): void      // presence finished: forget the exiting entry
}

export interface LayerStack {
  push(options: LayerOptions): LayerHandle       // idempotent per id
  topmost(): LayerHandle | undefined
  topmostModal(): LayerHandle | undefined
  isExitingAt(x: number, y: number): boolean     // exiting layers' rects (inert content is not hit-tested)
  isLogicallyInside(target: EventTarget | null, element: Element): boolean
    // element.contains(target), or target in a layer whose opener / ancestor layers' openers
    // or elements are inside `element` (add-field: Field FOCUS.LEAVE with portalled popups)
  subscribe(listener: () => void): () => void
}
export function getLayerStack(doc: Document): LayerStack
```

### 3. Explicit parentage

Parent = the layer id from the adapter's layer context, else the open layer whose
elements contain `opener()`, else root. *Alternatives:* stack order (Zag — sibling
dialogs become "nested", base-ui#1320), React tree (Radix/RA/Base — framework-bound,
breaks with two copies and non-React adapters).

### 4. Stack-driven document singletons for inert, scroll lock and containment

`inert-outside`, `scroll-lock` and `focus-scope` each install one subscriber per
document on first use and recompute from `topmostModal()` on every stack change. A
component therefore only registers a layer (plus its dismiss options); it never
starts or stops inert/scroll lock itself, which is what made overlapping teardown
safe. Each module also exports its primitive (`inertOutside(keep)`,
`lockScroll(doc)`, `trapTab(container)`) for standalone use and tests.

```ts
// core/dom/overlay.ts — the one effect a component machine injects
export interface OverlayEffectOptions extends Omit<LayerOptions, "elements"> {
  readonly elements: () => readonly Element[]
  readonly dismiss: DismissOptions               // §5
  readonly initialFocus?: () => FocusTarget      // §6
  readonly finalFocus?: (reason: CloseReason) => FocusTarget
  readonly modality: Modality                    // how it was opened (touch → container focus)
}
export function overlayEffect(env: Environment, options: OverlayEffectOptions): () => void
// push layer → focusInitial → (on cleanup) release → inert/scroll recompute (sync) → restoreFocus
```

The cleanup order is fixed: release the layer, let the stack subscribers remove
`inert` and the scroll lock synchronously, **then** restore focus (react-spectrum#10610:
`focus()` on a still-inert trigger is a no-op).

### 5. Dismiss

```ts
// core/dom/dismiss.ts
export type DismissReason = "escape-key" | "outside-press" | "outside-focus" | "parent-dismissed"
export interface DismissRequest {
  readonly reason: DismissReason
  readonly event: Event | undefined
  readonly target: Element | null
  cancel(): void
  readonly canceled: boolean
}
export interface DismissOptions {
  readonly onRequest: (request: DismissRequest) => void   // machine: CLOSE { reason }
  readonly escape?: boolean
  readonly outsidePress?: boolean
  readonly outsideFocus?: boolean
  readonly isInside?: (target: Element) => boolean        // persistent elements
}
```

- One `keydown` listener per document (bubble phase), routed to `topmost()`;
  skipped on `defaultPrevented` and IME composition; active at registration, never
  deferred (zag#3248). *Alternative:* capture phase (Zag/Radix) — rejected: an inner
  widget could not consume Escape.
- Pointer tracking in the **capture** phase on the document (stopPropagation-proof,
  radix#2782). A press is recorded at `pointerdown` with `timeStamp`; it is outside
  only if down happened after registration and down and up are both outside
  (no deferral timers needed for the opening click). Mouse dismisses on `pointerup`;
  touch/pen on the following `click` (ghost clicks). Scrollbar test:
  `clientX >= el.clientWidth` on the page or the scroll container hit.
- "Outside" = not `stack.contains`, not `isInside`, not added after the topmost
  modal opened (a `WeakSet` of nodes present at open, §7), not
  `stack.isExitingAt(x, y)`.
- Cascade rule as specified (stop at containing layer, veto, or modal; modal only
  if topmost at press start).

### 6. Focus containment without sentinels

```ts
// core/dom/focus-scope.ts
export type FocusTarget = HTMLElement | null | false   // false = do not move, null = default
export function focusInitial(env: Environment, container: HTMLElement, pick?: () => FocusTarget, modality?: Modality): void
export function trapTab(env: Environment, container: HTMLElement): () => void
export function tabbables(container: HTMLElement): HTMLElement[]   // the order trapTab wraps over (from add-scroll-area)
// core/dom/focus-restore.ts
export interface FocusReturn { restore(pick?: () => FocusTarget): void }
export function captureFocus(env: Environment, opener?: () => Element | null): FocusReturn
```

Outside content is `inert`, so containment only has to (a) wrap Tab at the edges
and (b) recover when the focused node is disconnected. Tab handling computes the
sequential order of the container (positive `tabindex` first, radio groups as one
stop, keyboard-focusable scrollers included — react-spectrum#10395) and calls
`focus({ preventScroll: true })`. Recovery uses a `MutationObserver` and checks that
the *last focused element* is disconnected (react-spectrum#7471). Restore picks
`pick()` → opener/previously focused (connected, not inert, focusable) → a bounded
`WeakRef` history (last 8) → parent layer container. *Alternatives:* port of
`focus-trap` (Zag, 932 lines, focusin redirect — fights other documents,
react-spectrum#8952); sentinel spans (Radix/Base — axe `aria-hidden-focus`, VO
issues, assistive-tech note cause F); no wrap like native `<dialog>` (Ariakit) —
rejected, APG asks for wrap.

### 7. Outside hiding with `inert`, snapshot at open

`inertOutside(keep)` walks from `body` to each kept element and marks siblings,
ref-counted in a `WeakMap<Element, number>`, remembering the author's own `inert`.
Kept: topmost modal + descendant layers, `[data-live-announcer]`,
`[data-rind-top-layer]`, `[aria-live]`, `[role=status|alert|log]`. Nodes inserted
after the walk are **not** marked (Ariakit's model). *Alternative:* React Aria's
`MutationObserver` that inerts new nodes — rejected: it breaks password managers,
extensions and third-party portals (radix#2219, react-spectrum#8784, #5916), which
the bug history shows hit far more users than "late-loaded page content is
reachable".

### 8. Scroll lock

`lockScroll(doc)` is ref-counted; scroller detection per spec; padding on
inline-end unless `scrollbar-gutter: stable` is already in effect;
`--rind-scrollbar-width` and `data-rind-scroll-locked`; a `MutationObserver` on the
scroller's `style` adopts foreign changes into the snapshot (base-ui#4640). iOS:
one non-passive `touchmove` listener whose allowed set is read from the stack at
`touchstart` (headlessui#3890), plus `overscroll-behavior: contain` on layer
elements. *Alternatives:* `position: fixed` body (jumps, radix#3078); wheel/touch
blocking everywhere (`react-remove-scroll` — blocks zoom, radix#2860); setting
`scrollbar-gutter` ourselves (base-ui#4645).

### 9. Portal

```ts
// core/dom/portal.ts
export function resolvePortalTarget(env: Environment, logicalParent: Element | null, container?: Element | ShadowRoot | null): Element | ShadowRoot
// container → closest open dialog:modal / :popover-open / fullscreenElement containing logicalParent
// → logicalParent.getRootNode() if ShadowRoot → ownerDocument.body
```

React: `Portal` renders nothing until mounted (no hydration mismatch), uses
`createPortal` into a host `div[data-rind-portal]` with `dir`/`lang` copied from the
logical parent, and re-resolves when `container` changes (radix#3599). Layer
membership never depends on DOM position, so inline rendering behaves the same.

### 10. Presence machine

A shared machine in `core/presence/presence.machine.ts`:

```
states:  present ── CLOSE ──► exiting ── EXIT_DONE ──► absent
           ▲                     │                       │
           └──────── OPEN ───────┘◄──────── OPEN ────────┘
exiting.effects: ["waitForExit"]   // core/dom/presence.ts, cancelled on OPEN
events: OPEN | CLOSE | EXIT_DONE
```

```ts
// core/dom/presence.ts
export function waitForExit(env: Environment, node: Element, options: { subtree?: boolean }, signal: AbortSignal): Promise<void>
// getAnimations({ subtree }) after the closed state is applied; finite only; re-check when one is
// cancelled and replaced; resolves at once if unsupported, nothing runs, or document.hidden
```

Component machines do not wait on presence (§ spec "Closed Means Closed
Immediately"); their parts each run a presence service (sibling services, as
add-foundations allows). React `usePresence(open, ref)` commits the unmount with
`flushSync` (base-ui#979) and exposes `keepMounted` / `onExitComplete`. During
`exiting`, the layer is released (`release()`), content is `inert`, and
`dispose()` runs on `absent`. *Alternatives:* `animationend` listeners
(Radix/Zag — keyframes only, missed events zag#3349); a `data-starting-style`
attribute (Base UI) — replaced by `@starting-style` (native-platform §10).

### 11. Test fixture and traits

`packages/testing/fixtures/layer/`: a minimal machine (`closed`/`open`, events
`OPEN`, `CLOSE { reason }`), connect, contract (traits `layer`, `modal` via prop,
`restores-focus`, `presence`), React parts (Root, Trigger, Portal, Backdrop,
Content, Close) and stories for nested, sibling, toast-above-modal, third-party
portal and native-dialog interop. Not published.

### Resolved open questions

| Question (source) | Decision | Why |
|---|---|---|
| Native `<dialog>`/`popover` (overlay §open, dialog.md) | JS layers; portal interop | §1, native-platform.md |
| Nodes added after open: inert them? (overlay §open) | No — leave alone, and not "outside" | §7 |
| `scrollbar-gutter` vs padding (overlay §open) | Respect the author's `stable`; else padding; never set it | radix#3251, base-ui#4645 |
| iOS `focus()` override (overlay §open) | No prototype patching; touch policy + `overscroll-behavior` | accessibility.md §4.1 forbids patching |
| Announcer inside modal dialogs (accessibility.md §open) | Regions stay at document level, exempt from `inert`, never relocated | Moving a live region re-creates it and breaks "region exists before the message" (cause D). Speech of announcements under an `aria-modal` dialog in VO+Safari becomes a tier-1 manual check in the Dialog change; if it fails, the fix is a quirks-registry entry sending WebKit announcements through `element.ariaNotify` on the topmost modal content (Safari 27) — no change to these specs |
| Keep `aria-modal` (dialog.md) | Kept by components; modality never depends on it (inert does the work) | Costs nothing where AT ignore it |
| Body `pointer-events` | Never | Most-reported bug class (radix#1241 …) |
| Escape phase | Document bubble, honour `defaultPrevented` | §5 |
| Layer cleanup timing | On close; `stop()` runs the same path | react-spectrum#10291, radix#3797 |

## Risks / Trade-offs

- [Leaving late nodes un-inert lets the virtual cursor reach late-loaded page
  content] → documented; content inserted into an element that was already
  marked is inert by inheritance, so apps that mount into their existing root are
  covered; only new direct children of `body` stay reachable, which is what
  extensions and password managers need.
- [CSS `reading-flow` (Chromium) changes Tab order; our DOM-order wrap can skip
  elements, zag#2611] → wrap only acts at the edges; documented limitation with a
  browser test that tracks it; revisit when `reading-flow` reaches a second engine.
- [`isExitingAt` uses rectangles, not shapes] → acceptable for the bug it fixes; a
  press on a rounded corner of an exiting layer counts as inside.
- [iOS touch policy is device-sensitive] → manual device check on the release
  checklist; Playwright WebKit cannot emulate iOS scrolling.
- [jsdom has no `inert`] → modal trait checks attributes in jsdom and behaviour in
  browser mode, and says so in the run summary.

## Migration Plan

New code only. Dialog is the first consumer (its own change).
