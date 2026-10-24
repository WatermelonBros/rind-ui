// The builder's skins (any-look.tsx): what a look is made of, the twenty ready ones "Surprise me"
// goes through, and the stylesheet a look writes. Only rind's data-* attributes are styled, so
// the CSS shown is the whole skin and works on any page that renders rind components.

export type Shadow = "flat" | "soft" | "hard" | "glow" | "bevel" | "clay"
export type Fill = "solid" | "gradient" | "glass" | "outline"
export type Font = "sans" | "serif" | "mono" | "rounded" | "display"
export type Density = "compact" | "cozy" | "roomy"
export type Pattern = "none" | "dots" | "grid" | "mesh" | "lines"
export type Letters = "normal" | "upper"
export type Motion = "springy" | "snappy" | "still"

export const SHADOWS = ["flat", "soft", "hard", "glow", "bevel", "clay"] as const
export const FILLS = ["solid", "gradient", "glass", "outline"] as const
export const FONT_NAMES = ["sans", "serif", "mono", "rounded", "display"] as const
export const DENSITIES = ["compact", "cozy", "roomy"] as const
export const PATTERNS = ["none", "dots", "grid", "mesh", "lines"] as const
export const LETTERS = ["normal", "upper"] as const
export const MOTIONS = ["springy", "snappy", "still"] as const

export interface Look {
  /** the visitor's pick; null wears the site phase's own brand */
  readonly brand: string | null
  /** the second colour: a gradient's end, a mesh's other glow */
  readonly accent: string
  readonly surface: string
  readonly radius: number
  readonly border: number
  readonly shadow: Shadow
  readonly fill: Fill
  readonly font: Font
  readonly density: Density
  readonly pattern: Pattern
  readonly letters: Letters
  readonly motion: Motion
}

export interface Preset {
  readonly id: string
  readonly name: string
  readonly look: Look
}

const look = (l: Look): Look => l

