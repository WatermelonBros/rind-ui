## ADDED Requirements

### Requirement: JSON Tree View Is A Tree View

A JSON Tree View SHALL render Tree View's parts and use Tree View's machine, keyboard,
focus, expansion, virtualisation and contract unchanged, with selection `none` by default.
Its item text SHALL consist of `Key`, `Separator`, `Value` or `Summary`, and an optional
`Preview`. An optional `CopyTrigger` SHALL be a native `<button type="button">` outside the
items.

#### Scenario: Tree keyboard

- **WHEN** focus is on a collapsed object item and ArrowRight is pressed
- **THEN** the item expands, as in Tree View

### Requirement: JSON Tree View Keys

Every item's key SHALL be the JSON Pointer (RFC 6901) of its value: `~` escaped as `~0`, `/`
as `~1`. The top-level value's entries SHALL be the tree's roots (level 1); a primitive
top-level value SHALL render one leaf. Range group keys SHALL be the container's pointer
followed by `#first-last`, which no property pointer can equal.

#### Scenario: No dotted-path collision (regression: Zag)

- **WHEN** the value is `{ "a.b": 1, "a": { "b": 2 } }` and every container is expanded
- **THEN** the two leaves have the keys `/a.b` and `/a/b`

### Requirement: JSON Tree View Lazy Materialisation

Children SHALL be built only for expanded containers; a collapsed container SHALL be a branch
whose children are not computed. Expanding SHALL build only what becomes visible,
synchronously, with no loading state.

#### Scenario: A large value opens fast (regression: Zag, vue-json-pretty)

- **WHEN** a value with 100 000 nested objects is rendered with `defaultExpandedDepth` 1
- **THEN** fewer than 200 items are built

### Requirement: JSON Tree View Types

The view SHALL render `string`, `number` (including `NaN`, `±Infinity`, `-0`), `bigint`,
`boolean`, `null`, `undefined`, `object`, `array` (sparse arrays by their defined indexes),
`map`, `set`, `date`, `regexp`, `error`, `function`, `symbol`, and any other object with a
non-plain prototype as a one-line leaf naming its constructor. Only own enumerable string keys
SHALL be shown.

#### Scenario: Sparse array (regression: crash)

- **WHEN** the value is `[1, , 3]`
- **THEN** two items, `0` and `2`, are rendered, and the summary counts 3

#### Scenario: BigInt

- **WHEN** a leaf's value is `12345678901234567890n`
- **THEN** its Value text is `12345678901234567890`

### Requirement: JSON Tree View Grouping

A container with more than `groupSize` (default 100) children SHALL show range branches of
`groupSize` children with inclusive bounds, nested by powers of `groupSize` when needed.

#### Scenario: Ranges

- **WHEN** an array of 250 items is expanded
- **THEN** its children are three range branches labelled 0–99, 100–199 and 200–249

### Requirement: JSON Tree View Cycles

A container whose value is one of its ancestors SHALL render as a leaf of type `circular`
with `messages.circular`; the same value at a non-ancestor position SHALL render normally.

#### Scenario: Shared is not circular (regression: Zag)

- **WHEN** one object is referenced by two sibling keys
- **THEN** both are expandable containers, none is `circular`

### Requirement: JSON Tree View Item Names

An item's accessible name SHALL be its visible text: key, separator, value, and for a
container the spoken summary from `messages.summary` ("object, 4 entries") while the glyph
summary and the Preview are `aria-hidden`. Strings SHALL be escaped and never truncated in the
DOM.

#### Scenario: Name of a container

- **WHEN** an object item `address` with 4 entries is rendered
- **THEN** its name is "address: object, 4 entries" and it has no `aria-label`

### Requirement: JSON Tree View Expansion

`defaultExpandedDepth` (default 1) SHALL apply to the first value only; a new `data` SHALL
keep the expanded keys. `expandAll({ depth })` SHALL expand containers down to `depth`
(default one level deeper than currently open) and SHALL stop before more than
`maxExpandNodes` (default 5000) items would be visible.

#### Scenario: Bounded expand all

- **WHEN** `expandAll()` is called on a value with a million nodes
- **THEN** at most 5000 items are visible

### Requirement: JSON Tree View Copy

`Mod+C` on a focused item SHALL copy it through the native `copy` event's `clipboardData`,
and a press of the CopyTrigger SHALL copy the highlighted item through the Clipboard
capability, in `copyFormat` (`json` default, `value`, `pointer`), with Clipboard's copy states
and announcements. `json` SHALL serialise BigInt as digits and Map and Set as
arrays of entries; a cycle in the subtree SHALL give the `error` state.

#### Scenario: Failure is reported (regression: react-json-view)

- **WHEN** a subtree containing a cycle is copied as JSON
- **THEN** the copy state is `error` and "Copy failed" is announced

#### Scenario: Pointer copy

- **WHEN** `/address/street` is focused and copied with `copyFormat="pointer"`
- **THEN** the clipboard holds `/address/street`

### Requirement: JSON Tree View Data Attributes

Items SHALL carry Tree View's attributes plus `data-type`, `data-key` (the pointer),
`data-range` on range groups and `data-empty` on empty containers; the Value part SHALL carry
`data-type` and, for strings, `data-quoted`.

#### Scenario: Types for styling

- **WHEN** a `null` leaf is rendered
- **THEN** its item and its Value have `data-type="null"`

### Requirement: JSON Tree View Messages

The strings SHALL come from `messages`: `summary(type, count)`, `circular`, `range(first,
last)`, plus Clipboard's copy messages, with English defaults, each replaceable.

#### Scenario: Localised summary

- **WHEN** `messages.summary` returns "oggetto, 4 voci"
- **THEN** the object's name ends with "oggetto, 4 voci"

### Requirement: JSON Tree View Contract

The contract SHALL extend Tree View's with the queries `nodeAt`, `valueText`, `summaryOf`,
`copyState` and the action `copy`.

#### Scenario: Driver

- **WHEN** a test calls `getJsonTreeView(root).valueText("/name")`
- **THEN** it returns the Value text of that leaf

### Requirement: JSON Tree View Theme

`@rind-ui/theme` SHALL style the item text in the monospaced font with the code block's type
colours at 4.5:1 in light and dark, clip long strings with an ellipsis, and style ranges and
circular leaves distinctly, with forced-colors fallbacks.

#### Scenario: String colour contrast

- **WHEN** a string leaf is rendered in the dark scheme
- **THEN** its Value text has at least 4.5:1 contrast with the surface
