## Why

Lists whose rows contain controls — a selection checkbox, buttons, links, a menu trigger —
cannot be Listbox (`option` children are presentational and may not hold controls), and
"a column of cards" needs the same. React Aria's GridList is the only implementation; its
bug history is the evidence for what goes wrong: Space eaten in inputs, keys captured from
nested controls, selection fighting row actions, rows that read all their controls,
`display: contents` breaking Tab, virtualization that needs the whole collection.
`add-collections` explicitly deferred grid navigation to "the first of Grid List, Calendar,
Table"; this change specifies it, as far as Grid List needs it.

Research: [grid-list](../../../docs/research/grid-list.md) (sources, Bug history, Accessibility,
Decisions) · [collections](../../../docs/research/collections.md) ·
[tag-group](../../../docs/research/tag-group.md) (layout-grid precedent) ·
[tree-view](../../../docs/research/tree-view.md) ·
[assistive-tech-and-a11y-testing](../../../docs/research/assistive-tech-and-a11y-testing.md)
("Tree / grid / table": WebKit grid bugs, RA#7734 — tested on real VoiceOver from the first
prototype) · [accessibility](../../../docs/research/accessibility.md)

**Depends on** `add-foundations`, `add-a11y-foundations` (archived), `add-collections`,
`add-listbox` (selection conventions, `load-more`), `add-tag-group` (grid-with-one-cell
precedent), `add-link`, `add-checkbox` (control semantics only) and `add-theme-system`.

## What Changes

- New capability `collection-grid` (owned here): the **row/child focus model** (rows, then
  the controls of the highlighted row; `arrow` and `tab` navigation behaviours), **spatial
  navigation** for wrapped grid layouts, and **event ownership per target**. It extends
  `collection-navigation` without modifying it. Full multi-cell 2D navigation stays with
  Table and Calendar (Why Grid List does not need it: one cell per row).
- `@rind-ui/core`: `grid-list` machine, connect, contract; selection announcements behind a
  quirk entry.
- `@rind-ui/react`: `GridList.Root`, `Label`, `List`, `Item`, `ItemText`, `ItemDescription`,
  `ItemCheckbox`, `ItemControl`, `Empty`, `LoadMore`.
- `@rind-ui/testing`: `getGridList` driver, the `row-children` trait.
- Theme stylesheet (tier-3 `--rind-grid-list-*`), stories, docs page.

## Capabilities

### New Capabilities

- `grid-list`: the Grid List component — anatomy, `grid`/`row`/`gridcell` ARIA, selection
  versus action rules, checkboxes, controls, actions and links, empty and loading states,
  announcements, attributes, contract and driver.
- `collection-grid`: row/child focus, tab and arrow child navigation, spatial layout
  navigation and key ownership, reusable by later grid components.

### Modified Capabilities

- `a11y-quirks` (archived): adds the `webkit-grid-selection-not-announced` entry (delta spec in this change).

## Non-goals

- Re-specifying keys, navigation, selection rules, typeahead, repair, virtualization
  (`add-collections`) or listbox parts (`add-listbox`).
- Column-aware 2D cell navigation, headers, sorting, resizing (Table).
- Drag and drop, sections (`rowgroup`), nested grids, inline edit mode beyond "an editable
  control owns its keys; Escape returns to the row".
- A virtualizer; Escape clearing the selection; a hidden-document collection builder.
- Select popups with interactive options (use Popover + Grid List).
- Framework adapters other than React; fx.

## Impact

- New code: `packages/core/src/collection/grid.ts` (+ `core/env/grid-layout.ts`,
  `core/dom/grid-layout.ts`), `packages/core/src/components/grid-list/*`,
  `packages/react/src/grid-list/*`, `packages/testing` driver and `row-children` trait,
  `packages/theme/src/grid-list.css`, stories, generated docs.
- Public API: `grid-list` machine/connect/contract, `GridList` parts, `getGridList`.
- No new runtime dependency. Reado has no Grid List today; the migration note covers
  future lists with row actions.
