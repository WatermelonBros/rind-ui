## ADDED Requirements

### Requirement: Components Ship Only The Capabilities They Use

A component bundle SHALL NOT contain the implementation of an on-demand capability that
none of its parts requests.

#### Scenario: Switch

- **WHEN** `Switch` is bundled from `@rind-ui/react/switch` (its machine announces nothing)
- **THEN** the output contains no live-announcer, clipboard or collection-layout implementation

#### Scenario: Button announces

- **WHEN** `Button` is bundled from `@rind-ui/react/button`
- **THEN** the output contains the live announcer (for its pending announcement) and no
  clipboard or collection-layout implementation

#### Scenario: Clipboard

- **WHEN** `Clipboard` is bundled from `@rind-ui/react/clipboard`
- **THEN** the output contains the clipboard and announcer implementations and none of the
  other on-demand ones
