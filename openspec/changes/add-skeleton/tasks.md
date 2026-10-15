## 0. Prerequisites

- [ ] 0.1 Confirm `add-foundations`, `add-a11y-foundations` and `add-theme-system` are applied, and the `decoration` family request (design.md) is applied or answered

## 1. Machine

- [ ] 1.1 `skeleton.machine.ts` per design §2: `bindProp("loading")` states, `announceLoaded` only on `loading → loaded` with `announceOnLoad`, `prepareAnnouncer` on mount
- [ ] 1.2 Node tests with the recording announcer: mount loading / mount loaded / `loading → loaded` / `loaded → loading`, with and without `announceOnLoad` (string and `true`) (chakra-ui#2864)

## 2. Connect and messages

- [ ] 2.1 `skeleton.connect.ts` per design §3: `aria-busy` on Content only, Item `aria-hidden` + `inert` (with children) + `data-animate`, Item `loading` override, Status visually hidden text, boolean `data-*` present-empty (kobaltedev/kobalte#453), no inline styles, consumer attributes passed through; Status-inside-Content dev warning
- [ ] 2.2 `skeleton.messages.ts` (`loading`, `loaded`); unit tests for every attribute in the spec

## 3. React parts (`packages/react/src/skeleton`)

- [ ] 3.1 Root (context), Status, Content, Item; `render` on each; inert value per React version
- [ ] 3.2 React tests: SSR + hydrate (attributes already in HTML, no mismatch), Tab skips a wrapped button while loading, wrapped button focusable after load

## 4. Contract and driver

- [ ] 4.1 `skeleton.contract.ts` per design §4 (locate within, queries, states, `$sync:loading` prop step, `{ skip }` mount, per-contract invariants)
- [ ] 4.2 `getSkeleton` in `@rind-ui/testing` with the announcement log; driver tests in browser mode, jsdom and Playwright

## 5. Model-based tests

- [ ] 5.1 `testMachine(skeletonContract, …)` over the props classes of design §4; spec invariants per step; virtual screen reader reads "Loading" once and no placeholder (mui/material-ui#28057, #31363, adobe/react-spectrum#8479); axe per state

## 6. Theme (`packages/theme/src/skeleton.css`)

- [ ] 6.1 `@layer rind.components`, `:where()` selectors, `--rind-skeleton-*` tokens read with fallbacks and never declared, light/dark values; wrapping Items keep size with transparent text and per-line shapes; fixed-attachment shimmer only under `prefers-reduced-motion: no-preference` (≥ 1.5 s); forced-colors fill; `decoration` family; imported from `index.css`
- [ ] 6.2 Playwright captures: light/dark, forced colors, circle in WebKit mid-animation (mui/material-ui#24050, #19429), reduced motion (`getAnimations()` empty), loaded (no animation)

## 7. Stories (`apps/storybook`)

- [ ] 7.1 Themed stories: card placeholder, text lines wrapping stale text, list with Content as `ul`, avatar circle, with `announceOnLoad`, `animate={false}`, Image fallback holding a Skeleton.Item, driver example; ARIA snapshots per state; axe clean

## 8. Docs

- [ ] 8.1 Docs page (generated API facts): one loading area many placeholders, where `aria-busy` goes and why the Status sits outside it, when to use `announceOnLoad`, Progress vs Skeleton, reduced motion, list/table recipe, migration from Kobalte/MUI/Chakra, driver example, `llms.txt` entry
- [ ] 8.2 Set Skeleton to `wip`/`done` in `docs/components.md` as it progresses; archive when approved

## 9. Proof

- [ ] 9.1 `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green; changeset for core, react, testing, theme
