// Color Wheel's Vue parts: one range input named by the Label with the hue in words; only the
// hue changes; a grey keeps its hue; wrapping; the hex in forms and a reset to the default
// colour; v-model; markup parity with React. Ring presses need layout (React browser suite).
import { type Color, formatColor } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { getColorWheel } from "@rind-ui/testing"
import { createElement as r } from "react"
import { describe, expect, it, vi } from "vitest"
import { h, nextTick, shallowRef } from "vue"
import { mount } from "../../fixtures/mount"
import { clientParity, serverParity } from "../../fixtures/parity"
import { ColorWheel, RindProvider } from "../index"

function setup(root: Record<string, unknown> = {}) {
  const m = mount(() =>
    h(RindProvider, { locale: "en-US" }, () =>
      h("form", null, [
        h(ColorWheel.Root, { name: "accent", defaultValue: "hsl(240 80% 40%)", ...root }, () => [
          h(ColorWheel.Label, null, () => "Accent hue"),
          h(ColorWheel.Track, null, () => [h(ColorWheel.Thumb, null, () => [h(ColorWheel.Input)])]),
          h(ColorWheel.Value),
        ]),
      ]),
    ),
  )
  const q = (sel: string) => m.host.querySelector<HTMLElement>(sel)
  return {
    ...m,
    q,
    form: () => m.host.querySelector("form") as HTMLFormElement,
    d: () => getColorWheel(document.body, { label: "Accent hue" }),
  }
}

describe("Vue ColorWheel", () => {
  it("is a group with one range input named by the Label, the hue in words", async () => {
    const t = setup()
    await nextTick()
    expect(t.q('[data-part="root"]')?.getAttribute("role")).toBe("group")
    expect(await t.d().hue()).toBe(240)
    expect(await t.d().valueText()).toBe("Hue 240°, blue")
    expect(t.q('[data-part="value"]')?.textContent).toBe("240°")
  })

  it("a key changes only the hue; past 359 it wraps to 0", async () => {
    const onValueChange = vi.fn()
    const t = setup({ defaultValue: "hsl(0 80% 40%)", onValueChange })
    await nextTick()
    await t.d().step(120)
    expect(formatColor(onValueChange.mock.lastCall?.[0], "css")).toBe("hsl(120, 80%, 40%)")
    await t.d().toEdge("max")
    await t.d().step(1)
    expect(await t.d().hue()).toBe(0)
  })

  it("a grey keeps the hue it was given", async () => {
    const t = setup({ defaultValue: "#808080" })
    await nextTick()
    await t.d().step(200)
    expect(await t.d().hue()).toBe(200)
  })

  it("submits the colour as hex and a form reset restores the default colour", async () => {
    const t = setup({ defaultValue: "#ff0000" })
    await nextTick()
    expect(new FormData(t.form()).get("accent")).toBe("#FF0000")
    await t.d().step(120)
    expect(new FormData(t.form()).get("accent")).toBe("#00FF00")
    t.form().reset()
    await vi.waitFor(async () => expect(await t.d().hue()).toBe(0))
    await nextTick()
    expect(new FormData(t.form()).get("accent")).toBe("#FF0000")
    expect(t.q('[data-part="value"]')?.textContent).toBe("0°")
  })

  it("v-model follows the keyboard", async () => {
    const model = shallowRef<Color | string>("hsl(10 100% 50%)")
    const m = mount(() =>
      h(RindProvider, null, () =>
        h(
          ColorWheel.Root,
          {
            modelValue: model.value,
            "onUpdate:modelValue": (c: Color) => (model.value = c),
          },
          () => [h(ColorWheel.Track, null, () => [h(ColorWheel.Input)])],
        ),
      ),
    )
    await nextTick()
    await getColorWheel(m.host).step(5)
    expect(formatColor(model.value as Color, "css")).toBe("hsl(15, 100%, 50%)")
  })

  it("matches React's markup, server and client", async () => {
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
    const vue = () =>
      h(ColorWheel.Root, { defaultValue: "#3366ff", name: "c" }, () => [
        h(ColorWheel.Label, null, () => "Hue"),
        h(ColorWheel.Track, null, () => [h(ColorWheel.Thumb, null, () => [h(ColorWheel.Input)])]),
        h(ColorWheel.Value),
      ])
    await serverParity(react, vue)
    await clientParity(react, vue)
  })
})
