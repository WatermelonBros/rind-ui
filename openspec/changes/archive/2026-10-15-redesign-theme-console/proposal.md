# Redesign the default theme: Console Hi-Fi

## Why

The user judged the first theme's look unacceptable: wrong proportions, unattractive
colours, generic and anonymous, weak typography. The theme must look polished as-is
(it is the first thing evaluators see on the docs site and in Storybook) while staying a
re-skinnable white-label base. Direction chosen by the user with the Impeccable
workflow: **Console Hi-Fi** — functional audio equipment: satin aluminium and anodised
graphite neutrals, keys you can feel, one signal colour for what is primary or live.

## What Changes

- New preset values for `calm` (signal orange on satin aluminium) and `crisp` (cobalt on
  graphite, compact); names and the builder API are unchanged.
- Bundled default face: Hanken Grotesk (variable, SIL OFL), self-hosted in
  `@rind-ui/theme/fonts.css`, imported by the main entry; tabular figures on theme scopes.
- Derivation constants: neutral surface/text lightness, softer tint lightness and chroma,
  darker palette text in light; scales (control heights 28/32/40 px at density 1),
  durations 90/180/280 ms.
- New tier-2 tokens: `--rind-shadow-key`, `--rind-shadow-key-pressed` (raised keys and
  their pressed state), `--rind-tracking-tight`, `--rind-tracking-label`; new values for
  `--rind-shadow-sm|lg`.
- Component stylesheets: Button as a console key (lit edge, contact edge, sinks 1px on
  press; ghost flush), Link with a fine offset underline, Heading with tightened display
  tracking and level 6 as an engraved uppercase label; base surfaces themed (selection,
  caret, accent-color, scrollbars).
- Storybook `Theme/Showcase` story: the system in light and dark side by side.

## Impact

- Specs: theme-presets (preset table, bundled face), design-tokens (scales, new tokens).
- Code: packages/theme (tokens, presets, builder derive/scales, component CSS, fonts),
  apps/storybook (Showcase story), value-locked theme tests updated.
- No component behaviour changes. Token names unchanged; only values and new tokens.
