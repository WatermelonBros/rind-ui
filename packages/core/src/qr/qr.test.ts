// qr-encoder (add-qr-code 1.1–1.6): published vectors (ISO/IEC 18004 Annex I, the format and
// version words, the capacity and alignment tables), option and input validation, the path
// and the standalone SVG. Round trips through a decoder are in @rind-ui/testing (qr.test.ts).
import { describe, expect, it } from "vitest"
import pkg from "../../package.json" with { type: "json" }
import { dataBytes, encodeQr } from "./encode"
import { applyMask, darkProportionPenalty, penalty } from "./mask"
import { formatBits, functionPatterns, placeCodewords, versionBits } from "./matrix"
import { qrPath } from "./path"
import { addEccAndInterleave, rsRemainder } from "./reed-solomon"
import { makeSegments, packSegments, utf8 } from "./segments"
import { renderQrSvg } from "./svg"
import { alignmentPositions, dataCodewords, type QrEcc } from "./tables"

const ok = (r: ReturnType<typeof encodeQr>) => {
  if (!r.ok) throw new Error(`expected a symbol, got ${JSON.stringify(r)}`)
  return r
}
const bytes = (n: number, seed = 7) =>
  Uint8Array.from({ length: n }, (_, i) => (i * seed + 3) & 255)

describe("Encoding Result", () => {
  it("success result", () => {
    const r = ok(encodeQr("01234567", { ecc: "M" }))
    expect([r.version, r.ecc, r.size, r.modules.length, r.modules[0]?.length]).toEqual([
      1,
      "M",
      21,
      21,
      21,
    ])
  })

  it("too long is a result (react-qr-code#255, qrcode.react#225)", () => {
    const r = encodeQr(bytes(3000), { ecc: "L" })
    expect(r).toMatchObject({ ok: false, error: "too-long", maxBytes: 2953 })
    if (!r.ok && r.error === "too-long") expect(r.neededBits).toBeGreaterThan(r.availableBits)
  })

  it("wrong input type (uqr#2)", () => {
    expect(encodeQr(123 as never)).toEqual({ ok: false, error: "invalid-input" })
    expect(encodeQr(null as never)).toEqual({ ok: false, error: "invalid-input" })
  })

  it("deterministic and read-only", () => {
    const a = ok(encodeQr("https://example.com/ü"))
    const b = ok(encodeQr("https://example.com/ü"))
    expect(a.modules).toEqual(b.modules)
    expect(Object.isFrozen(a.modules)).toBe(true)
    expect(Object.isFrozen(a.modules[0])).toBe(true)
  })
})

describe("Input And Character Encoding", () => {
  it("UTF-8 matches TextEncoder over every code point, lone surrogates as U+FFFD", () => {
    const enc = new TextEncoder()
    for (let cp = 0; cp <= 0x10ffff; cp += cp < 0x3000 ? 1 : 97) {
      const s = cp >= 0xd800 && cp <= 0xdfff ? String.fromCharCode(cp) : String.fromCodePoint(cp)
      expect(utf8(s)).toEqual(enc.encode(s))
    }
    expect(utf8("a\uD83D")).toEqual(enc.encode("a\uD83D"))
  })

  it("non-ASCII text carries an ECI segment (react-qr-code#283, nayuki#154)", () => {
    expect(ok(encodeQr("홍길동")).segments).toEqual([
      { mode: "eci", assignment: 26 },
      { mode: "byte", chars: 9 },
    ])
    expect(ok(encodeQr("홍길동", { eci: "none" })).segments).toEqual([{ mode: "byte", chars: 9 }])
  })

  it("ASCII has no ECI", () => {
    expect(ok(encodeQr("https://example.com")).segments).toEqual([{ mode: "byte", chars: 19 }])
  })

  it("binary payload: one byte segment, no ECI", () => {
    expect(ok(encodeQr(bytes(64))).segments).toEqual([{ mode: "byte", chars: 64 }])
  })

  it("empty string", () => {
    const r = ok(encodeQr(""))
    expect([r.version, r.segments]).toEqual([1, []])
  })
})

describe("Segment Mode Selection", () => {
  it("digits: the Annex I bit stream", () => {
    const segs = makeSegments("01234567", "auto")
    expect(segs.map((s) => s.info)).toEqual([{ mode: "numeric", chars: 8 }])
    expect(packSegments(segs, 1).join("")).toBe(
      ["0001", "0000001000", "0000001100", "0101011001", "1000011"].join(""),
    )
  })

  it("alphanumeric, and one lowercase letter falls to byte (nayuki#166)", () => {
    expect(ok(encodeQr("HTTPS://EXAMPLE.COM/A")).segments[0]?.mode).toBe("alphanumeric")
    expect(ok(encodeQr("HTTPS://EXAMPLE.COM/a")).segments[0]?.mode).toBe("byte")
  })

  it("count field width follows the version", () => {
    const r = ok(encodeQr(bytes(300), { ecc: "L" }))
    expect(r.version).toBe(11)
    expect(
      packSegments(makeSegments(bytes(300), "auto"), 11)
        .slice(4, 20)
        .join(""),
    ).toBe((300).toString(2).padStart(16, "0"))
  })
})

