## 1. Pattern extraction

- [x] 1.1 Move the shared actions, guards, connect helpers and the contract fragment from `combobox.machine.ts` / `combobox.connect.ts` into `combobox/pattern/` (`optionsNeverSelected` is there already); Combobox spreads them; Combobox's node, DOM and model suites pass unchanged

## 2. Tags Input suggestions

- [x] 2.1 Machine: Tags Input spreads the pattern (tags-input Suggestions): choosing creates a tag from the option's key, `closeOnSelect` (default false), chosen options hidden unless `allowDuplicates`, `allowCustom`, chip and announcement text from the option
- [x] 2.2 Connect and React: suggestion parts are the reusable listbox parts (Positioner, Popup, List, Item, ItemText, Group, GroupLabel, Separator, Empty)
- [x] 2.3 Tests: every Suggestions scenario; a model configuration with suggestions; driver actions for suggestions
- [x] 2.4 Theme, site examples (tags with suggestions), docs section; docs/components.md status
