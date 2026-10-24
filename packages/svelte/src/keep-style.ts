import { createAttachmentKey } from "svelte/attachments"

type Declarations = Record<string, string>

// ponytail: splits on `;` and the first `:`; a value holding `;` (a data: URL) would break it.
const declarations = (style: unknown): Declarations => {
  const out: Declarations = {}
  if (typeof style !== "string") return out
  for (const part of style.split(";")) {
    const at = part.indexOf(":")
    if (at < 0) continue
    const key = part.slice(0, at).trim()
    const value = part.slice(at + 1).trim()
    if (key && value) out[key] = value
  }
  return out
}

const applied = new WeakMap<Element, Declarations>()

/**
 * For a part whose element the DOM layer also styles (positioning, scroll lock): Svelte
 * rewrites the whole `style` attribute when the string changes, wiping what those modules
 * wrote. The element keeps the style string of its first render (the server's too), and later
 * changes are applied key by key (as React does). Call during initialisation; pass the part's
 * props through it on every update.
 */
export function keepStyle() {
  let first: { style: unknown } | null = null
  const key = createAttachmentKey()
  return (props: Record<string | symbol, unknown>): Record<string | symbol, unknown> => {
    first ??= { style: props["style"] }
    const next = declarations(props["style"])
    return {
      ...props,
      style: first.style,
      [key]: (node: Element) => {
        if (!(node instanceof HTMLElement)) return
        // A new element was rendered with the first style.
        const prev = applied.get(node) ?? declarations(first?.style)
        for (const k of Object.keys(prev)) if (!(k in next)) node.style.removeProperty(k)
        for (const [k, v] of Object.entries(next)) if (prev[k] !== v) node.style.setProperty(k, v)
        applied.set(node, next)
      },
    }
  }
}
