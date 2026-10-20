# sortable Specification

## Purpose
TBD - created by archiving change add-sortable. Update Purpose after archive.
## Requirements
### Requirement: Anatomy

A Sortable SHALL consist of `Root`, an `Item` per key, and MAY contain a `Handle` (a button)
in each Item, an `Indicator` and `MoveButton`s. Every part SHALL accept the `render` prop and
SHALL wrap any list markup.

#### Scenario: Handle

- **WHEN** an Item labelled "Apple" has a Handle
- **THEN** the handle is a button named "Reorder Apple" with the instructions as its
  description

### Requirement: Keyboard Reorder

On a Handle, Space or Enter SHALL pick the item up (`aria-pressed="true"`). The arrows along
the orientation SHALL move it one position, and Home / End to the first / last. Each move
SHALL call `onReorder` with the new order. Space or Enter SHALL drop. Escape SHALL restore
the order from the pick-up. Blur SHALL drop. Focus SHALL stay on the Handle.

#### Scenario: Positions, not pixels (dnd-kit #2106)

- **WHEN** the user picks up "Apple" at position 1 of 3 and presses ArrowDown twice
- **THEN** the order is Banana, Cherry, Apple and focus is on Apple's handle

#### Scenario: Cancel

- **WHEN** the user picks up "Apple", moves it and presses Escape
- **THEN** the order is the one before the pick-up

### Requirement: Quick Move

Alt+Arrow on a Handle SHALL move its item one position without picking it up. `MoveButton`
SHALL do the same by pointer, carrying `aria-disabled` at the ends.

#### Scenario: Single-pointer alternative (WCAG 2.5.7)

- **WHEN** the user clicks "Move down" in Apple's item
- **THEN** Apple moves one position down

### Requirement: Pointer Drag

A drag SHALL start from a Handle (or from the Item with `handle={false}`) after a 4 px move,
or after a 300 ms press on touch. The dragged item SHALL follow the pointer. The Indicator
SHALL show the drop position, from the items' midpoints. Dropping SHALL call `onReorder` once.
Escape SHALL cancel. The scroll container SHALL auto-scroll near its edges.

#### Scenario: Drop

- **WHEN** the user drags "Apple" below "Cherry" and releases
- **THEN** `onReorder` is called once with Banana, Cherry, Apple

### Requirement: Announcements

Pick up, every move, drop, cancel and quick moves SHALL be announced politely with the
item's label and its position from the current order, each replacing the previous.

#### Scenario: Current positions (dnd-kit #1858)

- **WHEN** "Apple" is moved twice
- **THEN** the last announcement says position 3 of 3

### Requirement: No Trapped Session

A session SHALL keep no document listener once it ends. The active item leaving `items`
mid-session (removed, filtered) SHALL end it. A pointer press outside the active handle SHALL drop a keyboard
session.

#### Scenario: Source removed (React Aria #10599)

- **WHEN** the picked-up item is removed from `items`
- **THEN** the session ends and the keyboard works normally

### Requirement: Disabled Items

An Item with `disabled` SHALL NOT be picked up, dragged or quick-moved, and other items MAY
move past it.

#### Scenario: Disabled

- **WHEN** Space is pressed on a disabled item's handle
- **THEN** nothing is picked up

### Requirement: Data Attributes

Parts SHALL carry `data-scope="sortable"`, `data-part` and `data-instance`. Items SHALL carry
`data-value`, `data-index`, `data-active`, `data-dragging` and `data-disabled`. The Root SHALL
carry `data-orientation` and `data-state`.

#### Scenario: Active

- **WHEN** an item is picked up
- **THEN** it carries `data-active`

### Requirement: Contract

The Sortable SHALL ship `sortableContract` with the actions `pickUp`, `move`, `drop`,
`cancel`, `quickMove` and `drag`, the queries `order`, `active` and `pressed`, and a
`getSortable` driver.

#### Scenario: Driver

- **WHEN** a test calls `quickMove("Apple", 1)`
- **THEN** `order()` puts Apple second

### Requirement: Theme

`@rind-ui/theme` SHALL ship `sortable.css` in `@layer rind.components` with `:where()`
selectors, family `decoration`: a grip on empty handles, a raised active item, the
indicator line, reduced-motion and forced-colours support.

#### Scenario: Indicator

- **WHEN** an item is dragged
- **THEN** the Indicator is a visible line at the drop position