/** The first is where the builder starts and what Reset returns to: the site's own look. */
export const PRESETS: readonly Preset[] = [
  {
    id: "rind",
    name: "Rind",
    look: look({
      brand: null,
      accent: "#FF8FA3",
      surface: "#FFFFFF",
      radius: 14,
      border: 0,
      shadow: "soft",
      fill: "solid",
      font: "rounded",
      density: "cozy",
      pattern: "none",
      letters: "normal",
      motion: "springy",
    }),
  },
  {
    id: "brutalist",
    name: "Brutalist",
    look: look({
      brand: "#FF3D00",
      accent: "#111111",
      surface: "#F4F1EA",
      radius: 0,
      border: 3,
      shadow: "hard",
      fill: "solid",
      font: "mono",
      density: "compact",
      pattern: "none",
      letters: "upper",
      motion: "snappy",
    }),
  },
  {
    id: "glass",
    name: "Glass",
    look: look({
      brand: "#7C5CFF",
      accent: "#FF5CAA",
      surface: "#EEF0FF",
      radius: 20,
      border: 1,
      shadow: "soft",
      fill: "glass",
      font: "sans",
      density: "roomy",
      pattern: "mesh",
      letters: "normal",
      motion: "springy",
    }),
  },
  {
    id: "terminal",
    name: "Terminal",
    look: look({
      brand: "#39FF14",
      accent: "#00E5FF",
      surface: "#0A0F0A",
      radius: 0,
      border: 1,
      shadow: "glow",
      fill: "outline",
      font: "mono",
      density: "compact",
      pattern: "grid",
      letters: "upper",
      motion: "snappy",
    }),
  },
  {
    id: "clay",
    name: "Clay",
    look: look({
      brand: "#FF8A65",
      accent: "#FFD54F",
      surface: "#F3E9E1",
      radius: 28,
      border: 0,
      shadow: "clay",
      fill: "solid",
      font: "rounded",
      density: "roomy",
      pattern: "none",
      letters: "normal",
      motion: "springy",
    }),
  },
  {
    id: "newsprint",
    name: "Newsprint",
    look: look({
      brand: "#111111",
      accent: "#B00020",
      surface: "#F7F3E8",
      radius: 0,
      border: 1,
      shadow: "flat",
      fill: "solid",
      font: "serif",
      density: "cozy",
      pattern: "lines",
      letters: "normal",
      motion: "still",
    }),
  },
  {
    id: "vaporwave",
    name: "Vaporwave",
    look: look({
      brand: "#FF71CE",
      accent: "#01CDFE",
      surface: "#2B1055",
      radius: 12,
      border: 2,
      shadow: "glow",
      fill: "gradient",
      font: "display",
      density: "cozy",
      pattern: "grid",
      letters: "upper",
      motion: "springy",
    }),
  },
  {
    id: "swiss",
    name: "Swiss",
    look: look({
      brand: "#E30613",
      accent: "#111111",
      surface: "#FFFFFF",
      radius: 0,
      border: 0,
      shadow: "flat",
      fill: "solid",
      font: "sans",
      density: "compact",
      pattern: "none",
      letters: "upper",
      motion: "snappy",
    }),
  },
  {
    id: "midnight",
    name: "Midnight",
    look: look({
      brand: "#6E8BFF",
      accent: "#C084FC",
      surface: "#0F172A",
      radius: 10,
      border: 1,
      shadow: "soft",
      fill: "gradient",
      font: "sans",
      density: "cozy",
      pattern: "dots",
      letters: "normal",
      motion: "snappy",
    }),
  },
  {
    id: "forest",
    name: "Forest",
    look: look({
      brand: "#2F7D4F",
      accent: "#C9A227",
      surface: "#F1F5EC",
      radius: 6,
      border: 1,
      shadow: "soft",
      fill: "solid",
      font: "serif",
      density: "roomy",
      pattern: "none",
      letters: "normal",
      motion: "springy",
    }),
  },
  {
    id: "handheld",
    name: "Handheld",
    look: look({
      brand: "#306230",
      accent: "#0F380F",
      surface: "#9BBC0F",
      radius: 0,
      border: 3,
      shadow: "hard",
      fill: "solid",
      font: "mono",
      density: "compact",
      pattern: "grid",
      letters: "upper",
      motion: "still",
    }),
  },
  {
    id: "blueprint",
    name: "Blueprint",
    look: look({
      brand: "#FFFFFF",
      accent: "#9CD3FF",
      surface: "#1E4F9C",
      radius: 2,
      border: 1,
      shadow: "flat",
      fill: "outline",
      font: "mono",
      density: "cozy",
      pattern: "grid",
      letters: "upper",
      motion: "snappy",
    }),
  },
  {
    id: "bauhaus",
    name: "Bauhaus",
    look: look({
      brand: "#1D4ED8",
      accent: "#F2C12E",
      surface: "#F5F0E6",
      radius: 28,
      border: 3,
      shadow: "hard",
      fill: "solid",
      font: "display",
      density: "cozy",
      pattern: "none",
      letters: "upper",
      motion: "snappy",
    }),
  },
  {
    id: "paper",
    name: "Paper",
    look: look({
      brand: "#2B2B2B",
      accent: "#E2725B",
      surface: "#FBF8F1",
      radius: 4,
      border: 1,
      shadow: "soft",
      fill: "outline",
      font: "serif",
      density: "roomy",
      pattern: "dots",
      letters: "normal",
      motion: "still",
    }),
  },
  {
    id: "neon",
    name: "Neon",
    look: look({
      brand: "#00FFC6",
      accent: "#FF00E5",
      surface: "#0B0B12",
      radius: 16,
      border: 2,
      shadow: "glow",
      fill: "outline",
      font: "display",
      density: "cozy",
      pattern: "none",
      letters: "upper",
      motion: "springy",
    }),
  },
  {
    id: "pastel",
    name: "Pastel",
    look: look({
      brand: "#A78BFA",
      accent: "#F9A8D4",
      surface: "#FFF7FB",
      radius: 22,
      border: 0,
      shadow: "soft",
      fill: "gradient",
      font: "rounded",
      density: "roomy",
      pattern: "mesh",
      letters: "normal",
      motion: "springy",
    }),
  },
  {
    id: "luxe",
    name: "Luxe",
    look: look({
      brand: "#C9A86A",
      accent: "#F5E6C8",
      surface: "#121212",
      radius: 2,
      border: 1,
      shadow: "flat",
      fill: "outline",
      font: "serif",
      density: "roomy",
      pattern: "none",
      letters: "upper",
      motion: "still",
    }),
  },
  {
    id: "desktop-95",
    name: "Desktop 95",
    look: look({
      brand: "#000080",
      accent: "#008080",
      surface: "#C0C0C0",
      radius: 0,
      border: 0,
      shadow: "bevel",
      fill: "solid",
      font: "sans",
      density: "compact",
      pattern: "none",
      letters: "normal",
      motion: "still",
    }),
  },
  {
    id: "sunset",
    name: "Sunset",
    look: look({
      brand: "#FF5F6D",
      accent: "#FFC371",
      surface: "#FFF4EC",
      radius: 28,
      border: 0,
      shadow: "soft",
      fill: "gradient",
      font: "display",
      density: "roomy",
      pattern: "mesh",
      letters: "normal",
      motion: "springy",
    }),
  },
  {
    id: "minimal",
    name: "Minimal",
    look: look({
      brand: "#18181B",
      accent: "#71717A",
      surface: "#FAFAFA",
      radius: 6,
      border: 1,
      shadow: "flat",
      fill: "solid",
      font: "sans",
      density: "cozy",
      pattern: "none",
      letters: "normal",
      motion: "snappy",
    }),
  },
]

