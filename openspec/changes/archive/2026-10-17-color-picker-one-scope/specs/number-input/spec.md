## ADDED Requirements

### Requirement: Hosted Naming

A Number Input rendered as another component's part (a Color Picker's) SHALL be able to take the host's `data-scope` and the host's
`data-part` name for each of its parts, through an optional naming input of its connect function; its behaviour and its other
attributes SHALL NOT change. Without that input it SHALL keep its own scope and part names.

#### Scenario: Hosted

- **WHEN** a Number Input is rendered with the naming `{ scope: "color-picker", part: … }`
- **THEN** every part carries `data-scope="color-picker"` and the host's part name (for example `channel-input`)

#### Scenario: Not hosted

- **WHEN** a Number Input is rendered with no naming
- **THEN** its parts carry its own scope and part names, as before
