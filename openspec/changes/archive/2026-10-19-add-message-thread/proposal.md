## Why

Every AI chat scrolls a conversation, and the kits keep re-fixing the same bugs. The view
stops following a fast stream and never re-arms, or jumps back down after the user
scrolled up (assistant-ui #5970, #8220). It drifts when the prompt grows the layout
(use-stick-to-bottom #40), jumps at the end of a stream in Safari (#6315), and jumps when
older messages load above (virtua #883, #636). AI Elements puts `role="log"` on the whole
conversation, so a streamed answer is read chunk by chunk. And no kit offers keyboard
navigation between messages. None of the nine headless libraries ships a thread.

Research: [message-thread](../../../docs/research/message-thread.md) ·
[streaming-message](../../../docs/research/streaming-message.md) ·
[accessibility](../../../docs/research/accessibility.md) ·
[scroll-area](../../../docs/research/scroll-area.md)

Depends on: `add-foundations`, `add-a11y-foundations` (motion preference, modality),
`add-streaming-message` (the message inside, in examples), `add-theme-system`.

## What Changes

- A public **Message Thread** in `@rind-ui/core` (machine, connect, contract, messages,
  meta; `core/dom/stick-to-bottom.ts`) and `@rind-ui/react` (parts `Root`, `Viewport`,
  `Message`, `JumpToLatest`).
- A follow machine (`following` / `detached`) with the escape rules: an upward scroll or
  wheel, a text selection. It re-attaches at the bottom or when the user sends.
- Two layouts. `anchor="bottom"` follows growth. `anchor="top"` scrolls a new user message
  to the top and lets the answer grow below it.
- An APG Feed: messages are `article`s with position and speaker, and Page Down / Page Up
  move between them. The thread is never a live region.
- Jump to latest, named with the count of new messages.
- Loading older messages keeps the reading position and sets `aria-busy`.
- `getMessageThread` driver, theme stylesheet, site examples, docs page.

## Impact

- New capability `message-thread`.
- No new runtime dependency. Virtualization is the consumer's, as in rind-ui's
  collections.
