# Theme

`@rind-ui/theme` is an optional stylesheet for every rind component. It styles the same `data-*` attributes you would style yourself. A handful of brand inputs re-skin all of it, light and dark, and every text colour is checked for contrast. Start from it, then change as much or as little as you like.

The preview below is every component in the theme, with nothing of this site around it. Pick a preset, a scheme or an accent colour: one brand input re-skins them all.

## Install

```sh
pnpm add @rind-ui/theme
```

```ts
import "@rind-ui/theme"
```

That is the whole theme: tokens, the `calm` preset, fonts, icons and every component's stylesheet. To load only what you use, import the tokens and the components one by one:

```ts
import "@rind-ui/theme/tokens.css"
import "@rind-ui/theme/presets/calm.css"
import "@rind-ui/theme/base.css"
import "@rind-ui/theme/button.css"
import "@rind-ui/theme/dialog.css"
```

Put `<meta name="color-scheme" content="light dark">` in your `<head>`, so the first paint has the right scheme.

## Presets

Two presets ship: `calm` (the default: soft radius, comfortable density) and `crisp` (small radius, compact density, stronger borders). A preset applies to the element that names it and everything inside:

```html
<body data-rind-theme="crisp">...</body>
```

```ts
import "@rind-ui/theme/presets/crisp.css"
```

## Light and dark

The theme follows the page's `color-scheme`, so it is light or dark with the visitor's system and needs no script. `data-theme` forces a scheme on any element:

```html
<html data-theme="dark">...</html>
<aside data-theme="light">a light panel in a dark page</aside>
```

Your own rule works too: `.dark { color-scheme: dark }`.

## Variants, sizes and tones

Three attributes pick a look. You set them on the part; rind passes them through and never reads them, so the components stay headless.

| Attribute | Values | On |
|---|---|---|
| `data-variant` | `solid`, `soft`, `outline`, `ghost` (what fits the component) | buttons, toggles, fields, checkboxes, switches, badges, alerts, toasts, tabs, sliders… |
| `data-size` | `sm`, `md`, `lg` | controls and fields; on a dialog or a drawer, its width |
| `data-tone` | `accent`, `neutral`, `danger`, `warning`, `success` | anything: it re-points the accent colours (and the focus ring) of a whole subtree |

```tsx
<Button data-variant="soft" data-size="sm">Preview</Button>
<Button data-tone="danger">Delete</Button>
<Alert.Root data-tone="warning" data-variant="solid">...</Alert.Root>
```

## Theme on top of it

The theme has three tiers of CSS custom properties. Change the lowest one that does the job:

1. **Brand inputs** (`--rind-brand-*`): twelve values, such as the accent colour, the radius or the density. Everything else is derived from them.
2. **Semantic tokens** (`--rind-color-accent-solid`, `--rind-space-4`, `--rind-radius-control`…): what the components read.
3. **Component tokens** (`--rind-button-radius`, `--rind-dialog-width`…): one component at a time. The theme never declares them, it only reads them, so you set one only where you want it.

### Your brand: the brand inputs

Set the inputs on a `data-rind-theme` scope and every component inside follows, in light and dark:

```css
[data-rind-theme="acme"] {
  --rind-brand-accent: #0a7d55;
  --rind-brand-radius: 0.75rem;
  --rind-brand-density: 0.9;
  --rind-brand-font-sans: "Inter", system-ui, sans-serif;
}
```

```html
<body data-rind-theme="acme">...</body>
```

| Input | Custom property | Range |
|---|---|---|
| Accent | `--rind-brand-accent` | any CSS colour |
| Neutral | `--rind-brand-neutral` | any CSS colour (its hue and chroma tint the greys) |
| Danger, warning, success | `--rind-brand-danger`, `-warning`, `-success` | any CSS colour |
| Fonts | `--rind-brand-font-sans`, `--rind-brand-font-mono` | a font-family list |
| Base font size | `--rind-brand-font-size` | a `rem` length |
| Radius | `--rind-brand-radius` | a length, or `0` |
| Density | `--rind-brand-density` | 0.75 to 1.25 (controls never get smaller than 24px) |
| Motion | `--rind-brand-motion` | 0 to 1 (0: no animation) |
| Border strength | `--rind-brand-border-strength` | 0 to 1 |

Put them in a rule keyed by the attribute, not in an inline `style`: popovers, menus and dialogs are portalled out of your scope and copy its `data-rind-theme`, not its inline styles.

Setting `--rind-brand-accent` on `:root` alone does nothing: the default `calm` preset is a built theme there, with literal values. Use a `data-rind-theme` scope, or build your theme as below.

### A checked brand: the builder

CSS derives the colours, but it cannot check their contrast. The builder can: it builds the same theme in TypeScript, checks every text colour against WCAG AA in light and dark, and gives you plain CSS.

```ts
import { defineTheme } from "@rind-ui/theme/builder"

const acme = defineTheme({
  name: "acme",
  extends: "crisp",
  accent: "#0a7d55",
  radius: "0.75rem",
  contrast: "strict",
})

acme.css    // @layer rind.themes { :where([data-rind-theme="acme"]) { ... } }
acme.report // every pair it measured, and what it moved
```

- `contrast: "strict"` (the default) throws `ThemeContrastError` when a pair fails, with the nearest passing colour for each.
- `contrast: "adjust"` moves the failing colours to the nearest passing shade instead, and lists each move in `report.adjusted`. Use it for colours a customer picks.
- `checkTheme(input)` gives the report without building, for live feedback in a brand picker.

The output has literal colours only: put it in a `.css` file or a `<style nonce>`, safe under a strict Content Security Policy. Several brands can share one page, each on its own `data-rind-theme` scope.

### One component: component tokens

To change one component and leave the rest, set its tokens on any ancestor:

```css
[data-rind-theme="acme"] {
  --rind-button-radius: 999px;
  --rind-dialog-radius: 1.25rem;
}
```

Every token of every component is in the [token reference](/theme/tokens.md). With the builder, the same goes under `components`, where a misspelt token is a compile error.

### Anything else: your own CSS

The theme lives in cascade layers (`rind.tokens`, `rind.themes`, `rind.components`) and its selectors have zero specificity. So any CSS of yours that is not in a layer wins, with no `!important` and no specificity tricks. Select the same attributes the theme does:

```css
[data-scope="tabs"][data-part="trigger"][data-state="active"] {
  font-weight: 700;
  text-decoration: underline 2px;
}
```

If you use cascade layers yourself (Tailwind v4 does), declare the order once, before the import:

```css
@layer reset, rind, utilities;
@import "@rind-ui/theme";
```

The theme's last layer, `rind.preferences`, holds reduced motion and `prefers-contrast: more`, so no theme can undo a visitor's preference.

## Icons

Components draw their icons from tokens (`--rind-icon-check`, `--rind-icon-caret-down`…), in the text colour. Swap one in CSS, per brand if you like:

```css
[data-rind-theme="acme"] { --rind-icon-check: url("/acme/check.svg"); }
```

Or in React, typed by name:

```tsx
<RindProvider icons={{ check: AcmeCheck }}>...</RindProvider>
```
