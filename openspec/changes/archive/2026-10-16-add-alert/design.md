## Context

See proposal.md and [alert.md](../../../docs/research/alert.md) (the Accessibility
section explains why the native live role is not used). This change consumes, without
restating:

| From | Used for |
|---|---|
| `add-foundations` | `setup()`/`machine()`, `controllable` (`open`), `$sync`, change details, effects, service lifecycle (late sends ignored), contracts (`{ skip }`, prop steps), drivers, `testMachine`, React adapter (`render`, ids, part registration, `data-instance`) |
| `add-a11y-foundations` | `Announcer.announce`/`prepare`, recording backend + driver announcement log, keep-visible rule (announcer survives hide-outside), `messages` + provider + locale, `focusSafely` (modality kept), dev logger, invariants (rule 23 "no `aria-live` of its own", rule 11 focus never on `body`) |
| `add-overlay-infrastructure` | `presence` (exit animation, `data-state="closed"` hook) and its `presence` contract trait; `tabbables()` for the focus target after dismissal |
| `add-theme-system` | tokens, `@layer rind.components`, `status` family (Alert listed), contrast checks, motion tokens |
| `add-heading` | only the docs/story recipe `Alert.Title render={<Heading />}` |

## Goals / Non-Goals

**Goals:** one announcement per appearance or change, none at load; no live region in
the visible tree; focus never lost on dismissal; a Node-testable announcement count.

**Non-Goals:** auto-dismiss, stacking, focus on appearance (proposal Non-goals).

## Decisions

### 1. Layout

```
packages/core/src/components/alert/
├─ alert.machine.ts     open | closed
├─ alert.connect.ts     root/icon/title/description/closeTrigger props
├─ alert.contract.ts
└─ alert.messages.ts    dismiss, announcement(segments)
packages/core/src/dom/alert-text.ts   announceableText(root, parts) + observeText(root, cb)
packages/react/src/alert/             Root, Icon, Title, Description, CloseTrigger
packages/theme/src/alert.css
```

### 2. Machine

```
            CLOSE{reason}  (moveFocusIfInside → notify onOpenChange)
   open ─────────────────────────────────────────► closed
     ▲                                               │
     └────────────── $sync:open (true) ──────────────┘   (announce on entry, if mounted & client)
   open:   ROOT.MOUNT{hydrating, text} · CONTENT.CHANGE{text} → announce (guarded)
```

```ts
type AlertEvent =
  | { type: "ROOT.MOUNT"; hydrating: boolean; text: string }
  | { type: "CONTENT.CHANGE"; text: string }
  | { type: "CLOSE"; reason: "close-trigger"; focusInside: boolean }

setup({ guards: { canAnnounce /* props.announce !== "off" */, isMounted },
        actions: { announceText, setMounted, setText, moveFocusIfInside, prepareAnnouncer } })
.machine({
  id: "alert",
  context: () => ({ mounted: false, text: "" }),
  values: { open: controllable("open", { default: true }) },
  initial: "open",            // resolved from open/defaultOpen
  on: { "ROOT.MOUNT": { actions: ["setMounted", "setText", "prepareAnnouncer"] } },
  states: {
    open: {
      entry: [{ action: "announceText", guard: ["isMounted", "canAnnounce"] }], // $sync re-entry
      on: {
        "ROOT.MOUNT": { actions: ["setMounted", "setText", "prepareAnnouncer",
                                  { action: "announceText", guard: ["notHydrating", "canAnnounce"] }] },
        "CONTENT.CHANGE": { guard: "textChanged",
                            actions: ["setText", { action: "announceText", guard: "canAnnounce" }] },
        CLOSE: { target: "closed", actions: ["moveFocusIfInside"] },
      },
    },
    closed: { on: { "CONTENT.CHANGE": { actions: ["setText"] } } },
  },
})
```

- **Hydration flag.** The React Root reads `hydrating` with `useSyncExternalStore(noop,
  () => false, () => true)` (the server snapshot is used during hydration and the server
  render only) and sends it with `ROOT.MOUNT` from its mount effect. Server-rendered
  alerts therefore never announce; client mounts do. This is local to Alert: if a second
  component needs "was server-rendered", it moves to the React adapter (CLAUDE.md:
  generalise on the second use).
- **`announceText`**: `env.announcer.announce({ message: props.announcement ??
  messages.announcement(context.segments), priority: props.announce, key:
  \`alert-${id}\`, lang: locale })`, skipped when the message is empty. The key makes the
  Announcer's debounce collapse Strict Mode's double mount and text bursts.
- **`prepareAnnouncer`** runs on mount when `announce !== "off"` (and when `announce`
  changes to a live value) — regions exist before the first message (cause D).
- **`moveFocusIfInside`** (effect, `core/dom`): if `focusInside`, pick `finalFocus(details)`
  → else the first element of `tabbables(document)` after the Root in document order →
  else the last one before it; `focusSafely` (modality kept). Runs *before* the
  controllable notifies `onOpenChange`, so a consumer that unmounts in response cannot
  strand focus. No target → dev warning.
