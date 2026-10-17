// Overlay coverage (spec "Overlay"): the share of the symbol's area (quiet zone excluded) an
// overlay covers, from two rectangles and the module counts; pure, so it is unit-tested in
// Node. The development warning compares it with half of what the level recovers.

import type { QrSuccess } from "../../qr/encode"
import type { QrEcc } from "../../qr/tables"

declare const process: { env: { NODE_ENV?: string } }

export interface QrCoverage {
  /** 0–100, rounded: percentage of the symbol's area (without quiet zone) covered. */
  readonly covers: number
  /** Covered modules (rectangle in module units, clipped to the symbol). */
  readonly modules: number
  /** The overlay reaches into a finder pattern (with its separator). */
  readonly reachesFinder: boolean
}

interface Box {
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
}

/** Codewords each level recovers, in percent. */
export const QR_RECOVERY: Readonly<Record<QrEcc, number>> = { L: 7, M: 15, Q: 25, H: 30 }

/** Coverage of `overlay` over a frame of `size + 2 × quietZone` modules. */
export function overlayCoverage(
  frame: Box,
  overlay: Box,
  size: number,
  quietZone: number,
): QrCoverage {
  const total = size + quietZone * 2
  if (frame.width <= 0 || frame.height <= 0) return { covers: 0, modules: 0, reachesFinder: false }
  const unitX = frame.width / total
  const unitY = frame.height / total
  // The rectangle in symbol modules (quiet zone removed), clipped to the symbol.
  const x0 = Math.max(0, (overlay.left - frame.left) / unitX - quietZone)
  const y0 = Math.max(0, (overlay.top - frame.top) / unitY - quietZone)
  const x1 = Math.min(size, (overlay.left + overlay.width - frame.left) / unitX - quietZone)
  const y1 = Math.min(size, (overlay.top + overlay.height - frame.top) / unitY - quietZone)
  const w = Math.max(0, x1 - x0)
  const h = Math.max(0, y1 - y0)
  const modules = w * h
  // A finder with its separator is 8 × 8 modules in three corners.
  const inFinder = (fx0: number, fy0: number) =>
    w > 0 && h > 0 && x0 < fx0 + 8 && x1 > fx0 && y0 < fy0 + 8 && y1 > fy0
  const reachesFinder = inFinder(0, 0) || inFinder(size - 8, 0) || inFinder(0, size - 8)
  return {
    covers: Math.round((modules / (size * size)) * 100),
    modules: Math.round(modules),
    reachesFinder,
  }
}

const warned = new Set<string>()

/** Development: an overlay over half the level's budget, or reaching a finder. Once each. */
export function warnOverlayCoverage(coverage: QrCoverage, symbol: Pick<QrSuccess, "ecc">): void {
  if (process.env.NODE_ENV === "production") return
  const budget = QR_RECOVERY[symbol.ecc] / 2
  if (coverage.reachesFinder) {
    const key = `finder:${symbol.ecc}:${coverage.covers}`
    if (!warned.has(key)) {
      warned.add(key)
      console.warn(
        "[rind-ui] qr-code: the overlay reaches the finder patterns; most scanners cannot read the code. Make the overlay smaller.",
      )
    }
  }
  if (coverage.covers > budget) {
    const key = `budget:${symbol.ecc}:${coverage.covers}`
    if (!warned.has(key)) {
      warned.add(key)
      console.warn(
        `[rind-ui] qr-code: the overlay covers ${coverage.covers} % of the symbol at level ${symbol.ecc}, over the ${budget} % budget (half of the ${QR_RECOVERY[symbol.ecc]} % the level recovers). Use a higher level or a smaller overlay.`,
      )
    }
  }
}
