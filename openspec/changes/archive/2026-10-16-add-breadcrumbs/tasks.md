## 0. Prerequisites

- [x] 0.1 Confirm `add-foundations`, `add-a11y-foundations`, `add-collections`, `add-link` (`link-navigation`, `link` family row), `add-menu` and `add-theme-system` are applied — add-menu is not applied yet: the ellipsis examples and tests use a Popover; the contract finds a `menuitem` or a `link` in the open popup

## 1. Machine

- [x] 1.1 None: Breadcrumbs is stateless (design §1). Record `stateless: true` in the docs generator's component metadata

## 2. Connect (`core/components/breadcrumbs/breadcrumbs.connect.ts`)

- [x] 2.1 `deriveTrail` (design §2): current key (explicit, last-item default, `current={false}` opt-out), collapse range with `maxItems` / `itemsBeforeCollapse` / `itemsAfterCollapse`, never collapsing the current item or fewer than two items
- [x] 2.2 Part props: Root `nav` name from messages unless labelled; List `ol`; Item `li` with `hidden` while collapsed; Link via `linkProps` (scope `breadcrumbs`) or the current `<span aria-current tabindex="-1">` without press handling; Separator `aria-hidden` + `data-last`; Ellipsis render state (`items`, `label`); every `data-*` in the spec
- [x] 2.3 `breadcrumbs.messages.ts`: `label`, `showCollapsed(count)` with `plural()`
- [x] 2.4 Development warnings: current Item without any `aria-current` element; Breadcrumbs inside a `listbox` / `menu` / `combobox` popup (react-spectrum#7790)
- [x] 2.5 `node` tests: `deriveTrail` table for n = 0…8 × maxItems × before/after × current position (react-spectrum#2923, #6561)

## 3. Parts (`packages/react/src/breadcrumbs`)

- [x] 3.1 `Breadcrumbs.Root`, `List`, `Item`, `Link`, `Separator`, `Ellipsis`, each with `render`; Items as static item parts and a data-driven `items` form; per-part selectors so only changed Items re-render — deviation: one Root context, so every Item re-renders on a trail change (no per-part selectors)
- [x] 3.2 React tests: SSR + hydrate (static and data-driven, collapsed and not) with zero warnings; stable DOM nodes across trail updates (react-spectrum#1961); Item state not leaking into a Menu inside the last Item (react-spectrum#10571)

## 4. Contract and driver

- [x] 4.1 `breadcrumbs.contract.ts` per design §7: locate by `navigation` + name; `follow`, `openCollapsed`, `followCollapsed` with pointer and keyboard implementations; queries `items`, `current`, `collapsedCount`, `href`; invariants `separatorsHidden`, `singleCurrent`, `listChildrenAreCrumbs` — `openCollapsed` is done when the trigger (found by role button and the Ellipsis' `data-label`) has `aria-expanded="true"`; `followCollapsed` activates a `menuitem` or `link` (no `getMenu` until add-menu)
- [x] 4.2 `getBreadcrumbs` exported from `@rind-ui/testing`; driver tests passing unchanged in `browser`, `jsdom` and Playwright runs

## 5. Tests

- [x] 5.1 No model-based test (no machine). Browser tests in three engines for every scenario: focus kept when a crumb becomes current (react-spectrum#2592, #5294), current text selectable (react-spectrum#5549), Tab order with a collapsed trail, client routing and ⌘-click through `link-navigation`, ellipsis menu follows a collapsed item
- [x] 5.2 Accessibility: axe per story; Chromium AX tree shows no separator nodes and the list size equals the visible crumbs; virtual screen reader: separators not spoken, ellipsis trigger named "Show N more breadcrumbs" (react-spectrum#3967); current item exposed with no `role=link` (react-spectrum#3998)
- [x] 5.3 Partial ARIA snapshots per state story (plain, collapsed, current without `href`, current with `href`) — through Playwright `ariaSnapshot` of the plain and collapsed trails in breadcrumbs.pw.test.ts (Storybook is retired)

## 6. Theme (`packages/theme/src/breadcrumbs.css`)

- [x] 6.1 Tier-3 tokens `--rind-breadcrumbs-*` (gap, color, current-color, current-weight, separator-color, separator-size, min-target) defaulting to `--rind-link-*` and semantic tokens, never declared; `@layer rind.components`, `:where()` selectors; wrapping inline flex list; `[data-last]` separator hidden; RTL chevron mirror; 24 px targets; current by weight; `data-tone="danger"` recolours; forced colors; family `link`; imported from `index.css`

## 7. Site examples (`apps/site/examples/breadcrumbs.tsx`)

- [x] 7.1 Site examples: default, current with `href`, collapsed with a Popover in the Ellipsis, custom separator, path segments (the Reado shape, `currentValue="location"`), RTL; no `states` export (stateless). Client routing, CSS-drawn separators and the driver are on the docs page; 320 px wrapping is the theme's wrapping list

## 8. Docs

- [x] 8.1 Generated docs page (stateless: anatomy, props, `data-*`, current rules, separators, collapse recipe with Menu, SSR note for collapse with static items, Reado-style non-link items, driver example) and `llms.txt` entry
- [x] 8.2 Set Breadcrumbs to `wip` / `done` in `docs/components.md` as it progresses; archive when approved

## 9. Proof

- [x] 9.1 `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green; changeset for core, react, testing, theme
