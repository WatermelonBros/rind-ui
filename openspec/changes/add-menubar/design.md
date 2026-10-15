## Context

See proposal.md for why and specs/menubar/spec.md for behaviour. Research and the Bug
history the scenarios cite: [menubar.md](../../../docs/research/menubar.md). This change
consumes, without restating:

| From | Used for |
|---|---|
| `add-menu` | the `menu` machine per level, `MenuTree` (parent kind `menubar`, open path = at most one open child per level, `closeTree`), every part inside a menu, opening on release / virtual = first item, focus by modality after first placement, Escape / Tab / window blur, modality and the trigger-outside-inert rule, `menuContract` |
| `add-collections` | static item registration, navigation, typeahead, roving composite props, repair, collection contract fragment |
| `add-a11y-foundations` | press (bare click = virtual), logical keys with `dir` / orientation, IME guard, modality, invariants |
| `add-overlay-infrastructure` | layer elements accessor (the bar joins the open menu's layer), inert outside, dismissal |
| `add-floating-positioning` | presets `dropdown` and `submenu` |
| `add-foundations` | runtime, `controllable()` (`value`), contracts, drivers, `testMachine`, React adapter |
| `add-theme-system` | tier-3 tokens, stylesheet convention |

## Goals / Non-Goals

**Goals:**
- The bar is one small machine; menus are unchanged `menu` levels under it.
- "Open mode" is derived from one value, so nothing depends on how a menu opened.
- Reado's `MenuBar.tsx` ports to parts with its `APP_MENUS` model unchanged.

**Non-Goals:**
- Changing any in-menu behaviour; hover-to-open from closed; top-level non-menu items.

## Decisions

### 1. Composition

`Menubar.Root` creates the `MenuTree` and registers itself as the root node of kind
`menubar`; each `Menubar.Menu` mounts an ordinary menu root level registered with
`parent = menubarId`. `parentKind()` for those levels is `menubar`. The tree's open-path
rule (one open child per level) is what keeps exactly one menu open when switching
(ariakit#7086, huntabyte/bits-ui#1273 at the submenu level). Each menu level's `open`
is the menu's controllable, driven by the bar: `open = value === key`, and the level's
`onOpenChange(false, details)` proposes `value: null` with the level's reason.

*Alternative:* Radix's re-export of every Menu part under `Menubar.*` (17 aliases) —
rejected: inside a menu the parts are the Menu parts, which keeps one API and one docs
page; only Root, Menu and Trigger are menubar parts.

### 2. Machine

```
            TRIGGER_PRESS / TRIGGER_KEY / $sync(value ≠ null)
  closed ─────────────────────────────────────────────────────► open
    ▲                                                            │
    └── MENU_CLOSED { reason } · TRIGGER_PRESS (same key) ·      ┘
        $sync(value = null)

closed:  NAVIGATE → navigate (focus) · TYPEAHEAD → typeahead (focus) · FOCUS → highlightFocused
open:    TRIGGER_PRESS (other key) · TRIGGER_HOVER (other key) · MENU_NAVIGATE { direction }
           → switchTo(target)   [target enabled; keyboard skips disabled, wraps with loop]
root:    COLLECTION.CHANGE → repairCollection · FOCUS_MENUBAR → focusHighlighted · BLUR
```

```ts
type MenubarEvent =
  | { type: "NAVIGATE"; move: "next" | "previous" | "first" | "last" }
  | { type: "TYPEAHEAD"; char: string; composing: boolean; modifiers: Modifiers }
  | { type: "FOCUS"; key: CollectionKey; modality: Modality } | { type: "BLUR" }
  | ({ type: "TRIGGER_PRESS"; key: CollectionKey } & PressFields)
  | { type: "TRIGGER_KEY"; key: CollectionKey; edge: "first" | "last" }
  | { type: "TRIGGER_HOVER"; key: CollectionKey; pointerType: "mouse" | "pen" }
  | { type: "MENU_NAVIGATE"; from: CollectionKey; direction: "next" | "previous" | "collapse" }
  | { type: "MENU_CLOSED"; key: CollectionKey; reason: MenuCloseReason }
  | { type: "COLLECTION.CHANGE" } | { type: "FOCUS_MENUBAR" }
```

- `value: string | null` is a `controllable()`; the state is bound to it (`closed` ⇔
  `null`), so a programmatic `value` enters `open` through `$sync` like any other open
  (ariakit#7083) and closing the last menu always leaves `open` (kobaltedev/kobalte#333).
- `switchTo` proposes one `value` change (old key → new key). The old level closes with
  reason `TREE.SIBLING_OPENED` (request 4: no focus restore on that close), the new
  level opens with the modality of the event: keyboard (`MENU_NAVIGATE`) → first item;
  pointer (`TRIGGER_HOVER`, `TRIGGER_PRESS`) → content focused, nothing highlighted.
- `MENU_NAVIGATE { direction: "collapse" }` happens only in vertical bars: the level
  closes with reason `ESCAPE_KEY` (the collapse key acts as Escape at the top level of a
  vertical bar's menu), and the overlay's restore puts focus on the item.
- `TRIGGER_KEY` comes from the trigger's connect: horizontal Enter / Space / ArrowDown →
  `first`, ArrowUp → `last`; vertical Enter / Space / expand key → `first`. The key is
  the target item's own key (kobaltedev/kobalte#332).
- Hover: `TRIGGER_HOVER` is sent only for mouse / pen `pointerenter` / `pointermove` with
  real movement (collections pointer guard), only in `open`, with no delay.
- Disabled items send no `TRIGGER_PRESS` / `TRIGGER_KEY` (press factory); `switchTo`
  walks the collection with `navigable = enabled` for keyboard switching.
- Props: `orientation`, `loop` (true), `modal` (true), `disabled`,
  `focusableWhenDisabled` (true).

### 3. Bar and menu keys

- The bar's own keys (connect on the root): `toLogicalKey(desc, { dir, orientation })`
  → `NAVIGATE` for the axis, Home / End; printable → `TYPEAHEAD`; only when the target
  is a bar item, unmodified, not composing (the same target rule as `add-toolbar`'s key
  ownership, huntabyte/bits-ui#1593).
- Inside a menu, the menu level handles every key first. A level whose parent kind is
  `menubar` forwards an `EXPAND` it did not consume (no submenu trigger) and a
  `COLLAPSE` at its own top level to the tree, which sends `MENU_NAVIGATE` to the bar
  (request 2). The bar maps: horizontal `EXPAND` → next, `COLLAPSE` → previous;
  vertical `EXPAND` → ignored, `COLLAPSE` → close.

### 4. Modality and the bar in the layer

Each open menu's layer `elements()` includes the menubar root (request 1), as add-menu
already includes the trigger. Consequences, all wanted: the bar is outside the inert set
(names stay reachable — the Chromium inert-labelling rule menu.md decided), presses and
hover on other items reach the bar (one-press switching for modal menus,
ariakit#4023), and a press on another item is "inside" for dismissal so it does not
first dismiss. This is Base UI's backdrop cutout expressed through the layer model.

### 5. Connect

- Root: `role="menubar"`, `aria-orientation` only vertical, name from the consumer,
  `data-*` per spec; dev warning when unnamed; children wrappers `role="none"`.
- Trigger: the menu trigger's props in menubar mode (request 3) — `role="menuitem"`,
  `aria-haspopup="menu"`, `aria-expanded`, `aria-controls` while mounted — merged with
  the bar's roving props (`tabIndex`, `data-highlighted` = focused, `data-key`), the
  press handler sending `TRIGGER_PRESS` to the bar instead of opening the menu directly,
  and the hover handler. Default element `div` (WebKit 228318 avoided; the press quirk
  entry covers a substituted `<button>`).
- Positioning per orientation: `dropdown` (`side: "bottom"`, `align: "start"`) or
  `submenu`, passed to each menu's `positioning` default.

### 6. Contract

```ts
export const menubarContract = contract(menubarMachine, {
  scope: "menubar",
  locate: { role: "menubar", name: true, part: "root" },
  ...collectionContract({ itemRole: "menuitem", strategy: "roving", select: "none" }),
  traits: ["composite-roving", "directional"],
  actions: { tabIn, moveTo, openMenu, openMenuOnLast, switchTo, closeMenu, typeahead, tabOut },
  queries: { items, openMenu: openMenuName, focusedItem, tabStop, isDisabled },
  submenus: { menu: (name) => menuContract.scoped({ trigger: { role: "menuitem", name } }) },
  events: {
    NAVIGATE: "moveTo", TYPEAHEAD: "typeahead", TRIGGER_PRESS: "openMenu", TRIGGER_KEY: "openMenuOnLast",
    TRIGGER_HOVER: "switchTo", MENU_NAVIGATE: "switchTo", MENU_CLOSED: "closeMenu", BLUR: "tabOut",
    FOCUS: { skip: "focus follows navigation and presses; covered by moveTo/openMenu" },
    FOCUS_MENUBAR: { skip: "programmatic focus(); driver test" },
    "COLLECTION.CHANGE": { props: (target) => ({ menus: target }) },
    "$sync:value": { props: (value) => ({ value }) },
  },
})
```

`menu(name)` returns a `getMenu` driver whose trigger is the named bar item, so every
`menu` action and query works inside the bar.

### 7. React parts

`Menubar.Root` (service, `MenuTree`, item registry, provider), `Menubar.Menu` (a menu
root level: calls the menu adapter with `parent`, `open` from the bar, `modal` and
`positioning` from the bar), `Menubar.Trigger` (menu trigger in menubar mode). Inside a
menu, consumers use `Menu.Positioner`, `Menu.Content`, `Menu.Item`, … directly.

### 8. Theme

`packages/theme/src/menubar.css`: tier-3 `--rind-menubar-bg`, `-border`, `-radius`,
`-padding`, `-gap`, `-trigger-height`, `-trigger-padding`, `-trigger-radius`,
`-trigger-open-bg`, `-trigger-open-text`, each with a semantic fallback. Triggers in the
`toggle item` family (ghost default; request 5); the open trigger draws an edge, not only
a background (forced colours); menus use `menu.css` unchanged.

## Requests to other changes

To `add-menu` — APPLIED (coordinator, 2026-10-14). Its design already
plans "Menubar becomes a tree parent of kind `menubar`"; these are the concrete hooks:

1. **APPLIED (coordinator, 2026-10-14).** **Parent elements in the root level's layer.** For a level whose parent kind is
   `menubar`, `elements()` = `[positioner, content, trigger, ...menuTree.parentElements()]`,
   where the menubar registers its root element. Overlay's layer accessor already takes
   any element list ("optionally its trigger"); nothing changes there.
2. **APPLIED (coordinator, 2026-10-14).** **Forward unconsumed horizontal keys to the parent.** A level whose parent kind is
   `menubar` sends `menuTree.parentNavigate({ from, direction })` for an `EXPAND` on an
   item that is not a submenu trigger and for a `COLLAPSE` at its top level, instead of
   ignoring them. Submenu levels keep their behaviour.
3. **APPLIED (coordinator, 2026-10-14).** **Trigger in menubar mode.** When the parent kind is `menubar`: trigger
   `role="menuitem"` (no `button` role), no own tab stop (roving props come from the
   bar), press delegated to the parent (`menuTree.parentPress(key, press)`) instead of
   toggling the level directly; vertical bars open on the expand key. The trigger's
   default element becomes `div` in that mode.
4. **APPLIED (coordinator, 2026-10-14).** **No focus restore on a sibling switch.** A level closed by
   `TREE.SIBLING_OPENED` skips focus restore (focus is moving into the sibling), so the
   old item is not focused and announced for a frame between menus.

To `add-theme-system` (`theme-variants`, Family Matrix):

5. **APPLIED (coordinator, 2026-10-14) — `toggle item` row only; the Menubar root in `panel` was not in the approved scope.** Add "Menubar trigger" to the `toggle item` row, and the Menubar root to `panel`.

## Risks / Trade-offs

- [Keyboard switching focuses the first item, APG's second option] → it needs no new
  menu opening mode and matches Windows menus; APG's recommended option (focus stays on
  the bar item) would need a third focus-on-open rule in `add-menu`. Revisit if the
  manual VO / NVDA pass prefers it.
- [Modal menubar locks page scroll while a menu is open] → native menus behave the same;
  `modal={false}` for app shells that must scroll.
- [VoiceOver cursor quirks in Safari menubars (radix#3699 "jumps to the end")] → no
  known cause; manual tier-1 pass, a quirk entry only if reproduced.

## Migration Plan

Reado `MenuBar.tsx`: `<div>` → `Menubar.Root aria-label="Application"`; each
`APP_MENUS` entry → `Menubar.Menu value={menu.label}` + `Menubar.Trigger` +
`Menu.Positioner` / `Menu.Content`; rows → `Menu.Item onSelect={() =>
runMenuCommand(id)}` with `disabled={!menuCommandEnabled(id)}` and the
`aria-keyshortcuts` + `aria-hidden` hint kept on the item; `header` → `Menu.Group` +
`Menu.GroupLabel`; `sep` → `Menu.Separator`. The window `mousedown` / `keydown`
listeners are deleted. Tests: `getByRole("button", { name: "File" })` →
`getByRole("menuitem", …)` or `getMenubar(…)`; `toBeDisabled()` →
`toHaveAttribute("aria-disabled", "true")`.