describe("Version And Capacity", () => {
  // [level, version, digits, alphanumeric, bytes]
  const capacities: [QrEcc, number, number, number, number][] = [
    ["L", 40, 7089, 4296, 2953],
    ["M", 40, 5596, 3391, 2331],
    ["Q", 40, 3993, 2420, 1663],
    ["H", 40, 3057, 1852, 1273],
    ["L", 1, 41, 25, 17],
    ["M", 1, 34, 20, 14],
    ["H", 1, 17, 10, 7],
  ]
  it.each(capacities)("capacity at level %s version %i", (ecc, version, digits, alnum, n) => {
    const opts = { ecc, minVersion: version, maxVersion: version }
    expect(ok(encodeQr("1".repeat(digits), opts)).version).toBe(version)
    expect(encodeQr("1".repeat(digits + 1), opts).ok).toBe(false)
    expect(ok(encodeQr("A".repeat(alnum), opts)).version).toBe(version)
    expect(encodeQr("A".repeat(alnum + 1), opts).ok).toBe(false)
    expect(ok(encodeQr(bytes(n), opts)).version).toBe(version)
    expect(encodeQr(bytes(n + 1), opts).ok).toBe(false)
  })

  it("exactly at the version-40 capacity (nayuki#32)", () => {
    expect(ok(encodeQr(bytes(2953), { ecc: "L" })).version).toBe(40)
    expect(encodeQr(bytes(2954), { ecc: "L" })).toMatchObject({ error: "too-long" })
  })

  it("version 1 boundary", () => {
    expect(ok(encodeQr(bytes(17), { ecc: "L" })).version).toBe(1)
    expect(ok(encodeQr(bytes(18), { ecc: "L" })).version).toBe(2)
  })

  it("forced minimum version", () => {
    expect(ok(encodeQr("hi", { minVersion: 5 })).version).toBe(5)
  })

  it("UTF-16 length is not byte length", () => {
    const r = encodeQr("😀".repeat(1000), { ecc: "L" })
    expect(r).toMatchObject({ ok: false, error: "too-long", maxBytes: 2953 })
    if (!r.ok && r.error === "too-long") expect(r.neededBits).toBe(4 + 8 + 4 + 16 + 4000 * 8)
  })

  it("invalid version options", () => {
    for (const o of [{ minVersion: 0 }, { maxVersion: 41 }, { minVersion: 1.5 }]) {
      expect(encodeQr("x", o)).toMatchObject({ ok: false, error: "invalid-option" })
    }
    expect(encodeQr("x", { minVersion: 9, maxVersion: 3 })).toMatchObject({ option: "minVersion" })
  })
})

describe("Error Correction", () => {
  it("invalid level (qrcode.react#199)", () => {
    expect(encodeQr("x", { ecc: "h" as never })).toEqual({
      ok: false,
      error: "invalid-option",
      option: "ecc",
    })
  })

  it("no silent boost (qrcode.react#356), explicit boost", () => {
    expect(ok(encodeQr("A", { ecc: "L" })).ecc).toBe("L")
    const r = ok(encodeQr("A", { ecc: "L", boostEcc: true }))
    expect([r.ecc, r.version]).toEqual(["H", 1])
  })

  it("other invalid options", () => {
    expect(encodeQr("x", { mask: 8 })).toMatchObject({ option: "mask" })
    expect(encodeQr("x", { eci: "yes" as never })).toMatchObject({ option: "eci" })
    expect(encodeQr("x", { boostEcc: 1 as never })).toMatchObject({ option: "boostEcc" })
  })
})

describe("Reed-Solomon And Interleaving", () => {
  it("Annex I example codewords", () => {
    const data = dataBytes(makeSegments("01234567", "auto"), 1, "M")
    expect([...data]).toEqual([
      16, 32, 12, 86, 97, 128, 236, 17, 236, 17, 236, 17, 236, 17, 236, 17,
    ])
    expect([...rsRemainder(data, 10)]).toEqual([165, 36, 212, 193, 237, 54, 199, 135, 44, 85])
  })

  it("multiple blocks interleave (version 5-Q: 2 × 15 and 2 × 16 data codewords)", () => {
    const data = Uint8Array.from({ length: dataCodewords(5, "Q") }, (_, i) => i)
    const out = addEccAndInterleave(data, 5, "Q")
    // Block starts: 0, 15, 30, 46. Codeword 0 of every block, then codeword 1, …
    expect([...out.subarray(0, 8)]).toEqual([0, 15, 30, 46, 1, 16, 31, 47])
    // After the 15 shared columns only the two longer blocks have a 16th data codeword.
    expect([...out.subarray(60, 62)]).toEqual([45, 61])
    // Then the ECC codewords, block by block.
    expect(out[62]).toBe(rsRemainder(data.subarray(0, 15), 18)[0])
    expect(out[63]).toBe(rsRemainder(data.subarray(15, 30), 18)[0])
  })
})

