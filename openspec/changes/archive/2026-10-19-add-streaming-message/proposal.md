## Why

Every AI chat renders a response that grows chunk by chunk, and every kit gets the same
things wrong. The growing body sits inside a live region and is read in fragments, or
nothing is announced at all (Claude NVDA report, ROVO-978). Bursty chunks jump instead of
reading evenly. The "done" state fires before the text is visible. The caret is spliced
into the markdown and changes the parse. Cancel and error lose text that already
arrived. None of the nine headless libraries ships the component; the AI kits ship
styled versions bound to their own runtime (Streamdown / AI Elements, assistant-ui,
prompt-kit).

A headless Streaming Message owns the state, the reveal pacing, the caret, `aria-busy` and
the lifecycle announcements, and leaves rendering the text (plain or markdown) to the
consumer.

Research: [streaming-message](../../../docs/research/streaming-message.md) ·
[accessibility](../../../docs/research/accessibility.md) ·
[assistive-tech-and-a11y-testing](../../../docs/research/assistive-tech-and-a11y-testing.md)

Depends on: `add-foundations`, `add-a11y-foundations` (announcer, `streamAnnouncement`,
motion preference), `add-theme-system`.

## What Changes

- A public **Streaming Message** in `@rind-ui/core` (machine, connect, contract, messages,
  meta, the pure `revealStep` pacing) and `@rind-ui/react` (parts `Root`, `Content`,
  `Caret`).
- The consumer passes `text` and `status` (`pending`, `streaming`, `complete`,
  `cancelled`, `error`); the component never fetches.
- Optional smooth reveal through the Scheduler, off under reduced motion and for text
  present at mount.
- Lifecycle announcements by default ("Generating a response", "Response complete",
  "Response cancelled", "Response failed"), or the text once, or by sentences, or none.
- `aria-busy` on the Content while streaming or revealing; the body is never a live
  region.
- `getStreamingMessage` driver, theme stylesheet (caret), site examples, docs page.

## Impact

- New capability `streaming-message`.
- No new runtime dependency. Markdown is the consumer's (Streamdown and react-markdown
  recipes in the docs).
