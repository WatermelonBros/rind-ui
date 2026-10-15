---
"@rind-ui/core": minor
"@rind-ui/react": minor
"@rind-ui/testing": minor
"@rind-ui/theme": minor
---

Collapsible: a trigger and a content region with controllable `open`, `disabled` and
`focusableWhenDisabled`, and `closedContent` (`until-found` by default so the browser's
search can open it, `hidden`, or `unmount`). The content publishes its size as
`--rind-collapsible-content-height` / `-width` (measured without disabling animations, `auto`
at rest) for CSS transitions; `data-reveal` marks instant reveals. `getCollapsible`,
`collapsibleContract`, and `collapsible.css`.
