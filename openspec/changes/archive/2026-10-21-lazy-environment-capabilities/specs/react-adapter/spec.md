## ADDED Requirements

### Requirement: Requested Capabilities

A part SHALL obtain the environment from the provider (or the default environment when
there is none) by naming the on-demand capabilities its machine needs. The environment it
receives SHALL have the base capabilities and exactly the requested ones; passing it to a
machine whose environment needs a capability that was not requested SHALL be a compile
error. Two parts under one provider requesting the same capability SHALL receive the same
instance.

#### Scenario: Missing capability

- **WHEN** a part binds the Clipboard machine with an environment that requested the
  announcer but not the clipboard
- **THEN** the code does not compile

#### Scenario: Shared announcer

- **WHEN** a Select and a Toast under one provider both request the announcer
- **THEN** they announce through the same live regions

#### Scenario: No provider

- **WHEN** a part requesting the announcer renders with no provider
- **THEN** it receives a working announcer from the default environment
