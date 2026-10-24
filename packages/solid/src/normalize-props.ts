import type { PartProps } from "@rind-ui/core"
import { neutralName } from "@rind-ui/core/internal"

/**
 * Converts framework-neutral part props into Solid props. Attributes keep their HTML names and
 * handlers their neutral names, which Solid reads as they are (`onKeyDown` → `keydown`,
 * `onFocusIn` → `focusin`); `children` is dropped (the part renders it); an uncontrolled
 * field's `defaultValue` / `defaultChecked` become the `value` / `checked` attributes (the
 * field's default: the user's edits stay, a form reset restores it); `inert` is present only when true. Symbol keys are
 * kept.
 */
export function normalizeProps(props: PartProps): Record<string | symbol, unknown> {
  const out: Record<string | symbol, unknown> = {}
  for (const own of Reflect.ownKeys(props)) {
    // Reflect.ownKeys returns the object's own keys; indexing with them is sound.
    const value = (props as Record<string | symbol, unknown>)[own]
    const key = typeof own === "string" ? neutralName(own) : own
    if (value === undefined) continue
    if (typeof key === "symbol") out[key] = value
    else if (key === "children") continue
    // The `value` / `checked` attributes are the field's default (React's defaultValue /
    // defaultChecked): written once, and a user's edit or a form reset stays the browser's.
    // `attr:` forces the attribute where Solid would set the property.
    else if (key === "defaultValue") out["attr:value"] = String(value)
    else if (key === "defaultChecked") {
      if (value) out["attr:checked"] = ""
    } else if (key === "inert") {
      // Solid treats `inert` as a boolean property, which jsdom lacks; `attr:` writes the
      // attribute itself. Absent when false: inert="false" would be inert.
      if (value) out["attr:inert"] = ""
    } else out[key] = value
  }
  return out
}
