---
"@rind-ui/core": minor
"@rind-ui/react": minor
"@rind-ui/testing": minor
"@rind-ui/theme": minor
---

**Breaking for themes (unreleased; a minor bump while on 0.x).** Every Color Picker part carries `data-scope="color-picker"` with its own part name: `area`, `area-background`, `area-thumb`, `area-input`; `channel-slider`, `channel-slider-label`, `channel-slider-value-text`, `channel-slider-control`, `channel-slider-track`, `channel-slider-thumb`; `channel-input`, `channel-input-root` (with `data-channel`); `swatch-group`, `swatch-item`, `swatch-trigger`, `swatch-indicator`; `swatch`, `value-swatch`, `transparency-grid` (a part's form input keeps `hidden-input`). `data-color-swatch-picker` is gone. The theme's six colour sheets are merged into `color-picker.css`, which styles the channel slider and the inputs itself. Slider, Number Input and Radio Group gain an optional hosted naming (the host's scope and part names; defaults unchanged), contracts an optional `partName` (the test adapters locate parts through it), `Field.Root` an optional `rootPart`, and `sliderStepInvariants` an optional `naming`.
