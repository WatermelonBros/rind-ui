## 0. Prerequisites

- [x] 0.1 Confirm `add-foundations`, `add-a11y-foundations`, `add-overlay-infrastructure`, `add-floating-positioning`, `add-collections`, `add-tooltip` (`hover-intent`), `add-button` and `add-toggle` are applied
- [x] 0.2 Agree with the overlay and add-tooltip owners the two additive points in design Risks (trigger in layer `elements()`; placed-side input and rest timeout for the grace area) and land any API change in `core/dom` with its own tests Done in this change: the trigger is in the layer's `elements()`; hover intent already had the placed target and `restMs`; its grace area now follows the motion near a corner (delta spec `hover-intent`, unit test).
- [x] 0.3 Add the `vo-submenu-expanded` quirk entry (Base UI `MenuSubmenuTrigger` link, repro test path, removal condition, invariant `aria-expanded-mirrors-state`)

## 1. Machine (`core/components/menu`)

- [x] 1.1 `menu-tree.ts`: register/unregister, open path (one open child per level), `openChild`, `childClosed`, `closeTree`, `parentKind`; `node` unit tests incl. late registration (react-spectrum#9915) and sibling sweeps
- [x] 1.2 `menu.machine.ts`: event union, context (`openModality`, `openingPress`, placement, collection pieces), controllable `open` (root), `bindProp` `level`, props with defaults (`modal`, `loop`, `focusableWhenDisabled`, `submenuOpenDelay`, `submenuGraceTimeout`, `positioning`)
- [x] 1.3 Effects: `overlay` (root modal / submenu child, trigger in `elements()`), `trackPosition` (`dropdown` / `submenu` presets), `windowBlur`, `hoverIntent` with the menu extension (placed side, parent highlight freeze, `GRACE.REST`, `pointerout` leave), `focusHighlighted`
- [x] 1.4 Actions: initial focus by modality on first placement, opening-press guard, `select` with `closeOnSelect` per kind and `details.cancel()`, Tab close + trigger focus, Escape per level with `preventDefault`
- [x] 1.5 `menu-radio-group.machine.ts` (controllable `value`); checkbox items through the `toggle` machine
- [x] 1.6 `node` tests for every transition, refusal, `cancel()`, and the fake hover-intent / position / tree capabilities

## 2. Connect (`menu.connect.ts`, `menu.messages.ts`)

- [x] 2.1 Part props per the spec's Roles, Accessible Name and Data Attributes requirements; `role="none"` for foreign children; key handlers limited to own targets
- [x] 2.2 Link items: Enter native, Space one click without scroll, modifier/middle clicks ignored
- [x] 2.3 Submenu trigger attributes incl. the Apple quirk; layer meta; positioning helpers
- [x] 2.4 Unit tests for every attribute in the spec

## 3. React parts (`packages/react/src/menu`)

- [x] 3.1 `Root` (service, `MenuTree`, `LayerProvider`), `Trigger`, `Positioner`, `Content`, `Arrow`, `Item`, `CheckboxItem`, `RadioGroup`, `RadioItem`, `ItemIndicator`, `ItemText`, `Group`, `GroupLabel`, `Separator`, `Submenu`, `SubmenuTrigger`; `render` on each
- [x] 3.2 Presence per animated part; lazy mount, unmount after exit, `keepMounted`
- [x] 3.3 React tests: Strict Mode, SSR + hydrate, dialog from an item (radix#1836, #3317), client-router link item (radix#2718), `render` with a custom button (mui/base-ui#2281)

## 4. Contract and driver

- [x] 4.1 `menu.contract.ts` per design §8 (traits, exception, actions with keyboard twins, `{ skip }` events, `$sync:open` prop step)
- [x] 4.2 `getMenu` in `@rind-ui/testing`; driver tests in `browser` and `jsdom` and through Playwright against the site examples harness — the Playwright run is `packages/testing/fixtures/menu/menu.pw.test.ts` (bundled page).

## 5. Tests

- [x] 5.1 One browser test per spec scenario; regression scenarios reproduce the cited issue first (radix#610, #623, #916, #1089, #1266, #1420, #1443, #1655, #1815, #1836, #1933, #1934, #1963, #2193, #2366, #2418, #2700, #2718, #2756, #2935, #3013, #3106, #3124, #3232, #3317, #3640, #3761, #3977, #4036, #4095, #4195; zag#237, #548, #776, #1090, #2704, #2811, #2931, #2955, #3056, #3255; ark#2874, #2883, #3733; mui/base-ui#411, #1197, #1733, #1746, #2126, #2281, #3125, #3184, #4881, #5152, #5794, #5930; react-spectrum#1513, #5350, #8697, #8916, #9431, #9686, #9737, #9915, #10248, #10767; headlessui#259, #1019, #1634, #2504; bits-ui#1105, #1760, #2191; reka-ui#2100, #2267, #2296, #2596, #2998; kobalte#624; ariakit#7766) Spec scenarios have tests (menu*.dom, menu.browser, menu-scenarios, menu.pw), named after their regressions; not automated here: "Reado dropdown" (Reado's port), "Thumb resting on the trigger while scrolling" and "Exit animation" (real touch scroll and CSS animations, backlog), the menubar scenarios (add-menubar), "Chromium accessibility tree" (the generic name-sources invariant covers the inert trigger).
- [x] 5.2 Pointer-path browser tests for submenus: diagonal path, flick into a flipped submenu, rest in the grace area, fast sweep over five triggers (Chromium, Firefox, WebKit)
- [x] 5.3 `testMachine`: props classes modal, non-modal, `loop: false`, submenu level; all modalities incl. `virtual`; RTL run; all invariants incl. CDP "name sources reachable" in Chromium; axe per state The CDP name-sources check runs as the generic invariant in Chromium.
- [x] 5.4 Virtual screen reader reading-order test (trigger name, menu name, items, checked states)

## 6. Theme (`packages/theme/src/menu.css`)

- [x] 6.1 Tier-3 tokens `--rind-menu-*` (design §9) defaulting to semantic tokens; content surface, item states via `data-highlighted` / `data-disabled` / `data-state`, indicators, separator, group label; `@starting-style` entry and `[data-state=closed]` exit with duration tokens
- [x] 6.2 Forced colors: highlight as outline + `Highlight`/`HighlightText`, check glyph in `currentColor`, separator visible; Playwright forced-colors captures Forced-colors capture in the Playwright fixture.

## 7. Site examples

- [x] 7.1 Site examples (apps/site/examples/menu.tsx, state examples for every contract state): Default, checkbox and radio items, groups and separators, links (incl. client router), submenus (3 levels, flipped), disabled items, non-modal pair, menu in a dialog, dialog from an item, long scrolling menu, RTL; state examples open / submenu open — the site examples belong to the docs session (asked to add Menu).
- [x] 7.2 Driver example (docs testing example); all examples pass axe — axe runs on every state in the model test.

## 8. Docs and manual checks

- [x] 8.1 Docs page (generated API facts + guide: opening by modality, checkbox/radio closing, links, submenus, modal vs non-modal, dialogs from items, Reado/Ark migration, testing with `getMenu`/`testMachine`)
- [x] 8.2 Manual tier-1 pass: VO+Safari (macOS/iOS: submenu announcement with the quirk, swipe past the last submenu item), NVDA+Firefox browse-mode open, JAWS+Chrome, TalkBack submenu close; record in "Tested with" Deferred: manual AT pass (docs/review-backlog.md "Manual AT protocol").
- [x] 8.3 Set Menu to `wip`/`done` in `docs/components.md` as it progresses; archive the change when approved Set to `wip`; `done` and the archive follow the approval.
- [x] 8.4 `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green; changeset for core, react, testing, theme Targeted runs per the workflow (lint, typecheck, docs and node in the pre-push hook; jsdom, Chromium, Firefox, WebKit for the menu suites); CI runs the rest.

## Amendments (from add-separator)

- [x] A.1 `separator` part via add-separator's `separatorProps({ context: "menu", scope: "menu", defaultOrientation })` (perpendicular to the menu orientation, explicit `orientation` wins); unit tests for vertical and horizontal menus

## Amendments (from add-menubar)

- [x] A.2 `MenuTree`: `parentElements()`, `parentNavigate({ from, direction })`, `parentPress(key, press)` for parent kind `menubar`; root level's layer `elements()` includes the menubar root; `node` tests
- [x] A.3 Forward an unconsumed `EXPAND` (non-submenu item) and a top-level `COLLAPSE` to `parentNavigate` when the parent kind is `menubar` (logical keys, RTL run); submenu levels unchanged
- [x] A.4 Trigger menubar mode: `role="menuitem"`, roving `tabIndex` from the bar, press delegated through `parentPress`, React default element `div`; connect and React tests
- [x] A.5 Skip focus restore on a close by `TREE.SIBLING_OPENED`; browser test that the old trigger is never focused while switching menus

## Amendments (from add-label)

- [x] A.6 Root trigger declares the press option `labelActivation: "focus"`: a label-forwarded click focuses the trigger and never opens the menu; tests for "Label click focuses the trigger and does not open it" (headlessui#3787) and the wrapping-label case (radix#3679)

## Amendments (from add-link)

- [x] A.7 Link items built with add-link's `linkProps` (`link-navigation`): modifier/middle-click, router and disabled rules identical to Link; close the tree only on `onActivate({ disposition: "same-tab" })`; Space handling stays in the menu; test for the "Plain anchor link item uses the environment router" scenario
