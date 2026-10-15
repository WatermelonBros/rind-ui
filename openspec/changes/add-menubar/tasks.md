## 0. Prerequisites

- [ ] 0.1 Confirm `add-menu` (and its dependencies), `add-collections` and `add-theme-system` are applied
- [ ] 0.2 Agree requests 1–4 in design.md with the `add-menu` owner and land the `MenuTree` / trigger hooks with their own tests; agree request 5 with `add-theme-system`

## 1. Machine (`core/components/menubar`)

- [ ] 1.1 `menubar.machine.ts`: states `closed` / `open` bound to the controllable `value`, events per design §2, collection context over the bar items, props `orientation`, `loop`, `modal`, `disabled`, `focusableWhenDisabled`
- [ ] 1.2 Actions: `switchTo` (one proposal, disabled skipped, wrap with `loop`), open with the event's modality, `MENU_CLOSED` → `null`, vertical collapse → close; menubar registered as the `MenuTree` parent of kind `menubar` with its root element
- [ ] 1.3 `node` tests with a fake tree: every transition, controlled proposals and refusals, programmatic `value` then hover (ariakit#7083, #7086), open mode ends on every close reason (kobaltedev/kobalte#333), Enter opens the focused item (kobaltedev/kobalte#332), disabled bar (mui/base-ui#2727)

## 2. Connect (`menubar.connect.ts`, `menubar.messages.ts`)

- [ ] 2.1 Root and trigger props per the spec's Roles And Naming and Data Attributes; trigger = menu trigger in menubar mode + roving props + press / hover delegation; `none` wrappers; dev warning for an unnamed menubar
- [ ] 2.2 Bar keys (axis arrows mirrored in RTL, Home / End, typeahead, opening keys per orientation), target / modifier / composition guards; positioning preset per orientation
- [ ] 2.3 Unit tests for every attribute and key mapping in the spec

## 3. Parts (`packages/react/src/menubar`)

- [ ] 3.1 `Menubar.Root`, `Menubar.Menu`, `Menubar.Trigger`; `render` on each; Menu parts used inside each menu
- [ ] 3.2 React tests: Strict Mode, SSR + hydrate (first item is the tab stop), menu inside a Suspense boundary (radix-ui/primitives#2569), fullscreen container portal (huntabyte/bits-ui#1203), Reado `MenuBar` port as a fixture

## 4. Contract and driver

- [ ] 4.1 `menubar.contract.ts` per design §6 (traits, actions with keyboard twins or stated reasons, `menu(name)` scoped menu driver, event map, prop steps)
- [ ] 4.2 `getMenubar` exported from `@rind-ui/testing`; driver tests in `browser` and `jsdom` and through Playwright against Storybook

## 5. Tests

- [ ] 5.1 One browser test per spec scenario; regression scenarios reproduce the cited issue first (radix-ui/primitives#2569, #3267, #3699, #3762; ariakit#4023, #5262, #7083, #7086, #7410; mui/base-ui#2092, #2727, #4004; kobaltedev/kobalte#332, #333, #544; huntabyte/bits-ui#989, #1203, #1593; unovue/reka-ui#164)
- [ ] 5.2 Pointer-path browser tests (Chromium, Firefox, WebKit): hover switching, a fast sweep across five items, touch scroll over the bar, click on another item while a modal menu is open
- [ ] 5.3 `testMachine`: argument classes from the spec's Model-Based Coverage, all modalities incl. `virtual`, RTL run, every invariant incl. CDP "name sources reachable" in Chromium, axe per state (open menu included)
- [ ] 5.4 Virtual screen reader reading-order test (menubar name, items with "has popup", open menu named by its item)

## 6. Theme (`packages/theme/src/menubar.css`)

- [ ] 6.1 Tier-3 `--rind-menubar-*` tokens (design §8) read with semantic fallbacks, `@layer rind.components`, `:where()` selectors; triggers in the `toggle item` family (request 5), open state as an edge plus background, 24×24 targets, a `data-tone="danger"` state capture; menus use `menu.css`; imported from `index.css`
- [ ] 6.2 Forced-colors Playwright captures (open trigger, focus ring visible)

## 7. Stories (`apps/storybook`)

- [ ] 7.1 Application menubar (File / Edit / View with submenus, checkbox and radio items, disabled items, shortcut hints), vertical menubar, non-modal menubar, disabled menubar, RTL, Reado title bar; state stories (menu open, submenu open); ARIA snapshots; all pass axe
- [ ] 7.2 Driver story (docs testing example)

## 8. Docs and manual checks

- [ ] 8.1 Generated docs page (anatomy, props, `data-*`, keyboard table for the bar and inside menus, open-mode switching, modality, vertical bars, `aria-keyshortcuts` recipe, macOS note: apps use the system menu bar, Reado migration, testing with `getMenubar` / `testMachine`) and `llms.txt` entry
- [ ] 8.2 Manual tier-1 pass: VO + Safari macOS (VO+Space opens, VO cursor order along the bar — radix-ui/primitives#3699, focus stays in the bar on open — ariakit#5262), NVDA + Firefox / Chrome, JAWS + Chrome, VO iOS and TalkBack; record in "Tested with"
- [ ] 8.3 Migrate Reado's `MenuBar.tsx` and its tests (design Migration Plan) once the change is applied
- [ ] 8.4 Set Menubar to `wip` / `done` in `docs/components.md` as it progresses; archive when approved

## 9. Proof

- [ ] 9.1 `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green; changeset for core, react, testing, theme
