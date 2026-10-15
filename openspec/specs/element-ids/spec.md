# element-ids Specification

## Purpose
Defines the single, framework-neutral rule that turns a component's root id and a
part name or item key into element ids, so connect and every framework adapter
produce identical, valid, SSR-stable ids for ARIA relations.
## Requirements
### Requirement: Framework-Neutral Id Derivation

`@rind-ui/core` SHALL provide the only function that derives part and item ids from a
scope, a root id, a part name and an optional item key, in the form
`<scope>-<root>-<part>` and `<scope>-<root>-<part>-<key>`; connect and every adapter
SHALL use it. Item keys SHALL be encoded so the id contains no whitespace (IDREF lists
are space-separated) and two distinct keys never produce the same id. The root id's
internal format SHALL never be parsed; elements SHALL be looked up by id, never by an
id built into a CSS selector.

#### Scenario: Key with a space

- **WHEN** an item with key `"New York"` gets an id
- **THEN** the id contains no whitespace and `aria-labelledby` listing it resolves to
  that single item

#### Scenario: Distinct keys

- **WHEN** items with keys `"a b"` and `"a-b"` get ids in the same instance
- **THEN** their ids differ

#### Scenario: Same id on server and client

- **WHEN** the function is called with the same arguments in Node and in a browser
- **THEN** it returns the same string

