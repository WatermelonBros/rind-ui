import type { PartProps } from "@rind-ui/core"
import { neutralName } from "@rind-ui/core/internal"
import type { HTMLAttributes } from "svelte/elements"

/** A declaration's property name: camelCase keys (`flexDirection`) hyphenated, custom properties kept. */
const property = (key: string) =>
  key.startsWith("--") ? key : key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)

const styleString = (style: object) =>
  Object.entries(style)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${property(k)}: ${String(v)}`)
    .join("; ")

/**
 * Converts framework-neutral part props into Svelte props. Attributes keep their HTML names;
 * handlers become Svelte's event attributes (`onKeyDown` → `onkeydown`, `onFocusIn` →
 * `onfocusin`); the style object becomes a declaration string. Symbol keys are kept.
 */
export function normalizeProps(props: PartProps): Record<string | symbol, unknown> {
  const out: Record<string | symbol, unknown> = {}
  for (const own of Reflect.ownKeys(props)) {
    // Reflect.ownKeys returns the object's own keys; indexing with them is sound.
    const value = (props as Record<string | symbol, unknown>)[own]
    const key = typeof own === "string" ? neutralName(own) : own
    if (value === undefined) continue
    if (typeof key === "symbol") out[key] = value
    // Content, not an attribute: the part renders it (`api.part().children`).
    else if (key === "children") continue
    else if (key === "inert") {
      // An unknown boolean attribute would render inert="false", which is inert.
      if (value) out[key] = ""
    } else if (key === "style" && typeof value === "object" && value !== null) {
      out[key] = styleString(value)
    } else if (/^on[A-Z]/.test(key) && typeof value === "function") {
      out[key.toLowerCase()] = value
    } else out[key] = value
  }
  return out
}

/**
 * Connect's (normalised, merged) props typed as element attributes, for spreading in markup:
 * sound because connect produces only attributes, handlers and attachments of an element.
 */
export const attrs = <T = HTMLAttributes<HTMLElement>>(
  props: Readonly<Record<string | symbol, unknown>>,
): T => props as T
