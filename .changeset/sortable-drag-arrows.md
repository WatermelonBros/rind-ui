---
"@rind-ui/theme": patch
---

Sortable: while a pointer drag is under way, every move button rests as disabled. The list reorders
on the drop, so until then the arrows described the old order (the lifted first item kept its
disabled "up").
