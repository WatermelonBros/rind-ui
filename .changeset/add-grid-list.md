---
"@rind-ui/core": minor
"@rind-ui/react": minor
"@rind-ui/testing": minor
"@rind-ui/theme": minor
---

Grid List: a list of rows that hold their own controls (a selection checkbox, buttons, fields, links, a nested Tag Group).

- **Navigation.** One Tab stop, arrows between rows, ArrowRight into a row's controls (or Tab with `childNavigation="tab"`), and `layout="grid"` for cards.
- **Selection and actions.** The selection and action rules follow the selection behaviour, the checkbox and link rows; a press on a control never reaches its row.
- **Accessibility.** Each row is named by its text only. A quirk entry announces the selection on Apple WebKit.
- **Core infrastructure.** `collection-grid` (`grid.ts`, `grid-layout`, `row-controls`).
- **Contract and driver.** `getGridList`.
- **Theme.** `grid-list.css`.
