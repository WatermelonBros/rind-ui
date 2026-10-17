// qr-encoder decodability (add-qr-code 1.7): the encoder against an independent decoder over
// every version, level and mask, a damaged symbol, the reference implementations' matrices
// (differential fixtures) and the path parser.
import { encodeQr, parseQrPath, type QrEcc, type QrResult, qrPath } from "@rind-ui/core/qr"
import { describe, expect, it } from "vitest"
import { alignmentTable, correctBlock, decodeQr, QrDecodeError } from "./decode"
import fixtures from "./fixtures/differential.json" with { type: "json" }

const LEVELS: readonly QrEcc[] = ["L", "M", "Q", "H"]
const ok = (r: QrResult) => {
  if (!r.ok) throw new Error(`expected a symbol, got ${JSON.stringify(r)}`)
  return r
}

/** A deterministic pseudo-random generator, so a failure reproduces. */
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

describe("decoder", () => {
  it("decodes the Annex I symbol and reports its format", () => {
    const d = decodeQr(ok(encodeQr("01234567", { ecc: "M" })).modules)
    expect([d.text, d.version, d.ecc]).toEqual(["01234567", 1, "M"])
    expect(d.segments).toEqual([{ mode: "numeric", chars: 8 }])
  })

  it("rejects a matrix that is no QR size", () => {
    expect(() => decodeQr([[true]])).toThrow(QrDecodeError)
  })

  it("its alignment table is the standard's (independent of the encoder)", () => {
    expect(alignmentTable(1)).toEqual([])
    expect(alignmentTable(40)).toEqual([6, 30, 58, 86, 114, 142, 170])
  })

  it("corrects up to half the ECC codewords and refuses more", () => {
    const block = Uint8Array.from([
      16, 32, 12, 86, 97, 128, 236, 17, 236, 17, 236, 17, 236, 17, 236, 17, 165, 36, 212, 193, 237,
      54, 199, 135, 44, 85,
    ])
    const damaged = block.slice()
    for (const i of [0, 7, 20, 25, 3]) damaged[i] = (damaged[i] ?? 0) ^ 0x5a
    expect(correctBlock(damaged, 10)).toBe(5)
    expect(damaged).toEqual(block)
    const ruined = block.slice()
    for (const i of [0, 1, 2, 3, 4, 5]) ruined[i] = (ruined[i] ?? 0) ^ 0xff
    expect(() => correctBlock(ruined, 10)).toThrow(QrDecodeError)
  })
})

describe("Decodability: round trip over all versions", () => {
  it.each(LEVELS)(
    "level %s: a maximum-length value for each of the 40 versions",
    (ecc) => {
      const random = rng(ecc.charCodeAt(0))
      for (let version = 1; version <= 40; version++) {
        const opts = { ecc, minVersion: version, maxVersion: version }
        // The longest byte value that fits this version (binary search on the encoder's verdict).
        let n = 0
        for (let hi = 3000; n < hi; ) {
          const mid = Math.ceil((n + hi) / 2)
          if (encodeQr(new Uint8Array(mid), opts).ok) n = mid
          else hi = mid - 1
        }
        const value = Uint8Array.from({ length: n }, () => Math.floor(random() * 256))
        const r = ok(encodeQr(value, opts))
        const d = decodeQr(r.modules)
        expect([d.version, d.ecc, d.mask]).toEqual([version, ecc, r.mask])
        expect(d.bytes).toEqual(value)
      }
    },
    30_000,
  ) // a deadline for 40 versions of round trips under a loaded machine, not a delay

  it("random text in every mode, at every level with every forced mask", () => {
    const random = rng(42)
    const alphabet = [
      "0123456789",
      "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:",
      "abcxyz-_?=&é世😀",
    ]
    for (const ecc of LEVELS) {
      for (let mask = 0; mask < 8; mask++) {
        for (const set of alphabet) {
          const chars = [...set]
          const length = 1 + Math.floor(random() * 120)
          const value = Array.from(
            { length },
            () => chars[Math.floor(random() * chars.length)],
          ).join("")
          const d = decodeQr(ok(encodeQr(value, { ecc, mask })).modules)
          expect([d.text, d.ecc, d.mask]).toEqual([value, ecc, mask])
        }
      }
    }
  })

  it("lone surrogate decodes to U+FFFD, ECI only for non-ASCII", () => {
    expect(decodeQr(ok(encodeQr("a\uD83D")).modules).text).toBe("a�")
    const korean = decodeQr(ok(encodeQr("홍길동")).modules)
    expect(korean.text).toBe("홍길동")
    expect(korean.segments[0]).toEqual({ mode: "eci", assignment: 26 })
  })

  it("binary payload decodes to the same bytes (nayuki#104)", () => {
    const value = Uint8Array.from({ length: 64 }, (_, i) => (i * 37) & 255)
    expect(decodeQr(ok(encodeQr(value)).modules).bytes).toEqual(value)
  })

  it("the empty string is a version-1 symbol with no data", () => {
    const d = decodeQr(ok(encodeQr("")).modules)
    expect([d.version, d.text, d.segments]).toEqual([1, "", []])
  })
})

describe("Decodability: damaged symbol", () => {
  it("modules flipped in fewer codewords than the level corrects still decode", () => {
    for (const ecc of LEVELS) {
      const value = `https://rind.example/d?l=${ecc}`
      const r = ok(encodeQr(value, { ecc, minVersion: 4, maxVersion: 4 }))
      const modules = r.modules.map((row) => [...row])
      // A 3 × 3 patch of data modules at the right edge, below the top-right finder:
      // at most two codewords, fewer than any level corrects at version 4.
      for (let y = 12; y < 15; y++) {
        for (let x = r.size - 3; x < r.size; x++) {
          const row = modules[y]
          if (row) row[x] = !row[x]
        }
      }
      const d = decodeQr(modules)
      expect(d.text).toBe(value)
      expect(d.corrected).toBeGreaterThan(0)
    }
  })
})

describe("Differential output against the reference implementations", () => {
  it.each(fixtures.cases.map((c) => [`${c.name} ${c.ecc}`, c] as const))("%s", (_, c) => {
    const input = "bytes" in c.input ? Uint8Array.from(c.input.bytes) : c.input.text
    const forced = c.name.startsWith("forced-mask-") ? c.mask : -1
    const r = ok(encodeQr(input, { ecc: c.ecc as QrEcc, mask: forced, eci: "none" }))
    expect([r.version, r.mask]).toEqual([c.version, c.mask])
    expect(r.modules.map((row) => row.map((b) => (b ? "1" : "0")).join(""))).toEqual(c.rows)
  })
})

describe("parseQrPath", () => {
  it("reads the rendered path back into the matrix, nothing in the quiet zone", () => {
    const r = ok(encodeQr("https://example.com"))
    const n = r.size + 8
    const parsed = parseQrPath(qrPath(r.modules), `0 0 ${n} ${n}`, r.size)
    expect(parsed.modules).toEqual(r.modules)
    expect([parsed.quietZone, parsed.darkInQuietZone]).toEqual([4, false])
  })

  it("flags a dark module drawn in the quiet zone and foreign commands", () => {
    expect(parseQrPath("M0 0h1v1H0z", "0 0 29 29", 21).darkInQuietZone).toBe(true)
    expect(() => parseQrPath("M4 4L5 5", "0 0 29 29", 21)).toThrow()
  })
})
