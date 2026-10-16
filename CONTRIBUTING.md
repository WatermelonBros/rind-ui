# Contributing to rind-ui

Thanks for your interest in rind-ui! It is an open-source headless component library:
behaviour, accessibility and state, styled by you through `data-*` attributes.
Contributions of every size are welcome: a bug report with a minimal repro is as
valuable as a pull request.

## Ground rules

- **English everywhere.** Code, comments, commit messages, specs and docs.
- **Specs are the source of truth.** rind-ui is developed spec-first with
  [OpenSpec](https://github.com/Fission-AI/OpenSpec). Capabilities live in
  [`openspec/specs`](openspec/specs); work in flight lives in
  [`openspec/changes`](openspec/changes). Every scenario is an acceptance test.
  A behaviour change goes through an OpenSpec change, never straight into code.
- **No spec before research.** Before a component gets a spec, its research note in
  [`docs/research`](docs/research) must cover how every library that ships it
  implemented it, the bugs reported against it (open and closed), and the
  accessibility notes for its pattern.
- **Accessibility is behaviour.** Roles, keyboard support and announcements follow
  the WAI-ARIA APG and are specified and tested like any other behaviour.
- **Read [`CLAUDE.md`](CLAUDE.md)** for the architecture (machine → connect → parts,
  contract → drivers), the TypeScript rules and the code style. It is written for AI
  agents and humans alike.

## Getting started

Prerequisites: [Node.js](https://nodejs.org) 24+ (see [`.nvmrc`](.nvmrc)) and
[pnpm](https://pnpm.io) 11 (`corepack enable` picks the pinned version).

```sh
pnpm install
pnpm exec playwright install chromium firefox webkit   # browser tests
pnpm storybook                                         # playground on :6006
```

## The gate

CI runs exactly this; run it before opening a pull request:

```sh
pnpm lint        # Biome (format + lint) and the platform-check script
pnpm typecheck   # tsc in every package
pnpm build       # every package, Storybook and the site
pnpm test        # Vitest: node, jsdom, real browsers, Playwright, Storybook + axe
```

`pnpm format` applies Biome's fixes. The repository ships VS Code settings that
format on save with the [Biome extension](https://marketplace.visualstudio.com/items?itemName=biomejs.biome);
other editors read [`.editorconfig`](.editorconfig).

## What a component ships

A component is done when it has all of these, in this order: machine, connect,
React parts, contract, driver, tests (including model-based tests from the machine
graph), theme stylesheet, stories (every story passes axe), and a docs page whose API
block is generated from the component's `*.meta.ts`. Missing one means not done.

## Pull requests

- One change per pull request; keep the diff as small as it can be.
- Add a changeset (`pnpm changeset`) for anything a package consumer would notice.
- Link the issue or the OpenSpec change it implements.
- Tests prove the behaviour: a bug fix comes with the test that failed before it.

## Reporting bugs

Open an issue with the bug template. The fastest fix starts from a minimal
reproduction (a StackBlitz, a story, or a failing test) and the browser and
assistive technology you used.

## License

By contributing you agree that your contributions are licensed under the
[MIT License](LICENSE).

## Merging main into your branch

Update a pushed branch with `git merge origin/main` (never rebase and force-push). Append-only
lists (package barrels, the examples index, the review backlog) merge by union. For conflicts in
generated files (`llms.txt`, `docs/theme/tokens.md`, `packages/theme/tokens.manifest.json`,
`components.generated.ts`), take either side and run `pnpm regen`.
