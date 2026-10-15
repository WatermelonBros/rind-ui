## Why

Menubar ships in six of nine libraries and Reado draws one by hand for its Windows /
Linux title bar (`MenuBar.tsx`: no roles, no roving focus, no arrow keys, no focus
restore). The bugs other libraries had are about the bar, not the menus: screen readers
that cannot open a menu (radix#3699), open mode that leaks after the last menu closed
(kobalte#333) or depends on how a menu was opened (ariakit#7083, #7086), two clicks to
switch between modal menus, vertical bars without arrow keys (ariakit#7410). `add-menu`
was designed for this: its `MenuTree` port has a parent kind `menubar`, and its design
notes that Menubar handles switching between modal menus. This change specifies that
parent.

Research: [menubar](../../../docs/research/menubar.md) (sources, Bug history,
Accessibility, Decisions) · [menu](../../../docs/research/menu.md) ·
[collections](../../../docs/research/collections.md) ·
[overlay-infrastructure](../../../docs/research/overlay-infrastructure.md) ·
[accessibility](../../../docs/research/accessibility.md) ·
[assistive-tech-and-a11y-testing](../../../docs/research/assistive-tech-and-a11y-testing.md) ·
[native-platform](../../../docs/research/native-platform.md)

**Depends on** `add-menu` (menu levels, `MenuTree`, every part inside a menu, opening,
closing, modality, the inert-labelling rule), and through it `add-foundations`,
`add-a11y-foundations`, `add-overlay-infrastructure`, `add-floating-positioning`,
`add-collections`, `add-tooltip` (`hover-intent`), `add-button`, `add-toggle`; plus
`add-theme-system`. Three additive points on `add-menu` are requested in design.md.

## What Changes

- `@rind-ui/core`: the `menubar` machine (roving focus and typeahead over the bar's
  items, one controllable open-menu value, open mode), connect, contract; the menubar
  as a `MenuTree` parent of kind `menubar`.
- Behaviour: one tab stop; Left / Right (Up / Down when vertical), Home / End and
  typeahead on the bar; Enter / Space / Down open a menu on its first item, Up on its
  last; the first menu opens on press release only; once open, a press or a mouse hover
  on another item, or an arrow key the open menu does not use, switches menus in one
  step; closing the last menu ends open mode; modal menus by default with the bar kept
  interactive; vertical bars.
- `@rind-ui/react`: `Menubar.Root`, `Menubar.Menu`, `Menubar.Trigger`; every other part
  is the Menu part (`Menu.Positioner`, `Menu.Content`, `Menu.Item`…).
- `@rind-ui/testing`: `getMenubar` driver and model-based coverage.
- Theme stylesheet (`--rind-menubar-*`), stories, docs page; Reado migration notes.

## Capabilities

### New Capabilities

- `menubar`: the Menubar component — anatomy, roles and naming, open-menu value and
  reasons, keyboard on the bar, opening, open-mode switching by press, hover and
  keyboard, closing, modality, orientation, disabled items, positioning, `data-*`,
  contract and driver.

### Modified Capabilities

None. The `menu` capability is introduced by the unarchived `add-menu`; the additive
needs are listed in design.md "Requests to other changes".

## Non-goals

- Opening the first menu on hover (radix#2244, reka#240): APG requires a click; hover
  opens only in open mode.
- Top-level items that are not menus (links, checkbox items in the bar; reka#2048) —
  Navigation Menu and Toolbar cover those.
- `focusOnAlt` or any global hotkey (Kobalte); `focus()` is provided for apps.
- Tab through every bar item (ariakit#1134): APG one tab stop.
- A separator between bar items; multiple rows of bar items.
- Re-specifying anything inside a menu (items, submenus, grace area, typeahead, Escape
  per level, Tab, focus restore) — `add-menu`.
- Framework adapters other than React; fx.

## Impact

- New code: `packages/core/src/components/menubar/{menubar.machine,menubar.connect,menubar.contract,menubar.messages}.ts`,
  `packages/react/src/menubar/*`, `getMenubar` in `@rind-ui/testing`,
  `packages/theme/src/menubar.css`, stories, generated docs page.
- Public API: `menubar` machine / connect / contract, `Menubar` parts, `getMenubar`.
- Reado: `MenuBar.tsx` and its tests move to `Menubar` + `Menu` parts.
- No new runtime dependency.
