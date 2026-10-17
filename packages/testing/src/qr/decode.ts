// A QR Code decoder for tests (add-qr-code 1.7): the oracle of the encoder's property tests
// and of the component's decode invariant. Written independently of the encoder — its own
// function-pattern map, alignment table, block table and Reed-Solomon — so a bug in one is
// not shared by the other. It corrects errors (Berlekamp–Massey, Chien, Forney), so a damaged
// symbol proves the error-correction codewords, not only the data.

export type QrDecodedSegment =
  | { readonly mode: "numeric" | "alphanumeric" | "byte"; readonly chars: number }
  | { readonly mode: "eci"; readonly assignment: number }

export interface QrDecoded {
  readonly version: number
  readonly ecc: "L" | "M" | "Q" | "H"
  readonly mask: number
  /** The payload bytes (numeric and alphanumeric segments as their ASCII bytes). */
  readonly bytes: Uint8Array
  /** The payload as text: UTF-8 (ECI 26 or none), invalid sequences as U+FFFD. */
  readonly text: string
  readonly segments: readonly QrDecodedSegment[]
  /** Codewords corrected by Reed-Solomon. */
  readonly corrected: number
}

export class QrDecodeError extends Error {
  override name = "QrDecodeError"
}

// The standard's alignment pattern table (ISO/IEC 18004 Annex E), not computed.
// prettier-ignore
const ALIGNMENT: readonly (readonly number[])[] = [
  [],
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
  [6, 30, 54],
  [6, 32, 58],
  [6, 34, 62],
  [6, 26, 46, 66],
  [6, 26, 48, 70],
  [6, 26, 50, 74],
  [6, 30, 54, 78],
  [6, 30, 56, 82],
  [6, 30, 58, 86],
  [6, 34, 62, 90],
  [6, 28, 50, 72, 94],
  [6, 26, 50, 74, 98],
  [6, 30, 54, 78, 102],
  [6, 28, 54, 80, 106],
  [6, 32, 58, 84, 110],
  [6, 30, 58, 86, 114],
  [6, 34, 62, 90, 118],
  [6, 26, 50, 74, 98, 122],
  [6, 30, 54, 78, 102, 126],
  [6, 26, 52, 78, 104, 130],
  [6, 30, 56, 82, 108, 134],
  [6, 34, 60, 86, 112, 138],
  [6, 30, 58, 86, 114, 142],
  [6, 34, 62, 90, 118, 146],
  [6, 30, 54, 78, 102, 126, 150],
  [6, 24, 50, 76, 102, 128, 154],
  [6, 28, 54, 80, 106, 132, 158],
  [6, 32, 58, 84, 110, 136, 162],
  [6, 26, 54, 82, 110, 138, 166],
  [6, 30, 58, 86, 114, 142, 170],
]

/** The standard's alignment centres for a version. */
export const alignmentTable = (version: number): readonly number[] => ALIGNMENT[version] ?? []

