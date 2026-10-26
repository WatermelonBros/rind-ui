---
"@rind-ui/core": patch
"@rind-ui/react": patch
"@rind-ui/solid": patch
"@rind-ui/svelte": patch
"@rind-ui/vue": patch
"@rind-ui/angular": patch
---

Button, file upload and streaming message fixes from the cross-library audit:

- Button: a pending submit stays `type="submit"` and cancels its click, so Enter in a text field no longer submits the form again through implicit submission (RA#7543).
- File Upload: a click on the dropzone's content opens the chooser inside a Dialog, a Popover, a label or any focusable container. Only interactive elements inside the zone are excluded.
- Streaming Message: a response that fails, is cancelled or completes before it ever streams is announced. Only a message that mounts already final stays silent.
