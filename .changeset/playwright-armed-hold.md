---
"@rind-ui/testing": patch
---

`testMachine` through Playwright: a step that closes a presence layer arms the animation hold before the action (Chromium freezes the page's animations through CDP; other engines start CSS animations paused), so the reopen-during-exit check always sees the exit, however slow the round trip.
