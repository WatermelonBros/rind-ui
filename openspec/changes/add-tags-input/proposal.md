## Why

Email recipients, labels and keyword filters need a text field that turns typed and pasted
text into a list of tags. Ark, Reka and Ariakit ship one, and their trackers show the same
failures again and again: IME Enter creates tags, mobile keyboards never trigger the
delimiter, paste breaks undo or validates the wrong thing, removal by index deletes the
wrong tag, a Tags Input composed with a Combobox commits twice, and removals are never
announced. With the chips of `add-combobox` and `combobox-pattern` specified, Tags Input
can be built from shared pieces plus a small capability of its own.

Research: [tags-input](../../../docs/research/tags-input.md) (sources, Bug history,
Accessibility, Decisions) · [combobox](../../../docs/research/combobox.md) (chips, pattern) ·
[collections](../../../docs/research/collections.md) ·
[accessibility](../../../docs/research/accessibility.md) ·
[assistive-tech-and-a11y-testing](../../../docs/research/assistive-tech-and-a11y-testing.md) ·
[native-platform](../../../docs/research/native-platform.md)

**Depends on** `add-foundations` (runtime, `controllable`, contracts, drivers, `testMachine`,
React adapter), `add-a11y-foundations` (keyboard normalisation, IME guard, modality,
`focusSafely`, announcer, quirks, messages, invariants), `add-collections` (keys, model,
roving navigation for the chips), `add-combobox` (`combobox-pattern` for suggestions and the
chip pieces, the shared capability `input-chips`), `add-checkbox` (`hidden-form-input` with list value carriers and the
validity proxy), `add-button` (`button-like-element` for ChipRemove and ClearTrigger),
`add-field` (`field-control`, `field-validation`), `add-theme-system` (tier-3 tokens,
variants). With suggestions, also `add-overlay-infrastructure` and
`add-floating-positioning` through `combobox-pattern`.

## What Changes

- New capability **`tags-input`**: creating tags from typed text (Enter, delimiters
  detected from the text change), paste splitting with per-segment validation, IME safety,
  normalising, duplicates, `max`, refusal feedback, blur behaviour, editing a tag in place,
  optional suggestions through `combobox-pattern`, form participation as a list, parts,
  `data-*`, messages, contract and driver.
- `@rind-ui/core`: the `tags-input` machine (spreading the `input-chips` and, when a
  collection is given, the `combobox-pattern` pieces), connect, contract, messages.
- `@rind-ui/react`: `TagsInput.Root`, `Label`, `Control`, `Chips`, `Chip`, `ChipText`,
  `ChipRemove`, `ChipInput`, `Input`, `ClearTrigger`, and for suggestions `Positioner`,
  `Popup`, `List`, `Item`, `ItemText`, `Group`, `GroupLabel`, `Separator`, `Empty`.
- `@rind-ui/testing`: `getTagsInput` driver, a `paste(text)` environment input; model-based
  coverage.
- Theme stylesheet (tier-3 `--rind-tags-input-*` tokens), stories, docs page.

## Capabilities

### New Capabilities

- `tags-input`: the Tags Input component — tag creation, paste, IME, validation, duplicates,
  max, blur, editing, suggestions, form participation, parts, attributes, messages,
  contract.

### Modified Capabilities

- `test-drivers` (archived from `add-foundations`): ADDED "Paste Input" — `paste(text)` in
  both adapters and the jsdom `ClipboardEvent`/`DataTransfer` polyfill (delta in
  `specs/test-drivers/spec.md`).

The chip behaviour is the shared `input-chips` capability of `add-combobox`, used as
specified there.

## Non-goals

- Inline tokens inside free text (React Aria's TokenField, `contenteditable`): that is
  Mentions / Prompt Input.
- A standalone list of removable tags without text entry (Tag Group).
- Object values with a `convertValue` mapping (Reka): values are strings; a consumer maps
  them.
- Undo/redo of tag operations (Ariakit `UndoManager`), drag-to-reorder tags, collapsing
  overflowing tags into "+3".
- Fetching or debouncing suggestions (the collections async status is used).
- Framework adapters other than React; fx.

## Impact

- New code: `packages/core/src/components/tags-input/{tags-input.machine,tags-input.connect,tags-input.contract,tags-input.messages}.ts`,
  `packages/react/src/tags-input/*`, `getTagsInput` and a `paste` input in
  `@rind-ui/testing`, `packages/theme/src/tags-input.css`, stories, generated docs page.
- Public API: `tagsInput` machine/connect/contract, `TagsInput` parts, `getTagsInput`.
- No new runtime dependency.
