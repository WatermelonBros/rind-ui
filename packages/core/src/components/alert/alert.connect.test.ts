// Alert connect and messages (add-alert 2.1, 2.3): no role or live attribute anywhere, the
// Icon's two forms, the CloseTrigger's fallback name, stable ids, the live-role warning.
import { afterEach, describe, expect, it, vi } from "vitest"
import { alertConnect, alertIds, alertWarnings } from "./alert.connect"
import { alertMessages } from "./alert.messages"

afterEach(() => vi.restoreAllMocks())

const c = (open = true) => alertConnect({ instance: "x", open, dismissLabel: "Chiudi" })
const LIVE = ["role", "aria-live", "aria-atomic", "aria-relevant", "aria-busy"]

describe("alertConnect", () => {
  it("no part carries a live role or attribute, and Root has no name", () => {
    const k = c()
    for (const props of [
      k.root(),
      k.icon(),
      k.title(),
      k.description(),
      k.closeTrigger({ named: true, focused: false, modality: "pointer" }),
    ]) {
      for (const a of LIVE) expect(props[a]).toBeUndefined()
    }
    for (const a of ["aria-label", "aria-labelledby", "aria-describedby"]) {
      expect(k.root()[a]).toBeUndefined()
    }
  })

  it("data-state follows open", () => {
    expect(c(true).root()["data-state"]).toBe("open")
    expect(c(false).root()["data-state"]).toBe("closed")
  })

  it("Icon: decorative by default, an image named by label", () => {
    expect(c().icon()).toMatchObject({ "aria-hidden": "true" })
    expect(c().icon("Error")).toMatchObject({ role: "img", "aria-label": "Error" })
    expect(c().icon("Error")["aria-hidden"]).toBeUndefined()
  })

  it("CloseTrigger: a button, named by messages.dismiss only when nameless", () => {
    expect(c().closeTrigger({ named: false, focused: false, modality: "pointer" })).toMatchObject({
      type: "button",
      "aria-label": "Chiudi",
    })
    expect(
      c().closeTrigger({ named: true, focused: false, modality: "pointer" })["aria-label"],
    ).toBeUndefined()
  })

  it("Title and Description ids derive from the instance (region recipe)", () => {
    expect(c().title()["id"]).toBe(alertIds("x").title)
    expect(c().description()["id"]).toBe(alertIds("x").description)
  })
})

describe("alertWarnings", () => {
  it.each([[{ role: "alert" }], [{ role: "status" }], [{ "aria-live": "polite" }]])(
    "warns for a consumer live role or attribute %o",
    (own) => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
      alertWarnings(own)
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("announce prop"))
    },
  )

  it("is silent for a region", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    alertWarnings({ role: "region" })
    expect(warn).not.toHaveBeenCalled()
  })
})

describe("alertMessages.announcement", () => {
  it("ends each segment with a full stop unless it already ends a sentence", () => {
    expect(alertMessages.announcement(["Error", "Couldn't save"])).toBe("Error. Couldn't save.")
    expect(alertMessages.announcement(["Saved!", "Reconnecting…", "Done?"])).toBe(
      "Saved! Reconnecting… Done?",
    )
  })

  it("skips empty segments", () => {
    expect(alertMessages.announcement(["", " Saved ", ""])).toBe("Saved.")
    expect(alertMessages.announcement([])).toBe("")
  })
})
