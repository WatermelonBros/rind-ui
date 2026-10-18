---
"@rind-ui/core": patch
---

The item registry reports its first commit even with no items, so a collection that starts empty is empty, not pending: Tag Group's `Empty` (and every empty state fed by registered items) now shows when the first render has no items.
