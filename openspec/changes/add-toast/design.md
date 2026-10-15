## Context

See proposal.md for motivation and specs/toast/spec.md for behaviour; the research and
Bug history the scenarios cite are in [toast.md](../../../docs/research/toast.md). This
change consumes, without restating:

| From | Used for |
|---|---|
| `add-foundations` | `setup()/machine()`, delayed transitions on the scheduler, effects, sibling services, contracts, drivers, `testMachine`, `useMachine`, ids, `data-instance` |
| `add-a11y-foundations` | `Announcer` (`prepare`, `announce`, keys, hidden-tab muting, `lang`), `KEEP_VISIBLE_SELECTOR`, `hover` (mouse/pen only), `press`, modality and focus cause, `focusSafely`, the hotkey matcher, `messages` + provider, `partId`, dev logger |
| `add-overlay-infrastructure` | outside-inert keep-visible set (`data-rind-top-layer`), `presence` machine + `usePresence`, `Portal`, focus-restore's connected/not-inert check and WeakRef history |
| `add-collections` | the `Clock` capability (`now()`) for remaining time |
| `add-tooltip` | the `timed` invariant in `@rind-ui/testing`, `focusWithTab` |
| `add-drawer` | `swipe-gesture` (`trackSwipe`, `SWIPE.START` / `SWIPE` / `SWIPE.CANCEL`, `--rind-toast-swipe-x/-y/-progress`, the drag test input) |
| `add-theme-system` | tier-3 component tokens |

## Goals / Non-Goals

**Goals:**
- Lifetime, pausing and announcements live in core and are testable in Node with fake
  scheduler, clock, visibility and announcer — no component needs to be mounted.
- Parts hold no behaviour; the React `Toaster` only subscribes to the store.
- Reado's `notify()`/`notifyError()` port by swapping the zustand store for a
  `createToaster()` store.

**Non-Goals:**
- Hierarchical states or machine spawning (the runtime has neither): the store owns
  sibling services.

## Decisions

### 1. Store, not a component, owns toasts

```ts
// core/components/toast/toaster.ts
export function createToaster(options?: ToasterOptions): Toaster
export interface Toaster {
  show(t: ToastInput): ToastId; success/info/warning/error/loading(t: ToastInput | string): ToastId
  promise<T>(p: Promise<T> | (() => Promise<T>), o: PromiseToastOptions<T>, shared?: ToastInput):
    { id: ToastId; result: Promise<T> }
  update(id: ToastId, patch: Partial<ToastInput> | ((t: ToastData) => Partial<ToastInput>)): void
  dismiss(id?: ToastId): void; pause(id?: ToastId): void; resume(id?: ToastId): void
  get(id: ToastId): ToastSnapshot | undefined; toasts(): readonly ToastSnapshot[]
  subscribe(fn: () => void): () => void
  /** Used by regions: binds the store to an environment while a region is mounted. */
  attach(env: ToasterEnv): () => void
}
```

