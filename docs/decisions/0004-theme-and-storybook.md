# 0004 — Theme and playground

Status: accepted · 2026-10-14 · Theme section superseded by [0007](0007-white-label-theme.md)

## Theme

`@rind-ui/theme` is a calm, standard stylesheet that exists so components can be
seen — in Storybook now, on the docs site later. It is optional, and the library
must never assume it is loaded.

Rules:

- **Tokens only.** `tokens.css` defines every value as a `--rind-*` custom
  property. Component styles read tokens and nothing else; re-theming means
  overriding properties, never selectors.
- **Selects on the styling contract, never on classes**:
  `[data-scope="dialog"][data-part="content"][data-state="open"]`. If the theme
  needs a hook the component does not expose, the component is missing a `data-*`
  attribute — fix it there.
- **Light and dark via `light-dark()`.** The OS preference decides unless an
  ancestor sets `data-theme="light"` or `data-theme="dark"`.
- **Motion respects `prefers-reduced-motion`** through duration tokens.
- One stylesheet per component, imported from `index.css` as components land.

Later, the theme can become a registry of styled components (shadcn-style) — a
separate decision when it comes.

## Storybook

Storybook 10 (`apps/storybook`) is the playground and the future source of docs
examples.

Alternatives considered: **Ladle** (React only, lighter) and **Histoire** (Vue/Svelte
first). Storybook is the only one that covers every framework we may add, and
its Vitest addon turns stories into browser tests — which fits
[0003-testing.md](0003-testing.md).

Setup:

- Resolves workspace packages from source (`@rind-ui/source` condition).
- Toolbar toggle for System / Light / Dark.
- `@storybook/addon-a11y` with `test: "error"`: an axe violation fails the story's
  test run. The Vitest addon that runs stories as tests is wired in with the first
  component (nothing to test before that).
- Every component gets: a default story, a story per notable state, and a story
  that shows its driver in use (the docs site reuses it as the testing example).
