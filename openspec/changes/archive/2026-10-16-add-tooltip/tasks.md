## 0. Prerequisites

- [x] 0.1 Confirm `add-foundations`, `add-a11y-foundations`, `add-overlay-infrastructure` and `add-floating-positioning` are applied; their APIs are used unchanged

## 1. Shared modules

- [x] 1.1 Confirm add-a11y-foundations task A.1 (focus cause on `FOCUS` events) is done; Tooltip reads `FOCUS.cause` and adds no focus-cause code
- [x] 1.2 `core/env/hover-intent.ts` capability types and `core/dom/hover-intent.ts`: per-document singleton (`Symbol.for("rind-ui.hover-intent@1")`), `triggerProps()` (movement-based `HOVER.START`, mouse/pen only, in-transit check), `track()` (zone = trigger + elements + descendant layers + grace polygon from the exit point; open child blocks leave; scroll/resize re-evaluation with the last pointer position; document leave and window blur; composed-path containment), `isInTransit()`; document the API as stable in the module header
- [x] 1.3 `core/env/delay-group.ts` and `core/dom/delay-group.ts`: per-document group (`Symbol.for("rind-ui.delay-group@1")`), `join()` → `isWarm/opened/closed/leave`, one open member with `replace()`, warm window from the closing member's `skipDelay`, `0` = cold at once, scheduler timers
- [x] 1.4 Fakes in `@rind-ui/testing`: `fakeHoverIntent()` (emit enter/leave) and `fakeDelayGroup()`
- [x] 1.5 Node tests for `delay-group` (every scenario: two copies, iframe, replace, warm/cold, close delay independence, skip 0, unmount while open, repeated open) and browser tests for every `hover-intent` scenario (gap, wide content, diagonal crossing, select inside, web component, scroll under a resting pointer, focus scroll, leaving the window, no listeners after close)

## 2. Machine (`core/components/tooltip/tooltip.machine.ts`)

- [x] 2.1 States `closed | opening | open | closing`; events per design §1; controllable `open`; `after` delays `openDelay` (700) and `closeDelay` (300); `disabled` prop step closes with `"disabled"`
- [x] 2.2 Guards `keyboardIntent`, `groupWarm`, `suppressed`, `closeOnPress`, `notDisabled`; context `openedBy`, `keyboardFocused`, `pointerInZone`, `suppressHover`, `instant`
- [x] 2.3 Effects: `delayGroupMembership` (service-scoped), `layer` (kind `tooltip`, Escape + outside press only), `hoverIntent`, `trackPosition` (`popup` preset, side `top`, `sideOffset` 8) in `open | closing` only
- [x] 2.4 Node tests of every transition with `fakeHoverIntent`, `fakeDelayGroup`, `fakePositioning` and fake timers

## 3. Connect (`tooltip.connect.ts`)

- [x] 3.1 Trigger: hover-intent trigger props, focus/blur with `{ modality, cause }`, press start, `aria-describedby` (merged) or `aria-labelledby` once the content reports mounted, `data-state`, hover/focus attributes
- [x] 3.2 Content: `role="tooltip"` (description type), id from `partId`, `hidden` when absent after exit, `data-type`, `data-instant`, placement attributes; Positioner/Arrow via positioning helpers
- [x] 3.3 Development warnings: native `disabled` or non-focusable trigger, tabbable content, name equal to description, `type: "label"` with consumer `aria-label`

## 4. Parts (`@rind-ui/react`)

- [x] 4.1 `Tooltip.Root`, `Trigger`, `Positioner`, `Content`, `Arrow`; shared `Portal`; `render` prop on every part
- [x] 4.2 Always-mounted content with presence in keep-mounted mode; content mount reported to connect; SSR + hydrate test with no dangling IDREF

## 5. Contract and driver

- [x] 5.1 `tooltip.contract.ts`: anatomy, locate by trigger role + name, actions `show`/`hide`/`hoverContent`/`pressTrigger`/`pressEscape` (touch `none` with reason), queries incl. `positioningQueries`, states, events with `{ skip }` and `$sync:open` / `$props:disabled` prop steps, traits `layer`, `anchored`, `timed`, per-contract invariants (closed content hidden and referenced; content never focused)
- [x] 5.2 `part.focusWithTab()` in the DOM and Playwright adapters (keyboard twin of hover)
- [x] 5.3 Implement the `timed` trait invariant in `@rind-ui/testing` (deferred from `add-foundations`): while the oracle reports hovered, focused or `document.hidden`, advancing the scheduler past pending delays must not fire a hide/auto-dismiss transition; readable failure naming the timer; used by `tooltipContract`
- [x] 5.4 `getTooltip` driver; same test in browser, jsdom (fake timers advanced through the adapter) and Playwright — browser and jsdom done; the Playwright run with the site examples (retire-storybook 1.6 / section 2)

## 6. Tests

- [x] 6.1 Model-based `testMachine(tooltipContract)` in pointer, keyboard and virtual modalities with the a11y invariants (`no-touch-hover`, `focus-does-not-commit` without exceptions, name ≠ description) and the `timed` invariant
- [x] 6.2 Browser tests for every `tooltip` scenario, each regression reproducing the cited issue first (radix#2248, ark#2565, react-spectrum#1170, ariakit#750, radix#1800, ark#3378, radix#1944, react-spectrum#10333, react-spectrum#2101, react-spectrum#8915, radix#2598, radix#2988, mui/base-ui#4022, radix#3185, mui/base-ui#4966, bits-ui#2200, radix#3858)
- [x] 6.3 Two-tooltip and toolbar fixtures for delay-group paths; tooltip inside dialog, popover, hover card; checkbox/switch as trigger (mui/base-ui#5305)
- [x] 6.4 Perf test: 200 closed tooltips create no observers, document listeners or timers
- [x] 6.5 Partial ARIA snapshots per state story (closed description, open description, label type) in three engines — moved to retire-storybook (ARIA snapshots keyed by site example)

## 7. Theme, stories, docs
- [x] 7.1 `packages/theme/src/tooltip.css` (decision 0007, proposed): tier-3 tokens `--rind-tooltip-*` (bg, text, radius, padding, font size, max width, arrow size) defaulting to semantic tokens; styles read only tier 3, select on `data-*`; `@starting-style` entry, `[data-state=closed]` exit, `[data-instant]` without animation, no `[hidden]` override, forced colors, reduced motion
- [x] 7.2 Stories (axe on): default, label type, toolbar group, disabled action with `aria-disabled`, in a dialog, on a menu button, RTL, long text at 320 px, instant transitions, driver usage; state stories for every contract state — moved to retire-storybook (task 1.6: site examples)
- [x] 7.3 Docs page (generated API facts + guide): description vs label, keyboard intent, touch and disabled guidance (toggletip = Popover, `focusableWhenDisabled`), group behaviour, hover-intent and delay-group as shared capabilities, testing with fake timers
- [x] 7.4 Mark `docs/research/tooltip.md` done on archive; changeset; `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green

## Amendments

- [x] A.1 hover-intent: placed target rectangle input and optional rest timeout (`hover-intent` → "Placed Target And Rest Timeout"), needed by add-menu submenus; tests for flipped target and rest
