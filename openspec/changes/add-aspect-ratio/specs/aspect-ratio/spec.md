## Purpose

Defines how rind-ui covers the Aspect Ratio component of other headless libraries: with
the native CSS `aspect-ratio` property and a documented, tested recipe — not with a
component — and how that recipe is found by people and by LLM agents. Research:
`docs/research/aspect-ratio.md`.

## ADDED Requirements

### Requirement: No Component

rind-ui SHALL NOT export an `AspectRatio` component, part, hook, connect function,
contract or driver from any package. The inventory row SHALL be covered by the recipe
below.

#### Scenario: Import attempt

- **WHEN** a consumer writes `import { AspectRatio } from "@rind-ui/react"`
- **THEN** the code does not compile, and the docs entry for "Aspect Ratio" explains the
  native replacement

### Requirement: Recipe Content

The docs SHALL have an "Aspect Ratio" page that shows: a ratio box made with the CSS
`aspect-ratio` property on the element itself (no wrapper); media inside a ratio box
with `object-fit` set on the media (`cover` and `contain`); an `iframe` and a `video`
embed keeping their own accessible names; the `width`/`height` attributes that give
images their ratio before load; Image's ratio box (`--rind-image-aspect-ratio`); the note
that native `aspect-ratio` lets content grow the box at zoom while the padding technique
clips it; and a migration table from Radix, Reka and Bits (`<AspectRatio.Root
ratio={16 / 9}>` and its `asChild` / slot forms) to the native property.

#### Scenario: Migration entry

- **WHEN** a reader looks up Radix's `<AspectRatio.Root ratio={16 / 9}>` on the page
- **THEN** the table shows `<div style={{ aspectRatio: "16 / 9" }}>` and, for `asChild`,
  setting the property on the child element itself

#### Scenario: Embed names

- **WHEN** the iframe example is checked with axe
- **THEN** the iframe has a non-empty accessible name (`title`)

### Requirement: Discoverable By LLMs

The generated `llms.txt` SHALL list "Aspect Ratio" with a one-line summary stating that
rind-ui has no component for it and pointing to the recipe page, and `llms-full.txt`
SHALL include the recipe page, so an agent porting code that uses another library's
AspectRatio finds the native replacement instead of inventing an import.

#### Scenario: Agent search

- **WHEN** `llms.txt` is searched for "AspectRatio" or "aspect ratio"
- **THEN** the entry is found and names the native `aspect-ratio` property

### Requirement: Checked Examples

The recipe's examples SHALL be stories that pass axe and a layout check: the box's
height equals its width divided by the ratio at two widths, inside a flex row as well as
in block flow, and, at 200 % text zoom with text content longer than the box, the box
grows instead of clipping the text.

#### Scenario: Flex row (regression: chakra-ui#2582)

- **WHEN** a 16:9 box with `inline-size: 50%` is placed in a flex row 640 px wide
- **THEN** it is 320 × 180 px

#### Scenario: Zoomed text grows the box

- **WHEN** a 1:1 card whose text overflows at 200 % zoom is rendered
- **THEN** all its text is visible and the card is taller than wide
