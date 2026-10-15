## 0. Prerequisites

- [ ] 0.1 Confirm `add-foundations`, `add-a11y-foundations` and `add-theme-system` are applied
- [ ] 0.2 Raise the requests in design.md "Requests to other changes" with the owners of `add-dialog`, `add-alert-dialog`, `add-drawer`, `add-popover`, `add-accordion` and `add-theme-system`

## 1. Machine

- [ ] 1.1 None: Heading is stateless (design §1). Record `stateless: true` in the docs generator's component metadata

## 2. Connect (`core/components/heading/heading.connect.ts`)

- [ ] 2.1 `resolveHeadingLevel`, `nextHeadingLevel`, `headingProps` per design §2: explicit > context > 2, Level nesting, clamping with warnings (depth > 6 once per instance), role / `aria-level` by rendered tag, `data-level`
- [ ] 2.2 Empty-heading development check (after mount)
- [ ] 2.3 `node` unit tests: explicit / context / default × tag (`h2`, `h4`, `div`) × out-of-range and non-integer values × depth 7 (mui/base-ui#1678, adobe/react-spectrum#2632, #5077)

## 3. Parts (`packages/react/src/heading`)

- [ ] 3.1 `Heading` (`h{level}`, `render`), `Heading.Level` (context only), `useHeadingLevel()`; exports and types (`level` typed `1 | 2 | 3 | 4 | 5 | 6`)
- [ ] 3.2 React tests: nesting, anchored root, portalled content keeps the tree level, SSR + hydrate with no mismatch, consumer `data-*` pass-through

## 4. Contract and driver

- [ ] 4.1 `heading.contract.ts` (design §4): locate by role `heading` + exact name, query `level`, no actions, no traits
- [ ] 4.2 `getHeading` exported from `@rind-ui/testing`; driver tests in browser mode, jsdom and Playwright, including the multiple-match failure

## 5. Tests

- [ ] 5.1 No model-based test (no machine). Browser tests: ARIA snapshot of the nested-sections story (levels 2-3-4), axe `heading-order` and `empty-heading`, Chromium accessibility tree level for `render={<h4 />}` with level 2

## 6. Theme (`packages/theme/src/heading.css`)

- [ ] 6.1 `--rind-heading-<n>-font-size`, `-line-height`, `-font-weight`, `--rind-heading-color` read with typography fallbacks (never declared); selectors on `data-level`; no variant rules; `margin: 0`; no family (request 6); imported from `index.css`
- [ ] 6.2 Playwright captures per level and with a size override (adobe/react-spectrum#7671)

## 7. Stories (`apps/storybook`)

- [ ] 7.1 Themed stories: nested sections, anchored page root, card titles with `useHeadingLevel`, heading inside a popover, substituted `div` and `h4`, depth warning, driver example; ARIA snapshots; all pass axe

## 8. Docs

- [ ] 8.1 Generated docs page (stateless: level rules, root default and anchoring, portals, size vs level, using the hook in your own components, how Dialog/Accordion use it, driver example) and `llms.txt` entry
- [ ] 8.2 Set Heading to `wip` / `done` in `docs/components.md` as it progresses; archive when approved

## 9. Proof

- [ ] 9.1 `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green; changeset for core, react, testing, theme
