---
"@rind-ui/react": patch
---

`Portal` follows a logical parent that changes after mount (a Dialog's opener, set on open), and `Dialog.Portal` uses the first trigger until then: the portal host carries the trigger's `data-rind-theme`, `data-theme`, `dir` and `lang` from the first open.
