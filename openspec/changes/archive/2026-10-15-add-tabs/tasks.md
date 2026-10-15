## 0. Prerequisites

- [x] 0.1 Confirm `add-foundations`, `add-a11y-foundations` (press, modality guards, keys, ids, `untilFound`, `focusSafely`), `add-collections` (static registration, navigation, composite, selection) and `add-button` (`button-like-element`) are merged

## 1. Shared DOM modules

- [x] 1.1 `core/dom/selection-indicator.ts`: layout-offset measurement relative to a container (transform-immune, scroll-corrected, never rounded up), right/bottom from scroll size, `ResizeObserver` over container and items, `INDICATOR.MEASURE` with `cause`
- [x] 1.2 Browser tests for every `selection-indicator` scenario: scaling dialog, scrolled page and container, fractional width, sibling resize, conditional mount, first measurement vs first change, window resize, StrictMode + hydration
- [x] 1.3 `core/dom/tabbable-content.ts`: MutationObserver-based "contains a tabbable element" reporter; browser and jsdom tests (text only → form → text only)

## 2. Machine

- [x] 2.1 `core/src/components/tabs/tabs.machine.ts`: states `idle`/`focused`, collections events + `PRESS`, `FOCUS`/`BLUR`, `REVEAL`, `PANEL.TABBABLE`, `INDICATOR.MEASURE`; controllable `value`; `isKeyboard ∧ automatic` guard on `NAVIGATE`; `ensureSelection`, `syncHighlightToSelection`
- [x] 2.2 Node tests: focus never selects (any modality), keyboard `NAVIGATE` selects only in automatic mode, manual Enter/Space via `PRESS`, default first enabled + one `COLLECTION.CHANGE` callback, controlled `null` untouched, selected tab removed → repair target, disabled never selected, all disabled, controlled change while blurred moves the roving stop, `reason: "find-in-page"`

## 3. Connect

- [x] 3.1 `tabs.connect.ts`: root, list, tab, panel, indicator props per the `tabs` and `selection-indicator` specs; logical keys with orientation mapping (`vertical` → `both`); ignore modified/composing/descendant keys; `aria-controls` only to rendered panels; `inactivePanels` modes
- [x] 3.2 Dev-only warning for an unnamed tab list; unit tests for every `data-*` attribute and ARIA attribute per state

## 4. Parts

- [x] 4.1 `packages/react/src/tabs/`: `Tabs.Root`, `Tabs.List`, `Tabs.Tab`, `Tabs.Panel`, `Tabs.Indicator`; static registration via `use-collection-items`; exports and types
- [x] 4.2 React tests: insert before selected (headlessui#1834), reorder (headlessui#2131), nested Tabs (bits-ui#2189), SSR + hydration with `defaultValue` (tab stop, ids, no warnings), `render` substitution keeps role and behaviour, blur in the old panel fires before switch (radix#3600)

## 5. Contract and driver

- [x] 5.1 `tabs.contract.ts`: anatomy, locate by `tablist` name, `select` (pointer/touch/keyboard), `focusTab` (keyboard), queries `tabs`/`selected`/`focusedTab`/`panel`/`isDisabled`, traits `composite-roving`, `selectable`, `directional`
- [x] 5.2 `getTabs` generated driver exported from `@rind-ui/testing`; type tests for unknown actions and wrong argument types
- [x] 5.3 Driver tests in the `browser` and `jsdom` projects and through the Playwright adapter: every action in every modality, RTL, vertical, manual mode, virtual click selects, virtual focus does not

## 6. Model-based tests

- [x] 6.1 `testMachine(tabsContract, …)` over all transitions × pointer/touch/keyboard/virtual × ltr/rtl × argument classes (no default, first disabled, selected disabled, all disabled, vertical, manual, `until-found`), with `focus-does-not-commit`, `virtual-parity`, one-tab-stop, `selectable` and hidden-but-mounted invariants
- [x] 6.2 Broken variants fail with readable reports: select on focus (radix#1047), tab stop on a disabled selected tab (react-spectrum#10633), panels hidden only visually (headlessui#2688), dangling `aria-controls` (radix#1703)

## 7. Find-in-page and scrolling

- [x] 7.1 Browser tests (Chromium, Firefox; WebKit where supported): `beforematch` selects the tab with `reason: "find-in-page"`, `data-reveal`, controlled refusal restores `until-found`; fallback to `hidden` where unsupported
- [x] 7.2 Browser tests: keyboard move scrolls the tab into view (nearest, instant, reduced motion), no scroll on mount (react-spectrum#4132) or pointer press (ariakit#4132)

## 8. Theme

- [x] 8.1 `packages/theme/src/tabs.css` on data attributes only, reading tier-3 component tokens (`--rind-tabs-*`, defaulting to semantic tokens; decision 0007, after `add-theme-system`): underline indicator from the custom properties, transition tokens, `[data-resizing]` and reduced motion disable it, forced-colors selected cue, 24×24 targets, shared focus ring, no `[hidden]` override; imported from `index.css`
- [x] 8.2 Forced-colors and reduced-motion Playwright captures of the state stories

## 9. Stories

- [x] 9.1 `apps/storybook` stories: default, vertical, manual activation, disabled tabs, `focusableWhenDisabled`, `inactivePanels` modes (incl. find-in-page), indicator, scrollable list, RTL, controlled, driver-in-use; state stories with ARIA snapshots; all pass axe

## 10. Docs

- [x] 10.1 Generated docs page (anatomy, props, `data-*`, keyboard table, activation modes and why focus never selects, panel modes and find-in-page, indicator variables, driver example, Tabs vs Segmented Control vs Toggle Group) and `llms.txt` entry

## 11. Proof

- [x] 11.1 `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green
