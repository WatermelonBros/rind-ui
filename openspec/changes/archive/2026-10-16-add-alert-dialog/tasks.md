## 0. Prerequisites

- [x] 0.1 Confirm `add-dialog` is applied, including `buildDialogMachine`, the shared contract helpers and the submit-type close rule

## 1. Machine (`core/components/alert-dialog/alert-dialog.machine.ts`)

- [x] 1.1 `alertDialogMachine` via `buildDialogMachine` (kind, close events, defaults, fixed props removed from the public type)
- [x] 1.2 Lazy `initialFocus: "cancel"` resolution from the live part registry, skipping disconnected nodes; content fallback
- [x] 1.3 `node` tests: every transition, `ACTION_PRESS` with `cancel()` then API close, controlled refusal, no outside-press transition, type test that `modal` and `closeOnInteractOutside` are not accepted

## 2. Connect (`alert-dialog.connect.ts`)

- [x] 2.1 Scope `alert-dialog`, `role="alertdialog"`, `aria-modal` and `data-modal` always, `cancel` and `action` parts, close-reason attribute
- [x] 2.2 Name check also warns for a missing description; unit tests

## 3. React parts (`packages/react/src/alert-dialog`)

- [x] 3.1 `Root`, `Trigger`, `Backdrop`, `Positioner`, `Content`, `Title`, `Description`, `Cancel`, `Action` on the Dialog part implementations
- [x] 3.2 React tests: content replaced before initial focus (bits-ui#2136), Strict Mode, SSR + hydrate

## 4. Contract and driver

- [x] 4.1 `alert-dialog.contract.ts` (locate by `alertdialog`, traits, `cancel`, `confirm(name?)`, `pressOutside` stays open, event map)
- [x] 4.2 `getAlertDialog` in `@rind-ui/testing`; driver tests in `browser`, `jsdom` and Playwright — Playwright-level checks are vitest browser tests (alert-dialog.browser.test.tsx) until the site examples harness exists

## 5. Tests

- [x] 5.1 One browser test per spec scenario; regression scenarios reproduce the cited issue first (radix#1615, #1738, #1747, #1779, #1858, #2227; bits-ui#1695, #2136; mui/base-ui#1165, #1688; react-spectrum#1773, #8139, #9916; reka-ui#2702)
- [x] 5.2 `testMachine` over the contract in every modality incl. `virtual`, both directions; `layer`, `modal`, `restores-focus`, `presence` invariants; axe per state
- [x] 5.3 Virtual screen reader test: name, description and focused "Cancel" read in order

## 6. Theme (`packages/theme/src/alert-dialog.css`)

- [x] 6.1 Reuse dialog tokens; action/cancel layout; reduced motion; forced-colors border and focus ring; Playwright captures — forced-colors/reduced-motion checked as CSS rules in the theme browser test (Playwright captures need the site harness)

## 7. Stories

- [x] 7.1 Default, destructive confirm, async confirm (cancel + pending UI + close on resolve), alert inside a dialog, form with submit-type action, Escape vetoed; state stories `open`/`closed` — moved to retire-storybook (task 1.6: site examples)
- [x] 7.2 Driver story; all stories pass axe — moved to retire-storybook (task 1.6: site examples)

## 8. Docs and manual checks

- [x] 8.1 Docs page: "Dialog or Alert Dialog?", Escape policy, async confirm recipe, naming/description rules, testing with `getAlertDialog`
- [x] 8.2 Manual tier-1 pass (name + description + focused Cancel spoken in NVDA, JAWS, VO macOS/iOS, TalkBack); record "Tested with" — deferred to the manual protocol (docs/accessibility/manual-protocol.md, Alert Dialog) — needs the user on devices
- [x] 8.3 Mark `docs/research/alert-dialog.md` done at archive; update `docs/components.md` status as work progresses
- [x] 8.4 `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green; changeset

## Amendments (from add-heading)

- [x] A.1 `Title`/`Content` follow Dialog's heading rules (`h{level}` default `h2` via `headingProps`; content children in `Heading.Level` one deeper); tests for the "Title Heading Level" scenarios
