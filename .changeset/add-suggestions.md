---
"@rind-ui/core": minor
"@rind-ui/react": minor
"@rind-ui/vue": minor
"@rind-ui/svelte": minor
"@rind-ui/solid": minor
"@rind-ui/angular": minor
"@rind-ui/testing": minor
"@rind-ui/theme": minor
---

Suggestions: prompt chips. A press calls `onSelect({ value, index, key })` and sends nothing itself; while `loading` the chips stay disabled but focusable (the focus never drops); a new set is announced only with `announce="polite"`, never on mount; `focusTarget` takes the focus back to the prompt after a press that began inside. Testing: `getSuggestions`. Theme: `suggestions.css`.
