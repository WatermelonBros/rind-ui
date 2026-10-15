---
"@rind-ui/theme": minor
"@rind-ui/react": minor
---

Theme system: three token tiers (twelve `--rind-brand-*` inputs, semantic tokens derived in
CSS, per-component tokens), `data-tone` and `data-size` variants, `calm` and `crisp` presets,
`icons.css`, and a typed builder (`@rind-ui/theme/builder`: `defineTheme`, `checkTheme`,
contrast validation, DTCG export). `RindProvider` accepts `icons`.

Breaking token and selector renames:

- `--rind-color-accent` is now `--rind-color-accent-solid`
- `--rind-color-accent-hover` is now `--rind-color-accent-solid-hover`
- `--rind-color-accent-text` (text on an accent background) is now `--rind-color-accent-on-solid`;
  `--rind-color-accent-text` now means accent-coloured text on the page
- `--rind-color-danger` is now `--rind-color-danger-solid`
- `--rind-color-focus` is removed: use `--rind-focus-color`
- `.rind-root` is replaced by `[data-rind-theme]`
- radius tokens are derived from `--rind-brand-radius`
