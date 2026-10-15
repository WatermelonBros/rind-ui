## 1. Collection model (`core/collection`, node tests)

- [ ] 1.1 `key.ts`: `CollectionKey` brand, `toKey`, id encoding for keys with spaces and special characters; type tests (plain string rejected inside core, accepted by component props)
- [ ] 1.2 `list.ts`: `createListCollection` with sections, item-only indexes, O(1) `get`/`has`/`keyAfter`/`keyBefore`/`at`, dev error and production skip for duplicate keys
- [ ] 1.3 Derivations `filter`/`insert`/`remove`/`move` returning renumbered collections; empty sections dropped
- [ ] 1.4 `filter.ts`: `createFilter(locale)` (`startsWith`, `contains`) with a cached search collator
- [ ] 1.5 `tree.ts`: `createTreeCollection`, parent/children/level/sibling position, `visible(expandedKeys)`, `hasChildren` for unloaded nodes
- [ ] 1.6 Node tests for every scenario of `specs/collection-model/spec.md` that needs no DOM, plus a 10,000-item benchmark asserting constant-time moves

## 2. Selection model (node tests)

- [ ] 2.1 `selection.ts`: modes, `toggle`/`replace` behaviours, `disallowEmpty`, `disabledBehavior`, touch/virtual toggle rule
- [ ] 2.2 Anchor record (`key` + previous range end) for replacing ranges; `"all"` sentinel with `isSelected` and materialisation for `onValueChange`
- [ ] 2.3 Key → text map for selected keys missing from the collection
- [ ] 2.4 Node tests for every scenario of `specs/selection-model/spec.md`

## 3. Navigation and typeahead (node tests)

- [ ] 3.1 `navigation.ts`: bounded walker, next/previous/first/last/page with `loop` and `focusableWhenDisabled`, tree expand/collapse moves, `repair(prev, next, key)`
- [ ] 3.2 `typeahead.ts`: pure step with clock-based timeout, cycling, growing queries, Space continuation, no-match reset, composing/modifier rejection
- [ ] 3.3 `Clock` and `CollectionLayout` capability interfaces in `core/env`; fake implementations for tests
- [ ] 3.4 Node tests for every navigation and typeahead scenario that needs no DOM (all-disabled, run of disabled items, delete next to disabled items, RTL mapping input, repeated letters, "Bob A/Bob B")

## 4. Machine pieces and connect helpers

- [ ] 4.1 `machine.ts`: `CollectionEvent` union, context fields, `collectionActions`/`collectionGuards`/`collectionEffects` per design §5; `repairCollection` with `lastCollection` pointer; `onLoadMore` dedupe
- [ ] 4.2 `composite.ts`: list/item/container props for `roving` and `active-descendant` (tabIndex, `aria-activedescendant`, ids, `aria-selected`/`aria-checked`, `aria-disabled`, `aria-multiselectable`, `aria-posinset`/`aria-setsize`, `aria-level`/`aria-expanded`, `aria-busy`) and every `data-*` attribute in `specs/collection-model/spec.md`
- [ ] 4.3 Server-render tab-stop fallback (selected key, else container) and section `group`/label/separator props
- [ ] 4.4 Apple-only `announceHighlighted` through the announcer with `messages`; scroll action honouring sources and `scrollToIndex`
- [ ] 4.5 Wire key normalisation, modality and locale from `add-a11y-foundations` (it lands before this change: order is add-foundations → add-a11y-foundations → add-overlay-infrastructure → add-collections)

## 5. DOM and React support

- [ ] 5.1 `core/dom/item-registry.ts`: commit-time registration, one flush per commit, document-order sort with adjacent-sibling fast path
- [ ] 5.2 `core/dom/collection-layout.ts`: measured page targets; null when rects are zero
- [ ] 5.3 `core/dom/pointer-guard.ts`: zero-delta move filtering shared by all items
- [ ] 5.4 `packages/react/src/use-collection-items.ts`: static parts → collection via `setProps`; per-key item selectors
- [ ] 5.5 Dev warnings: missing text value on non-text items; collection identity changing on every commit with equal keys

## 6. Contract and testing

- [ ] 6.1 `core/contract/collection.ts`: contract fragment (anatomy, actions with pointer and keyboard implementations, queries) per `specs/collection-testing/spec.md`
- [ ] 6.2 `selectable` and `set-metadata` traits and the highlight-uniqueness / focus-after-removal checks in `@rind-ui/testing`
- [ ] 6.3 Argument-class configurations (empty, single, all disabled, disabled neighbour, section boundary, ends, selected disabled) through the runner's `props` option

## 7. Reference fixture (`packages/testing/fixtures/listbox`)

- [ ] 7.1 Machine (design §11), connect, contract (traits `composite-roving` or `composite-activedescendant`, `selectable`, `set-metadata`, `directional`), React parts
- [ ] 7.2 Stories in `apps/storybook` (Internal): roving, active-descendant, sections, disabled items, multiple selection, async load-more, virtualized with TanStack Virtual as a dev dependency of the story only; every story passes axe
- [ ] 7.3 Driver tests passing unchanged in the `browser` and `jsdom` projects and through the Playwright adapter, both strategies
- [ ] 7.4 Browser tests for DOM-dependent scenarios: page moves, scroll-on-navigation only, zero-delta pointer guard, roving focus repair, 1,000 parts registering in one change, two-item re-render on a highlight move, SSR + hydration tab stop
- [ ] 7.5 `testMachine` over the fixture: all transitions × modalities × directions × argument classes; a broken variant (highlight reset to first on change, `aria-selected` on highlight) fails with readable reports
- [ ] 7.6 Typeahead and navigation tests run against the built, minified `@rind-ui/core` output

## 8. Docs

- [ ] 8.1 Generated API docs page for `core/collection` (collections, selection, navigation, typeahead, virtualization contract) with a `useMemo` recipe and a TanStack Virtual `rangeExtractor` recipe using `persistedKeys`
- [ ] 8.2 Update `docs/research/machine-runtime.md` open question 6 with a link to this decision; mark the collection row of components.md's utilities as specified
- [ ] 8.3 `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` all green

## Amendments (from add-select)

- [ ] A.1 Scroll alignment per reason (`open` → centre, navigation → nearest) passed to `scrollToIndex` as `align`; tests
- [ ] A.2 From add-combobox: `typing` highlight source; Apple highlight announcements only for `keyboard` highlights, with section option count on section entry; posinset/setsize for filtered (non-virtualized) views; tests

## Amendments (from add-command)

- [ ] A.3 Item `keywords` (`readonly string[]`, default `[]`): `getKeywords` accessor for data items, `keywords` prop on static item parts (registered with the item), `contains` / `startsWith` match the text value or any keyword; never used by typeahead or announcements; node tests for "Filter matches a keyword" (dip/cmdk#146) and "Keywords are not typeahead"

## Amendments (from add-tree-view)

- [ ] A.4 Tab stop, "first selected" and the repair walk run over the visible collection (nodes not hidden by a collapsed ancestor), falling back to the nearest visible ancestor; node tests for "Selected node under a collapsed parent" and "Ancestor collapses under the highlight"

## Amendments (from add-grid-list)

- [ ] A.5 `composite-roving` "exactly one tab stop" check ignores elements with `data-part="item-control"`; test for "Controls inside a row". Informational: `Move` stays closed, spatial moves use `NAVIGATE_SPATIAL` (`collection-grid`); no code change
