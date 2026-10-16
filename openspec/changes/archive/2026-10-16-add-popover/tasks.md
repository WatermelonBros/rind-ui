## 0. Prerequisites

- [x] 0.1 Confirm `add-foundations`, `add-a11y-foundations`, `add-overlay-infrastructure` and `add-floating-positioning` are applied; this change uses their APIs unchanged

## 1. `non-modal-tab-order` (`core/dom/non-modal-tab-order.ts`)

- [x] 1.1 `trackNonModalTabOrder(env, { trigger, content, layer })`: trigger and content `keydown` handlers (Tab / Shift+Tab, skip `defaultPrevented`, other modifiers and composing events), moves through `focusSafely`
- [x] 1.2 "First tabbable after the trigger" over the trigger's root using the focus-containment sequential-order helper, excluding `layer.contains()` nodes; no-op when nothing follows
- [x] 1.3 Browser tests for every `non-modal-tab-order` scenario (portalled vs inline, nested layers, nothing after the trigger without recursion, inner widget handling Tab, shadow root, modal layer untouched)

## 2. Machine (`core/components/popover/popover.machine.ts`)

- [x] 2.1 Event and close-reason types; controllable `open` bound to `closed`/`open`; `TRIGGER.PRESS`, `OPEN`, `CLOSE`, `POSITION.*`, `PARTS.CHANGED`; `disabled` prop closes with `"api"`
- [x] 2.2 Effects: `overlay` (layer kind `popover`, modal from props, `isInside` = trigger + anchor + persistent elements, consumer vetoes before `CLOSE`), `trackPosition` (`popup` preset, `sideOffset` 8), `nonModalTabOrder` (no-op when modal), `warnModalWithoutClose` (development only)
- [x] 2.3 `focusInitial` on the first `POSITION.PLACED`; touch → content; `initialFocus`/`finalFocus` props
- [x] 2.4 Node tests of every transition with `fakePositioning()` and a recording environment, including controlled proposals, `cancel()` and `$reverted`

## 3. Connect (`popover.connect.ts`)

- [x] 3.1 Trigger: press handlers, `aria-haspopup`, `aria-expanded`, `aria-controls` only while content mounted, `data-state`, focus/press attributes, `anchorProps` unless an Anchor is rendered
- [x] 3.2 Content: `role="dialog"`, `tabindex=-1`, `aria-modal`/`data-modal`, labelling precedence (Title → consumer → non-modal trigger), description merge, `data-close-reason`, layer metadata, placement attributes; dev error for an unnamed modal popover
- [x] 3.3 Positioner/Arrow via `positionerProps`/`arrowProps`; Indicator and Arrow `aria-hidden`; CloseTrigger name from `messages.close` when empty
- [x] 3.4 `messages` object with English defaults (`close`)

## 4. Parts (`@rind-ui/react`)

- [x] 4.1 `Popover.Root` (machine binding, `LayerProvider`), `Trigger`, `Anchor`, `Indicator`, `Positioner`, `Content`, `Arrow`, `Title`, `Description`, `CloseTrigger`; shared `Portal`; `render` prop on every part
- [x] 4.2 Presence for positioner, content and arrow via `usePresence`; `keepMounted`, `onExitComplete`; parts report mount/unmount (`PARTS.CHANGED`)
- [x] 4.3 Tests: Strict Mode, SSR with `defaultOpen` (no hydration mismatch, opens after hydration), element substitution of the trigger (`div` gets button semantics)

## 5. Contract and driver

- [x] 5.1 `popover.contract.ts`: anatomy, locate by trigger role + name, actions with pointer/keyboard implementations and postconditions, queries incl. `positioningQueries`, states, event map, traits (`modal` from props)
- [x] 5.2 `getPopover` driver export in `@rind-ui/testing`; same driver test passes in the browser project, the jsdom project (with `@rind-ui/testing/setup`) and through the Playwright adapter — browser and jsdom projects done; the Playwright run moves to retire-storybook (task 1.6: site examples, section 2 Playwright fixtures)

## 6. Tests

- [x] 6.1 Model-based: `testMachine(popoverContract)` for `modal` false and true, pointer/keyboard/virtual modalities, browser and jsdom projects (jsdom reports unexercised inert/layout)
- [x] 6.2 Browser tests for every `popover` spec scenario, each regression scenario reproducing the cited issue first (radix#4128, headlessui#3231, mui/base-ui#5715, reka-ui#2803, zag#1746/#1747/#1788, radix#2942, ark#3492, bits-ui#1213, zag#2241, bits-ui#1016, headlessui#2713, ark#2610, zag#2933, headlessui#3332, react-spectrum#10662, react-spectrum#9467, ark#4182, reka-ui#2597, mui/base-ui#4520)
- [x] 6.3 Nested fixtures: popover in dialog, dialog in popover, popover in popover, select in popover, sibling popovers; DOM-clean invariant under Strict Mode
- [x] 6.4 Partial ARIA snapshots per state story (closed, open non-modal, open modal, nested) in the three engines — moved to retire-storybook (ARIA snapshots keyed by site example)

## 7. Theme, stories, docs
- [x] 7.1 `packages/theme/src/popover.css` (decision 0007, proposed): tier-3 component tokens `--rind-popover-*` (bg, border, radius, shadow, padding, arrow size) defaulting to semantic tokens; styles read only tier 3 and select on `data-*`; `max-height: min(…, var(--rind-available-height))`, transform origin, `@starting-style` entry and `[data-state=closed]` exit, `[data-modal]` variant, forced-colors border, reduced motion; imported from `index.css`
- [x] 7.2 Storybook stories (axe on): default, modal, with title/description, custom anchor, arrow, nested, in a dialog, sibling popovers, long content at 320 px, RTL, exit animation, driver usage; state stories for every contract state — moved to retire-storybook (task 1.6: site examples)
- [x] 7.3 Docs page (generated API facts + guide): modal vs non-modal, Tab order, naming, focus rules, toggletip recipe, testing with the driver, known AT notes; manual tier-1 check for iOS VoiceOver swipe order added to the release protocol — manual tier-1 iOS VoiceOver check added to docs/accessibility/manual-protocol.md
- [x] 7.4 Mark `docs/research/popover.md` done on archive; changeset for `@rind-ui/core`, `@rind-ui/react`, `@rind-ui/testing`, `@rind-ui/theme`; `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green — research note marked done on archive

## Amendments (from add-heading)

- [x] A.1 `Title` renders `h{level}` (`level` ?? 2) with attributes from add-heading's `headingProps`; `Content` wraps its children in `Heading.Level` at title level + 1; tests for the "Title Heading Level" scenarios
- [x] A.2 `popover` connect `scope` option (default `"popover"`) applied to every part prop's `data-scope`; document that `open` may be controlled by a parent coordinator; tests for the "Composite re-scopes the data attributes" and "Coordinator owns the state" scenarios
