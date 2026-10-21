## ADDED Requirements

### Requirement: Components Ship Only The Capabilities They Use

A component bundle SHALL NOT contain the implementation of an on-demand capability that
none of its parts requests.

#### Scenario: Button

- **WHEN** `Button` is bundled from `@rind-ui/react/button`
- **THEN** the output contains no live-announcer, clipboard, collection-layout,
  constraint-validity, page-visibility or date-clock implementation

#### Scenario: Clipboard

- **WHEN** `Clipboard` is bundled from `@rind-ui/react/clipboard`
- **THEN** the output contains the clipboard and announcer implementations and none of the
  other on-demand ones
