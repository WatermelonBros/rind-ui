## 1. Machine

- [ ] 1.1 `accordion.machine.ts`: controllable `value: string[]` with set equality, branded `ItemKey`, registration, `ITEM.TOGGLE`/`ITEM.OPEN`/`ITEM.CLOSE` with guards `itemEnabled`/`isOpen`/`canCollapse`, `FOCUS.*` gated by `navigationEnabled`, `openKeys` computed with the single-mode warning
- [ ] 1.2 `node` tests: single/multiple × collapsible matrices, lock, disabled, find-in-page open in single mode, controlled refusal, controlled → `undefined` warning (radix#2296)

## 2. Connect

- [ ] 2.1 `accordion.connect.ts` layered on Collapsible's connect: header element/role/level, trigger lock (`aria-disabled` + `data-disabled`), region rule with closed panels role-free, `data-orientation`, `rind-accordion` size prefix
- [ ] 2.2 Optional navigation handler: logical keys with `dir`/`orientation`, acts only on trigger targets, no `stopPropagation`, wraps, skips disabled (not locked) triggers
- [ ] 2.3 Unit tests for every attribute row and the region rule (≤ 6 items, single mode, `contentRole` override, consumer trigger id)

## 3. Parts (React)

- [ ] 3.1 `Root`, `Item`, `Header`, `Trigger`, `Content`, `Indicator` in `packages/react/src/accordion/` with `render`; `Item` registers and runs a controlled collapsible service
- [ ] 3.2 Dev warning for extra element children in a header; `headingLevel`, `closedContent` (root + per item), `contentRole`, `keyboardNavigation`, `orientation` props
- [ ] 3.3 SSR + hydration test with `defaultValue` (kobalte#226, reka-ui#978)

## 4. Contract and driver

- [ ] 4.1 `accordion.contract.ts`: locate by any trigger name, `expand`/`collapse`/`toggle` (pointer + keyboard), `focusNext/Prev/First/Last` (keyboard only, stated reason), queries, traits `disclosure` (per pair) / `presence` / `directional`, argument classes
- [ ] 4.2 Per-contract invariants: single ≤ 1 expanded, `aria-expanded` ⇔ value, lock `aria-disabled`, trigger is the heading's only element child, region rule, arrows inert without navigation
- [ ] 4.3 If the foundations `disclosure` invariant checks a single trigger only, extend it to every `aria-controls` pair (in `@rind-ui/testing`, with a test)
- [ ] 4.4 `getAccordion` export; driver test unchanged in `browser`, `jsdom` and Playwright runs

## 5. Model-based and regression tests

- [ ] 5.1 `testMachine`: `multiple` × `collapsible` × `keyboardNavigation`, pointer/keyboard/virtual, LTR and RTL
- [ ] 5.2 Browser regressions: switching animates both items (base-ui#3099), input focuses on first click (kobalte#440, react-spectrum#2801), arrows/Home/Space in panel inputs (reka-ui#1504, base-ui#2320), no typeahead (react-spectrum#5745), navigation after unmount (ark#3732), closing in multiple mode reports change (ark#1656), runtime `disabled` change (bits-ui#654), find-in-page in a closed item

## 6. Theme, stories, docs
- [ ] 6.1 `packages/theme/src/accordion.css`: reuse collapsible transitions on `--rind-accordion-*`, borders as separators, dim only disabled items, indicator rotation; imported from `index.css`
- [ ] 6.2 Stories: single, multiple, non-collapsible, disabled item, heading levels, horizontal + `keyboardNavigation` (LTR/RTL), FAQ with find-in-page, nested, driver usage; `states` export per contract state; axe clean
- [ ] 6.3 Docs page (generated API facts + notes: APG 2026 keyboard change, heading level, region rule, `collapsible` default vs Ark/Radix, driver example)
- [ ] 6.4 Mark Accordion `done` in `docs/components.md`; `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green

## Amendments (from add-heading)

- [ ] A.1 Header default level from the nearest `Heading.Level` context (else `h3`), `headingLevel` still overrides; header attributes from add-heading's `headingProps`; each item's Content children wrapped in a `Heading.Level` one deeper; tests for the "Header level from the heading context" and "Heading inside a panel is one level deeper" scenarios
