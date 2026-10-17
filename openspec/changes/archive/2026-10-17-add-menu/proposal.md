## Why

Menu is in Reado's first migration set (`Dropdown.tsx` and the eight hand-rolled
context menus that will move to `add-context-menu`), and it is the component where
headless libraries keep failing the same things: menus that screen readers cannot open,
down-event opening that breaks touch scrolling and WCAG 2.5.2, Escape and Tab that ignore
APG, submenus that close on the way to them, link items that navigate twice or not at
all, and modal menus that lose their accessible name in Chromium. The infrastructure it
needs (overlay, positioning, collections, hover intent, press) is specified; this change
specifies the component on top.

Research: [menu](../../../docs/research/menu.md) (sources, Bug history, Accessibility,
Decisions — including the Chromium inert-labelling decision and the submenu composition
decision) · [collections](../../../docs/research/collections.md) ·
[overlay-infrastructure](../../../docs/research/overlay-infrastructure.md) ·
[floating-positioning](../../../docs/research/floating-positioning.md) ·
[tooltip](../../../docs/research/tooltip.md) (hover intent) ·
[accessibility](../../../docs/research/accessibility.md) ·
[assistive-tech-and-a11y-testing](../../../docs/research/assistive-tech-and-a11y-testing.md) ·
[native-platform](../../../docs/research/native-platform.md)

**Depends on** `add-foundations` (runtime, `controllable`, contracts, drivers,
`testMachine`, React adapter), `add-a11y-foundations` (press, modality, keyboard
normalisation, quirks registry, messages, invariants), `add-overlay-infrastructure`
(layer stack, dismissable layer, focus containment/restore, outside inert, scroll lock,
presence, portal), `add-floating-positioning` (presets `dropdown`, `submenu`),
`add-collections` (static item parts, navigation, typeahead), `add-tooltip`
(`hover-intent`: delays, hover zone, grace area, in-transit suppression), `add-button`
(`button-like-element` for the trigger) and `add-toggle` (checkbox item state).
`add-context-menu` depends on this change; Menubar (later) reuses it.

## What Changes

- `@rind-ui/core`: the `menu` machine (one service per menu level), connect, contract and
  messages; the `MenuTree` capability linking levels (open path, close-tree, parent kind);
  a `menu-radio-group` service; the `vo-submenu-expanded` quirk entry.
- Behaviour: opens on press release for every input (assistive-technology clicks
  included); focus on open by modality; roving focus, loop, typeahead; disabled items
  keyboard-reachable but never pointer-highlighted or activated; checkbox and radio items
  that keep the menu open; link items with native navigation; submenus with APG keys, RTL,
  toggling triggers and a menu-level extension of `hover-intent`'s grace area; Escape per
  level, Tab closing the tree; modal by default with the trigger kept out of the inert set.
- `@rind-ui/react`: `Menu.Root`, `Trigger`, `Positioner`, `Content`, `Arrow`, `Item`,
  `CheckboxItem`, `RadioGroup`, `RadioItem`, `ItemIndicator`, `ItemText`, `Group`,
  `GroupLabel`, `Separator`, `Submenu`, `SubmenuTrigger`, with the generic `Portal`.
- `@rind-ui/testing`: `getMenu` driver and model-based coverage.
- Theme stylesheet (tier-3 `--rind-menu-*` tokens), stories, docs page.

## Capabilities

### New Capabilities

- `menu`: the Menu component — parts, ARIA and `data-*` attributes, opening and focus by
  modality, keyboard, items (plain, link, checkbox, radio, groups, separators), submenus
  and their pointer intent, closing rules, modality, nesting with dialogs, contract and
  driver.

### Modified Capabilities

None. The capabilities this builds on are introduced by unarchived changes; this change
uses them. Two additive needs on them are recorded in design.md Risks (raised with their
owners, not edited here).

## Non-goals

- **Menubar** (a separate Wave 2 change). Menu is designed for it: the `MenuTree` parent
  kind `menubar`, per-level services and the open-path rule are what Menubar plugs into.
- Context Menu (`add-context-menu`, which reuses this machine).
- Opening the root menu on hover (`openOnHover`), drag-to-select (press on the trigger,
  release on an item), filterable/searchable menus (Command / Autocomplete), inline or
  drill-down submenus, `indeterminate` checkbox items, controlled submenu open state,
  multiple triggers sharing one menu.
- Re-specifying overlay, positioning, collection, typeahead or hover-intent rules.
- Native `popover`, `interestfor`, `focusgroup` (native-platform.md).
- Framework adapters other than React; fx.

## Impact

- New code: `packages/core/src/components/menu/{menu.machine,menu.connect,menu.contract,menu.messages,menu-tree,menu-radio-group.machine}.ts`,
  quirk entry in `core/dom/quirks.ts`, `packages/react/src/menu/*`, driver export in
  `@rind-ui/testing`, `packages/theme/src/menu.css`, stories, generated docs page.
- Public API: `menu` machine/connect/contract, `Menu` parts, `getMenu`.
- No new runtime dependency.
