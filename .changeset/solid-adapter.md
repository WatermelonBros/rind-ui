---
"@rind-ui/solid": minor
---

New package `@rind-ui/solid` (`solid-js` ≥ 1.9): the same machines, ARIA and drivers as
`@rind-ui/react`, ported one component at a time (this release: Toggle, Button, Separator, Kbd, Badge, Heading, Label, Link). Parts are Solid
components with reactive props, `on<Value>Change` callbacks and a `render` function for element
substitution; each entry ships JSX under the `solid` condition and DOM-compiled JavaScript as
`default`.
