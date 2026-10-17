// color-model (tasks 1.1–1.5): parsing, formatting, conversion with hue memory, channels,
// equality, names and gradients, with the bugs the scenarios cite.
import { describe, expect, it } from "vitest"
import { channelRange, getChannel, stepChannel, withChannel } from "./channels"
import { type Color, ColorParseError, makeColor } from "./color"
import { colorMemory, toSpace } from "./convert"
import { isEqualColor, isSameColor } from "./equal"
import { formatColor } from "./format"
import { areaBlendMode, areaGradient, channelGradient, channelStops } from "./gradient"
import { type ColorMessages, colorMessages } from "./messages"
import { colorName, describeColor, hueName } from "./name"
import { parseColor, toColor, tryParseColor } from "./parse"

const rgb = (r: number, g: number, b: number, a = 1) => makeColor("rgb", [r, g, b], a)

describe("parsing", () => {
  it("hex forms and case (react-spectrum#7547)", () => {
    for (const s of ["#E84E0F", "#e84e0f", "#E84E0FFF"]) {
      expect(parseColor(s)).toEqual(rgb(232, 78, 15))
    }
    expect(parseColor("#ABC")).toEqual(rgb(170, 187, 204))
    expect(parseColor("  #abc ")).toEqual(rgb(170, 187, 204))
    expect(parseColor("#FF000080")).toEqual(rgb(255, 0, 0, 0.5))
  })

  it("hue 360 survives, 370 wraps (react-spectrum#6202)", () => {
    expect(formatColor(parseColor("hsb(360, 100%, 100%)"), "hsb")).toBe("hsb(360, 100%, 100%)")
    expect(formatColor(parseColor("hsb(370, 100%, 100%)"), "hsb")).toBe("hsb(10, 100%, 100%)")
  })

  it("modern syntax", () => {
    expect(parseColor("rgb(12 34 56 / 50%)").alpha).toBe(0.5)
    expect(parseColor("hsl(210deg 60% 40%)").channels[0]).toBe(210)
    expect(parseColor("rgba(1, 2, 3, 0.25)")).toEqual(rgb(1, 2, 3, 0.25))
    expect(parseColor("hsla(10, 20%, 30%, 0.5)")).toEqual(makeColor("hsl", [10, 20, 30], 0.5))
    expect(parseColor("hsb(10, 20%, 30%)")).toEqual(makeColor("hsb", [10, 20, 30], 1))
  })

  it("clamps out-of-range channels", () => {
    expect(parseColor("rgb(300, -5, 128)")).toEqual(rgb(255, 0, 128))
    expect(parseColor("hsl(10, 150%, 30%)").channels[1]).toBe(100)
  })

  it("invalid input", () => {
    for (const s of ["#12", "blue", "rgb(1,2)", "#12345", "rgb(1,2,3,4,5)", "", "hsl(10%, 1, 1)"]) {
      expect(() => parseColor(s)).toThrow(ColorParseError)
      expect(tryParseColor(s)).toBeNull()
    }
  })

  it("transparent black is not a default (react-spectrum#6363)", () => {
    expect(parseColor("#0000")).toEqual(rgb(0, 0, 0, 0))
    expect(parseColor("transparent")).toEqual(rgb(0, 0, 0, 0))
  })

  it("a string and a colour behave the same (ark#2932)", () => {
    expect(toColor("#3366ff")).toEqual(toColor(parseColor("#3366ff")))
    expect(() => toColor({} as Color)).toThrow(ColorParseError)
  })

  it("survives structuredClone and JSON", () => {
    const c = parseColor("hsl(210, 60%, 40%)")
    expect(formatColor(structuredClone(c), "hex")).toBe(formatColor(c, "hex"))
    expect(formatColor(JSON.parse(JSON.stringify(c)), "rgb")).toBe(formatColor(c, "rgb"))
  })
})

