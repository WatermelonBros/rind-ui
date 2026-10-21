## ADDED Requirements

### Requirement: Long Press Is Shipped Only Where Used

A pressable component that does not opt into long press SHALL NOT contain the long-press
implementation in its bundle. Opting in SHALL keep every `press-interactions` long-press
behaviour unchanged.

#### Scenario: Button

- **WHEN** `Button` is bundled from `@rind-ui/react/button`
- **THEN** the output does not contain the long-press module

#### Scenario: Context Menu

- **WHEN** `ContextMenu` is bundled and its trigger is held on touch for 500 ms
- **THEN** the bundle contains the long-press module and the menu opens with no trailing press,
  as before
