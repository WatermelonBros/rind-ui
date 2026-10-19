---
"@rind-ui/core": minor
"@rind-ui/react": minor
"@rind-ui/testing": minor
"@rind-ui/theme": minor
---

Streaming Message: one AI response arriving in chunks. You pass `text` and `status`; it paces bursty chunks evenly (each drained in `drainMs`), marks the content `aria-busy` with a caret while it grows, keeps the body out of any live region and announces the lifecycle (or the text once, or by sentences), and keeps everything received on cancel or failure. Your renderer gets the displayed text. Core: `splitSentences` exported from the stream announcer. Contract: a machine event the parent's props drive can take a props step. Testing: `getStreamingMessage`. Theme: `streaming-message.css` in the decoration family.
