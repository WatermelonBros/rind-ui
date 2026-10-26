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

JSON Tree View: a Tree View of any JSON or JavaScript value. Children are built only when their container opens, so a huge value opens at once; keys are JSON Pointers (no dotted-path collision); large containers are grouped in ranges; a cycle shows where it loops while a shared value shows twice; BigInt, Map, Set, Date, RegExp, Error and sparse arrays render exactly. The visible text is the item's name ("address: object, 4 entries"). Ctrl/⌘+C copies the focused node as JSON, its value or its pointer, announced. Testing: `getJsonTreeView`. Theme: `json-tree-view.css`; a Tree View leaf's indicator keeps its place without a caret.
