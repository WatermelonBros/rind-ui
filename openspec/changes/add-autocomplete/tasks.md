## 0. Prerequisites

- [ ] 0.1 Confirm `add-combobox` is applied (pattern module, `combobox` machine with `selectionMode: "none"`)

## 1. Machine (preset over `combobox.machine.ts`)

- [ ] 1.1 `selectionMode: "none"` paths: `fillText` on choose, no-op `commitText` (except accepting a shown inline completion on blur/Tab), `clearOnEscape` transition, `submitOnChoose` through `env.form.requestSubmit`
- [ ] 1.2 `node` tests for every autocomplete scenario (modes, Enter with/without highlight, free text on blur, Escape in a dialog)

## 2. Connect and messages

- [ ] 2.1 `autocomplete.connect.ts`: prop mapping (design §1), native form attributes on the input, `aria-autocomplete` from `mode`, `aria-selected="false"` on options, `data-scope="autocomplete"`, `data-empty-value`, `data-variant` / `data-size` pass-through
- [ ] 2.2 `autocomplete.messages.ts` (pattern messages)
- [ ] 2.3 Unit tests for every attribute in the spec

## 3. React parts (`packages/react/src/autocomplete`)

- [ ] 3.1 Root, Label, Control, Input, Trigger, ClearTrigger, Positioner, Popup, List, Item, ItemText, Group, GroupLabel, Separator, Empty; `render` on each
- [ ] 3.2 React tests: Strict Mode, SSR + hydrate, native form submit/reset, inside a modal dialog

## 4. Contract and driver

- [ ] 4.1 `autocomplete.contract.ts` per design §3 (traits, announcements, `optionsNeverSelected` invariant, `{ skip }`, prop steps)
- [ ] 4.2 `getAutocomplete` in `@rind-ui/testing`; driver tests in browser mode, jsdom and through Playwright against the site examples harness

## 5. Tests

- [ ] 5.1 One browser test per spec scenario; issue-citing scenarios reproduce the issue first (Bug history in docs/research/autocomplete.md)
- [ ] 5.2 `testMachine` over the props classes of design §3, all modalities incl. `virtual`, RTL run, Apple/WebKit, Apple/Blink and Windows platforms, IME replays, axe per state

## 6. Theme (`packages/theme/src/autocomplete.css`)

- [ ] 6.1 Tier-3 `--rind-autocomplete-*` tokens defaulting to the `--rind-combobox-*` tokens; `data-variant` (solid, soft, outline, ghost) and `data-size` (sm, md, lg); entry/exit with duration tokens
- [ ] 6.2 Forced colors (outline highlight) and 24×24 targets; Playwright forced-colors captures

## 7. Site examples

- [ ] 7.1 Site examples (apps/site/examples/autocomplete.tsx, state examples for every contract state): Default (list), both, inline, none, search form with Enter submit, `submitOnChoose`, async, empty state, in a dialog; state examples open / empty / loading
- [ ] 7.2 Driver example (docs testing example); all examples render with the theme stylesheet and pass axe (including colour contrast)

## 8. Docs and manual checks

- [ ] 8.1 Docs page (generated API facts + guide: Autocomplete vs Combobox, modes, forms and Enter, async, `<datalist>` as zero-JS fallback, testing with `getAutocomplete`)
- [ ] 8.2 Manual tier-1 pass (VO + Safari macOS/iOS, VO + Chrome, NVDA, JAWS, TalkBack; IME on macOS and Android); record in "Tested with"
- [ ] 8.3 Set Autocomplete to `wip`/`done` in `docs/components.md` as it progresses; archive the change when approved
- [ ] 8.4 `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green; changeset for core, react, testing, theme

## Amendments (from add-separator)

- [ ] A.1 `Autocomplete.Separator` uses add-separator's `separatorProps({ context: "listbox", scope: "autocomplete" })`: `role="none"`; axe `aria-required-children` test on an open popup with a separator (mui/base-ui#5398)

## Amendments (from add-field)

- [ ] A.2 `field-control` binding in `Autocomplete.Root`: register the Input once (the Input is the validity element), Field ARIA on the Input only, OR-merged flags with Field and Fieldset, change reports with `composing` and commits (Enter, close), focus target = Input, `field-associated` trait, Field prop × control matrix test

## Amendments (from add-combobox follow-up)

- [ ] A.3 `autocomplete.contract.ts`: import `optionsNeverSelected` from the `combobox-pattern` module (`components/combobox/pattern/`) instead of declaring it; skip `CHIP.TYPE` with `{ skip: "no chips in autocomplete" }` alongside the other chip events; test for the "Chip events are skipped" scenario
