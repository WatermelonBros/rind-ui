// Context Meter's Svelte parts: a meter with the usage in words, no meter without a size, a
// rising crossing announced once and re-armed by resetKey, the breakdown, DOM parity with React.
import type { ContextMeterLevel } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { getContextMeter, recordingAnnouncer } from "@rind-ui/testing"
import axe from "axe-core"
import { createElement as r } from "react"
import { flushSync } from "svelte"
import { describe, expect, it } from "vitest"
import Meter from "../../fixtures/context-meter/meter.svelte"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"

interface Props {
  used: number
  max: number | null
  resetKey?: string
}

function setup(initial: Props, label = true) {
  const rec = recordingAnnouncer()
  const levels: ContextMeterLevel[] = []
  const m = mount(Meter, {
    ...initial,
    label,
    provider: { locale: "en-US", announcer: rec.announcer },
    onThreshold: (l: ContextMeterLevel) => levels.push(l),
  } as never)
  const q = (sel: string) => m.host.querySelector(sel) as HTMLElement
  const rerender = (next: Partial<Props>) => {
    m.rerender(next as never)
    flushSync()
  }
  return { ...m, rerender, rec, levels, q }
}

describe("Svelte ContextMeter", () => {
  it("is a meter named by its Label, with the usage in words", async () => {
    const t = setup({ used: 17_000, max: 100_000 })
    const root = t.q('[data-part="root"]')
    expect(root.getAttribute("role")).toBe("meter")
    expect(root.getAttribute("aria-labelledby")).toBe(t.q('[data-part="label"]').id)
    expect(root.dataset["zone"]).toBe("ok")
    const d = getContextMeter(document.body, { name: "Context" })
    expect(await d.valueText()).toBe("17K of 100K tokens, 17%")
    expect(t.q('[data-part="value-text"]').textContent).toBe("17%")
    expect(t.q('[data-part="breakdown-item"]').dataset["key"]).toBe("system")
    expect(t.q('[data-part="breakdown-item"] dd').textContent).toBe("2K")
    const { violations } = await axe.run(t.host, {
      rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
    })
    expect(violations.map((v) => v.id)).toEqual([])
  })

  it("is text without a size", () => {
    const t = setup({ used: 500, max: null }, false)
    expect(t.q('[data-part="root"]').hasAttribute("role")).toBe(false)
    expect(t.q('[data-part="value-text"]').textContent).toBe("500 tokens used")
  })

  it("announces a rising crossing once, and again after resetKey", () => {
    const t = setup({ used: 10, max: 100, resetKey: "a" })
    t.rerender({ used: 80 })
    expect(t.rec.log.map((a) => a.message)).toEqual(["Context almost full"])
    t.rerender({ used: 85 })
    t.rerender({ used: 96 })
    expect(t.levels).toEqual(["warning", "full"])
    t.rerender({ resetKey: "b", used: 10 })
    t.rerender({ used: 80 })
    expect(t.levels).toEqual(["warning", "full", "warning"])
  })

  it("matches React", async () => {
    const react = r(
      R.RindProvider,
      { locale: "en-US" },
      r(
        R.ContextMeter.Root,
        { used: 17_000, max: 100_000 },
        r(R.ContextMeter.Label, { key: "l" }, "Context"),
        r(R.ContextMeter.ValueText, { key: "v" }),
        r(R.ContextMeter.Track, { key: "t" }, r(R.ContextMeter.Indicator)),
        r(
          R.ContextMeter.Breakdown,
          { key: "b" },
          r(R.ContextMeter.BreakdownItem, {
            itemKey: "system",
            label: "System prompt",
            amount: "2K",
          }),
        ),
      ),
    )
    await clientParity(react, Meter, { used: 17_000, max: 100_000 } as never)
  })
})
