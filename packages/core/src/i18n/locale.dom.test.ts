import { afterEach, describe, expect, it } from "vitest"
import { domEnvironment } from "../env/dom-environment"
import { documentLocale } from "./locale"

afterEach(() => {
  document.documentElement.removeAttribute("lang")
})

describe("default locale", () => {
  it("follows the document's lang: an Arabic page resolves dir rtl", () => {
    document.documentElement.lang = "ar"
    const env = domEnvironment()
    expect(env.locale.locale()).toBe("ar")
    expect(env.locale.dir()).toBe("rtl")
  })

  it("falls back to the browser language", () => {
    expect(documentLocale().locale()).toBe(navigator.language || "en")
  })

  it("notifies on languagechange", () => {
    const source = documentLocale()
    let calls = 0
    const off = source.subscribe(() => calls++)
    window.dispatchEvent(new Event("languagechange"))
    off()
    window.dispatchEvent(new Event("languagechange"))
    expect(calls).toBe(1)
  })

  it("an injected locale wins", () => {
    document.documentElement.lang = "en"
    expect(domEnvironment({ locale: "he-IL" }).locale.dir()).toBe("rtl")
  })
})

describe("review round 1", () => {
  it.each(["en_US", "not a locale!!"])(
    "an invalid document lang (%s) never crashes Intl",
    (lang) => {
      document.documentElement.lang = lang
      const locale = documentLocale().locale()
      expect(() => new Intl.NumberFormat(locale).format(1)).not.toThrow()
      if (lang === "en_US") expect(locale).toBe("en-US")
    },
  )

  it("a dir-only option wins over the document locale's direction", () => {
    document.documentElement.lang = "en"
    const env = domEnvironment({ dir: "rtl" })
    expect(env.locale.dir()).toBe("rtl")
    expect(env.locale.locale()).toBe("en")
  })

  it("notifies when <html lang> changes", async () => {
    const source = documentLocale()
    let calls = 0
    const off = source.subscribe(() => calls++)
    document.documentElement.lang = "de"
    await Promise.resolve()
    off()
    expect(calls).toBe(1)
  })
})
