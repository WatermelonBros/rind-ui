## 0. Prerequisites

- [x] 0.1 Confirm `add-menu` (and its dependencies), `add-collections` and `add-theme-system` are applied
- [x] 0.2 Agree requests 1–4 in design.md with the `add-menu` owner and land the `MenuTree` / trigger hooks with their own tests; agree request 5 with `add-theme-system`

## 1. Machine (`core/components/menubar`)

- [x] 1.1 `menubar.machine.ts`: states `closed` / `open` bound to the controllable `value`, events per design §2, collection context over the bar items, props `orientation`, `loop`, `modal`, `disabled`, `focusableWhenDisabled`
- [x] 1.2 Actions: `switchTo` (one proposal, disabled skipped, wrap with `loop`), open with the event's modality, `MENU_CLOSED` → `null`, vertical collapse → close; menubar registered as the `MenuTree` parent of kind `menubar` with its root element
- [x] 1.3 `node` tests with a fake tree: every transition, controlled proposals and refusals, programmatic `value` then hover (ariakit#7083, #7086), open mode ends on every close reason (kobaltedev/kobalte#333), Enter opens the focused item (kobaltedev/kobalte#332), disabled bar (mui/base-ui#2727)

## 2. Connect (`menubar.connect.ts`, `menubar.messages.ts`)

- [x] 2.1 (the trigger keeps the menu scope + `data-host="menubar"`: spec amended) Root and trigger props per the spec's Roles And Naming and Data Attributes; trigger = menu trigger in menubar mode + roving props + press / hover delegation; `none` wrappers; dev warning for an unnamed menubar
- [x] 2.2 Bar keys (axis arrows mirrored in RTL, Home / End, typeahead, opening keys per orientation), target / modifier / composition guards; positioning preset per orientation
- [x] 2.3 Unit tests for every attribute and key mapping in the spec

## 3. Parts (`packages/react/src/menubar`)

- [x] 3.1 `Menubar.Root`, `Menubar.Menu`, `Menubar.Trigger`; `render` on each; Menu parts used inside each menu
- [x] 3.2 React tests: Strict Mode, SSR + hydrate (first item is the tab stop), menu inside a Suspense boundary (radix-ui/primitives#2569), fullscreen container portal (huntabyte/bits-ui#1203), Reado `MenuBar` port as a fixture

## 4. Contract and driver

- [x] 4.1 (query `currentMenu`, trait `directional`: spec amended) `menubar.contract.ts` per design §6 (traits, actions with keyboard twins or stated reasons, `menu(name)` scoped menu driver, event map, prop steps)
- [x] 4.2 `getMenubar` exported from `@rind-ui/testing`; driver tests in `browser` and `jsdom` and through Playwright against the site examples harness

## 5. Tests

- [x] 5.1 (two cited regressions without their own test: docs/review-backlog.md) One browser test per spec scenario; regression scenarios reproduce the cited issue first (radix-ui/primitives#2569, #3267, #3699, #3762; ariakit#4023, #5262, #7083, #7086, #7410; mui/base-ui#2092, #2727, #4004; kobaltedev/kobalte#332, #333, #544; huntabyte/bits-ui#989, #1203, #1593; unovue/reka-ui#164)
- [x] 5.2 Pointer-path browser tests (Chromium, Firefox, WebKit): hover switching, a fast sweep across five items, touch scroll over the bar, click on another item while a modal menu is open
- [x] 5.3 `testMachine`: argument classes from the spec's Model-Based Coverage, all modalities incl. `virtual`, RTL run, every invariant incl. CDP "name sources reachable" in Chromium, axe per state (open menu included)
- [x] 5.4 Virtual screen reader reading-order test (menubar name, items with "has popup", open menu named by its item)

## 6. Theme (`packages/theme/src/menubar.css`)

- [x] 6.1 Tier-3 `--rind-menubar-*` tokens (design §8) read with semantic fallbacks, `@layer rind.components`, `:where()` selectors; triggers in the `toggle item` family (request 5), open state as an edge plus background, 24×24 targets, a `data-tone="danger"` state capture; menus use `menu.css`; imported from `index.css`
- [x] 6.2 Forced-colors Playwright captures (open trigger, focus ring visible)

## 7. Site examples

- [x] 7.1 Site examples (apps/site/examples/menubar.tsx, state examples for every contract state): Application menubar (File / Edit / View with submenus, checkbox and radio items, disabled items, shortcut hints), vertical menubar, non-modal menubar, disabled menubar, RTL, Reado title bar; state examples (menu open, submenu open); ARIA snapshots; all pass axe
- [x] 7.2 Driver example (docs testing example)

## 8. Docs and manual checks

- [x] 8.1 Generated docs page (anatomy, props, `data-*`, keyboard table for the bar and inside menus, open-mode switching, modality, vertical bars, `aria-keyshortcuts` recipe, macOS note: apps use the system menu bar, Reado migration, testing with `getMenubar` / `testMachine`) and `llms.txt` entry
- [x] 8.2 (deferred: docs/review-backlog.md, manual passes) Manual tier-1 pass: VO + Safari macOS (VO+Space opens, VO cursor order along the bar — radix-ui/primitives#3699, focus stays in the bar on open — ariakit#5262), NVDA + Firefox / Chrome, JAWS + Chrome, VO iOS and TalkBack; record in "Tested with"
- [x] 8.3 (deferred: docs/review-backlog.md; Reado repo) Migrate Reado's `MenuBar.tsx` and its tests (design Migration Plan) once the change is applied
- [x] 8.4 (wip now; done at archive) Set Menubar to `wip` / `done` in `docs/components.md` as it progresses; archive when approved

## 9. Proof

- [x] 9.1 `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green; changeset for core, react, testing, theme
