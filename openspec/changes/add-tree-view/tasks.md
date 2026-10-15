## 0. Prerequisites and prototype

- [ ] 0.1 Confirm `add-foundations`, `add-a11y-foundations` (archived), `add-collections`, `add-listbox`, `add-link` and `add-theme-system` are applied
- [ ] 0.2 Real-AT prototype of flat versus nested (`group`) DOM (VoiceOver macOS/iOS with Safari and Chrome, NVDA + Firefox/Chrome, JAWS, TalkBack): expand/collapse announcement, level/position, busy; record in docs/research/tree-view.md and the support matrix; freeze the DOM shape before 1.x

## 1. Machine (`core/components/tree-view`)

- [ ] 1.1 `tree-view.machine.ts`: events (design §1), controllables `value`/`expandedValue`/`checkedValue` with set equality, bound props, context (`loading`, `failed`)
- [ ] 1.2 Use the collections visible-collection rule (Tab stop, `highlightInitial`, repair; owned by add-collections) over `collection.visible(expandedValue)`; `activate`, `expandSiblings`, `expandAll`/`collapseAll`
- [ ] 1.3 `check.ts` (pure): derived tri-state, toggle, unloaded-branch-as-leaf, disabled handling; node tests incl. both orders of reka-ui#1458
- [ ] 1.4 Lazy loading effect: once per branch, abort on collapse/unmount, promise or collection-arrival settle, retry after error
- [ ] 1.5 `node` tests for every spec scenario that needs no DOM

## 2. Connect and messages

- [ ] 2.1 `tree-view.connect.ts`: roles, set metadata, `aria-expanded` iff branch, selection vs check attributes, keymap (target guard, exact modifiers, RTL, consumer-first), link items, `--rind-tree-view-level`, `data-*` per spec
- [ ] 2.2 `tree-view.messages.ts` (loading/loaded/failed/empty) and announcements
- [ ] 2.3 Unit tests for every attribute (leaf/branch/lazy/checkable/link/disabled/empty)

## 3. React parts (`packages/react/src/tree-view`)

- [ ] 3.1 Root, Label, Tree (render function with node state), Item, ItemIndicator, ItemCheckbox, ItemText, Loading, Empty; `render` on each
- [ ] 3.2 Dev warnings: unnamed tree, focusable descendant of an item, `checkable` with selection mode
- [ ] 3.3 React tests: Strict Mode, SSR + hydration tab stop (selected under collapsed parent), controlled expansion without remount (react-spectrum#8263)

## 4. Contract and driver

- [ ] 4.1 `tree-view.contract.ts` per design §4, with the own per-item `aria-expanded` invariant (branches only, mirrors expansion) instead of the `disclosure` trait
- [ ] 4.2 `getTreeView` in `@rind-ui/testing` (name-path addressing); driver tests in browser, jsdom and Playwright against Storybook

## 5. Tests

- [ ] 5.1 One browser test per scenario; issue-citing ones reproduce the issue first (react-spectrum#9918, #9546, #8111, #10659, #10660, #10645, #7552, #8263, #9991, #1525, #10720; zag#1751, #1874, #2028, #2760, #1787, #1627, #2582; reka-ui#1458; headless-tree#171; react-arborist#233, #303, #325)
- [ ] 5.2 `testMachine` over the props classes, all modalities incl. `virtual`, RTL, axe per state
- [ ] 5.3 Virtualized fixture: End at 10,000 nodes, expand/collapse keeps ids, two-item re-render on a highlight move, 70k-node build benchmark
- [ ] 5.4 Virtual screen-reader reading-order test (tree name, level/position, expanded, checked)

## 6. Theme (`packages/theme/src/tree-view.css`)

- [ ] 6.1 Tier-3 `--rind-tree-view-*` tokens (design §5), `@layer rind.components`, `:where()` selectors, family `collection item`, `data-size`, `data-tone="danger"`; indentation from `--rind-tree-view-level`; indicator rotation/RTL mirror; ≥ 24px rows and hit areas; no flex on the tree; `fit-content` rows
- [ ] 6.2 Forced colors: selection and focus cues; Playwright forced-colors captures

## 7. Stories (`apps/storybook`)

- [ ] 7.1 File explorer (lazy), single/multiple selection, checkbox tree with tri-state, links (navigation), disabled, empty, RTL, virtualized with TanStack Virtual, inline-input item; all render with the theme and pass axe

## 8. Docs and closing

- [ ] 8.1 Docs page (generated API facts + guide: Tree vs Grid List vs Table, why no controls inside items, lazy loading recipe, checked values are leaves, Reado migration notes)
- [ ] 8.2 Manual tier-1 pass on real AT; record in "Tested with"
- [ ] 8.3 Set Tree View to `wip`/`done` in `docs/components.md`; archive when approved
- [ ] 8.4 `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green; changeset
