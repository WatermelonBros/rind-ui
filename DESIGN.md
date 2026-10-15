---
name: rind-ui theme
description: Console Hi-Fi, the white-label default look of @rind-ui/theme. Satin neutrals, keys you can feel, one signal colour.
colors:
  signal-orange: "oklch(0.67 0.165 42)"
  signal-orange-hover: "oklch(0.72 0.165 42)"
  signal-legend: "oklch(0.18 0 42)"
  signal-orange-tint: "oklch(0.93 0.0375 42)"
  signal-orange-tint-dark: "oklch(0.29 0.07 42)"
  signal-orange-text: "oklch(0.46 0.1388 42)"
  signal-orange-text-dark: "oklch(0.78 0.1346 42)"
  petrol: "oklch(0.5 0.09 215)"
  satin-ground: "oklch(0.968 0.006 250)"
  satin-faceplate: "oklch(0.94 0.006 250)"
  satin-key: "oklch(0.993 0.0034 250)"
  satin-ink: "oklch(0.2 0.006 250)"
  satin-ink-muted: "oklch(0.47 0.006 250)"
  satin-ink-disabled: "oklch(0.64 0.006 250)"
  satin-edge: "oklch(0.83 0.006 250)"
  satin-edge-strong: "oklch(0.58 0.006 250)"
  graphite-ground: "oklch(0.185 0.006 250)"
  graphite-faceplate: "oklch(0.215 0.006 250)"
  graphite-key: "oklch(0.25 0.006 250)"
  graphite-ink: "oklch(0.93 0.006 250)"
  graphite-ink-muted: "oklch(0.71 0.006 250)"
  graphite-edge: "oklch(0.375 0.006 250)"
  aluminium-neutral: "oklch(0.4 0.006 250)"
  danger-red: "oklch(0.53 0.19 22)"
  warning-amber: "oklch(0.83 0.16 90)"
  success-green: "oklch(0.62 0.14 155)"
typography:
  display:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: 640
    lineHeight: 1.1
    letterSpacing: "-0.024em"
  headline:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.625rem"
    fontWeight: 620
    lineHeight: 1.2
    letterSpacing: "-0.018em"
  title:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title-small:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 590
    lineHeight: 1.2
    letterSpacing: "-0.005em"
  subtitle:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 580
    lineHeight: 1.5
  body:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "tnum"
  key-legend:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 560
    lineHeight: 1
    letterSpacing: "-0.005em"
  label:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 650
    lineHeight: 1.5
    letterSpacing: "0.07em"
  mono:
    fontFamily: "ui-monospace, SF Mono, Menlo, Consolas, Liberation Mono, monospace"
    fontSize: "0.875rem"
rounded:
  sm: "0.1875rem"
  md: "0.375rem"
  lg: "0.5625rem"
  full: "9999px"
spacing:
  "1": "0.25rem"
  "2": "0.5rem"
  "3": "0.75rem"
  "4": "1rem"
  "6": "1.5rem"
  "8": "2rem"
components:
  button-solid:
    backgroundColor: "{colors.signal-orange}"
    textColor: "{colors.signal-legend}"
    typography: "{typography.key-legend}"
    rounded: "{rounded.md}"
    padding: "0 0.75rem"
    height: "2rem"
  button-solid-hover:
    backgroundColor: "{colors.signal-orange-hover}"
  button-soft:
    backgroundColor: "{colors.signal-orange-tint}"
    textColor: "{colors.signal-orange-text}"
    rounded: "{rounded.md}"
    height: "2rem"
  button-outline:
    backgroundColor: "{colors.satin-key}"
    textColor: "{colors.signal-orange-text}"
    rounded: "{rounded.md}"
    height: "2rem"
  button-outline-hover:
    backgroundColor: "{colors.satin-faceplate}"
  button-ghost:
    textColor: "{colors.signal-orange-text}"
    rounded: "{rounded.md}"
    height: "2rem"
  button-ghost-hover:
    backgroundColor: "{colors.signal-orange-tint}"
  button-disabled:
    backgroundColor: "{colors.satin-faceplate}"
    textColor: "{colors.satin-ink-disabled}"
  button-sm:
    height: "1.75rem"
    padding: "0 0.5rem"
  button-lg:
    height: "2.5rem"
    padding: "0 1rem"
  link:
    textColor: "{colors.signal-orange-text}"
    rounded: "{rounded.sm}"
  panel:
    backgroundColor: "{colors.satin-faceplate}"
    textColor: "{colors.satin-ink}"
    rounded: "{rounded.lg}"
    padding: "clamp(1.5rem, 5vw, 2rem)"
---

# Design System: rind-ui theme

## Overview

**Creative North Star: "Console Hi-Fi"**

Components are the controls of a functional hi-fi console, in the Braun school: quiet anodised neutrals, keys you can feel, and one signal colour reserved for what is live or primary. A developer drops the theme in and the app looks deliberate on first render: the primary action reads as the one lit key, secondary controls are quiet satin keys, and every state is legible in light, dark and forced colours.

