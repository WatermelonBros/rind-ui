---
"@rind-ui/react": minor
"@rind-ui/testing": minor
"@rind-ui/theme": patch
---

Color Picker is the one colour component. `ColorArea`, `ColorSlider`, `ColorSwatch`, `ColorField`, `ColorChannelField` and `ColorSwatchPicker` are no longer exported from `@rind-ui/react`, nor their drivers from `@rind-ui/testing` (they were never released): use `ColorPicker`'s parts (`Area`, `ChannelSlider`, `ChannelInput`, `SwatchGroup`, `Swatch`), inline for a picker without a popover, and `getColorPicker`'s part drivers (`area`, `slider`, `input`, `swatches`, and the new `swatch`). A checked swatch shows one centred mark: an empty `SwatchIndicator` is a ringed dot, and a glyph inside it replaces the dot.
