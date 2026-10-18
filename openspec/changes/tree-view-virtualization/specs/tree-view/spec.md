## ADDED Requirements

### Requirement: Virtualized Rendering

`TreeView.Tree` SHALL support virtualized rendering through the collection layer's
virtualizer: only the rows in and near the viewport SHALL be in the DOM, keyboard moves SHALL
scroll the highlighted row into view, item ids SHALL stay stable across expand and collapse,
and a highlight move SHALL re-render only the previously and newly highlighted rows. Set
metadata (`aria-level`, `aria-setsize`, `aria-posinset`) SHALL be correct for every rendered
row, whether or not its siblings are rendered.

#### Scenario: End in a large tree

- **WHEN** a virtualized tree with 10,000 visible nodes has focus on its first row and the
  user presses End
- **THEN** the last node is highlighted, rendered and focused, and fewer than 200 rows are in
  the DOM

#### Scenario: Ids survive expand and collapse

- **WHEN** a branch is collapsed and expanded again in a virtualized tree
- **THEN** every row keeps the id it had before

#### Scenario: Highlight move re-renders two rows

- **WHEN** the highlight moves from one row to the next
- **THEN** exactly two rows re-render
