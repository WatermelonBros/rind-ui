// Angle Slider's Vue parts: one native range input named by the Label with the angle in words;
// arrows, Home and End, wrapping; read-only; the form value and reset; v-model; markup parity
// with React. Pointer angles need layout (the React browser suite covers the shared core).
import * as R from "@rind-ui/react"
import { getAngleSlider } from "@rind-ui/testing"
import { createElement as r } from "react"
import { describe, expect, it, vi } from "vitest"
import { h, nextTick, ref } from "vue"
import { mount } from "../../fixtures/mount"
import { clientParity, serverParity } from "../../fixtures/parity"
import { AngleSlider, RindProvider } from "../index"

function setup(root: Record<string, unknown> = {}) {
  const m = mount(() =>
    h(RindProvider, { locale: "en-US" }, () =>
      h("form", null, [
        h(AngleSlider.Root, { name: "heading", defaultValue: 90, ...root }, () => [
          h(AngleSlider.Label, null, () => "Heading"),
          h(AngleSlider.Control, null, () => [
            h(AngleSlider.MarkerGroup, null, () =>
              [0, 90, 180, 270].map((v) => h(AngleSlider.Marker, { key: v, value: v })),
            ),
            h(AngleSlider.Thumb, null, () => [h(AngleSlider.Input)]),
          ]),
          h(AngleSlider.Value),
        ]),
      ]),
    ),
  )
  const q = (sel: string) => m.host.querySelector<HTMLElement>(sel)
  return {
    ...m,
    q,
    form: () => m.host.querySelector("form") as HTMLFormElement,
    d: () => getAngleSlider(document.body, { label: "Heading" }),
  }
}

describe("Vue AngleSlider", () => {
  it("is one native range input named by the Label, with the angle in words", async () => {
    const t = setup()
    await nextTick()
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
    await nextTick()
    const d = t.d()
    await d.step(2)
    expect(await d.value()).toBe(92)
    await d.toEdge("max")
    await d.step(1)
    expect(await d.value()).toBe(0)
    expect(onValueCommit).toHaveBeenLastCalledWith(0, { reason: "keyboard" })
  })

  it("read-only keeps the angle", async () => {
    const t = setup({ readOnly: true })
    await nextTick()
    await t.d().step(3)
    expect(await t.d().value()).toBe(90)
  })

  it("submits the angle and restores the default on a form reset", async () => {
    const t = setup()
    await nextTick()
    await t.d().step(5)
    expect(new FormData(t.form()).get("heading")).toBe("95")
    t.form().reset()
    await vi.waitFor(async () => expect(await t.d().value()).toBe(90))
    await nextTick()
    expect(t.q('[data-part="value"]')?.textContent).toBe("90°")
  })

  it("v-model follows the keyboard", async () => {
    const model = ref(10)
    const m = mount(() =>
      h(RindProvider, null, () =>
        h(
          AngleSlider.Root,
          {
            modelValue: model.value,
            "onUpdate:modelValue": (v: number) => (model.value = v),
            "aria-label": "Rotation",
          },
          () => [h(AngleSlider.Control, null, () => [h(AngleSlider.Input)])],
        ),
      ),
    )
    await nextTick()
    await getAngleSlider(m.host, { label: "Rotation" }).step(-1)
    expect(model.value).toBe(9)
  })

  it("matches React's markup, server and client", async () => {
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
    const vue = () =>
      h(AngleSlider.Root, { defaultValue: 45 }, () => [
        h(AngleSlider.Label, null, () => "Heading"),
        h(AngleSlider.Control, null, () => [
          h(AngleSlider.MarkerGroup, null, () => [h(AngleSlider.Marker, { value: 90 })]),
          h(AngleSlider.Thumb, null, () => [h(AngleSlider.Input)]),
        ]),
        h(AngleSlider.Value),
      ])
    await serverParity(react, vue)
    await clientParity(react, vue)
  })
})
