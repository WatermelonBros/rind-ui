// Rating parts in Node (openspec rating "ARIA", "Data Attributes", "Form Participation").
import { describe, expect, it } from "vitest"
import { platforms } from "../../dom/platform"
import {
  type RatingConnectInput,
  ratingConnect,
  ratingFraction,
  ratingKeyEvent,
} from "./rating.connect"
import { ratingRange } from "./rating.machine"
import { ratingMessages } from "./rating.messages"

const field = {
  disabled: false,
  readOnly: false,
  required: false,
  invalid: false,
  name: "score",
  "aria-required": undefined,
  "aria-invalid": undefined,
  "aria-describedby": undefined,
  "aria-labelledby": undefined,
  "aria-errormessage": undefined,
} as const
const base: RatingConnectInput = {
  instance: "i",
  dir: "ltr",
  value: 3.5,
  preview: null,
  range: ratingRange({ allowHalf: true }),
  field,
  focused: false,
  modality: "pointer",
  ids: { root: "r", label: "l", input: "in", hiddenInput: "h" },
  labelledBy: "l",
  locale: "en",
  messages: ratingMessages,
  defaultValue: 0,
}
const key = (k: string) => ({
  key: k,
  code: k,
  shift: false,
  alt: false,
  ctrl: false,
  meta: false,
  repeat: false,
  composing: false,
})

describe("rating connect", () => {
  it("the range input is the slider: value, text, bounds, step, name by the Label", () => {
    const input = ratingConnect(base).input()
    expect(input["type"]).toBe("range")
    expect(input["aria-valuenow"]).toBe(3.5)
    expect(input["aria-valuetext"]).toBe("3.5 of 5 stars")
    expect([input["min"], input["max"], input["step"]]).toEqual([0, 5, 0.5])
    expect(input["aria-labelledby"]).toBe("l")
    expect(input["name"]).toBeUndefined()
  })

  it("value text: no rating, locale digits, translated", () => {
    expect(ratingConnect({ ...base, value: 0 }).input()["aria-valuetext"]).toBe("No rating")
    expect(ratingConnect({ ...base, locale: "it" }).input()["aria-valuetext"]).toBe(
      "3,5 of 5 stars",
    )
    const messages = { valueText: ({ formatted }: { formatted: string }) => `${formatted} stelle` }
    expect(ratingConnect({ ...base, messages }).input()["aria-valuetext"]).toBe("3.5 stelle")
  })

  it("stars: full, half, empty; the preview draws without changing aria", () => {
    const api = ratingConnect(base)
    expect([1, 3, 4, 5].map((i) => api.item(i)["data-state"])).toEqual([
      "full",
      "full",
      "half",
      "empty",
    ])
    expect(api.item(2)["aria-hidden"]).toBe("true")
    const preview = ratingConnect({ ...base, preview: 5 })
    expect(preview.item(5)["data-state"]).toBe("full")
    expect(preview.item(5)["data-previewed"]).toBe("")
    expect(preview.input()["aria-valuenow"]).toBe(3.5)
    expect(preview.root()["data-previewing"]).toBe("")
  })

  it("the carrier submits the value, '' while unrated, and carries required", () => {
    expect(ratingConnect(base).hiddenInput()["name"]).toBe("score")
    const unrated = ratingConnect({ ...base, field: { ...field, required: true } }).hiddenInput()
    expect(unrated["required"]).toBe(true)
    expect(unrated["aria-hidden"]).toBe("true")
    expect(unrated["tabindex"]).toBe(-1)
    expect(unrated["defaultValue"]).toBe("")
  })

  it("read-only and disabled", () => {
    const ro = ratingConnect({ ...base, field: { ...field, readOnly: true } })
    expect(ro.input()["aria-readonly"]).toBe("true")
    expect(ro.input()["disabled"]).toBeUndefined()
    const off = ratingConnect({ ...base, field: { ...field, disabled: true } })
    expect(off.input()["disabled"]).toBe(true)
    expect(off.root()["data-disabled"]).toBe("")
  })

  it("keys mirror in RTL; modifiers and Enter are not ours", () => {
    const ltr = { dir: "ltr" as const, platform: platforms.linux }
    const rtl = { dir: "rtl" as const, platform: platforms.linux }
    expect(ratingKeyEvent(key("ArrowRight"), ltr)?.type).toBe("INCREASE")
    expect(ratingKeyEvent(key("ArrowLeft"), rtl)?.type).toBe("INCREASE")
    expect(ratingKeyEvent(key("ArrowUp"), rtl)?.type).toBe("INCREASE")
    expect(ratingKeyEvent(key("Home"), ltr)?.type).toBe("FIRST")
    expect(ratingKeyEvent(key("Enter"), ltr)).toBeNull()
    expect(ratingKeyEvent({ ...key("ArrowRight"), alt: true }, ltr)).toBeNull()
  })

  it("pointer fraction: reading order, zero-size box gives a whole star", () => {
    expect(ratingFraction({ left: 0, width: 20 }, 5, "ltr")).toBe(0.25)
    expect(ratingFraction({ left: 0, width: 20 }, 5, "rtl")).toBe(0.75)
    expect(ratingFraction({ left: 0, width: 0 }, 5, "ltr")).toBe(1)
  })
})

describe("Data Attributes on every part", () => {
  it("disabled, read-only, required, invalid and previewing reach all six parts", () => {
    const api = ratingConnect({
      ...base,
      preview: 2,
      field: { ...field, disabled: true, readOnly: true, required: true, invalid: true },
    })
    for (const props of [
      api.root(),
      api.label(),
      api.control(),
      api.item(1),
      api.input(),
      api.hiddenInput(),
    ]) {
      for (const flag of [
        "data-disabled",
        "data-readonly",
        "data-required",
        "data-invalid",
        "data-previewing",
      ]) {
        expect(props[flag], `${String(props["data-part"])} ${flag}`).toBe("")
      }
    }
  })
})
