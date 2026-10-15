## Why

Roughly twenty components (Listbox, Select, Combobox, Autocomplete, Command, Menu,
Context Menu, Menubar, Tabs, Toolbar, Radio / Toggle Group, Segmented Control, Tree
View, Tag Group, Tags Input, Grid List, Table, Navigation Menu) show a set
of items and let the user move through them and pick some. Every library we studied
re-implements navigation, selection and typeahead more than once, and the bug history
shows the same failures everywhere: highlight stored as an index, order taken from the
DOM, unbounded "next enabled" walks, focus lost when the focused item is removed,
typeahead rules that regress, posinset larger than setsize. Wave 1 (Select, Menu,
Segmented Control, Tabs) needs this layer, so it is specified once, before them.

Research: [collections](../../../docs/research/collections.md) ·
[machine-runtime](../../../docs/research/machine-runtime.md) (open question 6) ·
[accessibility](../../../docs/research/accessibility.md) §4, §6, §9 ·
[assistive-tech-and-a11y-testing](../../../docs/research/assistive-tech-and-a11y-testing.md) ·
[native-platform](../../../docs/research/native-platform.md) §7, §9

## What Changes

- `core/collection`: one immutable, key-based **collection model** for lists, sections
  and trees, built from data or from statically authored item parts, with O(1) lookup
  and navigation, filtering, derivations and dev-time key validation.
- A **selection model**: none / single / multiple, toggle or replace behaviour, Shift
  ranges from an internal anchor, select all, disabled-item rules, selection that
  survives filtering and async loading.
- **Collection navigation**: logical moves (next, previous, first, last, page, tree
  expand / collapse), loop, disabled policy, highlight repair when the collection
  changes, one composite module emitting roving-tabindex or `aria-activedescendant`
  props, scroll-into-view on navigation only, pointer highlight guards, Apple
  announcements for active-descendant composites.
- **Typeahead**: one locale-aware, IME-safe, clock-based typeahead shared by every
  collection component.
- Async loading status, the **virtualization contract** (scroll-to-index callback,
  persisted keys, set metadata) and filtering helpers. No virtualizer and no data
  fetching are shipped.
- **Collection testing**: a contract fragment (driver actions and queries) reused by
  every collection component, new `selectable` and `set-metadata` traits and their
  invariants, and a `listbox` reference fixture (not public) proving both focus
  strategies end to end.
- Resolves machine-runtime open question 6: collections live in props, never in the
  snapshot; the snapshot holds keys only.

## Capabilities

### New Capabilities

- `collection-model`: keys, items, sections, trees, static vs data sources, text values,
  derivations and filtering, async status, the virtualization contract, item ids.
- `selection-model`: selection modes and behaviours, ranges, select all, disabled rules,
  controlled selection, persistence across collection changes, ARIA selection state.
- `collection-navigation`: highlight and focus, roving vs active-descendant, keyboard
  moves, disabled policy, repair on change, scrolling, pointer interplay, tab stop,
  Apple announcements, `data-*` attributes of collection parts.
- `typeahead`: matching, timing, cycling, Space, modifiers and IME, lifecycle.
- `collection-testing`: the collection contract fragment, traits and invariants, the
  reference fixture.

### Modified Capabilities

None. `add-foundations` is not archived yet; this change adds capabilities alongside it.

## Non-goals

- Any public component (Listbox, Select, Menu… each get their own change and research
  note).
- A virtualizer, a data-fetching or async-list machine (Zag `async-list`), sorting.
- Two-dimensional grid navigation (Grid List, Calendar, Table) — deferred to the first
  of those components; the `NAVIGATE` event leaves room for it.
- Drag-and-drop reordering, submenus and menu-specific item types (checkbox / radio
  items), Combobox input behaviour.
- A JSX "hidden document" collection builder (React Aria Components).
- Native `focusgroup` or customizable `<select>`.

## Impact

- New code in `packages/core/src/collection/` (model, selection, navigation, composite,
  typeahead, filter), one new environment capability interface (`Clock`, plus a layout
  capability for page moves) in `packages/core/src/env/`, an item-registration helper in
  `packages/core/src/dom/` and `packages/react`, contract fragment and invariants in
  `packages/core/src/contract/` and `packages/testing`.
- Depends on `add-foundations` (runtime, controllables, `onProps`, environment,
  contracts, drivers, model-based testing). Uses key normalisation, interaction
  modality, locale, the typeahead timeout, the IME guard and the announcer from
  `add-a11y-foundations`, which is implemented first.
- No new runtime dependency.
