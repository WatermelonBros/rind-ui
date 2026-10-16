## 0. Prerequisites

- [ ] 0.1 Confirm `add-foundations`, `add-a11y-foundations`, `add-button` (`button-like-element`), `add-link` (`link-navigation`), `add-popover` (trigger naming rule) and `add-theme-system` are applied
- [ ] 0.2 Use add-link's `onActivate` disposition and `focusableWhenDisabled` (request 1, satisfied in add-link); link-mode activation tests (5.3) depend on add-link being applied

## 1. Machine and range (`core/components/pagination`)

- [ ] 1.1 `pagination.range.ts`: `paginationRange({ page, totalPages, siblingCount, boundaryCount })` with stable keys; property test over `totalPages` 1–60 × page × siblings 0–3 × boundary 0–2 for every invariant in "Visible Range" (zag#2885, reka-ui#970, reka-ui#595, kobaltedev/kobalte#603, zag#1889)
- [ ] 1.2 `pagination.machine.ts`: one state `idle`; events `SET_PAGE`, `PREV`, `NEXT`, `FIRST`, `LAST`, `SET_PAGE_SIZE`, `COUNT.CHANGE`; controllables `page` (1) and `pageSize` (10); typed props union (`totalPages` | `count` + `pageSize`); `totalPages ≥ 1`; view-time clamp; `onProps` → `COUNT.CHANGE`
- [ ] 1.3 `node` tests: every guard, keep-first-item page-size rule, clamping with reason `COUNT.CHANGE` (kobaltedev/kobalte#461), empty data (zag#2921, bits-ui#894), no change on current page, callback sees the new page (bits-ui#646), controlled proposal/refusal, type tests for the props union

## 2. Connect (`pagination.connect.ts`, `pagination.messages.ts`)

- [ ] 2.1 Root `nav` name from messages unless labelled; Page and triggers via `linkProps` (link mode) or `buttonLikeProps`; `aria-current="page"` on the current page only; `focusableWhenDisabled` default `true`; unavailable links without `href` (zag#3399)
- [ ] 2.2 Trigger names from messages only without own text; Ellipsis `aria-hidden`, no role; `data-*` per the spec table
- [ ] 2.3 Same-tab-only `SET_PAGE` for link activations; modifier and middle clicks untouched
- [ ] 2.4 Dev warnings: duplicate landmark names, controlled `page`/`pageSize` without handler (ark#3724), invalid inputs; unit tests for every attribute row

## 3. Parts (`packages/react/src/pagination`)

- [ ] 3.1 `Root`, `List`, `Item`, `Page`, `Ellipsis`, `First`, `Previous`, `Next`, `Last`, each with `render`; `Root` render state (`page`, `pageSize`, `totalPages`, `pages`, `range`)
- [ ] 3.2 React tests: Strict Mode, SSR + hydrate (ids, `aria-current`, `href`s match), `render` with a router link component, consumer `aria-label`

## 4. Contract and driver

- [ ] 4.1 `pagination.contract.ts` per design §7: locate by `navigation` + name, actions with pointer and keyboard twins and postconditions, queries, event map with `{ skip }` and prop steps, per-contract invariants
- [ ] 4.2 `getPagination` exported from `@rind-ui/testing`; the same driver test in `browser`, `jsdom` and Playwright

## 5. Tests

- [ ] 5.1 `testMachine` with the argument classes of "Model-Based Coverage" in pointer, keyboard and virtual modalities, RTL run, focus-never-on-body after each step, axe per state
- [ ] 5.2 Browser tests for every spec scenario, each regression reproducing its issue first (ark#4056, ark#3475, zag#3399, zag#626, zag#2921, bits-ui#894, bits-ui#911, bits-ui#853, bits-ui#1346, bits-ui#646, react-spectrum#6159, kobaltedev/kobalte#461)
- [ ] 5.3 Link mode in Chromium, Firefox and WebKit: ⌘/Ctrl-click and middle click open a new tab and leave the page unchanged; `RouterProvider` navigate called once; Enter follows the link once
- [ ] 5.4 Focus: holding Enter on Next to the last page keeps focus on Next; "disable while loading" keeps focus on the pressed page

## 6. Theme (`packages/theme/src/pagination.css`)

- [ ] 6.1 `@layer rind.components`, `:where()` selectors on `data-scope="pagination"` / `data-part`; tier-3 `--rind-pagination-*` tokens (design §6) read with semantic fallbacks and never declared; controls in the `toggle item` family (variant matrix, sizes inherited from `Root`); current page selected look with a 3:1 `border`-role edge; `[data-disabled]` without hover; ≥ 24×24 targets; forced-colors `Highlight` outline on the current page; RTL chevron mirror; reduced motion; a `data-tone="danger"` state; imported from `index.css`

## 7. Site examples and docs

- [ ] 7.1 Site examples (apps/site/examples/pagination.tsx, state examples for every contract state): buttons, links with `getPageHref`, client router, 1 / 5 / 20 / 100 pages, `siblingCount` and `boundaryCount` variants, with page-size Select, disabled while loading, icon-only triggers, two paginations around a table (distinct names), RTL, 320 px, driver usage; state examples for first, middle and last page
- [ ] 7.2 Docs page (generated API facts + guide): range semantics with the three example ranges, buttons vs links, focusable unavailable triggers, announcing or focusing results after a page change, page-size composition, driver example
- [ ] 7.3 Mark Pagination `done` in `docs/components.md` on archive; changeset; `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green
