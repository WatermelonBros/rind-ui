## Purpose

Defines what a consumer downloads when it imports one rind-ui component: per-component
gzip budgets checked in CI, and the rule that tooling-only data never ships in runtime code.

## ADDED Requirements

### Requirement: Per-Component Budgets

Every public component of `@rind-ui/react` SHALL have a gzip budget in
`scripts/size-budgets.json`. CI SHALL bundle each component the way an application bundler
does (minified, production, React external), once imported from the package root and once
from its subpath, and SHALL fail when either size exceeds the budget or when a component has
no budget. `Button` imported alone SHALL stay at or below 10% of the whole library.

#### Scenario: Over budget

- **WHEN** a change makes `Button` imported from `@rind-ui/react/button` larger than its budget
- **THEN** the size check fails naming `Button`, its size and its budget

#### Scenario: New component without a budget

- **WHEN** a new component subpath is exported and has no entry in the budgets file
- **THEN** the size check fails naming the component

### Requirement: Runtime Bundles Exclude Tooling Metadata

A component bundle SHALL NOT contain data that only tooling reads: quirk bug links, repro
test paths, removal conditions and verification dates. The size check SHALL fail when a
component bundle contains any of them.

#### Scenario: Button bundle

- **WHEN** `Button` is bundled from `@rind-ui/react/button`
- **THEN** the output contains no quirk link URL, no repro test path and no removal condition

#### Scenario: Metadata leaks back

- **WHEN** a runtime module imports the quirk metadata
- **THEN** the size check fails naming the components whose bundle contains it
