## Why

Decision [0007](../../../docs/decisions/0007-white-label-theme.md) makes `@rind-ui/theme`
a white-label system: one product, many brands, re-skinned from a dozen inputs at
runtime without forking CSS or losing accessibility. Today `tokens.css` is a flat list
of hard-coded colours with no tiers, no scoping, no contrast checks and no portal story,
and component changes (`add-button`, `add-dialog`, `add-tabs`, …) are already waiting
to write tier-3 tokens. The token contract has to exist before the first component
stylesheet lands. Research: [docs/research/theme-system.md](../../../docs/research/theme-system.md).

## What Changes

- Three token tiers with fixed names: 12 **brand inputs** (`--rind-brand-*`),
  **semantic tokens** (`--rind-color-*`, `--rind-space-*`, `--rind-size-*`,
  `--rind-radius-*`, `--rind-text-*`, `--rind-duration-*`, `--rind-focus-*`, …) derived
  in CSS with OKLCH relative colour syntax and `light-dark()`, and **component tokens**
  (`--rind-<scope>-*`) that component stylesheets read with a semantic fallback.
- Five colour palettes (accent, neutral, danger, warning, success), each with the same
  seven role tokens, so `data-tone` can re-point a component without new CSS.
- **Theme scoping**: `[data-rind-theme="<name>"]` on any subtree, nested scopes,
  orthogonal light/dark through `color-scheme` (`data-theme="light|dark"`, the OS, or
  the app's own class), all theme CSS inside one `@layer rind`.
- **Portals keep the theme**: the portal host copies `data-rind-theme` and
  `data-theme` from the logical parent and keeps them in sync (request to
  `add-overlay-infrastructure`).
- **Theme builder** in a small TS entry `@rind-ui/theme/builder`: `defineTheme()`
  validates WCAG 2.2 AA pairs and the 3:1 focus ring in light and dark, computes exact
  in-gamut colours, proposes the nearest passing shade, and emits a CSP-friendly CSS
  string (DTCG 2025.10 JSON export optional). Runs in Node, edge and browsers; no
  runtime dependency.
- **Variants**: consumer-set `data-variant` (`solid` · `soft` · `outline` · `ghost`),
  `data-size` (`sm` · `md` · `lg`) and `data-tone`, passed through by the core and
  styled only by the theme, with a per-family matrix.
- **Presets** `calm` (default, on `:root`) and `crisp`, both plain brand inputs fed to
  the builder; their CSS is generated and checked in.
- **Icons** (decision 0010): `icons.css` generated from `@phosphor-icons/core` (devDependency
  only) into `--rind-icon-<name>` tokens; the core ships no icons.
- Storybook brand switcher (presets + sample brands incl. a failing one) and a
  contrast report panel.
- **BREAKING** (no consumer yet): `--rind-color-accent`, `-accent-hover`,
  `-accent-text`, `--rind-color-danger`, `--rind-color-focus`, `--rind-focus-ring` and
  the `.rind-root` class are replaced by the tiered names and `[data-rind-theme]`.

## Capabilities

### New Capabilities

- `design-tokens`: the three tiers, their names, the brand inputs, derivation rules,
  palettes and role tokens, cascade layer, preference handling.
- `theme-builder`: `defineTheme`/`checkTheme`, contrast pairs and thresholds,
  suggestions, adjust mode, CSS and DTCG output.
- `theme-scoping`: `data-rind-theme` scopes, nesting, light/dark, portals, SSR and
  CSP behaviour.
- `theme-variants`: `data-variant`, `data-size`, `data-tone` semantics and the
  per-family matrix; how component stylesheets plug in.
- `theme-icons`: Phosphor glyphs as `--rind-icon-<name>` tokens generated at build time,
  drawn by masks, swappable in CSS and through `RindProvider icons` (decision 0010).
- `theme-presets`: `calm` and `crisp`, the default, Storybook brand switcher and
  contrast report.

### Modified Capabilities

None. `theme-accessibility` (from `add-a11y-foundations`, not yet archived) is reused
as is: focus ring, non-colour state cues, target size and motion rules are not
restated here.

## Non-goals

- A JS theme provider, React context or colour-mode toggle component — themes are
  attributes and CSS only.
- Generating full 12-step scales or arbitrary palettes; only the role tokens.
- APCA / WCAG 3 conformance (draft, algorithm undecided); WCAG 2.2 AA only.
- Display-P3 / wide-gamut output; the builder emits sRGB-gamut colours.
- Theming inside closed shadow roots or iframes.
- A Tailwind plugin or `@theme` mapping (documented recipe only).
- Component stylesheets themselves — each component change writes its own.

## Impact

- `packages/theme`: `tokens.css` rewritten into tiers; new `presets/calm.css`,
  `presets/crisp.css`, `variants.css`; `base.css` keyed on `[data-rind-theme]`; new TS
  entry `src/builder/*` built with tsdown (export `./builder`); package description.
- `apps/storybook`: theme and brand toolbar globals, contrast report panel,
  forced-colors and reduced-motion globals reused from `add-a11y-foundations`.
- `add-overlay-infrastructure` (portal host attributes) and every component change's
  theme task (tier-3 names, variant matrix) — see design "Requests to other changes".
- Depends on `add-foundations` (packages, Storybook, Vitest) and
  `add-a11y-foundations` (`theme-accessibility`, `data-focus-visible`). No new runtime
  dependency.