/** The faces as the copied CSS names them: real families, each falling back to the platform's. */
export const FONTS: Record<Font, string> = {
  sans: '"Inter Tight", system-ui, sans-serif',
  serif: '"Source Serif 4", Georgia, serif',
  mono: '"JetBrains Mono", ui-monospace, monospace',
  rounded: "Fredoka, ui-rounded, system-ui, sans-serif",
  display: 'Unbounded, "Arial Black", system-ui, sans-serif',
}
/** The same faces in the preview, as this site loads them (app/layout.tsx): a visitor without
 *  them installed still sees the designed type, never a system default. */
export const SITE_FONTS: Record<Font, string> = {
  sans: "var(--font-inter)",
  serif: "var(--font-serif)",
  mono: "var(--font-mono)",
  rounded: "var(--font-fredoka)",
  display: "var(--font-unbounded)",
}
const DENSITY: Record<Density, readonly [number, number, number]> = {
  compact: [6, 10, 10],
  cozy: [9, 14, 14],
  roomy: [12, 18, 20],
}
const SHADOW_CSS: Record<Shadow, string> = {
  flat: "none",
  soft: "0 1px 2px rgb(0 0 0 / 0.12), 0 8px 20px rgb(0 0 0 / 0.1)",
  hard: "4px 4px 0 var(--skin-ink)",
  glow: "0 0 0 1px color-mix(in oklab, var(--skin-brand) 45%, transparent), 0 0 22px color-mix(in oklab, var(--skin-brand) 50%, transparent)",
  bevel: "inset -2px -2px 0 rgb(0 0 0 / 0.45), inset 2px 2px 0 rgb(255 255 255 / 0.85)",
  clay: "inset -4px -6px 10px rgb(0 0 0 / 0.12), inset 4px 6px 10px rgb(255 255 255 / 0.7), 0 10px 22px rgb(0 0 0 / 0.12)",
}
const PATTERN_CSS: Record<Pattern, string> = {
  none: "var(--skin-surface)",
  dots: "radial-gradient(circle, color-mix(in oklab, var(--skin-ink) 16%, transparent) 1.2px, transparent 1.7px) 0 0 / 18px 18px, var(--skin-surface)",
  grid: "linear-gradient(color-mix(in oklab, var(--skin-ink) 9%, transparent) 1px, transparent 1px) 0 0 / 24px 24px, linear-gradient(90deg, color-mix(in oklab, var(--skin-ink) 9%, transparent) 1px, transparent 1px) 0 0 / 24px 24px, var(--skin-surface)",
  mesh: "radial-gradient(circle at 12% 18%, color-mix(in oklab, var(--skin-brand) 55%, transparent), transparent 48%), radial-gradient(circle at 88% 80%, color-mix(in oklab, var(--skin-accent) 60%, transparent), transparent 50%), var(--skin-surface)",
  lines:
    "repeating-linear-gradient(-45deg, color-mix(in oklab, var(--skin-ink) 6%, transparent) 0 2px, transparent 2px 12px), var(--skin-surface)",
}
const MOTION_CSS: Record<Motion, readonly [string, string]> = {
  springy: ["0.4s", "cubic-bezier(0.34, 1.56, 0.64, 1)"],
  snappy: ["0.14s", "cubic-bezier(0.2, 0, 0, 1)"],
  still: ["0s", "linear"],
}

