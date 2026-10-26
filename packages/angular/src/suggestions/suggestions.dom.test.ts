// Suggestions' Angular parts: a named group of buttons, presses through the driver, loading and
// disabled keep the focus, the focus back to the prompt, a new set announced only when asked.
import { Component, input } from "@angular/core"
import type { SuggestionsSelectDetails } from "@rind-ui/core"
import { getSuggestions, recordingAnnouncer } from "@rind-ui/testing"
import axe from "axe-core"
import { describe, expect, it, vi } from "vitest"
import { mount } from "../../fixtures/mount"
import { RindProvider } from "../provider"
import { Suggestions } from "./suggestions"

/** The fixture's configuration, for the next mount. */
let current: {
  announcer: unknown
  picked: (d: SuggestionsSelectDetails) => void
  announce: "off" | "polite"
} = { announcer: null, picked: () => {}, announce: "off" }

@Component({
  selector: "rind-f",
  imports: [RindProvider, Suggestions],
  template: `<ng-container rindProvider [announcer]="$any(cfg.announcer)">
    <textarea aria-label="Prompt" #prompt></textarea>
    <div
      rindSuggestionsRoot
      [loading]="loading()"
      [announce]="cfg.announce"
      [focusTarget]="target(prompt)"
      (pick)="cfg.picked($event)"
    >
      @for (text of items(); track text) {
        <button rindSuggestionsItem>
          <span rindSuggestionsLabel>{{ text }}</span>{{ " " }}<span rindSuggestionsDescription>example</span>
        </button>
      }
      <button rindSuggestionsItem value="custom-value" disabled><span rindSuggestionsLabel>Off</span></button>
    </div>
  </ng-container>`,
})
class Tree {
  readonly cfg = current
  readonly items = input<string[]>([])
  readonly loading = input(false)
  readonly target = (el: HTMLElement) => () => el
}

async function setup(items: string[], p: { loading?: boolean; announce?: "off" | "polite" } = {}) {
  const rec = recordingAnnouncer()
  const picked: SuggestionsSelectDetails[] = []
  current = {
    announcer: rec.announcer,
    picked: (d) => picked.push(d),
    announce: p.announce ?? "off",
  }
  const m = await mount(Tree, { items, loading: p.loading ?? false })
  const q = (sel: string) => m.host.querySelector(sel) as HTMLElement
  const all = () => [...m.host.querySelectorAll<HTMLElement>('[data-part="item"]')]
  const flush = async () => {
    for (let i = 0; i < 3; i++) await Promise.resolve()
    await m.rerender({})
  }
  await flush()
  return {
    ...m,
    rec,
    picked,
    q,
    items: all,
    flush,
    d: () => getSuggestions(document.body, { name: "Suggestions" }),
  }
}

describe("Angular Suggestions", () => {
  it("is a group named Suggestions, of buttons in order", async () => {
    const t = await setup(["Summarize", "Translate"])
    const root = t.q('[data-part="root"]')
    expect(root.getAttribute("role")).toBe("group")
    expect(root.getAttribute("aria-label")).toBe("Suggestions")
    expect(root.dataset["count"]).toBe("3")
    expect(t.items().map((i) => i.dataset["index"])).toEqual(["0", "1", "2"])
    expect(await t.d().items()).toEqual(["Summarize example", "Translate example", "Off"])
    const { violations } = await axe.run(t.host, {
      rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
    })
    expect(violations.map((v) => v.id)).toEqual([])
  })

  it("selects with the Label's text or the value; a disabled item does nothing", async () => {
    const t = await setup(["Summarize", "Translate"])
    await t.d().via("pointer").pick("Translate")
    expect(t.picked).toEqual([{ value: "Translate", index: 1, key: expect.any(String) }])
    const off = t.items()[2] as HTMLElement
    expect(off.getAttribute("aria-disabled")).toBe("true")
    expect(off.hasAttribute("disabled")).toBe(false)
    off.click()
    expect(t.picked).toHaveLength(1)
  })

  it("moves the focus to the prompt after a keyboard press inside", async () => {
    const t = await setup(["Summarize"])
    await t.d().via("keyboard").pick(0)
    expect(t.picked.map((p) => p.value)).toEqual(["Summarize"])
    expect(document.activeElement).toBe(t.q("textarea"))
  })

  it("keeps the items focusable and inert while loading", async () => {
    const t = await setup(["Summarize"], { loading: true })
    const root = t.q('[data-part="root"]')
    expect(root.dataset["state"]).toBe("loading")
    expect(root.getAttribute("aria-busy")).toBe("true")
    const item = t.items()[0] as HTMLElement
    item.focus()
    item.click()
    expect(document.activeElement).toBe(item)
    expect(t.picked).toEqual([])
    await t.rerender({ loading: false })
    expect(root.dataset["state"]).toBe("ready")
  })

  it("announces a new set only when asked, never on mount", async () => {
    const t = await setup(["A", "B"], { announce: "polite" })
    expect(t.rec.log).toEqual([])
    await t.rerender({ items: ["C"] })
    await vi.waitFor(() => expect(t.rec.log.map((a) => a.message)).toEqual(["2 suggestions"]))
  })
})
