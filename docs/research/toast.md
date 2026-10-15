# Toast — research

Status: done · Wave: 2 (Reado's `Notice` migrates to it)

Shared overlay mechanics (keep-visible rule for outside-inert, presence, portal) are in
[overlay-infrastructure.md](overlay-infrastructure.md); the announcer in
[accessibility.md §7](accessibility.md) and `add-a11y-foundations`; the swipe gesture in
the Drawer note / `add-drawer` (`swipe-gesture`). This note covers the component.

## Pattern

- WAI-ARIA APG: no toast pattern. Closest: [Alert](https://www.w3.org/WAI/ARIA/apg/patterns/alert/)
  (a message announced without moving focus) and the
  [Landmarks](https://www.w3.org/WAI/ARIA/apg/patterns/landmarks/) region (a named place
  the user can jump to). WCAG 4.1.3 Status Messages, 2.2.1 Timing Adjustable, 2.2.2
  Pause/Stop/Hide, 2.1.1 Keyboard, 2.5.1 Pointer Gestures, 2.4.11 Focus Not Obscured.
- Roles and attributes required: a named `region` holding the toasts; each message
  reaches AT as a status (polite) or, for errors, an alert (assertive) **without**
  moving focus; actions inside are ordinary buttons.
- Keyboard: nothing is required by APG. Every library adds a hotkey to move focus into
  the region (Radix F8, Base UI F6, React Aria F6 via landmark navigation, Zag/Ark,
  Kobalte, Sonner Alt+T); Escape on a focused toast dismisses it; Tab moves through
  toasts and their buttons.

## How the others built it

### Zag / Ark UI

- Source: `zag/packages/machines/toast/src/{toast.machine,toast-group.machine,toast.store,toast.connect,toast-group.connect,toast.utils}.ts`; Ark `ark/packages/react/src/components/toast/*` (`createToaster`, `Toaster` render prop, `Toast.Root/Title/Description/ActionTrigger/CloseTrigger`).
- API: `createToaster({ placement, overlap, max: 24, gap: 16, hotkey: ["altKey","KeyT"], removeDelay: 200, pauseOnPageIdle: true })` returns a framework-free **store** (`create/update/remove/dismiss/success/error/loading/promise/pause/resume/expand/collapse`). The `Toaster` part subscribes.
- State model: a **group machine** (`stack | overlap`, hover/focus refs, hotkey and visibility effects) plus **one toast machine per toast** (`visible | visible:persist | visible:updating | dismissing | unmounted`) whose `parent` prop is the group service. Pause is a `paused` prop on each toast pushed by the store. Remaining time kept across pauses (`syncRemainingTime`).
- Notable: the store queues beyond `max` and sorts the queue by **priority** (error/actionable first); `promise()` with per-call tokens so a stale promise cannot overwrite a re-created toast; HTTP `Response` with `!ok` routed to error; heights measured with `offsetHeight` (ignores the `scale` of overlapped siblings, zag#3173) and a MutationObserver; "ghost" elements between toasts so hover is not lost in gaps; region marked as a dismissable *branch* so toast presses don't close layers.
- Problems: the region is `role="region"` **and** `aria-live="polite"` and each toast is `role="status"` — double live semantics; landmark noise questioned (zag#2988); `aria-labelledby` to a never-rendered title (zag#3400); toasts created before mount lost (zag#2922); queue skipped toasts (zag#2403); explicit pause lost on tab switch (zag#2238); Tab skipped the close button (zag#2258); toast press closed a dialog (zag#885, ark#2974 "not fixed").

### Radix (and Reka UI)

- Source: `radix/packages/react/toast/src/toast.tsx` (1,040 lines); Reka `reka-ui/packages/core/src/Toast/*` (port, plus a newer `createToastManager.ts` / `useToastManager.ts`).
- API: `Provider` (`label`, `duration` 5000, `swipeDirection` right, `swipeThreshold` 50), `Viewport` (`hotkey` F8, `label: "Notifications ({hotkey})"`), `Root` (controlled `open`, `type: foreground | background`), `Title`, `Description`, `Action` (required `altText`), `Close`. No store: the app renders `Root`s itself.
- State: per-toast timers in refs; the viewport dispatches custom `pause`/`resume` events on hover, focus-in and **window blur**; `isClosePausedRef` shared.
- Notable: the visible toast is **not** what is announced — `ToastAnnounce` renders a visually hidden `role=status` copy of the text **in the next frame** ("NVDA"), removed after 1 s, with `Action`'s `altText` instead of its label ("Undo (Alt+U)") so SR users learn the alternative; toasts are `li` in an `ol` with **reverse-order Tab** handling (newest first) and `FocusProxy` sentinels at both ends; `--radix-toast-swipe-move-x/y` / `-end-x/y` CSS vars and `data-swipe=start|move|cancel|end`; Escape on a focused toast closes only that toast.
- Problems: invalid roles on `li`/`ol` (radix#1750, #3190; reka#2486); sentinels `aria-hidden` + `tabindex=0` (radix#2584, reka#2776); `aria-live="off"` regression (radix#3634); timers stuck after Close/Action (radix#2268, #2461) and after duration change (radix#2233); window blur from an iframe pauses forever (radix#1362); Escape closed two toasts (radix#2906); viewport inside a dialog's `aria-hidden` subtree yet clickable (radix#4115, open); swipe stuck when released outside the window (radix#4141, open); RTL swipe stuck to LTR (radix#2368); browser translation missed (radix#2060); timeout not cleared on unmount (radix#3703).

### React Aria / React Spectrum

- Source: `react-aria/src/toast/{useToast,useToastRegion}.ts`, `react-stately/src/toast/useToastState.ts` (`ToastQueue`, `Timer`), RAC `Toast.tsx`, Spectrum `ToastContainer.tsx`.
- API: a `ToastQueue` class (framework-free, `add/close/pauseAll/resumeAll/clear`, `maxVisibleToasts`, `wrapUpdate` for View Transitions), `useToastQueue` via `useSyncExternalStore`; `ToastRegion` → `Toast` (`role="alertdialog"`, `aria-modal=false`, tabbable) → content `role="alert"`, `aria-hidden` until a layout effect flips it ("required for NVDA").
- Notable: region is a **landmark** registered with the landmark manager, so **F6** cycles to it like any other landmark; `data-react-aria-top-layer` keeps it out of `ariaHideOutside`, focus scopes and outside-dismissal; when the focused toast is removed focus goes to the **next newer toast**, or back to where the user came from **if the modality is pointer** ("otherwise timers appear stuck"); restore on empty/unmount; Spectrum: **actionable toasts never auto-dismiss** ("would fail WCAG 2.2.1") and timeouts are **clamped to ≥ 5000 ms**.
- Problems: `alertdialog` questioned (react-spectrum#7318); title read twice (labelledby = describedby, #5329); toast added to a paused queue ignores later hover (#8131, open); a toast added as another disappears is lost (#9930, open); queue order replaced the visible toast (#7917, open); timers stuck with JS exit animations (#8053, open); hidden under the mobile keyboard (#9681, open).

### Base UI

- Source: `base-ui/packages/react/src/toast/{store.ts,createToastManager.ts,viewport/ToastViewport.tsx,root/ToastRoot.tsx,...}`.
- API: `Toast.Provider` (`timeout` 5000, `limit` 3, `toastManager`), `Viewport`, `Portal`, `Positioner` (anchored toasts), `Root` (`swipeDirection` default `['down','right']`), `Content`, `Title`, `Description`, `Action`, `Close`; `createToastManager()` for use outside React; `promise()`.
- State: one store with `hovering`, `focused`, `isWindowFocused`, `expanded = hovering || focused`; timers per toast with remaining time; toasts beyond `limit` are kept but `limited` → **`inert`**.
- Notable: viewport `role=region` + `aria-live=polite`; toast `role="dialog"` (non-modal) or `alertdialog` for `priority: "high"`, with a visually hidden `role=alert` copy for high priority while the viewport is unfocused; **F6** moves focus into the viewport (with `preventDefault`, only while toasts exist), Shift+Tab out restores focus; expand only on *focus-visible* focus (a click inside doesn't pin it open); CSS vars `--toast-index`, `--toast-offset-y`, `--toast-height`, `--toast-swipe-movement-x/y`, `--toast-frontmost-height`; swipe ignores buttons/inputs and a "change of mind" reverse threshold.
- Problems: Undo unreachable in time by keyboard/SR (mui/base-ui#4253, open — the WCAG 2.2.1 case); `aria-hidden` on a focusable high-priority toast (#5659, open); timers never resumed after window refocus (#4439) and focus changes missed while empty (#5955, open); clicking a closing toast leaves it mounted forever (#5135); re-triggering during exit breaks indexing (#5253); aria-hidden focus warning on close (#3466); `promise()` ignored per-state timeouts (#2291); toasts added before the provider mounts vanish (#4986, open); height not recalculated after promise resolves (#3336).

### Kobalte

- Source: `kobalte/packages/core/src/toast/*` (`toaster.ts` singleton store, `toast-region.tsx`, `toast-list.tsx`, `toast-root.tsx`).
- API: `toaster.show/update/dismiss/promise`; `Toast.Region` (`limit` 3, `hotkey` Alt+T, `swipeDirection`, `pauseOnInteraction`, `pauseOnPageIdle`, `topLayer`, `regionId` for **multiple regions**), `Toast.List`, `Toast` (`priority: high|low` → `role=status` with `aria-live` assertive/polite), progress track/fill parts.
- Problems: never announced (kobalte#411, open); timer stopped after any dismiss (kobalte#564, open).

### Sonner (not a headless library; the reference design)

- Source: `emilkowalski/sonner` `src/{index.tsx,state.ts}` (read via the GitHub API, 2026-10-14).
- API: a module-level `Observer` (`toast()`, `toast.success/error/loading/promise/custom/dismiss`, `toasterId` for multiple toasters), `<Toaster position expand visibleToasts=3 duration=4000 gap=14 hotkey={["altKey","KeyT"]} swipeDirections>`.
- Design worth copying: **collapsed stack** (only the front toast at full size; the others peek behind, scaled), **expanded on hover or hotkey**, offsets from measured heights (`--offset`, `--initial-height`, `--front-toast-height`, `--z-index`, `data-front`, `data-index`, `data-expanded`, `data-visible`); timers pause while expanded, while any toast is being interacted with, and while `document.hidden`; swipe dismiss at **45 px or 0.11 px/ms** with **damped** movement in disallowed directions; the removed toast keeps its offset during the exit animation (`offsetBeforeRemove`); toasts created before the `Toaster` subscribes are replayed on subscribe.
- Problems: section `aria-live=polite` + `aria-relevant="additions text"` (whole region live); fast flick dismisses in an excluded direction (sonner#762); no `pointercancel` reset (#779, open); remounted `Toaster` replays an active toast forever because the timer lives in the component (#786, open); same id shown again during exit is lost (#791, #730, open); toast before subscribe never shown (#723); above Radix dialogs but not swipeable (#667, open); dialogs close when the toast is clicked (radix#2690, base-ui#2938).

### Not shipped

Ariakit (requested: ariakit#464, #7235), Headless UI, Bits UI (points to svelte-sonner, bits-ui#396).

## Accessibility

Applies [accessibility.md](accessibility.md) rules 23–27 and §7, and the toast row of
[assistive-tech-and-a11y-testing.md §1.4](assistive-tech-and-a11y-testing.md#14-by-component-pattern):
"the Announcer speaks; the visible toast is not a live region; pause the timer on focus
and hover; actions need an alternative".

- **Who speaks.** Every library that makes the visible toast (or the whole region) a live
  region hit cause D: first message silent (radix#3634, reka#2469 TalkBack, kobalte#411,
  RA#5191), JSON text (reka#2611), double reading. A live region that mounts with its
  text is not a change. **Decision:** the region and the toasts carry **no `aria-live`**;
  each show and each content update (promise loading → success) is one Announcer call,
  `polite`, `assertive` only for `type: "error"`, keyed per toast id so a quick
  loading→success collapses to the last message. The announcer's eager regions, next-frame
  insertion, hidden-tab muting and `lang` handle the rest. The toast contract therefore does
  **not** declare `live-region`.
- **Roles.** `li role=status` / `li role=alert` are invalid (radix#1750, #3190; reka#2486;
  `ul role=region` ark#3686); `alertdialog` (RA) and `dialog` (Base UI) were questioned
  (RA#7318) and lead to `aria-hidden` on focusable nodes (BU#5659). **Decision:** native
  semantics only — `section` named region > `ol` > `li` per toast (listitem; focusable with
  `tabindex=0`, `aria-labelledby` title, `aria-describedby` description, both only when
  rendered: zag#3400, never the same id: RA#5329). The list gives "2 of 3" for free.
- **Landmark noise** (zag#2988): the region is rendered only while it has toasts.
- **Getting there.** F6 (Base UI, RA landmark navigation; F8 in Radix collides less but is
  undiscoverable) moves focus to the newest toast, only while toasts exist; the region's
  name includes the hotkey ("Notifications (F6)", localised); the hotkey is matched with the
  a11y-foundations hotkey matcher. Leaving: Escape on a toast dismisses that toast only
  (radix#2906); Shift+Tab off the first toast, Tab off the last, or the hotkey again return
  focus to where the user was — handled on keydown, **no sentinels** (radix#2584,
  reka#2776, AT note cause F). When the focused toast goes away, focus moves to the next
  newer toast, else back (RA `useToastRegion`), never to `body`.
- **Timing (2.2.1).** Timers pause while the pointer is over the region, while focus is in
  it, while the document is hidden, during a swipe and on an explicit `pause()` — as a
  *set of reasons*, so one ending never cancels another (zag#2238, radix#2268). Toasts with
  an action do **not** auto-dismiss by default (React Spectrum; mui/base-ui#4253). Toasts
  that persist must be dismissible without a gesture: Escape when focused, a close
  trigger (dev warning when a persistent toast renders none — touch screen readers cannot
  Escape or swipe).
- **Window blur** is not a pause reason: an iframe taking focus counts as blur and froze
  toasts (radix#1362), and the blur/refocus bookkeeping broke twice in Base UI (#4439,
  #5955). `document.hidden` covers "the user is not looking".
- **Modals.** The region carries `data-rind-top-layer`, so `inertOutside` keeps it exposed
  and pressable above a modal dialog (radix#4115, radix#2949). It must also never count as
  *outside* for dismissal (zag#885, ark#2974, radix#2690, reka#624, base-ui#2938) — a
  request to `add-overlay-infrastructure`. Escape on a focused toast is consumed
  (`preventDefault`) so the dialog beneath stays open.
- **Gestures (2.5.1).** Swipe is never the only way: Escape and the close trigger.
- **Forced colors**: toast border in `CanvasText`, type conveyed by an icon/text, not only
  colour (Reado already uses a glyph). **Target size**: close trigger ≥ 24×24.
  **Reduced motion**: no slide, swipe follows the finger but the exit is instant.
  **RTL**: `start`/`end` placements and the inline swipe direction mirror (radix#2368).
- **Translation**: text lives in the DOM as real text so page translation reaches it
  (radix#2060); announcement text is taken from the rendered title/description strings
  the consumer passed, not cloned DOM.
- Native platform: `popover="manual"` for paint order is the Wave-2 spike
  (native-platform §2), not assumed here; `ariaNotify` comes for free through the
  Announcer's opt-in backend.

## Bug history

Searched 2026-10-14: `gh search issues` over the ten libraries plus emilkowalski/sonner
for "toast in:title", "toast screen reader", "toast focus", "toast swipe", "toast pause",
"toaster", "toast dialog" (about 400 hits, 230 unique, ~60 read). Every issue cited to
justify a decision was opened and read. **Spec** = became a scenario in `add-toast`.

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| Radix | [#3634](https://github.com/radix-ui/primitives/issues/3634) | Toast never announced | `aria-live="off"` on the announce node | Fixed | Announcer, not component live regions (Spec) |
| Reka | [#2469](https://github.com/unovue/reka-ui/issues/2469) | TalkBack silent | Region mounted with its text | Closed | Same (Spec) |
| Kobalte | [#411](https://github.com/kobaltedev/kobalte/issues/411) | Toasts not announced | Live region semantics | Open | Same |
| Reka | [#2611](https://github.com/unovue/reka-ui/issues/2611) | Announcement read as a JSON array | Announce text built from VNodes | Fixed | Announcement text from the strings passed in (Spec) |
| React Aria | [#5329](https://github.com/adobe/react-spectrum/issues/5329) | Title read twice | labelledby and describedby same id | Fixed | Distinct ids; name ≠ description invariant (Spec) |
| Zag | [#3400](https://github.com/chakra-ui/zag/issues/3400) | `aria-labelledby` to a missing title | Wired from options, not rendered parts | Fixed | Relations only to mounted parts (Spec) |
| Radix | [#1750](https://github.com/radix-ui/primitives/issues/1750), [#3190](https://github.com/radix-ui/primitives/issues/3190) | axe: `ol` in `status`, `li role=status` | Roles on list elements | Fixed | Native `ol`/`li`, no roles (Spec) |
| Reka / Ark | [RK#2486](https://github.com/unovue/reka-ui/issues/2486), [ARK#3686](https://github.com/chakra-ui/ark/issues/3686) | axe: `li role=alert`, `ul role=region` | Same | Fixed | Same |
| Radix / Reka | [RX#2584](https://github.com/radix-ui/primitives/issues/2584), [RK#2776](https://github.com/unovue/reka-ui/issues/2776) | `aria-hidden-focus` on focus proxies | Sentinels | Fixed (twice in Reka) | No sentinels; keydown edges (Spec) |
| Base UI | [#5659](https://github.com/mui/base-ui/issues/5659) | `aria-hidden` on a focusable high-priority toast | Hidden duplicate for alert speech | Open | One element per toast, speech via the Announcer (Spec) |
| React Aria | [#7318](https://github.com/adobe/react-spectrum/issues/7318) | `alertdialog` questioned | Dialog role for a non-dialog | Closed | Listitem, no dialog role |
| Zag | [#2988](https://github.com/chakra-ui/zag/issues/2988) | Empty toaster is a landmark | Region always rendered | Closed | Region only while non-empty (Spec) |
| Base UI | [#4253](https://github.com/mui/base-ui/issues/4253) | Undo can't be reached by keyboard/SR in time | Auto-dismiss + no path in | Open | Actionable toasts persist by default; F6; hint in announcement (Spec) |
| Radix | [#2906](https://github.com/radix-ui/primitives/issues/2906) | Escape on a focused toast closes two | Toast and top layer both handled Escape | Fixed | Escape dismisses only the focused toast and is consumed (Spec) |
| Zag | [#2258](https://github.com/chakra-ui/zag/issues/2258) | Tab skips the close button, loops back | Custom Tab order | Fixed | Native order inside a toast (Spec) |
| Zag | [#2235](https://github.com/chakra-ui/zag/issues/2235) | Hotkey does nothing in one setup | Region looked up by placement id | Fixed | Hotkey goes through the store's mounted region |
| Radix | [#2268](https://github.com/radix-ui/primitives/issues/2268), [#2461](https://github.com/radix-ui/primitives/issues/2461) | After Close/Action, later toasts never expire | Focus-in pause, no matching resume | Fixed | Pause reasons are a set; removal clears its reasons (Spec) |
| Kobalte | [#564](https://github.com/kobaltedev/kobalte/issues/564) | Timer stops after any dismiss | Same class | Open | Same |
| Zag | [#2238](https://github.com/chakra-ui/zag/issues/2238) | Explicit pause lost on tab switch | Visibility resume overrode API pause | Fixed | Same (Spec) |
| Radix | [#2233](https://github.com/radix-ui/primitives/issues/2233) | Promise toast never closes | Remaining time `Infinity` kept after update | Fixed | Update resets remaining time (Spec) |
| Zag | [#295](https://github.com/chakra-ui/zag/issues/295) | Toast closes right after unpausing | Remaining time reset per pause | Fixed | Remaining time preserved (Spec) |
| Radix | [#1362](https://github.com/radix-ui/primitives/issues/1362) | Iframe focus pauses toasts forever | Window blur = pause | Closed | Window blur is not a reason (Spec) |
| Base UI | [#4439](https://github.com/mui/base-ui/issues/4439), [#5955](https://github.com/mui/base-ui/issues/5955) | Timers never resume after refocus; missed while empty | Blur/focus bookkeeping | Fixed / open | Same; `document.hidden` only |
| React Aria | [#8131](https://github.com/adobe/react-spectrum/issues/8131) | Toast added to a paused queue ignores hover | New toast not given current reasons | Open | New toasts inherit the region's reasons (Spec) |
| Zag / Sonner / Base UI | [ZG#2922](https://github.com/chakra-ui/zag/issues/2922), [SN#723](https://github.com/emilkowalski/sonner/issues/723), [BU#4986](https://github.com/mui/base-ui/issues/4986) | Toast shown before the toaster mounts is lost | Store lived in the component | Fixed / fixed / open | Store outside the tree; region shows existing toasts (Spec) |
| Sonner | [#786](https://github.com/emilkowalski/sonner/issues/786) | Remounted toaster re-shows a toast forever | Timer in the component | Open | Timer in core; paused while no region is mounted (Spec) |
| Sonner / Base UI | [SN#791](https://github.com/emilkowalski/sonner/issues/791), [SN#730](https://github.com/emilkowalski/sonner/issues/730), [BU#5253](https://github.com/mui/base-ui/issues/5253) | Same id shown during exit is lost or mis-indexed | Merged into the leaving toast | Open / open / fixed | A show during exit creates a new instance (Spec) |
| React Aria | [#9930](https://github.com/adobe/react-spectrum/issues/9930) | Toast added while another disappears not shown | Visible slice recomputed racily | Open | Store operations are synchronous, ordered (Spec) |
| Zag / RA | [ZG#2403](https://github.com/chakra-ui/zag/issues/2403), [RA#7917](https://github.com/adobe/react-spectrum/issues/7917) | Toasts beyond max skipped / replace visible | Queue dropped or reordered | Fixed / open | Over the limit: older toasts are held, not dropped (Spec) |
| Base UI | [#5135](https://github.com/mui/base-ui/issues/5135) | Clicking a closing toast keeps it mounted forever | Interaction re-armed exit | Fixed | Exiting toast is inert; presence completes (Spec) |
| Base UI | [#3466](https://github.com/mui/base-ui/issues/3466) | aria-hidden focus warning on close | Focus stayed in the closing toast | Fixed | Move focus before the toast becomes inert (Spec) |
| Base UI | [#2291](https://github.com/mui/base-ui/issues/2291) | Promise ignores per-state timeouts | Options not merged | Fixed | Per-state options (Spec) |
| Zag / Base UI | [ZG#3173](https://github.com/chakra-ui/zag/issues/3173), [BU#3336](https://github.com/mui/base-ui/issues/3336) | Wrong heights in the stack | Measured with the scale; not re-measured | Fixed | Layout height + ResizeObserver (Spec) |
| Ark | [#3404](https://github.com/chakra-ui/ark/issues/3404) | Hovering between toasts collapses the stack | Hover per toast, gaps not covered | Fixed (ghosts) | Hover tracked on the region (Spec) |
| Zag / Ark / Radix / Reka / Base UI | [ZG#885](https://github.com/chakra-ui/zag/issues/885), [ARK#2974](https://github.com/chakra-ui/ark/issues/2974), [RX#2690](https://github.com/radix-ui/primitives/issues/2690), [RK#624](https://github.com/unovue/reka-ui/issues/624), [BU#2938](https://github.com/mui/base-ui/issues/2938) | Pressing a toast closes the open dialog/drawer | Toast region counted as outside | Mixed ("not fixed" in Ark) | Top-layer regions are never outside (Spec; request to overlay change) |
| Radix | [#4115](https://github.com/radix-ui/primitives/issues/4115), [#2949](https://github.com/radix-ui/primitives/issues/2949) | Toast inside a dialog's hidden subtree but clickable; hidden behind dialogs | Hide-outside walk | Open / closed | `data-rind-top-layer` (Spec) |
| Sonner | [#667](https://github.com/emilkowalski/sonner/issues/667) | Toast over a dialog can't be swiped | Body pointer blocking | Open | No pointer-events hacks (overlay) |
| Radix / Sonner | [RX#4141](https://github.com/radix-ui/primitives/issues/4141), [SN#779](https://github.com/emilkowalski/sonner/issues/779) | Toast stuck half-swiped | No release outside window / no `pointercancel` | Open | Owned by `swipe-gesture` (Spec) |
| Sonner | [#592](https://github.com/emilkowalski/sonner/issues/592) | Strict Mode effect `show` + cleanup `dismiss` loses the toast | Deferred dismiss raced the re-show | Fixed | Synchronous store ops; Strict Mode test |
| Sonner | [#762](https://github.com/emilkowalski/sonner/issues/762) | Flick dismisses in an excluded direction | Velocity checked without direction | Fixed | Guard needs an allowed, non-null direction (Spec) |
| Radix | [#2368](https://github.com/radix-ui/primitives/issues/2368) | RTL swipe stuck to the right | Physical default | Closed | Inline-end default mirrors (Spec) |
| Radix | [#2060](https://github.com/radix-ui/primitives/issues/2060) | Browser translation misses toasts | Text cloned/inserted oddly | Closed | Real DOM text |
| Radix | [#3703](https://github.com/radix-ui/primitives/issues/3703) | `document is not defined` after teardown | Timeout not cleared | Fixed | Scheduler-injected timers |
| Reka | [#2782](https://github.com/unovue/reka-ui/issues/2782) | Every dismissed toast leaks its DOM | Listener cleanup never registered | Fixed | Service stop cleans everything |
| React Aria | [#8053](https://github.com/adobe/react-spectrum/issues/8053) | Timers stuck with JS exit animations | Removal tied to animation lib | Open | Presence + `onExitComplete` |
| React Aria | [#9681](https://github.com/adobe/react-spectrum/issues/9681) | Toast under the mobile keyboard | Fixed to layout viewport | Open | Open question |

## Known pitfalls

- Making the visible toast a live region (silent first toast, double speech).
- Timers in components (lost before mount, replayed after remount, leaked after unmount).
- One `paused` boolean shared by hover, focus, visibility and API.
- Focus sentinels, roles on list elements, `aria-hidden` on focusable nodes.
- Toast presses dismissing the open dialog/drawer.
- Same id re-shown while exiting.

## Testing notes

- Fake timers through the injected scheduler; the `timed` invariant (add-tooltip) checks
  that no toast's timer elapses while the region is hovered, focused, the document is
  hidden, or the toast is being swiped.
- Announcements asserted from the recording announcer / virtual screen reader: exactly one
  per show or content update, `assertive` only for errors.
- Swipe through the shared drag input of `swipe-gesture`; `document.hidden` via a fake
  visibility capability.
- Driver: `getToaster(screen, { name })` (region) and `getToast(screen, { name })` (one
  toast by title).

## Decisions

- **Parts**: `region` (`section`), `list` (`ol`), `root` (`li`), `title`, `description`,
  `action-trigger`, `close-trigger`. React: `Toaster` (region + list, render function per
  toast) and `Toast.Root/Title/Description/ActionTrigger/CloseTrigger`.
- **Store**: `createToaster(options)` in core, framework-free, importable anywhere (Reado's
  `notify()`); one store per toaster, so multiple toasters are multiple stores; toasts and
  timers live in the store, not in the parts.
- **Machines**: a `toaster` machine (`collapsed | expanded`) and one `toast` machine per
  toast (`timing | paused | persistent | dismissed`) run as sibling services owned by the
  store; the store forwards region-level pause reasons.
- **Defaults**: placement `bottom-end`, `limit` 3 visible, `duration` 5000 ms, `loading`
  and actionable toasts persistent, hotkey `F6`, swipe directions = placement edge +
  inline end, dismiss at 45 px or 0.11 px/ms, collapsed stack expanded on hover/focus.
- **`data-*`** and contract: see `add-toast`.
- **Deliberately different**: no live region in the component; native list semantics; no
  sentinels; pause reasons as a set; window blur not a pause reason; store-owned timers that
  only count while a region shows the toast; actionable toasts persist by default; top-layer
  regions never "outside".

## Open questions

- Mobile on-screen keyboard covering bottom toasts (RA#9681): `visualViewport` offset as a
  CSS variable, or theme-only `env(keyboard-inset-height)`? Deferrable (theme).
- F6 collides with browsers' own F6 pane cycling (it is only intercepted while toasts
  exist, as Base UI). Revisit if a landmark manager lands for all regions.
