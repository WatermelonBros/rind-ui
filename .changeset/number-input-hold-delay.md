---
"@rind-ui/core": patch
"@rind-ui/testing": patch
---

Delay functions receive the context as well as the props. Number Input has one hold delay (`spinDelay`, 600 ms for a touch hold), and its model test walks press-and-hold again on a virtual clock.
