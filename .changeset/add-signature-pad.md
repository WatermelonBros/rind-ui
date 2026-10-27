---
"@rind-ui/core": minor
"@rind-ui/react": minor
"@rind-ui/vue": minor
"@rind-ui/svelte": minor
"@rind-ui/solid": minor
"@rind-ui/angular": minor
"@rind-ui/testing": minor
"@rind-ui/theme": minor
---

Signature Pad: sign with a mouse, a pen or a finger. The value is stroke data rendered as SVG in the text colour, so it never clears or misaligns on a resize, a zoom or a high-DPI screen; one pointer owns a stroke; every way a stroke can end is handled. It submits with its form (an SVG data URL, or JSON), `required` validates, Clear and Undo stay focusable and announce. `toBlob` / `download` rasterise at the stroke size. Core: `startStroke` (dom/stroke-input) and `rasterizeSvg` (dom/svg-raster). Testing: `getSignaturePad`, and a `pointerId` option on `Part.pointer` for a second finger. Theme: `signature-pad.css` (family `field`).
