---
"@rind-ui/core": minor
"@rind-ui/react": minor
"@rind-ui/testing": minor
"@rind-ui/theme": minor
---

Segmented Control: one choice out of a joined strip of segments, with radio semantics (a
`radiogroup` of `radio` buttons, one roving tab stop; every arrow moves and selects, Space
selects, Enter submits the form). Parts: `Root`, `Label`, `Item` (the segment, its hidden input
a sibling) and an optional measured `Indicator` (`--rind-indicator-*`). `readOnly`, `required`,
`invalid`, `disabled` and `focusableWhenDisabled` apply to the whole control.
`getSegmentedControl`, `segmentedControlContract` and `segmented-control.css` (structural,
forced-colors and reduced-motion aware).
