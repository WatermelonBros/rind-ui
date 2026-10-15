## Context

See proposal.md for motivation and specs/menu/spec.md for behaviour. Research and the
Bug history the scenarios cite: [menu.md](../../../docs/research/menu.md). This change
consumes, without restating:

| From | Used for |
|---|---|
| `add-foundations` | `setup()`/`machine()`, `controllable()` (`open`), `bindProp()` (read-only `level`/`kind`), state-scoped effects, contracts (`{ skip }` events, prop steps), drivers, `testMachine`, React adapter |
| `add-a11y-foundations` | `core/dom/press` (trigger and item activation, `virtual` modality, secondary-button filtering, WebKit 228318 quirk), `core/dom/keyboard` (logical `NEXT`/`PREV`/`FIRST`/`LAST`/`EXPAND`/`COLLAPSE`, RTL), `focusSafely`, `data-focus(-visible)`, quirks registry, messages, invariants |
| `add-overlay-infrastructure` | `overlayEffect` (layer `kind: "menu"`, dismiss, initial focus, restore), stack-driven inert / scroll lock, presence, `Portal`, traits `layer`/`modal`/`presence`/`restores-focus` |
| `add-floating-positioning` | `env.position.track`, presets `dropdown` and `submenu`, `POSITION.PLACED`, `positioningQueries`, `anchored` trait |
| `add-collections` | static item parts → `Collection`, `collectionActions`/`Guards`/`Effects` (navigate, typeahead, pointerMove, repair, focusHighlighted), roving composite props, pointer guard, collection contract fragment |
| `add-tooltip` `hover-intent` | submenu open/close delays, hover zone, grace area, in-transit state, `HOVER.START`/`HOVER.END` |
| `add-button` / `add-toggle` | `button-like-element` for the trigger; `toggle` machine for checkbox items |

## Goals / Non-Goals

**Goals:**
- One `menu` definition used at every level (root, submenu, later menubar child), each
  level a small flat graph.
- Every scenario that cites an issue has a test that reproduces it first.
- Reado's `Dropdown.tsx` ports by renaming parts.

**Non-Goals:**
- Hierarchical states; runtime `spawn`; drag-to-select; root hover opening.

## Decisions

### 1. Composition: one service per level, linked by a `MenuTree` port

Answers machine-runtime open question 2 for menus (recorded in menu.md).

```ts
// core/components/menu/menu-tree.ts
export type MenuLevelId = string & { readonly __brand: "MenuLevelId" }
export type MenuParentKind = "menu" | "menubar" | "context-menu"
export interface MenuTree {
  register(level: { id: MenuLevelId; parent: MenuLevelId | null; send: (e: MenuTreeEvent) => void }): () => void
  openChild(parent: MenuLevelId, child: MenuLevelId): void   // closes the open sibling first
  childClosed(child: MenuLevelId): void
  closeTree(reason: CloseReason): void                     // root receives CLOSE { reason }
  openPath(): readonly MenuLevelId[]
  parentKind(): MenuParentKind | null
  // parent kind `menubar` only (add-menubar requests 1–3):
  parentElements(): readonly HTMLElement[]                 // the menubar root, added to the level's layer
  parentNavigate(input: { from: MenuLevelId; direction: "expand" | "collapse" }): void
  parentPress(key: CollectionKey, press: PressFields): void // trigger press delegated to the bar
}
export type MenuTreeEvent = { type: "TREE.CLOSE"; reason: CloseReason } | { type: "TREE.SIBLING_OPENED" }
```

- The root `Menu.Root` adapter creates the tree and injects it as `env.menuTree`; every
  `Menu.Submenu` registers with the nearest level id from context. The tree is plain data
  plus `send` callbacks, unit-tested in Node; machines only call it from actions.
