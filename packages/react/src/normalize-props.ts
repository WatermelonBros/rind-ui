import type { PartProps } from "@rind-ui/core"
import { version } from "react"

// Neutral names (see core/connect/props.ts) that React spells differently.
const REACT_NAMES: Readonly<Record<string, string>> = {
  class: "className",
  for: "htmlFor",
  tabindex: "tabIndex",
  readonly: "readOnly",
  contenteditable: "contentEditable",
  spellcheck: "spellCheck",
  autocomplete: "autoComplete",
  autocapitalize: "autoCapitalize",
  autocorrect: "autoCorrect",
  autofocus: "autoFocus",
  maxlength: "maxLength",
  minlength: "minLength",
  enterkeyhint: "enterKeyHint",
  inputmode: "inputMode",
  colspan: "colSpan",
  rowspan: "rowSpan",
  datetime: "dateTime",
  crossorigin: "crossOrigin",
  accesskey: "accessKey",
  referrerpolicy: "referrerPolicy",
  hreflang: "hrefLang",
  novalidate: "noValidate",
  // SVG presentation attributes (Progress's ring).
  "stroke-dasharray": "strokeDasharray",
  "stroke-dashoffset": "strokeDashoffset",
  "shape-rendering": "shapeRendering",
  onDblClick: "onDoubleClick",
  // React's onFocus/onBlur bubble: they are focusin/focusout.
  onFocusIn: "onFocus",
  onFocusOut: "onBlur",
  // React's onChange on form controls fires on every input.
  onInput: "onChange",
}

const camel = (key: string) =>
  key.startsWith("--") ? key : key.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())

const REACT_MAJOR = Number(version.split(".")[0])

/**
 * React 18 renders a boolean `inert` as `inert="true"`… or drops it; it needs "" to set the
 * attribute and undefined to omit it. React 19 understands booleans.
 */
export function inertValue(value: unknown, major: number = REACT_MAJOR): unknown {
  if (major >= 19 || typeof value !== "boolean") return value
  return value ? "" : undefined
}

/** Converts framework-neutral part props into React props. Symbol keys are kept. */
export function normalizeProps(props: PartProps): Record<string | symbol, unknown> {
  const out: Record<string | symbol, unknown> = {}
  for (const key of Reflect.ownKeys(props)) {
    // Reflect.ownKeys returns the object's own keys; indexing with them is sound.
    const value = (props as Record<string | symbol, unknown>)[key]
    if (value === undefined) continue
    if (key === "inert") {
      const inert = inertValue(value)
      if (inert !== undefined) out[key] = inert
    } else if (key === "style" && typeof value === "object" && value !== null) {
      out[key] = Object.fromEntries(Object.entries(value).map(([k, v]) => [camel(k), v]))
    } else {
      out[typeof key === "string" ? (REACT_NAMES[key] ?? key) : key] = value
    }
  }
  return out
}