/** Ink or white, whichever reads better on `hex` (WCAG relative luminance). */
export function textOn(hex: string): string {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b
  // contrast against white vs against near-black ink; pick the larger
  return 1.05 / (l + 0.05) >= (l + 0.05) / 0.055 ? "#FFFFFF" : "#18181B"
}

/** How the brand paints a filled part (a button, a checked switch), and the text on it. */
function brandFill(l: Look & { readonly brand: string }): readonly [string, string] {
  switch (l.fill) {
    case "solid":
      return ["var(--skin-brand)", textOn(l.brand)]
    case "gradient":
      return ["linear-gradient(135deg, var(--skin-brand), var(--skin-accent))", textOn(l.brand)]
    case "glass":
      return ["color-mix(in oklab, var(--skin-brand) 72%, transparent)", textOn(l.brand)]
    case "outline":
      // the text is the brand on the stage's own surface
      return ["transparent", l.brand]
  }
}

/** The whole skin: tokens on `:root`, then rules on rind's attributes and nothing else. */
export function skinCss(l: Look & { readonly brand: string }): string {
  const [py, px, gap] = DENSITY[l.density]
  const [fill, fillText] = brandFill(l)
  const glass = l.fill === "glass"
  const [dur, ease] = MOTION_CSS[l.motion]
  const heading = l.font === "display" ? "display" : l.font
  const body = l.font === "display" ? "sans" : l.font
  const upper = l.letters === "upper"
  return `/* skin.css: the whole look of the components above */
:root {
  --skin-brand: ${l.brand.toLowerCase()};
  --skin-accent: ${l.accent.toLowerCase()};
  --skin-fill: ${fill};
  --skin-fill-text: ${fillText.toLowerCase()};
  --skin-surface: ${l.surface.toLowerCase()};
  --skin-ink: ${textOn(l.surface).toLowerCase()};
  --skin-card: ${glass ? "color-mix(in oklab, var(--skin-surface) 55%, transparent)" : "var(--skin-surface)"};
  --skin-line: color-mix(in oklab, var(--skin-ink) ${glass ? "14%, transparent" : "20%, var(--skin-surface)"});
  --skin-muted: color-mix(in oklab, var(--skin-ink) 7%, ${glass ? "transparent" : "var(--skin-surface)"});
  --skin-blur: ${glass ? "blur(14px) saturate(1.4)" : "none"};
  --skin-radius: ${l.radius}px;
  --skin-radius-sm: ${Math.round(l.radius * 0.6)}px;
  --skin-border: ${l.border}px;
  --skin-shadow: ${SHADOW_CSS[l.shadow]};
  --skin-font: ${FONTS[body]};
  --skin-heading: ${FONTS[heading]};
  --skin-case: ${upper ? "uppercase" : "none"};
  --skin-tracking: ${upper ? "0.06em" : "normal"};
  --skin-pad-y: ${py}px;
  --skin-pad-x: ${px}px;
  --skin-gap: ${gap}px;
  --skin-duration: ${dur};
  --skin-ease: ${ease};
  background: ${PATTERN_CSS[l.pattern]};
  color: var(--skin-ink);
  font: 15px / 1.4 var(--skin-font);
}
[data-scope]:focus-visible {
  outline: 2px solid var(--skin-brand);
  outline-offset: 2px;
}

/* Text field */
[data-scope="text-field"][data-part="root"] {
  display: grid;
  gap: 6px;
}
[data-scope="text-field"][data-part="label"] {
  font: 600 13px var(--skin-heading);
  text-transform: var(--skin-case);
  letter-spacing: var(--skin-tracking);
}
[data-scope="text-field"][data-part="input"] {
  font: inherit;
  color: inherit;
  padding: var(--skin-pad-y) var(--skin-pad-x);
  background: var(--skin-muted);
  border: max(1px, var(--skin-border)) solid var(--skin-line);
  border-radius: var(--skin-radius-sm);
  box-shadow: ${l.shadow === "bevel" ? "inset 2px 2px 0 rgb(0 0 0 / 0.45), inset -2px -2px 0 rgb(255 255 255 / 0.85)" : "none"};
  backdrop-filter: var(--skin-blur);
  transition: border-color var(--skin-duration) var(--skin-ease);
}
[data-scope="text-field"][data-part="input"]::placeholder {
  color: color-mix(in oklab, var(--skin-ink) 45%, transparent);
}
[data-scope="text-field"][data-part="input"]:focus-visible {
  outline-offset: 0;
  border-color: var(--skin-brand);
}

/* Switch */
[data-scope="switch"][data-part="root"] {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}
[data-scope="switch"][data-part="control"] {
  display: inline-flex;
  align-items: center;
  box-sizing: border-box;
  inline-size: 46px;
  block-size: 26px;
  padding: 3px;
  border: var(--skin-border) solid var(--skin-line);
  border-radius: ${Math.min(99, l.radius * 2)}px;
  background: var(--skin-line);
  transition: background var(--skin-duration) var(--skin-ease);
}
[data-scope="switch"][data-part="control"][data-state="checked"] {
  background: ${l.fill === "outline" ? "var(--skin-brand)" : "var(--skin-fill)"};
  border-color: var(--skin-brand);
}
[data-scope="switch"][data-part="thumb"] {
  inline-size: 18px;
  block-size: 18px;
  border-radius: ${Math.min(99, l.radius)}px;
  background: var(--skin-surface);
  box-shadow: var(--skin-shadow);
  transition: translate var(--skin-duration) var(--skin-ease);
}
[data-scope="switch"][data-part="thumb"][data-state="checked"] {
  translate: calc(46px - 18px - 6px - 2 * var(--skin-border)) 0;
}

/* Checkbox */
[data-scope="checkbox"][data-part="root"] {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}
[data-scope="checkbox"][data-part="control"] {
  display: grid;
  place-items: center;
  box-sizing: border-box;
  inline-size: 22px;
  block-size: 22px;
  border: max(1px, var(--skin-border)) solid var(--skin-line);
  border-radius: min(7px, var(--skin-radius-sm));
  background: var(--skin-card);
  color: var(--skin-fill-text);
  font-size: 13px;
  transition: background var(--skin-duration) var(--skin-ease), scale var(--skin-duration) var(--skin-ease);
}
[data-scope="checkbox"][data-part="control"][data-state="checked"] {
  background: ${l.fill === "outline" ? "var(--skin-brand)" : "var(--skin-fill)"};
  border-color: var(--skin-brand);
  color: ${l.fill === "outline" ? textOn(l.brand).toLowerCase() : "var(--skin-fill-text)"};
}
[data-scope="checkbox"][data-part="control"][data-pressed] {
  scale: 0.88;
}
[data-scope="checkbox"][data-part="indicator"][data-state="unchecked"] {
  visibility: hidden;
}

/* Button and toggle */
:is([data-scope="button"][data-part="root"], [data-scope="toggle"][data-part="root"]) {
  font: 600 14px var(--skin-heading);
  text-transform: var(--skin-case);
  letter-spacing: var(--skin-tracking);
  padding: var(--skin-pad-y) calc(var(--skin-pad-x) + 6px);
  border: max(${l.fill === "outline" ? 2 : 0}px, var(--skin-border)) solid var(--skin-line);
  border-radius: var(--skin-radius-sm);
  box-shadow: var(--skin-shadow);
  backdrop-filter: var(--skin-blur);
  cursor: pointer;
  transition: filter var(--skin-duration) var(--skin-ease), translate var(--skin-duration) var(--skin-ease);
}
[data-scope="button"][data-part="root"] {
  background: var(--skin-fill);
  border-color: var(--skin-brand);
  color: var(--skin-fill-text);
}
[data-scope="button"][data-part="root"][data-hover] {
  filter: brightness(1.08) saturate(1.1);
  translate: 0 -1px;
}
[data-scope="toggle"][data-part="root"] {
  background: var(--skin-muted);
  color: var(--skin-ink);
}
[data-scope="toggle"][data-part="root"][data-state="on"] {
  background: var(--skin-ink);
  border-color: var(--skin-ink);
  color: var(--skin-surface);
}
:is([data-scope="button"][data-part="root"], [data-scope="toggle"][data-part="root"])[data-pressed] {
  translate: ${l.shadow === "hard" ? "3px 3px" : "0 1px"};
  box-shadow: ${l.shadow === "hard" ? "1px 1px 0 var(--skin-ink)" : l.shadow === "bevel" ? "inset 2px 2px 0 rgb(0 0 0 / 0.45), inset -2px -2px 0 rgb(255 255 255 / 0.85)" : "var(--skin-shadow)"};
}

/* Accordion */
[data-scope="accordion"][data-part="root"] {
  border: var(--skin-border) solid var(--skin-line);
  border-radius: var(--skin-radius);
  background: var(--skin-card);
  box-shadow: var(--skin-shadow);
  backdrop-filter: var(--skin-blur);
  overflow: hidden;
}
[data-scope="accordion"][data-part="item"] + [data-part="item"] {
  border-top: max(1px, var(--skin-border)) solid var(--skin-line);
}
[data-scope="accordion"][data-part="header"] {
  margin: 0;
}
[data-scope="accordion"][data-part="trigger"] {
  display: flex;
  justify-content: space-between;
  align-items: center;
  inline-size: 100%;
  padding: calc(var(--skin-pad-y) + 6px) calc(var(--skin-pad-x) + 2px);
  border: 0;
  background: none;
  color: inherit;
  font: 600 15px var(--skin-heading);
  text-transform: var(--skin-case);
  letter-spacing: var(--skin-tracking);
  text-align: start;
  cursor: pointer;
}
[data-scope="accordion"][data-part="indicator"] {
  color: var(--skin-brand);
  transition: rotate var(--skin-duration) var(--skin-ease);
}
[data-scope="accordion"][data-part="indicator"][data-state="open"] {
  rotate: 45deg;
}
[data-scope="accordion"][data-part="content"] > p {
  margin: 0;
  padding: 0 calc(var(--skin-pad-x) + 2px) calc(var(--skin-pad-y) + 8px);
  color: color-mix(in oklab, var(--skin-ink) 72%, transparent);
}`
}

