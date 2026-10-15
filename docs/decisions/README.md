# Decisions

Why rind-ui is built the way it is. One file per decision; a decision is changed
by a new record that supersedes it, not by silently editing history.

| # | Decision | Status |
|---|---|---|
| [0001](0001-vision.md) | Vision: what rind-ui is, goals, rejected ideas | accepted |
| [0002](0002-architecture.md) | Architecture: packages, four layers, tooling, build order | accepted |
| [0003](0003-testing.md) | Testing: contracts, drivers, adapters, model-based tests | accepted |
| [0004](0004-theme-and-storybook.md) | Theme and Storybook | accepted |
| [0005](0005-llm-knowledge.md) | Making rind-ui known to LLMs | accepted |
| [0006](0006-fx.md) | fx visual effects — secondary | exploring |
| [0007](0007-white-label-theme.md) | The theme is a white-label system: tokens, builder, variants, presets | accepted |
| [0008](0008-dom-accessibility-api.md) | dom-accessibility-api in @rind-ui/testing | accepted |
| [0009](0009-internationalized-number.md) | `@internationalized/number` as a runtime dependency | accepted |
| [0010](0010-icons.md) | Icons: Phosphor glyphs as CSS tokens in the theme | accepted |
| [0008](0008-dom-accessibility-api.md) | `dom-accessibility-api` in @rind-ui/testing | accepted |

Decisions say *why*. Behaviour — what a component SHALL do — is specified in
[`openspec/`](../../openspec/).
