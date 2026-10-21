---
"@rind-ui/core": patch
---

Quirk checks no longer bundle the registry's metadata (bug links, repro tests, removal
conditions): every component is about 1.7 kB gzip smaller (`Button` 17.4 → 15.7 kB). The
exported `quirks` list, `quirkActive`, `QuirkId` and `QuirksAffecting` are unchanged.
