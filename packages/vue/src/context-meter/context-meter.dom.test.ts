// Context Meter's Vue parts: a meter with the usage in words, no meter without a size, a rising
// crossing announced once and re-armed by resetKey, the breakdown.
import type { ContextMeterLevel } from "@rind-ui/core"
import { getContextMeter, recordingAnnouncer } from "@rind-ui/testing"
import axe from "axe-core"
import { describe, expect, it } from "vitest"
import { h, nextTick } from "vue"
import { mount } from "../../fixtures/mount"
import { RindProvider } from "../index"
import { ContextMeter } from "./index"

interface Props {
  used: number
  max: number | null
  resetKey?: string
}

async function setup(initial: Props, label = true) {
  const rec = recordingAnnouncer()
  const levels: ContextMeterLevel[] = []
  const m = mount(
    (p: Props) =>
      h(RindProvider, { locale: "en-US", announcer: rec.announcer }, () =>
        h(
          ContextMeter.Root,
          {
            used: p.used,
            max: p.max,
            resetKey: p.resetKey,
            onThreshold: (l: ContextMeterLevel) => levels.push(l),
          } as never,
          () => [
            label ? h(ContextMeter.Label, null, () => "Context") : null,
            h(ContextMeter.ValueText),
            h(ContextMeter.Track, null, () => h(ContextMeter.Indicator)),
            h(ContextMeter.Breakdown, null, () =>
              h(ContextMeter.BreakdownItem, {
                itemKey: "system",
                label: "System prompt",
                amount: "2K",
              }),
            ),
          ],
        ),
      ),
    initial,
  )
  await nextTick()
  const q = (sel: string) => m.host.querySelector(sel) as HTMLElement
  return { ...m, rec, levels, q }
}

describe("Vue ContextMeter", () => {
  it("is a meter named by its Label, with the usage in words", async () => {
    const t = await setup({ used: 17_000, max: 100_000 })
    const root = t.q('[data-part="root"]')
    expect(root.getAttribute("role")).toBe("meter")
    expect(root.getAttribute("aria-labelledby")).toBe(t.q('[data-part="label"]').id)
    expect(root.getAttribute("aria-valuenow")).toBe("17000")
    const d = getContextMeter(document.body, { name: "Context" })
    expect(await d.valueText()).toBe("17K of 100K tokens, 17%")
    expect(await d.percent()).toBe(17)
    expect(t.q('[data-part="value-text"]').textContent).toBe("17%")
    expect(t.q('[data-part="breakdown"]').tagName).toBe("DL")
    expect(t.q('[data-part="breakdown-item"]').dataset["key"]).toBe("system")
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
    expect(t.q('[data-part="value-text"]').textContent).toBe("500 tokens used")
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
