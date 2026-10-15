## 0. Prerequisites

- [x] 0.1 Confirm `add-foundations`, `add-a11y-foundations` (IME guard, announcer, press without focus), `add-field`, `add-label` and `add-button` are merged

## 1. Autosize (`core/dom/autosize.ts`, capability `autosize-textarea`)

- [x] 1.1 Native branch (`field-sizing: content`, `rows` → min block size) and the measured fallback per design §4 (next-frame write, `parseFloat`, max-height overflow, fonts, ResizeObserver, explicit `measure()`, cleanup)
- [x] 1.2 Browser tests in both branches (fallback forced by a stubbed `CSS.supports`): grow/shrink, max height, external value (kobalte#484), Drawer without RO-loop error (zag#2281), 110% zoom (zag#2312), unmount during resize (base-ui#164); a test that `value`'s descriptor is never redefined (zag#3204)

## 2. Machine (`components/text-field/text-field.machine.ts`)

- [x] 2.1 Types and machine per design §2: `idle` / `composing`, controllable `value`, CLEAR guard, RESET re-read, focus context, count + threshold announcement
- [x] 2.2 Node tests: composition never counts or announces, clear proposes in controlled mode, `null` → `""`, threshold boundaries, recording announcer key coalescing

## 3. Connect (`components/text-field/text-field.connect.ts`)

- [x] 3.1 Part props per design §5 via `mergeFieldProps`; uncontrolled `defaultValue` vs controlled `value`; IME-guarded Enter commit; `focusableWhenDisabled` → `readOnly` + `aria-disabled`
- [x] 3.2 ClearTrigger (button-like, press without focus, one setter write + one `input` event, reason `CLEAR`); CharacterCount (code units, newline = 1, `count` override, `data-over-limit`, soft-limit `tooLong` through Field custom validity)
- [x] 3.3 `text-field.messages.ts`: `clear`, `charactersRemaining(n)`, `charactersOver(n)`

## 4. React parts (`packages/react/src/text-field/`)

- [x] 4.1 `TextField.Root` (creates or joins a Field, design §3), `Label`, `Description`, `ErrorMessage`, `Input`, `Textarea` (`autosize`), `ClearTrigger`, `CharacterCount`; `render` on every part; dev errors for zero or two controls
- [x] 4.2 SSR + hydration with `defaultValue`, Label and Description; `autoFocus` seeds `data-focus` (base-ui#3172)

## 5. Contract and driver

- [x] 5.1 `text-field.contract.ts`: anatomy, locate by role `textbox` + name, actions `type` / `fill` / `clear` / `compose` / `composeOpen` / `composeEnd` / `blur` / `reset`, queries (incl. `isComposing`), states, events, trait `field-associated`, `textFieldInvariants` (one textbox, ClearTrigger only when clearable); `textFieldStepInvariants({ composedText })` exported from `@rind-ui/testing` (silent while composing, value only from the composition), used by the model tests
- [x] 5.2 `getTextField` driver; same test in `browser`, `jsdom` and Playwright

## 6. Model-based tests

- [x] 6.1 `testMachine(textFieldContract, …)` over the configurations in design §6, all modalities, `browser` and `jsdom`
- [x] 6.2 Broken variants: writes value during composition (kobalte#737), announces while composing, ClearTrigger rendered when read-only, synthesizes a second `input` on programmatic writes

## 7. Browser tests

- [x] 7.1 IME in Chromium (CDP) and Safari (WebKit): Japanese and Korean commits (kobalte#737, ariakit#6663, base-ui#5091), focusable-disabled ignores IME (base-ui#5366) — partial: IME through the adapters' composition sequence (CDP in the Playwright adapter); real macOS/Windows IMEs are in the manual protocol
- [x] 7.2 Native parity: autofill reported (react-spectrum#6601), React 19 action reset (react-spectrum#8995), latest default on reset (base-ui#5880), `data-filled` after reset (base-ui#5765), textarea `maxLength` newline counting (react-spectrum#1907), `onChange` and `onValueChange` both fire (kobalte#459)

## 8. Theme

- [x] 8.1 `packages/theme/src/text-field.css`: `@layer rind.components`, `:where()` selectors, `--rind-text-field-*` tokens read with fallbacks (never declared), family `field` (`outline` default, `soft`; `sm`/`md`/`lg`), 3:1 boundary, non-colour invalid cue, ClearTrigger hit area, CharacterCount over-limit danger role, a `data-tone="danger"` state capture; imported from `index.css`
- [x] 8.2 Forced-colors and reduced-motion captures (default, focused, invalid, disabled)

## 9. Stories

- [x] 9.1 Stories: Input, Textarea, autosize, with Description and ErrorMessage, required email, ClearTrigger with a leading icon (Reado search box), CharacterCount hard and soft, controlled, read-only, focusable-disabled, inside a Field and a Fieldset, React 19 action form; state stories per state with ARIA snapshots; a driver story; every story passes axe

## 10. Docs

- [x] 10.1 Generated docs page: anatomy, props, `data-*`, states, value model and `details`, IME notes, ClearTrigger and CharacterCount accessibility, autosize (native vs fallback), "Text Field vs Field", contract and driver example, Reado recipe for Cmd/Ctrl+Enter with the IME guard; `llms.txt` entry
- [x] 10.2 Docs section for `autosize-textarea`, linked from Prompt Input later

## 11. Proof

- [x] 11.1 Manual tier-1 protocol (NVDA, JAWS, VO macOS/iOS, TalkBack): name, description with count, error after submit, Clear named and not in tab order, count announced near the limit, Japanese IME on macOS and Windows — deferred to the manual protocol (docs/accessibility/manual-protocol.md, "Device checklist: Text Field"); needs the user on devices
- [x] 11.2 `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green

## Amendments (from add-password-input, add-search-field)

- [x] A.1 `buildTextFieldMachine(preset)` per design §2 and spec "Machine Builder": preset adds controllable values, global events (guards, actions), service effects and `scope`; `textFieldMachine = buildTextFieldMachine({})`; connect, parts and contract take the scope as a parameter; Node tests for the empty preset (same graph) and a preset global event accepted while composing
- [x] A.2 Clear action reason parameter: `clearInput` takes `reason` (ClearTrigger passes `CLEAR`); the one-shot flag reports that reason; test for the "Clear reason from a preset" scenario (`ESCAPE`)

## Amendments (from add-number-input, add-pin-input)

- [x] A.3 Extract Root-as-Field (design §3) into `packages/react/src/field/use-field-host.ts`, parameterised by scope, and use it from `TextField.Root`; tests for standalone and nested use under a non-`text-field` scope ("Shared Field host" scenario)
