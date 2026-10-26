import { describe, expect, it, vi } from "vitest"
import { createService } from "../../machine/service"
import { citationConnect } from "./citation.connect"
import { citationContract } from "./citation.contract"
import { domainOf, safeHref, splitByCitations } from "./citation.helpers"
import { citationMachine } from "./citation.machine"
import { citationMessages } from "./citation.messages"
import { citationMeta } from "./citation.meta"

describe("citation helpers", () => {
  it("safeHref allows http(s) only and never throws", () => {
    expect(safeHref("https://example.com/a")).toBe("https://example.com/a")
    expect(safeHref("javascript:alert(1)")).toBeUndefined()
    expect(safeHref("not a url")).toBeUndefined()
    expect(safeHref(undefined)).toBeUndefined()
    expect(safeHref("mailto:a@b.c", { schemes: ["mailto:"] })).toBe("mailto:a@b.c")
  })

  it("domainOf drops www.", () => {
    expect(domainOf("https://www.example.com/x")).toBe("example.com")
    expect(domainOf("%%")).toBeUndefined()
  })

  it("splitByCitations returns ordered segments, dropping overlaps and out-of-range", () => {
    expect(splitByCitations("Paris is big.", [{ start: 0, end: 5, index: 1 }])).toEqual([
      { kind: "cite", text: "Paris", index: 1 },
      { kind: "text", text: " is big." },
    ])
    expect(
      splitByCitations("abcdef", [
        { start: 2, end: 4, index: 2 },
        { start: 1, end: 3, index: 1 },
        { start: 4, end: 99, index: 3 },
      ]),
    ).toEqual([
      { kind: "text", text: "a" },
      { kind: "cite", text: "bc", index: 1 },
      { kind: "text", text: "def" },
    ])
  })
})

describe("citation machine", () => {
  it("a button marker pins and unpins; a link never pins", () => {
    const onPinnedChange = vi.fn()
    const s = createService(citationMachine, { kind: "button", onPinnedChange }, {})
    s.start()
    s.send({ type: "PRESS" })
    expect(s.getSnapshot().state).toBe("pinned")
    s.send({ type: "UNPIN" })
    expect(s.getSnapshot().state).toBe("idle")
    expect(onPinnedChange.mock.calls).toEqual([[true], [false]])
    const link = createService(citationMachine, { kind: "link" }, {})
    link.start()
    link.send({ type: "PRESS" })
    expect(link.getSnapshot().state).toBe("idle")
  })
})

const api = (over: Partial<Parameters<typeof citationConnect>[0]> = {}) =>
  citationConnect({
    instance: "c",
    index: 1,
    source: { title: "Example", url: "https://example.com", snippet: "A domain." },
    open: false,
    pinned: true,
    messages: citationMessages,
    ...over,
  })

describe("citation connect", () => {
  it("a link named with the index and title", () => {
    const a = api({ pinned: false })
    expect(a.kind).toBe("link")
    expect(a.trigger()).toMatchObject({
      "aria-label": "Source 1: Example",
      href: "https://example.com/",
    })
  })

  it("an unsafe URL is a button; no source is pending text", () => {
    expect(api({ source: { title: "X", url: "javascript:1" } }).triggerTag).toBe("button")
    const p = api({ source: undefined })
    expect(p.triggerTag).toBe("span")
    expect(p.trigger()["aria-label"]).toBeUndefined()
    expect(p.trigger()["data-state"]).toBe("pending")
  })

  it("_blank adds noopener", () => {
    expect(api({ target: "_blank" }).trigger()["rel"]).toBe("noopener noreferrer")
  })

  it("meta matches the code", () => {
    const a = api({ source: { title: "X", url: "javascript:1" } })
    const parts = {
      trigger: a.trigger(),
      source: a.source(),
      "source-title": a.sourceTitle(),
      "source-url": a.sourceUrl(),
      "source-snippet": a.sourceSnippet(),
      "source-link": a.sourceLink(),
      "cited-text": a.citedText(),
    }
    const dataKeys = (p: Record<string, unknown>) =>
      Object.keys(p)
        .filter((k) => k.startsWith("data-") && p[k] !== undefined)
        .sort()
    for (const [part, props] of Object.entries(parts)) {
      const meta = citationMeta.dataAttributes[part as keyof typeof citationMeta.dataAttributes]
      expect(Object.keys(meta).sort(), part).toEqual(dataKeys(props))
    }
    expect(citationMeta.contract.queries).toEqual(Object.keys(citationContract.queries))
  })
})
