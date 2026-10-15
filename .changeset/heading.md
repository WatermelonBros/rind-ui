---
"@rind-ui/core": minor
"@rind-ui/react": minor
"@rind-ui/testing": minor
"@rind-ui/theme": minor
---

Heading: levels from the nesting of `Heading.Level` sections (root 2, explicit `level`
wins, clamped to 1–6 with development warnings), native `h1`–`h6` with the role and
`aria-level` rules for substituted elements, `useHeadingLevel()` for your own components,
`headingProps` in core for every heading part, `getHeading` with a `level()` query,
`Part.tagName()` in the test environment, and `heading.css` sizing by `data-level`.
