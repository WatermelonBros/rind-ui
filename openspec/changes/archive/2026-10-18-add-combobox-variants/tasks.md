## 1. Pattern extraction and Tags Input suggestions

Moved to the follow-up change `tags-input-suggestions` (coordinator, 2026-10-18).

## 2. Free-text mode (Autocomplete)

- [x] 2.1 Machine: free-text form rules (Enter not prevented without a highlight, `submitOnChoose`, reset to `defaultInputValue`, `clearOnEscape` default false), `onAction` after filling
- [x] 2.2 Connect and React: `name` / `form` / `required` / `formAutoComplete` on the visible input, no hidden input; the Input is the Field's validity element
- [x] 2.3 Node, DOM and model tests for every Free-Text scenario

## 3. Inline mode (Command)

- [x] 3.1 Machine: `inline` starts open and never closes; development error with `single` / `multiple`; `onAction`; Inline Escape; `page` / `onBack` / `PAGE.CHANGE`; count announcement after mount only
- [x] 3.2 Connect and React: List in place, Positioner / Popup / Trigger render nothing (warning), `Loading`, `ItemDescription`, `data-inline` / `data-empty` / `data-loading` / `data-page`, link items, scrolling rules
- [x] 3.3 Node, DOM and model tests for every Inline, Running Actions, Pages, Loading, Filtering and Inside A Dialog scenario

## 4. Contract, theme, site, docs

- [x] 4.1 Contract: `run`, `back`, `items`, `page`, `$props:page`, per-configuration traits; meta updated
- [x] 4.2 Theme: `[data-inline]` list, `data-tone="danger"` items, forced colors; browser test
- [x] 4.3 Site examples (Autocomplete and Command palette sections, the palette in a dialog), state examples and ARIA snapshots; Combobox docs page sections "Autocomplete" and "Command palette"

## 5. Close-out

- [x] 5.1 docs/components.md: one Combobox row (Autocomplete and Command rows removed); changeset; lint, typecheck, docs check, site audit
