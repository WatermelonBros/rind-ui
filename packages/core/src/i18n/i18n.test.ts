import { describe, expect, it } from "vitest"
import { directionOf, isRTL } from "./direction"
import { fixedLocale } from "./locale"
import { collator, number, plural, resolveMessages } from "./messages"

const dialogMessages = {
  close: "Close",
  results: (n: number) => plural("en", n, { one: "# result", other: "# results" }),
}

describe("messages", () => {
  it("a partial override keeps every other English default", () => {
    const m = resolveMessages(dialogMessages, { close: "Chiudi" })
    expect(m.close).toBe("Chiudi")
    expect(m.results(2)).toBe("2 results")
  })

  it("later overrides win, undefined values are ignored", () => {
    const m = resolveMessages(
      dialogMessages,
      { close: "Chiudi" },
      { close: undefined },
      { close: "Schließen" },
    )
    expect(m.close).toBe("Schließen")
  })

  it("plural forms follow the locale's rules", () => {
    expect(dialogMessages.results(1)).toBe("1 result")
    expect(dialogMessages.results(5)).toBe("5 results")
  })
})

describe("formatting", () => {
  it("accent-insensitive comparison under fr-FR", () => {
    expect(collator("fr-FR").compare("é", "e")).toBe(0)
  })

  it("a percent value text in de-DE has a no-break space before the sign", () => {
    expect(number("de-DE", { style: "percent" }).format(0.5)).toBe("50 %")
  })

  it("formatters are cached per locale and options", () => {
    expect(number("en", { style: "percent" })).toBe(number("en", { style: "percent" }))
    expect(number("en")).not.toBe(number("de"))
  })
})

describe("direction", () => {
  it("Arabic and Hebrew are right-to-left; English and French are not", () => {
    expect(isRTL("ar")).toBe(true)
    expect(isRTL("he-IL")).toBe(true)
    expect(isRTL("fa-IR")).toBe(true)
    expect(isRTL("en-US")).toBe(false)
    expect(directionOf("fr-FR")).toBe("ltr")
  })

  it("a fixed locale resolves its own direction unless one is given", () => {
    expect(fixedLocale("he-IL").dir()).toBe("rtl")
    expect(fixedLocale("he-IL", "ltr").dir()).toBe("ltr")
  })
})
