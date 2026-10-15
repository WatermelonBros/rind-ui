---
"@rind-ui/testing": minor
---

`@rind-ui/testing/setup` registers Testing Library's `cleanup` (and rind-ui's state reset) after each test also when Vitest runs without `globals`, so a second `render` in a file no longer leaves the first tree in the document. Opt out with `globalThis.RIND_AUTO_CLEANUP = false` in an earlier setup file.
