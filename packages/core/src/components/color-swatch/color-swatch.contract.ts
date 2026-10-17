import { staticContract } from "../../contract/contract"
import type { ColorFormat } from "../shared/color/color"
import { formatColor } from "../shared/color/format"
import { parseColor } from "../shared/color/parse"

/** The colour a swatch-like part shows, from its `--rind-color` variable. */
export async function cssColorOf(style: string | null): Promise<string> {
  return /--rind-color:\s*([^;]+)/.exec(style ?? "")?.[1]?.trim() ?? ""
}

/** Color Swatch's contract (spec "Contract"): located by role `img` and name; no actions. */
export const colorSwatchContract = staticContract("color-swatch", {
  anatomy: ["root", "transparency-grid"],
  locate: ({ name }: { readonly name: string | RegExp }) => ({ role: "img", name }),
  actions: {},
  queries: {
    color: async (env, format: ColorFormat = "hex") =>
      formatColor(parseColor(await cssColorOf(await env.part("root").attr("style"))), format),
    colorName: async (env) => (await env.part("root").attr("aria-label")) ?? "",
    isTransparent: async (env) => (await env.part("root").attr("data-transparent")) !== null,
  },
  traits: [],
})
