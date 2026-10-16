## 0. Prerequisites

- [x] 0.1 Confirm `add-foundations`, `add-a11y-foundations` and `add-collections` are applied (the collections `listbox` fixture exists)

## 1. Machine (`core/components/listbox`)

- [x] 1.1 `listbox.machine.ts`: event union (collection events + `FOCUS`/`BLUR`/`ACTION`), controllable `value` with set equality and the public shape mapping (`string | null`, `string[] | "all"`), `bindProp` mode/behaviour/orientation, props with defaults (design §1)
- [x] 1.2 Listbox pieces: `followsFocus` guard (replace + no mod), `canAct` guard, `act` action, `highlightInitial` (last highlighted → first selected → first navigable)
- [x] 1.3 `node` tests for every transition and every keyboard/pointer scenario of the spec that needs no DOM (toggle, replace, ranges with a controlled value, select all, none + action, disabled)

## 2. Listbox parts and connect

- [x] 2.1 `listbox.parts.ts`: `listProps`, `itemProps`, `itemTextProps`, `itemDescriptionProps`, `itemIndicatorProps`, `sectionProps`, `sectionLabelProps`, `separatorProps`, `emptyProps`, `loadMoreProps`, `listboxKeymap`, parametrised by scope (design §2)
- [x] 2.2 `listbox.connect.ts` on top of the parts; root-level `data-disabled`; list naming and `aria-describedby` merge for `empty`
- [x] 2.3 Unit tests for every attribute in the spec, under `listbox` and a second scope

## 3. React parts (`packages/react/src/listbox`)

- [x] 3.1 `createListboxParts(useView)`; `Listbox.Root`, `Label`, `List`, `Item`, `ItemText`, `ItemDescription`, `ItemIndicator`, `Section`, `SectionLabel`, `Separator`, `Empty`, `LoadMore`; `render` on each
- [x] 3.2 Dev warnings: unnamed list, interactive element inside an item, `Empty` inside `List`
- [x] 3.3 React tests: Strict Mode, SSR + hydrate (tab stop on the selected item), static vs data items

## 4. Contract and driver

- [x] 4.1 `listbox.contract.ts` per design §6
- [x] 4.2 `getListbox` in `@rind-ui/testing`; driver tests in `browser` and `jsdom` and through Playwright against Storybook (jsdom + browser in three engines; Playwright fixture `fixtures/listbox-component` against a bundled page: Storybook retired)

## 5. Tests

- [x] 5.1 One browser test per spec scenario; regression scenarios reproduce the cited issue first (headlessui#1599, radix#1907, zag#2947, react-spectrum#7947, #10147, mui/base-ui#5443, #5569, webkit 209279 and every issue cited in the spec) (scenario tests in jsdom and three engines, plus the Playwright fixture)
- [x] 5.2 `testMachine`: props classes single/multiple × toggle/replace, none + action, horizontal RTL; argument classes from collections; all modalities incl. `virtual`; axe per state
- [x] 5.3 Virtualized story test: End to item 10,000, typeahead to an unmounted item, `aria-setsize`/`posinset` after filter (packages/testing/src/components/listbox-virtual.dom.test.tsx: a 10,000-item collection rendered as a window)
- [ ] 5.4 Virtual screen reader reading-order test (name, options, description, selection state, empty description) (follow-up: not done; docs/review-backlog.md)

## 6. Theme (`packages/theme/src/listbox.css`)

- [x] 6.1 Tier-3 tokens `--rind-listbox-*` (design §7) defaulting to semantic tokens; item states via `data-highlighted` / `data-selected` / `data-disabled` / `data-focus-visible`, indicator, section label, separator, empty; target size ≥ 24px
- [ ] 6.2 Forced colors: highlight as outline, selected with `SelectedItem`/`Highlight` plus indicator, focus ring as outline; Playwright forced-colors captures (follow-up: the checks read the stylesheet, no Playwright captures yet; docs/review-backlog.md)

## 7. Stories (`apps/storybook`)

- [ ] 7.1 Single, multiple (toggle and replace), action list (Reado SemanticModal), sections, descriptions and icons, disabled items, horizontal + RTL, empty, async load more, virtualized (TanStack Virtual as a story dev dependency) (follow-up: site examples done except the virtualized one; docs/review-backlog.md)
- [x] 7.2 Driver story (docs testing example); all stories pass axe (driver example in the docs page; site examples pass the site audit)

## 8. Docs and closing

- [x] 8.1 Docs page (generated API facts + guide: modes and behaviours, actions, descriptions, empty/loading, virtualization recipe, reusing listbox parts, testing with `getListbox`/`testMachine`, Reado SemanticModal migration)
- [ ] 8.2 Manual pass: VO macOS + iOS (description via `aria-hidden` + `aria-describedby`), NVDA + Firefox, TalkBack; record in "Tested with" (follow-up: manual AT pass not done; docs/review-backlog.md "Manual AT protocol")
- [x] 8.3 Set Listbox to `wip`/`done` in `docs/components.md` as it progresses; archive the change when approved
- [x] 8.4 `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green; changeset for core, react, testing, theme

## Amendments (from add-separator)

- [x] A.1 Listbox `separatorProps` part delegates to add-separator's `separatorProps({ context: "listbox", scope })`: `role="none"`, `data-orientation` kept, no `aria-orientation`; axe `aria-required-children` test with a separator between sections (mui/base-ui#5398, ariakit#3315)
