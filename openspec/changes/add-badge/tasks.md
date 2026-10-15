## 0. Prerequisites

- [ ] 0.1 Confirm `add-foundations`, `add-a11y-foundations` and `add-theme-system` are applied

## 1. Machine

- [ ] 1.1 None: Badge is stateless (design §1). Record `stateless: true` in the docs generator's component metadata so the docs page omits the states table and the `testMachine` section

## 2. Connect (`core/components/badge/badge.connect.ts`)

- [ ] 2.1 `badgeConnect`: root id from the instance id, `data-*` per the spec, `content` (`aria-hidden`) and visually hidden `label` props only when `label` is set; no role, no live attributes emitted
- [ ] 2.2 Render-time development warnings through the logger: live `role` / `aria-live`, `aria-label` / `aria-labelledby` on root
- [ ] 2.3 `core/dom/badge-host.ts`: post-mount check (exposed and empty; interactive host with `aria-label`/`aria-labelledby` that neither contains the badge text nor lists the badge id in `aria-describedby`); development-only
- [ ] 2.4 `node` unit tests for every attribute combination and every warning (Kobalte role="status", mui/material-ui#22070, #49441, adobe/react-spectrum#4043)

## 3. Parts (`packages/react/src/badge`)

- [ ] 3.1 `Badge.Root` with `render`, children wrapped only with `label`, development check in a layout effect; exports and types
- [ ] 3.2 React tests: SSR + hydrate with and without `label` (no mismatch); consumer `data-variant`/`data-size`/`data-tone` and `role` pass-through

## 4. Contract and driver

- [ ] 4.1 `badge.contract.ts` (design §4): locate within a container, queries `text` and `isExposed`, no actions, no traits
- [ ] 4.2 `getBadge` exported from `@rind-ui/testing`; driver tests in `browser` and `jsdom` and through the Playwright adapter, including the multiple-match failure

## 5. Tests

- [ ] 5.1 No model-based test (no machine). Browser tests with `dom-accessibility-api`: host name "Comments 3 unread" (name from content), host description "3 unread" (`aria-describedby`), warning for a host `aria-label` without description, no warning when the label contains the count; rule-23 invariant fails for a `role="status"` wrapper; axe on every case

## 6. Theme (`packages/theme/src/badge.css`)

- [ ] 6.1 Tier-3 tokens `--rind-badge-*` read with semantic fallbacks (never declared), `@layer rind.components`, `:where()` selectors; `status` family variants (soft default, solid, outline), sizes, every `data-tone`; inline box that never stretches, centred text, `min-inline-size` = block size, `em` padding; imported from `index.css`
- [ ] 6.2 Forced-colors, 200 % zoom ("99+") and `data-tone="danger"` Playwright captures; builder contrast check of badge text on every tone × variant (ariakit#7591, #7604, mui/material-ui#49441)

## 7. Stories (`apps/storybook`)

- [ ] 7.1 Themed stories: text badge, count with `label`, "99+", dot with `label`, decorative badge, icon button with name from content, icon button with `aria-label` + `aria-describedby`, badge in a tab and a menu item, every tone × variant, RTL corner-badge recipe; ARIA snapshots; all pass axe

## 8. Docs

- [ ] 8.1 Generated docs page (stateless: anatomy, props, `data-*`, the two host recipes and why name-from-content is preferred, count-formatting recipe with `Intl.NumberFormat`, announcing a change with the Announcer, driver example) and `llms.txt` entry
- [ ] 8.2 Migrate Reado's `Badge` and its hosts (design Migration Plan) in a Reado change once released; set Badge to `wip` / `done` in `docs/components.md` as it progresses; archive when approved

## 9. Proof

- [ ] 9.1 `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green; changeset for core, react, testing, theme
