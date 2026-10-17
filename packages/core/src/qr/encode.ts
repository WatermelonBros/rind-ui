// encodeQr (design §1, §3): validates input and options, builds the segments, picks the
// smallest version that holds them, adds error correction, places and masks the modules.
// Every failure is a typed result; nothing throws for data-dependent input.

import { chooseMask } from "./mask"
import { functionPatterns, placeCodewords } from "./matrix"
import { addEccAndInterleave } from "./reed-solomon"
import {
  countBits,
  makeSegments,
  packSegments,
  type QrSegmentInfo,
  type Segment,
  totalBits,
} from "./segments"
import { dataCodewords, type QrEcc, sizeOf } from "./tables"

export interface QrOptions {
  /** Error-correction level. Default `"M"`. */
  readonly ecc?: QrEcc | undefined
  /** Raise the level to the highest of M, Q, H that fits the chosen version. Default `false`. */
  readonly boostEcc?: boolean | undefined
  /** Smallest version to use (1–40). Default 1. */
  readonly minVersion?: number | undefined
  /** Largest version to use (1–40). Default 40. */
  readonly maxVersion?: number | undefined
  /** `-1` (automatic, default) or a mask from 0 to 7. */
  readonly mask?: number | undefined
  /** `"auto"` (default): an ECI UTF-8 segment before non-ASCII text; `"none"`: never. */
  readonly eci?: "auto" | "none" | undefined
}

export type QrResult =
  | {
      readonly ok: true
      readonly version: number
      readonly ecc: QrEcc
      readonly mask: number
      /** Modules per side, without quiet zone: `17 + 4 × version`. */
      readonly size: number
      /** Row-major; `true` is a dark module. Read-only. */
      readonly modules: readonly (readonly boolean[])[]
      readonly segments: readonly QrSegmentInfo[]
    }
  | {
      readonly ok: false
      readonly error: "too-long"
      readonly neededBits: number
      readonly availableBits: number
      readonly maxBytes: number
    }
  | { readonly ok: false; readonly error: "invalid-option"; readonly option: keyof QrOptions }
  | { readonly ok: false; readonly error: "invalid-input" }

export type QrSuccess = Extract<QrResult, { ok: true }>

const LEVELS = new Set<unknown>(["L", "M", "Q", "H"])
const isVersion = (v: unknown): v is number =>
  Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 40

function invalidOption(options: QrOptions): keyof QrOptions | undefined {
  const o = options as Readonly<Record<string, unknown>> // read by name to validate any caller
  if (o["ecc"] !== undefined && !LEVELS.has(o["ecc"])) return "ecc"
  if (o["boostEcc"] !== undefined && typeof o["boostEcc"] !== "boolean") return "boostEcc"
  if (o["minVersion"] !== undefined && !isVersion(o["minVersion"])) return "minVersion"
  if (o["maxVersion"] !== undefined && !isVersion(o["maxVersion"])) return "maxVersion"
  if ((options.minVersion ?? 1) > (options.maxVersion ?? 40)) return "minVersion"
  const mask = o["mask"]
  if (
    mask !== undefined &&
    !(Number.isInteger(mask) && (mask as number) >= -1 && (mask as number) <= 7)
  ) {
    return "mask"
  }
  if (o["eci"] !== undefined && o["eci"] !== "auto" && o["eci"] !== "none") return "eci"
  return undefined
}

/** Encodes a string (UTF-8) or bytes as a QR Code symbol. */
export function encodeQr(input: string | Uint8Array, options: QrOptions = {}): QrResult {
  if (typeof input !== "string" && !(input instanceof Uint8Array)) {
    return { ok: false, error: "invalid-input" }
  }
  if (options === null || typeof options !== "object") {
    return { ok: false, error: "invalid-option", option: "ecc" }
  }
  const bad = invalidOption(options)
  if (bad !== undefined) return { ok: false, error: "invalid-option", option: bad }
  const requested: QrEcc = options.ecc ?? "M"
  const min = options.minVersion ?? 1
  const max = options.maxVersion ?? 40
  const segments = makeSegments(input, options.eci ?? "auto")

  let version = min
  let used: number | undefined
  for (; ; version++) {
    used = totalBits(segments, version)
    const capacity = dataCodewords(version, requested) * 8
    if (used !== undefined && used <= capacity) break
    if (version >= max) {
      return {
        ok: false,
        error: "too-long",
        neededBits: used ?? neededAnyWidth(segments, version),
        availableBits: capacity,
        maxBytes: Math.floor((capacity - 4 - countBits("byte", version)) / 8),
      }
    }
  }
  let ecc = requested
  if (options.boostEcc === true) {
    for (const level of ["M", "Q", "H"] as const) {
      if (used <= dataCodewords(version, level) * 8) ecc = level
    }
  }

  const data = dataBytes(segments, version, ecc)
  const matrix = functionPatterns(version, ecc)
  placeCodewords(matrix, addEccAndInterleave(data, version, ecc))
  const mask = chooseMask(matrix, ecc, options.mask ?? -1)
  const size = sizeOf(version)
  const modules: boolean[][] = []
  for (let y = 0; y < size; y++) {
    const row: boolean[] = []
    for (let x = 0; x < size; x++) row.push(matrix.dark[y * size + x] === 1)
    modules.push(Object.freeze(row) as boolean[])
  }
  return {
    ok: true,
    version,
    ecc,
    mask,
    size,
    modules: Object.freeze(modules),
    segments: segments.map((s) => s.info),
  }
}

/** Bits needed when a count overflows its field: the data bits with the widest fields. */
const neededAnyWidth = (segments: readonly Segment[], version: number) =>
  segments.reduce((n, s) => n + 4 + countBits(s.info.mode, version) + s.bits.length, 0)

/** The data codewords: segments, terminator, byte alignment, then 0xEC 0x11 padding (internal; exported for tests). */
export function dataBytes(segments: readonly Segment[], version: number, ecc: QrEcc): Uint8Array {
  const capacity = dataCodewords(version, ecc) * 8
  const bits = packSegments(segments, version)
  const terminator = Math.min(4, capacity - bits.length)
  for (let i = 0; i < terminator; i++) bits.push(0)
  while (bits.length % 8 !== 0) bits.push(0)
  const out = new Uint8Array(capacity / 8)
  let n = 0
  for (; n < bits.length / 8; n++) {
    let byte = 0
    for (let i = 0; i < 8; i++) byte = (byte << 1) | (bits[n * 8 + i] ?? 0)
    out[n] = byte
  }
  for (let pad = 0xec; n < out.length; n++, pad ^= 0xec ^ 0x11) out[n] = pad
  return out
}
