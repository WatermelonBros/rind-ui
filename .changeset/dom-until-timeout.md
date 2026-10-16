---
"@rind-ui/testing": patch
---

The DOM adapter waits up to 3000 ms by default in a real browser (1000 ms in jsdom): on a CPU-starved page the first animation frame, which an overlay's initial focus waits for, can arrive after more than a second.
