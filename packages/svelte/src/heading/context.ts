import { type HeadingLevel, resolveHeadingLevel } from "@rind-ui/core"
import { createContext } from "../context"

/** The raw (unclamped) level of the nearest `Heading.Level`, read through a getter. */
export const headingLevel = createContext<() => number | undefined>("heading-level")

/** The level a heading gets at this position (1–6). Call during initialisation; call the result. */
export function useHeadingLevel(): () => HeadingLevel {
  const context = headingLevel.maybe()
  return () => resolveHeadingLevel(undefined, context?.())
}

/** The level the nearest `Heading.Level` gives (unclamped), or undefined outside any. */
export function useHeadingContextLevel(): () => number | undefined {
  const context = headingLevel.maybe()
  return () => context?.()
}
