## ADDED Requirements

### Requirement: Moving Nodes

A Tree View with `movable` SHALL let the user move nodes, and SHALL report each move as
`onMove(key, { parent, index, reason })`. `index` counts the parent's children after the node
is removed. A node SHALL never move into its own subtree. Moving SHALL be off by default.

#### Scenario: Off by default

- **WHEN** Alt+Down is pressed on a row of a Tree View without `movable`
- **THEN** `onMove` is not called

### Requirement: Keyboard Moves

On a movable row, Alt+Up / Alt+Down SHALL move the node before its previous / after its next
sibling, Alt+Right SHALL make it the last child of its previous sibling when that sibling is a
branch, and Alt+Left SHALL place it after its parent at the parent's level. Focus SHALL stay
on the moved node. Each move SHALL be announced with the place, position and level, and a
refused move SHALL be announced.

#### Scenario: Indent

- **WHEN** "notes.md" follows the branch "docs" and the user presses Alt+Right on it
- **THEN** `onMove("notes.md", { parent: "docs", index: <docs' child count> })` is called

#### Scenario: Root reorder by one (React Aria #8561)

- **WHEN** the first of three root nodes gets Alt+Down
- **THEN** it becomes the second root node

### Requirement: Pointer Moves

A movable row SHALL be draggable by pointer. The row under the pointer SHALL give `before`
(top quarter), `inside` (middle half, branches only) or `after` (bottom quarter), shown by the
`DropIndicator` and `data-drop-target`. Hovering a collapsed branch's inside zone for 700 ms
SHALL expand it. Dropping SHALL call `onMove` once. Escape SHALL cancel. The node's own subtree
SHALL offer no target.

#### Scenario: Into a folder

- **WHEN** the user drags "notes.md" onto the middle of the branch "docs" and releases
- **THEN** `onMove("notes.md", { parent: "docs", index: <end> })` is called

#### Scenario: Not into itself (React Aria #9841)

- **WHEN** the user drags the branch "src" over its child "src/app"
- **THEN** no target is shown and releasing does not call `onMove`

### Requirement: Session Safety

A pointer drag SHALL end when its node is no longer visible. Its listeners SHALL exist only
during the gesture.

#### Scenario: Ancestor collapsed (React Aria #10599)

- **WHEN** the dragged node's parent collapses during the drag
- **THEN** the drag ends and the keyboard works normally

### Requirement: Move Contract

The Tree View contract SHALL add the actions `moveNode` and `dragNode`; the existing
`items` query reads the resulting structure (name and level of each row).

#### Scenario: Driver

- **WHEN** a test calls `moveNode("notes.md", "in")`
- **THEN** `items()` shows "notes.md" one level deeper
