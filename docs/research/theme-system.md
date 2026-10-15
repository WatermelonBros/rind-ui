# Theme system (white-label) — research

Status: done · Wave: 1 (infrastructure, before the first component stylesheet)

Brief: [decision 0007](../decisions/0007-white-label-theme.md). Three token tiers (brand
inputs → semantic → component), derivation in CSS (OKLCH relative colour syntax +
`light-dark()`), a typed builder that validates contrast, scoped multi-tenant themes,
consumer-set `data-variant` / `data-size`, presets `calm` and `crisp`. Accessibility
baseline is already specified in `add-a11y-foundations` → `theme-accessibility` (focus
ring outline ≥ 2 px and 3:1, non-colour state cues, forced colors, 24×24 targets,
reduced motion, no `[hidden]` override) and [accessibility.md §8](accessibility.md#8-visual-preferences-and-sizing);
this note does not repeat it.

## How the others do it

### Radix Themes

- API: `<Theme accentColor grayColor radius scaling appearance panelBackground>`.
  `radius` ∈ none/small/medium/large/full, `scaling` ∈ 90–110 %, `appearance` ∈
  inherit/light/dark. Every token is a CSS variable under `.radix-themes` plus
  `data-accent-color`, `data-gray-color`, `data-radius`, `data-scaling` attributes on
  the Theme element. Nested `<Theme>` re-scopes a subtree.
- Colour: 30 hand-tuned 12-step scales (Radix Colors) × light/dark × alpha variants.
  The accent is a *pointer*: `--accent-9: var(--indigo-9)` re-pointed by
  `[data-accent-color]`. Custom brands go through a generator on the website whose
  output you paste (themes#543) — no runtime derivation.
- Portals: portalled content is wrapped in another `<Theme>` that reads React context
  (docs "Missing styles in portals"). This breaks when consumers have their own theme
  variables (themes#708) and with partial hydration / islands (themes#528, #589 —
  proposal to inherit through data attributes instead of context).
- Problems: contrast of default colours fails AA for several hues (themes#141 teal,
  #694 Callout red/green) and needs `highContrast`; tooltip is inverted so components
  inside it are unreadable (themes#418); one 700 KB stylesheet with every palette
  (themes#655); specificity ties with Tailwind preflight, order-dependent in
  production (themes#109); `accent` vs named scale resolving differently in custom
  components (themes#731); appearance lost on framework error pages because it lives
  in a provider (themes#280).
- Lesson: pointer-style palettes (one set of role tokens re-pointed per element) are
  right; context-based portal theming and unlayered selectors are wrong.

### Radix Colors (12-step scales)

- Steps by use: 1–2 backgrounds, 3–5 component backgrounds (normal/hover/active), 6–8
  borders (8 = focus rings), 9–10 solid fills, 11 low-contrast text, 12 high-contrast
  text. Guarantee is APCA: step 11 ≥ Lc 60, step 12 ≥ Lc 90 on step 2. Step 9 is
  designed for white text except sky, mint, lime, yellow, amber (dark text).
- Why 12: each step is a *use*, so components never pick colours, they pick roles.
  We keep the idea (roles) but not the count: rind needs seven roles per palette
  (`solid`, `solid-hover`, `on-solid`, `soft`, `soft-hover`, `text`, `border`) —
  derivable from one input — instead of twelve hand-tuned steps.

### shadcn/ui (themes, registry, Tailwind v4)

- CSS variables on `:root` and `.dark` in OKLCH, background/foreground pairs
  (`--primary` / `--primary-foreground`, `card`, `popover`, `muted`, `accent`,
  `destructive`, `border`, `input`, `ring`, `sidebar-*`), `--radius` with `calc()`
  steps; mapped to utilities with Tailwind v4 `@theme inline`. Base colours: neutral,
  stone, zinc, mauve, olive, mist, taupe. Registry items of type theme/style ship
  `cssVars` merged by the CLI.
- Problems: opacity-modified tokens silently break contrast (`text-destructive/90`,
  shadcn-ui#10431); `muted` pair at 4.34:1 (#8088); one token reused for unrelated
  roles and swapping identity between modes (#11763, `--input` on 13 non-inputs);
  format coupling — `hsl(var(--x))` wrappers broke when values became `oklch()`
  (#10254); hard-coded palette utilities that skip the theme (#10819); dark-mode
  flicker in the framework guides (#5476, #10104) because the class is set by script
  after paint.
- Lesson: tokens hold complete colour values, one meaning per token, opaque pairs, and
  every component reads tokens only (lint it).

### Park UI / Panda presets

- A Panda preset is `{ accentColor, grayColor, radius }` producing semantic tokens
  (`colorPalette.*` virtual palette, `fg.default`, `bg.subtle`…) and recipes per
  component with `variant`/`size`. Build-time (Panda codegen): no runtime re-brand.
- Lesson: "preset = a set of inputs fed to the same generator" (exactly 0007's
  definition); recipes per component = our per-component stylesheet with variants.

### Chakra UI v3

- Tokens → semantic tokens (with `_light`/`_dark` conditions) → recipes and slot
  recipes with `variants` (`solid`, `subtle`, `surface`, `outline`, `ghost`, `plain`)
  and `size`. `colorPalette` re-points a virtual palette per element — the same idea as
  Radix's accent pointer, and the model for our `data-tone`.
- Problems: condition order generates wrong CSS (`_dark` before `_light`,
  chakra#10028); semantic tokens break with custom selectors/conditions (#7744, #9178,
  #9997); tooltip ignores a forced light mode set on content (#9454); toast does not
  follow a colour-mode change while open (#3076) — portalled content captured the mode
  at mount; components that forget to consume `colorPalette` (Select #10581, Menu
  #10608, SegmentGroup #10379); AA failures of `fg.warning/subtle/error/success`
  (#11006); outline gray too light (#10515); SSR colour-mode flash and hydration
  mismatches (#1878, #2430, #9806, #9811).
- Lesson: colour mode must be pure CSS (`color-scheme`), not a JS value captured at
  render; every component must consume the tone pointer — test it per component.

### Material 3 dynamic colour

- One seed → HCT (CAM16 hue/chroma + L* tone) → five tonal palettes (primary,
  secondary, tertiary, neutral, neutral-variant) with tones 0–100 → roles
  (`primary` = tone 40 light / 80 dark, `on-primary` = 100 / 20, containers 90 / 30).
  Contrast comes from **tone distance**: Δtone ≥ 40 ≈ 3:1, ≥ 50 ≈ 4.5:1, because tone
  is L*, which maps monotonically to WCAG luminance. Newer versions add contrast levels
  (standard, medium, high).
- Lesson: in a perceptual lightness space, fixing lightness per role gives contrast
  *almost* for free. OKLCH `L` behaves like tone. "Almost" is the gap the builder
  closes (chroma and gamut clipping move luminance).

### Adobe Spectrum / Leonardo

- Leonardo generates colours from **target contrast ratios** against a background
  (`ratios: [3, 4.5, 7]`), solving lightness per key colour; Spectrum's themes are
  generated this way. Output is static values.
- Lesson: the builder's "nearest passing shade" is the same solver (search lightness
  at fixed hue for the target ratio).

### Open Props

- Hundreds of plain custom properties, adaptive props via `light-dark()` /
  media queries, no build step. Good: plain CSS, CSP-safe. Bad for white-label: no
  tier separation, consumers pick raw values.

### Tailwind v4 theme variables

- `@theme { --color-*: … }` namespaces generate utilities and are emitted as CSS
  variables; `@theme inline` references other variables; palette in OKLCH; uses
  `@property` for some internals.
- Problems: OKLCH palette invisible for ~7 % of users on old browsers without fallbacks
  (tailwindcss#16351); `@property` does not work in shadow roots (#15005); LightningCSS
  rewrites `light-dark()` into a variable polyfill that breaks scoping (#18849);
  neutral hue drift in `color-mix()` unless hue is `none` (#19830); unlayered preflight
  beating utilities (#19978); dark-mode transitions firing on load (#3272).
- Lesson: precomputed fallbacks for old engines, no `@property` for tokens, document
  build-tool transforms, neutral hue `none` when chroma is ~0, and a single cascade
  layer the consumer can place.

### Style Dictionary / DTCG

- The W3C Design Tokens Community Group published the **Design Tokens Format Module
  2025.10** (first stable version, 28 Oct 2025; Community Group report, not
  standards-track). Tokens are JSON with `$value`, `$type`, `$description`, aliases
  `{group.token}`, colour values in any CSS Color 4 space (OKLCH included), and
  theming / multi-brand via sets and resolvers. Style Dictionary 4+, Tokens Studio,
  Terrazzo and Figma variables import/export it.
- Lesson: optional `toDTCG()` from the builder costs little (our tokens are already a
  typed tree) and lets designers round-trip with Figma. Not a runtime format.

## Platform support (checked 2026-10-14)

| Feature | Chrome | Firefox | Safari | Notes |
|---|---|---|---|---|
| `oklch()` | 111 | 113 | 15.4 | |
| Relative colour syntax (full) | 131 (partial 119–130) | 133 (partial 128–132) | 18.0 (partial 16.4–17.6: older draft, channel units) | caniuse 93 % global |
| `light-dark()` | 123 | 120 | 17.5 | caniuse 91 % |
| `color-mix()` | 111 | 113 | 16.2 | |
| `@property` | 85 | 128 | 16.4 | not in shadow roots (#15005); registered `<color>` resolves `light-dark()` at the declaring element — do not register colour tokens |
| `contrast-color()` | 147 | 146 | 26 | Baseline Apr 2026; only white/black, algorithm UA-defined, MDN: mid-tones fail AA |
| Cascade layers | 99 | 97 | 15.4 | |
| `prefers-contrast` / `forced-colors` | 96 / 89 | 101 / 89 | 14.1 / 16 | |

Sources: caniuse `css-relative-colors`, `mdn-css_types_color_light-dark`; MDN
Relative colors, `contrast-color()`; web.dev "New to the web platform in April 2026".

Consequences: the derivation path needs relative colour syntax, so it sits behind
`@supports (color: oklch(from red l c h))`; precomputed (builder) themes need only
`light-dark()`. `contrast-color()` is too new and too loose to rely on.

## Contrast: WCAG 2 vs APCA

- WCAG 2.2 AA is the legal baseline (EN 301 549, ADA, EAA): 4.5:1 text, 3:1 large text
  and non-text UI/state (1.4.11), focus indicator 3:1 (2.4.13 AAA wording, our
  baseline). It over-rates black on mid blues and under-rates white on orange.
- APCA (Lc) was removed from the WCAG 3 draft in 2023; the March 2026 WCAG 3 Working
  Draft says the contrast algorithm is "yet to be determined" (W3C; Adrian Roselli,
  "WCAG3 Contrast as of April 2026"). Decision: validate WCAG 2.2 only; APCA is a
  non-goal until WCAG 3 picks an algorithm.
- Useful fact (computed): for any colour, the better of white and black text gives
  at least 4.58:1 (the cross-over is relative luminance 0.179, OKLCH L ≈ 0.56). So
  `on-solid` = black or white chosen by luminance always passes AA; choosing by OKLCH
  `L` in CSS is an approximation that can miss near L 0.56–0.62 for saturated hues.

Checked with a quick script (gamut-mapped OKLCH → sRGB, WCAG 2 luminance), neutral
hue: the proposed lightnesses give light text 17.5, muted 5.9 / 5.5 on surface / 5.2
on soft, strong border 3.6 / 3.3; dark text 16.8, muted 7.8, strong border 4.0 / 3.5.
Brands: `text` = brand with L ≤ 0.50 (light) / ≥ 0.78 (dark) passes 4.5 on bg and
soft for indigo, red, magenta, teal, yellow, lime (5.0–9.6); yellow and lime as solid
fills have only 1.5–1.8:1 against white, so a checked indicator needs the `border`
role (L ≤ 0.60, ≥ 3.7:1) as its edge — the fill alone cannot carry the state.

## Bug history

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| Radix Themes | [#708](https://github.com/radix-ui/themes/issues/708) | Custom theme vars lost in portalled Dialog/Popover | Portal re-wraps in a default `<Theme>` from context | open | Portal host copies theme *attributes*; tokens cascade from CSS, no context |
| Radix Themes | [#589](https://github.com/radix-ui/themes/issues/589), [#528](https://github.com/radix-ui/themes/issues/528) | Themes break with Astro islands / partial hydration | Theme lives in React context | proposal open | Attributes + CSS only; no provider |
| Radix Themes | [#280](https://github.com/radix-ui/themes/issues/280) | Appearance always light on Next.js error pages | Provider not rendered there | closed (workaround) | Light/dark from `color-scheme`, which works without any component |
| Radix Themes | [#141](https://github.com/radix-ui/themes/issues/141), [#694](https://github.com/radix-ui/themes/issues/694) | Teal / red / green fail AA | Hand-tuned scales, contrast not checked per pair | open; `highContrast` workaround | Builder checks every pair in both schemes and fails loudly |
| Radix Themes | [#418](https://github.com/radix-ui/themes/issues/418) | Links/badges unreadable inside tooltip | Tooltip inverted, children keep page palette | open | Presets do not invert tooltips; a dark island is a `data-theme="dark"` scope |
| Radix Themes | [#109](https://github.com/radix-ui/themes/issues/109) | Tailwind base overrides theme in prod only | Equal specificity, order differs by bundler | closed | All theme CSS in `@layer rind`; unlayered consumer CSS always wins |
| Radix Themes | [#655](https://github.com/radix-ui/themes/issues/655) | 700 KB CSS | Every palette and component in one file | open | Palettes derived (no scale files); one stylesheet per component, importable alone |
| Radix Themes | [#731](https://github.com/radix-ui/themes/issues/731) | `accent-*` and named scale resolve differently in custom code | Pointer re-declared on Theme element only | open | Role tokens re-derived on every scope; documented "read role tokens" |
| Radix Themes | [#636](https://github.com/radix-ui/themes/issues/636) | Dialog flashes dark before close | Exit animation on overlay colour | closed | Overlay token opaque-to-transparent through opacity, not colour swap |
| shadcn/ui | [#10431](https://github.com/shadcn-ui/ui/issues/10431) | Destructive alert text below AA | `text-destructive/90` alpha | open | Text pairs opaque, no alpha-derived text tokens |
| shadcn/ui | [#8088](https://github.com/shadcn-ui/ui/issues/8088) | `muted-foreground` 4.34:1 | Unchecked token values | closed | Builder test on every preset |
| shadcn/ui | [#11763](https://github.com/shadcn-ui/ui/issues/11763) | Token meanings drift; swap between modes | Small token set reused for unrelated roles | open | One role per token; tier-3 names per component |
| shadcn/ui | [#10254](https://github.com/shadcn-ui/ui/issues/10254) | Colours unparsable after OKLCH switch | `hsl(var(--x))` wrapper around channel-only vars | open | Tokens hold full colour values |
| shadcn/ui | [#10819](https://github.com/shadcn-ui/ui/issues/10819) | Command menu ignores theme | Hard-coded palette utilities | open | Lint: component CSS reads tokens only |
| shadcn/ui | [#5476](https://github.com/shadcn-ui/ui/issues/5476), [#10104](https://github.com/shadcn-ui/ui/issues/10104) | Dark-mode flicker, script warnings | Mode set by script after first paint | open | System mode needs no script; explicit mode is a server-rendered attribute |
| Chakra UI | [#3076](https://github.com/chakra-ui/chakra-ui/issues/3076) | Open toast keeps old colour mode | Mode captured at render in portal | closed | `light-dark()` re-resolves live; portal host syncs `data-theme` |
| Chakra UI | [#9454](https://github.com/chakra-ui/chakra-ui/issues/9454) | Forced light mode on tooltip content ignored | Recipe tokens resolved at root | closed | Tokens re-derived per scope; `data-theme` honoured on any element |
| Chakra UI | [#10028](https://github.com/chakra-ui/chakra-ui/issues/10028) | `_dark` before `_light` → wrong CSS | Order-dependent conditions | closed | `light-dark(light, dark)` — one declaration, no order |
| Chakra UI | [#10581](https://github.com/chakra-ui/chakra-ui/issues/10581), [#10379](https://github.com/chakra-ui/chakra-ui/issues/10379) | Select / SegmentGroup ignore `colorPalette` | Recipe forgot the pointer | closed | Per-component visual test of `data-tone` |
| Chakra UI | [#11006](https://github.com/chakra-ui/chakra-ui/issues/11006) | `fg.warning/error/success/subtle` fail AA | Status colours unchecked | closed | Status palettes validated like accent |
| Chakra UI | [#2430](https://github.com/chakra-ui/chakra-ui/issues/2430), [#9806](https://github.com/chakra-ui/chakra-ui/issues/9806) | White flash in dark mode; hydration errors | JS colour mode | closed | `color-scheme` + `<meta name="color-scheme">` recipe |
| Tailwind | [#16351](https://github.com/tailwindlabs/tailwindcss/issues/16351) | OKLCH colours missing for ~7 % of users | No fallback for old engines | closed (docs) | Built themes need only `light-dark()`; derivation behind `@supports` |
| Tailwind | [#18849](https://github.com/tailwindlabs/tailwindcss/issues/18849) | `light-dark()` broken after build | LightningCSS polyfills it with variables | closed | Docs: do not lower `light-dark()`; test the published CSS through Vite + LightningCSS |
| Tailwind | [#15005](https://github.com/tailwindlabs/tailwindcss/issues/15005) | Defaults missing in shadow roots | `@property` is document-scoped | open | No `@property` for tokens |
| Tailwind | [#19830](https://github.com/tailwindlabs/tailwindcss/issues/19830) | Neutral greys shift hue in `color-mix()` | Near-zero chroma with a hue | closed | Neutral chroma capped; hue `none` below 0.005 |
| Tailwind | [#3272](https://github.com/tailwindlabs/tailwindcss/issues/3272) | Dark-mode transitions play on page load | Transition on colour properties + late class | closed | Never transition colour tokens on theme switch; component transitions list properties |

## Decisions

1. **Names.** Tier 1 `--rind-brand-*` (12 inputs). Tier 2 `--rind-<category>-<role>`,
   closed category list. Tier 3 `--rind-<data-scope>-<name>`, never declared by the
   theme, read as `var(--rind-button-solid-bg, var(--rind-color-accent-solid))` so an
   override on any ancestor works (declaring them on the component element would shadow
   ancestor overrides).
2. **Brand inputs:** accent, neutral, danger, warning, success, font-sans, font-mono,
   font-size, radius, density, motion, border-strength.
3. **Palettes:** five palettes × seven roles; `data-tone` re-points the accent roles to
   another palette inside an element (Radix accent pointer / Chakra `colorPalette`).
4. **Derivation formulas (light | dark), CSS path:**
   - neutral `n = oklch(from var(--rind-brand-neutral) L min(c, 0.03) h)` at
     bg 0.995 | 0.16, surface 0.97 | 0.20, surface-raised 1 | 0.23, text 0.21 | 0.95,
     text-muted 0.50 | 0.72, text-disabled 0.62 | 0.48, border-strong 0.62 | 0.55,
     border = mix of 0.92 | 0.30 towards border-strong by `border-strength`.
   - palette `p`: solid = `p`; solid-hover = L ∓ 0.05 (light darker, dark lighter);
     on-solid = white if L < 0.6 else near-black (`oklch(0.18 0.01 h)`); soft =
     L 0.95 | 0.27, `min(c, 0.05)`; soft-hover = 0.92 | 0.31; text = `min(l, 0.5)` |
     `max(l, 0.78)`, `min(c, 0.2)`; border = `min(l, 0.6)` | `max(l, 0.62)`.
   - focus color = accent border; focus width 2px, offset 2px (theme-accessibility).
   - **The builder must precompute** (CSS cannot guarantee): every text pair's
     contrast after sRGB gamut mapping, `on-solid` black/white by real luminance, and
     the nearest passing lightness when a pair fails. CSS relative colour syntax
     cannot compare two colours.
5. **Two kinds of scope.** *Built* themes (presets, `defineTheme` output) declare
   literal, validated tier-2 values; *live* scopes set only brand inputs and get the CSS
   derivation. Both use the same names; a live scope re-derives because the derivation
   rules match `:where(:root, [data-rind-theme])`.
6. **Portals:** the portal host copies `data-rind-theme` and `data-theme` (and keeps
   them in sync) from the nearest ancestor of its logical parent, like it already copies
   `dir`/`lang`. Rejected: `:root`-only tokens (breaks multi-tenant pages and previews)
   and framework context (Radix #708/#589).
7. **Light/dark:** follows the element's used `color-scheme`; `data-theme="light|dark"`
   sets it, an app's own `.dark { color-scheme: dark }` works too. No script.
8. **Cascade:** `@layer rind.tokens, rind.themes, rind.components, rind.preferences`;
   reduced motion and more-contrast live in the last sublayer so no theme can undo them.
9. **Builder:** `defineTheme(input)` (throws `ThemeContrastError` with suggestions, or
   `contrast: "adjust"` applies them and reports), `checkTheme(input)` (report only),
   `.css` string scoped to `[data-rind-theme="<name>"]`, optional `toDTCG()`. Pure TS,
   no DOM, no dependency — runs on a server per tenant request.
10. **Variants:** see the matrix in the `add-theme-system` design; `data-variant`,
    `data-size`, `data-tone` are consumer attributes, never read or written by core.
11. **Presets:** `calm` (accent indigo, radius 0.5rem, density 1, border-strength 0.2,
    motion 1) and `crisp` (accent blue, radius 0.25rem, density 0.875, border-strength
    0.6, motion 0.75), both generated by the builder.

## Open questions

None that change the specs (see the change's design).
