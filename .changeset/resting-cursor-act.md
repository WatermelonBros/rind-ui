---
"@rind-ui/testing": patch
---

In a real browser, React act() warnings caused by the user's resting cursor (a hover on a part rendered under it) no longer count as step errors in `testMachine`.
