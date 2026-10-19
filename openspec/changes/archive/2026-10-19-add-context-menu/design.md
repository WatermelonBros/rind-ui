## Context

See proposal.md and specs/context-menu/spec.md. Research: [context-menu.md](../../../docs/research/context-menu.md).
This change builds on `add-menu` (machine, connect, parts, contract, `MenuTree`) and,
through it, on the foundations, overlay, positioning and collection changes:

| From | Used for |
|---|---|
| `add-menu` | the `menu` machine as the root level (`kind: "context-menu"` in `MenuTree`), all item/submenu behaviour, `menuContract` |
| `add-a11y-foundations` | `core/dom/press` long press (`LONG_PRESS`, Scheduler, contextmenu/click suppression, text-selection state machine), `CONTEXT_MENU` logical key, macOS Control+click rule in `a11y/keys.ts`, modality (`virtual` contextmenu), messages |
| `add-floating-positioning` | `pointer` preset, `AnchorSource` `point` / `virtual` (element rect for keyboard), `fixed` via `auto`, transform origin at the point |
| `add-overlay-infrastructure` | modal layer, restore to the previously focused element, dismiss (right click is never an outside press) |

## Goals / Non-Goals

**Goals:** no fork of the menu machine; one opening model for pointer, touch, keyboard
and AT; Reado's eight menus and `EditMenu` port to it.

**Non-Goals:** press-hold-release selection; region-sharing menus; Control+Enter.

## Decisions

### 1. Root, not a new machine

`ContextMenu.Root` creates a `menu` service with `level: "root"`, `trigger: "region"`
(a `bindProp`) and an extra opening event set; the menu definition gains these events on
its `closed` state guarded by `isRegionRoot`, and the same events on `open` as
re-anchoring actions:

```ts
type ContextMenuEvent =
  | { type: "REGION.CONTEXTMENU"; point: Point; target: Element; event: Event; modality: Modality }
  | { type: "REGION.LONG_PRESS"; point: Point; target: Element; modality: "touch" | "pen" }
  | { type: "REGION.KEY"; target: Element; modality: "keyboard" }   // CONTEXT_MENU logical key
  | { type: "DOCUMENT.CONTEXTMENU"; point: Point; inRegion: boolean } // while open
```

- `closed` → `open` on any of the three region events, storing `anchor` (point or
  element rect) and `openModality` (keyboard and `virtual` → first item).
- `open`: `REGION.CONTEXTMENU`/`REGION.LONG_PRESS` → `reanchor` (new anchor,
  `env.position.reposition`, clear highlight, focus content, `onAnchorChange`);
  `DOCUMENT.CONTEXTMENU { inRegion: false }` → `closed` with `OUTSIDE_PRESS`, not
  prevented; `{ inRegion: true }` → `reanchor` (the region is inert under a modal menu,
  so the event targets `body`; `inRegion` is computed from `region.getClientRects()`).
- *Alternative*: a separate `context-menu` machine wrapping a menu service (two graphs
  to keep in sync for one difference: how it opens). Rejected.

### 2. Gesture handling (connect + `core/dom`)

- `contextmenu` listener on the region (bubble): skip if `defaultPrevented` or disabled;
  `preventDefault()`; mark the event as claimed (`WeakSet`) so outer regions skip it.
- Long press through the press module's long-press option on the region for `touch` and
  `pen`, threshold 500 ms; a 10 px movement threshold and multi-touch cancel it (the
  press module's own cancel covers `pointercancel`). The `pointerdown` is claimed in the
  same `WeakSet` by the innermost region at capture → bubble order, so outer regions'
  timers never start (radix#4165). A native `contextmenu` arriving while the long press
  is pending or just fired is deduplicated by the gesture id.
- Keyboard: the region's `keydown` maps `CONTEXT_MENU`; `preventDefault()` on the keydown
  and on the `contextmenu` that some browsers dispatch afterwards for the same key.
- `virtual`: a `contextmenu` with no pointer press in the last 500 ms on that element
  is classified as keyboard-or-AT by modality tracking → first item.
- Document listener (only while open): `contextmenu` capture → `DOCUMENT.CONTEXTMENU`.
- Opening-gesture guard: the menu's `openingPress` id is the gesture id, so its
  right-button release and the long press's trailing click never activate an item.

### 3. Positioning

`pointer` preset with `anchor: { kind: "point", x, y }`; keyboard opens use
`{ kind: "virtual", get: () => target.getBoundingClientRect() }` with side `bottom`,
align `start`. `tracking: "none"`; non-modal context menus close on page scroll (an
effect in `open` listening to scroll on the document, scoped to `modal === false`).

### 4. Region connect

No role/ARIA popup attributes (w3c/aria#1971); consumer `tabindex` untouched;
`aria-describedby` → long-press hint only when the region is focusable and long press is
on; `-webkit-touch-callout: none` and `user-select: none` set by the press module during
a touch press only; `data-state`, `data-disabled`.

### 5. Contract

```ts
export const contextMenuContract = extendContract(menuContract, {
  scope: "context-menu",
  locate: { part: "trigger", name: { part: "content" } },
  actions: {
    openAt: { pointer: rightClickAt, touch: longPressAt, keyboard: focusInRegionThenShiftF10, done: isOpen },
    reanchor: { pointer: rightClickAt, touch: longPressAt, keyboard: { none: "keyboard opens anchor to focus" }, done: anchorMoved },
  },
  queries: { anchorPoint },
  events: {
    "REGION.CONTEXTMENU": "openAt", "REGION.LONG_PRESS": "openAt", "REGION.KEY": "openAt",
    "DOCUMENT.CONTEXTMENU": "reanchor", TRIGGER_PRESS: { skip: "no trigger button" },
  },
})
```

Both adapters dispatch `contextmenu` as a `PointerEvent` (ariakit#7162).

### 6. Theme

`packages/theme/src/context-menu.css` sets `--rind-context-menu-*` tier-3 tokens
(decision 0007, proposed) defaulting to the `--rind-menu-*` tokens, plus the region's
open-state hook (`[data-scope=context-menu][data-part=trigger][data-state=open]`).

### Resolved open questions

| Question | Decision |
|---|---|
| Second right click | Same region: re-anchor; elsewhere: close and let the browser handle it |
| Long press | 500 ms, touch and pen, 10 px threshold, everywhere (dedup with native) |
| Keyboard twin | `CONTEXT_MENU` key, anchored to the focused element |
| `aria-haspopup` on the region | None (React Aria, w3c/aria#1971) |
| Modal | `true` by default, as Menu |

## Risks / Trade-offs

- [Second right click on another rind region while a modal context menu is open needs a
  second right click] → native-like (Windows); documented; `modal={false}` regions get
  the event directly.
- [Safari clears the text selection when focus moves into the menu (radix#2405)] →
  manual check; consumers read the selection on open (`details.target`, `getSelection()`).
- [Region rectangles for `inRegion` ignore shapes] → acceptable; the region is a box.
- [Long press on iOS competes with native link previews] → regions over links document
  `-webkit-touch-callout` behaviour; manual device check.

## Migration Plan

Reado: replace `ContextMenu.tsx` call sites (`x`, `y`, `items`, `onClose`) with
`ContextMenu.Root`/`Trigger` around the clicked element and `Menu.Item`s; `EditMenu`
keeps its document listener and calls `openAt`; drop the hand-written dismissal effects.
