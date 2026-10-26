## Why

@-mentions, #-tags and /-commands in a text field: the chat composer's most requested feature.
react-mentions keeps markup in the value, Tiptap and Lexical need a rich editor, and all of them
have a history of IME bugs, chips that a Backspace half-deletes, lists anchored at the wrong
place and triggers that misread Unicode whitespace. rind-ui has the combobox pattern, Prompt
Input's textarea and the positioning layer: Mentions is a textarea with ranges.

Research: [mentions](../../../docs/research/mentions.md) ·
[combobox](../../../docs/research/combobox.md) · [prompt-input](../../../docs/research/prompt-input.md)

Depends on: `add-combobox` (pattern), `add-prompt-input`, `add-theme-system`.

## What Changes

- A public **Mentions** in `@rind-ui/core` and every framework package: parts `Root`,
  `Textarea`, `Description`, `Highlighter`, `Mention`, `Positioner`, `Popup`, `List`, `Group`,
  `GroupLabel`, `Item`, `ItemText`, `Empty`, `Loading`.
- Plain text plus a parallel list of ranges `{ id, trigger, start, end }`, reconciled from the
  text before and after each input; triggers with `insert` or `action` behaviour; the list on
  the combobox pattern (active descendant, auto highlight, Tab chooses), anchored at the trigger.
- `dom/caret-rect.ts` (the textarea mirror); `getMentions` driver; `mentions.css`; site example;
  docs page.

## Capabilities

### New Capabilities

- `mentions`: anatomy, value model, trigger detection, list, insertion, deletion, IME,
  accessibility, data attributes, messages, contract, theme.

### Modified Capabilities

None.

## Non-goals

- Rich contenteditable chips, data fetching, notifications, avatars in the list (consumer
  markup), category drill-down, markup serialisation formats.

## Impact

- New: `packages/core/src/components/mentions/`, `packages/core/src/dom/caret-rect.ts`,
  framework parts, driver, theme file, site example and skin, `docs/components/mentions.md`.
- Modified: `families.ts` (`mentions` in `field`).
