## Why

The library shipped single+group duplicates (Checkbox and Checkbox Group, Toggle and Toggle Group). A group of one is the single control, so the user decided to keep the group only: one component each, whose Item part keeps today's single behaviour when used alone. The components are unreleased, so the break is free.

## What Changes

- **BREAKING** `Checkbox` and `Toggle` are no longer exported. `Checkbox.Root`/`Control`/`Indicator`/`Label`/`Description` become `CheckboxGroup.Item`/`ItemControl`/`ItemIndicator`/`ItemLabel`/`ItemDescription`; `Toggle.Root`/`Indicator` become `ToggleGroup.Item`/`ItemIndicator`.
- An Item outside any Root is the single control: no group wrapper, no roving.
- The `checkbox` and `toggle` capabilities merge into `checkbox-group` and `toggle-group` as "Item …" requirements. The item machines, contracts and drivers (`getCheckbox`, `getToggle`) stay.
- Docs, site examples, ARIA snapshots and the inventory merge into the group pages.

## Capabilities

### New Capabilities

### Modified Capabilities

- `checkbox`: every requirement moves to `checkbox-group`.
- `checkbox-group`: gains the item requirements and the alone-or-in-a-group rule.
- `toggle`: every requirement moves to `toggle-group`.
- `toggle-group`: gains the item requirements and the alone-or-in-a-group rule.

## Impact

`@rind-ui/react` exports, the docs pages, site examples and fixtures, ARIA snapshot names, and `docs/components.md`. Core is unchanged except a `toggle-group` item-indicator part.