- Open path = React Aria's root-owned stack: at most one open child per level, so
  sibling sweeps cannot leave two submenus open (base-ui#5152, radix#3761).
- Graph: each level's graph is the same static definition; `level` (`root` | `submenu`)
  is a `bindProp` read by guards, so model tests run the graph once per props class
  instead of a product graph.
- *Alternatives*: one machine for the tree (the open path, per-level highlight,
  typeahead buffers and hover timers would all live in context — a nested machine
  written by hand in a flat runtime); Zag's ref-linked siblings that write each other's
  context (the ZG#2811/#2931/#3056 bug class); a runtime `spawn` (adds runtime size and
  API for one consumer).

### 2. Machine (per level)

```
            TRIGGER_PRESS / TRIGGER_KEY / OPEN / SUB_OPEN / HOVER.START(after delay) / $sync(true)
  closed ───────────────────────────────────────────────────────────────────────────────► open
    ▲                                                                                       │
    └── TRIGGER_PRESS (open, toggle) · ITEM_SELECT · ESCAPE_KEY · TAB_KEY · OUTSIDE_PRESS ·  ┘
        OUTSIDE_FOCUS · WINDOW_BLUR · PARENT_DISMISSED · SUB_CLOSE · HOVER.END · TREE.CLOSE ·
        TREE.SIBLING_OPENED · CLOSE · $sync(false)
```

```ts
type MenuEvent =
  | ({ type: "TRIGGER_PRESS" } & PressFields)                 // root: trigger; submenu: its trigger item
  | { type: "TRIGGER_KEY"; key: "FIRST" | "LAST"; modality: "keyboard" }
  | { type: "SUB_OPEN"; modality: Modality }                  // EXPAND / Enter / Space on the submenu trigger
  | { type: "SUB_CLOSE" }                                      // COLLAPSE inside the submenu
  | { type: "ITEM_ACTIVATE"; key: CollectionKey; kind: ItemKind; modality: Modality; via: "press" | "enter" | "space" }
  | { type: "ESCAPE_KEY" | "OUTSIDE_PRESS" | "OUTSIDE_FOCUS" | "PARENT_DISMISSED"; request: DismissRequest }
  | { type: "TAB_KEY"; shift: boolean } | { type: "WINDOW_BLUR" }
  | { type: "HOVER.START" | "HOVER.END" }                      // hover-intent, submenu level only
  | { type: "GRACE.REST" }                                     // menu extension, §4
  | { type: "TREE.CLOSE"; reason: CloseReason } | { type: "TREE.SIBLING_OPENED" }
  | { type: "POSITION.PLACED"; side: Side; align: Align; anchorHidden: boolean; first: boolean }
  | { type: "OPEN" } | { type: "CLOSE" }
  | CollectionEvent                                            // NAVIGATE, TYPEAHEAD, POINTER_MOVE, HIGHLIGHT, COLLECTION.CHANGE
```

- States are only `closed | open`; hover delays live in `hover-intent`, not in states.
- `open.effects`: `overlay` (root: modal per prop, trigger included in `elements()` —
  §5; submenu: non-modal child layer), `trackPosition`, `windowBlur` (root only),
  `hoverIntent` (submenu only), `focusHighlighted` (collections).
- Entry of `open` records `openModality`; `POSITION.PLACED { first }` runs
  `focusInitial`: keyboard/virtual → first (or last for `TRIGGER_KEY LAST`), else the
  content. Context `openingPress` id makes the opening press's own release/click a
  no-op on items (radix#1655, #610, react-spectrum#9686).
- `ITEM_ACTIVATE` action `select`: calls `onSelect(details)`; unless cancelled and if
  `closeOnSelect` (per kind default, §3) → `menuTree.closeTree("ITEM_SELECT")`. The
  close is queued after the item's `click` dispatch (press module order), which keeps
  touch selections from reaching elements below.
- `TAB_KEY` → `closeTree("TAB_KEY")`, then focus the root trigger without
  `preventDefault`, so the browser's own Tab continues from it (Headless UI's approach;
  Shift+Tab lands before the trigger).
- `ESCAPE_KEY` closes only this level (overlay routes it to the topmost layer) and
  `preventDefault`s it.
- Parent kind `menubar`: an `EXPAND` on an item that is not a submenu trigger, and a
  `COLLAPSE` at the root level, call `menuTree.parentNavigate({ from, direction })`
  instead of being ignored (logical keys, so RTL is handled by `core/dom/keyboard`).
  Submenu levels are unchanged.
- A close by `TREE.SIBLING_OPENED` skips focus restore (focus is moving into the
  sibling), so the old trigger is not focused and announced between menus.
- Disabled items: `focusableWhenDisabled` (default `true`) is passed to navigation;
  `pointerMove` ignores disabled keys; `ITEM_ACTIVATE` is never sent for them (press
  module sends nothing for disabled parts).

### 3. Items, checked state

| Kind | Role | `closeOnSelect` default | State |
|---|---|---|---|
| item / link item | `menuitem` | `true` | — |
| checkbox-item | `menuitemcheckbox` | `false` | `toggle` service, `pressed` exposed as `checked` |
| radio-item | `menuitemradio` | `false` | `menu-radio-group` service: one controllable `value` |
| submenu-trigger | `menuitem` + popup | n/a | the child level's `open` |

Checked state lives in sibling services owned by the part (the same composition rule as
§1; Toggle Group reuses Toggle the same way). The menu's `select` action calls the
part's registered `onActivate`, which sends `PRESS` to the toggle service or `SELECT` to
the radio group. Space on checkbox/radio never closes; Enter and pointer follow
`closeOnSelect`. Indicators render from the part service's snapshot.

Links: connect gives `<a>` items `role="menuitem"`; Enter is left to the browser
(the press module treats link-like parts as Enter-only and does not synthesise a click);
Space is `preventDefault`ed and dispatches one `click`; clicks with `metaKey`, `ctrlKey`,
`shiftKey` or a middle button are not presses for the menu (no `ITEM_ACTIVATE`), so the
browser default runs and the menu stays open (Zag/Ariakit `isOpeningInNewTab`).
Link items are built with add-link's `linkProps` (amended from add-link): it owns the
modifier/middle-click, router and disabled rules, and the menu closes only on
`onActivate({ disposition: "same-tab" })`; the menu adds Space and `role="menuitem"`.

### 4. Submenu pointer intent (extension of `hover-intent`)

`hover-intent` (add-tooltip) gives open/close delays, the hover zone (trigger, content,
descendant layers), a grace area from the exit point toward the target's rectangle and
in-transit suppression of other hover-intent triggers. Menu adds:

- **Placed side**: the grace target rectangle is the submenu content as placed
  (`POSITION.PLACED.side`), not the requested side (radix#4036).
- **Parent highlight freeze**: while `hoverIntent.inTransit()` is true for a child,
  the parent's `pointerMove` action ignores moves (zag#2955).
- **Rest timeout**: `GRACE.REST` after `submenuGraceTimeout` (300 ms) with no pointer
  movement inside the grace area ends the transit; the parent then highlights the item
  under the last pointer position (radix#2935, bits-ui#2191).
- **Leave detection** also from `pointerout`, because Chrome drops `mouseleave` in fast
  sweeps (base-ui#5152).

*Alternatives*: React Aria's direction test with `pointer-events: none` on the parent
(style mutation; RA#9641 regression), Base UI's body `pointer-events` (the radix#1241
class), Ariakit's capture-phase event swallowing (fine, but hover-intent already
owns transit).

### 5. Modality and the inert-labelling decision

- Root `overlay` options: `kind: "menu"`, `modal` (default `true`), dismiss
  `{ escape: true, outsidePress: true, outsideFocus: !modal }`, `elements: () =>
  [positioner, content, trigger]`; when the parent kind is `menubar`, `[positioner,
  content, trigger, ...menuTree.parentElements()]` (the menubar root).
- Including the trigger in `elements()` keeps it outside `inertOutside`, so the menu's
  `aria-labelledby` → trigger resolves in Chromium (RA#9737, crbug 489792331;
  assistive-tech open question 4) and the trigger counts as inside for dismissal (it
  toggles). Containment's Tab wrap is never used by menus (Tab closes, §2). No name is
  copied.
- Window blur effect: `window` `blur` (via `env.dom`) → `WINDOW_BLUR` on the root.

### 6. Connect

Per spec Roles/ARIA and Data Attributes. Notables: trigger from `button-like-element`
plus `aria-haspopup="menu"`, `aria-expanded`, `aria-controls` (mounted only), and the
press option `labelActivation: "focus"` on the root trigger (add-label: a label-forwarded
click focuses it and never opens the menu; radix#3679, headlessui#3787); content
`role="menu"`, `tabindex=-1`, `aria-labelledby` (trigger id unless consumer naming);
non-item children `role="none"` through the part registry; submenu trigger
`aria-expanded` omitted when `quirkActive("vo-submenu-expanded")` and open; layer meta
via `layer.meta()`; positioner/arrow via positioning connect helpers. `separator` is
add-separator's `separatorProps({ context: "menu", scope: "menu", defaultOrientation })`
with the default perpendicular to the content's orientation. Trigger in menubar mode
(parent kind `menubar`): `role="menuitem"` instead of the button role, roving
`tabIndex` from the bar instead of its own tab stop, press → `menuTree.parentPress(key,
press)` instead of `TRIGGER_PRESS`; React default element `div`. Key handlers act
only when `event.target` is the content or a registered item (radix#3232).

### 7. React parts

`Menu.Root` (service, tree, `LayerProvider`), `Trigger`, `Positioner`, `Content`,
`Arrow`, `Item`, `CheckboxItem`, `RadioGroup`, `RadioItem`, `ItemIndicator`, `ItemText`,
`Group`, `GroupLabel`, `Separator`, `Submenu`, `SubmenuTrigger`; `render` on each.
Presence per animated part; lazy mount, unmount after exit, `keepMounted`.

### 8. Contract

```ts
export const menuContract = contract(menuMachine, {
  scope: "menu",
  locate: { role: "button", name: true, part: "trigger" },
  ...collectionContract({ itemRole: ["menuitem", "menuitemcheckbox", "menuitemradio"], strategy: "roving", select: "both" }),
  ...positioningQueries,
  traits: ({ props }) => ["layer", "restores-focus", "presence", "anchored", ...(props.modal === false ? [] : ["modal"] as const)],
  exceptions: [{ part: "submenu-trigger", invariant: "aria-expanded-mirrors-state", quirk: "vo-submenu-expanded" }],
  actions: { open, openWithArrowUp, close, choose, toggle, openSubmenu, closeSubmenu, pressEscape, pressOutside, tabOut, typeahead },
  queries: { isOpen, items, highlighted, focusedItem, isChecked, isDisabled, openPath, closeReason },
  events: {
    TRIGGER_PRESS: "open", TRIGGER_KEY: "openWithArrowUp", ITEM_ACTIVATE: "choose", SUB_OPEN: "openSubmenu",
    SUB_CLOSE: "closeSubmenu", ESCAPE_KEY: "pressEscape", OUTSIDE_PRESS: "pressOutside", TAB_KEY: "tabOut",
    OPEN: { skip: "programmatic" }, CLOSE: { skip: "programmatic" }, WINDOW_BLUR: { skip: "window focus" },
    OUTSIDE_FOCUS: { skip: "non-modal only; driver test" }, PARENT_DISMISSED: { skip: "tree; unit test" },
    "TREE.CLOSE": { skip: "tree; unit test" }, "TREE.SIBLING_OPENED": { skip: "tree; unit test" },
    "GRACE.REST": { skip: "browser pointer test" }, "HOVER.START": { skip: "browser pointer test" }, "HOVER.END": { skip: "browser pointer test" },
    "$sync:open": { props: (open) => ({ open }) },
  },
})
```

### 9. Theme

`packages/theme/src/menu.css` reads tier-3 tokens only (decision 0007, proposed):
`--rind-menu-bg`, `-border`, `-radius`, `-shadow`, `-padding`, `-item-height`,
`-item-padding`, `-item-highlight-bg`, `-item-highlight-text`, `-item-disabled-text`,
`-separator`, `-group-label-text`, `-indicator-size`, `-min-width`, `-max-height`
(`min(var(--rind-menu-max-height), var(--rind-available-height))`), each defaulting to a
semantic token.

### Resolved open questions

| Question | Decision | Why |
|---|---|---|
| Machine composition (machine-runtime Q2) | Sibling services per level + `MenuTree` port | §1 |
| Chromium inert labelling (assistive-tech Q4) | Trigger kept in the layer's elements; no copied names | §5 |
| Open on pointerdown or release | Release, all inputs | menu.md Bug history (AT, touch, 2.5.2) |
| Escape in submenus | Innermost only | APG, rule 19 |
| Loop / typeahead / disabled | `loop: true`, 1000 ms, focusable-when-disabled | menu.md Decisions |
| Modal default | `true` | Native behaviour, ark#2874; costs a second click between menus (accepted) |

## Risks / Trade-offs

- [`hover-intent` needed a placed target and a rest timeout] → specified in add-tooltip (`hover-intent` → "Placed Target And Rest Timeout", task A.1); add-menu only passes the options.
- [Trigger in the layer's elements] → specified in add-overlay-infrastructure
  (`layer-stack` registration now lists the optional trigger).
- [Modal menus need two clicks to move to another menu] → native behaviour; `modal={false}`
  for toolbars; Menubar handles switching.
- [VO+Space double click on native `<button role=menuitem>`] → items render `div`; the
  press quirk entry covers substituted buttons.
- [Grace geometry not testable in jsdom] → browser-mode tests with real pointer paths.

## Migration Plan

New API. Reado: `Dropdown.tsx` replaces `@ark-ui/react/menu` parts with `Menu.*`, drops
`lazyMount unmountOnExit`, `onOpenChange={(e) => …e.open}` → `(open) => …`, `positioning`
`placement` → `positioning={{ side, align }}`, `Menu.Item onSelect` unchanged.
