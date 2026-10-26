---
"@rind-ui/core": minor
"@rind-ui/react": minor
"@rind-ui/vue": minor
"@rind-ui/svelte": minor
"@rind-ui/solid": minor
"@rind-ui/angular": minor
"@rind-ui/testing": minor
"@rind-ui/theme": minor
---

Message Actions: the row of actions under a chat message, one Tab stop (a Toolbar). Copy (Clipboard's states, the value read at press time), Regenerate (busy until its promise settles, a second press ignored), Edit (`aria-pressed`, the focus back when the editor closes), thumbs up/down (a single, deselectable Toggle Group), and versions that announce "Version 2 of 3" and do not wrap silently. The row hides by style and never unmounts, so the focus never drops. Testing: `getMessageActions`. Theme: `message-actions.css`.
