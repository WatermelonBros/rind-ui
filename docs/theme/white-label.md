# White-label theming

rind-ui is themed with CSS custom properties in three tiers, scoped by the `data-rind-theme` attribute. One brand colour re-skins every component, light and dark, and a multi-tenant page can show several brands side by side. Token names: [token reference](https://rind.watermelon-studio.it/theme/tokens.md). Building validated themes: [builder.md](builder.md).

## Tiers

1. **Brand inputs** (`--rind-brand-*`): twelve values you choose.
2. **Semantic tokens** (`--rind-color-accent-solid`, `--rind-space-4`, `--rind-radius-control`, ...): derived from the inputs. Components read these.
3. **Component tokens** (`--rind-<scope>-<name>`, e.g. `--rind-button-radius`): optional per-component overrides, read with a tier 2 fallback and never declared by the library.

Override the lowest tier that does the job.

## The twelve brand inputs

| Input | Custom property | Builder key | Range |
|---|---|---|---|
| Accent | `--rind-brand-accent` | `accent` | any CSS colour |
| Neutral | `--rind-brand-neutral` | `neutral` | any CSS colour (only hue and chroma are used) |
| Danger | `--rind-brand-danger` | `danger` | any CSS colour |
| Warning | `--rind-brand-warning` | `warning` | any CSS colour |
| Success | `--rind-brand-success` | `success` | any CSS colour |
| Sans font | `--rind-brand-font-sans` | `fontSans` | font-family list |
| Mono font | `--rind-brand-font-mono` | `fontMono` | font-family list |
| Base font size | `--rind-brand-font-size` | `fontSize` | `rem` length |
| Radius | `--rind-brand-radius` | `radius` | length or `0` |
| Density | `--rind-brand-density` | `density` | 0.75 to 1.25 |
| Motion | `--rind-brand-motion` | `motion` | 0 to 1 (0 = no animation) |
| Border strength | `--rind-brand-border-strength` | `borderStrength` | 0 to 1 |

## Built and live scopes

- **Built**: `defineTheme(...).css` writes literal values for tiers 1 and 2 into `@layer rind.themes`. Validated for contrast, works in any engine, safe under a strict CSP. Use it for production brands.
- **Live**: any `[data-rind-theme]` element without a built stylesheet derives tier 2 in CSS from the `--rind-brand-*` it sets (CSS relative colour syntax). Good for previews such as a brand picker; contrast is **not** validated, so call `checkTheme` on the server. Engines without relative colour syntax keep the `calm` colours.

```html
<main data-rind-theme="acme">...</main>          <!-- built: acme.css is loaded -->
<section data-rind-theme style="--rind-brand-accent: #0a7d55">...</section>   <!-- live -->
```

## Re-skinning a built theme

A built theme fixes the tokens it is applied to. The default `calm` preset is built and loaded on `:root`, so `:root`'s derived tokens (`--rind-color-accent-solid` and the rest) are literal values: setting `--rind-brand-accent` on `:root` alone does **not** re-skin it. Re-skin in one of two ways:

- through a `[data-rind-theme]` scope, where the CSS derivation applies (live, contrast not validated);
- by building a theme with `defineTheme` (validated), and loading its CSS.

```css
:root { --rind-brand-accent: #0a7d55 }                        /* no effect on :root's tokens */
[data-rind-theme="acme"] { --rind-brand-accent: #0a7d55 }     /* re-skins the acme scope */
```

## Attributes and colour scheme

- `data-rind-theme="<name>"` selects a brand scope; scopes do not inherit from each other when built, and a live scope inherits the rest from its ancestor.
- `data-theme="light" | "dark"` forces a scheme on any element; without it the scheme follows `color-scheme`, so an app's own `.dark { color-scheme: dark }` works with no script.
- Colour pairs use `light-dark()`, driven by `color-scheme`. Put `<meta name="color-scheme" content="light dark">` in `<head>` so the first paint matches.
- `data-tone="accent|neutral|danger|warning|success"` re-points the accent roles (and the focus colour) for a subtree; `data-size="sm|md|lg"` sets the local control size.

### Server rendering

Render `data-rind-theme` and `data-theme` in the markup and inline the built CSS in `<head>`: the first paint is correct with JavaScript disabled, and no colour transitions run on scheme change.

```html
<html data-theme="dark"><head>
  <meta name="color-scheme" content="light dark">
  <style nonce="...">/* acme.css */</style>
</head><body><div data-rind-theme="acme">...</div></body></html>
```

## Portals

Portalled content (popovers, dialogs) lives in a host outside your scope. The portal host copies `data-rind-theme` and `data-theme` from the logical parent and keeps them in sync, so the tenant's stylesheet matches there too.

Limitation: tokens set **inline** on an element (`style="--rind-brand-accent: ..."`) do not reach portals. Put them in a rule keyed by the attribute, which also works under a strict CSP:

```css
[data-rind-theme="acme"] { --rind-brand-accent: #0a7d55; }
```

## Cascade layers

Theme CSS uses `@layer rind.tokens, rind.themes, rind.components, rind.preferences;`. Unlayered CSS always beats it, so your overrides never need specificity tricks. If you use layers yourself (Tailwind v4), declare the order once, first:

```css
@layer reset, rind, utilities;
@import "@rind-ui/theme";
```

`rind.preferences` (reduced motion, `prefers-contrast: more`) comes last, so no theme can undo a user's preference.

## Content Security Policy

Built CSS is plain text: put it in `<style nonce="...">` or a file. It contains no `@import`, `url()` or relative colour syntax. To change tokens at run time without inline styles, use the CSSOM (`sheet.insertRule`), which a strict CSP allows.

## Build tools that lower `light-dark()`

LightningCSS lowers `light-dark()` for targets without it into `var(--lightningcss-light, ...) var(--lightningcss-dark, ...)`, toggled on `:root` only. That freezes the tokens at the root scheme and breaks nested `data-theme="dark"` islands (tailwindcss#18849).

Mitigation (verified in `packages/theme/fixtures/vite-lightningcss`): target browsers with native `light-dark()` (Chrome 123, Safari 17.5, Firefox 120) in **both** `css.lightningcss.targets` **and** `build.cssTarget`. Vite's CSS minifier uses `build.cssTarget` and lowers with its older default even when `css.lightningcss.targets` is modern. Alternatively, exclude the rind theme CSS from lowering.

## Icons

Components draw their glyphs from tokens, not inline SVG: `--rind-icon-<name>` holds a `url("data:image/svg+xml,...")` and the stylesheet draws it with `mask-image` and `currentColor` (`CanvasText` in forced colors). Previous/next icons mirror under `[dir=rtl]`.

Names: `check`, `minus`, `x`, `caret-down`, `caret-up`, `caret-left`, `caret-right`, `magnifying-glass`, `eye`, `eye-slash`, `plus`, `calendar`, `clock`, `warning`, `info`, `check-circle`, `x-circle`, `dots-three`, `arrow-left`, `arrow-right`, `copy`.

Import `@rind-ui/theme/icons.css` for the defaults (included by `@rind-ui/theme`).

- **CSS swap**, global or per tenant:

```css
[data-rind-theme="acme"] { --rind-icon-check: url("/acme/check.svg"); }
```

- **React swap**, by component, typed by icon name (a typo is a compile error):

```tsx
<RindProvider icons={{ check: AcmeCheck, "caret-down": AcmeChevron }}>...</RindProvider>
```

A part renders the provider's component when it has no children; consumer children always win.

Attribution: the default glyphs are generated from Phosphor Icons (MIT); the licence text is in `packages/theme/NOTICE`.
