# 0011 — Site examples replace Storybook

Status: accepted · 2026-10-16 · Supersedes the "Storybook" half of [0004](0004-theme-and-storybook.md)

## Context

The docs site (`apps/site`) shows every component with live examples in every skin and is
what users read. Storybook duplicated it: every component wrote stories twice, CI built
Storybook and ran three Storybook test slices, and its stories caused several CI-only
failures. Storybook did three jobs we must keep: axe on every story in three engines, the
Playwright fixtures (drivers, generic invariants, forced colours, ARIA snapshots per state)
and the state-story coverage check.

## Decision

- **Examples are the stories.** A component's examples live in
  `apps/site/examples/<slug>.tsx` (every exported zero-prop function is an example);
  ported fixtures live in `apps/site/examples/fixtures/<slug>.tsx` and are hidden from the
  docs page. There are no Storybook stories.
- **Harness.** The static export (`apps/site/out`) serves each example alone, without site
  chrome, at `/examples/<slug>/<example>/[<skin>/]`; skins are `none`, `bare`, `crisp`,
  `juicy`, `theme-calm`, `theme-crisp`, and `?scheme=light|dark` picks the scheme.
  `/examples/index.json` lists every example, its `states` and `hidden` flags; tests
  iterate it, never a hard-coded list.
- **Tests.** Playwright tests open examples with `openExample(page, base, slug, example)`
  (`packages/testing/fixtures/harness.ts`). Axe runs on every example (no stylesheet and
  theme-calm / theme-crisp, light and dark) in Chromium, Firefox and WebKit. ARIA snapshots
  are keyed `<slug>--<example>` under `packages/testing/fixtures/__aria__` and embedded in
  docs with `<!-- aria:<slug>--<example> -->` blocks.
- **State examples.** "State stories" become state examples: a module's `states` maps every
  contract state to an example, and the coverage check fails when one is missing.
- **Process.** Every component ships site examples where it used to ship stories
  (after the theme stylesheet); `pnpm storybook` and `storybook-static` no longer exist.

## Consequences

- One place to write and read examples; docs and tests cannot drift.
- Tests depend on a site build (`apps/site/out`), which CI produces once.
- Decision 0004 keeps its Theme half (itself superseded by 0007); its Storybook half is
  history. Specs: see the change `retire-storybook`.
