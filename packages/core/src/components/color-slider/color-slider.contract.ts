// The Color Slider's contract (spec "Contract"): the Slider's, plus the colour queries and
// `setChannel`; its invariants are the Slider's plus the binding's.

import { contract, type Invariant } from "../../contract/contract"
import type { Env } from "../../contract/env"
import { COLOR_PICKER_SCOPE, channelSliderNaming } from "../color-picker/color-picker.naming"
import { cssColorOf } from "../color-swatch/color-swatch.contract"
import type { ColorFormat } from "../shared/color/color"
import { formatColor } from "../shared/color/format"
import { parseColor } from "../shared/color/parse"
import { sliderContract, sliderInvariants } from "../slider/slider.contract"

type P = (typeof sliderContract.anatomy)[number]

const styleVar = (style: string | null, name: string) =>
  new RegExp(`${name}:\\s*([^;]+)`).exec(style ?? "")?.[1]?.trim() ?? ""

const gradient = async (env: Env<P>) =>
  styleVar(await env.part("track").attr("style"), "--rind-color-slider-gradient")

/** The binding's invariants (spec "Contract"). */
export const colorSliderInvariants: readonly Invariant<P, string>[] = [
  {
    name: "color-slider-gradient",
    check: async ({ env }) => {
      const style = (await env.part("track").attr("style")) ?? ""
      const g = styleVar(style, "--rind-color-slider-gradient")
      const image = styleVar(style, "background-image")
      if (!g.startsWith("linear-gradient(")) return `the track has no gradient: ${style}`
      // Not compared as strings: a CSSOM may reserialise the colours of one of the two.
      if (!image.startsWith("linear-gradient(")) return `the track paints no gradient: ${style}`
      if (g.includes("NaN")) return `the gradient contains NaN: ${g}`
      return undefined
    },
  },
  {
    name: "color-slider-value-text-names-channel",
    check: async ({ env }) => {
      const channel = (await env.part("root").attr("data-channel")) ?? ""
      const text = (
        (await env.part("hidden-input").nth(0).attr("aria-valuetext")) ?? ""
      ).toLowerCase()
      return text.includes(channel.toLowerCase())
        ? undefined
        : `aria-valuetext "${text}" does not name the ${channel} channel`
    },
  },
]

/**
 * `getColorSlider`'s contract: a Slider with the colour queries (the driver adds `setChannel`
 * as `setValue(0, value)`).
 */
export const colorSliderContract = contract(COLOR_PICKER_SCOPE, {
  ...sliderContract,
  partName: channelSliderNaming.part,
  queries: {
    ...sliderContract.queries,
    channel: async (env) => (await env.part("root").attr("data-channel")) ?? "",
    color: async (env, format: ColorFormat = "hex") =>
      formatColor(parseColor(await cssColorOf(await env.part("root").attr("style"))), format),
    colorName: async (env) => {
      const text = (await env.part("hidden-input").nth(0).attr("aria-valuetext")) ?? ""
      const i = text.indexOf(", ")
      return i < 0 ? "" : text.slice(i + 2)
    },
    gradient,
  },
  invariants: [...sliderInvariants, ...colorSliderInvariants],
})
