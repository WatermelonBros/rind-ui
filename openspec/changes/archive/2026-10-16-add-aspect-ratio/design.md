## Context

See proposal.md and [aspect-ratio.md](../../../docs/research/aspect-ratio.md). The
decision is the research note's: the component's only job was the pre-2021
`padding-bottom` technique, and every bug in its history comes from that technique or
from the wrapper it needs. This design records what replaces it.

## Goals / Non-Goals

**Goals:** the inventory row is covered; porting code finds the replacement; the
examples are tested like components.

**Non-Goals:** any shipped code (proposal Non-goals).

## Decisions

### 1. Recipe, not component

CLAUDE.md's "every component ships machine, connect, parts, contract, driver, stories,
tests, theme, docs" assumes behaviour to ship. Here there is none: a part would be
`<div style={{ aspectRatio }}>`, its contract would have nothing to act on and nothing
to read beyond a CSS value, and its driver would never be called. The docs page and its
stories are the deliverable; the docs generator marks the row **recipe** (no API facts
section).

*Alternatives:* a thin `AspectRatio.Root` that sets `aspect-ratio` inline (Separator-style
stateless part) — gives 1:1 import parity with Radix but adds an export, an inline
style the theme cannot override without `!important`, and a component whose only
documentation would be "this is one CSS property"; rejected. Keeping the padding
technique for old Safari — below the support floor; rejected.

### 2. Where it lives

```
apps/storybook/stories/recipes/aspect-ratio/aspect-ratio.mdx       the page
apps/storybook/stories/recipes/aspect-ratio/aspect-ratio.stories.tsx  examples + play checks
```

The `llms.txt` generator reads recipe pages from the same source as component pages, so
the entry is generated, not hand-written (0005). The layout checks run as Storybook
play functions in Vitest browser mode (bounding boxes at two container widths; 200 %
zoom via `page.evaluate` on the root font size).

### 3. Image

Image's stylesheet reads `--rind-image-aspect-ratio` (add-image). The recipe links to
it rather than repeating it.

## Requests to other changes

None.

## Risks / Trade-offs

- [Radix users expect an import] → the import fails at compile time and `llms.txt`
  answers "aspect ratio" with the recipe; the migration table is one line per form.
- [A future component needs a ratio] → it sets the property on its own part and exposes
  a `--rind-<scope>-aspect-ratio` token (research Open question).

## Migration Plan

Radix/Reka/Bits: replace `<AspectRatio.Root ratio={r}>children</AspectRatio.Root>` with
`<div style={{ aspectRatio: String(r) }}>children</div>` (or the property on the child
for `asChild`), and move `position: absolute; inset: 0` styles off the children. Reado:
nothing to migrate.
