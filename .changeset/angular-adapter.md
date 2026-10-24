---
"@rind-ui/angular": minor
---

New package `@rind-ui/angular` (`@angular/core` ≥ 21): the same machines, ARIA and drivers as
`@rind-ui/react`, ported one component at a time (this release: Toggle, Button, Separator, Kbd,
Badge, Heading, Label, Link). Parts are attribute directives on your own elements
(`<button rindToggleRoot [(pressed)]="bold">`), so no wrapper element is added and any host element
keeps the behaviour; a part that renders elements of its own (Kbd, Badge) is a component with an
attribute selector. Controlled values are an input and a `<value>Change` output (`[(pressed)]`),
with `<value>ChangeDetails` for vetoing a change. Published as Angular partial compilation, linked
by your application's build.
