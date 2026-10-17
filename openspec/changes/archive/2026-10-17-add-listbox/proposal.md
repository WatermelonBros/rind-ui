## Why

Select's popup is a listbox, and so are Combobox's, Autocomplete's and Command's. The
list, option, section and selection behaviour must be written once, as the standalone
Listbox, before Select (wave 1, used by Reado) can reuse it. The bug history repeats the
same listbox failures in every library: `aria-selected` used as the highlight, non-option
content inside `role=listbox`, activedescendant lists that VoiceOver does not read, Shift
ranges lost under a controlled value, Escape clearing the selection. Reado's hand-rolled
`SemanticModal` result list makes three of them.

Research: [listbox](../../../docs/research/listbox.md) (sources, Bug history,
Accessibility, Decisions) · [collections](../../../docs/research/collections.md) ·
[select](../../../docs/research/select.md) (the first reuser) ·
[accessibility](../../../docs/research/accessibility.md) ·
[assistive-tech-and-a11y-testing](../../../docs/research/assistive-tech-and-a11y-testing.md) ·
[native-platform](../../../docs/research/native-platform.md)

**Depends on** `add-foundations` (runtime, `controllable`, contracts, drivers,
`testMachine`, React adapter), `add-a11y-foundations` (press, modality, keyboard
normalisation, platform modifier, IME guard, messages, invariants) and `add-collections`
(collection model, selection model, navigation, typeahead, roving composite, async and
virtualization contract, collection contract fragment, `selectable` and `set-metadata`
traits). `add-select` depends on this change.

## What Changes

- `@rind-ui/core`: the `listbox` machine, connect and contract, and the **listbox
  parts** — the connect helpers and keyboard map for `list`, `item`, `item-text`,
  `item-description`, `item-indicator`, `section`, `section-label`, `separator`, `empty`
  and `load-more` — exported so Select (and later Combobox, Autocomplete, Command) reuse
  them instead of re-specifying options.
- Behaviour: roving focus; single, multiple and no selection; `toggle` and `replace`
  selection behaviours (selection follows focus in single `replace`); Shift ranges,
  Shift+Space, mod+A select all; `onAction` for action lists; horizontal orientation
  with RTL; typeahead; disabled items; an empty state outside the list; async status
  and load more; virtualization through the collections contract.
- `@rind-ui/react`: `Listbox.Root`, `Label`, `List`, `Item`, `ItemText`,
  `ItemDescription`, `ItemIndicator`, `Section`, `SectionLabel`, `Separator`, `Empty`,
  `LoadMore`.
- `@rind-ui/testing`: `getListbox` driver and model-based coverage.
- Theme stylesheet (tier-3 `--rind-listbox-*` tokens), stories, docs page.

## Capabilities

### New Capabilities

- `listbox`: the Listbox component and its reusable listbox parts — anatomy, ARIA and
  `data-*` attributes, keyboard and pointer selection per mode and behaviour, actions,
  empty and loading states, contract and driver.

### Modified Capabilities

None. The capabilities used are introduced by unarchived changes and are used as they
are.

## Non-goals

- Re-specifying keys, navigation, selection rules, typeahead, repair, virtualization or
  set metadata (`add-collections`).
- The active-descendant strategy and a filter input inside the list (Combobox,
  Autocomplete, Command own text-field focus).
- Grid layout / two-dimensional navigation (Grid List), drag and drop, reordering.
- Form participation (`name`) for a standalone listbox; Select owns form participation.
  Added when a consumer needs a form-associated inline list.
- A virtualizer (consumers bring one; the collections recipe covers TanStack Virtual).
- Escape clearing the selection (React Aria's default).
- Framework adapters other than React; fx.

## Impact

- New code: `packages/core/src/components/listbox/{listbox.machine,listbox.connect,listbox.parts,listbox.contract,listbox.messages}.ts`,
  `packages/react/src/listbox/*`, driver export in `@rind-ui/testing`,
  `packages/theme/src/listbox.css`, stories, generated docs page.
- Public API: `listbox` machine/connect/contract, the listbox-parts helpers, `Listbox`
  parts, `getListbox`.
- No new runtime dependency.