describe("Matrix Construction", () => {
  it("format information words for mask 0", () => {
    const words = (["L", "M", "Q", "H"] as const).map((e) =>
      formatBits(e, 0).toString(2).padStart(15, "0"),
    )
    expect(words).toEqual([
      "111011111000100",
      "101010000010010",
      "011010101011111",
      "001011010001001",
    ])
  })

  it("version information of version 7", () => {
    expect(versionBits(7).toString(2).padStart(18, "0")).toBe("000111110010010100")
  })

  it("alignment positions for every version equal the standard's table (nayuki#214)", () => {
    // ISO/IEC 18004 Annex E.
    // prettier-ignore
    const table = [
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
    for (let v = 1; v <= 40; v++) expect(alignmentPositions(v)).toEqual(table[v])
  })

  it("function patterns survive masking", () => {
    for (const version of [1, 2, 7, 21, 40]) {
      const m = functionPatterns(version, "Q")
      placeCodewords(m, new Uint8Array(1000).fill(0xa5))
      const before = m.dark.slice()
      for (let n = 0; n < 8; n++) {
        applyMask(m, n)
        for (let i = 0; i < before.length; i++) {
          if (m.fixed[i] === 1 && m.dark[i] !== before[i])
            throw new Error(`v${version} mask ${n} changed ${i}`)
        }
        applyMask(m, n)
      }
      // The dark module.
      expect(m.dark[(4 * version + 9) * m.size + 8]).toBe(1)
    }
  })
})

describe("Mask Selection", () => {
  const score = (value: string, mask: number) => {
    const r = ok(encodeQr(value, { mask }))
    const size = r.size
    const dark = Uint8Array.from(r.modules.flat(), (b) => (b ? 1 : 0))
    return penalty({ size, dark, fixed: new Uint8Array(size * size) })
  }

  it("auto mask equals the minimum penalty, lowest number on a tie", () => {
    for (const value of ["hello", "https://example.com/path?q=1", "1".repeat(120), "ÜBER"]) {
      const auto = ok(encodeQr(value))
      const scores = Array.from({ length: 8 }, (_, n) => score(value, n))
      const min = Math.min(...scores)
      expect(scores.indexOf(min)).toBe(auto.mask)
    }
  })

  it("rule 4: 10 points per 5 % step away from a balanced dark share", () => {
    expect(darkProportionPenalty(50, 100)).toBe(0)
    expect(darkProportionPenalty(54, 100)).toBe(0)
    expect(darkProportionPenalty(56, 100)).toBe(10)
    expect(darkProportionPenalty(40, 100)).toBe(10)
    expect(darkProportionPenalty(39, 100)).toBe(20)
    expect(darkProportionPenalty(0, 100)).toBe(90)
  })

  it("forced mask", () => {
    const r = ok(encodeQr("hello", { mask: 3 }))
    expect(r.mask).toBe(3)
    const word = formatBits(r.ecc, 3)
    const read = [0, 1, 2, 3, 4, 5].map((i) => (r.modules[i]?.[8] ? 1 : 0))
    expect(read).toEqual([0, 1, 2, 3, 4, 5].map((i) => (word >>> i) & 1))
  })
})

describe("Path And Standalone SVG", () => {
  it("run merging", () => {
    expect(qrPath([[true, true, true, false, true]], { quietZone: 0 })).toBe(
      "M0 0h3v1H0zM4 0h1v1H4z",
    )
  })

  it("path offsets by the quiet zone and has fewer subpaths than dark modules", () => {
    const r = ok(encodeQr("hello"))
    const d = qrPath(r.modules)
    expect(d.startsWith("M4 4h7")).toBe(true) // top-left finder row
    expect(d.split("M").length - 1).toBeLessThan(r.modules.flat().filter(Boolean).length)
  })

  it("attribute injection (uqr#9) and valid attribute names (qrcode.react#113)", () => {
    const svg = renderQrSvg(ok(encodeQr("x")), {
      background: '"><script>alert(1)</script>',
      title: "<b>",
    })
    expect(svg).not.toContain("<script")
    expect(svg).toContain('shape-rendering="crispEdges"')
    expect(svg).not.toContain("shapeRendering")
    expect(svg).toContain('viewBox="0 0 29 29"')
  })
})

describe("Performance And Footprint", () => {
  it("version 40 at level H with the automatic mask in under 100 ms", () => {
    encodeQr(bytes(100), { ecc: "H" }) // warm up the JIT
    const start = performance.now()
    const r = ok(encodeQr(bytes(1273), { ecc: "H" }))
    const elapsed = performance.now() - start
    expect(r.version).toBe(40)
    expect(elapsed).toBeLessThan(100)
  })

  it("no QR-related runtime dependency", () => {
    expect(Object.keys(pkg.dependencies)).not.toContain("uqr")
    expect(Object.keys(pkg.dependencies).some((d) => /qr/i.test(d))).toBe(false)
  })
})
