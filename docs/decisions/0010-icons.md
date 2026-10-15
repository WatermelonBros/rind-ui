# 0010 — Icons: Phosphor glyphs as CSS tokens in the theme

Status: accepted · 2026-10-14

## Context

Headless libraries (Ark, Radix Primitives, React Aria, Base UI) ship no icons: indicator
parts (checkbox check, select chevron, close X, submenu arrow, accordion chevron, …) are
empty slots. Styled libraries pick a set (Park UI and shadcn use Lucide). The user wants
components to work out of the box with good default icons, without tying anyone to one
framework or one icon package, and Phosphor as the default.

## Decision

- **Core: no icons.** Indicator parts render the consumer's children; with none, they
  render nothing extra. The core never reads or ships icons.
- **Theme: Phosphor glyphs as CSS tokens.** `@rind-ui/theme` generates, at build time,
  `icons.css` from `@phosphor-icons/core` (raw SVGs, MIT, framework-free; a
  devDependency only — consumers install nothing): one token per glyph the components
  need, e.g. `--rind-icon-check: url("data:image/svg+xml,…")`, in `@layer rind`.
  Component stylesheets draw them on existing parts (`mask-image` with
  `background-color: currentColor`, visible under forced colors via `CanvasText`), so it
  works with plain HTML and every framework. The weight (regular / bold) is a build
  option of the set.
- **Swapping icons:** override a token in CSS (globally or per `[data-rind-theme]`
  tenant), or, in React, pass icon components through `RindProvider icons={{ check: … }}`,
  typed by icon name, which parts render as children when the consumer gave none.
- Phosphor's licence and attribution go into the theme's NOTICE.

Alternatives: Phosphor as a runtime npm dependency (`@phosphor-icons/react`) — React
only, an extra package for every consumer; no default icons — rejected by the user.

## Consequences

- add-theme-system gains an icons capability (token list, generation script, forced
  colors, swap paths, provider typing); component theme tasks use the tokens.
- `data-tone` (in 0007's variants) is confirmed by the user, 2026-10-14.
