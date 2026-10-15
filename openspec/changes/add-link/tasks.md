## 0. Prerequisites

- [ ] 0.1 Confirm `add-foundations`, `add-a11y-foundations`, `add-button` (`button-like-element`) and `add-theme-system` are applied
- [ ] 0.2 Raise the requests in design.md "Requests to other changes" with the owners of `add-a11y-foundations` (press end on blur / hidden), `add-theme-system` (`link` family row), `add-button` (anchor branch uses `link-navigation`) and, optionally, `add-menu` / `add-toolbar`

## 1. Machine

- [ ] 1.1 None: Link is stateless (design §1). Record `stateless: true` in the docs generator's component metadata

## 2. Shared modules

- [ ] 2.1 `core/env/router.ts`: `Router`, `RouterCapability`, augmentable `RouterConfig`, `Href` / `RouterOptions` types; type tests for augmentation
- [ ] 2.2 `core/dom/link.ts`: `linkProps` (native anchor, fallback role/tabIndex, disabled, `focusableWhenDisabled`, `current`, `data-external`, `resolve()` skipping scheme and `//` URLs, `onClick` routing with `defaultPrevented` check, `auxclick` disposition, `onActivate`), `shouldBrowserHandle`, `openLink`
- [ ] 2.3 Quirk entries `talkback-unfocusable-link` and `webkit-synthetic-click-modifiers` with bug links, repro tests and removal conditions
- [ ] 2.4 `node`/jsdom unit tests: every attribute row × tag (`a`, `div`, `span`) × disabled × `focusableWhenDisabled` × current values; `resolve()` table (relative, root-relative, `https:`, `mailto:`, `//cdn`) (react-spectrum#6397, #6803, #5335); `href()` never called without `href` (react-spectrum#9490)

## 3. Connect (`core/components/link/link.connect.ts`)

- [ ] 3.1 `linkConnect` = `linkProps` with scope/part `link`; messages file (empty today, reserved for future AT strings); development warnings: interactive content inside, non-anchor fallback loses browser features

## 4. Parts (`packages/react/src/link`)

- [ ] 4.1 `<Link>` with `render`, rendered-tag detection, press/hover/focus factories; `RouterProvider` (`navigate`, `href`) over `RindProvider environment`
- [ ] 4.2 React tests: SSR + hydrate (enabled, disabled, current, fallback `div`) with zero warnings; `href` toggling under a provider throws nothing (react-spectrum#7028); `render` with react-router's `Link` and Next.js `Link` routes exactly once (react-spectrum#2525) and does not loop (mui/base-ui#5432); nested providers, innermost wins (react-spectrum#6557)

## 5. Contract and driver

- [ ] 5.1 `link.contract.ts` per design §6 (locate by link + name; `follow`, `followInNewTab`, `middleClick` with keyboard `none` reason; queries `href`, `current`, `isDisabled`, `isExternal`, `isFocusVisible`)
- [ ] 5.2 `getLink` and `fakeRouter()` exported from `@rind-ui/testing`; `env.navigated()` in the DOM adapter (router spy, location) and Playwright adapter (URL change, new page)
- [ ] 5.3 Driver tests passing unchanged in `browser`, `jsdom` and Playwright runs, including the disabled-link failure message

## 6. Tests

- [ ] 6.1 No model-based test (no machine). Browser tests in Chromium, Firefox, WebKit for every `link-navigation` and `link` scenario, each regression reproducing its issue first: Enter fires the router link's click (react-spectrum#9868), Space does nothing, ⌘/Ctrl-click and Ctrl+Enter new tab, Alt-click (react-spectrum#6614), middle click on disabled link (ariakit#7153), consumer onClick on disabled (react-spectrum#8827), `_blank` pressed state (react-spectrum#6094), external `_blank` with a router, consumer `preventDefault` defers (react-spectrum#7566), non-anchor fallback with modifiers and basename (react-spectrum#6347, kobaltedev/kobalte#712)
- [ ] 6.2 Generic invariants on every story: accessible name, no `aria-hidden` focusables, `virtual` modality bare click = one navigation
- [ ] 6.3 Partial ARIA snapshots: enabled, current, disabled, fallback

## 7. Theme (`packages/theme/src/link.css`)

- [ ] 7.1 Tier-3 tokens `--rind-link-*` (color, color-hover, decoration, underline-offset, current-weight, disabled-color) read with semantic fallbacks and never declared; `@layer rind.components`, `:where()` selectors; underline by default; `[data-current]`, `[data-disabled]`, `[data-focus-visible]` outline; family `link` (request 2); `data-tone="danger"` recolours; forced colors (`LinkText`, `GrayText`); imported from `index.css`

## 8. Stories (`apps/storybook`)

- [ ] 8.1 Inline link in text, standalone, external (`data-external` icon via CSS), current, disabled, `focusableWhenDisabled`, rendered as `div` (fallback), with react-router `RouterProvider`, with `render` of a router Link, RTL, driver usage; state stories per contract query; axe clean

## 9. Docs

- [ ] 9.1 Generated docs page (stateless: anatomy, props, `data-*`, keyboard table, routing setup for React Router / Next.js / TanStack Router, `render` vs `RouterProvider`, why Space does nothing, disabled links, driver + `fakeRouter` example) and `llms.txt` entry
- [ ] 9.2 Set Link to `wip` / `done` in `docs/components.md` as it progresses; archive when approved

## 10. Proof

- [ ] 10.1 `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green; changeset for core, react, testing, theme

## Amendments (from add-grid-list)

- [ ] A.1 Export the temporary-anchor activation routine (`activateLink`, modifiers, router, `target`) separately from the `role="link"` fallback props, for parts that keep their own role (`row`, `treeitem`); fallback built on it; tests for "Row with a link keeps its role" and "Fallback uses the same routine"
