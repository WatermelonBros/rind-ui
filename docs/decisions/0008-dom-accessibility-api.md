# 0008 — `dom-accessibility-api` in @rind-ui/testing

Status: accepted · 2026-10-14

## The problem

The generic invariants of `testMachine` check accessible names and descriptions
(rules 1 and 5 of the accessibility checklist, "name ≠ description"). The first
implementation computed names with a simplified algorithm of its own. Review found
it wrong in common cases: icon buttons (`<button><img alt="Close"></button>`),
`<input type="submit">`, hidden text, labels applied to elements that are not
labelable. A wrong name makes correct components fail and broken ones pass.

## Decision

`@rind-ui/testing` depends on `dom-accessibility-api` (`computeAccessibleName`,
`computeAccessibleDescription`), the implementation Testing Library already uses.

- The DOM adapter imports it directly.
- The Playwright adapter injects a self-contained IIFE bundle of the same in-page
  module (`dist/inpage.iife.js`, built from `src/inpage.ts`) into the page once, so
  both adapters compute names identically.
- It is a dependency of the testing package only. `@rind-ui/core` and
  `@rind-ui/react` stay dependency-free.

## Rejected

- Our own name computation: shown wrong by review; the accname spec is too large
  to maintain twice.
- Playwright's accessibility snapshot for the Playwright side: a second algorithm
  means the two adapters disagree on the same DOM.
