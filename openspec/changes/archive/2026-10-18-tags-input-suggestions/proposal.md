## Why

Tags Input already specifies Suggestions (tags-input "Suggestions"): with a `collection` it is the
`combobox-pattern` input over it, in one machine. Nothing of it is implemented, and its
suggestion list parts would copy the listbox parts. Split from `add-combobox-variants`
(coordinator, 2026-10-18) so the Combobox variants could ship; picked up by rind-ui-ca.

Research (done): [tags-input](../../../docs/research/tags-input.md) ·
[combobox](../../../docs/research/combobox.md).

**Depends on** `add-combobox-variants` (the inline and free-text Combobox, `optionsNeverSelected`
in `combobox/pattern`) and the archived `add-tags-input`.

## What Changes

- **Pattern extraction:** the highlight-while-typing actions and guards, `ACTIVEDESCENDANT.FLUSH`
  scheduling, collection repair, count and no-results announcements, composition tracking,
  Enter-on-highlight, `patternConnect` (input, listbox, option and empty props, with `expanded`
  from the host's `exposed`) and the contract fragment move from `combobox.machine.ts` /
  `combobox.connect.ts` into `combobox/pattern/`. Combobox spreads them with no behaviour
  change; its suites are the regression check.
- **Tags Input Suggestions:** the Tags Input machine spreads the same pattern for its existing
  Suggestions requirement; React suggestion parts (Positioner, Popup, List, Item, ItemText,
  Group, GroupLabel, Separator, Empty) are the reusable listbox parts; driver, model
  configuration with suggestions, docs section.
- **`tags-input` (modified):** Anatomy (the suggestion parts are the listbox parts, no copy),
  Suggestions (`closeOnChoose` becomes `closeOnSelect`, one name across the pattern's hosts).

## Capabilities

### Modified Capabilities

- `tags-input`: Anatomy, Suggestions.

## Non-goals

- Mentions; async suggestion sources beyond the pattern's async rules.

## Impact

- `packages/core/src/components/combobox/pattern/`, `combobox.machine.ts`, `combobox.connect.ts`
  (moved code), `packages/core/src/components/tags-input/`, `packages/react/src/tags-input/`,
  `@rind-ui/testing` (Tags Input driver and model), theme and site sections.
