## Context

See proposal.md (Why) and [docs/research/theme-system.md](../../../docs/research/theme-system.md)
(how Radix Themes, shadcn/ui, Chakra, Park UI, Material 3, Leonardo, Open Props and
Tailwind v4 do it, platform support, bug history). Today `packages/theme` has a flat
`tokens.css`, a `base.css` keyed on `.rind-root`, and no component stylesheet yet.
`add-a11y-foundations` adds focus (`--rind-focus-width`, `--rind-focus-color`), the
`--rind-hit-area` pseudo-element, zero-duration under reduced motion and forced-colors
mapping (`theme-accessibility`); this change adopts those names and does not restate
them. `add-overlay-infrastructure` renders portals into `body` (or a modal dialog,
fullscreen element, shadow root) and already copies `dir`/`lang` onto the host.

There is no machine in this change: it is CSS plus a pure TS module.

## Goals / Non-Goals

**Goals:** a token contract component changes can write against now; validated
white-label themes; multi-tenant scopes that survive portals; themed Storybook from the
first component.

**Non-Goals:** see proposal. In addition: no runtime theme switching API (attributes
are the API), no CSS-in-JS, no per-component variant beyond the matrix.

## Decisions

### D1. Token tiers and names

```
tier 1  --rind-brand-{accent,neutral,danger,warning,success,font-sans,font-mono,
                     font-size,radius,density,motion,border-strength}
tier 2  --rind-color-{bg,surface,surface-raised,overlay,text,text-muted,text-disabled,
                      border,border-strong}
        --rind-color-{accent,neutral,danger,warning,success}-{solid,solid-hover,on-solid,
                      soft,soft-hover,text,border}
        --rind-focus-{color,width,offset}  --rind-hit-area
        --rind-space-{1,2,3,4,6,8}  --rind-size-{sm,md,lg}  --rind-text-{xs,sm,md,lg}
        --rind-font-{sans,mono}  --rind-leading-{tight,normal}
        --rind-radius-{sm,md,lg,full,control,panel,indicator}
        --rind-shadow-{sm,lg}  --rind-duration-{fast,normal,slow}  --rind-ease-{out,in-out}
        --rind-border-width
        local (set by data-size): --rind-size-control --rind-text-control --rind-space-control
tier 3  --rind-<scope>-<name>   e.g. --rind-button-solid-bg, --rind-dialog-radius
```

Tier 3 is **never declared** by the theme; stylesheets read
`var(--rind-button-radius, var(--rind-radius-control))`. Declaring defaults on the
component element would shadow an override set on an ancestor or theme scope.
Alternatives: shadcn's flat pair list (drifts in meaning, #11763); Radix's 12-step scales
(30 palettes × 12 × 2, 700 KB, hand-tuned). Seven roles per palette are what the variant
matrix needs and nothing more.

`--rind-brand-*` rather than bare `--rind-accent`: the tier is visible in the name, and
lint can forbid component CSS from reading it.

### D2. Derivation in CSS (the live path)

`tokens.css`, in `@layer rind.tokens`, inside `@supports (color: oklch(from red l c h))`:

```css
:where(:root, [data-rind-theme]) {
  --rind-color-bg: light-dark(
    oklch(from var(--rind-brand-neutral) 0.995 min(c, 0.03) h),
    oklch(from var(--rind-brand-neutral) 0.16 min(c, 0.03) h));
  --rind-color-accent-solid: var(--rind-brand-accent);
  --rind-color-accent-on-solid: oklch(from var(--rind-brand-accent)
    clamp(0.18, (0.6 - l) * 1000, 1) 0 h);   /* white below L 0.6, near-black above */
  --rind-color-accent-text: light-dark(
    oklch(from var(--rind-brand-accent) min(l, 0.5) min(c, 0.2) h),
    oklch(from var(--rind-brand-accent) max(l, 0.78) min(c, 0.2) h));
  /* … same seven roles for every palette; spacing, sizes, radius, text, durations */
}
```

