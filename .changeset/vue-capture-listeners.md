---
"@rind-ui/vue": patch
---

Vue: a capture-phase handler from a part (`onClickCapture`) keeps Vue's `Capture` modifier, so a
disabled Grid List row's control swallows clicks as in React (it listened to a `clickcapture`
event that never fires).
