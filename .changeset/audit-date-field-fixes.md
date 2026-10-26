---
"@rind-ui/core": patch
"@rind-ui/react": patch
"@rind-ui/solid": patch
"@rind-ui/svelte": patch
"@rind-ui/vue": patch
"@rind-ui/angular": patch
---

Date and time field fixes from the cross-library audit:

- Typing a whole date with separators over a filled field ("12/25/2027") no longer corrupts it: the separator right after an auto-advance no longer advances a second time.
- Enter commits the digit still waiting for a second one, so the form submits the date on screen.
- Enter in a segment submits the form in Chromium too (its line break is no longer cancelled).
