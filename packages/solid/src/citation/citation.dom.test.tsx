/** @jsxImportSource solid-js */
// Citation's Solid parts: a pending marker is text, upgraded in place; an http(s) source is a
// link named "Source 1: title"; a source without a safe URL is a button that pins the card,
// and Escape unpins it.
import type { CitationSource } from "@rind-ui/core"
import { getCitation } from "@rind-ui/testing"
import axe from "axe-core"
import { describe, expect, it, vi } from "vitest"
import { mount } from "../../fixtures/mount"
import { RindProvider } from "../index"
import { Citation } from "./index"

interface Props {
  source?: CitationSource
}

function setup(initial: Props) {
  const pins: boolean[] = []
  const m = mount(
    (p: Props) => (
      <RindProvider>
        <p>
          <Citation.Root index={1} source={p.source} onPinnedChange={(v) => pins.push(v)}>
            <Citation.CitedText>The sky is blue</Citation.CitedText>
            <Citation.Trigger />
            <Citation.Portal>
              <Citation.Positioner>
                <Citation.Content>
                  <Citation.Source>
                    <Citation.SourceTitle />
                    <Citation.SourceUrl />
                    <Citation.SourceSnippet />
                  </Citation.Source>
                </Citation.Content>
              </Citation.Positioner>
            </Citation.Portal>
          </Citation.Root>
        </p>
      </RindProvider>
    ),
    initial,
  )
  const q = (sel: string) => document.body.querySelector(sel) as HTMLElement | null
  return { ...m, pins, q }
}

describe("Solid Citation", () => {
  it("is plain text while the source is pending, then a link named by its source", async () => {
    const t = setup({})
    const trigger = t.q('[data-part="trigger"]') as HTMLElement
    expect(trigger.tagName).toBe("SPAN")
    expect(trigger.dataset["kind"]).toBe("pending")
    // No children: the marker shows its index.
    expect(trigger.textContent).toBe("1")
    await t.rerender({
      source: { title: "Example Domain", url: "https://example.com/a", snippet: "Blue." },
    })
    const link = t.q('[data-part="trigger"]') as HTMLElement
    expect(link.tagName).toBe("A")
    expect(link.getAttribute("href")).toBe("https://example.com/a")
    expect(link.textContent).toBe("1")
    const d = getCitation(document.body, { name: "Source 1: Example Domain" })
    expect(await d.kind()).toBe("link")
    const { violations } = await axe.run(t.host, {
      rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
    })
    expect(violations.map((v) => v.id)).toEqual([])
  })

  it("never links an unsafe URL: a button that pins the card, Escape unpins", async () => {
    const t = setup({ source: { title: "Notes", url: "javascript:alert(1)", snippet: "x" } })
    const trigger = t.q('[data-part="trigger"]') as HTMLElement
    expect(trigger.tagName).toBe("BUTTON")
    expect(trigger.hasAttribute("href")).toBe(false)
    expect(trigger.getAttribute("aria-label")).toBe("Source 1: Notes")
    const d = getCitation(document.body, { name: "Source 1: Notes" })
    await d.via("pointer").pin()
    expect(await d.isPinned()).toBe(true)
    expect(trigger.getAttribute("aria-expanded")).toBe("true")
    await vi.waitFor(async () => expect(await d.sourceTitle()).toBe("Notes"))
    expect(t.pins).toEqual([true])
    trigger.focus()
    trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
    await vi.waitFor(async () => expect(await d.isPinned()).toBe(false))
    expect(t.pins).toEqual([true, false])
  })
})
