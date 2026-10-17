---
"@rind-ui/react": patch
---

Color Picker: the popover is positioned next to its control again. `ColorPicker.Control` no longer replaces the Popover anchor's id, which the Popover uses to find its anchor.

Color Slider: a channel value off the Slider's step grid (a hex colour's hue, 215.88) is snapped for the Slider instead of logging a development warning; the colour keeps full precision.
