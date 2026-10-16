## 0. Prerequisites

- [ ] 0.1 Confirm `add-foundations`, `add-a11y-foundations`, `add-overlay-infrastructure`, `add-floating-positioning`, `add-tooltip` (`hover-intent`, `focusWithTab`, `timed`) and add-a11y-foundations A.1 (focus cause) and `add-popover` (`non-modal-tab-order`) are applied

## 1. Machine (`core/components/hover-card/hover-card.machine.ts`)

- [ ] 1.1 States `closed | opening | open | closing`; events per design §1; controllable `open`; `after` delays `openDelay` (700), `closeDelay` (300); `disabled` prop step
- [ ] 1.2 Guards `keyboardIntent`, `canClose` (focus inside, keyboard-focused trigger, open child layer); context for focus and pointer state
- [ ] 1.3 Effects in `open | closing`: overlay layer (kind `popover`, no initial focus, Escape + outside press + outside focus), `hoverIntent.track`, `nonModalTabOrder`, `trackPosition` (`popup`, `sideOffset` 8)
- [ ] 1.4 Node tests of every transition with `fakeHoverIntent`, `fakePositioning` and fake timers

## 2. Connect (`hover-card.connect.ts`)

- [ ] 2.1 Trigger: `hoverIntent.triggerProps()`, focus/blur with cause, `aria-haspopup="dialog"`, `aria-expanded`, `aria-controls` while mounted, `data-state`, hover/focus attributes; never `preventDefault` on touch
- [ ] 2.2 Content: `role="dialog"`, `tabindex=-1`, name precedence (consumer → trigger), focus-within events, layer metadata, placement attributes; Positioner/Arrow via positioning helpers
- [ ] 2.3 Development warning for a trigger without `href`

## 3. Parts (`@rind-ui/react`)

- [ ] 3.1 `HoverCard.Root`, `Trigger`, `Positioner`, `Content`, `Arrow`; shared `Portal`; `render` prop on every part
- [ ] 3.2 Presence for positioner, content, arrow; `keepMounted` registers nothing; SSR + hydrate test

## 4. Contract and driver

- [ ] 4.1 `hover-card.contract.ts` per design §2 (locate by link + name, actions with pointer/keyboard twins and touch `none`, `{ skip }` events, `$sync`/`$props` prop steps, traits incl. `timed`)
- [ ] 4.2 `getHoverCard` driver; same test in browser, jsdom (fake timers) and Playwright

## 5. Tests

- [ ] 5.1 Model-based `testMachine(hoverCardContract)` in pointer, keyboard and virtual modalities with `no-touch-hover`, `focus-does-not-commit` (no exceptions), `layer`, `restores-focus`, `presence`, `anchored`, `timed`
- [ ] 5.2 Browser tests for every `hover-card` scenario, each regression reproducing the cited issue first (radix#2138, reka-ui#802, radix#2692, zag#3224, radix#2502, radix#3175, react-spectrum#10443, mui/base-ui#3129, mui/base-ui#3673, zag#3181, reka-ui#1063, radix#920, bits-ui#1697)
- [ ] 5.3 Fixtures: card with a Select, a Menu, a Tooltip, a nested card; card inside a dialog; list of preview links for the "tabbing quickly" scenario
- [ ] 5.4 Partial ARIA snapshots per state example (closed, open, focus inside) in three engines

## 6. Theme, site examples, docs
- [ ] 6.1 `packages/theme/src/hover-card.css` (decision 0007, proposed): tier-3 tokens `--rind-hover-card-*` (bg, border, radius, shadow, padding, width, arrow size) defaulting to semantic tokens; styles read only tier 3, select on `data-*`; `@starting-style` entry, `[data-state=closed]` exit, forced colors, reduced motion
- [ ] 6.2 Site examples (apps/site/examples/hover-card.tsx, state examples for every contract state): profile card, link preview list, card with actions, nested, in a dialog, RTL, 320 px, driver usage; state examples for every contract state
- [ ] 6.3 Docs page (generated API facts + guide): the usage rule (never the only path), keyboard access, why no touch, Popover vs Hover Card vs Tooltip, testing with fake timers
- [ ] 6.4 Mark `docs/research/hover-card.md` done on archive; changeset; `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green