The store holds an ordered list of records `{ instance, data, service }`; `instance` is a
branded per-show key (distinct from the consumer `id`) so a re-show during exit is a new
record (sonner#791). Until a region attaches, the store keeps data only and services use
a detached environment whose "no region" reason pauses every lifetime; `attach` starts
the services with the region's environment (scheduler, clock, announcer, visibility).
The last `attach` cleanup pauses them again with reason `unmounted`. This puts timers in
core (no component lifetime: sonner#786, radix#3703) without needing a global
environment. *Alternatives:* Zag's store + group machine with a `parent` prop (two-way
coupling between services); Radix's render-your-own `Root`s (no imperative API, radix#2804);
a module-level singleton (Kobalte, Sonner) — rejected: multiple toasters and tests need
instances, and Reado's module-level `export const toaster = createToaster()` is just as
convenient.

### 2. Machines

```
toast:   timing ──PAUSE──► paused ──RESUME(no reasons left)──► timing
           │  after:remaining → dismissed(timeout)          ▲
           ├─ UPDATE[persistent] ─► persistent ─UPDATE[finite]─┘
           └─ DISMISS | ACTION | CLOSE | ESCAPE_KEY | SWIPE[guard] ─► dismissed
         persistent, paused accept the same dismiss events; dismissed is final (REMOVE by presence)
toaster: collapsed ──EXPAND──► expanded ──COLLAPSE[not swiping, no hover, no focus]──► collapsed
```

```ts
type ToastEvent =
  | { type: "PAUSE" | "RESUME"; reason: PauseReason }        // hover | focus | hidden | swipe | unmounted | limited | api
  | { type: "UPDATE"; data: ToastData }
  | { type: "CLOSE_TRIGGER_PRESS" | "ACTION_PRESS" | "ESCAPE_KEY"; modality: Modality }
  | { type: "SWIPE.START"; modality: "pointer" | "touch" }
  | { type: "SWIPE"; direction: SwipeDirection | null; offset: number; velocity: number; size: number }
  | { type: "SWIPE.CANCEL" }
  | { type: "DISMISS" }                                       // api
  | { type: "MEASURED"; height: number }
type ToasterEvent =
  | { type: "HOVER.START" | "HOVER.END"; modality: Modality }
  | { type: "FOCUS.ENTER" | "FOCUS.LEAVE"; modality: Modality; from: Element | null }
  | { type: "HOTKEY" } | { type: "VISIBILITY"; hidden: boolean } | { type: "SWIPING"; active: boolean }
```

- Context of `toast`: `reasons: ReadonlySet<PauseReason>`, `remaining`, `startedAt`
  (from `Clock`), `dismissReason`, `height`, `rendered: { title?, description? }`.
  `PAUSE` adds a reason (and, in `timing`, writes `remaining -= now - startedAt`);
  `RESUME` removes it and goes to `timing` only when the set is empty
  (guard `noReasonsLeft`). This is the fix for zag#2238, radix#2268, kobalte#564.
- `UPDATE` resets `remaining` to the new duration (radix#2233) and picks `timing`,
  `persistent` or `paused` from guards `isPersistent` (loading, `Infinity`, action
  without explicit duration) and `hasReasons`.
- `SWIPE` dismisses only through guard `swipeDismisses`: direction non-null and in the
  allowed set, `offset >= swipeThreshold` (45) or `velocity >= swipeVelocity` (0.11).
- The `toaster` machine owns region-level reasons; the store forwards them as
  `PAUSE`/`RESUME` to every record when they change and applies the current ones to a
  new record before it starts (react-spectrum#8131). Both machines' graphs are static.
- Reasons `limited`: the store recomputes presented vs held records after every
  operation (limit from options) and sends `PAUSE/RESUME { reason: "limited" }`.
- *Alternative:* a read-only `paused` prop binding (`bindProp`) — rejected: a bound state
  cannot be left by events, and a toast has its own reasons (swipe, api) on top of the
  region's.

### 3. Announcements

An effect of the `toast` machine announces on start and on `UPDATE` that changes title,
description or type: `announce({ message: messages.announce(data) + hint, priority: type
=== "error" ? "assertive" : "polite", key: \`toast-${id}\`, lang })`. The region calls
`announcer.prepare()` when it mounts. No live region anywhere (cause D, AT note §1.4).
Held (`limited`) toasts are not re-announced when presented again.

### 4. Region, focus and the hotkey (connect + `core/dom/toast-region.ts`)

- The hotkey listener is a document `keydown` (bubble) installed by the region's effect
  while toasts exist, matched with the a11y hotkey matcher; it records the focused
  element (through focus-restore's capture: connected/not-inert check, WeakRef history)
  and `focusSafely`s the newest presented toast.
- Leaving is a `keydown` handler on the region for Tab/Shift+Tab at the edges (computed
  from the sequential order inside the region) and the hotkey; no sentinels (AT note
  cause F).
- Focus on removal: before a focused record's content becomes inert, the region moves
  focus to the next newer, else next older presented toast, else restores (pointer
  modality restores directly, as React Aria).
- `FOCUS.ENTER` with pointer modality pauses but does not expand (Base UI: a click
  inside does not pin the stack open); keyboard/virtual focus expands.

### 5. Measurement (`core/dom/toast-stack.ts`)

`measureToast(el, onHeight)`: `offsetHeight` with inline `height` temporarily `auto`
(ignores transforms, zag#3173), then a `ResizeObserver` while mounted (base-ui#3336),
sending `MEASURED`. Offsets are computed in connect from the store's presented order
and heights (state → CSS variables; like `selection-indicator`, never imperative
writes); an exiting record keeps its last offset. Swipe movement is the only
continuously written style, and `swipe-gesture` owns it.

### 6. Parts (React)

`Toaster({ toaster, children: (toast) => ReactNode, messages, … })` renders, while
non-empty, `Portal` → `section` (region) → `ol` (list) → one `li` per record via
`Toast.Root` with `usePresence`; `Toast.Title`, `Description`, `ActionTrigger`,
`CloseTrigger` register on mount/unmount so relations point only at rendered parts.
`useToaster(toaster)` exposes `toasts()` via `useSyncExternalStore`.

### 7. Contracts

```ts
export const toasterContract = contract(toasterMachine, {
  scope: "toast", anatomy: ["region", "list", "root"],
  locate: { role: "region", name: true },
  actions: { enter: { keyboard: hotkey, pointer: hover region, touch: { none: "touch has no hover; tap a toast's buttons instead" } },
             leave, waitForAll },
  queries: { titles, count, isExpanded, isPaused, hasFocus, announcements },
  events: { HOTKEY: "enter", "HOVER.START": "enter", "HOVER.END": "leave", "FOCUS.ENTER": "enter",
            "FOCUS.LEAVE": "leave", VISIBILITY: { skip: "store-level; unit tests" }, SWIPING: { skip: "covered by toast swipe" } },
  traits: ["timed", "presence"],
})
export const toastContract = contract(toastMachine, {
  scope: "toast", anatomy: ["root", "title", "description", "action-trigger", "close-trigger"],
  locate: { role: "listitem", name: true },
  actions: { dismiss, swipe /* keyboard: { none: "dismiss (Escape) is the keyboard twin" } */, act, hover, unhover, waitForTimeout },
  queries: { isShown, type, title, description, isPaused, isLimited, dismissReason },
  events: { CLOSE_TRIGGER_PRESS: "dismiss", ESCAPE_KEY: "dismiss", ACTION_PRESS: "act", SWIPE: "swipe",
            "SWIPE.START": { skip: "part of swipe" }, "SWIPE.CANCEL": { skip: "unit-tested in swipe-gesture" },
            DISMISS: { skip: "api" }, UPDATE: { skip: "api" }, MEASURED: { skip: "layout" } },
  traits: ["timed", "presence"],
})
```

The `timed` invariant reads hovered/focused/hidden from the oracle (the toast's
`reasons`), so it covers every reason without toast-specific code.

### 8. Theme (`packages/theme/src/toast.css`)

Tier-3 tokens `--rind-toast-{bg,fg,border,radius,shadow,padding,gap,width,offset,
duration}` and per type `--rind-toast-{success,warning,error,info}-accent`, defaulting
to semantic tokens. Collapsed stack (front at full size, the next two peeking with
`scale` and `translateY` from `--rind-toast-index`), expanded with
`--rind-toast-offset`, a region `::after` filling the gaps so hover is continuous
(ark#3404), swipe from `--rind-toast-swipe-x/-y`, `@starting-style` entry and
`[data-state=closed]` exit, exit direction from `data-swipe-out` +
`data-swipe-direction`, safe-area insets, reduced motion (no slide), forced colors
(border `CanvasText`, type glyph kept), close trigger ≥ 24×24.

### Requests to other changes (APPLIED: add-overlay-infrastructure task A.2)

1. **`add-overlay-infrastructure` / `dismissable-layer`**: presses and focus inside
   elements matching the keep-visible rule's `[data-rind-top-layer]` SHALL NOT count as
   outside any layer (neither `outside-press` nor `outside-focus`). Today only
   outside-inert honours it; without this every dialog or drawer that closes on outside
   press closes when a toast is pressed (zag#885, ark#2974, radix#2690, reka-ui#624,
   mui/base-ui#2938). Popover's `persistentElements` would no longer be needed for
   toasts. Proposed scenario: "Pressing a toast keeps the dialog open" (as in this
   spec). Task 0.2 blocks on it.
2. **`add-drawer` / `swipe-gesture`**: none beyond the agreed shape; this change uses
   `canStart` to exclude nothing extra (mouse never starts on buttons, per that spec)
   and the drag input for the `swipe` contract action.

### Resolved open questions (toast.md)

| Question | Decision | Why |
|---|---|---|
| Live region vs Announcer | Announcer only | cause D bugs in four libraries |
| Role of a toast | `li`, no role | valid HTML-ARIA; dialog/alertdialog roles questioned (RA#7318, BU#5659) |
| Hotkey | F6 while toasts exist | Base UI, RA landmarks; configurable |
| Window blur | not a reason | radix#1362, base-ui#4439, #5955 |
| Actionable lifetime | persistent unless `duration` given | WCAG 2.2.1, React Spectrum, BU#4253 |
| Beyond the limit | held (inert, paused), never dropped | zag#2403; Base UI `limited` |

## Risks / Trade-offs

- [F6 is also the browsers' pane-cycling key] → intercepted only while toasts exist;
  configurable; announced in the region name and the action hint.
- [Actionable toasts persisting can pile up] → `limit` holds older ones; consumers can
  set a `duration`; documented.
- [`li` focus target with no widget role] → name and description still spoken on focus;
  tier-1 manual check (NVDA browse/focus mode, VO iOS).
- [Clock and scheduler must agree under fake timers] → `@rind-ui/testing` fakes both from
  one source (add-collections' fake clock).
- [Request 1 lands in another change] → task 0.2 blocks; until then the scenario fails,
  which is the intended signal.

## Migration Plan

Reado: replace `lib/notice.ts`'s zustand store with `export const toaster =
createToaster({ placement: "bottom-center", limit: 4 })`; `notify(kind, text, action)` →
`toaster[kind]({ title: text, action: action && { label: action.label, onAction:
action.run } })`; `Notice.tsx` becomes a `Toaster` render function; `role="alert"` on
errors goes away (assertive announcement instead). Reado's "drop beyond 4" becomes
"hold beyond 4".

## Open Questions

- Mobile on-screen keyboard avoidance (RA#9681): theme-only or a `visualViewport` CSS
  variable. Neither changes the specs.
