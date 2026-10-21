---
"@rind-ui/core": patch
"@rind-ui/react": patch
---

The last two development diagnostics left in production bundles (Tour's unknown `goto` id,
Table's missing name) are dropped there; the size check now fails on any new one.
