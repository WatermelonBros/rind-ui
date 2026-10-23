import type { PartProps } from "@rind-ui/core"

const styleString = (style: object) =>
  Object.entries(style)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}: ${String(v)}`)
    .join("; ")

/**
 * Converts framework-neutral part props into Svelte props. Attributes keep their HTML names;
 * handlers become Svelte's event attributes (`onKeyDown` → `onkeydown`, `onFocusIn` →
 * `onfocusin`); the style object becomes a declaration string. Symbol keys are kept.
 */
export function normalizeProps(props: PartProps): Record<string | symbol, unknown> {
  const out: Record<string | symbol, unknown> = {}
  for (const key of Reflect.ownKeys(props)) {
    // Reflect.ownKeys returns the object's own keys; indexing with them is sound.
    const value = (props as Record<string | symbol, unknown>)[key]
    if (value === undefined) continue
    if (typeof key === "symbol") out[key] = value
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
