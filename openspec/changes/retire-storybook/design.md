# Design: retire Storybook

## Examples harness (apps/site)

Today each docs page has `apps/site/examples/<slug>.tsx`: every exported zero-prop function
is an example, `variants` lists them in page order (`Basic` first), `examples/index.ts` maps
slug → module, `scripts/content.ts` generates the shown code, skins are `skins/*.css` on
`[data-skin]`.

- **URL:** `/examples/<slug>/<example>/<skin>/`, example in kebab-case (`DisabledItem` →
  `disabled-item`), generated statically for every skin; `/examples/<slug>/<example>/` is the
  `none` skin. Path variants (not a query) so the first paint is already the right skin.
- **Skins:** `none` (no CSS at all: structure tests and ARIA snapshots), `bare`, `crisp`,
  `juicy` (the site's demo skins), `theme-calm` and `theme-crisp` (`@rind-ui/theme` with that
  preset: the theme's axe colour-contrast checks, which today run on themed stories).
  `?scheme=light|dark` selects the colour scheme.
- **Bare page:** a route group gives `/examples` its own layout: `<main data-example-root
  data-skin>` with RindProvider and `Heading.Level level={1}`; no navigation, intro, smooth
  scroll or phase; reduced motion forced, so snapshots are stable.
- **State examples:** a module may export `states: Record<ContractState, ExampleName>`; the
  coverage check requires one per contract state (replaces Storybook's `states` export).
- **Hidden examples:** `variants: { X: { title, hidden: true } }` get a harness URL but are not
  listed on the docs page; today's `*Fixture` stories become hidden examples in apps/site.
- **Discovery:** the build writes `/examples/index.json`: `[{ slug, example, title, states,
  hidden, urls: { [skin]: path } }]`. Tests iterate it; no hard-coded ids.

## Tests

- **Playwright fixtures** (`packages/testing/fixtures/*/*.pw.test.ts`): serve the site's static
  export (`apps/site/out`) instead of `storybook-static`, and open examples through a helper
  `openExample(page, slug, example, skin?)`.
- **Axe per example:** a Vitest browser project (or the Playwright runner) visits every example
  from `index.json` in Chromium, Firefox and WebKit on `none` and `theme-calm`/`theme-crisp`
  in light and dark; every skin also in Chromium through the existing site audit.
- **ARIA snapshots per state:** keyed `<slug>--<example>` under
  `packages/testing/fixtures/__aria__/`, taken on the `none` skin, matched in three engines.
- **Theme pages:** the Storybook Tokens, Contrast report and Showcase stories become site
  pages under `/theme/` (the contrast report stays generated from the builder).

## Removal

`apps/storybook`, `@storybook/*` dependencies, the `storybook` Vitest project, the three CI
slices, `scripts/serve-static.mjs` if unused, turbo `storybook-static/**` output and
`@rind-ui/storybook#build` dependency, the a11y-nightly build step (switches to the site
export). CLAUDE.md, openspec/config.yaml and every queued change's "Stories" task change to
"Site examples". Decision 0011 supersedes the Storybook half of 0004.

## Order

1. Site session: harness (route group, path variants, skins incl. none/theme-*, index.json,
   states/hidden), port every existing story to an example (components, fixtures, theme pages).
2. Implementer: move the Playwright fixtures, axe and ARIA snapshots to the harness, prove
   parity (same count of checks per component), then delete Storybook and update CI, docs and
   queued tasks — in one PR after step 1 is merged.
