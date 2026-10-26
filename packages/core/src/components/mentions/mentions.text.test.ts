import { describe, expect, it } from "vitest"
import {
  applyEdit,
  insertMention,
  type MentionRange,
  matchTrigger,
  removeMatch,
} from "./mentions.text"

const at = { char: "@" }
const slash = { char: "/", behavior: "action" as const }

describe("matchTrigger", () => {
  it("after whitespace or at the start, up to the caret", () => {
    expect(matchTrigger("hi @ad", 6, [at])).toEqual({ trigger: "@", start: 3, end: 6, query: "ad" })
    expect(matchTrigger("@", 1, [at])).toEqual({ trigger: "@", start: 0, end: 1, query: "" })
    expect(matchTrigger("mail@ad", 7, [at])).toBeNull()
    expect(matchTrigger("hi @a d", 7, [at])).toBeNull()
  })

  it("Unicode whitespace counts (Tiptap #4688)", () => {
    expect(matchTrigger("hi @ad", 6, [at])?.query).toBe("ad")
  })

  it("/ only at the start of a line", () => {
    expect(matchTrigger("/sum", 4, [slash])?.query).toBe("sum")
    expect(matchTrigger("a\n/sum", 6, [slash])?.query).toBe("sum")
    expect(matchTrigger("a /sum", 6, [slash])).toBeNull()
  })

  it("a dismissed match and a mention's own text stay closed", () => {
    expect(matchTrigger("hi @ad", 6, [at], { dismissedAt: 3 })).toBeNull()
    const m: MentionRange = { id: "1", trigger: "@", start: 3, end: 7 }
    expect(matchTrigger("hi @Ada", 7, [at], { mentions: [m] })).toBeNull()
  })
})

const r = (start: number, end: number): MentionRange => ({ id: "ada", trigger: "@", start, end })

describe("applyEdit", () => {
  const text = "x @Ada y"
  it("an edit before shifts; after leaves; at the start edge shifts", () => {
    expect(applyEdit(text, `z${text}`, [r(2, 6)]).ranges).toEqual([r(3, 7)])
    expect(applyEdit(text, `${text}!`, [r(2, 6)]).ranges).toEqual([r(2, 6)])
    expect(applyEdit(text, "x Q@Ada y", [r(2, 6)]).ranges).toEqual([r(3, 7)])
    expect(applyEdit(text, "x @Adas y", [r(2, 6)]).ranges).toEqual([r(2, 6)])
  })

  it("typing inside dissolves the mention; the text stays", () => {
    expect(applyEdit(text, "x @Adda y", [r(2, 6)])).toEqual({
      value: "x @Adda y",
      ranges: [],
      caret: null,
    })
  })

  it("Backspace on the last character removes the whole mention and its space", () => {
    expect(applyEdit(text, "x @Ad y", [r(2, 6)], 5)).toEqual({ value: "x y", ranges: [], caret: 2 })
  })

  it("a selection covering it removes it too, and shifts the next one", () => {
    const two = "@Ada @Bo"
    const bo: MentionRange = { id: "bo", trigger: "@", start: 5, end: 8 }
    expect(applyEdit(two, "@Bo", [r(0, 4), bo], 0)).toEqual({
      value: "@Bo",
      ranges: [{ ...bo, start: 0, end: 3 }],
      caret: 0,
    })
  })

  it("a deletion reaching outside the mention keeps the user's edit", () => {
    expect(applyEdit(text, "Ada y", [r(2, 6)], 0)).toEqual({ value: "y", ranges: [], caret: 0 })
  })
})

describe("insert and remove", () => {
  it("replaces the query with the label and a space; the caret after it", () => {
    const m = matchTrigger("hi @ad there", 6, [at])
    if (!m) throw new Error("no match")
    expect(insertMention("hi @ad there", m, [], { id: "ada", label: "@Ada" })).toEqual({
      value: "hi @Ada there",
      ranges: [r(3, 7)],
      caret: 8,
    })
  })

  it("an action trigger removes its query", () => {
    const m = matchTrigger("/sum", 4, [slash])
    if (!m) throw new Error("no match")
    expect(removeMatch("/sum", m, [])).toEqual({ value: "", ranges: [], caret: 0 })
  })
})
