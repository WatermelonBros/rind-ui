## 1. API

- [x] 1.1 `CheckboxGroup.Item`/`ItemIndicator` (the former Checkbox parts); `ToggleGroup.Item` alone or in a group, `ToggleGroup.ItemIndicator` (toggle-group connect `itemIndicator`); `Checkbox` and `Toggle` no longer exported
- [x] 1.2 Tests for a lone Item (no group wrapper, no roving) and the item indicator in both shapes

## 2. Usages

- [x] 2.1 Tests, fixtures, site examples and components moved to the group names; single example files merged into the group ones; ARIA snapshots renamed
- [x] 2.2 Docs merged into checkbox-group.md / toggle-group.md (opening with "When to use"); links retargeted; metas merged; `docs/components.md` rows merged

## 3. Checks

- [x] 3.1 Typecheck, lint, docs check, targeted tests (jsdom, browsers, examples harness); changeset
