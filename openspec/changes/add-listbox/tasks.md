## 0. Prerequisites

- [ ] 0.1 Confirm `add-foundations`, `add-a11y-foundations` and `add-collections` are applied (the collections `listbox` fixture exists)

## 1. Machine (`core/components/listbox`)

- [ ] 1.1 `listbox.machine.ts`: event union (collection events + `FOCUS`/`BLUR`/`ACTION`), controllable `value` with set equality and the public shape mapping (`string | null`, `string[] | "all"`), `bindProp` mode/behaviour/orientation, props with defaults (design §1)
- [ ] 1.2 Listbox pieces: `followsFocus` guard (replace + no mod), `canAct` guard, `act` action, `highlightInitial` (last highlighted → first selected → first navigable)
- [ ] 1.3 `node` tests for every transition and every keyboard/pointer scenario of the spec that needs no DOM (toggle, replace, ranges with a controlled value, select all, none + action, disabled)

## 2. Listbox parts and connect

- [ ] 2.1 `listbox.parts.ts`: `listProps`, `itemProps`, `itemTextProps`, `itemDescriptionProps`, `itemIndicatorProps`, `sectionProps`, `sectionLabelProps`, `separatorProps`, `emptyProps`, `loadMoreProps`, `listboxKeymap`, parametrised by scope (design §2)
- [ ] 2.2 `listbox.connect.ts` on top of the parts; root-level `data-disabled`; list naming and `aria-describedby` merge for `empty`
- [ ] 2.3 Unit tests for every attribute in the spec, under `listbox` and a second scope

## 3. React parts (`packages/react/src/listbox`)

- [ ] 3.1 `createListboxParts(useView)`; `Listbox.Root`, `Label`, `List`, `Item`, `ItemText`, `ItemDescription`, `ItemIndicator`, `Section`, `SectionLabel`, `Separator`, `Empty`, `LoadMore`; `render` on each
- [ ] 3.2 Dev warnings: unnamed list, interactive element inside an item, `Empty` inside `List`
- [ ] 3.3 React tests: Strict Mode, SSR + hydrate (tab stop on the selected item), static vs data items

## 4. Contract and driver

- [ ] 4.1 `listbox.contract.ts` per design §6
- [ ] 4.2 `getListbox` in `@rind-ui/testing`; driver tests in `browser` and `jsdom` and through Playwright against the site examples harness

## 5. Tests

- [ ] 5.1 One browser test per spec scenario; regression scenarios reproduce the cited issue first (headlessui#1599, radix#1907, zag#2947, react-spectrum#7947, #10147, mui/base-ui#5443, #5569, webkit 209279 and every issue cited in the spec)
- [ ] 5.2 `testMachine`: props classes single/multiple × toggle/replace, none + action, horizontal RTL; argument classes from collections; all modalities incl. `virtual`; axe per state
- [ ] 5.3 Virtualized example test: End to item 10,000, typeahead to an unmounted item, `aria-setsize`/`posinset` after filter
- [ ] 5.4 Virtual screen reader reading-order test (name, options, description, selection state, empty description)

## 6. Theme (`packages/theme/src/listbox.css`)

- [ ] 6.1 Tier-3 tokens `--rind-listbox-*` (design §7) defaulting to semantic tokens; item states via `data-highlighted` / `data-selected` / `data-disabled` / `data-focus-visible`, indicator, section label, separator, empty; target size ≥ 24px
- [ ] 6.2 Forced colors: highlight as outline, selected with `SelectedItem`/`Highlight` plus indicator, focus ring as outline; Playwright forced-colors captures

## 7. Site examples

- [ ] 7.1 Site examples (apps/site/examples/listbox.tsx, state examples for every contract state): Single, multiple (toggle and replace), action list (Reado SemanticModal), sections, descriptions and icons, disabled items, horizontal + RTL, empty, async load more, virtualized (TanStack Virtual as a example dev dependency)
- [ ] 7.2 Driver example (docs testing example); all examples pass axe

## 8. Docs and closing

- [ ] 8.1 Docs page (generated API facts + guide: modes and behaviours, actions, descriptions, empty/loading, virtualization recipe, reusing listbox parts, testing with `getListbox`/`testMachine`, Reado SemanticModal migration)
- [ ] 8.2 Manual pass: VO macOS + iOS (description via `aria-hidden` + `aria-describedby`), NVDA + Firefox, TalkBack; record in "Tested with"
- [ ] 8.3 Set Listbox to `wip`/`done` in `docs/components.md` as it progresses; archive the change when approved
- [ ] 8.4 `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green; changeset for core, react, testing, theme

## Amendments (from add-separator)

- [ ] A.1 Listbox `separatorProps` part delegates to add-separator's `separatorProps({ context: "listbox", scope })`: `role="none"`, `data-orientation` kept, no `aria-orientation`; axe `aria-required-children` test with a separator between sections (mui/base-ui#5398, ariakit#3315)
