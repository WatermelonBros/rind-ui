import { contract } from "../../contract/contract"
import { COLOR_PICKER_SCOPE, channelInputNaming } from "../color-picker/color-picker.naming"
import { cssColorOf } from "../color-swatch/color-swatch.contract"
import { numberInputContract } from "../number-input/number-input.contract"
import type { ColorFormat } from "../shared/color/color"
import { formatColor } from "../shared/color/format"
import { parseColor } from "../shared/color/parse"

/** `getColorChannelField`'s contract: Number Input's, plus the channel and the colour. */
export const colorChannelFieldContract = contract(COLOR_PICKER_SCOPE, {
  ...numberInputContract,
  partName: channelInputNaming.part,
  queries: {
    ...numberInputContract.queries,
    channel: async (env) => (await env.part("root").attr("data-channel")) ?? "",
    color: async (env, format: ColorFormat = "hex") =>
      formatColor(parseColor(await cssColorOf(await env.part("root").attr("style"))), format),
  },
})
