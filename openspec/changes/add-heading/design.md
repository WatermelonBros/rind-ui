## Context

See proposal.md and [heading.md](../../../docs/research/heading.md). This change
consumes, without restating:

| From | Used for |
|---|---|
| `add-foundations` | contracts, drivers, React adapter (`render` substitution, the rendered tag known statically from `render` and from the ref after mount, instance scoping, reserved theme attributes pass-through) |
| `add-a11y-foundations` | development logger, invariants (rule 4: no repeated implicit role) |
| `add-theme-system` | typography tokens, `@layer rind.components`, family matrix (request 6) |

## Goals / Non-Goals

**Goals:** one rule set for every heading in rind-ui; nesting computed, not counted;
zero runtime cost.

**Non-Goals:** outline tooling, size coupling (proposal Non-goals).

## Decisions

### 1. No machine (Separator precedent)

Stateless, connect-only; the docs generator marks it **stateless**.

### 2. Core

```ts
// core/components/heading/heading.connect.ts
export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6
export const ROOT_HEADING_LEVEL = 2
export function resolveHeadingLevel(explicit: number | undefined, context: number | undefined,
                                    log: Logger): HeadingLevel           // clamp + warnings
export function nextHeadingLevel(parent: number | undefined, level: number | undefined): number
  // Heading.Level: level ?? (parent ?? ROOT_HEADING_LEVEL) + 1  (unclamped, so depth > 6 is detectable)
export function headingProps(input: { level: HeadingLevel; tag: string; scope?: string }): {
  role?: "heading"; "aria-level"?: HeadingLevel; "data-level": `${HeadingLevel}` }
```

- `tag` is the rendered tag (Separator's rule: the default element, or the element
  given to `render`, known statically; after mount from the ref through `core/dom`).
- Development checks: range/depth (once per instance), empty exposed heading (after
  mount, `textContent.trim() === ""` and no name attributes).
- `nextHeadingLevel` keeps the raw depth in context so a Heading at depth 7 can warn
  while rendering `h6`.

### 3. React

```tsx
const HeadingLevelContext = createContext<number | undefined>(undefined)
export function useHeadingLevel(): HeadingLevel        // resolved for the current position
Heading.Level = ({ level, children }) =>
  <HeadingLevelContext.Provider value={nextHeadingLevel(useContext(HeadingLevelContext), level)}>{children}</…>
export const Heading = ({ level, render, ...props }) => /* h{resolved} + headingProps */
```

React context crosses portals, which gives the "component tree, not DOM position" rule
for free. Default element `h{level}` is chosen in the part (`createElement(\`h${level}\`)`),
`render` overrides it.

### 4. Contract

```ts
export const headingContract = contract("heading", {
  anatomy: ["root"],
  locate: (name: string) => ({ role: "heading", name }),
  actions: {},
  queries: { level: async (e) => Number((await e.part("root").attr("aria-level"))
                                   ?? (await e.part("root").tagName()).slice(1)) },
  traits: [],
})
```

### 5. Theme

`heading.css`: `:where([data-scope="heading"][data-part="root"][data-level="1"])` …
`"6"` → `font-size: var(--rind-heading-1-font-size, <typography step>)`, `line-height`,
`font-weight`, `margin: 0` (spacing is layout's). No variant or tone rules (text colour
from `--rind-heading-color` → `--rind-color-text`). Hosted headings (Dialog titles,
Accordion headers) keep their host's scope and stylesheet; they do not read
`--rind-heading-*` unless the host chooses to.

## Requests to other changes

Behaviour of each host's default stays as specified (titles `h2`, accordion headers
`h3`); what changes is that the parts use the shared rules and the context.

1. APPLIED (coordinator, 2026-10-14; add-dialog A.3): **`add-dialog`** (Title part): render `h{level}` with `level` = the Title's `level`
   prop ?? 2, attributes from `headingProps` (so `render={<div />}` gets `role="heading"`
   and `aria-level`); wrap the Content's children in a `Heading.Level` set to the title's
   level + 1, so a `<Heading>` in the dialog body is one level below the title.
2. APPLIED (coordinator, 2026-10-14; add-alert-dialog A.1): **`add-alert-dialog`** (Title part): same as 1.
3. APPLIED (coordinator, 2026-10-14; add-drawer A.1): **`add-drawer`** (Title part): same as 1.
4. APPLIED (coordinator, 2026-10-14; add-popover A.1): **`add-popover`** (Title part): same as 1.
5. APPLIED (coordinator, 2026-10-14; add-accordion A.1): **`add-accordion`** (Header part, `headingLevel` prop): default `headingLevel` =
   the surrounding context level when inside a `Heading.Level`, else 3 (unchanged
   default outside any Level); compute the header's attributes with `headingProps`
   (identical to its current `role="heading"` + `aria-level` rule); wrap each item's
   Content children in a `Heading.Level` one deeper than the header.
6. APPLIED (coordinator, 2026-10-14; add-theme-system A.9): **`add-theme-system`** (`theme-variants` → Family Matrix): add Heading to the list of
   components in NO family (with Label, Field, Fieldset, Form): it reads only typography
   tokens.

## Risks / Trade-offs

- [Root default 2 assumes the page has its own `h1`] → documented; an app shell anchors
  `Heading.Level level={1}`; the dev check does not flag a page without `h1` (not a
  component concern).
- [Requests 1–5 not applied] → Heading works standalone; hosts keep their fixed levels
  and their own rules (no regression), only nesting under them is manual.
- [`aria-level` on a mismatched native heading surprises CSS authors who style `h4`]
  → the docs recommend styling by `data-level` or the consumer's own class, and keeping
  `render` for non-heading substitutes.

## Migration Plan

New API. Ariakit: `HeadingLevel` → `Heading.Level` (note the root default 2 vs 1:
anchor `level={1}` where Ariakit's outermost level was 1). React Aria: `<Heading
level={n}>` works unchanged. Reado: nested `Settings` sections adopt `Heading.Level` +
`Heading` when touched.
