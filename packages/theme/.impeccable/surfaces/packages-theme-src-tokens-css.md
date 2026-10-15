---
version: 1
slug: "packages-theme-src-tokens-css"
primary_target: "packages/theme/src/tokens.css"
related_targets: []
---

# Surface brief — @rind-ui/theme default look

Scope: the default visual system of @rind-ui/theme (tokens, presets, component stylesheets, Storybook presentation). Mode: Operate. Audience: developers adopting rind-ui as-is, white-label teams re-skinning it, evaluators on the docs site. User feel: "neutra ma curatissima"; avoid shadcn-clone, flatness, second-class dark.

## Direction contract

THESIS: Components as the controls of a functional hi-fi console: quiet anodised neutrals, keys you can feel, and one signal colour reserved for what is live or primary. Refuses the category default of flat white cards, 1px grey borders and a blue primary.

OWN-WORLD: Satin aluminium neutrals (cool, near-zero chroma) in light; anodised graphite in dark, equally first-class. Signal orange as the default accent with near-black legends on it. Keys are slightly raised: a top highlight, a crisp bottom edge, a short soft shadow; pressing sinks them. Hanken Grotesk throughout, small engraved-label style for h6/labels (uppercase, tracked), tabular figures for numbers. Radii small (keys ~6px, panels ~10px). One 4px construction unit.

STORY: A developer drops in the theme and their app looks deliberate on first render: primary actions read as the one lit key, secondary controls are quiet satin keys, every state is legible in light, dark and forced colours.

FIRST VIEWPORT: Storybook Theme/Showcase: a console panel on the page ground — engraved section label, heading, a row of keys (primary signal key, satin secondary, outline, ghost), links inline in body copy, all three sizes, tones; the same panel in dark beside it.

FORM: Console Hi-Fi (Braun-school functional audio), Impeccable's pick, chosen by the user over the rolled Drafting Set; seed key d74da1d4. Signature interaction: the key press — highlight flips to an inset, key sinks 1px, shadow collapses, in 90ms.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
