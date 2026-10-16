// Every editing rule that needs no DOM (tasks 1.2).
import { describe, expect, it } from "vitest"
import { accepts, normalise, normaliseWrite, type PinRules, planEdit } from "./edit-plan"

const six: PinRules = { length: 6 }
const type = (value: string, caret: number, data: string, rules = six) =>
  planEdit(value, [caret, caret], { inputType: "insertText", data }, rules)
const paste = (value: string, sel: readonly [number, number], data: string, rules = six) =>
  planEdit(value, sel, { inputType: "insertFromPaste", data }, rules)

describe("filtering", () => {
  it("numeric by default; letters refused before they apply (bits-ui#826)", () => {
    expect(type("", 0, "&")).toEqual({ accept: false, text: "&" })
    expect(type("", 0, "a")).toEqual({ accept: false, text: "a" })
    expect(type("", 0, "7")).toEqual({
      accept: true,
      edit: { next: "7", caret: 1, reason: "INPUT" },
    })
  })

  it("alphanumeric, alpha and a pattern", () => {
    expect(accepts("a", { length: 4, validationType: "alphanumeric" })).toBe(true)
    expect(accepts("1", { length: 4, validationType: "alpha" })).toBe(false)
    expect(accepts("x", { length: 4, pattern: /[xyz]/g })).toBe(true)
    // A global pattern keeps no state between characters.
    expect(accepts("x", { length: 4, pattern: /[xyz]/g })).toBe(true)
  })

  it("uppercase through sanitize (base-ui#4608)", () => {
    const rules: PinRules = {
      length: 6,
      validationType: "alphanumeric",
      sanitize: (t) => t.toUpperCase(),
    }
    expect(type("", 0, "a", rules)).toMatchObject({ edit: { next: "A" } })
  })

  it("full-width digits become ASCII (zag#1507)", () => {
    expect(normalise("１２３", six)).toBe("123")
    expect(type("", 0, "１２３")).toMatchObject({ edit: { next: "123", caret: 3 } })
  })
})

describe("typing", () => {
  it("no holes: a caret past the value appends at its end (reka-ui#2355)", () => {
    expect(type("", 4, "7")).toMatchObject({ edit: { next: "7", caret: 1 } })
  })

  it("replaces the slot at the caret and moves on (input-otp#31)", () => {
    expect(type("12345", 1, "9")).toMatchObject({ edit: { next: "19345", caret: 2 } })
  })

  it("the same character only advances (zag#3020)", () => {
    expect(type("12345", 1, "2")).toMatchObject({ edit: { next: "12345", caret: 2 } })
  })

  it("two keys at once land in their own slots (zag#908)", () => {
    expect(type("", 0, "12")).toMatchObject({ edit: { next: "12", caret: 2 } })
  })

  it("a full value ignores typing at its end", () => {
    expect(type("123456", 6, "7")).toMatchObject({ edit: { next: "123456", caret: 6 } })
  })

  it("Safari IME commits one character each time (base-ui#5091)", () => {
    const rules: PinRules = { length: 6, validationType: "alphanumeric" }
    let value = ""
    for (let i = 0; i < 3; i++) {
      const plan = type(value, value.length, "d", rules)
      if (plan.accept && plan.edit) value = plan.edit.next
    }
    expect(value).toBe("ddd")
  })
})

describe("paste", () => {
  it("separators are dropped (input-otp#53)", () => {
    expect(paste("", [0, 0], "123-456")).toMatchObject({
      edit: { next: "123456", reason: "PASTE" },
    })
    expect(paste("", [0, 0], " 12 34.5 6 ")).toMatchObject({ edit: { next: "123456" } })
  })

  it("longer than length is truncated (radix#3550)", () => {
    expect(paste("", [0, 0], "12345678")).toMatchObject({ edit: { next: "123456", caret: 6 } })
  })

  it("a full code replaces the value wherever the caret is (zag#470)", () => {
    expect(paste("12", [1, 1], "987654")).toMatchObject({ edit: { next: "987654", caret: 6 } })
  })

  it("a short paste goes in at the caret, replacing the selection", () => {
    expect(paste("1234", [1, 3], "9")).toMatchObject({ edit: { next: "194", caret: 2 } })
    expect(paste("12", [2, 2], "345")).toMatchObject({ edit: { next: "12345", caret: 5 } })
  })

  it("a rejected character refuses the whole paste", () => {
    expect(paste("", [0, 0], "12a456")).toEqual({ accept: false, text: "12a456" })
  })
})

describe("native edits", () => {
  it("deletions and history pass through unplanned", () => {
    for (const inputType of ["deleteContentBackward", "deleteSoftLineBackward", "historyUndo"]) {
      expect(planEdit("1234", [4, 4], { inputType, data: null }, six)).toEqual({
        accept: true,
        edit: null,
      })
    }
  })

  it("a browser or script write is normalised (input-otp#152, zag#2118)", () => {
    expect(normaliseWrite("534418", six)).toBe("534418")
    expect(normaliseWrite("534 418 99", six)).toBe("534418")
    expect(normaliseWrite("abc", six)).toBe(null)
  })
})
