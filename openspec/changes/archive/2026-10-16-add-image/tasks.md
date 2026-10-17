## 0. Prerequisites

- [x] 0.1 Confirm `add-avatar` (image-loading-status and its machine), `add-a11y-foundations` and `add-theme-system` are applied, and requests 1–2 in design.md are applied or answered

## 1. Machine

- [x] 1.1 Move the four-state machine to `core/components/image-status/image-status.machine.ts` (skipped: `add-avatar` already wrote it there; the React half is shared too, `packages/react/src/image-status.ts`, Avatar refactored onto it); `avatarMachine` re-exported as an alias; Avatar's Node, React and browser tests pass unchanged before and after
- [x] 1.2 Node tests for Image's use: `alt` present / empty / missing does not affect status; fallback timing identical to Avatar's

## 2. Connect

- [x] 2.1 `image.connect.ts` per design §2: name on `<img>` in `loading`/`loaded` and on Root (`role="img"` + `aria-label`) in `idle`/`error`, Fallback always `aria-hidden`, `data-decorative`, Img `hidden` in `idle` and `error`, `src` last, `alt` omitted + dev error when missing, consumer attributes passed through, no inline styles
- [x] 2.2 Unit tests for every cell of the design §2 table, named and decorative

## 3. React parts (`packages/react/src/image`)

- [x] 3.1 Root (required `alt: string` in the types), Img (typed `img` props without `alt`, registration as Avatar's Image), Fallback; `render` on each
- [x] 3.2 React tests: type test (missing `alt` fails to compile), SSR + hydrate with a cached image (no fallback frame), lazy image below the fold, framework image component through `render` (one request)

## 4. Contract and driver

- [x] 4.1 `image.contract.ts` per design §3 (locate by role `img` + name in every status, decorative by `data-instance`, queries, `waitForStatus`, Avatar's event map)
- [x] 4.2 `getImage` in `@rind-ui/testing`, reusing Avatar's image fixtures; driver tests in browser mode and Playwright; jsdom test documents that statuses beyond `idle` need a real browser

## 5. Model-based tests

- [x] 5.1 `testMachine(imageContract, …)` over the props classes in the spec (named and decorative); invariants: exactly one exposed `img` named `alt` (zero decorative), on the right element per status, `<img>` hidden exactly in `idle`/`error`; axe per state (`image-alt`, `role-img-alt`); virtual screen reader reads the same name across `loading → error`

## 6. Theme (`packages/theme/src/image.css`)

- [x] 6.1 `@layer rind.components`, `:where()` selectors, `--rind-image-*` tokens read with fallbacks and never declared; one-cell grid stacking, ratio token, fit token, no fade, no `[hidden]` override, forced-colors Fallback border; `decoration` family; imported from `index.css`
- [x] 6.2 Playwright captures per status, ratio box kept in `error` (bounding box equal across statuses), forced colors

## 7. Site examples (`apps/site/examples/image.tsx`)

- [x] 7.1 Site examples (state examples for every status): loaded, lazy with a fallback, a Skeleton fallback, broken with an icon fallback, no source, decorative, 16:9 / square ratio box with `contain`, inside a `<figure>` with a caption, inside a link (name = `alt`); the `<picture>` recipe and the driver example are on the docs page; per-state ARIA snapshots come from the examples harness (retire-storybook 2.3)

## 8. Docs

- [x] 8.1 Docs page (generated API facts): writing `alt` (and when `alt=""`), name per status, fallback timing (link to Avatar), lazy loading and why it is not the default, ratio box and `object-fit`, `<figure>` and long descriptions, `<picture>` recipe, framework image components, Image vs Avatar, driver example, `llms.txt` entry
- [x] 8.2 Image set to `done` in `docs/components.md`; the Reado `ImageView` migration is a Reado change, out of this repo

## 9. Proof

- [x] 9.1 `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green; changeset for core, react, testing, theme
