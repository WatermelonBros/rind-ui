## MODIFIED Requirements

### Requirement: Location By Accessible Name

Locating an instance SHALL use role and exact accessible name first. The role MAY be given
as a set of roles, for a component whose locating part changes role with its state; the
lookup SHALL then match an element that has any one of those roles and the exact name, and
the uniqueness rule below SHALL apply across all of them. Parts SHALL be resolved through
`data-scope`, `data-part` and `data-instance`, document-wide, so portalled parts belong to
the right instance. When a lookup matches more than one element, it SHALL fail and list
every match.

#### Scenario: Duplicated accessible name

- **WHEN** a hidden native control duplicates a visible control's role and name
- **THEN** locating fails and the failure lists both elements

#### Scenario: Two instances on a page

- **WHEN** two instances are rendered and one is located by name
- **THEN** parts of the other instance are never returned, including portalled parts

#### Scenario: Locating by a set of roles (regression: adobe/react-spectrum#8354)

- **WHEN** a contract locates by the roles `grid`, `group` and `list` with the name
  "Filters", and the Tag Group named "Filters" is emptied so its List changes from role
  `grid` to role `group`
- **THEN** the same instance is still located by role and exact name, and a second element
  with role `list` named "Filters" makes the lookup fail listing both elements
