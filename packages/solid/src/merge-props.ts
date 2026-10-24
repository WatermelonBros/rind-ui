import { createMergeProps, joinHandlers as join } from "@rind-ui/core/internal"

export type { RindEventExtension } from "@rind-ui/core/internal"

type RefFn = (el: Element) => void
type Props = Readonly<Record<string | symbol, unknown>>

const isHandler = (key: string) => /^on[A-Z]/.test(key)

/** Composes function refs (Solid compiles every `ref` to a function). */
export function composeRefs(...refs: unknown[]): RefFn {
  return (el) => {
    for (const ref of refs) if (typeof ref === "function") (ref as RefFn)(el)
  }
}

/** Joins class layers (the core merger nests them in arrays) into one attribute value. */
const joinClass = (value: unknown): string =>
  Array.isArray(value)
    ? value.map(joinClass).filter(Boolean).join(" ")
    : typeof value === "string"
      ? value
      : ""

const styleText = (style: unknown): string =>
  typeof style === "string"
    ? style
    : Object.entries(style as Record<string, unknown>)
        .filter(([, v]) => v !== undefined && v !== null && v !== "")
        .map(([k, v]) => `${k}: ${String(v)}`)
        .join("; ")

const merge = createMergeProps({
  isHandler,
  // Objects merge per property (the consumer's last); a string on either side concatenates.
  mergeStyle: (a, b) =>
    typeof a === "object" && a !== null && typeof b === "object" && b !== null
      ? { ...a, ...b }
      : `${styleText(a)}; ${styleText(b)}`,
  refKey: "ref",
  composeRefs,
})

/**
 * Merges a part's props with consumer layers, later layers winning (see the core helper):
 * handlers chain, consumer first, `event.preventRindHandler()` skips the part's; classes join;
 * styles merge; refs compose. Never Solid's own `mergeProps` for this: it keeps only the last
 * handler.
 */
export function mergeProps(...layers: Props[]): Record<string | symbol, unknown> {
  const [base = {}, ...rest] = layers
  const out = merge(base, ...rest)
  if (Array.isArray(out["class"])) out["class"] = joinClass(out["class"])
  return out
}

/** A part's own props from several core modules; same-named handlers all run in order. */
export const joinHandlers = (...sources: Props[]) => join(isHandler, ...sources)