// Error-correction blocks per version and level (ISO/IEC 18004 Table 9):
// [ecc codewords per block, [blocks, total codewords per block, data codewords per block]...].
// prettier-ignore
const BLOCKS: Readonly<Record<"L" | "M" | "Q" | "H", readonly (readonly number[])[]>> = {
  L: [
    [],
    [7, 1, 26, 19],
    [10, 1, 44, 34],
    [15, 1, 70, 55],
    [20, 1, 100, 80],
    [26, 1, 134, 108],
    [18, 2, 86, 68],
    [20, 2, 98, 78],
    [24, 2, 121, 97],
    [30, 2, 146, 116],
    [18, 2, 86, 68, 2, 87, 69],
    [20, 4, 101, 81],
    [24, 2, 116, 92, 2, 117, 93],
    [26, 4, 133, 107],
    [30, 3, 145, 115, 1, 146, 116],
    [22, 5, 109, 87, 1, 110, 88],
    [24, 5, 122, 98, 1, 123, 99],
    [28, 1, 135, 107, 5, 136, 108],
    [30, 5, 150, 120, 1, 151, 121],
    [28, 3, 141, 113, 4, 142, 114],
    [28, 3, 135, 107, 5, 136, 108],
    [28, 4, 144, 116, 4, 145, 117],
    [28, 2, 139, 111, 7, 140, 112],
    [30, 4, 151, 121, 5, 152, 122],
    [30, 6, 147, 117, 4, 148, 118],
    [26, 8, 132, 106, 4, 133, 107],
    [28, 10, 142, 114, 2, 143, 115],
    [30, 8, 152, 122, 4, 153, 123],
    [30, 3, 147, 117, 10, 148, 118],
    [30, 7, 146, 116, 7, 147, 117],
    [30, 5, 145, 115, 10, 146, 116],
    [30, 13, 145, 115, 3, 146, 116],
    [30, 17, 145, 115],
    [30, 17, 145, 115, 1, 146, 116],
    [30, 13, 145, 115, 6, 146, 116],
    [30, 12, 151, 121, 7, 152, 122],
    [30, 6, 151, 121, 14, 152, 122],
    [30, 17, 152, 122, 4, 153, 123],
    [30, 4, 152, 122, 18, 153, 123],
    [30, 20, 147, 117, 4, 148, 118],
    [30, 19, 148, 118, 6, 149, 119],
  ],
  M: [
    [],
    [10, 1, 26, 16],
    [16, 1, 44, 28],
    [26, 1, 70, 44],
    [18, 2, 50, 32],
    [24, 2, 67, 43],
    [16, 4, 43, 27],
    [18, 4, 49, 31],
    [22, 2, 60, 38, 2, 61, 39],
    [22, 3, 58, 36, 2, 59, 37],
    [26, 4, 69, 43, 1, 70, 44],
    [30, 1, 80, 50, 4, 81, 51],
    [22, 6, 58, 36, 2, 59, 37],
    [22, 8, 59, 37, 1, 60, 38],
    [24, 4, 64, 40, 5, 65, 41],
    [24, 5, 65, 41, 5, 66, 42],
    [28, 7, 73, 45, 3, 74, 46],
    [28, 10, 74, 46, 1, 75, 47],
    [26, 9, 69, 43, 4, 70, 44],
    [26, 3, 70, 44, 11, 71, 45],
    [26, 3, 67, 41, 13, 68, 42],
    [26, 17, 68, 42],
    [28, 17, 74, 46],
    [28, 4, 75, 47, 14, 76, 48],
    [28, 6, 73, 45, 14, 74, 46],
    [28, 8, 75, 47, 13, 76, 48],
    [28, 19, 74, 46, 4, 75, 47],
    [28, 22, 73, 45, 3, 74, 46],
    [28, 3, 73, 45, 23, 74, 46],
    [28, 21, 73, 45, 7, 74, 46],
    [28, 19, 75, 47, 10, 76, 48],
    [28, 2, 74, 46, 29, 75, 47],
    [28, 10, 74, 46, 23, 75, 47],
    [28, 14, 74, 46, 21, 75, 47],
    [28, 14, 74, 46, 23, 75, 47],
    [28, 12, 75, 47, 26, 76, 48],
    [28, 6, 75, 47, 34, 76, 48],
    [28, 29, 74, 46, 14, 75, 47],
    [28, 13, 74, 46, 32, 75, 47],
    [28, 40, 75, 47, 7, 76, 48],
    [28, 18, 75, 47, 31, 76, 48],
  ],
  Q: [
    [],
    [13, 1, 26, 13],
    [22, 1, 44, 22],
    [18, 2, 35, 17],
    [26, 2, 50, 24],
    [18, 2, 33, 15, 2, 34, 16],
    [24, 4, 43, 19],
    [18, 2, 32, 14, 4, 33, 15],
    [22, 4, 40, 18, 2, 41, 19],
    [20, 4, 36, 16, 4, 37, 17],
    [24, 6, 43, 19, 2, 44, 20],
    [28, 4, 50, 22, 4, 51, 23],
    [26, 4, 46, 20, 6, 47, 21],
    [24, 8, 44, 20, 4, 45, 21],
    [20, 11, 36, 16, 5, 37, 17],
    [30, 5, 54, 24, 7, 55, 25],
    [24, 15, 43, 19, 2, 44, 20],
    [28, 1, 50, 22, 15, 51, 23],
    [28, 17, 50, 22, 1, 51, 23],
    [26, 17, 47, 21, 4, 48, 22],
    [30, 15, 54, 24, 5, 55, 25],
    [28, 17, 50, 22, 6, 51, 23],
    [30, 7, 54, 24, 16, 55, 25],
    [30, 11, 54, 24, 14, 55, 25],
    [30, 11, 54, 24, 16, 55, 25],
    [30, 7, 54, 24, 22, 55, 25],
    [28, 28, 50, 22, 6, 51, 23],
    [30, 8, 53, 23, 26, 54, 24],
    [30, 4, 54, 24, 31, 55, 25],
    [30, 1, 53, 23, 37, 54, 24],
    [30, 15, 54, 24, 25, 55, 25],
    [30, 42, 54, 24, 1, 55, 25],
    [30, 10, 54, 24, 35, 55, 25],
    [30, 29, 54, 24, 19, 55, 25],
    [30, 44, 54, 24, 7, 55, 25],
    [30, 39, 54, 24, 14, 55, 25],
    [30, 46, 54, 24, 10, 55, 25],
    [30, 49, 54, 24, 10, 55, 25],
    [30, 48, 54, 24, 14, 55, 25],
    [30, 43, 54, 24, 22, 55, 25],
    [30, 34, 54, 24, 34, 55, 25],
  ],
  H: [
    [],
    [17, 1, 26, 9],
    [28, 1, 44, 16],
    [22, 2, 35, 13],
    [16, 4, 25, 9],
    [22, 2, 33, 11, 2, 34, 12],
    [28, 4, 43, 15],
    [26, 4, 39, 13, 1, 40, 14],
    [26, 4, 40, 14, 2, 41, 15],
    [24, 4, 36, 12, 4, 37, 13],
    [28, 6, 43, 15, 2, 44, 16],
    [24, 3, 36, 12, 8, 37, 13],
    [28, 7, 42, 14, 4, 43, 15],
    [22, 12, 33, 11, 4, 34, 12],
    [24, 11, 36, 12, 5, 37, 13],
    [24, 11, 36, 12, 7, 37, 13],
    [30, 3, 45, 15, 13, 46, 16],
    [28, 2, 42, 14, 17, 43, 15],
    [28, 2, 42, 14, 19, 43, 15],
    [26, 9, 39, 13, 16, 40, 14],
    [28, 15, 43, 15, 10, 44, 16],
    [30, 19, 46, 16, 6, 47, 17],
    [24, 34, 37, 13],
    [30, 16, 45, 15, 14, 46, 16],
    [30, 30, 46, 16, 2, 47, 17],
    [30, 22, 45, 15, 13, 46, 16],
    [30, 33, 46, 16, 4, 47, 17],
    [30, 12, 45, 15, 28, 46, 16],
    [30, 11, 45, 15, 31, 46, 16],
    [30, 19, 45, 15, 26, 46, 16],
    [30, 23, 45, 15, 25, 46, 16],
    [30, 23, 45, 15, 28, 46, 16],
    [30, 19, 45, 15, 35, 46, 16],
    [30, 11, 45, 15, 46, 46, 16],
    [30, 59, 46, 16, 1, 47, 17],
    [30, 22, 45, 15, 41, 46, 16],
    [30, 2, 45, 15, 64, 46, 16],
    [30, 24, 45, 15, 46, 46, 16],
    [30, 42, 45, 15, 32, 46, 16],
    [30, 10, 45, 15, 67, 46, 16],
    [30, 20, 45, 15, 61, 46, 16],
  ],
}

