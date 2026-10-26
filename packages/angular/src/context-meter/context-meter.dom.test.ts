// Context Meter's Angular parts: a meter with the usage in words, no meter without a size, the
// zone, a rising crossing announced once and re-armed by resetKey, the breakdown.
import { Component, input } from "@angular/core"
import type { ContextMeterLevel } from "@rind-ui/core"
import { getContextMeter, recordingAnnouncer } from "@rind-ui/testing"
import axe from "axe-core"
import { describe, expect, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { RindProvider } from "../provider"
import { ContextMeter } from "./context-meter"

/** The fixture's configuration, for the next mount. */
let current: { announcer: unknown; levels: (l: ContextMeterLevel) => void; label: boolean } = {
  announcer: null,
  levels: () => {},
  label: true,
}

@Component({
  selector: "rind-f",
  imports: [RindProvider, ContextMeter],
  template: `<ng-container rindProvider locale="en-US" [announcer]="$any(cfg.announcer)">
    <div
      rindContextMeterRoot
      [used]="used()"
      [max]="max()"
      [resetKey]="resetKey()"
      (threshold)="cfg.levels($event)"
    >
      @if (cfg.label) {<span rindContextMeterLabel>Context</span>}
      <span rindContextMeterValueText></span>
      <div rindContextMeterTrack><div rindContextMeterIndicator></div></div>
      <dl rindContextMeterBreakdown>
        <div rindContextMeterBreakdownItem itemKey="system" label="System prompt" amount="2K"></div>
      </dl>
    </div>
  </ng-container>`,
})
class Tree {
  readonly cfg = current
  readonly used = input(0)
  readonly max = input<number | null>(null)
  readonly resetKey = input<string | undefined>(undefined)
}

async function setup(p: { used: number; max: number | null; resetKey?: string }, label = true) {
  const rec = recordingAnnouncer()
  const levels: ContextMeterLevel[] = []
  current = { announcer: rec.announcer, levels: (l) => levels.push(l), label }
  const m = await mount(Tree, p)
  const q = (sel: string) => m.host.querySelector(sel) as HTMLElement
  return { ...m, rec, levels, q }
}

describe("Angular ContextMeter", () => {
  it("is a meter named by its Label, with the usage in words", async () => {
    const t = await setup({ used: 17_000, max: 100_000 })
    const root = t.q('[data-part="root"]')
    expect(root.getAttribute("role")).toBe("meter")
    expect(root.getAttribute("aria-labelledby")).toBe(t.q('[data-part="label"]').id)
    expect(root.getAttribute("aria-valuenow")).toBe("17000")
    const d = getContextMeter(document.body, { name: "Context" })
    expect(await d.valueText()).toBe("17K of 100K tokens, 17%")
    expect(await d.percent()).toBe(17)
    expect(t.q('[data-part="value-text"]').textContent?.trim()).toBe("17%")
    expect(t.q('[data-part="breakdown-item"]').dataset["key"]).toBe("system")
    expect(t.q('[data-part="breakdown-item"]').hasAttribute("itemkey")).toBe(false)
    expect(t.q('[data-part="breakdown-item"] dt').textContent).toBe("System prompt")
    const { violations } = await axe.run(t.host, {
      rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
    })
    expect(violations.map((v) => v.id)).toEqual([])
  })

  it("is named by its message without a Label, and is text without a size", async () => {
    const t = await setup({ used: 500, max: null }, false)
    const root = t.q('[data-part="root"]')
    expect(root.hasAttribute("role")).toBe(false)
    expect(t.q('[data-part="value-text"]').textContent?.trim()).toBe("500 tokens used")
    await t.rerender({ used: 1, max: 10 })
    expect(root.getAttribute("aria-label")).toBe("Context used")
  })

  it("announces a rising crossing once, and again after resetKey", async () => {
    const t = await setup({ used: 10, max: 100, resetKey: "a" })
    await t.rerender({ used: 80 })
    expect(t.rec.log.map((a) => a.message)).toEqual(["Context almost full"])
    expect(t.levels).toEqual(["warning"])
    // Still in the warning zone: no new crossing.
    await t.rerender({ used: 78 })
    await t.rerender({ used: 85 })
    expect(t.levels).toEqual(["warning"])
    await t.rerender({ used: 96 })
    expect(t.rec.log.map((a) => a.message)).toEqual(["Context almost full", "Context full"])
    await t.rerender({ resetKey: "b", used: 10 })
    await t.rerender({ used: 80 })
    expect(t.levels).toEqual(["warning", "full", "warning"])
  })
})
