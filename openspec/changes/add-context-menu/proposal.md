## Why

Reado has eight hand-rolled context menus (file tree, tabs, editor, terminal panes,
search, problems, activity bar, git panel) plus a document-wide Cut/Copy/Paste menu, and
none of them works by long press on iOS or from the keyboard. Every library that ships a
context menu got the same things wrong: no iOS long press, nested regions opening every
menu above the finger, a second right click showing the native menu or re-opening at the
old point, the opening gesture activating an item. Menu is specified in `add-menu`; this
change specifies only how a context menu opens, where it is anchored and what its region
exposes.

Research: [context-menu](../../../docs/research/context-menu.md) (sources, Bug history,
Accessibility, Decisions) · [menu](../../../docs/research/menu.md) ·
[floating-positioning](../../../docs/research/floating-positioning.md) ·
[accessibility](../../../docs/research/accessibility.md) ·
[assistive-tech-and-a11y-testing](../../../docs/research/assistive-tech-and-a11y-testing.md) ·
[native-platform](../../../docs/research/native-platform.md)

**Depends on** `add-menu` (machine, parts, contract, `MenuTree`; this change adds the
`context-menu` parent kind's root), and through it on `add-foundations`,
`add-a11y-foundations` (press with long press, `CONTEXT_MENU` logical key, macOS
Control+click rule), `add-overlay-infrastructure` and `add-floating-positioning`
(`pointer` preset, point anchors). Apply after `add-menu`.

## What Changes

- `@rind-ui/core`: a `context-menu` root for the `menu` machine — opening events from
  the native `contextmenu` event, the `CONTEXT_MENU` key and an emulated touch/pen long
  press; a point anchor; re-anchoring while open; open details with point, target and
  event; innermost-region rule.
- `@rind-ui/react`: `ContextMenu.Root` and `ContextMenu.Trigger` (the region); every
  other part is `Menu`'s, used inside `ContextMenu.Root`.
- `@rind-ui/testing`: `getContextMenu` driver (Menu's actions plus `openAt`,
  `openWithKeyboard`, `longPress`).
- Theme stylesheet (tier-3 `--rind-context-menu-*` tokens over the menu tokens),
  stories, docs page.

## Capabilities

### New Capabilities

- `context-menu`: the Context Menu — the region part, how it opens (pointer, keyboard,
  touch, assistive technology), its point anchor, behaviour while open and on close,
  naming, data attributes, contract and driver.

### Modified Capabilities

None (`menu` is introduced by the unarchived `add-menu`; this change uses it).

## Non-goals

- Anything inside the open menu (items, submenus, keys, closing rules): `add-menu`.
- Press-hold-release selection (macOS right button held and released over an item).
- macOS Control+Enter keyboard workaround (React Aria's WebKit 302049 workaround).
- Several regions sharing one menu instance (Zag's `value`); detached regions outside
  the root.
- Menubar; framework adapters other than React; fx.

## Impact

- New code: `packages/core/src/components/context-menu/{context-menu.root,context-menu.connect,context-menu.contract,context-menu.messages}.ts`,
  `packages/react/src/context-menu/*`, driver export, `packages/theme/src/context-menu.css`,
  stories, generated docs page.
- Public API: `ContextMenu.Root`, `ContextMenu.Trigger`, `getContextMenu`.
- No new runtime dependency.