describe("formatting", () => {
  it("alpha in hex", () => {
    expect(formatColor(rgb(255, 0, 0, 0.5), "hex")).toBe("#FF000080")
    expect(formatColor(rgb(255, 0, 0), "hex")).toBe("#FF0000")
  })

  it("legacy forms and css", () => {
    expect(formatColor(rgb(1, 2, 3), "rgb")).toBe("rgb(1, 2, 3)")
    expect(formatColor(rgb(1, 2, 3, 0.25), "rgb")).toBe("rgba(1, 2, 3, 0.25)")
    expect(formatColor(rgb(255, 0, 0), "hsl")).toBe("hsl(0, 100%, 50%)")
    expect(formatColor(rgb(255, 0, 0), "hsb")).toBe("hsb(0, 100%, 100%)")
    expect(formatColor(rgb(255, 0, 0), "css")).toBe("#FF0000")
    expect(formatColor(rgb(255, 0, 0, 0.5), "css")).toBe("rgba(255, 0, 0, 0.5)")
    expect(formatColor(makeColor("hsl", [10, 20, 30]), "css")).toBe("hsl(10, 20%, 30%)")
    expect(formatColor(makeColor("hsb", [0, 100, 100]), "css")).toBe("#FF0000")
  })

  it("locale independence: no comma decimal, no exponent", () => {
    const de = new Intl.NumberFormat("de-DE").format(0.25)
    expect(de).toBe("0,25")
    expect(formatColor(rgb(0, 0, 0, 0.25), "rgb")).toContain("0.25")
    expect(formatColor(makeColor("hsl", [1e-9, 0, 0]), "hsl")).toBe("hsl(0, 0%, 0%)")
  })

  it("round trip over a 4096-colour grid, every grey and the primaries", () => {
    const colors: Color[] = []
    for (let r = 0; r < 256; r += 17)
      for (let g = 0; g < 256; g += 17) for (let b = 0; b < 256; b += 17) colors.push(rgb(r, g, b))
    for (let v = 0; v < 256; v++) colors.push(rgb(v, v, v))
    colors.push(rgb(255, 0, 0), rgb(0, 255, 0), rgb(0, 0, 255), rgb(255, 255, 0), rgb(0, 255, 255))
    for (const c of colors) {
      for (const f of ["hex", "rgb", "hsl", "hsb"] as const) {
        const back = toSpace(parseColor(formatColor(c, f)), "rgb")
        expect(back.channels, `${formatColor(c, "hex")} via ${f}`).toEqual(c.channels)
      }
    }
  })
})

describe("conversion and hue memory", () => {
  it("hue survives grey in the area's space (react-spectrum#9509)", () => {
    const c = makeColor("hsb", [120, 0, 100])
    const viaRgb = toSpace(c, "rgb")
    expect(toSpace(viaRgb, "hsb", { hue: 120 })).toEqual(c)
    expect(toSpace(viaRgb, "hsb")).toEqual(makeColor("hsb", [0, 0, 100]))
  })

  it("identity", () => {
    const c = makeColor("hsb", [10, 20, 30])
    expect(toSpace(c, "hsb")).toBe(c)
  })

  it("hsl and hsb agree", () => {
    const c = makeColor("hsb", [210, 60, 80])
    expect(toSpace(toSpace(c, "hsl"), "rgb")).toEqual(toSpace(c, "rgb"))
  })

  it("keeps the hue a source carries between hsl and hsb", () => {
    expect(toSpace(makeColor("hsb", [200, 50, 0]), "hsl").channels[0]).toBe(200)
    expect(toSpace(makeColor("hsl", [200, 0, 100]), "hsb").channels[0]).toBe(200)
  })

  it("colorMemory keeps the previous hue for achromatic colours", () => {
    expect(colorMemory(rgb(255, 0, 0))).toEqual({ hue: 0, saturation: 100 })
    expect(colorMemory(rgb(0, 0, 0), { hue: 120, saturation: 40 })).toEqual({
      hue: 120,
      saturation: 40,
    })
    expect(colorMemory(makeColor("hsb", [200, 0, 0]), { hue: 1 }).hue).toBe(200)
  })
})

describe("channels", () => {
  it("ranges", () => {
    expect(channelRange("rgb", "red")).toEqual({
      min: 0,
      max: 255,
      step: 1,
      pageStep: 17,
      precision: 0,
    })
    expect(channelRange("hsb", "hue").pageStep).toBe(15)
    expect(channelRange("hsb", "alpha").step).toBe(0.01)
  })

  it("a channel the space lacks (zag#2389, ark#1649, react-spectrum#4561)", () => {
    expect(getChannel(rgb(255, 0, 0), "hue")).toBe(0)
    const c = withChannel(rgb(255, 0, 0), "saturation", 50)
    expect(c.space).toBe("hsb")
    expect(c.channels[1]).toBe(50)
    expect(getChannel(rgb(255, 0, 0), "lightness")).toBe(50)
  })

  it("clamp and precision", () => {
    const c = makeColor("hsb", [10, 20, 30])
    expect(withChannel(c, "hue", 400).channels[0]).toBe(360)
    expect(withChannel(c, "alpha", 0.3333).alpha).toBe(0.33)
  })

  it("no drift", () => {
    let c = rgb(0, 0, 0, 0)
    for (let i = 0; i < 100; i++) c = stepChannel(c, "alpha", 1)
    expect(c.alpha).toBe(1)
  })

  it("no-op write returns the same object", () => {
    const c = rgb(255, 0, 0)
    expect(withChannel(c, "red", 255)).toBe(c)
  })

  it("page step", () => {
    expect(stepChannel(makeColor("hsb", [100, 50, 50]), "hue", 1, { page: true }).channels[0]).toBe(
      115,
    )
  })
})

