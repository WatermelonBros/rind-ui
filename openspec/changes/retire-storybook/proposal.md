# Retire Storybook: the docs site's examples become the stories

## Why

The docs site (`apps/site`) now shows every component with live examples in every skin, and
is what users read. Storybook duplicates it: every component writes stories twice, CI builds
Storybook and runs three Storybook test slices, and its stories have been the source of
several CI-only failures. The user decided to stop maintaining it.

Storybook does three jobs in the test suite that must survive the move: axe on every story in
three engines, the Playwright fixtures (drivers, generic invariants, forced colors, ARIA
snapshots per state story) that open built stories, and the state-story coverage check.

## What Changes

- **Examples harness** (new capability `examples-harness`): every site example is reachable at
  a stable URL that renders only the example (no site chrome), with skin and scheme chosen by
  query; examples can be named for contract states (state examples). A static build of the
  site serves them to Playwright.
- **Tests move to the harness:** the Playwright fixtures open examples instead of
  `storybook-static`; axe runs on every example in Chromium, Firefox and WebKit; per-state ARIA
  snapshots key on state examples; the coverage check requires a state example per contract
  state.
- **Storybook removed:** `apps/storybook`, its dependencies, the `storybook` Vitest project and
  CI slices, `serve-static` use, turbo outputs, the Storybook-only theme stories (Tokens,
  Contrast report, Showcase) move to site pages.
- **Process:** every queued change's "Stories" task becomes "Site examples"; CLAUDE.md and
  openspec/config.yaml say so; decision 0011 supersedes the Storybook half of 0004.

## Impact

- Specs: new `examples-harness`; MODIFIED `a11y-test-tooling` (ARIA Snapshots Per State
  Story), `theme-presets` (Storybook requirements become site requirements), `theme-scoping`
  (brand switch scenario).
- Code: apps/site (harness, examples for every existing story), packages/testing fixtures,
  vitest.config.ts, turbo.json, package.json, .github workflows, docs, all queued changes'
  tasks.md.
- Two sessions: the site session builds the harness and ports examples; the implementer moves
  the tests and removes Storybook. Lands after add-dialog, before add-alert-dialog.
