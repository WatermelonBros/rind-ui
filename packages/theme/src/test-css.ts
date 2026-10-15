/// <reference types="vite/client" />
// Browser-test support: the theme CSS as strings (index.css inlined file by file, because an
// @import inside an injected <style> would be fetched relative to the test page) plus probes
// that read what the browser really computes. Test support only.
import base from "./base.css?inline"
import icons from "./icons.css?inline"
import overlay from "./overlay.css?inline"
import positioner from "./positioner.css?inline"
import calm from "./presets/calm.css?inline"
import crisp from "./presets/crisp.css?inline"
import tokens from "./tokens.css?inline"
import variants from "./variants.css?inline"

export const files = { tokens, calm, crisp, base, variants, icons, overlay, positioner }

const statement = "@layer rind.tokens, rind.themes, rind.components, rind.preferences;"
/** What `import "@rind-ui/theme"` loads (index.css order). */
export const indexCss = [statement, tokens, calm, base, variants, icons, overlay, positioner].join(
  "\n",
)

const styles: HTMLStyleElement[] = []
const hosts: HTMLElement[] = []

/** Appends a stylesheet to the page; `cleanup()` removes everything this module added. */
export function inject(text: string): CSSStyleSheet {
  const style = document.createElement("style")
  style.textContent = text
  document.head.append(style)
  styles.push(style)
  return style.sheet as CSSStyleSheet
}

/** Renders markup under `body` and returns the wrapper. */
export function mount(html: string): HTMLElement {
  const host = document.createElement("div")
  host.innerHTML = html
  document.body.append(host)
  hosts.push(host)
  return host
}

export function cleanup() {
  for (const s of styles.splice(0)) s.remove()
  for (const h of hosts.splice(0)) h.remove()
  const root = document.documentElement
  for (const a of [...root.attributes]) root.removeAttribute(a.name)
}

export const q = <T extends Element = HTMLElement>(root: ParentNode, selector: string): T => {
  const el = root.querySelector<T>(selector)
  if (!el) throw new Error(`no element for ${selector}`)
  return el
}

/** The computed value of `property` when set to `var(token)` on a probe inside `el`. */
export function resolve(el: Element, property: string, token: string): string {
  const probe = document.createElement("span")
  probe.style.setProperty(property, `var(${token})`)
  probe.style.setProperty("display", "block")
  el.append(probe)
  const value = getComputedStyle(probe).getPropertyValue(property)
  probe.remove()
  return value
}

/** Computed `color` of a colour token as the browser prints it (compare for equality only). */
export const paint = (el: Element, token: string) => resolve(el, "color", token)

export type Rgba = readonly [number, number, number, number]
let canvas: CanvasRenderingContext2D | undefined

/** A colour token as 8-bit sRGB + alpha, through a canvas so every engine's syntax parses. */
export function rgba(el: Element, token: string): Rgba {
  const computed = paint(el, token)
  canvas ??=
    document.createElement("canvas").getContext("2d", { willReadFrequently: true }) ?? undefined
  if (!canvas) throw new Error("no 2d canvas")
  canvas.clearRect(0, 0, 1, 1)
  canvas.fillStyle = "#000"
  canvas.fillStyle = computed
  canvas.fillRect(0, 0, 1, 1)
  const [r = 0, g = 0, b = 0, a = 0] = canvas.getImageData(0, 0, 1, 1).data
  return [r, g, b, a]
}

/** Computed length of a token in px. */
export const lengthOf = (el: Element, token: string, property = "width") =>
  Number.parseFloat(resolve(el, property, token))

/**
 * tokens.css without its `@supports (color: oklch(from red l c h))` block: what an engine that
 * fails the query sees (it skips the block), simulated for engines that pass it.
 */
export function withoutDerivation(text: string): string {
  const start = text.indexOf("@supports (color: oklch(from red l c h))")
  if (start < 0) throw new Error("derivation block not found")
  let depth = 0
  for (let i = text.indexOf("{", start); i < text.length; i++) {
    if (text[i] === "{") depth++
    if (text[i] === "}" && --depth === 0) return text.slice(0, start) + text.slice(i + 1)
  }
  throw new Error("unbalanced derivation block")
}

/** The full theme with `tokens` replaced (index.css order). */
export const indexCssWith = (tokensCss: string) => indexCss.replace(files.tokens, tokensCss)

/** WCAG contrast ratio of two 8-bit sRGB colours. */
export function ratio(a: Rgba, b: Rgba): number {
  const lum = ([r, g, bl]: Rgba) => {
    const f = (v: number) => {
      const c = v / 255
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(bl)
  }
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

/** The computed colour of a CSS colour literal, for comparing with a token's paint. */
export function literal(color: string): string {
  const probe = document.createElement("span")
  probe.style.color = color
  document.body.append(probe)
  const value = getComputedStyle(probe).color
  probe.remove()
  return value
}
