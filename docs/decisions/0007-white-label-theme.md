# 0007 — The theme is a white-label system

Status: accepted · 2026-10-14 · Supersedes the "Theme" half of [0004](0004-theme-and-storybook.md)

## Context

0004 described `@rind-ui/theme` as a calm stylesheet "so components can be seen".
That is too little. The theme's job is **white-labelling**: one product, many
brands. A consumer (or each of their tenants) must be able to re-skin every rind-ui
component from a handful of brand inputs, at runtime, without forking CSS and
without breaking accessibility.

## Decision

### Three token tiers

1. **Brand inputs** — the only thing a white-label customer sets:
   brand colour(s), neutral tint, font families, radius scale, density, motion.
   A dozen values, not a hundred.
2. **Semantic tokens** — derived from the inputs: `--rind-color-bg`, `surface`,
   `text`, `text-muted`, `accent`, `accent-text`, `border`, `focus`, `danger`, …,
   spacing and size steps from density, radius per component family.
3. **Component tokens** — per part (`--rind-dialog-radius`,
   `--rind-button-height`), defaulting to semantic tokens, overridable one by one.

Component stylesheets read tier 3 only; tier 3 reads tier 2; tier 2 reads tier 1.
Overriding at any tier works.

### Derivation in CSS, validation in TypeScript

- Tier 2 is derived **in CSS** with OKLCH relative colour syntax
  (`oklch(from var(--rind-brand) …)`) and `light-dark()`, so a brand switch is one
  custom-property change at runtime — no rebuild, no JS.
- A typed **theme builder** (`defineTheme({ brand, neutral, radius, density, … })`)
  produces the same CSS for build-time use, and **validates contrast** (WCAG 2.2 AA
  for text and UI pairs, focus ring 3:1) in both light and dark, failing loudly
  when a brand colour cannot meet it — and proposing the nearest passing shade.
  Relative colour syntax cannot check contrast; the builder can.

### Scoped, multi-tenant

- A theme applies to any subtree: `[data-rind-theme="acme"]`, so several brands can
  coexist on one page (previews, multi-tenant dashboards, embeds).
- Light/dark stays orthogonal: `data-theme="light|dark"` or the OS preference.
- Themes are plain CSS files or a `<style>` the builder returns; no CSS-in-JS
  runtime, CSP-friendly.

### Ready-made variants and presets

The user asked for "a couple of ready-made variants" on top of tokens and builder:

- **Component variants**, kept small: `data-variant` (`solid` · `soft` · `outline` ·
  `ghost`, only where they make sense for the component) and `data-size` (`sm` · `md`
  · `lg`). They are **attributes the consumer sets**; the core passes them through
  untouched and never reads them, so the library stays headless. The theme styles
  them, each through tier-3 tokens (`--rind-button-solid-bg`, …), so a white-label
  brand re-skins every variant at once.
- **Theme presets**: two to start — `calm` (default: soft radius, comfortable
  density) and `crisp` (small radius, compact density, stronger borders). A preset is
  just a set of brand inputs fed to the same builder, so a customer can start from one
  and override a few inputs.

### What stays

Everything from 0004 that is about mechanics: styles select only on `data-scope`,
`data-part`, `data-state`; never on classes; reduced motion via duration tokens;
forced-colors support; one stylesheet per component.

## Consequences

- `@rind-ui/theme` grows a tiny TS entry (the builder + contrast checker) next to
  its CSS. The CSS works without it.
- Storybook gets a brand switcher (a few sample brands) and a contrast report.
- The fx configurators (0006) can reuse the same builder pattern.
- This needs an OpenSpec change (`add-theme-system`) before the first component
  stylesheet lands, so component changes write tier-3 tokens from day one.

## Decided

Tokens + builder + a couple of ready-made variants and presets (user, 2026-10-14).
`data-tone` (danger | warning | success re-pointing the accent roles) confirmed by the
user, 2026-10-14. Icons: see [0010](0010-icons.md).
