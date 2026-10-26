// Citation's Angular parts: a pending marker is text, upgraded in place; an http(s) source is a
// link named "Source 1: title"; a source without a safe URL is a button that pins the card,
// and Escape unpins it.
import { Component, input } from "@angular/core"
import type { CitationSource } from "@rind-ui/core"
import { getCitation } from "@rind-ui/testing"
import axe from "axe-core"
import { describe, expect, it, vi } from "vitest"
import { mount } from "../../fixtures/mount"
import { Citation } from "./index"

let pins: boolean[] = []

@Component({
  selector: "rind-f",
  imports: [Citation],
  template: `<p>
    <span rindCitationRoot [index]="1" [source]="source()" (pinnedChange)="pinned($event)">
      <span rindCitationCitedText>The sky is blue</span>
      <rind-citation-trigger />
      <ng-template rindCitationPortal>
        <div rindHoverCardPositioner>
          <div rindHoverCardContent>
            <div rindCitationSource>
              <p rindCitationSourceTitle></p>
              <span rindCitationSourceUrl></span>
              <span rindCitationSourceSnippet></span>
            </div>
          </div>
        </div>
      </ng-template>
    </span>
  </p>`,
})
class Tree {
  readonly source = input<CitationSource | undefined>(undefined)
  readonly pinned = (v: boolean) => pins.push(v)
}

async function setup(source?: CitationSource) {
  pins = []
  const m = await mount(Tree, source ? { source } : {})
  const q = (sel: string) => document.body.querySelector(sel) as HTMLElement | null
  return { ...m, q, stable: () => m.rerender({}) }
}

describe("Angular Citation", () => {
  it("is plain text while the source is pending, then a link named by its source", async () => {
    const t = await setup()
    const trigger = t.q('[data-part="trigger"]') as HTMLElement
    expect(trigger.tagName).toBe("SPAN")
    expect(trigger.dataset["kind"]).toBe("pending")
    // No content: the marker shows its index.
    expect(trigger.textContent).toBe("1")
    await t.rerender({
      source: { title: "Example Domain", url: "https://example.com/a", snippet: "Blue." },
    })
    const link = t.q('[data-part="trigger"]') as HTMLElement
    expect(link.tagName).toBe("A")
    expect(link.getAttribute("href")).toBe("https://example.com/a")
    expect(link.textContent).toBe("1")
    expect(link.getAttribute("aria-label")).toBe("Source 1: Example Domain")
    expect(await getCitation(document.body, { name: "Source 1: Example Domain" }).kind()).toBe(
      "link",
    )
    const { violations } = await axe.run(t.host, {
      rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
    })
    expect(violations.map((v) => v.id)).toEqual([])
  })

  it("never links an unsafe URL: a button that pins the card, Escape unpins", async () => {
    const t = await setup({ title: "Notes", url: "javascript:alert(1)", snippet: "x" })
    const trigger = t.q('[data-part="trigger"]') as HTMLElement
    expect(trigger.tagName).toBe("BUTTON")
    expect(trigger.hasAttribute("href")).toBe(false)
    const d = getCitation(document.body, { name: "Source 1: Notes" })
    await d.via("pointer").pin()
    await t.stable()
    expect(await d.isPinned()).toBe(true)
    expect(trigger.getAttribute("aria-expanded")).toBe("true")
    await vi.waitFor(async () => {
      await t.stable()
      expect((await d.sourceTitle()).trim()).toBe("Notes")
    })
    expect(pins).toEqual([true])
    trigger.focus()
    trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
    await vi.waitFor(async () => {
      await t.stable()
      expect(await d.isPinned()).toBe(false)
    })
    expect(pins).toEqual([true, false])
  })
})
