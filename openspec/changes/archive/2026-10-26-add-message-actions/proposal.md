## Why

Every chat message has a row of actions: copy, regenerate, edit, thumbs up/down, and "2 / 3"
to move between versions. The AI kits ship it with recurring bugs: the row unmounts when it
hides and drops the focus (assistant-ui autohide), icon buttons without names (AI Elements),
version arrows that wrap silently, a regenerate pressed twice, focus lost after editing
(assistant-ui#8208). rind-ui already has every primitive it needs.

Research: [message-actions](../../../docs/research/message-actions.md) ·
[toolbar](../../../docs/research/toolbar.md) · [clipboard](../../../docs/research/clipboard.md)

Depends on: `add-toolbar`, `add-toggle-group`, `add-clipboard`, `add-button`,
`add-a11y-foundations`, `add-theme-system`.

## What Changes

- A public **Message Actions** in `@rind-ui/core` and every framework package: parts `Root`,
  `Item`, `Copy`, `Regenerate`, `Edit`, `Feedback`, `FeedbackItem`, `Versions`,
  `VersionPrevious`, `VersionNext`, `VersionStatus`.
- Root: a Toolbar (one Tab stop) named by `messages.label`; visibility `inactive` / `active`
  from hover, focus within and touch, never unmounted.
- Copy reuses Clipboard's copy states; Feedback reuses Toggle Group (single, deselectable);
  Regenerate `idle | pending | done | error`, a press while pending ignored; Edit an
  `aria-pressed` toggle of `editing` that returns focus when editing ends; Versions keyed,
  not wrapping, announced ("Version 2 of 3").
- `getMessageActions` driver, `message-actions.css`, site example, docs page.

## Capabilities

### New Capabilities

- `message-actions`: anatomy, visibility, copy, regenerate, edit, feedback, versions, data
  attributes, messages, contract, theme.

### Modified Capabilities

None.

## Non-goals

- What regenerate and edit do, the editor, message trees, speech, export, share, a "More"
  menu (compose a Menu in an `Item`), rating forms.

## Impact

- New: `packages/core/src/components/message-actions/`, framework parts, driver, theme file,
  site example and skin, `docs/components/message-actions.md`.
- Modified: `families.ts` (`message-actions` in `toggle item`).
