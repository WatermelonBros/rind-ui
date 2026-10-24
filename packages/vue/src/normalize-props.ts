import type { PartProps } from "@rind-ui/core"
import { neutralName } from "@rind-ui/core/internal"
import { getCurrentInstance, inject, ssrContextKey } from "vue"

/** Rendering for the server (renderToString provides the SSR context). */
const rendersOnServer = () => getCurrentInstance() !== null && inject(ssrContextKey, null) !== null

/**
 * A neutral handler key as Vue's listener key: the event name lower-cased after `on` and its
 * capital (`onKeyDown` → `onKeydown`, `onFocusIn` → `onFocusin`), a capture phase kept as Vue's
 * `Capture` modifier (`onClickCapture` → `onClickCapture`: lower-cased, it would listen to a
 * `clickcapture` event that never fires). `gotpointercapture` / `lostpointercapture` are events
 * whose names end in "capture", not the modifier.
 */
function vueListener(key: string): string {
  const capture = /Capture$/.test(key) && !/^on(?:Got|Lost)PointerCapture$/.test(key)
  const name = capture ? key.slice(2, -"Capture".length) : key.slice(2)
  return `on${name[0]}${name.slice(1).toLowerCase()}${capture ? "Capture" : ""}`
}

/**
 * Converts framework-neutral part props into Vue props. Attributes keep their HTML names;
 * handlers become Vue's listener keys (`onKeyDown` → `onKeydown`, listening to `keydown`;
 * `onFocusIn` → `onFocusin`). Symbol keys are kept.
 */
export function normalizeProps(props: PartProps): Record<string | symbol, unknown> {
  const out: Record<string | symbol, unknown> = {}
  for (const own of Reflect.ownKeys(props)) {
    // Reflect.ownKeys returns the object's own keys; indexing with them is sound.
    const value = (props as Record<string | symbol, unknown>)[own]
    const key = typeof own === "string" ? neutralName(own) : own
    if (value === undefined) continue
    if (typeof key === "symbol") out[key] = value
    else if (key === "defaultValue" || key === "defaultChecked") {
      // An uncontrolled field's initial value: the DOM property on the client (it sets the
      // attribute and keeps the user's edits; `value` would be rewritten on every render), the
      // attribute in server HTML.
      out[rendersOnServer() ? (key === "defaultValue" ? "value" : "checked") : key] = value
    } else if (key === "inert") {
      // `inert="false"` would be inert: Vue renders false as "false" for this attribute.
      if (value) out[key] = ""
    } else if (/^on[A-Z]/.test(key) && typeof value === "function") {
      out[vueListener(key)] = value
    } else out[key] = value
  }
  return out
}
