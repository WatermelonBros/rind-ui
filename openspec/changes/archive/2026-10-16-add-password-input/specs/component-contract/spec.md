## MODIFIED Requirements

### Requirement: Environment Interface

Contracts SHALL be written only against an environment interface that offers:
resolving a part of the current instance (optionally refined by role and name, by the
exact accessible name of a labelable control that has no role, or by text); finding an
element anywhere in the document; the focused element; keyboard input to the focused element; a pointer press outside every layer; polling until a
condition holds; advancing time; and the active input modality. Part handles SHALL
be lazy (resolved on every use), and every operation SHALL be asynchronous. Keys
SHALL be a closed, typed set.

#### Scenario: Lazy handle

- **WHEN** an action obtains a part handle and the element is re-rendered before
  the handle is used
- **THEN** the handle acts on the current element
