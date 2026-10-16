## 0. Prerequisites

- [x] 0.1 Confirm `add-a11y-foundations` and `add-theme-system` are merged, and the `identity` family request (design.md) is applied or answered

## 1. Machine and image status

- [x] 1.1 `core/dom/image-status.ts`: `settled(img)` (`complete` + `naturalWidth`, `decode()` for the ambiguous case); browser tests per engine (data URL, 404, slow, SVG without intrinsic size)
- [x] 1.2 `image-status/image-status.machine.ts` (aliased as `avatarMachine`, A.2) per design §2 (states, source counter guard, `fallbackReady` rules, `fallbackDelay` delayed transition, `onStatusChange`); Node tests for every `image-loading-status` and fallback scenario with a fake image capability and fake clock

## 2. Connect and messages

- [x] 2.1 `avatar.connect.ts` per design §3: `role="img"` only when named and not hidden, `alt=""`, `hidden` in `error` and `idle` (A.1), attribute order with `src` last, empty `src` omitted, `data-state` on Root/Image/Fallback, `data-variant`/`data-size`/`data-tone` pass-through, no inline styles; dev name error (Root), dev warnings (unnamed Group, second Image, Image `alt` ≠ Root name)
- [x] 2.2 `avatar.messages.ts` (`overflowLabel` with `Intl.PluralRules`); unit tests for every attribute in the spec

## 3. React parts (`packages/react/src/avatar`)

- [x] 3.1 Root, Image (registration from a layout effect, consumer `onLoad`/`onError` merged, typed `img` props and `render`), Fallback, Group, GroupOverflow; `render` on each
- [x] 3.2 React tests: Strict Mode, SSR + hydrate with no mismatch (delay 0 and > 0), image cached before hydration reaches `loaded` with no post-hydration fallback frame, framework image component through `render` (one request, bounded renders), lazy image below the fold

## 4. Contract and driver

- [x] 4.1 `avatar.contract.ts` per design §4 (locate by role `img` or `data-instance`, queries, `waitForStatus`, `{ skip }`, `$props:src` steps)
- [x] 4.2 `getAvatar` in `@rind-ui/testing`; image fixtures (data URL, 404, delayed route); driver tests in browser mode and Playwright; jsdom test documents that statuses beyond `idle` need a real browser

## 5. Model-based tests

- [x] 5.1 `testMachine(avatarContract, …)` over the props classes of design §4; invariants: name stable across statuses, no announcements, axe per state

## 6. Theme (`packages/theme/src/avatar.css`)

- [x] 6.1 `@layer rind.components`, `:where()` selectors, `--rind-avatar-*` tokens read with fallbacks and never declared; stacked, always-opaque Image over Fallback (no fade); Group overlap with logical properties and outline ring; `identity` family variants and sizes; `data-tone="danger"`; forced colors (`CanvasText` border); imported from `index.css`
- [x] 6.2 Playwright captures: each status, group LTR/RTL, forced colors

## 7. Site examples (`apps/site/examples/avatar.tsx`)

- [x] 7.1 Site examples (Storybook is retired): image, fallback initials and variants, broken image, lazy image, decorative beside a name, inside a button, group with overflow; state examples for every contract state (`idle`, `loading`, `loaded`, `error`); skin `apps/site/skins/avatar.css`. Slow image with and without `fallbackDelay`, RTL group and the driver example run in `fixtures/avatar/avatar.pw.test.ts`

## 8. Docs

- [x] 8.1 Docs page (generated API facts): anatomy, naming vs decorative, fallback timing, SSR behaviour and `fallbackDelay`, lazy loading and framework image components, retry by changing `src`, initials recipe with `Intl.Segmenter`, unstyled stacking CSS, driver example, `llms.txt` entry
- [x] 8.2 Avatar set to `done` in `docs/components.md`; the Reado `PersonAvatar` migration is a Reado change, out of this repo

## 9. Proof

- [x] 9.1 `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green; changeset for core, react, testing, theme

## Amendments (from add-image)

- [x] A.1 `image-loading-status` "Lazy-Safe Rendering": the `<img>` carries `hidden` in `idle` (no `src`, no `srcSet`) as well as in `error`; test for the "No source → `<img>` hidden" scenario
- [x] A.2 Image status machine at `core/components/image-status/image-status.machine.ts`, `avatarMachine` exported as an alias; test for the "Avatar and Image share one machine" scenario
