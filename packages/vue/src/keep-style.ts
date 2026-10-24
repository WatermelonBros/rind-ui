import { type Directive, normalizeStyle, type VNode, withDirectives } from "vue"

type Declarations = Record<string, string>
type Props = Record<string | symbol, unknown>

/** A declaration's property name: camelCase keys (`flexDirection`) hyphenated, custom properties kept. */
const property = (key: string) =>
  key.startsWith("--") ? key : key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)

const declarations = (style: unknown): Declarations => {
  const out: Declarations = {}
  const normalized = normalizeStyle(style as never)
  if (typeof normalized !== "object" || normalized === null) return out
  for (const [k, v] of Object.entries(normalized)) {
    if (v !== undefined && v !== null && v !== "") out[property(k)] = String(v)
  }
  return out
}

const applied = new WeakMap<Element, Declarations>()

/** Writes only the declarations that changed since the last write (as React does). */
function write(el: HTMLElement, [rendered, next]: readonly [Declarations, Declarations]) {
  // A new element was rendered with the first style.
  const prev = applied.get(el) ?? rendered
  for (const k of Object.keys(prev)) if (!(k in next)) el.style.removeProperty(k)
  for (const [k, v] of Object.entries(next)) if (prev[k] !== v) el.style.setProperty(k, v)
  applied.set(el, next)
}
const diff: Directive<HTMLElement, readonly [Declarations, Declarations]> = {
  mounted: (el, { value }) => write(el, value),
  updated: (el, { value }) => write(el, value),
}

/**
 * For a part whose element the DOM layer also styles (positioning, scroll lock): Vue's patch
 * re-applies every key of a new style object, overwriting what those modules wrote. The
 * element keeps the style object of its first render (the server's too), and later changes
 * are applied key by key. Call in setup; wrap the part's vnode on every render.
 */
export function keepStyle() {
  let first: { style: unknown } | null = null
  return (props: Props, render: (props: Props) => VNode) => {
    first ??= { style: props["style"] }
    const vnode = render({ ...props, style: first.style })
    return withDirectives(vnode, [
      [diff, [declarations(first.style), declarations(props["style"])]],
    ])
  }
}
