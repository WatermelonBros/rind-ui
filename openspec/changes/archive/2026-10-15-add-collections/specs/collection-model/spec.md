## Purpose

Defines the single immutable, key-based model of items, sections and trees that every
rind-ui collection component uses, whether its items come from data or from
statically authored parts, and how it relates to machine snapshots, async loading,
filtering and virtualization.

## ADDED Requirements

### Requirement: Keys

Every node in a collection SHALL have a key that is a string, typed as a branded
collection key that cannot be confused with other strings at compile time inside
`@rind-ui/core`. Component props that take values (for example `value`, `defaultValue`)
SHALL accept plain strings and brand them at that boundary. Keys SHALL be
unique within a collection. Building a collection with a duplicate key SHALL fail in
development with an error naming the key and both items; in production the later
duplicate SHALL be ignored, and no operation SHALL loop or hang because of it.

#### Scenario: Duplicate key

- **WHEN** a collection is built in development from two items whose key is `"fr"`
- **THEN** building fails with an error naming `"fr"` and both items

#### Scenario: Plain string is not a key

- **WHEN** core code passes an unbranded `string` (for example an element id) to a
  collection operation that expects a key
- **THEN** it does not compile

#### Scenario: Component value stays a string

- **WHEN** a consumer passes `value="fr"` to a collection component
- **THEN** it compiles and selects the item whose key is `"fr"`

### Requirement: One Model For Lists, Sections And Trees

A collection SHALL be built either from a list of items (optionally grouped into
sections) or from a tree of nodes, with consumer-supplied accessors for the key, the
text value, the disabled flag and, for trees, the children. Nodes SHALL be items or
sections; sections SHALL NOT be navigable or selectable. Each item SHALL expose its
key, text value, disabled flag, the key of its section or parent, its depth (trees),
and its index counted over items only (sections excluded). A collection SHALL answer
lookup by key, membership, item index, item count, first and last key, and the keys
before and after a given key in constant time.

#### Scenario: Index ignores sections

- **WHEN** a collection has a section "Fruit" containing "Apple" followed by "Pear"
- **THEN** "Apple" has index 0 and "Pear" index 1, and the item count is 2

#### Scenario: Constant-time navigation

- **WHEN** the key after the 9,999th item of a 10,000-item collection is requested
  repeatedly
- **THEN** each request takes constant time, independent of the collection size

### Requirement: Static Item Parts Produce The Same Model

A component whose items are authored as parts (for example Tabs or Menu items written
by hand) SHALL produce the same collection model as a data-driven one. Item parts SHALL
register at commit time only (never from a render that is discarded), all registrations
of one commit SHALL be applied as one collection update, and the order SHALL be the
document order of the item elements at that commit. Machines SHALL NOT read DOM order
themselves.

#### Scenario: Item inserted before the others

- **WHEN** a new item part is rendered before every existing item part
- **THEN** the next collection lists it first and the highlighted and selected keys are
  unchanged

#### Scenario: Many items register at once

- **WHEN** 1,000 item parts mount in one commit
- **THEN** the machine receives exactly one collection change

### Requirement: Text Value

Every item SHALL have a text value used for typeahead, filtering, announcements and
form labels, independent of its rendered content. For static item parts it SHALL default
to the item's rendered text content; for data items it SHALL come from the text
accessor. When an item has no text value and its content is not plain text, a
development warning SHALL name the item.

An item MAY also have `keywords` (`readonly string[]`, default empty): extra search terms
(synonyms) that the built-in filters match. For data items they SHALL come from the optional
`getKeywords` accessor; for static item parts from the item part's `keywords` prop. Keywords
SHALL NOT be used for typeahead, announcements or form labels.

#### Scenario: Icon in an item

- **WHEN** an item renders an icon and the label "Delete" and declares the text value
  "Delete"
- **THEN** typeahead and filtering match "Delete", not the icon's text

#### Scenario: Keywords are not typeahead

- **WHEN** a static item part "Remove item" declares `keywords={["delete", "trash"]}` in a
  collection with typeahead
- **THEN** its item node's `keywords` are `["delete", "trash"]`, and typing "t" does not
  highlight it by typeahead

### Requirement: Collections Are Props, Not Snapshot State

A machine SHALL receive its collection through props and SHALL NOT copy items into its
context or snapshot. The snapshot SHALL hold only keys (highlighted key, selection,
anchor, expanded keys) and small scalar state. A collection change SHALL be detected by
reference identity, never by serialising items, and SHALL reach the machine as a single
collection-change event. Reading a selected item's label or a native form value SHALL
use the collection data, so no item part needs to be mounted for it.

#### Scenario: Same collection instance

- **WHEN** a component re-renders with the identical collection instance
- **THEN** no collection-change event is processed and no item re-renders

