## ADDED Requirements

### Requirement: Minimal Composition Budgets

Every compound component SHALL have a budget for its minimal composition (its root and the
parts the component requires) besides the budget for the full namespace. The size check SHALL
bundle the minimal composition with Rolldown, referencing only those parts, and fail when it exceeds its
budget.

#### Scenario: Minimal Color Picker over budget

- **WHEN** a change makes a Color Picker using only Root, Area and ChannelSlider larger than its
  minimal budget
- **THEN** the size check fails naming the composition, its size and its budget

#### Scenario: Compound component without a minimal budget

- **WHEN** a compound component has no minimal-composition entry in the budgets file
- **THEN** the size check fails naming it
