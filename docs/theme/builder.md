# Theme builder

`@rind-ui/theme/builder` turns brand inputs into validated theme CSS. It is pure TypeScript with no DOM and no dependency, so it runs in a build script, a server request or a browser. The same input always gives the same bytes.

```ts
import { defineTheme, checkTheme, ThemeContrastError } from "@rind-ui/theme/builder"

const acme = defineTheme({
  name: "acme",
  extends: "crisp",
  accent: "#0a7d55",
  radius: "0.75rem",
  overrides: { accentText: { light: "#05603f", dark: "#5fd3a5" } },
  components: { /* keys come from the generated token manifest */ },
  contrast: "strict",
})
acme.css        // string: @layer rind.themes { :where([data-rind-theme="acme"]) { ... } }
acme.tokens     // { brand, colors: { [token]: { light, dark } }, scales }
acme.report     // ContrastReport
acme.toDTCG()   // Design Tokens Format Module 2025.10 JSON
```

## Input

| Key | Meaning |
|---|---|
| `name` | Required. Lowercase letters, digits and dashes, starting with a letter. Becomes the `data-rind-theme` value. |
| `extends` | `"calm"` (default), `"crisp"` or another `ThemeDefinition`. Unset inputs come from it. |
| `accent`, `neutral`, `danger`, `warning`, `success` | Any CSS colour: hex, rgb, hsl, oklch, oklab, named. |
| `fontSans`, `fontMono` | Font-family list of quoted names and identifiers (anything else is rejected). |
| `fontSize` | `rem` length, e.g. `"0.875rem"`. |
| `radius` | Length in px, rem or em, or `0`. |
| `density` | Number, 0.75 to 1.25. Controls never drop below 24 px. |
| `motion` | Number, 0 to 1. |
| `borderStrength` | Number, 0 to 1. |
| `overrides` | Semantic colour tokens by camelCase name (`accentText`, `textMuted`, `bg`), a colour or `{ light, dark }`. Overrides are checked like derived values and never adjusted. |
| `components` | Tier 3 values by component scope and token name; applied as given and listed under `report.unchecked`. Typos fail to compile. |
| `root` | Also target `:root` (the page default). |
| `contrast` | `"strict"` (default) or `"adjust"`. |

## Contrast modes

Every foreground/background pair of the semantic tokens is measured (WCAG 2): text and muted text on the three surfaces, each palette's text and on-solid colours on their grounds. Disabled text, borders and overlays are exempt.

- **strict**: throws `ThemeContrastError` if any pair fails. `error.report` carries the pairs; failing ones have a `suggestion`, the nearest passing colour.
- **adjust**: moves failing tokens to the nearest passing shade (never the brand `accent-solid`) and lists each move in `report.adjusted`.

## Errors

- `ThemeInputError` (`key`, `reason`): unknown key, value out of range, unparsable colour, unsafe font string or component value.
- `ThemeContrastError` (`report`): strict mode with a failing pair.

## Report

```ts
type ContrastReport = {
  ok: boolean
  pairs: { scheme: "light" | "dark"; foreground; background; ratio: number
           required: 3 | 4.5; pass: boolean; suggestion?: string }[]
  adjusted: { scheme; token; from: string; to: string }[]
  unchecked: string[]
}
```

`checkTheme(input)` returns the report without building and never throws for contrast: use it for live feedback in a brand picker.

## Output

`css` has literal in-gamut `oklch()` values only: no relative colour syntax, `@import` or `url()`, so it is safe under a strict CSP. `toDTCG()` gives `brand`, `light` and `dark` groups; unadjusted `-solid` tokens alias the brand colour.

## Multi-tenant server

```ts
import { defineTheme, ThemeContrastError, ThemeInputError } from "@rind-ui/theme/builder"

const cache = new Map<string, string>()

export function tenantCss(tenant: { slug: string; accent: string; radius: string }): string {
  const hit = cache.get(`${tenant.slug}:${tenant.accent}:${tenant.radius}`)
  if (hit) return hit
  try {
    const { css } = defineTheme({ name: tenant.slug, accent: tenant.accent, radius: tenant.radius, contrast: "adjust" })
    cache.set(`${tenant.slug}:${tenant.accent}:${tenant.radius}`, css)
    return css
  } catch (e) {
    if (e instanceof ThemeInputError || e instanceof ThemeContrastError) return "" // fall back to calm
    throw e
  }
}
// <style nonce={nonce}>{tenantCss(tenant)}</style> ... <div data-rind-theme={tenant.slug}>
```

Use `contrast: "adjust"` for tenant-supplied colours, so a garish brand still ships accessible text; show `report.adjusted` to the tenant admin.
