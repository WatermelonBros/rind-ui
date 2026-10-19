---
"@rind-ui/core": minor
"@rind-ui/react": minor
"@rind-ui/testing": minor
"@rind-ui/theme": minor
---

Message Thread: the scrolling conversation. It follows the newest content while you are at the bottom and lets go when you read back (upward scroll or wheel, a dragged selection; its own scrolls never count), counts new messages on JumpToLatest, keeps the bottom when the prompt grows the layout, keeps your place when older messages load (Safari too), and offers a top-anchored layout. An APG Feed: articles named by speaker, Page Down / Page Up between them, never a live region. Core: `core/dom/stick-to-bottom` (`stickToBottom`, `atBottom`, `observeTop`); `TABBABLE` exported. Contract env: `Part.wheel(deltaY)` in both adapters. Testing: `getMessageThread`. Theme: `message-thread.css`; the `arrow-down` icon.
