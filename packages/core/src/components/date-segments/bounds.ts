// Development check of a field's or calendar's bounds. Internal: not re-exported.
import { Time } from "@internationalized/date"
import type { FieldValue } from "./draft"

declare const process: { env: { NODE_ENV?: string } }

const warned = new Set<string>()

/**
 * `minValue` after `maxValue` leaves no date allowed (react-spectrum#5208): one development
 * warning per scope and pair.
 */
export function warnBounds(
  scope: string,
  minValue: FieldValue | null | undefined,
  maxValue: FieldValue | null | undefined,
): void {
  if (process.env.NODE_ENV === "production" || !minValue || !maxValue) return
  // A time of day compares only with another; mixed kinds are a different mistake.
  if (minValue instanceof Time !== maxValue instanceof Time) return
  // Sound: two Times, or two DateValues (the library compares across the three date types).
  if (minValue.compare(maxValue as never) <= 0) return
  const key = `${scope}|${minValue.toString()}|${maxValue.toString()}`
  if (warned.has(key)) return
  warned.add(key)
  console.warn(
    `[rind-ui] ${scope}: minValue (${minValue.toString()}) is after maxValue (${maxValue.toString()}); no date can be chosen`,
  )
}
