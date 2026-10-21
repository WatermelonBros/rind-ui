---
"@rind-ui/core": minor
"@rind-ui/react": patch
---

Long press ships only with the parts that opt in (Context Menu): every other pressable is about
0.2 kB gzip smaller. **Breaking** for direct `createPress` callers: the `longPress` option takes
`longPress({ threshold, moveTolerance })` (exported from `@rind-ui/core`) instead of a plain
object.
