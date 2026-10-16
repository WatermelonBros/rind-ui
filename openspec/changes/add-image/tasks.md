## 0. Prerequisites

- [ ] 0.1 Confirm `add-avatar` (image-loading-status and its machine), `add-a11y-foundations` and `add-theme-system` are applied, and requests 1–2 in design.md are applied or answered

## 1. Machine

- [ ] 1.1 Move the four-state machine to `core/components/image-status/image-status.machine.ts` (skip if `add-avatar` already wrote it there); `avatarMachine` re-exported as an alias; Avatar's Node, React and browser tests pass unchanged before and after
- [ ] 1.2 Node tests for Image's use: `alt` present / empty / missing does not affect status; fallback timing identical to Avatar's

## 2. Connect

- [ ] 2.1 `image.connect.ts` per design §2: name on `<img>` in `loading`/`loaded` and on Root (`role="img"` + `aria-label`) in `idle`/`error`, Fallback always `aria-hidden`, `data-decorative`, Img `hidden` in `idle` and `error`, `src` last, `alt` omitted + dev error when missing, consumer attributes passed through, no inline styles
- [ ] 2.2 Unit tests for every cell of the design §2 table, named and decorative

## 3. React parts (`packages/react/src/image`)

- [ ] 3.1 Root (required `alt: string` in the types), Img (typed `img` props without `alt`, registration as Avatar's Image), Fallback; `render` on each
- [ ] 3.2 React tests: type test (missing `alt` fails to compile), SSR + hydrate with a cached image (no fallback frame), lazy image below the fold, framework image component through `render` (one request)

## 4. Contract and driver

- [ ] 4.1 `image.contract.ts` per design §3 (locate by role `img` + name in every status, decorative by `data-instance`, queries, `waitForStatus`, Avatar's event map)
- [ ] 4.2 `getImage` in `@rind-ui/testing`, reusing Avatar's image fixtures; driver tests in browser mode and Playwright; jsdom test documents that statuses beyond `idle` need a real browser

## 5. Model-based tests

- [ ] 5.1 `testMachine(imageContract, …)` over the props classes in the spec (named and decorative); invariants: exactly one exposed `img` named `alt` (zero decorative), on the right element per status, `<img>` hidden exactly in `idle`/`error`; axe per state (`image-alt`, `role-img-alt`); virtual screen reader reads the same name across `loading → error`

## 6. Theme (`packages/theme/src/image.css`)

- [ ] 6.1 `@layer rind.components`, `:where()` selectors, `--rind-image-*` tokens read with fallbacks and never declared; one-cell grid stacking, ratio token, fit token, no fade, no `[hidden]` override, forced-colors Fallback border; `decoration` family; imported from `index.css`
- [ ] 6.2 Playwright captures per status, ratio box kept in `error` (bounding box equal across statuses), forced colors

## 7. Site examples

- [ ] 7.1 Site examples (apps/site/examples/image.tsx, state examples for every contract state): loaded, slow with a Skeleton fallback, broken with an icon fallback, no source, decorative, 16:9 ratio box with `contain`, inside a `<figure>` with a caption, inside a link (name = `alt`), `<picture>` art-direction recipe, driver example; ARIA snapshots per status; axe clean

## 8. Docs

- [ ] 8.1 Docs page (generated API facts): writing `alt` (and when `alt=""`), name per status, fallback timing (link to Avatar), lazy loading and why it is not the default, ratio box and `object-fit`, `<figure>` and long descriptions, `<picture>` recipe, framework image components, Image vs Avatar, driver example, `llms.txt` entry
- [ ] 8.2 Migrate Reado's `ImageView` (design Migration Plan) in a Reado change once released; set Image to `wip`/`done` in `docs/components.md` as it progresses; archive when approved

## 9. Proof

- [ ] 9.1 `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green; changeset for core, react, testing, theme
