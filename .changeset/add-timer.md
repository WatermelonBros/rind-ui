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

Timer: a countdown or a stopwatch. The time is derived from the injected monotonic clock, never added up from ticks, so it stays right after a background tab or a slow frame; ticks land on the value's whole interval; a countdown completes exactly at its target, once, and catches up when the page becomes visible. Actions `start`, `pause`, `resume`, `reset`, `restart`, `toggle`: an action that does nothing now leaves its trigger disabled but focusable, never hidden. The Area is `role="timer"` named by the time in words (`Intl.DurationFormat`); completion is announced. Testing: `getTimer`. Theme: `timer.css` (family `decoration`).
