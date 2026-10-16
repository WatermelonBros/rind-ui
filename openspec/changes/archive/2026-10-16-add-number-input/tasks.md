## 0. Prerequisites

- [x] 0.1 Confirm `add-foundations`, `add-a11y-foundations`, `add-field`, `add-text-field`, `add-checkbox` (`hidden-form-input`), `add-button`, `add-slider`, `add-progress` and `add-theme-system` are merged, and the requests in design.md (shared step math, Root-as-Field helper, context-menu suppression, quirk entries) are applied
- [x] 0.2 Add `@internationalized/number` (exact version) to `@rind-ui/core` dependencies, as allowed by `docs/decisions/0009-internationalized-number.md` (accepted); import it only from `core/i18n/number-parser.ts`; size check: a bundle importing a component without numeric fields contains none of it (tree-shaken), and the Number Input bundle's added size is recorded

## 1. Number parsing (`core/i18n/number-parser.ts`, capability `number-parsing`)

- [x] 1.1 `createNumberParser(locale, options)` per design §2: parse, `isPartial` (groups stripped, literal prefixes, sign rules, integer formats), format (no silent rounding), `valueText` (U+2212, accounting), `arabext` normalisation, cache keyed by value-compared options
- [x] 1.2 Keypad decimal quirk entry (`keypad-decimal-separator`) and its use in the insertion plan
- [x] 1.3 Node tests: every `number-parsing` scenario, plus en-US, de-DE, de-CH (`’`), fr-FR (narrow no-break space), pt-BR `R$`, ar-EG, fa-IR, hi-IN, bn-BD, ja-JP full-width, percent, per-mille, units with plurals, accounting (zag#2783, react-spectrum#6861, #5927, #3862, #6623, base-ui#4718, #5107, #5424, #5420)

## 2. Machine (`components/number-input/number-input.machine.ts`)

- [x] 2.1 Types (`NumberInputEvent`, props, `ChangeDetails` reasons) and the machine per design §3: `idle` / `composing` / `pressing` / `spinning`, controllable `value`, `bindProp` for `disabled`/`readOnly`, delays `spinDelay`/`spinInterval` (600 ms touch)
- [x] 2.2 `number-input.math.ts` `nextStep` on the shared step math: next grid line, empty start, clamp, no-op detection, large steps
- [x] 2.3 Commit (`snap` / `validate`), `resyncText` on `$sync` and `$reverted` (zag#3444), `commitInteraction` once per interaction (pending marker in controlled mode), paste commit, adoption, reset to the current default
- [x] 2.4 Announcements (`announceIfRemote`, `announceIfRewritten`) with the recording announcer
- [x] 2.5 Node tests with fake timers for every `number-input` scenario that needs no DOM (hold counts, stop at max base-ui#3887, disabled mid-hold base-ui#5434, touch tap vs cancel react-spectrum#8472, one change per click base-ui#2588, react-spectrum#4157 no key announcements, blur without change react-spectrum#9444)

## 3. Connect (`components/number-input/number-input.connect.ts`)

- [x] 3.1 Part props per design §4 via `mergeFieldProps`; spinbutton attributes and the `ios-vo-spinbutton-input` quirk; `aria-required` on the input, constraints on the hidden input
- [x] 3.2 `planInsertion` (pure) for `beforeinput`: insertions checked, deletions/history always pass; paste of the whole selection → `PASTE`; keydown mapping with IME guard, Home/End only with a bound, Enter commit then native submission
- [x] 3.3 Triggers: button-like, `tabIndex=-1`, names (`aria-labelledby` self + label), `aria-disabled` at bounds, press without focus (mouse/pen focus the input; touch/virtual never), context menu suppressed while held
- [x] 3.4 Wheel effect (non-passive, focused, vertical-dominant, Ctrl ignored, Shift large); `inputMode` table after mount (design §5)
- [x] 3.5 `number-input.messages.ts`: `increment`, `decrement`, `empty`, `valueText`, `committed`

## 4. React parts (`packages/react/src/number-input/`)

- [x] 4.1 `NumberInput.Root` (Field host helper), `Label`, `Description`, `ErrorMessage`, `Control`, `Input`, `IncrementTrigger`, `DecrementTrigger`; hidden number input rendered by the Root; `render` on every part
- [x] 4.2 SSR + hydration tests: iPhone `inputMode` (react-spectrum#8503), server/client locale difference, `defaultValue` formatted on the server

## 5. Contract and driver

- [x] 5.1 `number-input.contract.ts` per spec: anatomy, locate by `spinbutton` (or `textbox` under the quirk), actions, queries, states, events and prop steps, traits `valued` / `form-associated` / `field-associated`, `numberInputInvariants`
- [x] 5.2 `getNumberInput` driver; same test in `browser`, `jsdom` and Playwright

## 6. Model-based tests

- [x] 6.1 `testMachine(numberInputContract, …)` over the configurations in design §6, all modalities, platform presets (iOS, Android, desktop), `browser` and `jsdom`
- [x] 6.2 Broken variants: native `disabled` at the bound, announcement on every key, text reformatted on each keystroke (zag#2712), mouse press stepping twice (base-ui#2588), focus moved on touch (reka-ui#2315)

## 7. Browser tests

- [x] 7.1 Form parity: Enter submits the new value (react-spectrum#9671, reka-ui#1385, #2802), `requestSubmit()` from `onValueCommit`, raw number in form data, reset to the current default, autofill adoption and read-only re-sync, validation focus on the visible input (base-ui#3574), `commitBehavior="validate"` range error (base-ui#1845)
- [x] 7.2 Input editing in Chromium, Firefox and WebKit: caret preserved (zag#2712), unit deletion (react-spectrum#2806), group-separator deletion (react-spectrum#5927), inline `formatOptions` re-render (react-spectrum#1893), Japanese IME (react-spectrum#6678), wheel axis and focus rules (react-spectrum#1792)
- [x] 7.3 Touch emulation: tap without focus, scroll cancel, context menu suppressed, stylus (base-ui#1528)

## 8. Theme

- [x] 8.1 `packages/theme/src/number-input.css`: `@layer rind.components`, `:where()` selectors, `--rind-number-input-*` tokens read with fallbacks (never declared), family `field` (`outline` default, `soft`; `sm`/`md`/`lg`), focus ring on the control, trigger hit areas, at-bound state not by colour alone, tabular numerals, a `data-tone="danger"` state capture; imported from `index.css`
- [x] 8.2 Forced-colors and reduced-motion captures (default, focused, invalid, at bound, disabled)

## 9. Stories

- [x] 9.1 Site examples (apps/site/examples/number-input.tsx; Storybook is retired): basic with triggers, min/max/step, decimal step, percent, currency `de-DE`, units, Arabic and Persian digits, `commitBehavior="validate"` in a Field, wheel, no press-and-hold, controlled clamping parent, read-only, disabled, inside a Field and a Fieldset, Reado settings recipe; state example `idle` (composing / pressing / spinning cannot be held by a static page); axe clean in the model tests

## 10. Docs

- [x] 10.1 Generated docs page: anatomy, props, `data-*`, states, value/commit model, locale and numbering systems, keyboard table, steppers and press-and-hold, wheel, accessibility (spinbutton, value text, announcements, iOS quirk), form submission, contract and driver example; `llms.txt` entry
- [x] 10.2 Docs section for `number-parsing` (for later numeric fields)

## 11. Proof

- [x] 11.1 Deferred: manual AT pass (docs/review-backlog.md "Manual AT protocol"). Manual tier-1 protocol (NVDA, JAWS, VO macOS/iOS, TalkBack): spinbutton value read after each key, trigger names, touch trigger announcement, iOS quirk device check (design Open Questions), Arabic/Persian keyboard input
- [x] 11.2 `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green (`pnpm verify` on push)
