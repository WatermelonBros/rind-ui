// Masks (design §1): the eight predicates, the four penalty rules and the choice of the mask
// with the lowest score (lowest number on a tie). The penalty is the hot loop: typed arrays.

import { drawFormat, type Matrix } from "./matrix"
import type { QrEcc } from "./tables"

/** Whether mask `n` flips the data module at (x = column, y = row). */
export function maskHit(n: number, x: number, y: number): boolean {
  switch (n) {
    case 0:
      return (x + y) % 2 === 0
    case 1:
      return y % 2 === 0
    case 2:
      return x % 3 === 0
    case 3:
      return (x + y) % 3 === 0
    case 4:
      return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0
    case 5:
      return ((x * y) % 2) + ((x * y) % 3) === 0
    case 6:
      return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0
    default:
      return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0
  }
}

/** XORs the mask into the data modules (applying it twice restores the matrix). */
export function applyMask(m: Matrix, n: number): void {
  const s = m.size
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const i = y * s + x
      if (m.fixed[i] === 0 && maskHit(n, x, y)) m.dark[i] = (m.dark[i] ?? 0) ^ 1
    }
  }
}

const N1 = 3
const N2 = 3
const N3 = 40
const N4 = 10

/**
 * The four penalty rules: runs of five or more, 2 × 2 blocks, finder-like 1:1:3:1:1 runs with
 * four light modules on a side, and the dark proportion away from 50 %.
 */
export function penalty(m: Matrix): number {
  const s = m.size
  const d = m.dark
  let result = 0
  const history = new Int32Array(7)
  const addHistory = (length: number) => {
    // The light border before the first run counts as part of it.
    const run = history[0] === 0 ? length + s : length
    history.copyWithin(1, 0, 6)
    history[0] = run
  }
  const countPatterns = (): number => {
    const n = history[1] ?? 0
    const core =
      n > 0 && history[2] === n && history[3] === n * 3 && history[4] === n && history[5] === n
    return (
      (core && (history[0] ?? 0) >= n * 4 && (history[6] ?? 0) >= n ? 1 : 0) +
      (core && (history[6] ?? 0) >= n * 4 && (history[0] ?? 0) >= n ? 1 : 0)
    )
  }
  const terminate = (color: number, length: number): number => {
    let run = length
    if (color === 1) {
      addHistory(run)
      run = 0
    }
    addHistory(run + s)
    return countPatterns()
  }
  for (let pass = 0; pass < 2; pass++) {
    for (let a = 0; a < s; a++) {
      let color = 0
      let run = 0
      history.fill(0)
      for (let b = 0; b < s; b++) {
        const v = pass === 0 ? (d[a * s + b] ?? 0) : (d[b * s + a] ?? 0)
        if (v === color) {
          run++
          if (run === 5) result += N1
          else if (run > 5) result++
        } else {
          addHistory(run)
          if (color === 0) result += countPatterns() * N3
          color = v
          run = 1
        }
      }
      result += terminate(color, run) * N3
    }
  }
  for (let y = 0; y < s - 1; y++) {
    for (let x = 0; x < s - 1; x++) {
      const v = d[y * s + x]
      if (v === d[y * s + x + 1] && v === d[(y + 1) * s + x] && v === d[(y + 1) * s + x + 1]) {
        result += N2
      }
    }
  }
  let dark = 0
  for (const v of d) dark += v
  const total = s * s
  const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1
  return result + Math.max(0, k) * N4
}

/** Applies the forced mask, or the lowest-penalty one, with its format word. Returns it. */
export function chooseMask(m: Matrix, ecc: QrEcc, forced: number): number {
  let best = forced
  if (best < 0) {
    let min = Number.POSITIVE_INFINITY
    for (let n = 0; n < 8; n++) {
      applyMask(m, n)
      drawFormat(m, ecc, n)
      const score = penalty(m)
      if (score < min) {
        min = score
        best = n
      }
      applyMask(m, n)
    }
  }
  applyMask(m, best)
  drawFormat(m, ecc, best)
  return best
}
