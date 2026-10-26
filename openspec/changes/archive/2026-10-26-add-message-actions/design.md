## Context

Research: [docs/research/message-actions.md](../../../docs/research/message-actions.md)
("Decisions").

## Decisions

### 1. Machine

`message-actions` owns only what is new:

- `active`: `inactive` / `active` from `POINTER.ENTER` / `POINTER.LEAVE` / `FOCUS.IN` /
  `FOCUS.OUT` / `TOUCH` (a tap in the message), or forced by the `active` prop; hidden rows
  stay mounted (`data-active` absent) so focus is never dropped.
- `regenerate`: `idle | pending | done | error`; `PRESS.REGENERATE` in `idle`, `done` or
  `error` calls `onRegenerate()` and enters `pending` until its promise settles (a sync return
  settles at once); a press while `pending` is ignored. `done` and `error` return to `idle`
  after 2000 ms of the Scheduler.
- `editing`: controllable (`editing`, `onEditingChange`); `PRESS.EDIT` toggles it. When it
  turns false and the focus is on `<body>` (the editor unmounted), the focus returns to the
  Edit item.
- `version`: controllable index (`index`, `defaultIndex`, `onIndexChange(index)`; the key is `keys[index]`)
  over `count` (and optional `keys`); `PRESS.PREVIOUS` / `PRESS.NEXT` move by one, no wrap
  unless `loop`; each move announces `messages.version(index + 1, count)` politely.

### 2. Composition

- Root renders a Toolbar (roving focus, one Tab stop, `aria-label` = `messages.label`, "Message
  actions"). Every item is a Toolbar item.
- `Copy` is a Clipboard (`value` read at press time) whose Trigger is the Toolbar item, named
  `messages.copy`.
- `Feedback` is a single Toggle Group, deselectable, named `messages.feedback`;
  `FeedbackItem value="up" | "down"` named `messages.up` / `messages.down`.
- `Regenerate`, `Edit`, `VersionPrevious`, `VersionNext`: buttons named from messages;
  `Regenerate` is `aria-disabled` + `aria-busy` while pending; `Edit` has `aria-pressed`;
  the version buttons are `aria-disabled` (focusable) at the ends without `loop`.
- `Versions` is a named group; `VersionStatus` shows "2 / 3", `aria-hidden` (the buttons'
  description and the announcement carry it).
- `Versions` renders nothing when `count < 2`.

### 3. Attributes

Root: `data-scope="message-actions"`, `data-part`, `data-instance`, `data-active`,
`data-editing`. Regenerate: `data-state`. Edit: `data-state="on|off"`. Versions: `data-count`,
`data-index`. Version buttons: `data-disabled`.

### 4. Contract

Locate by the toolbar's name, else the only one. Actions `copy`, `regenerate`, `edit`,
`rate(value)`, `previousVersion`, `nextVersion`. Queries `isActive`, `regenerateState`,
`rating`, `version` (`{ index, count }` from `data-index` / `data-count`), `isEditing`.
