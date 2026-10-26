---
"@rind-ui/core": patch
"@rind-ui/react": patch
"@rind-ui/solid": patch
"@rind-ui/svelte": patch
"@rind-ui/vue": patch
"@rind-ui/angular": patch
---

Overlay fixes from the cross-library audit:

- Drawer: a mouse or pen click on a checkbox, label or clickable row inside the drawer reaches it again (the swipe captured the pointer at pointerdown and took the click).
- A press or focus inside a web component (open shadow root) inside a dialog, popover or drawer no longer counts as outside and closes it.
- A tooltip open over a modal no longer swallows the backdrop click that closes the modal.
- Dialog: a submit-type Cancel, Action or Close trigger lets the form's own submit handler run and submits it with the form connected, then closes.
- Drawer: `--rind-drawer-keyboard-inset` is written for portalled drawers; the parent's `--rind-drawer-frontmost-size` follows a nested drawer's resize; content that mounts late (lazy chunk) still gets swipe and snap points.
