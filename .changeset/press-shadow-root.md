---
"@rind-ui/core": patch
---

Press: a release inside a shadow root counts as over the part (the event's composed path holds it, though a document listener sees the host as the target). The machine runtime's `onProps` takes a per-prop `equal`, so an object-valued prop re-created with the same content is no change.
