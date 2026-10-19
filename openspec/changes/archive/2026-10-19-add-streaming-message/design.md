## Context

The research note ([streaming-message.md](../../../docs/research/streaming-message.md))
compares Streamdown / AI Elements, assistant-ui and prompt-kit, the tested accessibility
guidance and the bug history. `core/a11y/stream.ts` already announces streamed text in
completion and sentence modes.

## Goals / Non-Goals

**Goals:**
- A machine that runs in Node: the consumer's `status` and `text` arrive as prop changes,
  the reveal advances on Scheduler ticks.
- One rule for what is shown: everything received, except while a smooth reveal is
  catching up during streaming.
- Announcements that never read chunks.

**Non-Goals:**
- Markdown parsing or incomplete-markdown repair (Streamdown's `remend`): the consumer's
  renderer.
- Scrolling, sender identity, grouping: Message Thread.
- Fetching or a chat runtime.

## Decisions

### 1. Props

```ts
text: string                        // everything received so far
status: "pending" | "streaming" | "complete" | "cancelled" | "error"
smooth?: boolean | { drainMs?: number; maxCharIntervalMs?: number } // default true
announce?: "status" | "text" | "sentences" | "none"                 // default "status"
messages?: Partial<StreamingMessageMessages>
```

### 2. Machine

States `pending`, `streaming`, `settling`, `complete`, `cancelled`, `error`. Context:
`shown` (characters revealed), `reduced` (false until the first `MOTION.CHANGED`),
`started` (a start was announced).

Events: `SYNC` (onProps of `text` and `status`, and once on start), `TICK` (a reveal
step), `MOTION.CHANGED { reduced }`.

- `SYNC` picks the state from `status`, in this order: `cancelled` / `error` (final, shown
  = everything), `complete` (→ `settling` while `shown < text.length` and the reveal is
  on, else `complete`), `streaming`, `pending`.
- The first `SYNC` (mount) sets `shown = text.length`: text present at mount is never
  revealed again (hydration, a reloaded thread).
- A `text` that does not start with the shown prefix resets `shown` to 0 while the reveal
  is on, and to `text.length` while it is off (assistant-ui #7511).
- The reveal is on when `smooth` is not false and `reduced` is false. In `streaming` and
  `settling`, while `shown < text.length`, a delayed `TICK` (16 ms, `after`, re-entering)
  advances `shown` by `revealStep`. `settling` goes to `complete` when `shown` reaches the
  end.
- `revealStep(backlog, opts)` (pure, exported) sets the pace when a chunk arrives (context
  `rate`, characters per tick): `ceil(backlog × 16 / drainMs)`, at least
  `floor(16 / maxCharIntervalMs)` (defaults 250 and 5), at most the backlog. Fixing the pace
  per chunk drains linearly; recomputing it on the shrinking backlog every tick (as
  assistant-ui does) decays and never meets `drainMs`.
- Displayed text (connect): `text.slice(0, shown)` in `streaming` and `settling` with the
  reveal on; `text` otherwise.

### 3. Announcements

Through the Environment's announcer, polite, keyed `streaming-message-<id>`:
- `status` (default): `messages.started` on the first entry to `streaming`;
  `messages.completed` on entry to `complete` after a start; `messages.cancelled`,
  `messages.failed` on those states. A message that mounts complete announces nothing.
- `text`: `streamAnnouncement` in completion mode: the complete text once, on `complete`;
  `cancel()` on cancelled and error (then `messages.failed` on error).
- `sentences`: `streamAnnouncement` in sentence mode, pushed the received delta on each
  `SYNC`.
- `none`: nothing.

### 4. Connect

Parts `root`, `content`, `caret`. Every part carries `data-scope`, `data-part`,
`data-instance`, `data-state` (the machine state) and `data-busy` while `streaming` or
`settling`.
- Root: no role (the consumer gives `role="article"` and a label in a thread).
- Content: `aria-busy="true"` while busy, never `aria-live`. Inline style
  `white-space: pre-wrap` only when the consumer renders plain text.
- Caret: `aria-hidden="true"`; rendered only while busy.

Messages: `started` "Generating a response", `completed` "Response complete",
`cancelled` "Response cancelled", `failed` "The response failed".

### 5. React

- `StreamingMessage.Root` owns the machine, subscribes to `env.motion` after mount.
- `StreamingMessage.Content`: `children` is either a node or a function
  `(text, state) => node`, called with the displayed text; with no children it renders
  the text as plain text.
- `StreamingMessage.Caret`: rendered while busy; children optional (the theme draws one).

### 6. Contract

`locate`: `data-scope="streaming-message"` / `data-part="root"`, or by the Root's role and
name. No user actions. Queries `state`, `text` (Content's text), `isBusy`, `hasCaret`.
Events map to `$props:status` / `$props:text` with the model's story (a fixed text grown
in steps), and `TICK` advances the virtual clock.

Invariants:
- the Content is never inside a live region and has no `aria-live`;
- `aria-busy` ⇔ `data-busy` ⇔ a Caret is rendered;
- in final states the Content shows all of `text`.

### 7. Theme

`streaming-message.css`, family `decoration`: the Content's typography; the Caret as an
inline block that blinks (`steps(1)`), stops in final states and under
`prefers-reduced-motion`, forced colours `CanvasText`.

## Risks / Trade-offs

- A smooth reveal keeps the message busy for up to `drainMs` after the stream ends; the
  completion announcement waits for it, which is the point.
- `aria-busy` is held by some screen readers and ignored by others; the lifecycle
  announcements do not depend on it.
- 16 ms ticks on `setTimeout` drift from the display's frames; the reveal does not need
  frame accuracy and gains a virtual clock in tests.
