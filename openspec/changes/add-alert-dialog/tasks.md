## 0. Prerequisites

- [ ] 0.1 Confirm `add-dialog` is applied, including `buildDialogMachine`, the shared contract helpers and the submit-type close rule

## 1. Machine (`core/components/alert-dialog/alert-dialog.machine.ts`)

- [ ] 1.1 `alertDialogMachine` via `buildDialogMachine` (kind, close events, defaults, fixed props removed from the public type)
- [ ] 1.2 Lazy `initialFocus: "cancel"` resolution from the live part registry, skipping disconnected nodes; content fallback
- [ ] 1.3 `node` tests: every transition, `ACTION_PRESS` with `cancel()` then API close, controlled refusal, no outside-press transition, type test that `modal` and `closeOnInteractOutside` are not accepted

## 2. Connect (`alert-dialog.connect.ts`)

- [ ] 2.1 Scope `alert-dialog`, `role="alertdialog"`, `aria-modal` and `data-modal` always, `cancel` and `action` parts, close-reason attribute
- [ ] 2.2 Name check also warns for a missing description; unit tests

## 3. React parts (`packages/react/src/alert-dialog`)

- [ ] 3.1 `Root`, `Trigger`, `Backdrop`, `Positioner`, `Content`, `Title`, `Description`, `Cancel`, `Action` on the Dialog part implementations
- [ ] 3.2 React tests: content replaced before initial focus (bits-ui#2136), Strict Mode, SSR + hydrate

## 4. Contract and driver

- [ ] 4.1 `alert-dialog.contract.ts` (locate by `alertdialog`, traits, `cancel`, `confirm(name?)`, `pressOutside` stays open, event map)
- [ ] 4.2 `getAlertDialog` in `@rind-ui/testing`; driver tests in `browser`, `jsdom` and Playwright

## 5. Tests

- [ ] 5.1 One browser test per spec scenario; regression scenarios reproduce the cited issue first (radix#1615, #1738, #1747, #1779, #1858, #2227; bits-ui#1695, #2136; mui/base-ui#1165, #1688; react-spectrum#1773, #8139, #9916; reka-ui#2702)
- [ ] 5.2 `testMachine` over the contract in every modality incl. `virtual`, both directions; `layer`, `modal`, `restores-focus`, `presence` invariants; axe per state
- [ ] 5.3 Virtual screen reader test: name, description and focused "Cancel" read in order

## 6. Theme (`packages/theme/src/alert-dialog.css`)

- [ ] 6.1 Reuse dialog tokens; action/cancel layout; reduced motion; forced-colors border and focus ring; Playwright captures

## 7. Stories

- [ ] 7.1 Default, destructive confirm, async confirm (cancel + pending UI + close on resolve), alert inside a dialog, form with submit-type action, Escape vetoed; state stories `open`/`closed`
- [ ] 7.2 Driver story; all stories pass axe

## 8. Docs and manual checks

- [ ] 8.1 Docs page: "Dialog or Alert Dialog?", Escape policy, async confirm recipe, naming/description rules, testing with `getAlertDialog`
- [ ] 8.2 Manual tier-1 pass (name + description + focused Cancel spoken in NVDA, JAWS, VO macOS/iOS, TalkBack); record "Tested with"
- [ ] 8.3 Mark `docs/research/alert-dialog.md` done at archive; update `docs/components.md` status as work progresses
- [ ] 8.4 `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green; changeset

## Amendments (from add-heading)

- [ ] A.1 `Title`/`Content` follow Dialog's heading rules (`h{level}` default `h2` via `headingProps`; content children in `Heading.Level` one deeper); tests for the "Title Heading Level" scenarios
