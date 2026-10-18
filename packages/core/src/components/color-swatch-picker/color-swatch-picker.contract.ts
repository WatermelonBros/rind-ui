// The Color Swatch Picker's contract (spec "Contract"): Radio Group's, located by role
// `radiogroup` and name, plus the colour queries and `pick` / `move`.

import { contract } from "../../contract/contract"
import type { Env, Part } from "../../contract/env"
import { COLOR_PICKER_SCOPE, swatchGroupPart } from "../color-picker/color-picker.naming"
import { cssColorOf } from "../color-swatch/color-swatch.contract"
import { radioGroupContract } from "../radio-group/radio-group.contract"
import type { ColorFormat } from "../shared/color/color"
import { formatColor } from "../shared/color/format"
import { parseColor } from "../shared/color/parse"

type P = (typeof radioGroupContract.anatomy)[number]

const controls = (env: Env<P>) => env.part("item-control").all()

async function selected(env: Env<P>) {
  for (const control of await controls(env)) {
    if ((await control.attr("aria-checked")) === "true") {
      return {
        key: (await control.attr("data-value")) ?? "",
        name: await control.accessibleName(),
        color: await cssColorOf(await control.attr("style")),
      }
    }
  }
  return null
}

/** `pick`'s target: a key, an accessible name or an index. */
async function controlOf(env: Env<P>, target: string | number): Promise<Part | null> {
  const all = await controls(env)
  if (typeof target === "number") return all[target] ?? null
  for (const c of all) {
    if ((await c.attr("data-value")) === target || (await c.accessibleName()) === target) return c
  }
  return null
}

export const colorSwatchPickerContract = contract(COLOR_PICKER_SCOPE, {
  ...radioGroupContract,
  partName: swatchGroupPart,
  queries: {
    ...radioGroupContract.queries,
    colors: async (env) => {
      const out: string[] = []
      for (const c of await controls(env)) out.push(await cssColorOf(await c.attr("style")))
      return out
    },
    selected,
    selectedColor: async (env, format: ColorFormat = "hex") => {
      const s = await selected(env)
      return s ? formatColor(parseColor(s.color), format) : null
    },
  },
})

/** `pick(key | name | index)`: presses that swatch (driver helper; no machine event). */
export async function pickSwatch(env: Env<string>, target: string | number) {
  const control = await controlOf(env as Env<P>, target)
  if (!control) throw new Error(`pick: no swatch matches ${JSON.stringify(target)}`)
  await control.click()
}
