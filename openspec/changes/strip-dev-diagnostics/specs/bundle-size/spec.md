## ADDED Requirements

### Requirement: Production Bundles Carry No Development Diagnostics

A development diagnostic (a message about misuse that the consumer must fix) SHALL be emitted
only when `process.env.NODE_ENV` is not `"production"`, and a production bundle SHALL contain
neither its message nor the code that builds it. A runtime failure report (a consumer-supplied
callback threw or rejected) SHALL be emitted in every build. The size check SHALL bundle the
whole library for production and fail on any `[rind-ui]` message that is not a declared
failure report.

#### Scenario: Diagnostic in production

- **WHEN** the whole library is bundled with `process.env.NODE_ENV` set to `"production"`
- **THEN** the output contains no development diagnostic message

#### Scenario: Diagnostic in development

- **WHEN** a Tour is sent `goto` with an id that no step has, in development
- **THEN** a `[rind-ui] tour` diagnostic is written to the console

#### Scenario: Failure report in production

- **WHEN** a Tour step's effect throws in a production build
- **THEN** the error is reported to the console with the step id

#### Scenario: New leak

- **WHEN** a change adds a warning outside the diagnostics helpers
- **THEN** lint fails
