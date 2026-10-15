## 0. Prerequisites

- [ ] 0.1 Confirm `add-foundations`, `add-a11y-foundations`, `add-field`, `add-text-field` and `add-theme-system` are merged, and the requests in design.md (injected-style helper; Root-as-Field helper from `add-number-input`'s request) are applied

## 1. Edit plan (`components/pin-input/edit-plan.ts`)

- [ ] 1.1 `normalise` (NFKC, `sanitize`, strip whitespace `-` `.`), `filter` per `validationType`/`pattern`, `planEdit(value, caret, input, rules)` per design §3: replace-at-caret, same-character advance, append, paste insert vs replace-all, truncation, deletions and history pass through
- [ ] 1.2 Node tests: every filtering, paste, caret and composition scenario that needs no DOM (zag#470, #3020, #908, #1507, radix#3550, input-otp#53, base-ui#4608, #5091, bits-ui#826)

## 2. Machine (`components/pin-input/pin-input.machine.ts`)

- [ ] 2.1 Types and machine per design §3: `idle` / `composing`, controllable `value` (`null`/`undefined` → ""), caret context, `EDIT`/`INPUT`/`CARET`/`SLOT.PRESS`, reset to the current default, `$reverted` re-sync
- [ ] 2.2 `maybeComplete` (base-ui#4679) and `autoSubmit` effect without focus moves (base-ui#5088); read-only refusal and re-sync (base-ui#4805, #4828)
- [ ] 2.3 Node tests: completion counts, controlled clear (ark#3573), no holes (reka-ui#2355), parent changes never complete

## 3. Connect (`components/pin-input/pin-input.connect.ts`)

- [ ] 3.1 Part props per design §4 via `mergeFieldProps`; input attributes (`autoComplete`, `inputMode`, `maxLength`, anchored `pattern`, `dir="ltr"`, overlay style); native `input` listener; `beforeinput` → `planEdit` (+ `preventDefault`), composition handlers with the IME guard; Enter never prevented
- [ ] 3.2 Slot hit-testing on `pointerdown` through `core/dom` (slot rects), `focusSafely`, caret effect (`selectionchange`, `setSelectionRange` in the same task)
- [ ] 3.3 Injected style rules (selection, autofill) through the shared helper with the CSP nonce
- [ ] 3.4 `pin-input.messages.ts` (no AT strings of its own; validity-key overrides go through Field)

## 4. React parts (`packages/react/src/pin-input/`)

- [ ] 4.1 `PinInput.Root` (Field host helper), `Label`, `Description`, `ErrorMessage`, `Control`, `Input`, `Slot` (`index`); slot count warning; `render` on every part
- [ ] 4.2 SSR + hydration test with `defaultValue`, Label and six Slots

## 5. Contract and driver

- [ ] 5.1 `pin-input.contract.ts` per spec: anatomy, locate by `textbox` + name, actions (`type`, `paste`, `fill`, `autofill`, `backspace`, `clear`, `pressSlot`, `compose`), queries, states, events, trait `field-associated`, `pinInputInvariants`
- [ ] 5.2 `getPinInput` driver; same test in `browser`, `jsdom` and Playwright

## 6. Model-based tests

- [ ] 6.1 `testMachine(pinInputContract, …)` over the configurations in design §5, all modalities, `browser` and `jsdom`
- [ ] 6.2 Broken variants: per-slot focusable inputs, Enter prevented (zag#3381), focus moved after `autoSubmit`, completion missed on paste replacement

## 7. Browser tests

- [ ] 7.1 Autofill paths: one-time-code fill simulated by setting the value with `input` (zag#2118, radix#3641, input-otp#152), Chrome `:autofill` paint suppressed, read-only refusal
- [ ] 7.2 Pointer: press a filled slot (input-otp#31, #62), press past the value (zag#2999), Tab is one stop (reka-ui#2943), ⌘+Backspace (zag#2722), IME in Safari and Chromium (base-ui#5091)
- [ ] 7.3 Form: Enter on incomplete required code (zag#3381), pattern message, reset, `autoSubmit` with another invalid field (base-ui#5088), `dir="rtl"` slot order

## 8. Theme

- [ ] 8.1 `packages/theme/src/pin-input.css`: `@layer rind.components`, `:where()` selectors, `--rind-pin-input-*` tokens read with fallbacks (never declared), family `field` (`outline` default, `soft`; `sm`/`md`/`lg`), slot boundary 3:1, active slot ring, fake caret with reduced motion, badge space, a `data-tone="danger"` state capture; imported from `index.css`
- [ ] 8.2 Forced-colors and reduced-motion captures (empty, focused, partly filled, complete, invalid, disabled)

## 9. Stories

- [ ] 9.1 Stories: six-digit OTP, grouped 3+3 with a decorative separator, alphanumeric uppercase, masked 4-digit PIN, `autoSubmit` form, controlled, read-only, disabled, invalid inside a Field, RTL page; state stories per state with ARIA snapshots; a driver story; every story passes axe

## 10. Docs

- [ ] 10.1 Generated docs page: anatomy, props, `data-*`, states, why one input, autofill and password managers, paste rules, caret model, accessibility (one textbox, Label, description), WebOTP recipe, contract and driver example; `llms.txt` entry

## 11. Proof

- [ ] 11.1 Manual tier-1 protocol (NVDA, JAWS, VO macOS/iOS, TalkBack): one field announced with its name, code read back, iOS SMS "From Messages" fill, 1Password/Bitwarden fill, iOS selection-handle check (design Risks)
- [ ] 11.2 `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green
