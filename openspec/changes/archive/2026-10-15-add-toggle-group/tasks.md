## 0. Prerequisites

- [x] 0.1 Confirm `add-foundations`, `add-a11y-foundations`, `add-collections` and `add-toggle` (`toggle` connect usable with a group-owned `pressed`) are merged

## 1. Machine

- [x] 1.1 `core/src/components/toggle-group/toggle-group.machine.ts`: states `idle`/`focused`, `NAVIGATE` (focus only), `PRESS { key }`, `FOCUS`/`BLUR`, `COLLECTION.CHANGE`; controllable `value: string[]`; `selectionMode`, `disallowEmptySelection`; collections selection with `toggle` behaviour
- [x] 1.2 Node tests: single replaces, deselect in both modes, `disallowEmptySelection` in both modes, disabled never added, navigation never changes the value, `cancel()`, controlled proposal and refusal

## 2. Connect

- [x] 2.1 `toggle-group.connect.ts`: root (`role="group"`, no `aria-orientation`, keydown → logical keys with `vertical` → `both`), item = `toggleConnect` + roving props + `data-key`/`data-highlighted`/`data-orientation`; ignore modified/composing/descendant keys
- [x] 2.2 Dev-only warning for an unnamed group; unit tests for every ARIA and `data-*` attribute per state

## 3. Parts

- [x] 3.1 `packages/react/src/toggle-group/`: `ToggleGroup.Root`, `ToggleGroup.Item`; static registration; exports and types
- [x] 3.2 React tests: `render` as `<span>` keeps toggle behaviour, group `disabled` reaches items (react-spectrum#7798), dialog initial focus lands on the tab-stop item (radix#3077), SSR + hydration tab stop, Safari click focuses the item (radix#703, browser project WebKit)

## 4. Contract and driver

- [x] 4.1 `toggle-group.contract.ts`: anatomy, locate by `group` name, `toggle` (pointer/touch/keyboard), queries `items`/`pressed`/`focusedItem`/`isDisabled`, traits `composite-roving`, `directional`, per-component `aria-pressed` invariant
- [x] 4.2 `getToggleGroup` generated driver exported from `@rind-ui/testing`; type tests
- [x] 4.3 Driver tests in the `browser` and `jsdom` projects and through the Playwright adapter: every action in every modality, Enter, Home/End, RTL, vertical, controlled deselect (radix#721)

## 5. Model-based tests

- [x] 5.1 `testMachine(toggleGroupContract, …)` over all transitions × pointer/touch/keyboard/virtual × ltr/rtl × argument classes (single, multiple, `disallowEmptySelection`, vertical, all disabled), with `focus-does-not-commit`, `virtual-parity` and one-tab-stop invariants
- [x] 5.2 Broken variants fail with readable reports: radio roles in single mode, arrows that press, `aria-pressed` missing when off, root as tab stop

## 6. Theme

- [x] 6.1 `packages/theme/src/toggle-group.css` on data attributes only, reading tier-3 component tokens (`--rind-toggle-group-*`, defaulting to semantic tokens; decision 0007, after `add-theme-system`): toggle pressed cue, joined borders, 24×24 targets, forced-colors mapping, shared focus ring; imported from `index.css`
- [x] 6.2 Forced-colors Playwright captures of the state stories

## 7. Stories

- [x] 7.1 `apps/storybook` stories: single, multiple, `disallowEmptySelection`, vertical, disabled item, `focusableWhenDisabled`, icon-only items with labels, RTL, controlled, driver-in-use; state stories with ARIA snapshots; all pass axe

## 8. Docs

- [x] 8.1 Generated docs page (anatomy, props, `data-*`, keyboard table, why toggle buttons and not radios, Toggle Group vs Segmented Control vs Radio Group vs Tabs, migration note for Radix single mode, driver example) and `llms.txt` entry

## 9. Proof

- [x] 9.1 `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green

## Amendments (from add-toolbar)

Hosted mode (former A.1) moved to add-toolbar R.2.
