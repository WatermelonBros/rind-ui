/// <reference types="node" />
// Shared by the Playwright files here: the theme CSS as text and one browser per engine.
import { readFileSync } from "node:fs"
import { type Browser, chromium, firefox, webkit } from "playwright"

export type Engine = "chromium" | "firefox" | "webkit"
/** Chromium locally; CI sets RIND_BROWSERS=chromium,firefox,webkit (as vitest.config.ts). */
export const engines = (process.env["RIND_BROWSERS"] ?? "chromium").split(",") as Engine[]
export const launch = (engine: Engine): Promise<Browser> =>
  ({ chromium, firefox, webkit })[engine].launch()

const read = (file: string) => readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8")
/** index.css with each @import inlined, so the page needs no second request. */
export const indexCss = read("index.css").replace(/@import "\.\/(.+?)";/g, (_, f: string) =>
  read(f),
)

/** The computed colour of `property: var(token)` on a probe inside `selector`, in the page. */
export const probe = (selector: string, token: string, property = "color") => `(() => {
  const host = document.querySelector(${JSON.stringify(selector)})
  const el = document.createElement("span")
  el.style.setProperty(${JSON.stringify(property)}, "var(${token})")
  host.append(el)
  const value = getComputedStyle(el).getPropertyValue(${JSON.stringify(property)})
  el.remove()
  return value
})()`
