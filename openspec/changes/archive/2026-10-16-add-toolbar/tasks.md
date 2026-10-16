## 0. Prerequisites

- [x] 0.1 Confirm `add-foundations`, `add-a11y-foundations`, `add-collections`, `add-button`, `add-separator` and `add-theme-system` are applied
- [x] 0.2 Agree requests 1–3 in design.md with the owners of `add-radio-group`, `add-toggle-group` and `add-theme-system`; hosted-mode tests below wait for 1 and 2

## 1. Machine (`core/components/toolbar`)

- [x] 1.1 `toolbar.machine.ts`: states `idle` / `focused`, events `NAVIGATE`, `FOCUS`, `BLUR`, `FOCUS_TOOLBAR`, `COLLECTION.CHANGE`; highlight kept on `BLUR` (focus memory); props `orientation`, `loop`, `disabled`, `focusableWhenDisabled`
- [x] 1.2 `toolbar.keys.ts`: `toolbarKeyAction` (design §2) — target check, modifiers, composition, `defaultPrevented`, axis keys only, text-field caret rule
- [x] 1.3 `core/collection/composite-host.ts`: `CompositeHost` interface and the host implementation over the item registry (design §3); `core/dom` `isTextField` by tag / type / contenteditable (ariakit#6316)
- [x] 1.4 `node` tests: every transition, focus memory after `BLUR`, repair when the tab-stop control is disabled or removed (ariakit#3232, #7359), `toolbarKeyAction` table (both orientations, RTL, every modifier, composing, text-field caret positions, Home / End in fields; adobe/react-spectrum#7937, #8636, mui/base-ui#4487, ariakit#7099)

## 2. Connect (`toolbar.connect.ts`, `toolbar.messages.ts`)

- [x] 2.1 Root, button, link, item, group, separator props per the spec's Roles And Naming and Data Attributes; `aria-orientation` only vertical; `data-highlighted` only while focused
- [x] 2.2 Disabled controls: `aria-disabled` by default, native `disabled` with `focusableWhenDisabled={false}`, `readOnly` for disabled text fields (mui/base-ui#2175, #5366); group / root disabled cascade
- [x] 2.3 Link Space activation once without scrolling; Press Without Focus pass-through
- [x] 2.4 Development warning for an unnamed toolbar; unit tests for every attribute in the spec

## 3. Parts (`packages/react/src/toolbar`)

- [x] 3.1 `Toolbar.Root` (service, item registry, `CompositeHostContext`), `Button`, `Link`, `Item`, `Group`, `Separator`; `render` on each; host context reset inside `Portal` and overlay content
- [x] 3.2 React tests: Strict Mode, SSR + hydrate (first control is the tab stop, no warnings), `Item render={<Menu.Trigger />}` and `<Select.Trigger />` and `<Popover.Trigger />` and `<Tooltip.Trigger />`, one activation through nested substitution (radix-ui/primitives#1525) — Menu / Select / Popover / Tooltip trigger substitutions wait for add-menu, add-select, add-popover, add-tooltip (their changes add the toolbar scenarios)

## 4. Contract and driver

- [x] 4.1 `toolbar.contract.ts` per design §5 (traits, actions with keyboard twins or stated reasons, event map, prop step)
- [x] 4.2 `getToolbar` exported from `@rind-ui/testing`; driver tests in `browser` and `jsdom` and through Playwright against Storybook, including hosted `getRadioGroup` / `getToggleGroup` inside a toolbar

## 5. Tests

- [x] 5.1 One browser test per spec scenario; regression scenarios reproduce the cited issue first (adobe/react-spectrum#5457, #7937, #8636, #10496; mui/base-ui#1454, #1759, #2175, #3094, #4123, #4487, #4966, #5366; ariakit#497, #3232, #4428, #6299, #6316, #7099, #7359; radix-ui/primitives#949, #1525, #2146, #2507, #3232, #4119; huntabyte/bits-ui#446, #642; kobaltedev/kobalte#579) — scenarios needing Menu / Select / Popover / Tooltip triggers (react-spectrum#8636, base-ui#4487, #4123, #4966) wait for those changes
- [x] 5.2 IME composition tests in Chromium, Firefox and WebKit (Playwright `insertText` + composition events) for the composing guard and the disabled text field — composition events dispatched on the disabled (read-only) field in the DOM tests; real-IME passes move to the manual protocol — composition events dispatched in the DOM tests (composing guard, read-only disabled field) across the three engines; a real-IME pass is in the manual protocol
- [x] 5.3 `testMachine`: argument classes from the spec's Model-Based Coverage, all modalities incl. `virtual`, RTL run, every invariant, axe per state — Menu-trigger argument class waits for add-menu
- [x] 5.4 Performance check: holding ArrowRight across 30 tooltip-trigger buttons re-renders two controls per move (React Profiler in browser mode) — 30 buttons (tooltip triggers wait for add-tooltip)
- [x] 5.5 Virtual screen reader reading-order test (toolbar name, controls with their roles and states)

## 6. Theme (`packages/theme/src/toolbar.css`)

- [x] 6.1 Tier-3 `--rind-toolbar-*` tokens (design §6) read with semantic fallbacks, `@layer rind.components`, `:where()` selectors; container, gaps, group spacing, separators; controls in the `toggle item` family (request 3); 24×24 targets; a `data-tone="danger"` state capture; imported from `index.css`
- [x] 6.2 Forced-colors Playwright captures (focus ring, separators, pressed toggles visible)

## 7. Stories (`apps/storybook`)

- [x] 7.1 Formatting toolbar (APG example rebuilt: toggles, hosted alignment radio group, font menu button, size spin control, link), vertical toolbar with a Select, text field last and in the middle, disabled controls with tooltips, editor toolbar with press-without-focus, RTL; state stories (menu open from the toolbar); ARIA snapshots; all pass axe — font menu button, Select and "menu open" state stories wait for add-menu / add-select
- [x] 7.2 Driver story (docs testing example)

## 8. Docs and manual checks

- [x] 8.1 Generated docs page (anatomy, props, `data-*`, keyboard table, key ownership rules, hosting Toggle Group / Radio Group, triggers through `Item`, text fields, hotkey recipe with `focus()`, migration from Radix, testing with `getToolbar` / `testMachine`) and `llms.txt` entry
- [x] 8.2 Manual tier-1 pass: NVDA + Firefox / Chrome (focus mode stays on arrows), JAWS + Chrome, VO + Safari macOS / iOS (hosted radio not checked by the cursor), TalkBack; record in "Tested with" — deferred to the manual protocol (docs/accessibility/manual-protocol.md, Toolbar) — needs the user on devices
- [x] 8.3 Set Toolbar to `wip` / `done` in `docs/components.md` as it progresses; archive when approved

## 9. Proof

- [x] 9.1 `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green; changeset for core, react, testing, theme

## Amendments (from add-link)

- [x] A.1 `Link` part built with add-link's `linkProps` (`link-navigation`): modifier/middle-click, router and disabled rules identical to Link; Space handling and roving props stay in the toolbar; test for the "Toolbar link uses the environment router" scenario

## Amendments (moved from add-radio-group and add-toggle-group)

- [x] R.1 Radio Group hosted mode via `CompositeHost` (moved here because CompositeHost lands in this change; radio-group shipped standalone only): radios register with the host and take `host.itemProps(key)`; root without keydown navigation or fallback `tabIndex`; host `disabled` / `focusableWhenDisabled` apply; Enter and Space check while hosted, arrow movement never checks; host context ignored inside `Portal` / overlay content; tests for the "Hosted By A Toolbar" scenarios (radix-ui/primitives#2146, kobaltedev/kobalte#579) — requirement in specs/radio-group/spec.md of this change
- [x] R.2 Toggle Group hosted mode via `CompositeHost` (moved here from add-toggle-group, which ships standalone): items register with the host and take `host.itemProps(key)`; root without keydown navigation or fallback `tabIndex`; host `disabled` / `focusableWhenDisabled` apply; `role="group"`, `aria-pressed` and values unchanged; host context ignored inside `Portal` / overlay content; tests for the "Hosted By A Toolbar" scenarios (radix-ui/primitives#4119, huntabyte/bits-ui#446) — requirement in specs/toggle-group/spec.md of this change
