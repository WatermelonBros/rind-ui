## Purpose

Defines the three tiers of `@rind-ui/theme` custom properties — brand inputs, semantic
tokens and component tokens — their names, how each tier derives from the one below,
and how user preferences act on them, so a brand can re-skin every component from a
dozen values.

## ADDED Requirements

### Requirement: Three Tiers With Fixed Prefixes

The theme SHALL expose exactly three tiers of custom properties:

1. **Brand inputs** named `--rind-brand-<input>`;
2. **Semantic tokens** named `--rind-<category>-<role>` with `<category>` one of
   `color`, `space`, `size`, `radius`, `text`, `font`, `leading`, `shadow`,
   `duration`, `ease`, `focus`, `border`;
3. **Component tokens** named `--rind-<scope>-<name>`, where `<scope>` is the
   component's `data-scope` value.

Semantic tokens SHALL read only brand inputs or other semantic tokens; component
stylesheets SHALL read only component tokens, each with a semantic token as its
`var()` fallback; component stylesheets SHALL NOT read brand inputs or literal colour
values. The full token list SHALL be published as a generated manifest, and no
component token name SHALL equal a semantic token name.

#### Scenario: Name collision is rejected

- **WHEN** a component stylesheet declares a component token whose name is also a
  semantic token name (e.g. a scope called `text` declaring `--rind-text-sm`)
- **THEN** the token manifest check fails and names both tokens

#### Scenario: Stylesheet reads a brand input

- **WHEN** a component stylesheet uses `var(--rind-brand-accent)` or a literal colour
- **THEN** the theme lint check fails

### Requirement: Brand Inputs

The brand inputs SHALL be exactly these twelve, each with a default from the `calm`
preset:

| Input | Type | Meaning |
|---|---|---|
| `--rind-brand-accent` | colour | primary brand colour, used as the solid accent |
| `--rind-brand-neutral` | colour | hue and chroma source for greys; its lightness is ignored for surfaces, text and borders, while the neutral PALETTE roles (`neutral-solid`, `-solid-hover`, `-on-solid`, `-soft`, `-text`, `-border`) follow the input like every other palette |
| `--rind-brand-danger` | colour | destructive / error colour |
| `--rind-brand-warning` | colour | warning colour |
| `--rind-brand-success` | colour | success colour |
| `--rind-brand-font-sans` | font-family list | UI text |
| `--rind-brand-font-mono` | font-family list | code |
| `--rind-brand-font-size` | `rem` length | base UI text size |
| `--rind-brand-radius` | length | base corner radius |
| `--rind-brand-density` | number 0.75–1.25 | spacing and control-size factor |
| `--rind-brand-motion` | number 0–1 | duration factor |
| `--rind-brand-border-strength` | number 0–1 | border contrast factor |

Colour inputs SHALL accept any CSS `<color>`. Overriding a brand input on a theme
scope SHALL change every semantic and component token derived from it inside that
scope, with no other change.

#### Scenario: One input re-skins everything

- **WHEN** a scope sets only `--rind-brand-accent: #0a7d55`
- **THEN** solid, soft, outline and ghost variants, focus ring, selected and checked
  indicators inside that scope all change hue, and nothing outside the scope changes

#### Scenario: Neutral lightness is ignored

- **WHEN** `--rind-brand-neutral` is set to a dark colour and to a light colour of
  the same hue and chroma
- **THEN** the derived neutral surfaces, text and borders are identical in both cases,
  while the neutral palette roles (e.g. `--rind-color-neutral-solid`) follow the input

### Requirement: Colour Palettes And Role Tokens

The theme SHALL derive five palettes — `accent`, `neutral`, `danger`, `warning`,
`success` — from the matching brand inputs, each exposing the same seven role
tokens `--rind-color-<palette>-<role>`:

