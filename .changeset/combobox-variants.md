---
"@rind-ui/core": minor
"@rind-ui/react": minor
"@rind-ui/testing": minor
"@rind-ui/theme": minor
---

Combobox variants. These replace separate Autocomplete and Command components.

- **Free text** (`selectionMode="none"`): an autocomplete. The text is the value (`onInputValueChange`), suggestions fill it, the visible input is the native form control, Enter with nothing highlighted submits, and `clearOnEscape` and `submitOnChoose` are available.
- **Inline** (`inline`): a command palette. The list is in place and always shown; the machine is the new `inlineComboboxMachine`, with the single state `open`. Items run `onAction(key, { modality, modifiers })`; pages use `page` and `onBack` (Backspace on an empty query); Escape clears the query, then calls `onOpenChange(false)`; link items open natively with modifiers.
- **New parts:** `Combobox.Loading` and `Combobox.ItemDescription`.
- **Contracts:** `inlineComboboxContract`, `comboboxInvariants` and `optionsNeverSelected`.
- **Driver:** `getCombobox(…, { inline: true })` with `run` and `back`.
- **Theme:** the inline list and danger items.
