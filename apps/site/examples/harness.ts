import type { ComponentType } from "react"
import { fixtures } from "./fixtures"
import { exampleComponent, examples } from "./index"

/** The examples harness's skins: `none` is no stylesheet at all. */
export const skins = ["none", "bare", "crisp", "juicy", "theme-calm", "theme-crisp"] as const
export type Skin = (typeof skins)[number]

/** `DisabledItem` → `disabled-item`: an example's segment in a harness URL. */
export const kebab = (name: string) => name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase()

/** The example at `/examples/<slug>/<example>/`, from the docs module or the fixtures. */
export function harnessExample(slug: string, example: string): ComponentType | undefined {
  for (const mod of [examples[slug], fixtures[slug]]) {
    if (!mod) continue
    const name = Object.keys(mod).find((n) => kebab(n) === example)
    const component = name && exampleComponent(mod, name)
    if (component) return component
  }
  return undefined
}
