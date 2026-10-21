## MODIFIED Requirements

### Requirement: Every UA-Gated Workaround Is An Entry

Every behaviour in rind-ui that differs by browser, platform or assistive technology
SHALL be gated by an entry in the registry of `@rind-ui/core`. Each entry SHALL
have: a stable id; a condition evaluated against the injected platform; at least one
external bug or issue link; the path of the test that reproduces the problem; a
removal condition; the date it was last verified; and the generic invariants it
affects, if any. Code SHALL check an entry by id, never test the user agent or
platform directly for a workaround. The conditions and the rest of each entry SHALL be
declared separately under the same ids: checking an entry at runtime SHALL load the
conditions only, and an id present on one side and missing on the other SHALL be a compile
error. The registry SHALL still be exported as one list of complete entries.

#### Scenario: Entry without a bug link

- **WHEN** an entry is declared with no link
- **THEN** the code does not compile

#### Scenario: Condition without metadata

- **WHEN** a condition is declared for an id that has no links, test, removal condition and
  verification date
- **THEN** the code does not compile

#### Scenario: Workaround outside the registry

- **WHEN** a module under `packages/core` or `packages/react` reads the user agent or a
  platform flag to change behaviour without going through a registry entry
- **THEN** lint fails

#### Scenario: Gated by the injected platform

- **WHEN** a test creates environments for Apple with the WebKit engine, Apple with the
  Blink engine, and Windows
- **THEN** the `vo-activedescendant` entry is active only in the first, and the
  `vo-section-entry` entry is active in the first two only

#### Scenario: Exported registry

- **WHEN** a consumer reads the exported registry
- **THEN** every entry has its id, condition, links, test, removal condition, verification
  date and invariants, as before
