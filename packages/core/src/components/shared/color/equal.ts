// Equality (color-model "Equality"): `isEqualColor` for change detection (same space, same
// channels to their precision), `isSameColor` for matching (same 8-bit sRGB and alpha byte).

import { roundTo } from "../step-math"
import { channelRange } from "./channels"
import { type Color, SPACE_CHANNELS } from "./color"
import { toSpace } from "./convert"
import { alphaByte } from "./format"

export function isEqualColor(a: Color | null | undefined, b: Color | null | undefined): boolean {
  if (a === b) return true
  if (!a || !b || a.space !== b.space) return false
  if (roundTo(a.alpha, 2) !== roundTo(b.alpha, 2)) return false
  return SPACE_CHANNELS[a.space].every((ch, i) => {
    const p = channelRange(a.space, ch).precision
    return roundTo(a.channels[i] ?? 0, p) === roundTo(b.channels[i] ?? 0, p)
  })
}

export function isSameColor(a: Color | null | undefined, b: Color | null | undefined): boolean {
  if (a === b) return true
  if (!a || !b) return false
  const x = toSpace(a, "rgb").channels
  const y = toSpace(b, "rgb").channels
  return (
    x.every((v, i) => Math.round(v) === Math.round(y[i] ?? -1)) &&
    alphaByte(a.alpha) === alphaByte(b.alpha)
  )
}
