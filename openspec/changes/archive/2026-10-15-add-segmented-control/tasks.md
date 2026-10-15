## 0. Prerequisites

- [x] 0.1 Confirm `add-foundations`, `add-a11y-foundations`, `add-collections`, `add-button`, `add-checkbox` (`hidden-form-input`), `add-radio-group` (exported machine with `INDICATOR.MEASURE`) and `add-tabs` (`core/dom/selection-indicator.ts`) are merged

## 1. Connect

- [x] 1.1 `core/src/components/segmented-control/segmented-control.connect.ts` on `radioGroupMachine`: root, label, item (single segment element with `role="radio"` + hidden-input props), indicator (`selection-indicator` props); scope `segmented-control` everywhere; default `orientation: "horizontal"`
- [x] 1.2 Dev-only warnings for an unnamed control and for a segment without text or `aria-label`; unit tests for every ARIA and `data-*` attribute per state (no `data-scope="radio-group"`, ark#2629)

## 2. Machine reuse

- [x] 2.1 Node tests running the `radio-group` behaviour scenarios that apply (arrow selects, focus does not select, read-only, no deselect, reset) through Segmented Control's connect and props defaults

## 3. Parts

- [x] 3.1 `packages/react/src/segmented-control/`: `SegmentedControl.Root`, `Label`, `Item`, `Indicator`; static registration; hidden input as the item's sibling; indicator effect wiring; exports and types
- [x] 3.2 React tests: SSR + hydration (tab stop, indicator hidden until measured), `render` substitution keeps role and behaviour, conditional mount shows the indicator (ark#3435, ark#3703), StrictMode leaves no stale indicator style (react-spectrum#10570)

## 4. Indicator and forms

- [x] 4.1 Browser tests: first measurement carries `data-resizing`, first change does not (ark#1129), scrolled container (zag#2810), window resize, nothing selected → `hidden`
- [x] 4.2 Browser and jsdom tests: form data, reset, required, Enter implicit submission, through `hidden-form-input`

## 5. Contract and driver

- [x] 5.1 `segmented-control.contract.ts`: anatomy, locate by `radiogroup` name, `select` (pointer/touch/keyboard), queries `segments`/`selected`/`focusedSegment`/`isDisabled`/`formValue`, traits `composite-roving`, `selectable`, `directional`
- [x] 5.2 `getSegmentedControl` generated driver exported from `@rind-ui/testing`; type tests
- [x] 5.3 Driver tests in the `browser` and `jsdom` projects and through the Playwright adapter: every action in every modality, RTL, read-only, virtual click selects once, virtual focus does not select

## 6. Model-based tests

- [x] 6.1 `testMachine(segmentedControlContract, …)` over all transitions × pointer/touch/keyboard/virtual × ltr/rtl × argument classes (no value, disabled segment, read-only, required), with `focus-does-not-commit`, `virtual-parity`, `selectable` and one-tab-stop invariants; `INDICATOR.MEASURE` excluded from paths
- [x] 6.2 Broken variants fail with readable reports: toggle-button semantics (`aria-pressed`), arrows that only move, leaked `radio-group` scope

## 7. Theme

- [x] 7.1 `packages/theme/src/segmented-control.css` on data attributes only, reading tier-3 component tokens (`--rind-segmented-control-*`, defaulting to semantic tokens; decision 0007, after `add-theme-system`): pill container, indicator from `--rind-indicator-*` with token transitions, `[data-resizing]` and reduced motion disable them, forced-colors selected border, 24×24 segments, shared focus ring; imported from `index.css`
- [x] 7.2 Forced-colors and reduced-motion Playwright captures of the state stories

## 8. Stories

- [x] 8.1 `apps/storybook` stories: default, with indicator, icon segments with labels, disabled segment, read-only, in a form, RTL, controlled, conditional mount, driver-in-use; state stories with ARIA snapshots; all pass axe

## 9. Docs

- [x] 9.1 Generated docs page (anatomy, props, `data-*`, keyboard table, why radio semantics, Segmented Control vs Toggle Group vs Tabs vs Radio Group, indicator variables, migration from Ark Segment Group, driver example) and `llms.txt` entry

## 10. Proof

- [x] 10.1 `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green
