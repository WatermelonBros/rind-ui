import { type Accessor, createRenderEffect, createSignal } from "solid-js"
import { composeRefs } from "./merge-props"

type Props = Record<string | symbol, unknown>
type Declarations = Record<string, string>

/** A declaration's property name: camelCase keys hyphenated, custom properties kept. */
const property = (key: string) =>
  key.startsWith("--") ? key : key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)

let scratch: HTMLElement | undefined
const declarations = (style: unknown): Declarations => {
  const out: Declarations = {}
  if (typeof style === "string") {
    scratch ??= document.createElement("div")
    scratch.style.cssText = style
    for (let i = 0; i < scratch.style.length; i++) {
      const name = scratch.style.item(i)
      out[name] = scratch.style.getPropertyValue(name)
    }
    return out
  }
  if (typeof style !== "object" || style === null) return out
  for (const [k, v] of Object.entries(style)) {
    if (v !== undefined && v !== null && v !== "") out[property(k)] = String(v)
  }
  return out
}

/**
 * For a part whose element the DOM layer also styles (positioning, scroll lock): Solid's
 * `style` update rewrites every key it is given, overwriting what those modules wrote. The
 * returned props carry no `style` on the client; the style declarations are written key by key
 * (only those that changed) from an effect. On the server the props keep their `style`, so the
 * HTML has it. Call in the part's body; spread the returned props.
 */
export function keepStyle(props: Accessor<Props>): Accessor<Props> {
  if (typeof document === "undefined") return props
  const [el, setEl] = createSignal<HTMLElement | null>(null)
  let applied: Declarations = {}
  let target: HTMLElement | null = null
  createRenderEffect(() => {
    const node = el()
    if (!node) return
    if (node !== target) {
      target = node
      applied = {}
    }
    const next = declarations(props()["style"])
    for (const k of Object.keys(applied)) if (!(k in next)) node.style.removeProperty(k)
    for (const [k, v] of Object.entries(next)) if (applied[k] !== v) node.style.setProperty(k, v)
    applied = next
  })
  return () => {
    const { style: _style, ...rest } = props()
    return { ...rest, ref: composeRefs(rest["ref"], (node: Element) => setEl(node as HTMLElement)) }
  }
}
