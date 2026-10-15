## Purpose

Defines the typed theme builder exported from `@rind-ui/theme/builder`: it turns brand
inputs into validated, precomputed theme CSS, checks WCAG 2.2 AA contrast in light and
dark, and proposes the nearest passing shade when a brand colour cannot meet it.

## ADDED Requirements

### Requirement: Typed Input

`defineTheme(input)` SHALL accept `name` (a string matching `^[a-z][a-z0-9-]*$`,
checked at compile time for literals and at runtime), optional `extends` (a preset
name or another theme definition) and any subset of the twelve brand inputs under
their camel-case names (`accent`, `neutral`, `danger`, `warning`, `success`,
`fontSans`, `fontMono`, `fontSize`, `radius`, `density`, `motion`,
`borderStrength`), optional `overrides` of semantic tokens by camel-case role name (`accentText`,
`textMuted`, …), and optional `components` overrides keyed by component scope and token
name. Inputs not given SHALL come from `extends`, defaulting to `calm`. Unknown
keys, out-of-range numbers and unparsable colours SHALL be compile errors where the
value is a literal and SHALL throw `ThemeInputError` naming the key otherwise.

#### Scenario: Typo in an input

- **WHEN** a consumer writes `defineTheme({ name: "acme", acent: "#f60" })`
- **THEN** TypeScript reports `acent` as an unknown property

#### Scenario: Density out of range from a database

- **WHEN** `defineTheme` receives `density: 3` from untyped runtime data
- **THEN** it throws `ThemeInputError` naming `density` and the allowed range 0.75–1.25

#### Scenario: Component override for an unknown token

- **WHEN** `components: { button: { solidBgg: "red" } }` is passed as a literal
- **THEN** TypeScript reports `solidBgg` as unknown for `button`

### Requirement: Contrast Validation

The builder SHALL compute every semantic colour as an sRGB-gamut colour (gamut
mapping by OKLCH chroma reduction at constant lightness and hue) and SHALL check, in
both light and dark schemes, with the WCAG 2 contrast ratio:

- 4.5:1 — `text` and `text-muted` on `bg`, `surface`, `surface-raised`; every
  palette's `on-solid` on `solid` and `solid-hover`; every palette's `text` on `bg`,
  `surface`, `surface-raised`, its `soft` and `soft-hover`;
- 3:1 — `border-strong` and every palette's `border` on `bg` and `surface`;
  `focus-color` on `bg`, `surface` and `surface-raised`.

`text-disabled`, `border` and `overlay` SHALL be exempt. Semantic `overrides` SHALL be
checked like derived values; `components` overrides SHALL be listed in the report as
unchecked. Every failing pair SHALL be
reported with its scheme, both token names, the measured ratio and the required ratio.

#### Scenario: Custom accent below 4.5:1 is rejected with a suggestion

- **WHEN** `defineTheme({ name: "acme", accent: "#0ea5e9", overrides: { accentText:
  "#0ea5e9" } })` is called with the default `contrast: "strict"`
- **THEN** it throws `ThemeContrastError` listing `light: accent-text on bg` at about
  2.8:1 against the required 4.5:1, with a `suggestion` of the same hue that passes

#### Scenario: Unreachable on-solid

- **WHEN** an accent's `solid` cannot reach 4.5:1 with either white or black text in
  the dark scheme
- **THEN** the error lists `dark: accent-on-solid on accent-solid` with a suggested
  `solid` lightness that does

#### Scenario: Status palettes are checked too (chakra-ui#11006)

- **WHEN** a theme uses `warning: "#facc15"`
- **THEN** `warning-text` on `bg` meets 4.5:1 in the returned theme or is reported

### Requirement: Nearest Passing Shade

For a failing pair the builder SHALL propose the colour with the same hue whose OKLCH
lightness is closest to the failing colour's and which meets the required ratio,
reducing chroma only as needed to stay in sRGB gamut. The proposal SHALL be
deterministic for the same input.

#### Scenario: Suggestion passes and stays close

- **WHEN** a failing `accent-text` has OKLCH lightness 0.62 and the passing bound is
  0.53
- **THEN** the suggestion has lightness between 0.52 and 0.53, the same hue to within
  1 degree, and meets 4.5:1

### Requirement: Strict And Adjust Modes

With `contrast: "strict"` (default) any failing pair SHALL throw `ThemeContrastError`
carrying the full report. With `contrast: "adjust"` the builder SHALL apply every
suggestion, return the theme and include the applied changes in `theme.report`. It
SHALL NOT silently change any brand input value: the `accent` solid stays the given
colour unless `on-solid` cannot pass with either white or black.

#### Scenario: Multi-tenant server with a garish brand

- **WHEN** a server builds a tenant theme from stored input with `contrast: "adjust"`
- **THEN** it receives CSS that passes every pair and a report listing each adjusted
  token with its original and new value

### Requirement: Report Without Building

`checkTheme(input)` SHALL return the same report as `defineTheme` without throwing for
contrast failures, so editors can show live feedback.

#### Scenario: Brand colour picker

- **WHEN** an admin UI calls `checkTheme` on every colour change
- **THEN** it gets `{ ok, pairs[] }` with each pair's ratio, requirement and
  suggestion, and no exception for failing pairs

### Requirement: Output

A built theme SHALL expose `css`: plain CSS, inside `@layer rind.themes`, scoped to
`:where([data-rind-theme="<name>"])` (and also `:root` when `root: true` is passed),
declaring every brand input and every semantic token as literal values with colours
in `light-dark(<light>, <dark>)`, and any component overrides. The output SHALL
contain no `@import`, `url()`, `expression`, script or relative colour syntax, SHALL
be byte-identical for identical input, and SHALL be usable as a static file or in a
`<style nonce>` element. A built theme SHALL expose `tokens` (a typed object of the
same values) and `toDTCG()` returning a Design Tokens Format Module 2025.10 JSON
document with tier-2 tokens aliasing tier-1 where they are not adjusted.

#### Scenario: Strict CSP

- **WHEN** a page with `Content-Security-Policy: style-src 'nonce-abc'` inserts the
  builder's `css` into `<style nonce="abc">`
- **THEN** the theme applies and the browser reports no CSP violation

#### Scenario: Deterministic output

- **WHEN** `defineTheme` is called twice with the same input
- **THEN** both `css` strings are identical

#### Scenario: Injection through a font name

- **WHEN** `fontSans` is `"x;}</style><script>"`
- **THEN** `defineTheme` throws `ThemeInputError` for `fontSans`

### Requirement: Runs Anywhere

The builder SHALL run in Node, edge runtimes, browsers and Web Workers without DOM
access, SHALL have no runtime dependency, and SHALL be a separate entry so importing
`@rind-ui/theme` CSS never loads it.

#### Scenario: Server build per request

- **WHEN** the builder is imported in a runtime without `document`
- **THEN** `defineTheme` works and no global is accessed
