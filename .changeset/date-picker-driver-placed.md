---
"@rind-ui/core": patch
---

Date Field picker driver: `openPicker` waits for the popup's first placement, so a `pickDate` right after the open no longer hits a popup that takes no pointer input yet.
