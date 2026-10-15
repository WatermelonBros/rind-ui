# 0009 — `@internationalized/number` as a runtime dependency

Status: accepted · 2026-10-14

## Context

0002 allows two runtime dependencies (`@floating-ui/dom`, `@internationalized/date`)
and says any other needs a decision record. Number Input (add-number-input) has to parse
what users type in their locale: "1.234,5" (de, it), "1,234.5" (en), "1 234,5" (fr,
with U+202F), Arabic-Indic and Devanagari digits, currency, percent and unit formats,
signs, and partial input while typing. React Aria, Zag, Reka and Kobalte all use
`@internationalized/number` for this; its NumberParser encodes years of bug fixes
(react-spectrum issues cited in docs/research/number-input.md).

## Decision

Allow `@internationalized/number` as a runtime dependency of `@rind-ui/core`, used only
by the shared `number-parsing` capability (add-number-input) and anything built on it.
It comes from the same project as `@internationalized/date` (already allowed), is
Apache-2.0, has no dependencies of its own, and is tree-shaken out of bundles that do
not use numeric fields (size check in add-number-input's tasks).

Alternative considered: porting the parser into core. Rejected — it would duplicate a
maintained, well-tested library and lose its fixes.

## Consequences

- 0002's "Dependencies we do not rewrite" list gains this entry.
- The "Allowed today" line in CLAUDE.md gains it (updated when the implementer session
  is idle, per the coordination protocol).
