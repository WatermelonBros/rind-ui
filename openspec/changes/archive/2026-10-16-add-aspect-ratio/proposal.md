## Why

Radix, Reka and Bits ship an AspectRatio component, so rind-ui's inventory lists it.
The component exists only because CSS once had no ratio property: it wraps content in a
`padding-bottom` box and absolutely positions it, which breaks in flex rows
(chakra-ui#2582), clips content at zoom, restyles children (chakra-ui#5343, #4347),
breaks framework image components (chakra-ui#10290) and is a client component for pure
CSS (radix#2346). Native `aspect-ratio` (Chrome 88, Firefox 89, Safari 15) does the job
in one declaration without any of that (radix#2401 asked Radix to switch). rind-ui
therefore covers the row with a documented recipe instead of a component — and makes
sure people and agents porting `<AspectRatio>` find it.

Research: [aspect-ratio](../../../docs/research/aspect-ratio.md) (sources, Bug history,
Accessibility, Decisions) · [native-platform](../../../docs/research/native-platform.md)
· [accessibility](../../../docs/research/accessibility.md) §8 (reflow, zoom) ·
[assistive-tech-and-a11y-testing](../../../docs/research/assistive-tech-and-a11y-testing.md)

**Depends on** the docs generator and `llms.txt` pipeline (decision 0005, built with the
first component docs page) and, for the image example, `add-image`.

## What Changes

- No code in `@rind-ui/core`, `@rind-ui/react`, `@rind-ui/testing` or `@rind-ui/theme`:
  no `AspectRatio` part, connect, contract, driver or stylesheet.
- A docs recipe page "Aspect Ratio" with the native property, media and embed examples,
  the zoom/reflow note and a migration table from Radix/Reka/Bits.
- `llms.txt` / `llms-full.txt` list "Aspect Ratio" and point to the recipe, stating that
  there is no component to import.
- Recipe stories (examples) with a layout check.

## Capabilities

### New Capabilities

- `aspect-ratio`: how rind-ui covers the Aspect Ratio row — no component, the recipe's
  required content, its discoverability for people and LLMs, and its checked examples.

### Modified Capabilities

None.

## Non-goals

- An `AspectRatio` component, hook or utility class, now or as a compatibility shim.
- A theme stylesheet or tokens for generic ratio boxes (Image has its own
  `--rind-image-aspect-ratio`, add-image).
- Polyfilling `aspect-ratio` for browsers older than the support floor.

## Impact

- New docs page and stories in `apps/storybook`; one `llms.txt` entry.
- `docs/components.md`: the row is covered by a recipe (Status `spec`, Notes say so).
- No public API, no runtime dependency.
