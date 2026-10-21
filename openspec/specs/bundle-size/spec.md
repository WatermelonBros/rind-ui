# bundle-size Specification

## Purpose
Defines what a consumer downloads when it imports one rind-ui component: per-component
gzip budgets checked in CI, and the rule that tooling-only data never ships in runtime code.
## Requirements
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

### Requirement: Long Press Is Shipped Only Where Used

A pressable component that does not opt into long press SHALL NOT contain the long-press
implementation in its bundle. Opting in SHALL keep every `press-interactions` long-press
behaviour unchanged.

#### Scenario: Switch

- **WHEN** `Switch` is bundled from `@rind-ui/react/switch`
- **THEN** the output does not contain the long-press module

#### Scenario: Context Menu

- **WHEN** `ContextMenu` is bundled and its trigger is held on touch for 500 ms
- **THEN** the bundle contains the long-press module and the menu opens with no trailing press,
  as before

