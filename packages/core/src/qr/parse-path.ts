// The module matrix back from a rendered QR path (add-qr-code 1.7, 5.1): the `d` of the
// Pattern and the frame's `viewBox`, so the contract's `matrix()` query and tests check the
// renderer end to end, not only the encoder. Re-exported by @rind-ui/testing.

export interface ParsedQrPath {
  /** Row-major, `true` = dark, the quiet zone removed. */
  readonly modules: boolean[][]
  readonly quietZone: number
  /** Whether a dark module was drawn inside the quiet zone. */
  readonly darkInQuietZone: boolean
}

/**
 * Parses `M{x} {y}h{n}v1H{x}z` subpaths (any whitespace or commas) over a square viewBox
 * `0 0 N N` whose symbol is `size` modules wide (the rest split evenly as quiet zone).
 */
export function parseQrPath(d: string, viewBox: string, size: number): ParsedQrPath {
  const n = Number(viewBox.trim().split(/[\s,]+/)[2])
  if (!Number.isFinite(n)) throw new Error(`unreadable viewBox ${JSON.stringify(viewBox)}`)
  const quietZone = (n - size) / 2
  const modules = Array.from({ length: size }, () => new Array<boolean>(size).fill(false))
  let darkInQuietZone = false
  const re = /M\s*(-?\d+)[\s,]+(-?\d+)\s*h\s*(\d+)\s*v\s*1\s*H\s*-?\d+\s*z/gi
  let consumed = 0
  for (const m of d.matchAll(re)) {
    consumed += m[0].length
    const x0 = Number(m[1]) - quietZone
    const y = Number(m[2]) - quietZone
    const w = Number(m[3])
    for (let x = x0; x < x0 + w; x++) {
      const row = modules[y]
      if (!row || x < 0 || x >= size) darkInQuietZone = true
      else row[x] = true
    }
  }
  if (consumed !== d.replace(/\s+$/, "").length && d.trim() !== "") {
    throw new Error("the path has commands other than merged module runs")
  }
  return { modules, quietZone, darkInQuietZone }
}

/** Symbol size from a viewBox and quiet zone (for callers that know the quiet zone instead). */
export const qrSizeFromViewBox = (viewBox: string, quietZone: number): number =>
  Number(viewBox.trim().split(/[\s,]+/)[2]) - quietZone * 2
