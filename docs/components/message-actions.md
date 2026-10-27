# Message Actions

The row of actions under a chat message: copy, regenerate, edit, thumbs up and down, and "‹ 2 / 3 ›" to move between versions. One Tab stop for the whole row (a [Toolbar](toolbar.md)), every button named, a row that hides by style and never unmounts (the focus stays), a regenerate that cannot be pressed twice, and the focus back on Edit when the editor closes.

## When to use

- **Use it for** the actions of each assistant (or user) message in a thread.
- **Over a few buttons**: one Tab stop per message instead of five, names on icon buttons, no focus loss when the row hides (assistant-ui's autohide unmounts it), versions that announce "Version 2 of 3" and do not wrap silently (AI Elements), copy that reports failure.
- **Don't use it for** a page's toolbar ([Toolbar](toolbar.md)).

```tsx
import { MessageActions } from "@rind-ui/react"

<MessageActions.Root onRegenerate={regenerate} count={versions.length} index={i} onIndexChange={setI}>
  <MessageActions.Copy value={() => message.text} />
  <MessageActions.Regenerate />
  <MessageActions.Feedback value={rating} onValueChange={setRating}>
    <MessageActions.FeedbackItem value="up" />
    <MessageActions.FeedbackItem value="down" />
  </MessageActions.Feedback>
  <MessageActions.Versions>
    <MessageActions.VersionPrevious />
    <MessageActions.VersionStatus />
    <MessageActions.VersionNext />
  </MessageActions.Versions>
</MessageActions.Root>
```

## API

<!-- api:message-actions -->

## Behaviour

- **Visibility**: shown while the pointer is over the message, the focus is within, after a touch, or with `active`. Hidden by style only (`data-active` absent), so the items stay in the accessibility tree and the focus never drops.
- **Copy**: [Clipboard](clipboard.md)'s copy, `value` read when pressed; "Copied" or "Copy failed".
- **Regenerate**: `onRegenerate()` runs; while its promise is pending the button is busy and a second press is ignored.
- **Edit**: toggles `editing` (`aria-pressed`); when editing ends and the editor took the focus with it, the focus comes back to Edit.
- **Feedback**: thumbs up and down as a single, deselectable [Toggle Group](toggle-group.md).
- **Versions**: from two versions; Previous and Next move by one and announce "Version 2 of 3"; at an end they are disabled but focusable (`loop` wraps).

## Keyboard

| Key | Action |
|---|---|
| Tab | Into the row (one stop) and out of it. |
| Arrow keys, Home, End | Between the actions. |
| Enter, Space | Runs the focused action. |

## Testing

```tsx
import { getMessageActions } from "@rind-ui/testing"

const actions = getMessageActions(screen)
await actions.nextVersion()
expect(await actions.version()).toEqual({ index: 1, count: 3 })
await actions.rate("up")
expect(await actions.rating()).toBe("up")
```

Contract actions: `copy`, `regenerate`, `edit`, `rate(value)`, `previousVersion`, `nextVersion`. Queries: `isActive`, `regenerateState`, `rating`, `version`, `isEditing`.

## Tested with

<!-- tested-with:message-actions -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
