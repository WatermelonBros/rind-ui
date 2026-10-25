---
"@rind-ui/core": patch
"@rind-ui/testing": patch
---

Table of Contents: the contract's keyboard follow waits for the target heading to take focus
(the next frame), so model runs no longer race the step's snapshot, and the focus invariant
accepts focus moving from an in-page link (`href="#id"`) to its target as native link
behaviour, not focus lost.
