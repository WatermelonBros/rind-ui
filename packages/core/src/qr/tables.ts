// ISO/IEC 18004 tables (design §1): error-correction codewords per block and block counts
// for versions 1–40 at each level, the raw module count and the alignment pattern centres.
// Index 0 of each row is unused, so a version indexes its row directly.

export type QrEcc = "L" | "M" | "Q" | "H"

export const ECC_LEVELS: readonly QrEcc[] = ["L", "M", "Q", "H"]

/** The two format-information bits of each level. */
export const ECC_FORMAT_BITS: Readonly<Record<QrEcc, number>> = { L: 1, M: 0, Q: 3, H: 2 }

// prettier-ignore
const ECC_CODEWORDS_PER_BLOCK: Readonly<Record<QrEcc, readonly number[]>> = {
  L: [
    -1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30,
    30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30,
  ],
  M: [
    -1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28,
    28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28,
  ],
  Q: [
    -1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30,
    30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30,
  ],
  H: [
    -1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30,
    30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30,
  ],
}

// prettier-ignore
const NUM_ERROR_CORRECTION_BLOCKS: Readonly<Record<QrEcc, readonly number[]>> = {
  L: [
    -1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14,
    15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25,
  ],
  M: [
    -1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23,
    25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49,
  ],
  Q: [
    -1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34,
    34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68,
  ],
  H: [
    -1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35,
    37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81,
  ],
}

/** Error-correction codewords in each block. */
export const eccPerBlock = (version: number, ecc: QrEcc): number =>
  ECC_CODEWORDS_PER_BLOCK[ecc][version] ?? 0

/** Number of blocks the codewords are split into. */
export const blockCount = (version: number, ecc: QrEcc): number =>
  NUM_ERROR_CORRECTION_BLOCKS[ecc][version] ?? 0

/** Modules per side, without quiet zone. */
export const sizeOf = (version: number): number => version * 4 + 17

/** Modules available for data and error correction (all but the function patterns). */
export function rawDataModules(version: number): number {
  let result = (16 * version + 128) * version + 64
  if (version >= 2) {
    const align = Math.floor(version / 7) + 2
    result -= (25 * align - 10) * align - 55
    if (version >= 7) result -= 36
  }
  return result
}

/** Data codewords (bytes) a version holds at a level. */
export const dataCodewords = (version: number, ecc: QrEcc): number =>
  Math.floor(rawDataModules(version) / 8) - eccPerBlock(version, ecc) * blockCount(version, ecc)

/** Alignment pattern centres (one axis), ascending; empty for version 1. */
export function alignmentPositions(version: number): number[] {
  if (version === 1) return []
  const count = Math.floor(version / 7) + 2
  const step = Math.floor((version * 8 + count * 3 + 5) / (count * 4 - 4)) * 2
  const result = [6]
  for (let pos = sizeOf(version) - 7; result.length < count; pos -= step) result.splice(1, 0, pos)
  return result
}
