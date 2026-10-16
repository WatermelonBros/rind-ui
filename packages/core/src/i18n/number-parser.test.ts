import { describe, expect, it } from "vitest"
import { createNumberParser, keypadDecimal } from "./number-parser"

const p = createNumberParser

describe("number-parsing: parse in the locale", () => {
  it("German currency", () => {
    expect(p("de-DE", { style: "currency", currency: "EUR" }).parse("1.234,56 €")).toBe(1234.56)
  })

  it("Percent without float error (zag#2783)", () => {
    expect(p("en-US", { style: "percent" }).parse("414%")).toBe(4.14)
  })

  it("Accounting negative", () => {
    const acc = p("en-US", { style: "currency", currency: "USD", currencySign: "accounting" })
    expect(acc.parse("($57.00)")).toBe(-57)
  })

  it("Plural unit literals (react-spectrum#6861)", () => {
    const o = { style: "unit", unit: "day", unitDisplay: "long" } as const
    const text = new Intl.NumberFormat("ar", o).format(2)
    expect(p("ar", o).parse(text)).toBe(2)
  })

  it("Implausible text (base-ui#5424)", () => {
    expect(p("en-US").parse("1.2.3")).toBeNull()
    expect(p("en-US").parse("abc")).toBeNull()
    expect(p("en-US").parse("  ")).toBeNull()
  })

  it("ASCII signs everywhere; locale separators", () => {
    expect(p("de-CH").parse("1’234.5")).toBe(1234.5)
    expect(p("fr-FR").parse("1 234,5")).toBe(1234.5)
    expect(p("pt-BR", { style: "currency", currency: "BRL" }).parse("R$ 12,50")).toBe(12.5)
    expect(p("en-US").parse("-3")).toBe(-3)
    expect(p("en-US").parse("+3")).toBe(3)
  })

  it("per-mille and units", () => {
    expect(p("en-US", { style: "unit", unit: "milliliter" }).parse("5 mL")).toBe(5)
  })
})

describe("number-parsing: numbering systems", () => {
  it("Persian digits (base-ui#4718)", () => {
    expect(p("fa-IR").parse("۱۲۳")).toBe(123)
    expect(p("en-US").parse("۱۲۳")).toBe(123)
  })
  it("Arabic digits", () => expect(p("ar-EG").parse("١٢٣")).toBe(123))
  it("Hindi digits (react-spectrum#6623)", () => expect(p("hi-IN").parse("१२३")).toBe(123))
  it("Bengali digits", () => expect(p("bn-BD").parse("১২৩")).toBe(123))
  it("Full-width digits from an IME (zag#1507)", () => expect(p("ja-JP").parse("１２")).toBe(12))
  it("keeps the typed numbering system when formatting", () => {
    const ar = p("ar-EG")
    const nu = ar.numberingSystem("123")
    expect(ar.format(123, { numberingSystem: nu })).toBe("123")
  })
})

describe("number-parsing: partial input", () => {
  it("Deleting before a group separator (react-spectrum#5927)", () => {
    expect(p("en-US").isPartial(",337")).toBe(true)
    expect(p("en-US").parse(",337")).toBe(337)
  })

  it("Multi-character currency (base-ui#5107)", () => {
    const brl = p("pt-BR", { style: "currency", currency: "BRL" })
    expect(brl.isPartial("R$ 12")).toBe(true)
    expect(brl.isPartial("R$ 12,")).toBe(true)
    expect(brl.isPartial("R")).toBe(true)
  })

  it("Minus not allowed", () => {
    expect(p("en-US").isPartial("-", { allowNegative: false })).toBe(false)
    expect(p("en-US").isPartial("-")).toBe(true)
  })

  it("Integer format", () => {
    expect(p("en-US", { maximumFractionDigits: 0 }).isPartial("1.")).toBe(false)
    expect(p("en-US").isPartial("1.")).toBe(true)
  })

  it("incomplete unit literals, and garbage", () => {
    const ml = p("en-US", { style: "unit", unit: "milliliter" })
    expect(ml.isPartial("5 m")).toBe(true)
    expect(ml.isPartial("5 ")).toBe(true)
    expect(p("en-US").isPartial("1a")).toBe(false)
    expect(p("en-US").isPartial("")).toBe(true)
  })
})

describe("number-parsing: keypad decimal separator", () => {
  it("Italian iPhone, English field", () => {
    const en = p("en-US")
    expect(keypadDecimal(",", en, "it-IT")).toBe(".")
    expect(en.parse(`1${keypadDecimal(",", en, "it-IT")}5`)).toBe(1.5)
    expect(keypadDecimal(".", p("de-DE"), "en-US")).toBe(",")
    expect(keypadDecimal("5", en, "it-IT")).toBe("5")
  })
})

describe("number-parsing: formatting", () => {
  it("No silent rounding (base-ui#5420)", () => {
    expect(p("en-US").format(1.23456)).toBe("1.23456")
    expect(p("en-US").format(1, { step: 0.25 })).toBe("1")
    expect(p("en-US", { style: "percent" }).format(0.1234)).toBe("12.34%")
  })

  it("Explicit rounding", () => {
    const two = p("en-US", { maximumFractionDigits: 2 })
    const v = two.parse(two.format(1.239))
    expect(v).toBe(1.24)
    expect(two.format(1.239)).toBe("1.24")
  })

  it("Inline options object (react-spectrum#1893): equal options reuse one parser", () => {
    expect(p("en-US", { style: "percent" })).toBe(p("en-US", { style: "percent" }))
    expect(p("en-US", { currency: "EUR", style: "currency" })).toBe(
      p("en-US", { style: "currency", currency: "EUR" }),
    )
  })
})

describe("number-parsing: value text", () => {
  it("Negative currency", () => {
    const acc = p("en-US", { style: "currency", currency: "USD", currencySign: "accounting" })
    expect(acc.valueText(-57)).toBe("−$57.00")
    expect(p("en-US").valueText(-3)).toBe("−3")
  })
})