- **No `CLOSE` from Escape** and no auto-close timer (not a layer, not a toast).
- *Alternatives:* `role="alert"` on Root (rejected, research §"Why rind-ui's Alert does
  not render role=alert"); a persistent per-alert empty region filled after mount (Base
  UI's mutation nudge) — still a live region in the visible tree, still re-speaks on DOM
  moves, still hidden by hide-outside, and duplicates the Announcer.

### 3. Text to announce (`core/dom/alert-text.ts`)

- `announceableText(root)`: segments from the registered Icon `label`, Title and
  Description elements (or Root when neither is registered): `textContent` walked with a
  `TreeWalker` that skips `[aria-hidden="true"]`, `[hidden]` and the CloseTrigger
  subtree, whitespace collapsed. Visually hidden text is plain DOM text, so it is kept.
- `observeText(root, cb)`: one `MutationObserver` (`childList`, `characterData`,
  `subtree`, plus `attributes` filtered to `hidden`/`aria-hidden`) that recomputes the
  segments after each batch and calls `cb` only when the joined text differs — the
  source of `CONTENT.CHANGE`, independent of which component re-rendered.
- Connected by the React Root in its mount effect; disconnected on unmount (late
  callbacks are dropped by the service lifecycle).

### 4. Connect output

| Part | Attributes |
|---|---|
| Root | `div`, `id`, `data-state="open|closed"`; no role, no live attributes; dev warning for consumer live role/attrs |
| Icon | `span`, `aria-hidden="true"`, or `role="img"` + `aria-label={label}` |
| Title | `div`, `id` (derived; for the region recipe) |
| Description | `div`, `id` |
| CloseTrigger | `button type="button"`, `aria-label={messages.dismiss}` only when it has no text and no consumer name; `onClick` → `CLOSE { reason: "close-trigger", focusInside }` |

All parts: `data-scope="alert"`, `data-part`, `data-instance`. No inline styles.

### 5. Contract

```ts
export const alertContract = contract(alertMachine, {
  scope: "alert",
  anatomy: ["root", "icon", "title", "description", "close-trigger"],
  locate: (opts: { title?: string; within?: PartHandle }) =>
    opts.title ? { part: "root", has: { part: "title", text: opts.title } } : { part: "root", within: opts.within },
  actions: {
    dismiss: { pointer: (e) => e.part("close-trigger").click(), touch: (e) => e.part("close-trigger").tap(),
               keyboard: async (e) => { await e.part("close-trigger").focus(); await e.part("close-trigger").press("Enter") },
               done: (e) => isOpen(e).then((o) => !o) },
  },
  queries: { isOpen, title, description },
  states: { open: { isOpen: true }, closed: { isOpen: false } },
  events: {
    CLOSE: "dismiss",
    "$sync:open": { props: (to) => ({ open: to === "open" }) },
    "ROOT.MOUNT": { skip: "mount; covered by announce unit tests (hydrating true/false)" },
    "CONTENT.CHANGE": { skip: "driven by the $props:children step; unit-tested" },
    "$props:children": { props: (text) => ({ children: text }) },
  },
  traits: ["presence"],
})
```

Props classes for `testMachine`: `announce` off / polite / assertive × with / without
CloseTrigger × uncontrolled / controlled; the oracle expects one announcement per
`$sync:open → open` and per `$props:children` while open with a live `announce`.

### 6. Theme

`alert.css`: grid with an icon column, Title/Description column and a CloseTrigger at
the inline end (`grid-template-areas`, logical); tokens `--rind-alert-bg`, `-text`,
`-border`, `-radius`, `-padding`, `-gap`, `-icon-size`, `-title-font-weight`,
`-close-size` (≥ 24 px target). Variants soft (default) / solid / outline, sizes, every
`data-tone`. Forced colors: `border: 1px solid CanvasText`, icon `currentColor`. Exit:
`opacity` transition on `[data-state="closed"]` with the motion duration token.

## Requests to other changes

None required. Optional, for `add-toast`: an Alert rendered inside a toast with
`announce` set would announce twice (the toast announces its own text); the Toast docs
should say to set `announce="off"` on alerts inside toasts (the default is `"polite"`). (No spec change needed in
either change; listed for the docs authors.)

## Risks / Trade-offs

- [`announce="polite"` default (coordinator decision, 2026-10-14): an alert that
  appears after hydration is announced once politely unless the consumer opts out]
  → server-rendered alerts stay silent; static content that mounts on the client
  (view content, alerts inside toasts) sets `announce="off"`; errors set
  `"assertive"`. Replaces the earlier `"off"` default and its open question.
- [No "alert" prefix spoken, no AT alert history] → accepted (research); a consumer can
  add `role="alert"` deliberately and opt out of the invariant.
- [MutationObserver per announcing alert] → only when `announce !== "off"`; one observer
  per instance, disconnected on unmount.
- [Next-tabbable focus target may be far away in long pages] → `finalFocus` for
  precise targets; the default is never `body`.

## Migration Plan

Reado: `GuidedReviewPanel` `ErrorRow` → `<Alert.Root announce="assertive">` with
`Alert.Description` and `Alert.CloseTrigger` (focus moves to the next control);
`CodeOverlays` `SaveErrorBanner` → same, icon-only CloseTrigger named by `messages`;
`ImageView` failure → `Alert` with `announce="polite"` (or the Image fallback text, see
add-image); `Editor` read error → `Alert` with `announce="off"` (view content).
Kobalte / MUI / Chakra users: `role="alert"` is gone — set `announce`.