// GF(2⁸), polynomial 0x11D.
const EXP = new Uint8Array(512)
const LOG = new Uint8Array(256)
{
  let x = 1
  for (let i = 0; i < 255; i++) {
    EXP[i] = x
    LOG[x] = i
    x = x & 0x80 ? ((x << 1) ^ 0x11d) & 0xff : x << 1
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255] ?? 0
}
const mul = (a: number, b: number) => (a && b ? (EXP[(LOG[a] ?? 0) + (LOG[b] ?? 0)] ?? 0) : 0)
const div = (a: number, b: number) => (a ? (EXP[(LOG[a] ?? 0) + 255 - (LOG[b] ?? 0)] ?? 0) : 0)
const pow = (i: number) => EXP[((i % 255) + 255) % 255] ?? 0

/**
 * Corrects a block (data then ECC codewords, generator roots α⁰…α^(n−1)) in place.
 * Returns the number of corrected codewords; throws when the block is beyond repair.
 */
export function correctBlock(block: Uint8Array, eccLength: number): number {
  const n = block.length
  const evalAt = (x: number) => {
    let y = 0
    for (const c of block) y = mul(y, x) ^ c
    return y
  }
  const syndromes = Array.from({ length: eccLength }, (_, i) => evalAt(pow(i)))
  if (syndromes.every((s) => s === 0)) return 0
  // Berlekamp–Massey: the error locator Λ (lowest degree first).
  let lambda = [1]
  let prev = [1]
  let l = 0
  let m = 1
  let b = 1
  for (let r = 0; r < eccLength; r++) {
    let delta = syndromes[r] ?? 0
    for (let i = 1; i <= l; i++) delta ^= mul(lambda[i] ?? 0, syndromes[r - i] ?? 0)
    if (delta === 0) {
      m++
      continue
    }
    const scale = div(delta, b)
    const next = lambda.slice()
    for (let i = 0; i < prev.length; i++) {
      next[i + m] = (next[i + m] ?? 0) ^ mul(scale, prev[i] ?? 0)
    }
    if (2 * l <= r) {
      prev = lambda
      l = r + 1 - l
      b = delta
      m = 1
    } else m++
    lambda = next
  }
  // Chien search: an error at position p (from the end) when Λ(α^−p) = 0.
  const positions: number[] = []
  for (let p = 0; p < n; p++) {
    const x = pow(-p)
    let y = 0
    for (let i = lambda.length - 1; i >= 0; i--) y = mul(y, x) ^ (lambda[i] ?? 0)
    if (y === 0) positions.push(p)
  }
  if (positions.length !== l || l * 2 > eccLength) throw new QrDecodeError("uncorrectable block")
  // Forney (first consecutive root 0): e = X · Ω(X⁻¹) / Λ'(X⁻¹).
  const omega: number[] = []
  for (let i = 0; i < eccLength; i++) {
    let v = 0
    for (let j = 0; j <= i; j++) v ^= mul(syndromes[j] ?? 0, lambda[i - j] ?? 0)
    omega.push(v)
  }
  for (const p of positions) {
    const xInv = pow(-p)
    let num = 0
    for (let i = omega.length - 1; i >= 0; i--) num = mul(num, xInv) ^ (omega[i] ?? 0)
    let den = 0
    for (let i = 1; i < lambda.length; i += 2) den ^= mul(lambda[i] ?? 0, pow(-p * (i - 1)))
    if (den === 0) throw new QrDecodeError("uncorrectable block")
    const magnitude = mul(pow(p), div(num, den))
    const k = n - 1 - p
    block[k] = (block[k] ?? 0) ^ magnitude
  }
  if (Array.from({ length: eccLength }, (_, i) => evalAt(pow(i))).some((s) => s !== 0)) {
    throw new QrDecodeError("uncorrectable block")
  }
  return positions.length
}