The system is white-label by construction. Twelve brand inputs (five colours, two font stacks, font size, radius, density, motion, border strength) derive every semantic token in CSS through OKLCH relative colour inside `light-dark()`, and the typed builder (`defineTheme`) runs the same derivation in TypeScript, gamut-maps it and validates WCAG contrast. Everything below is the **calm** preset (the default on `:root`) unless it says **crisp**; the rules hold for any brand, because they live in the derivation, not in the values.

Density is compact (14px body, 32px default key) because the first consumer is an IDE used for long sessions. The refusal is the category default: flat white cards, 1px grey borders and a blue primary.

**Key Characteristics:**
- Satin aluminium neutrals in light, anodised graphite in dark; both first-class, same derivation.
- One signal key: the accent solid is the only saturated fill on a screen at rest.
- Keys are physical: lit top edge, contact edge, short shadow; pressing sinks them 1px.
- Hanken Grotesk throughout, tabular figures everywhere, an engraved uppercase label at level 6.
- Panels are faceplates set into the page, not cards floating over it.

## Colors

Near-zero-chroma cool neutrals carrying one warm signal; tones (neutral, danger, warning, success) re-point the accent roles instead of adding new colours.

### Primary
- **Signal Orange** (calm accent input): the solid key, the focus ring (via accent border), caret, native checks. Hover moves a step away from its legend colour (lighter here, because the legend is near-black).
- **Signal Legend**: near-black legend on the orange key. The derivation picks white legends below L 0.6 and near-black from L 0.6 up; the builder then checks real luminance.
- **Signal Orange Text / Tint**: the accent clamped to L ≤ 0.46 (light) or ≥ 0.78 (dark) for text-size legibility on outline/ghost keys and links; tints at L 0.93 / 0.29 for soft keys and selection.
- **Petrol** (crisp accent input): the crisp preset's signal key, darker than L 0.6 so it takes white legends and its hover goes darker.

### Neutral
- **Satin Ground / Graphite Ground**: the page background of every non-portal theme scope.
- **Satin Faceplate / Graphite Faceplate**: panels, disabled keys, outline-key hover.
- **Satin Key / Graphite Key**: the raised-surface tone, the body of outline keys.
- **Satin Ink / Muted / Disabled**: text, secondary text and h5/h6, disabled legends.
- **Satin Edge / Edge Strong**: borders; the faint edge moves toward the strong one by the border-strength input (calm 0.3, crisp 0.6).

### Tones
- **Danger Red, Warning Amber, Success Green**, plus the neutral palette, each derive the same seven roles as the accent (solid, solid-hover, on-solid, soft, soft-hover, text, border). `data-tone` swaps them into the accent slots.

### Named Rules
**The One Lit Key Rule.** A component reads accent roles only. Recolour it with `data-tone`, never by pointing it at a palette token directly.

**The Derived Neutral Rule.** Neutrals take only hue and chroma from the brand neutral (chroma capped at 0.03, zeroed below 0.005); their lightness is fixed per role and per scheme. A brand never moves the ground or ink lightness, so contrast survives every re-skin.

**The Fixed Lightness Rule.** Soft tints sit at L 0.93 / 0.895 (light) and 0.29 / 0.33 (dark), chroma capped at 0.045 light and 0.07 dark (a capped dark tint reads as mud). Text roles clamp to L 0.46 / 0.78; border roles to 0.6 / 0.62.

## Typography

**Display Font:** Hanken Grotesk (variable 100–900, shipped in `fonts.css`, OFL), with ui-sans-serif, system-ui fallbacks
**Body Font:** Hanken Grotesk
**Label/Mono Font:** ui-monospace stack for code

**Character:** One grotesk with fine weight steps (560 to 650) instead of a pairing; large sizes close up, the small label opens up.

### Hierarchy
All sizes are multiples of the font-size input (calm 0.875rem, crisp 0.8125rem), so the browser's text size and the brand both scale them. The look follows `data-level`, not the tag.
- **Display / h1** (640, ×2.2857, 1.1, −0.024em)
- **Headline / h2** (620, ×1.8571, 1.2, −0.018em)
- **Title / h3** (600, ×1.4286, 1.2, −0.01em)
- **Title small / h4** (590, ×1.2143, 1.2, −0.005em)
- **Subtitle / h5** (580, ×1, 1.5, muted ink)
- **Label / h6** (650, ×0.8571, 1.5, +0.07em, uppercase, muted ink): the engraved panel label.
- **Body** (400, ×1, 1.5); prose capped near 60ch.
- **Key legend** (560, control text size, line-height 1, −0.005em).

### Named Rules
**The Tabular Rule.** Every theme scope sets `font-variant-numeric: tabular-nums`; numbers line up in every component. Slashed zero stays off.

**The Engraved Label Rule.** The uppercase tracked label names a panel or a control group, like the engraving above a row of console keys. It never sits above a heading as a kicker.

## Layout

