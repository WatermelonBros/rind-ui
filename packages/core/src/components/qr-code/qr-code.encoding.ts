// The encoding a QR code renders (design §4): the encoder's result for the value and the
// option *values* (never the options object's identity), so an inline `encoding={{ ecc: "M" }}`
// re-rendered with the same value does not encode again.

import { encodeQr, type QrOptions, type QrResult, type QrSuccess } from "../../qr/encode"

export interface QrEncodingOptions extends QrOptions {
  /** Light modules around the symbol, inside the frame's viewBox. Default 4. */
  readonly quietZone?: number | undefined
}

export type QrEncodeFailure = Exclude<QrResult, { ok: true }>

/** `ready`: a symbol; `empty`: the value is `""`; `invalid`: the encoder failed. */
export type QrEncoded =
  | { readonly status: "ready"; readonly result: QrSuccess; readonly quietZone: number }
  | { readonly status: "empty"; readonly quietZone: number }
  | { readonly status: "invalid"; readonly error: QrEncodeFailure; readonly quietZone: number }

const KEYS = ["ecc", "boostEcc", "minVersion", "maxVersion", "mask", "eci"] as const

/** The memo key: the value and every option value, in a fixed order. */
export const qrEncodingKey = (value: string, options: QrEncodingOptions = {}): string =>
  JSON.stringify([value, options.quietZone ?? 4, ...KEYS.map((k) => options[k] ?? null)])

/** Modules per side of an empty or invalid frame: a version-1 symbol (layout keeps its size). */
export const QR_PLACEHOLDER_SIZE = 21

/** Encodes for the component: `""` is `empty`, a failure is `invalid`, never a throw. */
export function encodeForQrCode(value: string, options: QrEncodingOptions = {}): QrEncoded {
  const quietZone =
    Number.isInteger(options.quietZone) && (options.quietZone ?? 0) >= 0
      ? (options.quietZone ?? 4)
      : 4
  if (value === "") return { status: "empty", quietZone }
  const { quietZone: _qz, ...encoder } = options
  const result = encodeQr(value, encoder)
  return result.ok
    ? { status: "ready", result, quietZone }
    : { status: "invalid", error: result, quietZone }
}

/** A per-instance memo of `encodeForQrCode` keyed by value (`qrEncodingKey`). */
export function createQrEncoder(): {
  readonly encode: (value: string, options?: QrEncodingOptions) => QrEncoded
  /** How many times the encoder actually ran (tests: an inline options object encodes once). */
  readonly runs: () => number
} {
  let key: string | undefined
  let last: QrEncoded | undefined
  let runs = 0
  return {
    encode(value, options = {}) {
      const next = qrEncodingKey(value, options)
      if (next !== key || last === undefined) {
        key = next
        last = encodeForQrCode(value, options)
        runs++
      }
      return last
    },
    runs: () => runs,
  }
}

/** Modules per side of what the frame shows (the placeholder when there is no symbol). */
export const qrModules = (encoded: QrEncoded): number =>
  encoded.status === "ready" ? encoded.result.size : QR_PLACEHOLDER_SIZE
