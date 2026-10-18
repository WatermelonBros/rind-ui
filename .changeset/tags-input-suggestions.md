---
"@rind-ui/core": minor
"@rind-ui/react": minor
"@rind-ui/testing": minor
"@rind-ui/theme": minor
---

Tags Input suggestions: with `items` (or a `collection`) the input is a combobox over the suggestions; choosing one creates a tag from its key (shown with its label), clears the draft and keeps the popup open (`closeOnSelect`); chosen suggestions leave the list unless `allowDuplicates`; `allowCustom={false}` refuses typed text. New parts `Positioner`, `Popup`, `List`, `Item`, `ItemText`, `Group`, `Separator`, `Empty`, `Items` (the listbox parts, as in Combobox). The combobox-pattern pieces (`patternPieces`, `patternConnect`, `patternContract`, `popupOverlay`, `patternMessages`) are exported for every input-driven listbox; Combobox uses them unchanged. The Tags Input driver locates `textbox` or `combobox` and gains the pattern's actions and queries.
