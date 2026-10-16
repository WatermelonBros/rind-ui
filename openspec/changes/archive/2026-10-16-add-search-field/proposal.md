## Why

Search boxes are everywhere (Reado's library and settings search) and users expect three
things native inputs only half provide: Escape clears, Enter searches, a clear button that
works with every input method. React Aria's SearchField, the only headless one besides
Kobalte's combobox-based Search, shows the traps: Enter and Escape acting during an IME
composition drop Korean/Chinese/Japanese characters (react-spectrum#10249, #6421), Escape in an
empty field must still close the enclosing dialog (react-spectrum#5480), the clear button must
re-validate (react-spectrum#7265), and the browser's own cancel button duplicates a custom one.

Research: [search-field](../../../docs/research/search-field.md) ·
[text-field](../../../docs/research/text-field.md) · [field](../../../docs/research/field.md) ·
[accessibility](../../../docs/research/accessibility.md) §6 ·
[overlay-infrastructure](../../../docs/research/overlay-infrastructure.md) (Escape ownership)

Depends on: `add-foundations`, `add-a11y-foundations` (`keyboard-interactions` IME guard,
`press-interactions`, `i18n-messages`), `add-text-field` (machine through the builder
requested by `add-password-input`, ClearTrigger, parts, contract), `add-field`,
`add-overlay-infrastructure` (`dismissable-layer`: an inner widget consuming Escape),
`add-pin-input` (the injected-style helper it requests), `add-theme-system`.

## What Changes

- A public **Search Field** component: Text Field's `Root`, `Label`, `Description`,
  `ErrorMessage`, `Input` (`type="search"`, role `searchbox`) and `ClearTrigger` (named
  "Clear search").
- Escape clears a non-empty editable value through the change path and consumes the key;
  on an empty field it is left to enclosing layers. Enter calls `onSubmit(value)` and lets
  native form submission proceed. Both are IME-guarded.
- The browser's cancel button is hidden while a ClearTrigger is mounted.
- `data-empty`; contract and driver (`getSearchField`); model-based tests; theme (family
  `field`); stories; docs page.

## Capabilities

### New Capabilities

- `search-field`: the Search Field component — anatomy, Escape and Enter behaviour, clear
  trigger, native cancel button, data attributes, contract, theme.

### Modified Capabilities

None. The Text Field machine builder is requested from `add-text-field` in
`add-password-input` (the first preset) and reused here.

## Non-goals

- Suggestions, recent searches, result counts (Autocomplete, Command).
- Debouncing or search-as-you-type (`onValueChange` is enough; a docs recipe).
- The `search` landmark (`<search>` or `role="search"` on the form): a docs recipe.
- Framework adapters other than React; fx.

## Impact

- `packages/core`: `components/search-field/` (Text Field preset, connect, contract, messages).
- `packages/react/src/search-field/`, `@rind-ui/testing` (`getSearchField`),
  `@rind-ui/theme/search-field.css`, stories, docs.
- Reado: the search box built from `atoms/Input.tsx` (leading icon, trailing clear button)
  becomes `SearchField` with `ClearTrigger`.
- No new runtime dependency.
