---
"@rind-ui/core": patch
---

A toast re-measures its height in the frame after a resize, not inside the ResizeObserver's callback: lifting its inline height there resized the observed box during delivery, and WebKit logged "ResizeObserver loop completed with undelivered notifications".