| Role | Use |
|---|---|
| `solid` | solid fill (the brand colour itself for `accent`) |
| `solid-hover` | solid fill while hovered or pressed; it moves AWAY from `on-solid` (darker when the solid's L < 0.6, i.e. white text; lighter from L 0.6 up), so hover never lowers the text contrast |
| `on-solid` | text and icons on `solid` and `solid-hover` |
| `soft` | tinted, opaque background |
| `soft-hover` | tinted background while hovered or pressed |
| `text` | the palette colour used as text or icon on `bg`, `surface`, `surface-raised`, `soft` and `soft-hover` |
| `border` | outline border and the edge of checked / selected indicators |

and the neutral surface tokens `--rind-color-bg`, `-surface`, `-surface-raised`,
`-overlay`, `-text`, `-text-muted`, `-text-disabled`, `-border`, `-border-strong`,
plus `--rind-focus-color`, `--rind-focus-width` and `--rind-focus-offset`. Every
colour token that is painted under text SHALL be opaque; no text/background pair
SHALL depend on alpha compositing.

#### Scenario: Soft background is opaque (shadcn-ui#10431)

- **WHEN** the computed value of `--rind-color-danger-soft` is read
- **THEN** its alpha is 1, so the contrast of `--rind-color-danger-text` on it is
  the contrast actually painted

#### Scenario: Yellow brand keeps its colour

- **WHEN** `--rind-brand-accent` is a light yellow (`oklch(0.86 0.17 95)`)
- **THEN** `--rind-color-accent-solid` is that yellow, `--rind-color-accent-on-solid`
  is near-black, and `--rind-color-accent-text` is a darker yellow-brown

### Requirement: Derivation In CSS

Semantic colour tokens SHALL be derived in CSS from the brand inputs with OKLCH
relative colour syntax wrapped in `light-dark()` (light value first), declared on
every theme scope (`:root` and each `[data-rind-theme]` element) so a scope's inputs
are re-derived inside it. The derivation rules SHALL be inside
`@supports (color: oklch(from red l c h))`; a browser without relative colour syntax
SHALL keep the inherited precomputed values of the nearest built theme instead of
receiving invalid colours. Colour tokens SHALL NOT be registered with `@property`.

#### Scenario: Input changed at runtime

- **WHEN** script changes `--rind-brand-accent` in a scope's stylesheet rule while a
  button is rendered
- **THEN** the button repaints with the new colours without a reload or any rind-ui
  script

#### Scenario: Browser without relative colour syntax

- **WHEN** the theme is loaded in a browser that supports `light-dark()` but not
  relative colour syntax, and a scope sets only brand inputs
- **THEN** components in that scope render with the `calm` precomputed colours, and
  no colour property computes to its initial value

#### Scenario: Override on a nested element is not frozen

- **WHEN** `--rind-brand-accent` is overridden on a `[data-rind-theme]` element inside
  `:root`
- **THEN** `--rind-color-accent-text` computed inside that element reflects the new
  accent, not the value computed at `:root`

### Requirement: Scales From Inputs

Spacing tokens `--rind-space-1…8` SHALL be multiples of `0.25rem ×
--rind-brand-density`; control heights `--rind-size-sm|md|lg` SHALL be
`1.75rem|2.25rem|2.75rem × density` and SHALL NOT compute below 24 CSS px; text tokens
`--rind-text-xs|sm|md|lg` SHALL be multiples of `--rind-brand-font-size` in `rem`;
radius tokens SHALL be `--rind-radius-sm|md|lg` (0.5×, 1×, 1.5× the base),
`--rind-radius-full`, and per family `--rind-radius-control` (md),
`--rind-radius-panel` (lg) and `--rind-radius-indicator` (sm); durations
`--rind-duration-fast|normal|slow` SHALL be `120ms|200ms|320ms × --rind-brand-motion`.

#### Scenario: Compact density keeps target size

- **WHEN** `--rind-brand-density` is `0.75` and a small control is rendered
- **THEN** its height is at least 24 CSS px

#### Scenario: Browser text size is respected (radix-ui/themes#121)

- **WHEN** the browser's default font size is set to 20 px
- **THEN** every `--rind-text-*` token scales by 1.25 relative to the 16 px default

#### Scenario: Radius zero

- **WHEN** `--rind-brand-radius` is `0`
- **THEN** every radius token except `--rind-radius-full` computes to `0`

### Requirement: Cascade Layer

All theme CSS SHALL live in the cascade layer `rind`, with sublayers declared in the
order `rind.tokens`, `rind.themes`, `rind.components`, `rind.preferences`. Selectors
for tokens SHALL use `:where()` so that, within a layer, they carry zero specificity.
Consumer styles outside any layer SHALL override the theme regardless of selector
specificity.

#### Scenario: Utility class wins (radix-ui/themes#109)

- **WHEN** a consumer applies an unlayered class `.brand-btn { background: hotpink }`
  to a themed solid button whose selector is
  `[data-scope="button"][data-part="root"][data-variant="solid"]`
- **THEN** the button is hotpink, in development and production builds alike

#### Scenario: Consumer layer order

- **WHEN** the consumer declares `@layer reset, rind, utilities;` before importing
  the theme
- **THEN** the consumer's `utilities` layer overrides the theme and the theme
  overrides `reset`

### Requirement: User Preferences Win

Under `prefers-reduced-motion: reduce` every `--rind-duration-*` token SHALL be `0s`
in every theme scope, including built themes and consumer theme files that set
`--rind-brand-motion` or duration tokens. Under `prefers-contrast: more`
`--rind-brand-border-strength` SHALL act as `1` and `--rind-color-text-muted` SHALL
equal `--rind-color-text` in every scope. These rules SHALL be in `rind.preferences`.

#### Scenario: Tenant theme cannot re-enable motion

- **WHEN** a built tenant theme sets `--rind-brand-motion: 1` and the page is viewed
  with reduced motion emulated
- **THEN** `--rind-duration-normal` computes to `0s` inside that tenant scope

#### Scenario: More contrast

- **WHEN** a `calm` page is viewed with `prefers-contrast: more` emulated
- **THEN** muted text renders in the full text colour and `--rind-color-border`
  equals `--rind-color-border-strong`