One construction unit of 4px, scaled by the density input (calm 1, crisp 0.875): spacing steps 1, 2, 3, 4, 6, 8 (4 to 32px). Control heights are 28 / 32 / 40px (sm / md / lg), each floored at 24px whatever the density (WCAG 2.5.8); `data-size` sets the control height, text size and inline padding that descendants inherit. Pressable parts smaller than `--rind-hit-area` (24px) get an invisible centred hit area. Within a panel, groups stack on the 24px step, a key row gaps 8px, and key rows are equal columns (`minmax(min(100%, 7rem), 1fr)`) that halve on a phone rather than strand one key.

## Elevation & Depth

Depth belongs to keys, not to containers. Raised keys carry a three-part shadow: a lit inset top edge, a dark inset contact edge and a short 1–2px drop shadow; every layer is a `light-dark()` pair, heavier in dark. Panels are flat and set in: a 1px edge on the faceplate tone, no lift.

### Shadow Vocabulary
- **Key** (`--rind-shadow-key`): resting solid, soft and outline keys.
- **Key pressed** (`--rind-shadow-key-pressed`): the light edge turns into an inset 1px 2px shade.
- **Small / Large** (`--rind-shadow-sm`, `--rind-shadow-lg`): declared for floating layers (overlays, popovers); no shipped component uses them yet.

### Named Rules
**The Key Sinks Rule.** Pressing translates the key 0 1px and swaps to the pressed shadow. Only `translate` transitions (90ms × motion, ease-out); colours never transition, so a scheme change never fades.

**The Faceplate Rule.** Containers sit in the page: surface tone plus a 1px border, no drop shadow. Lift is reserved for things that actually float.

## Shapes

Small, controlled radii from the radius input: sm ×0.5 (indicators, link focus), md ×1 (keys, controls), lg ×1.5 (panels), full for pilot lights. Calm: 3 / 6 / 9px; crisp: 2 / 4 / 6px. Every key carries a 1px border, transparent unless drawn, so forced colours can paint it.

## Components

### Buttons
A console key. Variants via `data-variant`, tone via `data-tone`, size via `data-size`.
- **Shape:** gently squared (radius md), 1px border always present.
- **Solid:** the lit key: accent solid with its on-solid legend, key shadow.
- **Soft:** a satin key in the accent tint, accent text legend, key shadow.
- **Outline:** a neutral satin key (raised surface) with an accent legend and drawn edge; hover drops to the faceplate tone and firms the edge.
- **Ghost:** flush with the panel, no shadow; hover fills with the accent tint.
- **Pressed:** sinks 1px, pressed shadow.
- **Pending (pilot light):** a 6px round light in the key's top-end corner, inset 5px, painted in the full legend colour (on-solid for solid, accent text otherwise) while the legend dims to 70%. It blinks by stepped opacity (1 → 0.4, 1s, `steps(2)`), stays lit under reduced motion and paints as Highlight in forced colours. The key keeps its look and position.
- **Disabled:** an unlit, recessed blank key: faceplate fill, disabled ink, border, no shadow, no travel; ghost stays transparent.

### Links
Underlined by default (not colour alone, WCAG 1.4.1): a fine 0.075em rule offset 0.22em, at 45% of the link colour, firming to full on hover. Current page is weight 600 with a full underline; disabled drops the underline. Inherits the surrounding font.

### Headings
Typography tokens only (see Hierarchy); `text-wrap: balance`, no margin. Every level is overridable per level through `--rind-heading-<n>-*`.

### Panels (Showcase)
The faceplate: surface tone, 1px border, radius lg, padding clamp(24px, 5vw, 32px), groups on the 24px step separated by 1px rules.

### Focus, forced colours, preferences
Focus is a 2px solid outline offset 2px in the accent border colour (a tone re-points it), shown only for keyboard focus. In forced colours, states also get a non-colour outline pattern: highlighted dashed, selected/checked double, disabled dotted, focus solid Highlight; keys paint ButtonFace/ButtonText. `prefers-contrast: more` makes muted text full ink and borders strong; reduced motion zeroes durations. The `rind.preferences` layer wins over every theme.

## Do's and Don'ts

### Do:
- **Do** derive a brand from the twelve inputs (`defineTheme`), and let the builder validate contrast in both schemes.
- **Do** reserve the solid accent key for the one primary action per group; use soft, outline and ghost for the rest.
- **Do** give every new raised control `--rind-shadow-key` and the 1px sink on press.
- **Do** read only tier-2 tokens with a tier-3 `--rind-<scope>-*` fallback in component stylesheets; select only on `data-scope` / `data-part` / state attributes.
- **Do** give every state a non-colour cue in forced colours.

### Don't:
- **Don't** transition colours or shadows; only the key's travel animates.
- **Don't** put a drop shadow on a panel or card that sits in the page.
- **Don't** hard-code a palette colour in a component; tones work by re-pointing accent roles.
- **Don't** set uppercase tracked text above a heading as a kicker.
- **Don't** let a scheme be second-class: every colour token is a `light-dark()` pair from the same derivation.