#### Scenario: Closed select shows its label

- **WHEN** a single-select whose popup is closed has the value `"it"`
- **THEN** the selected label "Italy" and the form value come from the collection and no
  item part is mounted

### Requirement: Derivations

Filtering, inserting, removing and moving items, and computing the visible nodes of a
tree for a set of expanded keys, SHALL return new collections and SHALL leave the
original unchanged. Derived collections SHALL renumber item indexes and counts, and
filtering SHALL drop sections left without items. The library SHALL provide
locale-aware `startsWith` and `contains` filters that ignore case and diacritics and
match an item when its text value or any of its keywords matches the query.

#### Scenario: Filter renumbers

- **WHEN** a collection of 14 items is filtered down to 2
- **THEN** the two items have indexes 0 and 1 and the item count is 2

#### Scenario: Empty section dropped

- **WHEN** a filter removes every item of the section "Vegetables"
- **THEN** the filtered collection does not contain that section

#### Scenario: Diacritics

- **WHEN** the `contains` filter for locale `fr` is applied with the query "ecole"
- **THEN** an item with text value "École" matches

#### Scenario: Filter matches a keyword (dip/cmdk#146)

- **WHEN** the `contains` filter is applied with the query "trash" to the items "Remove item"
  (keywords "delete", "trash") and "Rename"
- **THEN** only "Remove item" matches, and with `startsWith` and the query "del" it matches too

### Requirement: Trees

A tree collection SHALL expose parent, children, depth and sibling position for each
node, and SHALL derive a visible collection from the expanded keys in which collapsed
descendants are absent. A node SHALL be able to declare that it has children that are
not loaded yet; expanding it SHALL request its children once until they arrive or the
request fails.

#### Scenario: Collapsed branch

- **WHEN** branch "src" is collapsed
- **THEN** its descendants are absent from the visible collection and navigation skips
  them

#### Scenario: Lazy children

- **WHEN** a node declared as having unloaded children is expanded twice before its
  children arrive
- **THEN** the children are requested exactly once

### Requirement: Async Status

A collection component SHALL accept a loading status of `idle`, `loading`,
`loading-more` or `error`, and a load-more callback. While loading, the list part SHALL
carry `aria-busy="true"` and `data-loading`. The load-more callback SHALL be called at
most once per collection instance when navigation or the scroll sentinel reaches the
last item and the status is `idle`. Loading rows SHALL NOT be items: they are not
navigable, selectable or counted in set size.

#### Scenario: Load more once

- **WHEN** the user presses End twice on the last page of an idle async list
- **THEN** the load-more callback is called once until a new collection arrives

### Requirement: Virtualization Contract

When a component is told it is virtualized, it SHALL call the consumer's scroll-to-index
callback with the target item's index, key and the reason, instead of scrolling an
element; it SHALL expose the persisted keys (the highlighted key and the key of the
focused item) that the consumer's virtualizer MUST keep mounted; and every rendered item
SHALL carry `aria-posinset` and `aria-setsize` computed from the current collection.
The same SHALL hold for any filtered view (combobox results), virtualized or not: the
values are computed from the filtered collection, in visible order.
Item element ids SHALL be derived from the component's root id and the item key, so a
re-mounted item gets the same id. Navigation, typeahead and select all SHALL operate on
the whole collection, never only on mounted items.

#### Scenario: Navigate to an unmounted item

- **WHEN** the user presses End in a virtualized list of 10,000 items
- **THEN** the last item becomes highlighted, the scroll-to-index callback receives
  index 9999 with reason `navigation`, and the highlighted key is in the persisted keys

#### Scenario: Remount keeps the id

- **WHEN** a highlighted item scrolls out and back into a virtualized list
- **THEN** its element id is the same and `aria-activedescendant` still resolves

#### Scenario: Set metadata after filtering

- **WHEN** a virtualized list is filtered to two items
- **THEN** the rendered items carry `aria-posinset` 1 and 2 and `aria-setsize` 2

### Requirement: Collection Part Attributes

Every item part SHALL carry `data-scope`, `data-part="item"`, `data-key` (the item key),
`data-highlighted` when highlighted, `data-selected` when selected, `data-disabled` when
disabled and `data-focus-visible` when highlighted after keyboard or typeahead
navigation. Section parts SHALL carry `data-part="section"` and section label parts
`data-part="section-label"`. The list part SHALL carry `data-orientation`,
`data-loading` while loading and `data-empty` when the collection has no items.

#### Scenario: Highlighted and selected

- **WHEN** item `"it"` is both highlighted and selected
- **THEN** its element carries `data-key="it"`, `data-highlighted` and `data-selected`

#### Scenario: Empty list

- **WHEN** a filter leaves no items
- **THEN** the list part carries `data-empty`
