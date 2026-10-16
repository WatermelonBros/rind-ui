## 0. Prerequisites

- [ ] 0.1 Confirm `add-foundations`, `add-a11y-foundations`, `add-text-field`, `add-field`, `add-button`, `add-toggle`, `add-pin-input` and `add-theme-system` are merged, and the requests in design.md (`buildTextFieldMachine`, injected-style helper) are applied

## 1. Machine (`components/password-input/password-input.machine.ts`)

- [ ] 1.1 Preset per design §1: controllable `visible`, `VISIBILITY.TOGGLE` / `VISIBILITY.HIDE`, guards (disabled refuses, read-only allows), `formVisibilityReset` service effect reading live props
- [ ] 1.2 Node tests: toggle in both Text Field states, controlled proposal and refusal, submit (prevented or not) and reset (prevented ignored), radix#4157 controlled reset, announcement only when the input is focused

## 2. Connect (`components/password-input/password-input.connect.ts`)

- [ ] 2.1 Part props per design §2: input attributes (`autoComplete`, `autoCapitalize`, `autoCorrect`, `spellCheck`), `type` from `visible`, trigger (`aria-pressed`, `aria-controls`, stable name, tab stop, press without focus, selection capture), Indicator, `data-state`
- [ ] 2.2 Selection restore after the `type` change (scheduler frame, cancelled when focus leaves); injected `::-ms-reveal` rule while a trigger is mounted
- [ ] 2.3 `password-input.messages.ts`: `toggleLabel`, `visibilityAnnouncement(visible)`; development warning when a consumer name changes with the state

## 3. React parts (`packages/react/src/password-input/`)

- [ ] 3.1 `PasswordInput.Root` (Field host helper + preset), Text Field parts under scope `password-input`, `VisibilityTrigger`, `Indicator`; re-exports of `ClearTrigger` and `CharacterCount`; `render` on every part
- [ ] 3.2 SSR + hydration test (`defaultVisible`, trigger rendered with `aria-pressed`)

## 4. Contract and driver

- [ ] 4.1 `password-input.contract.ts` per spec: anchor by the input's accessible name, Text Field actions plus `toggleVisibility`, `submitForm`, `resetForm`, queries, events and prop steps, trait `field-associated`, `passwordInputInvariants`
- [ ] 4.2 `getPasswordInput` driver; same test in `browser`, `jsdom` and Playwright

## 5. Model-based tests

- [ ] 5.1 `testMachine(passwordInputContract, …)` over the configurations in design §4, all modalities (virtual included), `browser` and `jsdom`
- [ ] 5.2 Broken variants: label that changes with the state, toggle on `pointerdown` only (Zag), trigger with `tabIndex=-1`, visibility kept after submit

## 6. Browser tests

- [ ] 6.1 Caret and selection preserved after mouse toggles in Chromium, Firefox and WebKit; touch emulation does not move focus; form submit and reset in a real form; `spellcheck` attribute in both states

## 7. Theme

- [ ] 7.1 `packages/theme/src/password-input.css`: `@layer rind.components`, `:where()` selectors, `--rind-password-input-*` tokens read with fallbacks (never declared), family `field` (`outline` default, `soft`; `sm`/`md`/`lg`), trigger hit area and inline-end space, pressed state not by colour alone, a `data-tone="danger"` state capture; imported from `index.css`
- [ ] 7.2 Forced-colors and reduced-motion captures (hidden, visible, focused trigger, invalid, disabled)

## 8. Site examples

- [ ] 8.1 Site examples (apps/site/examples/password-input.tsx, state examples for every contract state): login (`current-password`), sign-up (`new-password` with Description), controlled visibility, read-only, disabled, invalid inside a Field, inside a form showing hide-on-submit, Reado vault unlock recipe; state examples with ARIA snapshots; a driver example; every example passes axe

## 9. Docs

- [ ] 9.1 Generated docs page: anatomy, props, `data-*`, states, visibility and form resets, trigger semantics (why `aria-pressed` and a stable name), privacy notes (spellcheck, autocomplete), password managers, contract and driver example; `llms.txt` entry

## 10. Proof

- [ ] 10.1 Manual tier-1 protocol (NVDA, JAWS, VO macOS/iOS, TalkBack): trigger read as toggle button with state, input-focused announcement, 1Password/Bitwarden badges not covering the trigger, Edge has one reveal control
- [ ] 10.2 `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green
