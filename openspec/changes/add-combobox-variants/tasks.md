## 1. Pattern extraction

- [ ] 1.1 Move the shared actions, guards, connect helpers, `optionsNeverSelected` and the contract fragment from `combobox.machine.ts` / `combobox.connect.ts` into `combobox/pattern/`; Combobox spreads them; Combobox's node, DOM and model suites pass unchanged
- [ ] 1.2 Tags Input spreads the pattern for its Suggestions requirement (tags-input spec, unchanged): machine, connect, React suggestion parts (Positioner, Popup, List, Item, ItemText, Empty), driver, model configuration with suggestions, docs section

## 2. Free-text mode (Autocomplete)

- [ ] 2.1 Machine: free-text form rules (Enter not prevented without a highlight, `submitOnChoose`, reset to `defaultInputValue`, `clearOnEscape` default false), `onAction` after filling
- [ ] 2.2 Connect and React: `name` / `form` / `required` / `formAutoComplete` on the visible input, no hidden input; the Input is the Field's validity element
- [ ] 2.3 Node, DOM and model tests for every Free-Text scenario

## 3. Inline mode (Command)

- [ ] 3.1 Machine: `inline` starts open and never closes; development error with `single` / `multiple`; `onAction`; Inline Escape; `page` / `onBack` / `PAGE.CHANGE`; count announcement after mount only
- [ ] 3.2 Connect and React: List in place, Positioner / Popup / Trigger render nothing (warning), `Loading`, `ItemDescription`, `data-inline` / `data-empty` / `data-loading` / `data-page`, link items, scrolling rules
- [ ] 3.3 Node, DOM and model tests for every Inline, Running Actions, Pages, Loading, Filtering and Inside A Dialog scenario

## 4. Contract, theme, site, docs

- [ ] 4.1 Contract: `run`, `back`, `items`, `page`, `$props:page`, per-configuration traits; meta updated
- [ ] 4.2 Theme: `[data-inline]` list, `data-tone="danger"` items, forced colors; browser test
- [ ] 4.3 Site examples (Autocomplete and Command palette sections, the palette in a dialog), state examples and ARIA snapshots; Combobox docs page sections "Autocomplete" and "Command palette"

## 5. Close-out

- [ ] 5.1 docs/components.md: one Combobox row (Autocomplete and Command rows removed); changeset; lint, typecheck, docs check, site audit