describe("equality", () => {
  it("different spaces, same colour", () => {
    expect(isSameColor(makeColor("hsb", [0, 100, 100]), rgb(255, 0, 0))).toBe(true)
    expect(isEqualColor(makeColor("hsb", [0, 100, 100]), rgb(255, 0, 0))).toBe(false)
  })

  it("alpha bytes", () => {
    expect(isSameColor(rgb(0, 0, 0, 0.5), rgb(0, 0, 0, 0.502))).toBe(true)
    expect(isSameColor(rgb(0, 0, 0, 0.5), rgb(0, 0, 0, 0.6))).toBe(false)
  })
})

describe("names", () => {
  it("names", () => {
    const name = (hex: string) => colorName(parseColor(hex), colorMessages)
    expect(name("#FF0000")).toBe("vibrant red")
    expect(name("#000000")).toBe("black")
    expect(name("#FFFFFF")).toBe("white")
    expect(name("#808080")).toBe("gray")
    expect(name("#00000000")).toBe("transparent")
    expect(name("#00FF00")).toBe("vibrant green")
    expect(name("#0000FF")).toBe("vibrant blue")
    expect(name("#FF000080")).toBe("vibrant red, 50% transparent")
  })

  it("thresholds", () => {
    expect(describeColor(parseColor("#8B4513")).hue).toBe("brown")
    expect(describeColor(parseColor("#1a1a2e")).lightness).toBe("veryDark")
    expect(describeColor(parseColor("#c8d0d8")).chroma).toBe("pale")
    expect(hueName(makeColor("hsb", [240, 100, 100]), colorMessages)).toBe("blue")
    expect(hueName(makeColor("hsb", [240, 0, 0]), colorMessages)).toBe("blue")
  })

  it("translated", () => {
    const it: ColorMessages = {
      ...colorMessages,
      red: "rosso",
      blue: "blu",
      vibrant: "vivace",
      colorName: ({ lightness, chroma, hue }) => [hue, chroma, lightness].filter(Boolean).join(" "),
    }
    const name = colorName(parseColor("#0000FF"), it)
    expect(name).toBe("blu vivace")
    expect(name).not.toMatch(/blue|vibrant/)
  })
})

describe("gradients", () => {
  it("hue strip has seven stops and no NaN; RTL starts at the right (zag#2666)", () => {
    const g = channelGradient(makeColor("hsb", [200, 50, 50]), "hue", { direction: "to left" })
    expect(g.startsWith("linear-gradient(to left, ")).toBe(true)
    expect(g.match(/%/g)).toHaveLength(7)
    expect(g).not.toContain("NaN")
  })

  it("any space, any channel", () => {
    expect(() => channelGradient(rgb(255, 0, 0), "hue")).not.toThrow()
    expect(channelStops(rgb(255, 0, 0), "lightness")).toHaveLength(3)
    expect(channelGradient(rgb(12, 34, 56), "alpha")).toBe(
      "linear-gradient(to right, rgba(12, 34, 56, 0) 0%, #0C2238 100%)",
    )
  })

  it("area corners (saturation × brightness)", () => {
    const g = areaGradient(makeColor("hsb", [200, 50, 50]), "saturation", "brightness")
    // Brightness: black at the bottom, clear at the top; saturation: white to the pure hue.
    expect(g).toContain("linear-gradient(to top, #000000 0%, transparent 100%)")
    expect(g).toContain(`#FFFFFF 0%, ${formatColor(makeColor("hsb", [200, 100, 100]), "css")} 100%`)
    expect(areaBlendMode("saturation", "brightness")).toBe("normal")
  })

  it("rgb area blends with screen and has no NaN; every pair works", () => {
    expect(areaBlendMode("red", "green")).toBe("screen")
    const pairs = [
      ["saturation", "brightness"],
      ["brightness", "saturation"],
      ["saturation", "lightness"],
      ["hue", "saturation"],
      ["hue", "brightness"],
      ["hue", "lightness"],
      ["red", "green"],
      ["blue", "red"],
    ] as const
    for (const [x, y] of pairs) {
      const g = areaGradient(rgb(10, 200, 30), x, y, { rtl: true })
      expect(g, `${x} × ${y}`).not.toContain("NaN")
      expect(g).toContain("to left")
    }
  })
})
