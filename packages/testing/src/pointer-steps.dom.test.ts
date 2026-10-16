// test-drivers "Pointer Steps, Geometry And Native Values" through the DOM adapter, in jsdom
// (no layout) and in browser mode. The Playwright twin is fixtures/slider/slider.pw.test.ts.
import { afterEach, describe, expect, it } from "vitest"
import { domEnv } from "./index"

const inJsdom = navigator.userAgent.includes("jsdom")

afterEach(() => {
  document.body.innerHTML = ""
})

const env = () =>
  domEnv().create({ scope: "p", anchor: { role: "group", name: "G" }, modality: "pointer" })

function mount() {
  document.body.innerHTML =
    '<div role="group" aria-label="G" data-scope="p" data-part="root" data-instance="1">' +
    '<div data-scope="p" data-part="surface" data-instance="1" style="width:200px;height:20px"></div>' +
    '<input type="range" aria-label="R" data-scope="p" data-part="input" data-instance="1" value="10"></div>'
  return {
    surface: document.querySelector('[data-part="surface"]') as HTMLElement,
    input: document.querySelector("input") as HTMLInputElement,
  }
}

describe("pointer steps, geometry and native values (DOM adapter)", () => {
  it("Native adjust: fill sets the property, one input and one change, no keydown", async () => {
    const { input } = mount()
    const seen: string[] = []
    for (const t of ["input", "change", "keydown", "pointerdown"]) {
      input.addEventListener(t, () => seen.push(`${t} ${input.value}`))
    }
    await env().part("input").fill("35")
    expect(input.value).toBe("35")
    expect(seen).toEqual(["input 35", "change 35"])
  })

  it.runIf(inJsdom)("Pointer step without layout rejects saying it needs layout", async () => {
    mount()
    const part = env().part("surface")
    expect(await part.box()).toBeNull()
    await expect(part.pointer("down", { at: { x: 0.5, y: 0.5 } })).rejects.toThrow(/needs layout/)
  })

  it.skipIf(inJsdom)("Box in a browser: 200 × 20", async () => {
    mount()
    const box = await env().part("surface").box()
    expect(box?.width).toBe(200)
    expect(box?.height).toBe(20)
  })

  it.skipIf(inJsdom)("pointer steps land at the fraction, one pointer id per gesture", async () => {
    const { surface } = mount()
    const seen: string[] = []
    for (const t of ["pointerdown", "pointermove", "pointerup", "pointercancel"]) {
      surface.addEventListener(t, (e) => {
        const p = e as PointerEvent
        const r = surface.getBoundingClientRect()
        seen.push(`${t} ${p.pointerType} ${p.pointerId} ${Math.round(p.clientX - r.left)}`)
      })
    }
    const part = env().part("surface")
    await part.pointer("down", { at: { x: 0.25, y: 0.5 }, pointerType: "touch" })
    await part.pointer("move", { at: { x: 0.5, y: 0.5 }, pointerType: "touch" })
    await part.pointer("cancel", { at: { x: 0.5, y: 0.5 }, pointerType: "touch" })
    expect(seen).toEqual([
      "pointerdown touch 2 50",
      "pointermove touch 2 100",
      "pointercancel touch 2 100",
    ])
  })
})
