# Context Menu — research

Status: done · Wave: 1 (Reado has eight hand-rolled context menus; see below)

A Context Menu is a [Menu](menu.md) opened from a *region* by a secondary action
(right click, Control+click on macOS, long press on touch, Shift+F10 / ContextMenu
key) and anchored to a point instead of a trigger. Everything inside the open menu —
items, submenus, keyboard, typeahead, checkbox/radio items, links, Escape, Tab — is
Menu behaviour and is not repeated here. Placement uses the `pointer` preset of
[floating-positioning.md](floating-positioning.md) (point anchor, `fixed`, no
tracking). This note covers only how it opens, where it is anchored, how it closes and
what the region exposes.

Sources: the same clones as [menu.md](menu.md) (Zag `menu.connect.ts` context trigger,
Radix `context-menu/src/context-menu.tsx`, React Aria `interactions/useContextMenu.ts`
+ `useLongPress.ts`, Base UI `context-menu/**`, Kobalte `context-menu/*`, Reka
`ContextMenu/*`, Bits `bits/context-menu/*`, Ariakit's `examples/menu-context-menu`).
Headless UI and Ariakit ship no context menu. Bug search: `contextmenu`,
`context menu`, `context menu long press`, `context menu right click` over the ten
trackers — about 220 hits, ~90 relevant, ~35 read in full.

## Pattern

- APG has no context-menu pattern; the popup is an APG
  [Menu](https://www.w3.org/WAI/ARIA/apg/patterns/menubar/). The region is not a menu
  button: `aria-haspopup` and `aria-expanded` describe what *activation* (click /
  Enter) does, and activating the region does not open the menu. React Aria removes
  both from context triggers for that reason (w3c/aria#1971); we do the same.
- How users open it, per platform (React Aria's `useContextMenu` comments, checked
  against browser behaviour):
  - macOS: right click; Control+click (the browser fires `contextmenu`); VoiceOver
    VO+Shift+M ("open shortcut menu", fires `contextmenu` at the element).
  - Windows / Linux: right click; Shift+F10 and the ContextMenu key (the browser fires
    `contextmenu` on the focused element); long press on a touch screen (fires
    `contextmenu`).
  - Android: long press fires `contextmenu`.
  - iOS / iPadOS touch: **no `contextmenu` event** on long press (WebKit 213953;
    RX#701) — a long-press gesture must be emulated; iPadOS with a mouse fires it.
- Keyboard twin (accessibility rule 21, a11y-foundations "Long Press"): the logical
  `CONTEXT_MENU` key (Shift+F10, ContextMenu key) is already produced by
  keyboard-interactions; none of the libraries handle it themselves.

## How the others built it

| | Zag/Ark | Radix (Reka, Bits) | React Aria | Base UI | Kobalte |
|---|---|---|---|---|---|
| Region part | `context-trigger` | `Trigger` (`span`) | `MenuTrigger trigger="contextMenu"` | `ContextMenu.Trigger` | `Trigger` |
| Opens on | `contextmenu` | `contextmenu` | `contextmenu` (+ iOS long press, + macOS Ctrl+Enter workaround) | `contextmenu` | `contextmenu` |
| Long press | 700 ms, any move cancels | 700 ms, any move cancels; Reka `pressOpenDelay` | 500 ms, iOS only | 500 ms, 10 px move threshold, multi-touch cancels | 700 ms, any move cancels |
| Anchor | 0×0 rect at point, no tracking | 0×0 rect, recreated per point (RX#2611 fix) | `point` → 0×0 rect | 0×0 (10×10 for touch) | rect at point |
| Second right click while open | reposition | reposition | outside is inert → hits body → close; native menu shows | backdrop swallows it; no native menu, no reopen | reposition + focus menu |
| Modal | no | yes | yes (inert) | yes (focus manager modal, internal backdrop) | yes |
| Keyboard twin | browser `contextmenu` only | same | same + macOS Ctrl+Enter (WebKit 302049, crbug 369897039) | same | same |
| `aria-haspopup` on region | — | — | removed | — | — |
| Focus restore on close | none (anchor point set) | to the focused element before | yes | to trigger | yes |

Notable details:

- **Radix** keeps a `WeakSet` of claimed long-press events so nested triggers don't
  both arm — yet a touch long press still opens every menu above the finger
  ([RX#4165](https://github.com/radix-ui/primitives/issues/4165)): the claim only guards
  the `contextmenu` path. Sets `-webkit-touch-callout: none`; disabled region lets the
  native menu through. Dev warning when `open` is set before any interaction (no point).
- **React Aria** suppresses the trailing click and the touch `contextmenu` after its
  long press and records `firedContextMenuEvent` to avoid a double open where both fire.
- **Base UI**: a right button held ≥ 500 ms and released outside the popup closes it
  (the native press-hold-release gesture); on non-macOS the release that opened the
  menu never activates an item; on macOS a right-button release over an item activates
  it. Outside-press dismissal is suppressed for 500 ms after a context open.
- **Zag** never restores focus after a context menu (no trigger), and can share one
  menu between several context triggers with a `value`.

### Reado (consumer)

`src/components/atoms/ContextMenu.tsx` (hand-rolled, portalled, `fixed` at
`clientX/Y`, clamped to the viewport, height capped) is used by the file tree, tabs,
editor, terminal panes, search, problems, activity bar and git panel; `EditMenu.tsx`
installs a **document-level** `contextmenu` listener and opens a Cut/Copy/Paste menu
for whichever `input`/`textarea` was right-clicked. Lessons it encodes:

- it escapes a `transform: scale()` zoom layer by portalling to `body` (a transform is
  a containing block for `fixed`) — our portal + `fixed` strategy covers it;
- dismissal on outside click, Escape, scroll, resize and window blur;
- the opening click must not close it: a menu opened from a *left* click received that
  click on `window` and closed — found only with a real mouse (`ContextMenu.uitest.tsx`);
- "keepOpen" items whose action swaps the menu's own content;
- each opening needs to know *what* was right-clicked (entry, pane, field, editor
  position) — the event and target must reach the consumer.

## Accessibility

- **Region**: no role, no `aria-haspopup`, no `aria-expanded` (see Pattern). The region
  need not be focusable; keyboard users open the menu from a focused element inside it.
  When the region itself is the only focus target (an editor surface), the consumer makes
  it focusable. A long-press hint goes into `aria-describedby` only when the region is
  focusable (press-interactions "Long Press" requires the hint on long-pressable parts;
  a hint on a non-focusable `div` is never read).
- **Menu name**: there is no trigger to label it. The content takes `aria-label` (or
  `aria-labelledby`) from the consumer; an unnamed context menu logs one development
  warning, like Dialog. No default English string ("Context menu" names nothing).
- **Focus on open**: keyboard (`CONTEXT_MENU` key) and virtual (VO+Shift+M arrives as a
  `contextmenu` with no preceding pointer press) → first item; pointer and touch → the
  menu container.
- **Focus on close**: to the element focused when it opened (the overlay's "previously
  focused" rule) if focus is still in the menu or on `body`; when nothing was focused,
  the overlay fallback chain.
- **Inert**: modal by default like Menu; the region is outside the layer, so it becomes
  inert while open. That is fine for naming (nothing labels the menu by the region) but
  it means a second right click lands on `body` (React Aria's finding) — handled by a
  document-level rule below, not by event targets.
- **Safari text selection** is cleared when focus moves into the menu after a right click
  on selected text (RX#2405, open). Chrome and Firefox keep it. Consumers that act on the
  selection (Reado's Cut/Copy) read it on open; tracked as a manual check, not worked
  around.
- **Forced colors / motion**: as Menu; `--rind-transform-origin` is the corner at the
  pointer (positioning spec, RX#3066).

## Bug history

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| Radix | [#701](https://github.com/radix-ui/primitives/issues/701), [#931](https://github.com/radix-ui/primitives/issues/931) | Never opens on iOS touch; long press selects the region's text | iOS fires no `contextmenu`; callout/selection not suppressed | Long press added; `touch-callout: none` | Emulated long press on touch, text selection suppressed during the press (Spec) |
| Radix | [#748](https://github.com/radix-ui/primitives/issues/748) | Request to opt out of long press | Long press always on | Closed | Long press can be turned off per region (Spec) |
| Radix / Reka | [RX#4165](https://github.com/radix-ui/primitives/issues/4165), [RK#1844](https://github.com/unovue/reka-ui/issues/1844) | Nested regions: one long press opens every menu above the finger | Each region arms its own timer from a bubbling `pointerdown` | Fixed / open | Only the innermost region handles a gesture, on every path (Spec) |
| Bits | [#1641](https://github.com/huntabyte/bits-ui/issues/1641) | A child that calls `preventDefault()` on `contextmenu` still opens the menu | Region ignored `defaultPrevented` from descendants | Fixed | A prevented `contextmenu` never opens (Spec) |
| Radix / Kobalte | [RX#766](https://github.com/radix-ui/primitives/issues/766), [KB#646](https://github.com/kobaltedev/kobalte/issues/646), [BITS#771](https://github.com/huntabyte/bits-ui/issues/771) | Consumers cannot get the triggering event / target / coordinates | Not exposed | Fixed | Open details carry the event, target and point (Spec) |
| Radix | [#1287](https://github.com/radix-ui/primitives/issues/1287) | Second right click shows the native menu instead | Second `contextmenu` not handled while open | Fixed | Right click inside the region while open re-anchors (Spec) |
| Radix / Bits / Reka | [RX#2611](https://github.com/radix-ui/primitives/issues/2611), [BITS#1743](https://github.com/huntabyte/bits-ui/issues/1743), [BITS#563](https://github.com/huntabyte/bits-ui/issues/563), [RK#701](https://github.com/unovue/reka-ui/issues/701) | Second right click elsewhere re-opens at the old point; fast right clicks across regions leave several menus open | Anchor cached; each region's menu independent | Fixed / open | One open context menu per document; re-anchor to the new point (Spec) |
| Radix | [#2572](https://github.com/radix-ui/primitives/issues/2572) | Exit animation prevents repositioning on a re-open | Presence kept the old node and point | Fixed | Re-anchoring an open menu is not a close/open cycle (Spec) |
| Radix | [#3066](https://github.com/radix-ui/primitives/issues/3066) | Transform origin always a top corner | Origin from side only | Open | Origin at the pointer corner (positioning, cited) |
| Radix | [#2757](https://github.com/radix-ui/primitives/issues/2757) | Right click on the region's border opens the native menu (target `html`) | Hit test outside the region box | Closed | Region is the element's subtree (documented) |
| Radix / Base UI | [RX#2795](https://github.com/radix-ui/primitives/issues/2795), [RX#1664](https://github.com/radix-ui/primitives/issues/1664) | How to close on scroll / follow the region on scroll | Point anchor doesn't track | Closed | Modal locks scroll; a non-modal context menu closes when the page scrolls (Spec) |
| Base UI | [#3125](https://github.com/mui/base-ui/issues/3125); Radix [#3049](https://github.com/radix-ui/primitives/issues/3049) | Stays open when the window loses focus; opening into an unfocused window leaves it uninteractive | No window blur close; focus not taken when the window was inactive | Open | Window blur closes (Menu rule); test opening in an unfocused window (Spec) |
| Base UI | [#3595](https://github.com/mui/base-ui/issues/3595) | Right click on an item closes the menu (Windows) | Treated as an outside press | Fixed | Secondary presses inside the menu neither close nor activate (Spec) |
| Base UI | [#3317](https://github.com/mui/base-ui/issues/3317) | Menu closes when right mousedown and mouseup are at different points | Press-hold-release gesture closes on release outside | Open (by design) | Not adopted: release of the opening press never closes or activates (Spec) |
| Base UI | [#2828](https://github.com/mui/base-ui/issues/2828) | First click after opening triggers twice (checkbox toggles twice) | Opening gesture's pointer state leaked | Fixed | One activation per press after a context open (Spec) |
| Kobalte | [#271](https://github.com/kobaltedev/kobalte/issues/271) | Long press on iOS opens the menu at the top-left corner | Point taken from an event without coordinates | Fixed | Point from the touch start position (Spec) |
| Radix | [#1727](https://github.com/radix-ui/primitives/issues/1727) | iOS: tap outside with slight movement doesn't close | Tap recogniser vs movement | Closed | Overlay touch dismissal on click; manual iOS check |
| Radix / Base UI | [RX#747](https://github.com/radix-ui/primitives/issues/747), [BU#4854](https://github.com/mui/base-ui/issues/4854) | Pen: menu not focusable / long press doesn't fire for stylus | Pen treated as neither mouse nor touch | Fixed / open | Long press for touch **and pen** (Spec) |
| Ark | [#3285](https://github.com/chakra-ui/ark/issues/3285); Base UI [#2505](https://github.com/mui/base-ui/issues/2505) | A dropdown menu inside a context region behaves like its submenu / breaks | Parentage from component context | Fixed | A menu inside a region is a separate root (Spec) |
| Bits | [#1948](https://github.com/huntabyte/bits-ui/issues/1948) | Left click on a region inside a popover closes the popover | Region press counted as outside | Fixed | Region presses are ordinary page presses (Spec) |
| Bits | [#1885](https://github.com/huntabyte/bits-ui/issues/1885) | Region forced to `tabindex="-1"` | Library overrode the consumer | Fixed | Region keeps the consumer's `tabindex` (Spec) |
| Ark | [#3636](https://github.com/chakra-ui/ark/issues/3636) | Region rendered with `asChild` never positions | Anchor lookup by part | Fixed | Point anchor independent of the region element (positioning) |
| Base UI | [#3166](https://github.com/mui/base-ui/issues/3166) | Region on a table row inserts focus-guard spans into `tbody` | Focus guards | Fixed | No sentinels anywhere (overlay) |
| Radix | [#2405](https://github.com/radix-ui/primitives/issues/2405) | Safari clears the text selection on open | Focus moves into the menu | Open | Manual check; documented (design Risks) |

## Known pitfalls

- iOS has no `contextmenu` on touch; Android and desktop touch screens do. Emulating
  long press everywhere double-opens where the native event also fires.
- Nested regions: only the `contextmenu` event is easy to claim; timers are not.
- A modal context menu makes the region inert, so the second right click lands on `body`.
- Opening gestures leak into the menu: the release of the right button, the trailing
  `click` of a long press, the left click that opened a click-opened context menu.

## Testing notes

- `contextmenu` is a PointerEvent in browsers (AK#7162); the DOM adapter must dispatch it
  as one; long press needs fake timers in Node and a held touch in Playwright.
- Driver: `openAt({ x, y })` (pointer), `openWithKeyboard()` (focus + Shift+F10),
  `longPress(point)` (touch), queries from Menu plus `anchorPoint()`.

## Decisions

- **Reuse Menu**: the same `menu` machine, connect, parts and contract; Context Menu adds
  a root (`kind: "context-menu"` in the menu tree), a `trigger` region part, a point
  anchor and its opening paths. Submenus, items and closing rules are Menu's.
- **Opening**: native `contextmenu` on the region (right click, macOS Control+click,
  Windows/Linux keyboard, Android long press), unless already `defaultPrevented` or the
  region is disabled (then the native menu shows); a `CONTEXT_MENU` key on a focused
  element inside the region opens anchored to that element; an emulated long press for
  `touch` and `pen` pointers (500 ms, cancelled by moving more than 10 px, by a second
  pointer, by `pointercancel`), deduplicated with a native `contextmenu` that arrives
  during the same gesture. Only the innermost region handles a gesture.
- **Anchor**: the pointer point (keyboard: the focused element's rectangle), `pointer`
  preset, no tracking.
- **While open**: a right click inside the same region re-anchors to the new point (no
  close/open, no animation restart) and reports the new target through `onAnchorChange`; a right
  click anywhere else closes the menu and lets the browser show its own menu; secondary
  presses inside the menu do nothing; the release or trailing click of the opening
  gesture never activates an item or closes the menu.
- **Modal by default** (as Menu); `modal={false}` closes on page scroll.
- **Region attributes**: no role, no `aria-haspopup`/`aria-expanded`/`aria-controls`;
  consumer `tabindex` kept; `data-state` and `data-disabled`; `-webkit-touch-callout:
  none` and `user-select: none` only during a touch press.
- **Programmatic open** at a point (`openAt(point, target?)`), for document-wide menus
  like Reado's `EditMenu`.
- **Open details**: `onOpenChange(open, details)` carries `point`, `target` (the element
  the gesture started on) and `event`.

## Open questions

- macOS Control+Enter (React Aria's WebKit 302049 / crbug 369897039 workaround): not
  added; VoiceOver users have VO+Shift+M and there is no standard macOS key. Revisit if
  a consumer asks.
