## Why

Labels, keywords, filters and recipients are shown as tags that the user browses, selects
and removes. Every library that ships it has a bug history around the same three things:
focus is lost to `<body>` after a removal (adobe/react-spectrum#9471, #4224, #6616), the
remove path is either undiscoverable or doubles the Tab stops (adobe/react-spectrum#7483 vs
#9822), and the role breaks when the group is empty or holds a button
(adobe/react-spectrum#8354, ariakit/ariakit#6330). Collections already specifies keys,
roving focus and repair after removal; Tag Group adds the role, the removal behaviour, its
announcement and the parts.

Research: [tag-group](../../../docs/research/tag-group.md) (sources, Bug history,
Accessibility, Decisions) · [collections](../../../docs/research/collections.md) ·
[listbox](../../../docs/research/listbox.md) ·
[accessibility](../../../docs/research/accessibility.md) ·
[assistive-tech-and-a11y-testing](../../../docs/research/assistive-tech-and-a11y-testing.md) ·
[native-platform](../../../docs/research/native-platform.md)

**Depends on** `add-foundations` (runtime, `controllable`, `bindProp`, contracts, drivers,
`testMachine`, React adapter), `add-a11y-foundations` (press, hover, modality, keyboard
normalisation, announcer, hidden content, messages, invariants), `add-collections`
(collection model, static item registration, selection model, roving navigation, repair,
typeahead, collection contract fragment, `selectable` trait), `add-button`
(`button-like-element` for TagRemove) and `add-theme-system` (stylesheet convention, the
`status` family).

## What Changes

- New capability **`tag-group`**: a standalone collection of tags — role by interactivity
  (`grid` / `group` when empty / plain `list`), one Tab stop, removal by key with focus
  repair and an announcement, optional selection, actions and links, disabled tags, the
  empty state, parts, `data-*`, contract and driver.
- `@rind-ui/core`: the `tag-group` machine, connect, contract and messages.
- `@rind-ui/react`: `TagGroup.Root`, `Label`, `Description`, `List`, `Tag`, `TagText`,
  `TagRemove`, `Empty`.
- `@rind-ui/testing`: `getTagGroup` driver; model-based coverage.
- Theme stylesheet (tier-3 `--rind-tag-group-*` tokens, `status` family), stories, docs page.

## Capabilities

### New Capabilities

- `tag-group`: the Tag Group component — roles, keyboard, removal, announcements,
  selection, actions and links, disabled and empty states, parts, attributes, contract.

### Modified Capabilities

- `component-contract` (archived from `add-foundations`): "Location By Accessible Name"
  accepts a set of roles (delta in `specs/component-contract/spec.md`).

The other capabilities used belong to unarchived changes and are used as they are; their
extensions are listed in design.md "Requests to other changes".

## Non-goals

- The chips inside a Combobox or Tags Input control (owned by `add-combobox`,
  `role="toolbar"` inside the control; shared with Tags Input).
- Creating or editing tags (Tags Input), drag-and-drop reordering, a virtualizer.
- `maxRows` / "Show all" collapsing (React Spectrum; adobe/react-spectrum#7467, #4224) — a
  consumer composes a Collapsible.
- Form participation and Field integration (a selected Tag Group is not a form control
  yet); per-tag validation states (adobe/react-spectrum#3658).
- Escape clearing the selection; a select-all shortcut.
- An `aria-live` region announcing tags added from elsewhere (React Aria) — Tags Input
  announces its own additions.
- Framework adapters other than React; fx.

## Impact

- New code: `packages/core/src/components/tag-group/{tag-group.machine,tag-group.connect,tag-group.contract,tag-group.messages}.ts`,
  `packages/react/src/tag-group/*`, `getTagGroup` in `@rind-ui/testing`,
  `packages/theme/src/tag-group.css`, stories, generated docs page.
- Public API: `tag-group` machine/connect/contract, `TagGroup` parts, `getTagGroup`.
- No new runtime dependency.
