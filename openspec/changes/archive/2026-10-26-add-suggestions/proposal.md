## Why

Prompt suggestion chips ("Summarise this", "Write a reply") sit in every chat UI, and the AI
kits ship them with focus and announcement bugs: chips that unmount while the prompt streams
and drop focus, chips announced through a live region on every render, built-in "send" flags
that fork code paths (assistant-ui). A headless, accessible set of suggestions composes with
rind-ui's Prompt Input.

Research: [suggestions](../../../docs/research/suggestions.md) ·
[prompt-input](../../../docs/research/prompt-input.md)

Depends on: `add-button` (`button-like-element`, press), `add-a11y-foundations` (Announcer),
`add-theme-system`.

## What Changes

- A public **Suggestions** in `@rind-ui/core` and every framework package: parts `Root`
  (named group), `Item` (button), `Label`, `Description`.
- States `ready`, `loading`, `disabled`; a press calls `onSelect({ value, index, key })` and
  never sends anything itself; while loading or disabled the items are `aria-disabled` and keep
  focus.
- Optional announcement of a new set (`announce="polite"`), never on mount; optional focus
  move after a press (`focusTarget`) only when focus was inside.
- `getSuggestions` driver, `suggestions.css`, site example, docs page.

## Capabilities

### New Capabilities

- `suggestions`: anatomy, states, press, focus, announcement, data attributes, messages,
  contract, theme.

### Modified Capabilities

None.

## Non-goals

- Generating suggestions, sending, text insertion rules; arrow-key navigation (wrap in Toolbar).

## Impact

- New: `packages/core/src/components/suggestions/`, framework parts, driver, theme file, site
  example and skin, `docs/components/suggestions.md`.
- Modified: `families.ts` (`suggestions` in `toggle item`, design §4).
