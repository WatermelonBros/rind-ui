## Context

See proposal.md and [docs/research/hover-card.md](../../../docs/research/hover-card.md)
(binding decisions). Hover Card is composition of specified capabilities:

| From | Used for |
|---|---|
| `add-tooltip` | `hover-intent` (stable API, design §3 there: `triggerProps()`, `track()`, `isInTransit()`), focus cause (`FOCUS { modality, cause }`, add-a11y-foundations), `focusWithTab()` adapter action, `timed` invariant |
| `add-popover` | `non-modal-tab-order` (`trackNonModalTabOrder`) |
| `add-overlay-infrastructure` | layer (`kind: "popover"`, non-modal), dismiss (Escape, outside press, outside focus), focus restore, presence, portal |
| `add-floating-positioning` | `popup` preset, positioner/arrow helpers, `positioningQueries`, `anchored` |
| `add-a11y-foundations` / `add-foundations` | hover, modality, focus-visible, ids, runtime, contracts, drivers, `testMachine` |

## Goals / Non-Goals

**Goals:** a four-state machine with no new `core/dom` module.

**Non-Goals:** touch opening, disclosure button, delay group (proposal Non-goals).

## Decisions

### 1. Machine (own machine, Tooltip's shape)

```
closed ──HOVER.START / FOCUS [keyboardIntent]──► opening ──after openDelay──► open
opening ──HOVER.END [not keyboardFocused] / BLUR [not pointerInZone] / CLOSE──► closed
open ──HOVER.END [canClose] / BLUR [canClose]──► closing ──after closeDelay──► closed
closing ──HOVER.START / FOCUS──► open
opening|open|closing ──CLOSE {escape-key|outside-press|outside-focus|parent-dismissed|disabled|api}──► closed
canClose = not focusInside and not keyboardFocused and not childLayerOpen
```

- Events: `HOVER.START`, `HOVER.END`, `FOCUS { modality, cause }`, `BLUR`,
  `FOCUS_WITHIN.ENTER/LEAVE` (content), `CLOSE { reason }`, `OPEN`,
  `POSITION.PLACED`. Delays `openDelay` 700, `closeDelay` 300.
- Effects in `open | closing`: `layer` (overlay effect with `initialFocus: () =>
  false`, outside focus enabled), `hoverIntent.track`, `nonModalTabOrder`,
  `trackPosition`. Nothing document-level while closed.
- Why not reuse the tooltip machine: different focus semantics (delay on focus,
  focus inside keeps open, Tab into content, no group, outside-focus dismissal);
  sharing would need flags (CLAUDE.md: new behaviour = new states, not booleans).
  The shared part — hover intent — is already a module.
- `childLayerOpen` reads `layer.meta().hasNested`; `hover-intent` already
  suppresses leave in that case, the guard covers blur.

### 2. Contract

```ts
export const hoverCardContract = contract("hover-card", {
  anatomy: ["trigger", "positioner", "content", "arrow"],
  locate: { part: "trigger", role: "link", name: true },
  actions: { show, hide, enter, pressEscape, pressOutside, tab, shiftTab, waitForUnmount },
  queries: { isOpen, hasFocus, isTopmost, ...positioningQueries },
  states: { closed: { isOpen: false }, opening: { isOpen: false }, open: { isOpen: true }, closing: { isOpen: true } },
  events: {
    "HOVER.START": "show", "HOVER.END": "hide", FOCUS: "show", BLUR: "tab",
    "FOCUS_WITHIN.ENTER": "enter", "FOCUS_WITHIN.LEAVE": { skip: "covered by tab past the end" },
    CLOSE: "pressEscape", OPEN: { skip: "api only" }, "POSITION.PLACED": { skip: "positioning" },
    "$sync:open": { props: (target) => ({ open: target === "open" }) },
    "$props:disabled": { props: () => ({ disabled: true }) },
  },
  traits: ["layer", "restores-focus", "presence", "anchored", "timed"],
})
```

`touch` on `show` is `{ none: "hover cards never open on touch" }`; the
`no-touch-hover` invariant replays it anyway.

### 3. Shared modules used

`core/dom`: `hover-intent`, focus cause (add-a11y-foundations), `non-modal-tab-order`
(add-popover), `overlay`, `layer-stack`, `dismiss`, `focus-restore`, `presence`,
`portal`, `position`, `hover`, `modality`, `focus-safely`.

## Risks / Trade-offs

- [Keyboard users who linger on a link must Escape or Tab through the card] →
  only after the open delay (React Aria's mitigation); Escape-then-Tab skips it.
- [`aria-expanded` on every preview link adds verbosity] → it is the only way SR
  users learn a preview exists (BU#5583); documented.
- [No touch access] → usage rule: the card is never the only path.

## Migration Plan

New component. Ark `HoverCard` props (`openDelay`, `closeDelay`, `positioning`)
map one to one.
