// Color Wheel's Svelte parts: one range input named by the Label with the hue in words; only
// the hue changes; a grey keeps its hue; wrapping; the hex in forms and a reset to the default
// colour; bind:value; DOM parity with React. Ring presses need layout (React browser suite).
import { type Color, formatColor } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { getColorWheel } from "@rind-ui/testing"
import { createElement as r } from "react"
import { flushSync } from "svelte"
import { describe, expect, it, vi } from "vitest"
import Wheel from "../../fixtures/color-wheel/wheel.svelte"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"

function setup(root: Record<string, unknown> = {}) {
  const m = mount(Wheel, { root } as never)
  const q = (sel: string) => m.host.querySelector<HTMLElement>(sel)
  return {
    ...m,
    q,
    form: () => m.host.querySelector("form") as HTMLFormElement,
    d: () => getColorWheel(document.body, { label: "Accent hue" }),
  }
}

describe("Svelte ColorWheel", () => {
  it("is a group with one range input named by the Label, the hue in words", async () => {
    const t = setup()
    expect(t.q('[data-part="root"]')?.getAttribute("role")).toBe("group")
    expect(await t.d().hue()).toBe(240)
    expect(await t.d().valueText()).toBe("Hue 240°, blue")
    expect(t.q('[data-part="value"]')?.textContent).toBe("240°")
  })

  it("a key changes only the hue; past 359 it wraps to 0", async () => {
    const onValueChange = vi.fn()
    const t = setup({ defaultValue: "hsl(0 80% 40%)", onValueChange })
    await t.d().step(120)
    expect(formatColor(onValueChange.mock.lastCall?.[0], "css")).toBe("hsl(120, 80%, 40%)")
    await t.d().toEdge("max")
    await t.d().step(1)
    expect(await t.d().hue()).toBe(0)
  })

  it("a grey keeps the hue it was given", async () => {
    const t = setup({ defaultValue: "#808080" })
    await t.d().step(200)
    expect(await t.d().hue()).toBe(200)
  })

  it("submits the colour as hex and a form reset restores the default colour", async () => {
    const t = setup({ defaultValue: "#ff0000" })
    expect(new FormData(t.form()).get("accent")).toBe("#FF0000")
    await t.d().step(120)
    expect(new FormData(t.form()).get("accent")).toBe("#00FF00")
    t.form().reset()
    flushSync()
    await vi.waitFor(async () => expect(await t.d().hue()).toBe(0))
    expect(new FormData(t.form()).get("accent")).toBe("#FF0000")
    expect(t.q('[data-part="value"]')?.textContent).toBe("0°")
  })

  it("bind:value follows the keyboard", async () => {
    const onBound = vi.fn()
    const m = mount(Wheel, { onBound } as never)
    await getColorWheel(m.host).step(5)
    flushSync()
    expect(formatColor(onBound.mock.lastCall?.[0] as Color, "css")).toBe("hsl(15, 100%, 50%)")
  })

  it("matches React's DOM", async () => {
    const react = r(
      R.ColorWheel.Root,
      { defaultValue: "#3366ff", name: "c" },
      r(R.ColorWheel.Label, { key: "l" }, "Hue"),
      r(
        R.ColorWheel.Track,
        { key: "t" },
        r(R.ColorWheel.Thumb, { key: "h" }, r(R.ColorWheel.Input)),
      ),
      r(R.ColorWheel.Value, { key: "v" }),
    )
    await clientParity(react, Wheel, { full: false } as never)
  })
})
