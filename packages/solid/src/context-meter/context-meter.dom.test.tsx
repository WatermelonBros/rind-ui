/** @jsxImportSource solid-js */
// Context Meter's Solid parts: a meter with the usage in words, no meter without a size, the
// zone, a rising crossing announced once and re-armed by resetKey, the breakdown.
import type { ContextMeterLevel } from "@rind-ui/core"
import { getContextMeter, recordingAnnouncer } from "@rind-ui/testing"
import axe from "axe-core"
import { describe, expect, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { ContextMeter, RindProvider } from "../index"

/** Lets mount effects run (no elapsed time). */
const settle = () => Promise.resolve()

interface Props {
  used: number
  max: number | null
  resetKey?: string
}

function setup(initial: Props, label = true) {
  const rec = recordingAnnouncer()
  const levels: ContextMeterLevel[] = []
  const m = mount(
    (p: Props) => (
      <RindProvider locale="en-US" announcer={rec.announcer}>
        <ContextMeter.Root
          used={p.used}
          max={p.max}
          resetKey={p.resetKey}
          onThreshold={(l) => levels.push(l)}
        >
          {label ? <ContextMeter.Label>Context</ContextMeter.Label> : null}
          <ContextMeter.ValueText />
          <ContextMeter.Track>
            <ContextMeter.Indicator />
          </ContextMeter.Track>
          <ContextMeter.Breakdown>
            <ContextMeter.BreakdownItem itemKey="system" label="System prompt" amount="2K" />
          </ContextMeter.Breakdown>
        </ContextMeter.Root>
      </RindProvider>
    ),
    initial,
  )
  const q = (sel: string) => m.host.querySelector(sel) as HTMLElement
  return { ...m, rec, levels, q }
}

describe("Solid ContextMeter", () => {
  it("is a meter named by its Label, with the usage in words", async () => {
    const t = setup({ used: 17_000, max: 100_000 })
    await settle()
    const root = t.q('[data-part="root"]')
    expect(root.getAttribute("role")).toBe("meter")
    expect(root.getAttribute("aria-labelledby")).toBe(t.q('[data-part="label"]').id)
    expect(root.getAttribute("aria-valuenow")).toBe("17000")
    expect(root.dataset["zone"]).toBe("ok")
    const d = getContextMeter(document.body, { name: "Context" })
    expect(await d.valueText()).toBe("17K of 100K tokens, 17%")
    expect(await d.percent()).toBe(17)
    expect(t.q('[data-part="value-text"]').textContent).toBe("17%")
    expect(t.q('[data-part="value-text"]').getAttribute("aria-hidden")).toBe("true")
    expect(t.q('[data-part="breakdown"]').tagName).toBe("DL")
    expect(t.q('[data-part="breakdown-item"]').dataset["key"]).toBe("system")
    expect(t.q('[data-part="breakdown-item"] dt').textContent).toBe("System prompt")
    const { violations } = await axe.run(t.host, {
      rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
    })
    expect(violations.map((v) => v.id)).toEqual([])
  })

  it("is named by its message without a Label, and is text without a size", async () => {
    const t = setup({ used: 500, max: null }, false)
    await settle()
    const root = t.q('[data-part="root"]')
    expect(root.hasAttribute("role")).toBe(false)
    expect(root.dataset["state"]).toBe("unknown")
    expect(t.q('[data-part="value-text"]').textContent).toBe("500 tokens used")
    const named = setup({ used: 1, max: 10 }, false)
    await settle()
    expect(named.q('[data-part="root"]').getAttribute("aria-label")).toBe("Context used")
  })

  it("announces a rising crossing once, and again after resetKey", async () => {
    const t = setup({ used: 10, max: 100, resetKey: "a" })
    await settle()
    await t.rerender({ used: 80 })
    expect(t.rec.log.map((a) => a.message)).toEqual(["Context almost full"])
    expect(t.levels).toEqual(["warning"])
    expect(t.q('[data-part="indicator"]').dataset["zone"]).toBe("warning")
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
