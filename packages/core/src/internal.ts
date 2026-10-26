// The Color Picker's parts (area, channel slider, colour and channel fields, swatch, swatch
// group): their machines, connect functions, contracts and messages. Not public API: the
// framework adapters' Color Picker and the test drivers use them through
// `@rind-ui/core/internal`; only `ColorPicker` is documented and supported.

// The framework adapters' shared, framework-neutral helpers (prop merging, part registry,
// provider config).
export * from "./adapter"
export * from "./components/color-area"
export * from "./components/color-field"
export {
  areaPart,
  COLOR_PICKER_SCOPE,
  channelInputNaming,
  channelSliderNaming,
  colorFieldPart,
  swatchGroupNaming,
  swatchGroupPart,
} from "./components/color-picker/color-picker.naming"
export * from "./components/color-slider"
export * from "./components/color-swatch"
export * from "./components/color-swatch-picker"
// Floating Panel's clamp rules: the adapters preview a drag with them (add-floating-panel §3).
export {
  clampRect,
  type Point,
  type Rect,
  type RectLimits,
  type ResizeAxis,
  resizeRect,
  type Size,
} from "./dom/rect-bounds"
