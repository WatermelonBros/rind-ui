# Menubar — research

Status: done · Wave: 2 (Reado: `src/components/molecules/MenuBar.tsx`, the Windows /
Linux title-bar menu)

A persistent row of menu buttons (File, Edit, View…) that behaves as one composite:
one tab stop, arrows between the top items, and — once one menu is open — the bar is in
"open mode": arrow keys and the pointer move between menus without a second click.
Everything inside a menu (items, checkbox and radio items, submenus, typeahead, grace
area, Escape per level, Tab closing the tree, modality, the inert-labelling rule) is
[menu.md](menu.md) / `add-menu`. This note covers only what the bar adds.

Sources: shallow clones read 2026-10-14 (paths repo-relative). Bug history:
`gh search issues` over the ten trackers in [README.md](README.md) with `menubar`,
`menubar keyboard`, `menubar hover`; ~190 hits, ~40 menubar-related, 28 read in full.

## Pattern

- WAI-ARIA APG: [Menu and Menubar](https://www.w3.org/WAI/ARIA/apg/patterns/menubar/)
  and the [editor menubar example](https://www.w3.org/WAI/ARIA/apg/patterns/menubar/examples/menubar-editor/)
  (both fetched 2026-10-14).
- Roles and attributes: container `role="menubar"`, named by `aria-labelledby` or
  `aria-label`; `aria-orientation="vertical"` when vertical (default horizontal); top
  items `role="menuitem"` with `aria-haspopup="menu"` and `aria-expanded`; each popup is
  a `menu` labelled by its menubar item.
- Keyboard (APG):

  | Where | Key | Behaviour |
  |---|---|---|
  | Menubar | Right / Left | next / previous item, optionally wrapping (the example wraps) |
  | Menubar | Down / Enter / Space | open the item's menu, focus its first item |
  | Menubar | Up (optional) | open the item's menu, focus its last item |
  | Menubar | Home / End | first / last item |
  | Menubar | a–z (optional) | next item whose name starts with the character |
  | Menu | Right on an item without submenu | close the menu (and parents), move to the next menubar item and open its menu — APG recommends keeping focus on the menubar item, or else focusing the first item |
  | Menu | Left at the top level | the same towards the previous menubar item |
  | Menu | Escape | close the menu, focus its menubar item |
  | Anywhere | Tab / Shift+Tab | leave the menubar, close every menu |
- Pointer (example): the first menu opens on click only; once a menu is open, hovering
  another menubar item opens its menu (focus follows hover).

## How the others built it

Shipped by Radix, Base UI, Ariakit, Reka, Bits and Kobalte (6 of 9); React Aria, Zag /
Ark and Headless UI have none.

### Radix (Reka and Bits are ports)

- Source: `radix/packages/react/menubar/src/menubar.tsx`; `reka-ui/packages/core/src/Menubar/*`;
  `bits-ui/packages/bits-ui/src/lib/bits/menubar/menubar.svelte.ts`.
- Parts: Root (`value` = the open menu, `''` = none; `loop` true; `dir`), Menu, Trigger,
  Portal, Content and every Menu part re-exported. Root is a `RovingFocusGroup`
  (horizontal only — vertical asked in RX#3762) with a manually managed tab stop
  ("our triggers won't ever be given focus — click to open then outside to close").
- Menus are **non-modal**. Triggers are `<button role="menuitem">`, open on
  `pointerdown` (left button, no Ctrl), toggle on Enter / Space, open on ArrowDown.
  `pointerenter` on another trigger while open opens it and focuses that trigger.
- Content `onKeyDown`: Left / Right not consumed by a submenu → open the previous /
  next enabled menu (wrapping with `loop`); content gets focus but the first item only
  when the opening was by keyboard (`wasKeyboardTriggerOpenRef`).
- No typeahead on the bar. Problems: VO in Safari cannot open a menu with VO+Space and
  VO+Right jumps to the end (RX#3699, open); touch scroll opens menus (RX#3267 → the
  pointerdown class, RX#1912).

### Base UI

- Source: `base-ui/packages/react/src/menubar/Menubar.tsx`, `menu/trigger/MenuTrigger.tsx`,
  `menu/root/MenuRoot.tsx`, `menu/positioner/MenuPositioner.tsx`.
- `Menubar` is a `CompositeRoot` (`role="menubar"`, `orientation`, `loopFocus` true,
  Home / End, `modal` default **true**, `disabled`) in a Floating UI tree; plain
  `Menu.Root` / `Menu.Trigger` detect a `menubar` parent (`parent.type`).
- Inside a menubar the trigger gets `role="menuitem"`, opens on `mousedown`, and once a
  menu is open (`hasSubmenuOpen`) hover and **focus** open sibling menus; returning focus
  is forced unless closed by an outside press.
- Modal menubar menus render the internal backdrop with a **cutout over the whole
  menubar**, so the other triggers stay hoverable and clickable while a modal menu is
  open — the trick that removes the "two clicks between modal menus" cost.
- Problems: `disabled` on the bar did not disable menus (BU#2727); after switching menus
  by hover, a radio item in a submenu closed the tree (BU#2092); the portal's
  `aria-owns` owner span inside `role="menubar"` failed `aria-required-children`
  (BU#4004).

### Ariakit

- Source: `ariakit-react-components/src/menubar/*`, `menu/*`; sandboxes `menubar-7410`,
  `menubar-navigation`, `menubar-composite-orientation`.
- A composite store (`orientation`, `focusLoop`, `rtl`, `virtualFocus`); menu buttons
  inside it become menubar items; `showOnHover` / `focusOnHover` drive switching.
- Problems: VO focus jumped out of the bar on open (AK#5262: portal `aria-owns` racing
  VO's focus tracking; not reproduced in Safari 26.4); a menu opened programmatically
  broke hover switching or left two menus open (AK#7083, AK#7086); with hover options
  off, clicking another trigger while one menu was open did nothing (AK#4023, open); in
  a vertical menubar no arrow key opened a menu and menus opened below (AK#7410);
  consumers asked for Tab through every item (AK#1134, declined).

### Kobalte

- Source: `kobalte/packages/core/src/menubar/{menubar-root,menubar-menu,menubar-trigger}.tsx`.
- `value` + `autoFocusMenu` (hover-switching mode, controllable), `focusOnAlt` (Alt
  alone focuses the bar), link triggers. Problems: after closing a menu by re-clicking
  its trigger or Escape, hover still opened menus (KB#333); Enter opened the first
  focused trigger, not the highlighted one (KB#332); two clicks needed after closing by
  selecting an item (KB#544, open).

### Reado (consumer)

- `MenuBar.tsx`: hand-rolled. `open: number | null`; click toggles; `onMouseEnter`
  switches once a menu is open; window `mousedown` outside and Escape close; items are
  `<button>` with `disabled`, `aria-keyshortcuts` and an `aria-hidden` shortcut hint;
  headers and separators are plain `div`s. **No roles, no roving focus, no arrow keys,
  no focus restore.** Its tests (`__tests__/MenuBar.uitest.tsx`) query
  `getByRole("button")` and `toBeDisabled()`, which change with the migration
  (`menuitem`, `aria-disabled`).

## Accessibility

Applying [accessibility.md](accessibility.md) and
[assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md) ("Menu /
menubar" in §1.4), on top of menu.md's Accessibility section:

- **AT activation (cause A).** VO+Space and NVDA browse-mode Enter send a bare click;
  Radix's `pointerdown`-only trigger fails (RX#3699). Opening is the menu's
  release/click rule, so the bar inherits the fix; a virtual open focuses the first item.
- **VoiceOver focus on open.** AK#5262 (VO cursor jumps out of the bar) came from the
  portal's `aria-owns` plus focus queued before VO tracked the new menu. rind-ui
  portals use no `aria-owns`, and the menu moves focus after first placement. RX#3699's
  "VO+Right jumps to the end" has no known cause; it goes to the manual protocol (VO +
  Safari tier 1), not to a quirk entry.
- **No foreign children** in `menubar` (BU#4004): only menubar items (and `none`
  wrappers) are children; nothing is injected next to the triggers.
- **Roving focus**, one tab stop, re-entry on the last focused item; Tab never walks
  every item (AK#1134 declined — APG).
- **Name.** Dev warning for an unnamed menubar; each menu is named by its menubar item
  (menu rule).
- **Modal menus and the bar.** With modal menus the outside is `inert`; the bar itself
  must stay exposed and interactive (Base UI's cutout) so the triggers keep their names,
  hover switching works and a press on another trigger switches in one press.
- **Disabled items** stay focusable with `aria-disabled` (APG discoverability; menu's
  default) and never open; open-mode switching skips them.
- **Typeahead** on the bar (APG optional, the example has it): shared collections
  typeahead over the triggers' text.
- **RTL**: Left / Right mirrored; in a vertical bar menus open to the inline end.
- **Forced colors / target size**: triggers use the toggle-item styles (outline for the
  open state, not only a background); 24×24 targets.
- **Native platform**: no native menubar on the web; macOS apps (Reado) use the system
  menu bar instead — documented.

## Bug history

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| Radix | [#3699](https://github.com/radix-ui/primitives/issues/3699) open | Safari VO: VO+Space does not open a menu; VO+Right jumps to the end | `pointerdown`-only trigger; unknown for the cursor jump | Open | Open on click for every modality (menu); manual VO pass (Spec, tasks) |
| Ariakit | [#5262](https://github.com/ariakit/ariakit/issues/5262) closed | VO focus leaves the menubar when a menu opens | Portal `aria-owns` + focus queued before VO tracked the menu | Not reproduced in Safari 26.4 | No `aria-owns`; focus after placement; manual VO pass (Spec) |
| Base UI | [#4004](https://github.com/mui/base-ui/issues/4004) closed | `aria-required-children` fails: `span[aria-owns]` inside the menubar | Portal owner span as a child | PR #5058 | Menubar children are menubar items only; axe on the open state (Spec) |
| Radix | [#3267](https://github.com/radix-ui/primitives/issues/3267) closed | Touching the bar while scrolling opens a menu | `pointerdown` open | Same as #1912 | Release-based open; scroll cancels (Spec) |
| Ariakit | [#4023](https://github.com/ariakit/ariakit/issues/4023) open | With hover off, clicking another trigger while one menu is open does nothing | Switching tied to hover options | Open | One press on another trigger always switches (Spec) |
| Kobalte | [#544](https://github.com/kobaltedev/kobalte/issues/544) open | Two clicks to open another menu; controlled object value cannot close | Dismiss then press; identity comparison | Open | Pressing another trigger switches in one press; value is a string key (Spec) |
| Kobalte | [#333](https://github.com/kobaltedev/kobalte/issues/333) closed | After closing by re-click or Escape, hover still opens menus | Open mode not cleared on close | Fixed | Open mode ends whenever the last menu closes (Spec) |
| Kobalte | [#332](https://github.com/kobaltedev/kobalte/issues/332) closed | Enter opens the first focused trigger, not the one arrowed to | Open target from stale state | Fixed | Keys open the focused item's menu (Spec) |
| Ariakit | [#7083](https://github.com/ariakit/ariakit/issues/7083) closed | Hover switching dead after a programmatic open | Switching read from the trigger path | Fixed | Open mode is derived from the bar's value, however it was set (Spec) |
| Ariakit | [#7086](https://github.com/ariakit/ariakit/issues/7086) closed | Two menus open after hovering a sibling following a programmatic open | Close decided from the disclosure element | Fixed | At most one open menu, enforced by the menu tree (Spec) |
| Bits UI | [#1273](https://github.com/huntabyte/bits-ui/issues/1273) closed | Two sibling submenus open at once while hovering | Per-sub timers | Fixed | Menu tree: one open child per level (menu spec) |
| Base UI | [#2092](https://github.com/mui/base-ui/issues/2092) closed | After hover-switching menus, a radio item in a submenu closes everything | Close reason from the switch leaked | Fixed | Item closing rules unchanged after switching (Spec) |
| Base UI | [#2727](https://github.com/mui/base-ui/issues/2727) closed | `disabled` on the bar does not disable menus | Not propagated | PR #2736 | Disabled bar disables every item (Spec) |
| Ariakit | [#7410](https://github.com/ariakit/ariakit/issues/7410) closed | Vertical menubar: no arrow opens a menu; menus open below | Horizontal assumptions | Fixed (#7414) | Vertical: expand key opens, menus placed inline-end (Spec) |
| Radix | [#3762](https://github.com/radix-ui/primitives/issues/3762) closed | No vertical orientation | Not implemented | PR #3764 | `orientation` supported (Spec) |
| Bits UI | [#989](https://github.com/huntabyte/bits-ui/issues/989) closed | Left arrow does not move between menubar items | Direction-specific bug | Fixed | Both directions and RTL in model tests (tests) |
| Radix | [#2244](https://github.com/radix-ui/primitives/issues/2244) closed; Reka [#240](https://github.com/unovue/reka-ui/issues/240) closed | Asked: open the first menu on hover | APG: first open needs a click | Declined | Non-goal; hover opens only in open mode (Spec) |
| Ariakit | [#1134](https://github.com/ariakit/ariakit/issues/1134) closed | Asked: Tab through every menubar item | Composite behaviour | Declined | One tab stop (APG) (Spec) |
| Reka | [#164](https://github.com/unovue/reka-ui/issues/164) closed | Highlight stays after an outside click with no menu open; content auto-opens on navigation | Highlight not tied to focus; open mode leaked | Fixed | Highlight follows focus; arrows on the bar never open while closed (Spec) |
| Bits UI | [#1862](https://github.com/huntabyte/bits-ui/issues/1862) closed | Disabling an item in its own `onclick` leaves the menu open | Not stated in the issue | Fixed | Activation decides from the state at press time (menu rule; test) |
| Bits UI | [#1203](https://github.com/huntabyte/bits-ui/issues/1203) closed | Menus do not work in fullscreen | Not diagnosed | Closed; asked to retest on 1.0 | Portal target follows the fullscreen element (overlay portal; test) |
| Radix | [#2569](https://github.com/radix-ui/primitives/issues/2569) closed | Menubar menu does not mount inside a Suspense boundary | Content not mounted inside the Suspense boundary (dev / HMR) | Closed | Commit-time registration (collections / react adapter); Suspense test (tasks) |
| Bits UI | [#1593](https://github.com/huntabyte/bits-ui/issues/1593) closed | Arrow keys in the bar crash while another popover is open | Competing global handlers | Fixed (#1591) | Bar handles only keys targeting its own items (Spec) |
| Kobalte | `menubar-root.tsx` (source) | `focusOnAlt`: Alt alone focuses the bar | Desktop-app convention | — | Non-goal; `focus()` API for app hotkeys |
| Reka | [#2048](https://github.com/unovue/reka-ui/issues/2048) open | Asked: top-level items and checkbox items in the bar | Bar holds menus only | Open | Non-goal (Navigation Menu / Toolbar cover it) |
| Base UI | `MenuPositioner.tsx` (source) | Modal menubar menus: backdrop cutout over the whole bar | — | — | The bar stays inside the open menu's layer (Spec; request to add-menu) |

## Known pitfalls

1. **Open mode leaks** (KB#333, RK#164): hover keeps opening menus after the user closed
   the last one.
2. **Switching depends on how a menu opened** (AK#7083 / #7086): state must live in one
   value, not in the trigger path.
3. **Modal menus vs the bar**: either two clicks to switch (modal, no cutout) or no
   modality at all (Radix). The bar must be part of the open layer.
4. **`pointerdown` triggers**: AT and touch bugs inherited from menus.
5. **Horizontal assumptions** in vertical bars (AK#7410).

## Testing notes

- Model tests on the menubar graph (closed / open × focus position) with argument
  classes horizontal, vertical, `loop: false`, disabled item, disabled bar, modal and
  non-modal; each menu level is covered by the menu contract's own model tests.
- Browser mode: hover switching with real pointer paths, including a sweep across five
  triggers; touch scroll over the bar.
- Driver: `getMenubar(screen, { name })` with `openMenu(name)`, `switchTo(name)`,
  `moveTo(name)`, `closeMenu()`, `typeahead(text)`, `tabOut()`, `menu(name)` (a scoped
  `getMenu` driver); queries `items()`, `openMenu()`, `focusedItem()`, `tabStop()`,
  `isDisabled(name)`.

## Decisions

- **Parts**: `root` (`div`, `role="menubar"`), `menu` (no element: a Menu root level
  whose parent is the bar), `trigger` (`div`, `role="menuitem"`; Menu's trigger part in
  menubar mode). Inside each menu, every Menu part (`positioner`, `content`, items,
  groups, separators, submenus) is reused unchanged.
- **Composition**: `Menubar.Root` creates the `MenuTree` with a parent of kind
  `menubar` (add-menu decision 1); each `Menubar.Menu` is a menu root level registered
  under it. "At most one open menu" is the tree's open-path rule.
- **Machine** `menubar`: states `closed` (no menu open) and `open` (open mode);
  controllable `value: string | null` (the open menu's key); collection context over
  the triggers. Events: `NAVIGATE`, `TYPEAHEAD`, `FOCUS`, `BLUR`, `TRIGGER_PRESS
  { key }`, `TRIGGER_KEY { key, edge }`, `TRIGGER_HOVER { key }`, `MENU_NAVIGATE
  { direction }` (an expand / collapse key the open menu did not consume),
  `MENU_CLOSED { reason }`, `COLLECTION.CHANGE`, `FOCUS_MENUBAR`.
- **Switching**: in `open`, a press on another trigger, a mouse / pen hover over another
  enabled trigger and `MENU_NAVIGATE` move `value` to the target menu in one step
  (typeahead stays the open menu's, since focus is in it); the target opens with the menu's own focus-by-modality rule
  (keyboard: first item — APG's alternative to "focus stays on the bar item", chosen
  because it needs no new menu opening mode and matches Windows menus; pointer: the
  content). Disabled triggers are skipped. Closing the last menu, by any reason, returns
  to `closed` (KB#333).
- **Modality**: `modal` (default `true`) is passed to every menu; the menubar root is
  one of each open menu's layer elements, so it stays outside `inert`, counts as inside
  for dismissal, and keeps its triggers' names reachable (request to add-menu).
- **Orientation**: horizontal — Left / Right between items, Down / Enter / Space open +
  first, Up open + last, menus placed below (`dropdown` preset, align start). Vertical —
  Up / Down between items, the expand key / Enter / Space open + first, menus placed
  inline-end (`submenu` preset); inside a menu the collapse key at its top level closes
  it and focuses its bar item.
- **`data-*`**: root `data-orientation`, `data-state` (`open` | `closed`: open mode),
  `data-disabled`; trigger the menu trigger's attributes plus `data-key`,
  `data-highlighted` (focused bar item), `data-orientation`.
- **Contract**: locate by role `menubar` and name; actions and queries from Testing
  notes; traits `composite-roving`, `directional`; each menu reuses `menuContract`.
- **Deliberately different**: release-based opening (Radix / Base UI open on down
  events); modal menus that still switch in one press (Base UI's cutout, expressed as a
  layer element instead of a backdrop hole); open mode derived from one value; typeahead
  on the bar (Radix and Base UI have none).

## Open questions

None that change the specs. `focusOnAlt` (Kobalte) waits for a consumer; Reado's
title-bar shortcuts already go through its own hotkey layer.
