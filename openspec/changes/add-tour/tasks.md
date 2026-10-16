## 0. Prerequisites

- [ ] 0.1 Confirm `add-foundations`, `add-a11y-foundations`, `add-overlay-infrastructure`, `add-floating-positioning`, `add-dialog` and `add-heading` are applied, and `add-popover` (`non-modal-tab-order`) is applied; this change uses their APIs unchanged
- [ ] 0.2 Land the requests in design.md first or agree the fallbacks: layer kind `"tour"` (overlay infrastructure), `anchorRect` in the placed report (floating positioning), non-focusable `trigger` in `non-modal-tab-order` (popover)

## 1. Pure and DOM helpers (`core/components/tour`, `core/dom`)

- [ ] 1.1 `spotlight-path.ts`: `cutoutsFor` and `spotlightPath` (padding, viewport clamp, radius clamp, merged overlapping cutouts, no cutout for a centred step); node tests for every "Spotlight And Backdrop" geometry scenario (target 100 × 40, card inside target, bigger than viewport, tiny target, zero area)
- [ ] 1.2 `core/dom/wait-for-element.ts`: `isRendered` (connected, `checkVisibility`, non-empty box), `waitForElement(resolver, { root, signal, timeout })` with a first synchronous attempt and a coalesced `MutationObserver` on the document or shadow root, `waitForEvent(target, type, { predicate, signal })` that never hangs on an absent element; browser tests for late, hidden, replaced and removed targets and for abort
- [ ] 1.3 `core/dom/step-effect.ts`: the `StepVisit` (abort controller, exactly-once cleanup slot that also accepts a promise of a cleanup, `show`/`update`/`next`/`goto`/`dismiss`, hand-off flag); node tests for every exit path (next, back, goto, skip, dismiss, dismiss from inside the effect, stop, steps removed, late cleanup, throwing effect)

## 2. Machine (`core/components/tour/tour.machine.ts`)

- [ ] 2.1 Event and reason types; states `idle`, `preparing`, `active`, `waiting`; controllable `open` bound to the states and controllable `stepId`; `onProps: { steps }`; validation of duplicate ids; `start({ stepId })`, `stop()`
- [ ] 2.2 Flow: next / prev (Back skips wait steps; Back at first does nothing; Next on last completes; both ignored while `preparing`), `goto`, missing-target policies (`skip` with direction, `stop`, `center`), `onMissingTarget`, `steps-changed`, `TARGET.LOST` re-entry, step `timeout` and `prepareTimeout` on the scheduler
- [ ] 2.3 Effects: `visit` (target wait + step effect + timeout, hand-off), `overlay` (layer kind `tour`, per-step `modal`, `isInside` = target + persistent elements, vetoes before `DISMISS`, `finalFocus` that returns `false` for internal step re-entries), `trackPosition` (virtual padded anchor, `sticky`, tracking, centred steps), `watchTarget`, `stepKeys`, `nonModalTabOrder`, `recoverFocus`, `announceStep`, `scrollIntoView` (step option, reduced motion)
- [ ] 2.4 Node tests of every transition with `fakePositioning()`, a fake scheduler and a recording environment, including controlled proposals, `cancel()`, `$reverted`, Strict-Mode `stop()`/`start()`, and the Reado effect pattern (async reveal, `update`, late cleanup)

## 3. Connect (`tour.connect.ts`)

- [ ] 3.1 Trigger (press, `aria-haspopup`, `aria-expanded`, `aria-controls` while content is mounted), Backdrop (`aria-hidden`, `data-phase`, inline `clip-path`, `--layer-index`), Spotlight (variables, `data-shield`, pointer events), Positioner/Arrow via `positionerProps`/`arrowProps`
- [ ] 3.2 Content (`role="dialog"`, `tabindex=-1`, `aria-modal` only when modal, labelling precedence Title → consumer → `stepLabel`, description, `data-*` of the Data Attributes requirement, `--rind-tour-progress`), Title heading attributes through `headingProps`
- [ ] 3.3 ActionTrigger (`type="button"`, name from children else `messages`, `aria-disabled` for Back at the first step, `data-action`), CloseTrigger, ProgressText, `Actions` data
- [ ] 3.4 `messages` object with English defaults; `data-rind-tour-target` mark and exact restore

## 4. Parts (`@rind-ui/react`)

