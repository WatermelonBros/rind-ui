// Angle Slider's Svelte parts: one native range input named by the Label with the angle in
// words; arrows, Home and End, wrapping; read-only; the form value and reset; bind:value; DOM
// parity with React. Pointer angles need layout (the React browser suite covers the shared core).
import * as R from "@rind-ui/react"
import { getAngleSlider } from "@rind-ui/testing"
import { createElement as r } from "react"
import { flushSync } from "svelte"
import { describe, expect, it, vi } from "vitest"
import Dial from "../../fixtures/angle-slider/dial.svelte"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"

function setup(root: Record<string, unknown> = {}) {
  const m = mount(Dial, { root } as never)
  const q = (sel: string) => m.host.querySelector<HTMLElement>(sel)
  return {
    ...m,
    q,
    form: () => m.host.querySelector("form") as HTMLFormElement,
    d: () => getAngleSlider(document.body, { label: "Heading" }),
  }
}

describe("Svelte AngleSlider", () => {
  it("is one native range input named by the Label, with the angle in words", async () => {
    const t = setup()
    const input = t.q('[data-part="input"]') as HTMLInputElement
    expect(input.type).toBe("range")
    expect(input.getAttribute("aria-labelledby")).toBe(t.q('[data-part="label"]')?.id)
    expect(await t.d().valueText()).toBe("90 degrees")
    expect(t.q('[data-part="value"]')?.textContent).toBe("90°")
    expect(t.q('[data-part="marker"][data-value="0"]')?.dataset["state"]).toBe("under-value")
  })

  it("arrows step, Home and End reach the ends; past an end it wraps", async () => {
    const onValueCommit = vi.fn()
    const t = setup({ onValueCommit })
    const d = t.d()
    await d.step(2)
    expect(await d.value()).toBe(92)
    await d.toEdge("max")
    await d.step(1)
    expect(await d.value()).toBe(0)
    expect(onValueCommit).toHaveBeenLastCalledWith(0, { reason: "keyboard" })
  })

  it("read-only keeps the angle", async () => {
    const t = setup({ readonly: true })
    await t.d().step(3)
    expect(await t.d().value()).toBe(90)
  })

  it("submits the angle and restores the default on a form reset", async () => {
    const t = setup()
    await t.d().step(5)
    expect(new FormData(t.form()).get("heading")).toBe("95")
    t.form().reset()
    flushSync()
    await vi.waitFor(async () => expect(await t.d().value()).toBe(90))
    flushSync()
    expect(t.q('[data-part="value"]')?.textContent).toBe("90°")
  })

  it("bind:value follows the keyboard", async () => {
    const onBound = vi.fn()
    const m = mount(Dial, { onBound } as never)
    await getAngleSlider(m.host, { label: "Rotation" }).step(-1)
    flushSync()
    expect(onBound).toHaveBeenLastCalledWith(9)
  })

  it("matches React's DOM", async () => {
    const react = r(
      R.AngleSlider.Root,
      { defaultValue: 45 },
      r(R.AngleSlider.Label, { key: "l" }, "Heading"),
      r(
        R.AngleSlider.Control,
        { key: "c" },
        r(R.AngleSlider.MarkerGroup, { key: "g" }, r(R.AngleSlider.Marker, { value: 90 })),
        r(R.AngleSlider.Thumb, { key: "t" }, r(R.AngleSlider.Input)),
      ),
      r(R.AngleSlider.Value, { key: "v" }),
    )
    await clientParity(react, Dial, { full: false } as never)
  })
})
