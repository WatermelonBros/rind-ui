---
"@rind-ui/core": minor
"@rind-ui/react": minor
"@rind-ui/testing": minor
---

Breaking (unreleased): one component per control. `Checkbox` and `Toggle` are no longer exported.
- `Checkbox.Root`, `Control`, `Indicator`, `Label` and `Description` become `CheckboxGroup.Item`, `ItemControl`, `ItemIndicator`, `ItemLabel` and `ItemDescription`.
- `Toggle.Root` and `Indicator` become `ToggleGroup.Item` and `ItemIndicator`.
- An Item outside any Root is the single control: no group wrapper and no roving.
- The item machines, contracts and drivers (`getCheckbox`, `getToggle`) are unchanged.