const FORMAT_LEVELS = ["M", "L", "H", "Q"] as const

function formatWord(data: number): number {
  let rem = data
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537)
  return ((data << 10) | rem) ^ 0x5412
}

const popcount = (v: number) => {
  let n = 0
  for (let x = v; x; x &= x - 1) n++
  return n
}

/** Reads a format copy and returns the nearest valid word's level and mask. */
function readFormat(bits: number): { ecc: QrDecoded["ecc"]; mask: number; distance: number } {
  let best = { ecc: "M" as QrDecoded["ecc"], mask: 0, distance: 99 }
  for (let data = 0; data < 32; data++) {
    const distance = popcount(formatWord(data) ^ bits)
    if (distance < best.distance) {
      best = { ecc: FORMAT_LEVELS[data >> 3] ?? "M", mask: data & 7, distance }
    }
  }
  return best
}

const MASKS: readonly ((x: number, y: number) => boolean)[] = [
  (x, y) => (x + y) % 2 === 0,
  (_, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
]

/** Which modules are function patterns, built from the standard's geometry. */
function functionMap(version: number): boolean[][] {
  const size = version * 4 + 17
  const f = Array.from({ length: size }, () => new Array<boolean>(size).fill(false))
  const mark = (x0: number, y0: number, w: number, h: number) => {
    for (let y = Math.max(0, y0); y < Math.min(size, y0 + h); y++) {
      for (let x = Math.max(0, x0); x < Math.min(size, x0 + w); x++) {
        const row = f[y]
        if (row) row[x] = true
      }
    }
  }
  mark(0, 0, 9, 9) // top-left finder, separator, format
  mark(size - 8, 0, 8, 9)
  mark(0, size - 8, 9, 8)
  mark(6, 0, 1, size) // timing
  mark(0, 6, size, 1)
  const centres = alignmentTable(version)
  for (const cy of centres) {
    for (const cx of centres) {
      const onFinder =
        (cx === 6 && cy === 6) || (cx === 6 && cy === size - 7) || (cx === size - 7 && cy === 6)
      if (!onFinder) mark(cx - 2, cy - 2, 5, 5)
    }
  }
  if (version >= 7) {
    mark(size - 11, 0, 3, 6)
    mark(0, size - 11, 6, 3)
  }
  return f
}

/** Decodes a module matrix (row-major, `true` = dark, no quiet zone). Throws `QrDecodeError`. */
export function decodeQr(matrix: readonly (readonly boolean[])[]): QrDecoded {
  const size = matrix.length
  const version = (size - 17) / 4
  if (!Number.isInteger(version) || version < 1 || version > 40) {
    throw new QrDecodeError(`a ${size}-module side is no QR version`)
  }
  const at = (x: number, y: number) => (matrix[y]?.[x] === true ? 1 : 0)
  let copy1 = 0
  for (let i = 0; i <= 5; i++) copy1 |= at(8, i) << i
  copy1 |= at(8, 7) << 6
  copy1 |= at(8, 8) << 7
  copy1 |= at(7, 8) << 8
  for (let i = 9; i < 15; i++) copy1 |= at(14 - i, 8) << i
  let copy2 = 0
  for (let i = 0; i < 8; i++) copy2 |= at(size - 1 - i, 8) << i
  for (let i = 8; i < 15; i++) copy2 |= at(8, size - 15 + i) << i
  const a = readFormat(copy1)
  const b = readFormat(copy2)
  const format = a.distance <= b.distance ? a : b
  if (format.distance > 3) throw new QrDecodeError("unreadable format information")

  const fixed = functionMap(version)
  const unmask = MASKS[format.mask] ?? (() => false)
  const bits: number[] = []
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j
        const upward = ((right + 1) & 2) === 0
        const y = upward ? size - 1 - vert : vert
        if (fixed[y]?.[x]) continue
        bits.push(at(x, y) ^ (unmask(x, y) ? 1 : 0))
      }
    }
  }
  const codewords = new Uint8Array(Math.floor(bits.length / 8))
  for (let i = 0; i < codewords.length; i++) {
    let v = 0
    for (let k = 0; k < 8; k++) v = (v << 1) | (bits[i * 8 + k] ?? 0)
    codewords[i] = v
  }

  // De-interleave into blocks, correct each, keep the data codewords.
  const spec = BLOCKS[format.ecc][version] ?? []
  const eccLength = spec[0] ?? 0
  const groups: { count: number; data: number }[] = []
  for (let i = 1; i < spec.length; i += 3) {
    groups.push({ count: spec[i] ?? 0, data: spec[i + 2] ?? 0 })
  }
  const blocks: { data: number; bytes: number[] }[] = []
  for (const g of groups) for (let i = 0; i < g.count; i++) blocks.push({ data: g.data, bytes: [] })
  const maxData = Math.max(...blocks.map((bl) => bl.data))
  let k = 0
  for (let i = 0; i < maxData; i++) {
    for (const bl of blocks) if (i < bl.data) bl.bytes.push(codewords[k++] ?? 0)
  }
  for (let i = 0; i < eccLength; i++) for (const bl of blocks) bl.bytes.push(codewords[k++] ?? 0)
  let corrected = 0
  const data: number[] = []
  for (const bl of blocks) {
    const block = Uint8Array.from(bl.bytes)
    corrected += correctBlock(block, eccLength)
    data.push(...block.subarray(0, bl.data))
  }
  return { version, ecc: format.ecc, mask: format.mask, corrected, ...parseSegments(data, version) }
}

