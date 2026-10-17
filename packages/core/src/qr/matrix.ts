// The module matrix (design §1): function patterns, format and version information, and the
// zigzag placement of the codewords, on a flat array with a parallel "function module" mask.
// Coordinates are (x = column, y = row).

import { alignmentPositions, ECC_FORMAT_BITS, type QrEcc, sizeOf } from "./tables"

export interface Matrix {
  readonly size: number
  /** 1 = dark. Row-major. */
  readonly dark: Uint8Array
  /** 1 = function module (never masked, never data). */
  readonly fixed: Uint8Array
}

const bit = (value: number, i: number) => (value >>> i) & 1

function set(m: Matrix, x: number, y: number, dark: number): void {
  const i = y * m.size + x
  m.dark[i] = dark
  m.fixed[i] = 1
}

/** The 15-bit format word of a level and mask: BCH(15,5), generator 0x537, XOR 0x5412. */
export function formatBits(ecc: QrEcc, mask: number): number {
  const data = (ECC_FORMAT_BITS[ecc] << 3) | mask
  let rem = data
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537)
  return ((data << 10) | rem) ^ 0x5412
}

/** The 18-bit version word: BCH(18,6), generator 0x1F25 (versions 7 and up). */
export function versionBits(version: number): number {
  let rem = version
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25)
  return (version << 12) | rem
}

/** Writes both copies of the format word and the dark module. */
export function drawFormat(m: Matrix, ecc: QrEcc, mask: number): void {
  const bits = formatBits(ecc, mask)
  const s = m.size
  for (let i = 0; i <= 5; i++) set(m, 8, i, bit(bits, i))
  set(m, 8, 7, bit(bits, 6))
  set(m, 8, 8, bit(bits, 7))
  set(m, 7, 8, bit(bits, 8))
  for (let i = 9; i < 15; i++) set(m, 14 - i, 8, bit(bits, i))
  for (let i = 0; i < 8; i++) set(m, s - 1 - i, 8, bit(bits, i))
  for (let i = 8; i < 15; i++) set(m, 8, s - 15 + i, bit(bits, i))
  set(m, 8, s - 8, 1)
}

function drawFinder(m: Matrix, cx: number, cy: number): void {
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx
      const y = cy + dy
      if (x < 0 || x >= m.size || y < 0 || y >= m.size) continue
      const d = Math.max(Math.abs(dx), Math.abs(dy))
      set(m, x, y, d !== 2 && d !== 4 ? 1 : 0)
    }
  }
}

function drawAlignment(m: Matrix, cx: number, cy: number): void {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      set(m, cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1 ? 1 : 0)
    }
  }
}

/** An empty matrix of a version with every function pattern drawn (format word for mask 0). */
export function functionPatterns(version: number, ecc: QrEcc): Matrix {
  const size = sizeOf(version)
  const m: Matrix = { size, dark: new Uint8Array(size * size), fixed: new Uint8Array(size * size) }
  for (let i = 0; i < size; i++) {
    set(m, 6, i, i % 2 === 0 ? 1 : 0)
    set(m, i, 6, i % 2 === 0 ? 1 : 0)
  }
  drawFinder(m, 3, 3)
  drawFinder(m, size - 4, 3)
  drawFinder(m, 3, size - 4)
  const align = alignmentPositions(version)
  const last = align.length - 1
  for (let i = 0; i <= last; i++) {
    for (let j = 0; j <= last; j++) {
      // The three corners taken by the finder patterns.
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) continue
      drawAlignment(m, align[i] ?? 0, align[j] ?? 0)
    }
  }
  drawFormat(m, ecc, 0)
  if (version >= 7) {
    const bits = versionBits(version)
    for (let i = 0; i < 18; i++) {
      const a = size - 11 + (i % 3)
      const b = Math.floor(i / 3)
      set(m, a, b, bit(bits, i))
      set(m, b, a, bit(bits, i))
    }
  }
  return m
}

/** Places the codewords in two-module columns from the bottom right, skipping column 6. */
export function placeCodewords(m: Matrix, codewords: Uint8Array): void {
  const s = m.size
  let i = 0
  for (let right = s - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5
    for (let vert = 0; vert < s; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j
        const upward = ((right + 1) & 2) === 0
        const y = upward ? s - 1 - vert : vert
        const k = y * s + x
        if (m.fixed[k] === 0 && i < codewords.length * 8) {
          m.dark[k] = bit(codewords[i >>> 3] ?? 0, 7 - (i & 7))
          i++
        }
      }
    }
  }
}
