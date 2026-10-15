## Purpose

Defines the contract fragment, driver actions and queries, traits and generic
invariants that every rind-ui collection component inherits, and the reference fixture
that proves the collection layer end to end in both focus strategies.

## ADDED Requirements

### Requirement: Collection Contract Fragment

`@rind-ui/core` SHALL provide a contract fragment that a collection component's contract
includes, declaring the anatomy parts `list`, `item`, `section` and `section-label`, and
these actions: `highlight(name)` (pointer: move over the item; keyboard: arrow to it),
`choose(name)` (pointer: press; keyboard: highlight then Enter or Space as the component
declares), `toggle(name)`, `chooseRange(from, to)` (pointer: press then Shift+press;
keyboard: highlight, then Shift+arrows), `selectAll()` (keyboard: mod+A) and
`typeahead(text)`; and these queries: `items()` (accessible names in order),
`highlighted()` (name or null), `selected()` (names), `isDisabled(name)` and
`focusedItem()` (the focused or active-descendant item). Items SHALL be located by role
and exact accessible name. Every pointer action SHALL have a keyboard implementation.

#### Scenario: Choose by keyboard

- **WHEN** a test runs `choose("Italy")` with the keyboard modality
- **THEN** the driver highlights "Italy" with arrow keys and activates it, and resolves
  when `selected()` contains "Italy"

#### Scenario: Active descendant counts as focused

- **WHEN** `focusedItem()` is queried on a combobox whose `aria-activedescendant` points
  at "Rome"
- **THEN** it returns "Rome"

### Requirement: Selectable Trait

The `selectable` trait and its checks (explicit `aria-selected`/`aria-checked`, at most
one selected item in single mode, selection equal to the oracle's and independent of
the highlight) are defined by `model-based-testing` (`add-foundations`) and SHALL be
reused, not redefined. This change SHALL compute the oracle's selection from the
selection model and SHALL add one check: no disabled item was added to the selection
by the step.

#### Scenario: Missing aria-selected

- **WHEN** a wrapper renders unselected options without `aria-selected`
- **THEN** the step fails naming the option and the attribute

#### Scenario: Highlight leaks into selection state

- **WHEN** a broken component sets `aria-selected="true"` on the highlighted option
- **THEN** the step fails because it differs from the oracle's selection

### Requirement: Set Metadata Trait

The `set-metadata` trait and its checks (`1 ≤ posinset ≤ setsize`, unique positions,
equal to visible order) are defined by `model-based-testing` (`add-foundations`) and
SHALL be reused, not redefined. This change SHALL add one check: `aria-setsize` equals
the item count of the current collection (or of the sibling set, for trees), including
items not rendered because of virtualization.

#### Scenario: Stale index after filter

- **WHEN** a filtered list renders an item with `aria-posinset="14"` and
  `aria-setsize="2"`
- **THEN** the step fails

### Requirement: Composite Invariants Use The Collection

The foundations' `composite-roving` and `composite-activedescendant` invariants SHALL be
checked for every collection contract according to its declared focus strategy, and the
runner SHALL additionally check that at most one item carries `data-highlighted`, that
it matches the oracle's highlighted key, and that focus is never on `<body>` after a
step that removed or filtered out the focused item. The "exactly one tab stop" check of
`composite-roving` SHALL ignore elements with `data-part="item-control"` (controls inside a
row, which belong to the row's tab group), and SHALL be computed over the visible collection
in trees.

#### Scenario: Controls inside a row

- **WHEN** a row contains two elements with `data-part="item-control"` that have
  `tabindex="0"` and the row is the roving tab stop
- **THEN** the "exactly one tab stop" check passes

#### Scenario: Two highlighted items

- **WHEN** a step leaves two items with `data-highlighted`
- **THEN** the step fails naming both

### Requirement: Argument Classes For Generated Paths

Collection contracts SHALL be able to supply, for model-based paths, the collections and
props that make guards true and false: an empty collection, a single item, every item
disabled, a disabled neighbour of the highlight, a section boundary, the first and last
items, and a selected disabled item. The runner SHALL run each generated path under each
supplied configuration.

#### Scenario: All-disabled configuration

- **WHEN** the runner executes the paths of a collection fixture with every item disabled
- **THEN** every navigation step leaves the highlight empty and the container reachable,
  and the run completes

### Requirement: Reference Fixture

`@rind-ui/testing` SHALL contain an unpublished `listbox` fixture (machine, connect,
contract, React parts, stories) built only on the collection modules, renderable with
either focus strategy, with sections, disabled items, typeahead, multiple selection and
a virtualized story. Its driver tests SHALL pass unchanged in browser mode, in jsdom with
`@rind-ui/testing/setup`, and through the Playwright adapter, and its model-based tests
SHALL cover every transition in every declared modality and both directions.

#### Scenario: Same test, both strategies

- **WHEN** the fixture's driver test runs against the roving and the active-descendant
  variants
- **THEN** both pass without changes to the test

#### Scenario: Broken variant

- **WHEN** the model-based tests run on a variant that resets the highlight to the first
  item on every collection change
- **THEN** a repair scenario fails with the path that reproduces it
