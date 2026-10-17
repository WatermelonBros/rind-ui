---
"@rind-ui/core": minor
"@rind-ui/react": minor
"@rind-ui/testing": minor
"@rind-ui/theme": minor
---

**Breaking (unreleased; a minor bump while on 0.x).** Add Color Picker, the one colour component. A trigger and a popover, or an inline panel (`inline`), holding the parts you choose: `Area` (two channels as a 2D surface, keyboard and pointer), `ChannelSlider` (one channel on a Slider), `ChannelInput` (a hex or CSS field, or a number field per channel), `SwatchGroup` / `SwatchTrigger` / `SwatchIndicator` (a palette with one centred selected mark: a ringed dot, or your glyph), `Swatch` / `ValueSwatch`, `EyeDropperTrigger` (where the browser has one), `FormatSelect` / `FormatTrigger` / `View`, `ValueText` and form participation. The popover is positioned next to its control. There are no standalone Color Area, Color Slider, Color Field, Color Channel Field, Color Swatch or Color Swatch Picker exports: they are the picker's parts (their machines live in the internal `@rind-ui/core/internal` entry, not public API). `@rind-ui/core` exports the colour model (`Color`, `parseColor`, `formatColor`, channels, names); `@rind-ui/testing` exports `getColorPicker` with its parts' drivers (`area`, `slider`, `input`, `swatches`, `swatch`). `pointer-drag` gains a 2D mode; Field gains `FieldControlBoundary`. Stylesheets for every part, with a checkerboard for transparency.