Lightness constants are listed in the research note (Decisions §4) and were checked
for the neutral hue and six sample brands. `light-dark()` wraps two relative colours
(never the other way round), so no engine has to accept `light-dark()` as an origin.
Declared on every scope, because a custom property's `var()` references resolve where
it is declared: a token derived only on `:root` would freeze the root's accent for
every nested scope (Radix #731, Chakra #9454).

Neutral hue is `none` when the neutral input's chroma is below 0.005 (tailwind#19830).

### D3. The builder precomputes what CSS cannot guarantee

CSS relative colour syntax cannot compare two colours, and gamut clipping moves
luminance, so the live path is approximate. The builder (`src/builder/`) implements in
TS: CSS colour parsing (hex, rgb, hsl, oklch, oklab, named), OKLCH↔sRGB, gamut mapping
by chroma reduction (CSS Color 4 algorithm, ΔEOK 0.02), WCAG 2 luminance and ratio, and
a lightness bisection for the nearest passing shade. It runs the same formulas as D2,
then checks the pairs in `theme-builder`. Output is literal in-gamut `oklch()` values
rounded to 4 decimals, so the browser never gamut-maps and the measured ratio is the
painted ratio.

```ts
import { defineTheme, checkTheme, ThemeContrastError } from "@rind-ui/theme/builder"

const acme = defineTheme({
  name: "acme",                       // const type param → template-literal checked
  extends: "crisp",
  accent: "#0a7d55",
  radius: "0.75rem",
  overrides: { accentText: { light: "#05603f", dark: "#5fd3a5" } },
  components: { button: { radius: "9999px" } },   // keys from the generated manifest
  contrast: "strict",                  // | "adjust"
})
acme.css        // string, @layer rind.themes, :where([data-rind-theme="acme"])
acme.tokens     // ThemeTokens (typed literal values, light/dark pairs)
acme.report     // ContrastReport { ok, pairs: ContrastPair[], adjusted: Adjustment[] }
acme.toDTCG()   // DTCG 2025.10 JSON

type ContrastPair = {
  scheme: "light" | "dark"
  foreground: SemanticColorToken; background: SemanticColorToken
  ratio: number; required: 3 | 4.5; pass: boolean; suggestion?: OklchString
}
```

Types: `ThemeInput<Name extends string>` with `name: Lowercase<Name>` checked by a
template-literal type; numeric inputs are `number` with runtime range checks (a ranged
numeric type would not make consumer code simpler); component override keys are
generated from the component token manifest as a mapped type, so a typo fails to
compile. Errors: `ThemeInputError` (key, reason) and `ThemeContrastError` (report).
Font family values are validated against a conservative grammar (quoted names,
identifiers, commas) so the CSS string cannot be broken out of.

Alternatives: run-time JS theming (CSS-in-JS: CSP and SSR flash); `contrast-color()`
(Baseline only April 2026, black/white only, UA algorithm); validate only in CSS (cannot).

### D4. Two kinds of scope

- **Built**: presets and `defineTheme` output declare literal tier-1 and tier-2 values
  in `rind.themes` — beats `rind.tokens` by layer order, validated, works without
  relative colour syntax.
- **Live**: any `[data-rind-theme]` without a built stylesheet (or a rule setting only
  `--rind-brand-*`) is derived by D2. Used for live previews (brand pickers) and tenants
  without a build step; documented as unvalidated — call `checkTheme` server-side.

`:root` gets `calm` built values, so old engines see a correct theme.

### D5. Scopes, light/dark and cascade layers

`base.css` replaces `.rind-root` with `:where([data-rind-theme])` (font, text colour,
background; no background on `[data-rind-portal]`). `color-scheme` drives light/dark
(`:root { color-scheme: light dark }`, `[data-theme=light|dark]`), so an app's own
class works and no script is needed. Layer statement shipped first in `index.css` and
`tokens.css`: `@layer rind.tokens, rind.themes, rind.components, rind.preferences;`.
`rind.preferences` holds reduced motion (`--rind-duration-*: 0s`) and
`prefers-contrast: more` (`--rind-color-text-muted: var(--rind-color-text)`,
`--rind-color-border: var(--rind-color-border-strong)`) on
`:where(:root, [data-rind-theme])`, so no theme can undo them. Docs give the
recipe `@layer reset, rind, utilities;` for Tailwind and others.

Alternative: high-specificity selectors (Radix #109 specificity war); unlayered tokens
(consumer overrides become order-dependent).

### D6. Portals: copy theme attributes onto the host

The portal host (from `add-overlay-infrastructure`) copies `data-rind-theme` and
`data-theme` from `closest("[data-rind-theme]")` / `closest("[data-theme]")` of the
logical parent, alongside `dir`/`lang`, and keeps them in sync with one
`MutationObserver` (attribute filter on those four) on the two ancestors while mounted.
The tenant's stylesheet then matches the host and tokens cascade into the content.

Rejected: (a) tokens only on `:root` + scoped overrides — portal content in `body`
would always get the root brand, breaking multi-tenant pages and Storybook previews;
(b) framework context re-wrapping (Radix #708, #589, islands); (c) copying computed
custom properties inline — hundreds of values, stale on change, and inline styles
cannot use `light-dark()` per scheme switch cheaply. Limitation, documented: tokens set
*inline* on an element (`style="--rind-brand-accent: …"`) do not reach portals; set
them in a rule keyed by `data-rind-theme` (CSSOM `insertRule` is CSP-safe).

Shadow-root and modal-dialog targets inherit naturally (custom properties cross shadow
boundaries; the theme stylesheet must be adopted in the shadow root — documented).

### D7. Variants, size, tone

Matrix in `theme-variants`. Structural components (Label, Field, Fieldset, Form; from
add-label), and Heading (from add-heading), belong to no family: they ignore `data-variant` and read only typography and
spacing tokens, so `data-size` scales their text and spacing. Skeleton and Image join Separator in the `decoration` family (from add-skeleton, add-image): no variant, no size, look via `--rind-skeleton-*` / `--rind-image-*` tokens. Avatar and Avatar Group form the `identity` family (from add-avatar):
solid / **soft** / outline, sm / **md** / lg. Link, Breadcrumbs link and Navigation Menu content link form the `link`
family (from add-link): no variant, no size, font size inherited. Navigation Menu
triggers and bar links join `toggle item`, its viewport and content join `panel` (from
add-navigation-menu). Implementation: `variants.css` (in `rind.components`)
defines only the shared mechanics:

```css
:where([data-tone="danger"]) {
  --rind-color-accent-solid: var(--rind-color-danger-solid); /* … all seven roles */
  --rind-focus-color: var(--rind-color-danger-border); /* re-declared: var() resolves here */
}
:where([data-size="sm"]) { --rind-size-control: var(--rind-size-sm);
  --rind-text-control: var(--rind-text-xs); --rind-space-control: var(--rind-space-2) }
```

Component stylesheets map variants to their tier-3 tokens:

```css
@layer rind.components {
  :where([data-scope="button"][data-part="root"]) {
    min-block-size: var(--rind-button-height, var(--rind-size-control, var(--rind-size-md)));
    border: var(--rind-border-width) solid transparent;   /* visible in forced colors */
    border-radius: var(--rind-button-radius, var(--rind-radius-control));
  }
  :where([data-scope="button"][data-part="root"]:not([data-variant]),
         [data-scope="button"][data-part="root"][data-variant="solid"]) {
    background: var(--rind-button-solid-bg, var(--rind-color-accent-solid));
    color: var(--rind-button-solid-text, var(--rind-color-accent-on-solid));
  }
}
```

Tone re-points the *accent* roles, so a component reads only accent roles and gets
every tone for free; tone on an element changes its focus colour too (focus = accent
border). `data-tone` is an addition to 0007's two attributes: without it a destructive
button or a success toast needs per-component overrides; it is the same pass-through
rule and costs one small rule per palette.

Tabs `ghost` = underline indicator, `soft` = pill — mapped onto the existing variant
names instead of adding `line`/`pill`.

### D8. Presets

Values in `theme-presets`. `src/presets/*.ts` hold the inputs; a build script runs the
builder and writes `src/presets/calm.css` and `crisp.css`; a test diffs them. `calm`
also targets `:root` (`root: true`).

### D9. What component stories need first (rule from the user)

In every component change the theme stylesheet task comes **before** the stories, and
stories render the **themed** component. This change therefore delivers, in its first
task groups and before the builder: tier-1/2 tokens and the layer statement; the
`calm` preset on `:root` (precomputed literals — hand-checked numbers until the builder
lands, then regenerated by it); `variants.css`; the per-component stylesheet convention
and manifest/lint; and the Storybook preview loading `@rind-ui/theme` with `calm`
default plus brand, scheme and tone globals applied to the story root. The builder,
`crisp`, sample brands and the contrast report follow without blocking component work.

### D10. Storybook

Toolbar globals `brand` (calm, crisp, `sample-yellow`, `sample-white` — sample brands
built in adjust mode at Storybook build), `theme` (system/light/dark, existing) and
`tone`. The decorator sets `data-rind-theme`, `data-theme`, `data-tone` on the story
root (replacing `className="rind-root"`). A `Theme/Contrast report` docs page renders
`report.pairs` per brand. Vitest story runs are parameterised over calm/crisp × light/dark
for axe colour-contrast; forced-colors and reduced-motion captures reuse the
`add-a11y-foundations` globals.

### D11. Icons (decision 0010)

`scripts/build-icons` reads `@phosphor-icons/core` (devDependency; weight is an option) and
writes `icons.css`: `--rind-icon-<name>: url("data:image/svg+xml,…")` in `@layer rind`. The
names are consolidated to one per meaning (`check`, `minus`, `x`, `caret-*`, `magnifying-glass`, `eye`, `eye-slash`, `plus`, `calendar`, `clock`, `warning`, `info`,
`check-circle`, `x-circle`, `dots-three`, `arrow-left`, `arrow-right`, `copy`); components pick
by meaning, not by look. Stylesheets draw them with `mask-image` + `background-color:
currentColor` (`CanvasText` under forced colors) and mirror only previous/next icons under
`[dir=rtl]`. Swapping is a token override (global or per tenant) or React `RindProvider
icons`. `--rind-icon-*` is a token category of its own beside the tier-2 categories; the
theme lint accepts it. Spec: `theme-icons`.

### Requests to other changes

- **add-overlay-infrastructure** — APPLIED there (task A.1). (`portal` → Portal Host Attributes): also copy
  `data-rind-theme` and `data-theme` from the nearest ancestors of the logical parent
  and keep all four copied attributes in sync while mounted. Scenarios: "Portal content
  keeps the tenant theme", "Scheme switch while a toast is open" (theme-scoping).
- **add-a11y-foundations** (task 11.1/11.2): write `--rind-focus-*`, `--rind-hit-area`
  and duration zeroing as tier-2 tokens on `:where(:root, [data-rind-theme])` in
  `@layer rind.preferences` (not only `:root`, or tenant scopes undo them);
  `--rind-focus-color` defaults to `var(--rind-color-accent-border)`; drop
  `--rind-focus-ring` (box-shadow) and `.rind-root`; key `base.css` rules on
  `[data-rind-theme]`. RESOLVED: add-a11y-foundations is implemented first, unchanged;
  this change adapts its output (task added here).
- **add-foundations** (archived) — APPLIED as a delta in this change:
  `specs/react-adapter/spec.md` → "Reserved Theme Attributes".
- **Every component change** (button, dialog, tabs, radio-group, segmented-control,
  toggle-group, combobox, …): theme task before stories; stylesheet in
  `@layer rind.components`, `:where()` selectors, `--rind-<scope>-*` tokens read with
  fallback (never declared), family from the matrix, indicator edge in the `border`
  role, a `data-tone="danger"` state capture. `add-dialog` 7.1's nested backdrop uses
  `--rind-color-overlay`; `add-button` design §5 adds the variant/size/tone rules.
- **Calendar family rows** (from add-calendar, add-range-calendar, add-date-field, add-time-field) — APPLIED: Calendar / Range Calendar root in `panel`, day cells in `collection item`, Date Field and Time Field in `field` (task A.14).
- **Date picker family rows** (from add-date-picker, add-date-range-picker, add-date-range-field, add-time-range-field, add-month-year-picker) — APPLIED: Date Picker / Date Range Picker popover content in `panel`, their fields in `field`; Date Range Field and Time Range Field in `field`; Month / Year Picker root in `panel`, cells in `collection item` (task A.15).
- **add-combobox**: its spec already passes `data-variant`/`data-size` through; its
  Control is family `field` (outline/soft), Chip family `status`.

## Risks / Trade-offs

- [Live derivation can miss AA for some saturated hues] → presets and all built
  themes are validated; live scopes are documented as previews; `checkTheme` for server
  validation.
- [L-threshold `on-solid` picks the worse of black/white near L 0.56–0.62] → built
  themes use true luminance; live only.
- [Portal attribute sync costs a MutationObserver per open portal] → two ancestors,
  four attributes, only while mounted.
- [Build tools lowering `light-dark()` (tailwind#18849)] → docs; a Vite + LightningCSS
  fixture test of the published CSS.
- [`data-tone` extends 0007] → same pass-through rule, flagged in the summary; dropping
  it later is removal of one stylesheet.
- [Hand-picked preset constants could drift from builder output before the builder
  lands] → D9 order: the builder regenerates them and the diff test then owns them.

## Migration Plan

No consumer stylesheet exists yet. Replace `tokens.css`/`base.css`, update the
Storybook decorator, add a changeset for `@rind-ui/theme` (minor, breaking token
names listed). Rollback = revert the package; no other package depends on token names
until component stylesheets land.
