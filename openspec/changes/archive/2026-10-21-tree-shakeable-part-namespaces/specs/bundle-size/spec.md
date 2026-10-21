## ADDED Requirements

### Requirement: Minimal Composition Budgets

Every compound component exposed as a part namespace SHALL have a budget for its root part
alone besides the budget for the full namespace. The size check SHALL bundle `<Name>.Root`
with Rolldown, referencing no other part, and fail when it exceeds its budget.

#### Scenario: Root over budget

- **WHEN** a change makes `Dialog.Root` alone larger than its root budget
- **THEN** the size check fails naming `Dialog.Root`, its size and its budget

#### Scenario: Compound component without a root budget

- **WHEN** a part namespace has no root entry in the budgets file
- **THEN** the size check fails naming it
