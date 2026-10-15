## Context

See proposal.md for why, and
[docs/research/navigation-menu.md](../../../docs/research/navigation-menu.md) for the
sources, bug history and decisions (binding unless this document says otherwise).
What this change builds on, unchanged:

| From | Used for |
|---|---|
| `add-foundations` | `setup()/machine()`, `controllable("value")`, `after` delays on the injected scheduler, effects scoped to states, contracts, drivers, `testMachine`, React adapter (`render`, ids, expected parts) |
| `add-a11y-foundations` | `PRESS` with modality, bare-click detection, `focusSafely` with cause `layer`, `data-focus(-visible)`, logical keys (`NEXT`/`PREV`/`FIRST`/`LAST`, RTL flip), `notComposing`, `messages`, provider, invariants (`no-touch-hover`, `focus-does-not-commit`) |
| `add-overlay-infrastructure` | layer stack (kind `popover`, non-modal, parent from layer context), dismissable layer (Escape, outside press, outside focus), presence, `Portal`, `layer`/`presence` traits |
| `add-floating-positioning` | `env.position.track()` for the optional `Positioner`, placement attributes, available size, `anchored` trait |
| `add-button` | `button-like-element` for `Trigger` |
| `add-tooltip` | `hover-intent` (`triggerProps`, `track`, `isInTransit`), `timed` trait |
| `add-popover` | `non-modal-tab-order` for content |
| `add-collapsible` | `core/dom/content-size.ts` (plus the request below) |
| `add-tabs` | `selection-indicator` for `Indicator` |
| `add-link` | `link-navigation` (`linkProps`, router capability, activation hook) |
| `add-theme-system` | stylesheet convention, family matrix |

## Goals / Non-Goals

**Goals:**
- One static machine per level whose graph shows hover, press, switch and close paths,
  so model tests drive delays with fake time.
- No new shared module: every cross-cutting behaviour is an existing capability.

**Non-Goals:**
- Changing the reused modules beyond the additive request listed below.

## Decisions

### 1. Machine (`navigation-menu.machine.ts`, one service per level)

```
                    PRESS / KEY.TOGGLE / OPEN(api) ───────────────────────────┐
  closed ──HOVER.START [hoverable]──► opening ──after openDelay──► open ◄─────┘
    ▲  ▲          │ HOVER.END/PRESS   ▲                         │  ▲ │
    │  └──────────┘                   │ HOVER.START (other) ────┘  │ │ switch: value := k2
    │                                 │                            │ │
  warm ──HOVER.START──────────────────┘ (no delay)   HOVER.END [openedBy=hover] ──► closing
    ▲  └── after skipDelay ──► closed                closing ──after closeDelay──► warm
    └── every close (ESCAPE | DISMISS | LINK.ACTIVATE | PRESS on open item | CLOSE)
```

```ts
type NavigationMenuEvent =
  | { type: "HOVER.START"; item: ItemKey }                       // hover-intent trigger handler
  | { type: "HOVER.END"; item: ItemKey | null }                  // trigger leave / zone left
  | { type: "PRESS"; item: ItemKey; modality: Modality }         // trigger press (incl. bare click)
  | { type: "ESCAPE" }
  | { type: "DISMISS"; reason: "outside-press" | "outside-focus" }
  | { type: "LINK.ACTIVATE" }                                    // from add-link's activation hook
  | { type: "PARENT.CLOSE" }                                     // from the level tree
  | { type: "OPEN"; item: ItemKey } | { type: "CLOSE" }          // api
  | { type: "FOCUS.MOVE"; to: "next" | "prev" | "first" | "last" | "into" }
```

- States `closed | warm | opening | open | closing`. `value` is a `controllable()`
  bound to the states (`closed | warm | opening` ⇔ `null`; `open | closing` ⇔ the open
  key), like Menubar's value; `$sync:value` enters `open`/`closed`.
