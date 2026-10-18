## 0. Prerequisites

- [x] 0.1 Confirm `add-foundations`, `add-a11y-foundations`, `add-overlay-infrastructure`, `add-floating-positioning`, `add-button` (`button-like-element`), `add-tooltip` (`hover-intent`, `timed`), `add-popover` (`non-modal-tab-order`), `add-collapsible` (`content-size` with the `switched()` request applied), `add-tabs` (`selection-indicator`), `add-link` (`link-navigation`) and `add-theme-system` are applied

## 1. Machine (`core/components/navigation-menu/navigation-menu.machine.ts`)

- [x] 1.1 States `closed | warm | opening | open | closing`; events per design §1; controllable `value` bound to states; `after` delays `openDelay` 200, `closeDelay` 300, `skipDelay` 300; patient-click window 500
- [x] 1.2 Guards `hoverable`, `isOpenItem`, `patient`, `hoverOpened`; context `pending`, `openedBy`, `openedAt`, `suppressHover`, `previous`; `disabled` and `openOnHover` prop steps
- [x] 1.3 Effects in `open | closing`: layer (kind `popover`, non-modal, Escape/outside press/outside focus from inside only), `hoverIntent.track` while hover-opened, `nonModalTabOrder`, `trackPosition` when positioned; focus restore on Escape with cause `layer`
- [x] 1.4 `navigation-menu-tree.ts`: `closeTree`, `PARENT.CLOSE` propagation, inherited `openOnHover`
- [x] 1.5 Node tests of every transition with `fakeHoverIntent`, fake timers, controlled refusal, two-level tree

## 2. Connect (`navigation-menu.connect.ts`, `navigation-menu.messages.ts`)

- [x] 2.1 Root/Sub (landmark, label message), List, Item, Trigger (`button-like-element`, `aria-expanded`, `aria-controls` while mounted, hover-intent trigger props, press, logical keys), Link (`linkProps` + activation → `LINK.ACTIVATE`), Content (`hidden` per mode, `data-motion`, key handling only on own parts), Viewport, Indicator, Positioner
- [ ] 2.2 Unit tests for every row of "Data Attributes" and for the absence of `aria-orientation`, `aria-haspopup`, `aria-owns` and `menu*` roles

## 3. Parts (`@rind-ui/react`)

- [x] 3.1 `NavigationMenu.Root`, `List`, `Item`, `Trigger`, `Content`, `Link`, `Indicator`, `Viewport`, `Positioner`, `Sub`; generic `Portal`; `render` on every part; registration after commit
- [x] 3.2 Content into viewport portal, `usePresence`, `useContentSize` (`opened`/`switched`/`closed`/`settled`), indicator and positioner bindings
- [ ] 3.3 SSR + hydrate tests: closed `hidden` content in server HTML, Suspense inside a trigger (radix#2350), no `document` during render (ark#3988)

## 4. Contract and driver

- [x] 4.1 `navigation-menu.contract.ts` per spec and design §6 (locate by `navigation` + name, actions with pointer/keyboard twins and touch `none` for hover, `{ skip }` events, prop steps, traits, per-contract invariants)
- [x] 4.2 `getNavigationMenu` export; same driver test in browser, jsdom (fake timers) and Playwright

## 5. Model-based and regression tests

- [x] 5.1 `testMachine(navigationMenuContract)` in pointer, keyboard and virtual modalities × nested levels × `closedContent` modes × `openOnHover` × LTR/RTL
- [ ] 5.2 Browser tests (Chromium, Firefox, WebKit) for every spec scenario, each regression reproduced first: radix#1529, #1630/#2326, #1553/#2437, #1403, #2074, #1364, #3085, #3396, #3473, #2424, #1273/#2143, #1623/#3786, #2476, #1806/#2089, #3159, #1774; mui/base-ui#5413, #5453/#5239, #4619, #3308/#3073, #2240, #2035, #4463, #4262, #4386, #3343, #4349, #2775, #2390, #3570; reka-ui#729, #1131, #548, #1191, #2383/#1196, #2608, #2664, #2168, #3015; bits-ui#1638, #2034, #1373; kobalte#446, #490; zag#3261
- [ ] 5.3 Tab-order equality inline vs viewport vs portal; size transitions with fast switching and items without content; window resize while open
- [ ] 5.4 Partial ARIA snapshots per state example (closed, open by hover, open by press, nested open) in three engines

## 6. Theme, site examples, docs

- [x] 6.1 `packages/theme/src/navigation-menu.css` (`@layer rind.components`, `:where()` selectors, `--rind-navigation-menu-*` tokens read with semantic fallbacks and never declared; triggers/bar links in the `toggle item` variant matrix, viewport/content as `panel`; viewport size transition, `[data-instant]`, `data-motion` keyframes, `max-height` on available height, forced colors, reduced motion, `data-tone="danger"` state); imported from `index.css`
- [x] 6.2 Site examples (apps/site/examples/navigation-menu.tsx, state examples for every contract state): simple dropdowns, mega menu with viewport and indicator, split items, nested levels, positioned + portalled, vertical in a drawer (mobile), RTL, click-only (`openOnHover={false}`), client-router links with current page, 320 px, driver usage; a `states` export covering every contract state
- [x] 6.3 Docs page (generated API facts + guide): disclosure navigation vs menubar, inline vs viewport (reading order), mobile composition, router setup via add-link, testing with fake timers
- [ ] 6.4 Mark `docs/research/navigation-menu.md` done on archive and Navigation Menu `done` in `docs/components.md`; changeset; `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green
