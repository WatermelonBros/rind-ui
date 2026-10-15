## Why

Screen-reader users move through pages by headings and by heading level, and fixed
levels baked into components are wrong for half the pages they land on: Accordion's
`h3` skips `h2` (mui/base-ui#1678, closed because "no default satisfies everybody"),
Spectrum's dialog titles were `h3` until adobe/react-spectrum#2632, and every library
leaves nesting to the author. Ariakit solved it with a level context (`HeadingLevel`),
the pattern Chakra was asked for (chakra-ui#4396). rind-ui has five components with
heading parts already specified (Dialog, Alert Dialog, Drawer, Popover titles, Accordion
headers) and the consumer's own card and section titles; one Heading with a level from
context serves all of them.

Research: [heading](../../../docs/research/heading.md) (sources, Bug history,
Accessibility, Decisions) · [accessibility](../../../docs/research/accessibility.md)
rules 1, 4, 5 · [assistive-tech-and-a11y-testing](../../../docs/research/assistive-tech-and-a11y-testing.md)
§1.4 (dialog title read twice) · [native-platform](../../../docs/research/native-platform.md)

**Depends on** `add-foundations` (archived: contracts, drivers, React adapter with
`render` and the rendered-tag rule), `add-a11y-foundations` (dev logger, invariants) and
`add-theme-system` (typography tokens, family matrix — a request in design.md).
Stateless and connect-only, following `add-separator`.

## What Changes

- `@rind-ui/core`: `heading` connect (`headingProps`, `resolveHeadingLevel`), contract,
  development checks (level out of range or deeper than 6, empty heading).
- Behaviour: renders `h1`–`h6`; level = explicit `level` > nearest `Heading.Level` >
  root default 2; `Heading.Level` nests one deeper or sets a level for its subtree;
  `role="heading"` + `aria-level` only for non-heading substitutes, `aria-level` for a
  native heading of another level; clamped to 1–6; levels follow the component tree
  through portals.
- `@rind-ui/react`: `Heading`, `Heading.Level`, `useHeadingLevel()`.
- `@rind-ui/testing`: `getHeading` driver.
- Theme stylesheet (`--rind-heading-*`, size from `data-level`, overridable), stories,
  docs page.
- Requests to the Dialog, Alert Dialog, Drawer, Popover and Accordion changes to compute
  their heading parts with the shared helper and the context (design.md).

## Capabilities

### New Capabilities

- `heading`: the Heading component and the shared heading semantics — level
  resolution and nesting, element and role rules, clamping, portals, `data-*`, contract
  and driver, theme expectations.

### Modified Capabilities

None. Changes to other components' heading parts are listed in design.md "Requests to
other changes".

## Non-goals

- Visual size coupled to level (`level` is semantics; size is CSS — adobe/react-spectrum#7671).
- An `aria-level` override independent of the computed level (adobe/react-spectrum#5077;
  pick the level, style the size).
- Restarting levels at 1 inside modal dialogs (Ariakit) — rind-ui keeps the APG `h2`
  title convention (research).
- `hgroup`, subtitles, a document outline / table of contents (Table of Contents is a
  wave-3 component).
- Ids and `aria-labelledby` wiring: the host component owns them.
- Framework adapters other than React; fx.

## Impact

- New code: `packages/core/src/components/heading/{heading.connect,heading.contract}.ts`,
  `packages/react/src/heading/*`, `getHeading` in `@rind-ui/testing`,
  `packages/theme/src/heading.css`, stories, generated docs page.
- Public API: `headingProps`, `resolveHeadingLevel`, `headingContract`, `Heading`,
  `Heading.Level`, `useHeadingLevel`, `getHeading`.
- Reado: opportunistic adoption for nested sections (`Settings.tsx`).
- No new runtime dependency.
