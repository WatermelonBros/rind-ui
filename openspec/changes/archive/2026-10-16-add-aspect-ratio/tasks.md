## 0. Prerequisites

- [x] 0.1 Confirm the docs generator and `llms.txt` pipeline exist (decision 0005); `add-image` is not applied yet (display 2), so the page names `--rind-image-aspect-ratio` without linking the Image page

## 1. Machine, connect, parts, contract, driver, model-based tests, theme

- [x] 1.1 None: Aspect Ratio is a recipe (design §1). The page has no `api:` block and no meta, so it has no API-facts, states or driver sections; type test `packages/react/src/no-aspect-ratio.test-d.ts` checks `@rind-ui/react` has no `AspectRatio` export

## 2. Site examples (`apps/site/examples/aspect-ratio.tsx`)

- [x] 2.1 Examples: 16:9 box, square thumbnail grid, image with `cover` and `contain`, `iframe` and `video` embeds with names, image `width`/`height` attributes (Image's `--rind-image-aspect-ratio` is a docs section; its live example lands with add-image), a box in a flex row, a text card at 200 % zoom; all pass axe
- [x] 2.2 Layout checks (`packages/testing/src/components/aspect-ratio.browser.test.tsx`, three engines): height = width / ratio at two container widths, in block flow and in a flex row (chakra-ui#2582); zoomed text grows the box

## 3. Docs

- [x] 3.1 Recipe page (`docs/components/aspect-ratio.md`) per the spec (native property, media, embeds, zoom note, migration table from Radix/Reka/Bits) and its generated `llms.txt` / `llms-full.txt` entry stating there is no component
- [x] 3.2 Aspect Ratio set to `done` in `docs/components.md` (Notes: recipe)

## 4. Proof

- [x] 4.1 `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green (no changeset: no package changes)
