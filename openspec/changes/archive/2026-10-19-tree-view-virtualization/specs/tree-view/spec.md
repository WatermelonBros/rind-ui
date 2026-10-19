## MODIFIED Requirements

### Requirement: Collection Changes

Filtering a tree collection SHALL keep ancestors of matching nodes as branches (with
`children` retained even when empty) so `aria-expanded` and expandability survive
(zag#2582, react-spectrum#10664). The highlight SHALL repair per collections when its
node disappears. Large trees SHALL keep a highlight move at constant cost: only the two
affected items re-render.

#### Scenario: Filter keeps ancestors

- **WHEN** a tree is filtered to "index.ts" inside "src/app"
- **THEN** "src" and "app" remain as expanded-able branches above it

#### Scenario: Highlight move re-renders two rows

- **WHEN** the highlight moves from one row to the next
- **THEN** exactly two rows re-render

### Requirement: Virtualization

`aria-level`, `aria-setsize` and `aria-posinset` SHALL come from the tree data (the node's
depth and its position among its siblings), not from the rendered rows. `TreeView.Tree` SHALL
support virtualized rendering through the collections contract over the visible items: only
the rows in and near the viewport SHALL be in the DOM, the scroll-to-index callback SHALL
receive the index in the visible list, keyboard moves SHALL scroll the highlighted row into
view, persisted keys SHALL include the highlighted key, and expanding or collapsing SHALL NOT
change the identity (element id) of any item that stays visible.

#### Scenario: Metadata from the data

- **WHEN** "index.ts" is the second of three children of "src" and is rendered
- **THEN** it has `aria-posinset="2"` and `aria-setsize="3"` from the tree data

#### Scenario: End in a large tree

- **WHEN** a virtualized tree with 10,000 visible nodes has focus on its first row and the
  user presses End
- **THEN** the last node is highlighted, rendered and focused, `scrollToIndex` receives index
  9999, its metadata is correct, and fewer than 200 rows are in the DOM

#### Scenario: Ids survive expand and collapse

- **WHEN** a branch is collapsed and expanded again in a virtualized tree
- **THEN** every row keeps the id it had before
