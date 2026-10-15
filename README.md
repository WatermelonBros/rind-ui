# rind-ui

Headless UI components: behaviour, accessibility and state — you bring the styles.

- **Complete.** The goal is every component any headless library ships, and more
  ([inventory](docs/components.md)).
- **Testable by design.** Every component comes with an official test driver for
  Testing Library and Playwright, and model-based tests generated from its state
  machine.
- **Built for AI interfaces.** Prompt input, message thread, streaming message,
  tool approval — headless primitives the others do not have.
- **Known to LLMs.** `llms.txt`, generated per-component docs, an agent skill.

> Status: pre-alpha. Nothing is published yet.

## Packages

| Package | |
|---|---|
| `@rind-ui/core` | Framework-agnostic machines, DOM utilities and contracts |
| `@rind-ui/react` | React components |
| `@rind-ui/testing` | Test drivers and environment setup |
| `@rind-ui/theme` | Optional default theme |

## Development

```sh
pnpm install
pnpm storybook
```

See [CLAUDE.md](CLAUDE.md) for conventions and [docs/decisions/](docs/decisions/)
for why things are the way they are.

## License

MIT
