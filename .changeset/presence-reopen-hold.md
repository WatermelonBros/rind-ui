---
"@rind-ui/testing": patch
---

`testMachine` holds the running animations while it reopens a layer during its exit, so a slow run can no longer see the exit end first and report a new content element; adapters gain `holdAnimations()`.
