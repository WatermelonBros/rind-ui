## 1. Machine

- [ ] 1.1 `collapsible.machine.ts`: states `closed`/`open`, controllable `open`, events `TOGGLE`/`OPEN`/`CLOSE` with modality and reason, guards `notDisabled`/`isApi`, context `reveal`, exit action moving focus out of content
- [ ] 1.2 `node` tests: every transition, both `disabled` configurations, controlled proposal/refusal, `reveal` context for mount, find-in-page and clearing

## 2. Shared DOM module

- [ ] 2.1 `core/dom/content-size.ts`: `opened`/`closed`/`settled`/`dispose` with the 0px → px → auto → px → 0px sequence, scroll-size measurement with alignment neutralised, instant path, configurable prefix
- [ ] 2.2 Browser-mode tests: nested zero-size content (radix#3037), flex and grid (radix#2832, base-ui#2767), content growth after settle (base-ui#1458)

## 3. Connect

- [ ] 3.1 `collapsible.connect.ts`: `aria-expanded`, `aria-controls` only while content is mounted, native/ARIA disabled, press handlers, no role and no `aria-hidden` on content, hide-mode attribute with disabled degradation, every `data-*` in the spec
- [ ] 3.2 Unit tests for each attribute row in "Styling Attributes" and "Disclosure Semantics"

## 4. Parts (React)

- [ ] 4.1 `Root`, `Trigger`, `Content`, `Indicator` in `packages/react/src/collapsible/`, each with `render`; `closedContent` prop on `Root`
- [ ] 4.2 `Content` bindings: `usePresence`, `useContentSize`, `useUntilFound` (reveal → `OPEN { reason: "find-in-page" }` + instant size), unmount in `unmount` mode, dev warning for `display: none` on `until-found` content
- [ ] 4.3 SSR + hydration test: default-open and closed `until-found` markup, zero hydration warnings

## 5. Contract and driver

- [ ] 5.1 `collapsible.contract.ts`: anatomy, locate by trigger name, actions `open`/`close`/`toggle` (pointer + keyboard + postconditions), queries `isOpen`/`isDisabled`/`contentText`/`hiddenMode`, traits `disclosure`/`presence`, find-in-page `OPEN` marked not drivable
- [ ] 5.2 Per-contract invariants: no `aria-hidden` on content, `aria-controls` iff content in document, size properties defined
- [ ] 5.3 `getCollapsible` export from `@rind-ui/testing`; driver test passing unchanged in the `browser`, `jsdom` and Playwright runs

## 6. Model-based and regression tests

- [ ] 6.1 `testMachine` over the collapsible: all transitions × pointer/keyboard/virtual × `disabled` × three `closedContent` modes
- [ ] 6.2 Browser-mode regressions in Chromium, Firefox and WebKit: first open in `unmount` mode (radix#1265), initially open with no transition or CLS (zag#1396, radix#2891), reorder (zag#2138, reka-ui#920), `<Activity>` (radix#3778), exit alongside another open (base-ui#3099), no unmount flash (radix#1074), reduced motion
- [ ] 6.3 Find-in-page: `beforematch` opens (never toggles), reveal at full size in the same task (base-ui#5513), controlled refusal restores `until-found`, disabled content not findable, Chromium `window.find()` end to end
- [ ] 6.4 Focus on close from inside content; bare-click single toggle (kobalte#119); form submission with closed content (radix#2808); externally controlled close without animation (base-ui#4553)

## 7. Theme, stories, docs
- [ ] 7.1 `packages/theme/src/collapsible.css`: height transition on the size variable, `[data-reveal]` skips transitions, indicator rotation with RTL mirror, no `[hidden]` override; imported from `index.css`
- [ ] 7.2 Stories: default, initially open, disabled, each `closedContent` mode, controlled, nested, list reorder, find-in-page, driver usage; a `states` export covering every contract state; axe clean
- [ ] 7.3 Docs page (generated API facts + hand-written notes: transitions vs keyframes, focus rings with `overflow: hidden`, CSS resets that break `until-found`, driver example)
- [ ] 7.4 Mark Collapsible `done` in `docs/components.md`; `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green

## Amendments (from add-navigation-menu)

- [ ] A.1 `content-size.ts`: `switched()` entry point (current rendered size → measure committed incoming content → flush → new px → `auto` on `settled()`; a second `switched()` before `settled()` starts from the rendered size); `opened`/`closed`/`settled` unchanged; test for the "Switching panels animates between their sizes" scenario (mui/base-ui#4619)
