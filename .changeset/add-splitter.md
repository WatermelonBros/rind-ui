---
"@rind-ui/core": minor
"@rind-ui/react": minor
"@rind-ui/testing": minor
"@rind-ui/theme": minor
---

Splitter: resizable panels on one axis with a focusable `separator` between each pair (APG Window Splitter).

- **Sizes before hydration.** Sizes and limits are declared on the Root (`panels`, `sizes` / `defaultSizes` in percent), and each panel is `flex-grow` on a zero basis, so the server renders the final layout.
- **Limits.** `min`, `max` and `collapsedSize` as percents or `"Npx"` strings, re-resolved whenever the Splitter resizes; `collapsible` panels snap at the halfway point.
- **Keyboard and pointer.** Arrows on the handle's axis (mirrored in RTL), Home / End, Enter to collapse or restore; drag through pointer-drag, with Escape and `pointercancel` restoring the press sizes. `onSizesCommit` once per interaction.
- **Contract and driver.** `getSplitter`.
- **Theme.** `splitter.css`.