const ALPHANUMERIC = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:"

function parseSegments(
  data: readonly number[],
  version: number,
): { bytes: Uint8Array; text: string; segments: QrDecodedSegment[] } {
  let pos = 0
  const total = data.length * 8
  const read = (n: number) => {
    let v = 0
    for (let i = 0; i < n; i++, pos++)
      v = (v << 1) | (((data[pos >> 3] ?? 0) >> (7 - (pos & 7))) & 1)
    return v
  }
  const width = (narrow: number, mid: number, wide: number) =>
    version <= 9 ? narrow : version <= 26 ? mid : wide
  const out: number[] = []
  const segments: QrDecodedSegment[] = []
  while (pos + 4 <= total) {
    const mode = read(4)
    if (mode === 0) break
    if (mode === 0b0111) {
      const first = read(8)
      const assignment =
        first & 0x80
          ? first & 0x40
            ? ((first & 0x1f) << 16) | read(16)
            : ((first & 0x3f) << 8) | read(8)
          : first
      segments.push({ mode: "eci", assignment })
    } else if (mode === 0b0001) {
      let count = read(width(10, 12, 14))
      segments.push({ mode: "numeric", chars: count })
      for (; count >= 3; count -= 3)
        out.push(
          ...String(read(10))
            .padStart(3, "0")
            .split("")
            .map((c) => c.charCodeAt(0)),
        )
      if (count === 2)
        out.push(
          ...String(read(7))
            .padStart(2, "0")
            .split("")
            .map((c) => c.charCodeAt(0)),
        )
      if (count === 1)
        out.push(
          ...String(read(4))
            .split("")
            .map((c) => c.charCodeAt(0)),
        )
    } else if (mode === 0b0010) {
      let count = read(width(9, 11, 13))
      segments.push({ mode: "alphanumeric", chars: count })
      for (; count >= 2; count -= 2) {
        const v = read(11)
        out.push(ALPHANUMERIC.charCodeAt(Math.floor(v / 45)), ALPHANUMERIC.charCodeAt(v % 45))
      }
      if (count === 1) out.push(ALPHANUMERIC.charCodeAt(read(6)))
    } else if (mode === 0b0100) {
      const count = read(width(8, 16, 16))
      segments.push({ mode: "byte", chars: count })
      for (let i = 0; i < count; i++) out.push(read(8))
    } else {
      throw new QrDecodeError(`unsupported mode ${mode.toString(2)}`)
    }
  }
  const bytes = Uint8Array.from(out)
  return { bytes, text: new TextDecoder("utf-8").decode(bytes), segments }
}
