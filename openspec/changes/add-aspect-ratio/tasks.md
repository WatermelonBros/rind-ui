## 0. Prerequisites

- [ ] 0.1 Confirm the docs generator and `llms.txt` pipeline exist (decision 0005) and `add-image` is applied for the image example

## 1. Machine, connect, parts, contract, driver, model-based tests, theme

- [ ] 1.1 None: Aspect Ratio is a recipe (design §1). Record `kind: "recipe"` in the docs generator's metadata so the page has no API-facts, states or driver sections, and add a type test that `@rind-ui/react` has no `AspectRatio` export

## 2. Site examples

- [ ] 2.1 Site examples (apps/site/examples/aspect-ratio.tsx, state examples for every contract state): 16:9 box, square thumbnail grid, image with `cover` and `contain`, `iframe` and `video` embeds with names, image `width`/`height` attributes, Image's `--rind-image-aspect-ratio`, a box in a flex row, a text card at 200 % zoom; all pass axe
- [ ] 2.2 Play-function layout checks: height = width / ratio at two container widths, in block flow and in a flex row (chakra-ui#2582); zoomed text grows the box

## 3. Docs

- [ ] 3.1 Recipe page per the spec (native property, media, embeds, zoom note, migration table from Radix/Reka/Bits) and its generated `llms.txt` / `llms-full.txt` entry stating there is no component
- [ ] 3.2 Set Aspect Ratio to `wip`/`done` in `docs/components.md` as it progresses (Notes: recipe); archive when approved

## 4. Proof

- [ ] 4.1 `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green (no changeset: no package changes)
