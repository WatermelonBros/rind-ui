// Citation's Vue parts: a link marker for an http(s) source, a button marker that pins its card,
// a pending marker as plain text upgraded in place, Escape unpins, markup parity with React.
import type { CitationSource } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { getCitation } from "@rind-ui/testing"
import { createElement as r } from "react"
import { describe, expect, it, vi } from "vitest"
import { h, nextTick } from "vue"
import { mount } from "../../fixtures/mount"
import { clientParity, serverParity } from "../../fixtures/parity"
import { Citation, RindProvider } from "../index"

const LINK: CitationSource = { title: "Example Domain", url: "https://www.example.com/page" }
const NOTE: CitationSource = { title: "Internal note", snippet: "No public URL." }

function setup(source: CitationSource | undefined) {
  const onPinned = vi.fn()
  const m = mount(
    (p: { source: CitationSource | undefined }) =>
      h(RindProvider, null, () =>
        h("p", null, [
          h(
            Citation.Root,
            { index: 1, ...(p.source ? { source: p.source } : {}), onPinnedChange: onPinned },
            () => [
              h(Citation.Trigger, null, () => "[1]"),
              // Portalled: the card (block content) must not sit inside the paragraph.
              h(Citation.Portal, null, () =>
                h(Citation.Positioner, null, () =>
                  h(Citation.Content, null, () =>
                    h(Citation.Source, null, () => [
                      h(Citation.SourceTitle),
                      h(Citation.SourceSnippet),
                    ]),
                  ),
                ),
              ),
            ],
          ),
        ]),
      ),
    { source },
  )
  const q = (sel: string) => m.host.querySelector<HTMLElement>(sel)
  return { ...m, q, onPinned, d: () => getCitation(document.body) }
}

describe("Vue Citation", () => {
  it("a Trigger with no children shows its index (never an empty link)", async () => {
    const m = mount(() =>
      h(RindProvider, null, () =>
        h(Citation.Root, { index: 3, source: { url: "https://example.com", title: "Ex" } }, () => [
          h(Citation.Trigger),
        ]),
      ),
    )
    await nextTick()
    expect(m.host.querySelector('[data-part="trigger"]')?.textContent).toBe("3")
  })

  it("a link marker follows its http(s) source, named with its index and title", async () => {
    const t = setup(LINK)
    await nextTick()
    const marker = t.q('[data-part="trigger"]') as HTMLElement
    expect(marker.tagName).toBe("A")
    expect(marker.getAttribute("href")).toBe("https://www.example.com/page")
    expect(marker.getAttribute("aria-label")).toBe("Source 1: Example Domain")
    expect(await t.d().kind()).toBe("link")
  })

  it("a button marker pins its card on press; Escape unpins", async () => {
    const t = setup(NOTE)
    await nextTick()
    expect(t.q('[data-part="trigger"]')?.tagName).toBe("BUTTON")
    await t.d().via("pointer").pin()
    await nextTick()
    expect(await t.d().isPinned()).toBe(true)
    expect(t.onPinned).toHaveBeenCalledWith(true)
    expect(await t.d().sourceTitle()).toBe("Internal note")
    await t.d().via("keyboard").hide()
    await nextTick()
    expect(await t.d().isPinned()).toBe(false)
  })

  it("is plain text while the source is pending, and becomes the marker in place", async () => {
    const t = setup(undefined)
    await nextTick()
    expect(t.q('[data-part="trigger"]')?.tagName).toBe("SPAN")
    await t.rerender({ source: LINK })
    expect(t.q('[data-part="trigger"]')?.tagName).toBe("A")
  })

  it("matches React's markup, server and client", async () => {
    const react = r(R.Citation.Root, { index: 2, source: LINK }, r(R.Citation.Trigger, null, "[2]"))
    const vue = () =>
      h(Citation.Root, { index: 2, source: LINK }, () => h(Citation.Trigger, null, () => "[2]"))
    await serverParity(react, vue)
    await clientParity(react, vue)
  })
})
