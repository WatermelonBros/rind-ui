// Reed-Solomon over GF(2⁸) with the polynomial x⁸+x⁴+x³+x²+1 (0x11D), and the block split
// and interleave of the data codewords (design §1).

import { blockCount, eccPerBlock, type QrEcc, rawDataModules } from "./tables"

const EXP = new Uint8Array(512)
const LOG = new Uint8Array(256)
{
  let x = 1
  for (let i = 0; i < 255; i++) {
    EXP[i] = x
    LOG[x] = i
    x <<= 1
    if (x & 0x100) x ^= 0x11d
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255] ?? 0
}

/** Product of two field elements. */
export const gfMul = (a: number, b: number): number =>
  a === 0 || b === 0 ? 0 : (EXP[(LOG[a] ?? 0) + (LOG[b] ?? 0)] ?? 0)

/** The generator polynomial of a degree (roots α⁰ … α^(degree−1)), leading 1 omitted. */
function generator(degree: number): Uint8Array {
  const result = new Uint8Array(degree)
  result[degree - 1] = 1
  let root = 1
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = gfMul(result[j] ?? 0, root) ^ (result[j + 1] ?? 0)
    }
    root = gfMul(root, 0x02)
  }
  return result
}

/** The error-correction codewords of a block: the remainder of data · x^degree by the generator. */
export function rsRemainder(data: ArrayLike<number>, degree: number): Uint8Array {
  const divisor = generator(degree)
  const result = new Uint8Array(degree)
  for (let i = 0; i < data.length; i++) {
    const factor = (data[i] ?? 0) ^ (result[0] ?? 0)
    result.copyWithin(0, 1)
    result[degree - 1] = 0
    for (let j = 0; j < degree; j++) result[j] = (result[j] ?? 0) ^ gfMul(divisor[j] ?? 0, factor)
  }
  return result
}

/**
 * Splits the data codewords into the version and level's blocks (shorter blocks first),
 * appends each block's error-correction codewords and interleaves data then ECC codewords.
 */
export function addEccAndInterleave(data: Uint8Array, version: number, ecc: QrEcc): Uint8Array {
  const blocks = blockCount(version, ecc)
  const eccLength = eccPerBlock(version, ecc)
  const raw = Math.floor(rawDataModules(version) / 8)
  const shortBlocks = blocks - (raw % blocks)
  const shortLength = Math.floor(raw / blocks)
  const all: Uint8Array[] = []
  for (let i = 0, k = 0; i < blocks; i++) {
    const length = shortLength - eccLength + (i < shortBlocks ? 0 : 1)
    const block = new Uint8Array(shortLength + 1)
    block.set(data.subarray(k, k + length), 0)
    k += length
    // A short block keeps a placeholder byte so every block indexes the same way.
    block.set(rsRemainder(data.subarray(k - length, k), eccLength), shortLength + 1 - eccLength)
    all.push(block)
  }
  const out = new Uint8Array(raw)
  let n = 0
  for (let i = 0; i <= shortLength; i++) {
    for (let j = 0; j < all.length; j++) {
      if (i !== shortLength - eccLength || j >= shortBlocks) out[n++] = all[j]?.[i] ?? 0
    }
  }
  return out
}
