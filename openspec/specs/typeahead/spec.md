# typeahead Specification

## Purpose
Defines the single typeahead behaviour every rind-ui collection component shares:
which keys start or extend a search, how matches are found and cycled, how long a
search lasts, and when it resets, so the rules cannot drift between components.
## Requirements
### Requirement: What Starts And Extends A Search

A printable character typed while the collection has focus SHALL start a search or
extend the current one. Space SHALL extend a search in progress and SHALL then not
perform the component's Space action; Space with no search in progress SHALL NOT start
one. Key events with Ctrl, Meta or Alt held, and key events that are part of an IME
composition (`isComposing`, or `keyCode` 229), SHALL be ignored. A component MAY
disable typeahead; components with a text input (Combobox, Autocomplete, Command) SHALL
NOT use it.

#### Scenario: Space inside a search

- **WHEN** the user types "Item", Space, "1", "0" within the timeout in a listbox with
  "Item 1" and "Item 10"
- **THEN** "Item 10" is highlighted and Space selected nothing

#### Scenario: Shortcut is not typeahead

- **WHEN** the user presses mod+A in a multiple-selection list
- **THEN** the typeahead buffer is unchanged

#### Scenario: Composition

- **WHEN** a key event with `isComposing` set reaches the collection
- **THEN** the buffer and the highlight are unchanged

### Requirement: Matching

The search string SHALL match an item when the item's text value starts with it,
compared with a locale-aware collator that ignores case and diacritics, using the
component's locale. Matching SHALL run over the whole collection, including items that
are not mounted, and SHALL wrap from the end to the start. Disabled items SHALL be
skipped unless they are navigable (`focusableWhenDisabled`). Every typeahead path of a
component (open list, closed trigger) SHALL use the same matcher. A match SHALL
highlight the item (with source `typeahead`) and scroll it into view; it SHALL select
it only where the component's pattern says so (for example a closed single select).

#### Scenario: Accent-insensitive

- **WHEN** the user types "e" in a list containing "École" for locale `fr`
- **THEN** "École" is highlighted

#### Scenario: Unmounted match

- **WHEN** the only match is far outside the rendered window of a virtualized list
- **THEN** it is highlighted and the scroll-to-index callback is called for it

### Requirement: Cycling And Growing Queries

A search that consists of one character repeated SHALL cycle through items starting
with that character, beginning after the highlighted item, unless some item starts with
the full repeated string, in which case that item SHALL match. A growing
multi-character search SHALL be matched starting from the highlighted item inclusive,
so the highlight does not jump away from an item that still matches.

#### Scenario: Repeated letter cycles

- **WHEN** the user types "d", "d", "d" in a list of "Dog", "Duck", "Deer"
- **THEN** the highlight goes "Dog", "Duck", "Deer"

#### Scenario: Repeated letters that form a word

- **WHEN** the user types "a", "a" in a list of "Apple", "Aaron"
- **THEN** "Aaron" is highlighted

#### Scenario: Growing query stays

- **WHEN** "Bob A" and "Bob B" exist and the user types "B", "o", "b", " ", "B"
- **THEN** the highlight moves to "Bob A" and then to "Bob B", never bouncing back

### Requirement: Timing And Lifecycle

A search SHALL end after the typeahead timeout — 1000 ms by default, set once for a
tree through the provider and overridable per component, as the `keyboard-interactions`
capability (`add-a11y-foundations`) defines — counted from the last character that
extended it and measured with the environment's clock, so no timer has to be cancelled
and fake clocks control it. Typeahead SHALL ignore key events the IME guard
(`notComposing`) rejects. A search
SHALL also end when nothing matches (the highlight unchanged), when focus leaves the
composite (including its popup), and when the component's value is reset. The timeout
SHALL be configurable per component and through the provider.

#### Scenario: Timeout

- **WHEN** the user types "b", waits 1,100 ms, then types "a"
- **THEN** the second search is "a", not "ba"

#### Scenario: No match

- **WHEN** the user types "x" in a list without any item starting with "x"
- **THEN** the highlight is unchanged and the next character starts a new search

#### Scenario: Reset after blur

- **WHEN** a search is in progress and focus leaves the component
- **THEN** the next character typed after focus returns starts a new search

### Requirement: Production Parity

Typeahead SHALL behave identically in development and production builds; the test
suite SHALL exercise it against the built, minified package output.

#### Scenario: Minified build

- **WHEN** the typeahead tests run against the published bundle
- **THEN** they pass unchanged