- Context: `pending` (key waiting in `opening`), `openedBy` (`hover | press | keyboard
  | api`), `openedAt` (scheduler time, for the patient-click window), `suppressHover`
  (key closed by Escape or press; cleared by that trigger's `HOVER.END`), `previous`
  (for `data-motion`).
- Guards: `hoverable` (`openOnHover`, not disabled, not `suppressHover`, not
  `isInTransit`); `isOpenItem`; `patient` (`openedBy === "hover"` and now − `openedAt`
  < `patientClick`); `hoverOpened`.
- `open` + `PRESS` on the open item: `patient` → stay, `openedBy := press`; else close.
  `open` + `PRESS`/`HOVER.START` on another item: switch in one transition (one
  `value` proposal, old → new). `HOVER.END` in `open` only when `hoverOpened`.
- Delays `openDelay` 200, `closeDelay` 300, `skipDelay` 300, `patientClick` 500,
  read from props on entry.
- Effects in `open | closing`: the overlay layer (kind `popover`, non-modal, dismiss on
  Escape/outside press/outside focus, `outside-focus` only when the previous focus was
  inside the menu), `hoverIntent.track()` while `openedBy === "hover"`,
  `nonModalTabOrder` for the open content, `trackPosition` when a Positioner exists.
  `closed | warm | opening` own no document-level listener (Dismissal, radix#2476).
- Exit of `open | closing` to a closed state: `focusSafely(trigger, { cause: "layer" })`
  when focus is inside the closing content and the reason is `escape-key`; the level
  tree sends `PARENT.CLOSE` to child levels.
- *Alternative:* Zag's single state with timers in refs — rejected, not walkable;
  Radix's per-callback timers — same.

### 2. Level tree (`navigation-menu-tree.ts`)

A `Sub` level gets its parent level from context and registers with it. The tree
carries three things only: `closeTree(reason)` (link activation anywhere closes every
level), `PARENT.CLOSE` propagation down, and the parent's `openOnHover`. Hover zones
need no tree: each child level's content is a descendant layer, which `hover-intent`
already counts as inside (mui/base-ui#4386). Escape needs no tree: the layer stack
closes the topmost layer. *Alternative:* reuse add-menu's `MenuTree` — rejected, it
encodes menu open paths, submenu keys and the menubar parent kind, none of which apply.

### 3. Connect

- Root: `<nav>` with `aria-label` from messages unless `aria-labelledby` is given;
  `data-orientation`, `data-state`. Sub: `div`, no landmark.
- Trigger: `button-like-element` props, `aria-expanded`, `aria-controls` while content
  is mounted, `hoverIntent.triggerProps(send)` (mouse/pen, movement-based), press
  handlers, logical-key handler for `FOCUS.MOVE` and `into`. No `aria-haspopup`.
- Link: `linkProps(...)` from add-link; its `onActivate` with `disposition: "same-tab"`
  maps to `LINK.ACTIVATE` (`"elsewhere"` — modifier, middle click, other target — sends
  nothing); logical-key handler.
- Content: `hidden` per `closedContent` and state, `data-state`, `data-motion`, no
  role; key handler that acts only when `event.target` is one of this menu's
  `Trigger`/`Link` parts (reka-ui#548).
- Arrow focus moves use the registered part order (DOM order, collected after commit)
  and `focusSafely` with cause `navigation`. No roving tabindex, no
  `add-collections` navigation: its "Exactly One Tab Stop" contradicts the pattern.
- `data-motion` computed from `previous`, the new value and the item order (logical,
  so RTL needs no flip — the logical keys already mirror).

### 4. Parts (React)

- `Item` registers its key, trigger and content after commit (never during render;
  radix#2350).
- `Content` renders in place, or through a portal into the `Viewport` element when one
  is rendered for its level, and binds `usePresence` + `useContentSize` (own element
  when there is no viewport).
- `Viewport` binds `useContentSize` to itself and calls `opened` / `switched` /
  `closed` / `settled` from a layout effect keyed on the open value.
- `Indicator` binds `selection-indicator` with the open trigger as the selected item.
- `Positioner` binds `trackPosition` with `anchor` `trigger` (default) or `list`.

### 5. Theme (`packages/theme/src/navigation-menu.css`)

Tier-3 tokens `--rind-navigation-menu-*` (bar gap, trigger padding/radius, panel bg,
border, radius, shadow, padding, indicator size/colour, durations) defaulting to
semantic tokens. Triggers and bar links use the `toggle item` family (`ghost` default,
`data-size` passthrough); viewport and content use `panel`. Viewport transitions
width/height on the size variables; `[data-instant]` and reduced motion disable them;
`data-motion` keyframes slide content by a token distance; `max-height:
var(--rind-available-height)` + `overflow: auto` on a positioned viewport
(mui/base-ui#2240); open trigger and current link get an outline/underline in
`forced-colors: active`; `data-tone="danger"` re-points the indicator and current
colour.

### 6. Contract

See spec "Navigation Menu Contract". `events` map: `HOVER.START` → `hover`,
`HOVER.END` → `{ skip: "covered by hover's pointer path and close()" }`, `PRESS` →
`toggle`, `ESCAPE` → `pressEscape`, `DISMISS` → `close` (outside press),
`LINK.ACTIVATE` → `followLink`, `PARENT.CLOSE` → `{ skip: "internal tree event" }`,
`OPEN`/`CLOSE` → `{ skip: "api only" }`, `FOCUS.MOVE` → `{ skip: "focus-only; driven
by enterContent and press(key)" }`, `$sync:value` / `$props:disabled` prop steps.
`timed`: the close delay never elapses while the zone is hovered or focus is inside.

### 7. Shared modules used

`core/dom`: `press`, `modality`, `focus-safely`, `keyboard`, `layer-stack`,
`dismiss`, `presence`, `portal`, `position`, `hover-intent`, `non-modal-tab-order`,
`content-size`, `selection-indicator`, `link`. No `core/collection` module. No new
shared module.

## Requests to other changes

1. **add-collapsible (`content-size`) — additive.** Add a switch entry point
   `switched(): void` to `ContentSize`: read the size currently rendered (px, or the
   computed size if `auto`), write it, measure the element's new natural size (the
   incoming content is already committed), flush, write the new px values, then `auto`
   on `settled()`; a second `switched()` before `settled()` starts from the size
   currently rendered (mui/base-ui#4619). Existing `opened`/`closed`/`settled` are
   unchanged. Needed because a viewport goes from one open panel to another, which
   `opened()` (always from `0px`) cannot express. **APPLIED (coordinator, 2026-10-14).**
2. **add-theme-system (`theme-variants`, Family Matrix).** Add "Navigation Menu trigger
   and bar link" to the `toggle item` row and "Navigation Menu viewport and content"
   to the `panel` row (as Menubar). Plain links inside panels use the `link` family
   requested by add-link; no separate row. **APPLIED (coordinator, 2026-10-14).**
3. **add-tabs (`selection-indicator`) — wording only, optional.** The Purpose names
   Tabs and Segmented Control; add Navigation Menu, whose "selected item" is the open
   trigger. No requirement change.
4. **add-link (`link-navigation`).** Relies on `linkProps`' `onActivate` and its
   `disposition` (`same-tab` closes the tree). Specified in add-link ("Activation
   Reports"); nothing further needed.

## Risks / Trade-offs

- [Viewport content after the list reads in a different order for the virtual cursor]
  → inline content is the default and the APG structure; the docs page states the
  viewport's cost; `aria-owns` measured in the manual protocol (Open Questions).
- [`hidden` content by default adds DOM for large mega menus] → it is what consumers
  asked for (SEO); `closedContent: "unmount"` is one prop away; closed content has no
  listeners.
- [Arrow keys on by default could surprise apps that use arrows inside panels] → they
  act only on the menu's own Trigger/Link parts and never prevent default elsewhere.
- [Depends on six unarchived changes] → each is used through its capability only; the
  content-size request is additive and small.

## Open Questions

- `aria-owns` from the trigger to viewport content: add as a quirk entry only if VO or
  NVDA reading order needs it in the manual protocol.
- `hidden="until-found"` panels (find-in-page opens a panel): deferred with Tabs'
  same question.
