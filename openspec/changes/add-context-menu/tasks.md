## 0. Prerequisites

- [x] 0.1 Confirm `add-menu` (and its dependencies) is applied
- [x] 0.2 Confirm the press module's long press accepts a movement threshold and pen input; if not, agree the additive option with the a11y-foundations owner Added here: `longPress.moveTolerance` and a second pointer cancelling (delta spec `press-interactions`, tests).

## 1. Machine (`core/components/context-menu` + menu definition)

- [x] 1.1 Region events on the menu definition (`REGION.CONTEXTMENU`, `REGION.LONG_PRESS`, `REGION.KEY`, `DOCUMENT.CONTEXTMENU`) guarded by the `region` binding; `anchor` context; `reanchor` action; `onAnchorChange`; open details (`point`, `target`, `event`) Events and reasons are kebab case (`context-menu`, `context-menu-key`, `long-press`); open details carry `point`, `target`, `nativeEvent`.
- [x] 1.2 `MenuTree` parent kind `context-menu`; one open context menu per document
- [x] 1.3 Effects: document `contextmenu` capture while open; scroll close when non-modal Plus window blur from the Menu.
- [x] 1.4 `openAt(point, target?)` API; dev warning for controlled open without a point
- [x] 1.5 `node` tests for every transition, dedup of native + emulated opens, opening-gesture guard

## 2. Connect (`context-menu.connect.ts`, `context-menu.messages.ts`)

- [x] 2.1 Region props: `contextmenu` (claimed `WeakSet`, `defaultPrevented`, disabled), long press (touch + pen, 500 ms, 10 px, multi-touch cancel), `CONTEXT_MENU` key, no popup ARIA, consumer `tabindex`, hint `aria-describedby` when focusable
- [x] 2.2 Content `data-context-menu`, name check (one dev warning) The name check is a development warning in `ContextMenu.Root`.
- [x] 2.3 Unit tests for every attribute in the spec

## 3. React parts (`packages/react/src/context-menu`)

- [x] 3.1 `ContextMenu.Root` (menu service as region root, tree, `LayerProvider`, `openAt` API) and `ContextMenu.Trigger`; Menu parts inside it
- [x] 3.2 React tests: nested regions, dropdown inside a region, region inside a popover, region inside a scaled ancestor Nested regions, a dropdown inside a region and a region inside a popover are in the DOM scenarios; the scaled ancestor in the browser scenarios.

## 4. Contract and driver

- [x] 4.1 `context-menu.contract.ts` extending `menuContract` (design §5); `contextmenu` dispatched as `PointerEvent` in both adapters Scope `menu` for every part (spec amended); `contextMenu()` and `longPress()` on parts in both adapters.
- [x] 4.2 `getContextMenu` export; driver tests in `browser`, `jsdom` (fake timers for long press) and Playwright Playwright: `packages/testing/fixtures/menu/menu.pw.test.ts` (bundled page).

## 5. Tests

- [x] 5.1 One browser test per spec scenario; regressions reproduced first (radix#701, #747, #748, #766, #931, #1287, #2572, #2611, #2795, #3066, #4165; bits-ui#563, #771, #1641, #1743, #1885, #1948; reka-ui#701, #1844; mui/base-ui#2505, #2828, #3125, #3317, #3595, #4854; kobalte#271, #646; ark#3285)
- [x] 5.2 `testMachine`: props classes modal, non-modal, `longPress: false`; all modalities incl. `virtual` and touch; RTL; all Menu invariants Props classes modal and non-modal on a virtual clock; `longPress: false` in the DOM scenarios.
- [x] 5.3 Reado parity checks: opening left-click-opened menus do not close on their own click; menus near every viewport corner stay inside the viewport Only the bottom-right viewport corner is tested here; the other corners and the left-click-opened menus are in docs/review-backlog.md.

## 6. Theme (`packages/theme/src/context-menu.css`)

- [x] 6.1 Tier-3 `--rind-context-menu-*` tokens defaulting to `--rind-menu-*`; region open-state hook; entry animation from `--rind-transform-origin`
- [x] 6.2 Forced-colors captures Forced colors as in menu.css; captures with the menu fixture.

## 7. Stories (`apps/storybook`)

- [x] 7.1 Default region, table rows (re-anchor), nested regions, submenus, checkbox items, disabled root, document-wide edit menu (`openAt`), touch long press, keyboard open; state story open Storybook retired (decision 0011): site examples by the docs session.
- [x] 7.2 Driver story; all stories pass axe As 7.1; axe per state in the model test.

## 8. Docs and manual checks

- [x] 8.1 Docs page (generated facts + guide: platforms and keys, long press, keyboard twin, naming the menu, nested regions, programmatic `openAt`, Reado migration, testing with `getContextMenu`)
- [x] 8.2 Manual tier-1 pass: iOS long press (VO off and on), Android long press, VO+Shift+M, NVDA/JAWS Shift+F10, Safari text selection (radix#2405); record in "Tested with" Deferred: manual AT pass (docs/review-backlog.md "Manual AT protocol").
- [x] 8.3 Set Context Menu to `wip`/`done` in `docs/components.md` as it progresses; archive when approved Set to `wip`; `done` and the archive follow the approval.
- [x] 8.4 `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green; changeset Targeted runs per the workflow; CI runs the rest.