- [ ] 4.1 `useTour`, `Tour.Root` (accepts `tour` or props, `LayerProvider`), `Trigger`, `Backdrop`, `Spotlight`, `Positioner`, `Content`, `Arrow`, `Title`, `Description`, `ProgressText`, `Actions`, `ActionTrigger`, `CloseTrigger`; shared `Portal`; `render` prop on every part
- [ ] 4.2 Presence for backdrop (tour lifetime), spotlight, positioner, content and arrow (shown-step lifetime), `onExitComplete`; parts report mount/unmount (`PARTS.CHANGED`)
- [ ] 4.3 Tests: Strict Mode (one layer, one `onStepChange`, nothing left behind), SSR with `defaultOpen` (no hydration mismatch, starts after hydration), element substitution of the trigger and of Title, two tours on one page, the "form submit" scenario

## 5. Contract and driver

- [ ] 5.1 `tour.contract.ts`: anatomy, locate by trigger role + name, actions with pointer / touch / keyboard / virtual implementations and postconditions, queries incl. `positioningQueries`, states, event map, traits (`modal` from props), announcement declaration
- [ ] 5.2 `getTour` driver export in `@rind-ui/testing`; the same driver test passes in the browser project, the jsdom project (with `@rind-ui/testing/setup`) and through the Playwright adapter

## 6. Tests

- [ ] 6.1 Model-based: `testMachine(tourContract)` with the five-step fixture (centred, anchored, anchored async effect, wait, anchored last) for `modal` false and true, pointer / keyboard / virtual modalities, browser and jsdom projects
- [ ] 6.2 Browser tests for every `tour` scenario, each regression scenario reproducing the cited issue first (zag#2462, #3046, #2901, #3222, #3268, PR #3340/#3341, changelog 1.43.0/1.46.0, ark#3910/#4049/#4162, shepherd#1368/#2117/#3202/#1076/#580/#444/#968/#2351/#473, driver#616/#580/#109/#368, joyride#914/#1158/#585/#1083, intro#849/#2035/#779/#2073)
- [ ] 6.3 Nested fixtures: a dialog opened from the target (Escape order), a tour step over a popover, two tours, a tour in a `form`; DOM-clean invariant (marks, inert, scroll lock, listeners, timers, observers) under Strict Mode and after every close reason
- [ ] 6.4 Partial ARIA snapshots per state example (idle, preparing, shown anchored non-modal, shown centred modal, waiting, last step) in the three engines; axe on each
- [ ] 6.5 Scheduling check: no `requestAnimationFrame` / timer callback of the tour after the last placement ("No polling loop")

## 7. Theme, site examples, docs

- [ ] 7.1 `packages/theme/src/tour.css` (decision 0007): tier-3 tokens `--rind-tour-*` (backdrop colour, content bg / border / radius / shadow / padding / max-width, spotlight ring colour / width, arrow size) defaulting to semantic tokens; shared `data-variant` (`soft`, `outline`) and `data-size` support on the content; styles read only tier 3 and select on `data-*`; backdrop `pointer-events` and stacking from `--layer-index`; spotlight transition only between steps; `@starting-style` entry and `[data-state=closed]` exit; forced-colors (no scrim, ring and border in `CanvasText` / `Highlight`); reduced motion; `max-height: min(…, var(--rind-available-height))`; imported from `index.css`
- [ ] 7.2 Site examples (apps/site examples harness, see openspec/changes/retire-storybook): default three-step tour, centred welcome + anchored steps, async step effect (open a panel, wait, then show), wait step, missing target policies, `sticky` card over a target that fills the viewport, `spotlight.content`, `preventTargetInteraction`, nested scroll container, RTL, 320 px, reduced motion, controlled `open` / `stepId`, a tour in a form, driver usage; state examples for every contract state (`idle`, `preparing`, `active`, `waiting`)
- [ ] 7.3 Docs page (generated API facts + guide): step anatomy, the visit and effects, modality per step, focus and announcements, keyboard, scroll offsets (`scroll-margin` / `scroll-padding`), wait-for-input recipe (enable Next, do not auto-advance), persistence and resume recipe, migration table from Ark's Tour, testing with the driver, known AT notes; manual tier-1 check (VoiceOver and NVDA, three-step tour, pinch-zoom on a device) added to the release protocol
- [ ] 7.4 Mark `docs/research/tour.md` done on archive; changeset for `@rind-ui/core`, `@rind-ui/react`, `@rind-ui/testing`, `@rind-ui/theme`; `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green
