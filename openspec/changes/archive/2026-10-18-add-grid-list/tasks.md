## 0. Prerequisites and prototype

- [x] 0.1 Confirm `add-foundations`, `add-a11y-foundations` (archived), `add-collections`, `add-listbox`, `add-tag-group`, `add-link`, `add-checkbox` and `add-theme-system` are applied
- [x] 0.2 Real-AT prototype (VoiceOver macOS/iOS with Safari and Chrome, NVDA, JAWS, TalkBack) of row focus + `aria-labelledby`, selection announcement, fast arrow repeat (RA#7734), virtualized scrolling (WebKit 236865); record in the research note and support matrix — deferred to docs/review-backlog.md (add-grid-list)

## 1. `collection-grid` (`core/collection`, `core/env`, `core/dom`)

- [x] 1.1 `grid.ts`: position model (row key + child index), pure child traversal for `arrow`/`tab`, `owner(target, row)` key-ownership predicate; node tests for every `collection-grid` scenario that needs no DOM
- [x] 1.2 `GridLayout` capability interface + fake; `core/dom/grid-layout.ts` measured `targetAbove`/`targetBelow` (null on zero rects) and the collection-order fallback
- [x] 1.3 `row-controls.ts`: `controlsOf(row)` in document order, dev warning for foreign focusables
- [x] 1.4 Machine pieces: events `FOCUS_CHILD`/`NAVIGATE_CHILD`/`NAVIGATE_SPATIAL`, `childIndex`, guards `isOnControl`/`canMoveSpatially`, effect `focusChild`

## 2. Machine (`core/components/grid-list`)

- [x] 2.1 `grid-list.machine.ts` (design §2): events, controllable `value`, bound props, `pressRow` (checkbox → action only), `announceSelection` gated by the quirk entry
- [x] 2.2 `node` tests for selection/action rules per mode and behaviour, checkbox override, Space vs action, link rows, select-all in virtualized lists, spatial fallback

## 3. Connect and messages

- [x] 3.1 `grid-list.connect.ts`: roles, names, empty `group`, set metadata, virtualized `aria-rowcount`/`aria-rowindex`, tab order of controls, keymap through `owner()`, checkbox and control props, `data-*` per spec — done except virtualization (`aria-rowcount`/`aria-rowindex`), moved to the backlog — deferred to docs/review-backlog.md (add-grid-list)
- [x] 3.2 `grid-list.messages.ts`; quirk entry consumer (`a11y-quirks` delta in this change) with a local test double until the entry lands
- [x] 3.3 Unit tests for every attribute (stack/grid, arrow/tab, disabled rows with controls, empty) (in `grid-list.dom.test.tsx`: roles and names, empty group, disabled rows with controls, tab order of controls; arrow vs tab in the model classes)

## 4. React parts (`packages/react/src/grid-list`)

- [x] 4.1 Root, Label, List, Item (+ internal Cell), ItemText, ItemDescription, ItemCheckbox, ItemControl, Empty, LoadMore; item context for tab order; `render` on each
- [x] 4.2 Dev warnings: unnamed list, foreign focusable, `Empty` outside `List`
- [x] 4.3 React tests: Strict Mode, SSR + hydration tab stop, nested Tag Group (react-spectrum#6757, #5179), static vs data items — deferred to docs/review-backlog.md (add-grid-list)

## 5. Contract and driver

- [x] 5.1 `grid-list.contract.ts` per design §6; `row-children` trait in `@rind-ui/testing`
- [x] 5.2 `getGridList` driver; tests in browser, jsdom and Playwright against the site examples harness

## 6. Tests

- [x] 6.1 One browser test per scenario; issue-citing ones reproduce the issue first (react-spectrum#4674, #8112, #8031, #5179, #4928, #6323, #2946, #9532, #7962, #9610, #9117, #8988, #6904, #10720, #7041, #5067, #9617, #10627, #7887, #6757, #7076)
- [x] 6.2 `testMachine` over the props classes, all modalities incl. `virtual`, RTL, axe per state (empty `group` included)
- [x] 6.3 Virtualized fixture; measured spatial moves in a three-column fixture (browser mode) — deferred to docs/review-backlog.md (add-grid-list)
- [x] 6.4 Virtual screen-reader reading-order test (row name excludes controls, checkbox "Select …", selection announcement on Apple WebKit) — deferred to docs/review-backlog.md (add-grid-list)

## 7. Theme (`packages/theme/src/grid-list.css`)

- [x] 7.1 Tier-3 `--rind-grid-list-*` tokens (design §7), `@layer rind.components`, `:where()`, family `collection item`, `data-size`, `data-tone="danger"`; grid layout via custom properties; never `display: contents` on list or row; ≥ 24px targets
- [x] 7.2 Forced colors: selection and focus cues; Playwright captures

## 8. Site examples

- [x] 8.1 Site examples (apps/site/examples/grid-list.tsx, state examples for every contract state): Checkbox + actions (candidates), cards grid, `tab` mode with a text field, links, disabled rows with buttons, empty, RTL, virtualized, nested Tag Group, in a Popover with `selectOnPressUp`; themed, axe clean

## 9. Docs and closing

- [x] 9.1 Docs page (generated API + guide: Listbox vs Grid List, `item-control`, `arrow` vs `tab`, selection vs action matrix, testing with `getGridList`)
- [x] 9.2 Manual tier-1 pass on real AT; record in "Tested with" — deferred to docs/review-backlog.md (add-grid-list)
- [x] 9.3 Set Grid List to `wip`/`done` in `docs/components.md`; archive when approved
- [x] 9.4 `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green; changeset

## Amendments (from coordinator)

- [x] A.1 Delta for archived `a11y-quirks`: implement registry entry `webkit-grid-selection-not-announced` (Apple + WebKit; WebKit 235068, RA `useGridSelectionAnnouncement`; removal condition; `announcement-parity`) with its reproducing test and the manual-protocol pointer, per `specs/a11y-quirks/spec.md`
