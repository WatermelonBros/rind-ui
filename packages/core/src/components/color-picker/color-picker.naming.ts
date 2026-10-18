// Every Color Picker part carries `data-scope="color-picker"`: the components its parts are
// built on (the colour area, the Slider, the Number Input and the colour field, the Radio
// Group, the colour swatch) render under the picker's scope with these part names.

import type { PartNaming } from "../../connect/props"
import type { NumberInputPart } from "../number-input/number-input.connect"
import type { RadioGroupPart, RadioNaming, RadioPart } from "../radio-group/radio-group.connect"
import type { SliderPart } from "../slider/slider.connect"

export const COLOR_PICKER_SCOPE = "color-picker"

/** The colour area's parts. */
export const areaPart = (name: "root" | "background" | "thumb" | "input"): string =>
  name === "root" ? "area" : `area-${name}`

/**
 * The channel slider (a Slider): `range` is the Slider's indicator. Its range input is the
 * Slider's form input and keeps `hidden-input`, as every hosted form input does (the form
 * invariants and the hidden-form-input rules find it by that name, per instance).
 */
export const channelSliderNaming: PartNaming<SliderPart> = {
  scope: COLOR_PICKER_SCOPE,
  part: (name) =>
    name === "root"
      ? "channel-slider"
      : name === "indicator"
        ? "channel-slider-range"
        : name === "hidden-input"
          ? "hidden-input"
          : `channel-slider-${name}`,
}

/**
 * A channel or hex input's parts. The hidden form input keeps `hidden-input` (the form
 * invariants and the hidden-form-input rules find it by that name, per instance).
 */
const inputPart = (name: string): string =>
  name === "hidden-input"
    ? "hidden-input"
    : name === "input"
      ? "channel-input"
      : name === "increment-trigger"
        ? "channel-input-increment"
        : name === "decrement-trigger"
          ? "channel-input-decrement"
          : `channel-input-${name}`

/** The channel input (a Number Input). */
export const channelInputNaming: PartNaming<NumberInputPart> = {
  scope: COLOR_PICKER_SCOPE,
  part: inputPart,
}

/** The hex / CSS input (the colour field): the same names as a channel input. */
export const colorFieldPart = (name: string): string => inputPart(name)

/** The swatch group (a Radio Group). */
export const swatchGroupNaming: RadioNaming = {
  scope: COLOR_PICKER_SCOPE,
  control: "swatch-trigger",
  part: (name) =>
    name === "root"
      ? "swatch-group"
      : name === "item"
        ? "swatch-item"
        : name === "hidden-input"
          ? "hidden-input" // the hidden form inputs keep their name (form invariants)
          : name.startsWith("item-")
            ? `swatch-${name.slice(5)}`
            : `swatch-group-${name}`,
}

/** Any Radio Group part's name in the swatch group, the radio control included. */
export const swatchGroupPart = (name: RadioGroupPart | "hidden-input"): string =>
  name === "item-control"
    ? swatchGroupNaming.control
    : (swatchGroupNaming.part?.(name as RadioPart) ?? name)
