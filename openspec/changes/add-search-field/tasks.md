## 0. Prerequisites

- [ ] 0.1 Confirm `add-foundations`, `add-a11y-foundations`, `add-text-field`, `add-field`, `add-overlay-infrastructure`, `add-password-input` (builder request applied to `add-text-field`), `add-pin-input` (injected-style helper) and `add-theme-system` are merged

## 1. Machine (`components/search-field/search-field.machine.ts`)

- [ ] 1.1 Preset per design §1: `ESCAPE` (guards `notComposing`, `hasValue`, `editable`; `consumeKey`, clear with reason `ESCAPE`) and `SUBMIT` (`reportCommit`, `onSubmit`)
- [ ] 1.2 Node tests: Escape on empty/non-empty/read-only/disabled, composing Escape and Enter (react-spectrum#10249, #6421), `onSubmit` once per Enter, no `preventDefault` on Enter

## 2. Connect (`components/search-field/search-field.connect.ts`)

- [ ] 2.1 Part props per design §2: `type="search"`, `enterKeyHint`, `data-empty`, `data-custom-clear`, key mapping after consumer handlers (react-spectrum#2253)
- [ ] 2.2 Injected cancel-button rule; `search-field.messages.ts` (`clear` = "Clear search")

## 3. React parts (`packages/react/src/search-field/`)

- [ ] 3.1 `SearchField.Root` (Field host helper + preset), Text Field parts under scope `search-field`, `ClearTrigger`; `render` on every part
- [ ] 3.2 SSR + hydration test with `defaultValue` and a ClearTrigger

## 4. Contract and driver

- [ ] 4.1 `search-field.contract.ts` per spec: locate by `searchbox` + name, Text Field actions plus `escape`, `submit`, `clear` keyboard twin, queries, events, trait `field-associated`, `searchFieldInvariants`
- [ ] 4.2 `getSearchField` driver; same test in `browser`, `jsdom` and Playwright

## 5. Model-based tests

- [ ] 5.1 `testMachine(searchFieldContract, …)` over the configurations in design §3, all modalities, `browser` and `jsdom`
- [ ] 5.2 Broken variants: Escape always consumed (react-spectrum#5480), Enter not IME-guarded, clear bypassing validation (react-spectrum#7265)

## 6. Browser tests

- [ ] 6.1 Escape inside a Dialog with and without text (Chromium, Firefox, WebKit), native cancel button hidden only with a ClearTrigger (Chromium, WebKit), Korean/Japanese IME Enter and Escape (CDP / WebKit composition), form submission on Enter

## 7. Theme

- [ ] 7.1 `packages/theme/src/search-field.css`: `@layer rind.components`, `:where()` selectors, `--rind-search-field-*` tokens read with fallbacks (never declared), family `field` (`outline` default, `soft`; `sm`/`md`/`lg`), native decoration reset, leading icon space, ClearTrigger hit area and transparent background, a `data-tone="danger"` state capture; imported from `index.css`
- [ ] 7.2 Forced-colors and reduced-motion captures (empty, with text, focused, invalid, disabled)

## 8. Stories

- [ ] 8.1 Stories: basic with ClearTrigger and leading icon (Reado search box), icon-only with `aria-label`, inside a Dialog (Escape ownership), inside a search form with the `<search>` landmark recipe, controlled with a results count, read-only, disabled, invalid in a Field; state stories with ARIA snapshots; a driver story; every story passes axe

## 9. Docs

- [ ] 9.1 Generated docs page: anatomy, props, `data-*`, states, Escape and Enter rules (IME, layers), ClearTrigger vs native cancel button, landmark and debouncing recipes, "Search Field vs Autocomplete", contract and driver example; `llms.txt` entry

## 10. Proof

- [ ] 10.1 Manual tier-1 protocol (NVDA, JAWS, VO macOS/iOS, TalkBack): searchbox role and name, Clear named and not in tab order, Escape in a dialog, IME on macOS and Windows
- [ ] 10.2 `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green
