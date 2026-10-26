---
"@rind-ui/core": patch
"@rind-ui/react": patch
"@rind-ui/solid": patch
"@rind-ui/svelte": patch
"@rind-ui/vue": patch
"@rind-ui/angular": patch
---

Toast fixes from the cross-library audit:

- Toasts auto-dismiss again after the last toast was closed under the pointer, or after the region was left with the focus (F6, Escape): the region's hover and focus ended with it, but the pause stayed and every later toast showed paused and expanded forever (zag#3464).
- A toast still playing its exit when the Toaster unmounts no longer leaves an empty "Notifications" landmark in the next Toaster.
