// Citation's Svelte parts: a link marker for an http(s) source, a button marker that pins its
// card, a pending marker as plain text upgraded in place, Escape unpins, DOM parity with React.
import type { CitationSource } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { getCitation } from "@rind-ui/testing"
import { createElement as r } from "react"
import { flushSync } from "svelte"
import { describe, expect, it, vi } from "vitest"
import Cite from "../../fixtures/citation/cite.svelte"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"

const LINK: CitationSource = { title: "Example Domain", url: "https://www.example.com/page" }
const NOTE: CitationSource = { title: "Internal note", snippet: "No public URL." }

function setup(source: CitationSource | undefined) {
  const onPinnedChange = vi.fn()
  const m = mount(Cite, { ...(source ? { source } : {}), onPinnedChange } as never)
  const q = (sel: string) => m.host.querySelector<HTMLElement>(sel)
  return { ...m, q, onPinnedChange, d: () => getCitation(document.body) }
}

describe("Svelte Citation", () => {
  it("a link marker follows its http(s) source, named with its index and title", async () => {
    const t = setup(LINK)
    const marker = t.q('[data-part="trigger"]') as HTMLElement
    expect(marker.tagName).toBe("A")
    expect(marker.getAttribute("href")).toBe("https://www.example.com/page")
    expect(marker.getAttribute("aria-label")).toBe("Source 1: Example Domain")
    expect(marker.textContent).toBe("[1]")
  })

  it("a button marker pins its card on press; Escape unpins", async () => {
    const t = setup(NOTE)
    expect(t.q('[data-part="trigger"]')?.tagName).toBe("BUTTON")
    await t.d().via("pointer").pin()
    flushSync()
    expect(await t.d().isPinned()).toBe(true)
    expect(t.onPinnedChange).toHaveBeenCalledWith(true)
    expect(await t.d().sourceTitle()).toBe("Internal note")
    await t.d().via("keyboard").hide()
    flushSync()
    expect(await t.d().isPinned()).toBe(false)
  })

  it("is plain text while the source is pending, and becomes the marker in place", async () => {
    const t = setup(undefined)
    expect(t.q('[data-part="trigger"]')?.tagName).toBe("SPAN")
    t.rerender({ source: LINK } as never)
    expect(t.q('[data-part="trigger"]')?.tagName).toBe("A")
  })

  it("matches React", async () => {
    const react = r(
      R.RindProvider,
      null,
      r(
        "p",
        null,
        r(R.Citation.Root, { index: 2, source: LINK }, r(R.Citation.Trigger, null, "[2]")),
      ),
    )
    await clientParity(react, Cite, { index: 2, source: LINK, card: false } as never)
  })
})