/** A look in a link: its preset's id when it is one, else its values in a short query string. */
export function encodeLook(l: Look): string {
  const preset = PRESETS.find((p) => sameLook(p.look, l))
  if (preset) return preset.id
  return [
    l.brand ?? "-",
    l.accent,
    l.surface,
    l.radius,
    l.border,
    l.shadow,
    l.fill,
    l.font,
    l.density,
    l.pattern,
    l.letters,
    l.motion,
  ]
    .map((v) => String(v).replace("#", ""))
    .join(".")
}

const pickOf = <T extends string>(list: readonly T[], v: string | undefined): T | undefined =>
  list.find((x) => x === v)
const hex = (v: string | undefined) =>
  v && /^[0-9a-f]{6}$/i.test(v) ? `#${v.toUpperCase()}` : null

/** Back from a link: a preset's id, or the values encodeLook wrote; anything else is ignored. */
export function decodeLook(s: string): Look | null {
  const preset = PRESETS.find((p) => p.id === s)
  if (preset) return preset.look
  const [
    brand,
    accent,
    surface,
    radius,
    border,
    shadow,
    fill,
    font,
    density,
    pattern,
    letters,
    motion,
  ] = s.split(".")
  const r = Number(radius)
  const b = Number(border)
  const parts = {
    accent: hex(accent),
    surface: hex(surface),
    shadow: pickOf(SHADOWS, shadow),
    fill: pickOf(FILLS, fill),
    font: pickOf(FONT_NAMES, font),
    density: pickOf(DENSITIES, density),
    pattern: pickOf(PATTERNS, pattern),
    letters: pickOf(LETTERS, letters),
    motion: pickOf(MOTIONS, motion),
  }
  if (
    !parts.accent ||
    !parts.surface ||
    !parts.shadow ||
    !parts.fill ||
    !parts.font ||
    !parts.density ||
    !parts.pattern ||
    !parts.letters ||
    !parts.motion ||
    !(r >= 0 && r <= 28) ||
    !(b >= 0 && b <= 4)
  )
    return null
  return {
    brand: brand === "-" ? null : hex(brand),
    accent: parts.accent,
    surface: parts.surface,
    radius: Math.round(r),
    border: Math.round(b),
    shadow: parts.shadow,
    fill: parts.fill,
    font: parts.font,
    density: parts.density,
    pattern: parts.pattern,
    letters: parts.letters,
    motion: parts.motion,
  }
}

export const sameLook = (a: Look, b: Look) =>
  (Object.keys(a) as (keyof Look)[]).every((k) => a[k] === b[k])
