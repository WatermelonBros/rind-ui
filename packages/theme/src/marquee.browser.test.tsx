// add-marquee 6.2: the Marquee stylesheet alone, on the markup core renders: the play state per
// data-state, the RTL keyframes, the fade on and off, the trigger's icon and size, the
// reduced-motion and forced-colors rules.
import { afterEach, describe, expect, it } from "vitest"
import marquee from "./marquee.css?inline"
import { cleanup, files, inject, mount, q } from "./test-css"

afterEach(cleanup)

const sheet = () =>
  inject(
    `@layer rind.tokens, rind.themes, rind.components, rind.preferences;\n${files.tokens}\n${files.calm}\n${files.base}\n${files.variants}\n${files.icons}\n${marquee}`,
  )

const attrs = (part: string, state: string, extra = "") =>
  `data-scope="marquee" data-part="${part}" data-instance="m" data-state="${state}" data-orientation="horizontal" ${extra}`

const band = (state: string, { dir = "ltr", paused = false, fade = "" } = {}) =>
  `<div dir="${dir}" style="inline-size:320px;${fade}" ${attrs("root", state)}>
  <button type="button" aria-label="Pause animation" ${attrs("pause-trigger", state, paused ? "data-paused" : "")}></button>
  <div style="display:flex;overflow:clip;--rind-marquee-duration:4s" ${attrs("viewport", state)}>
    <div style="display:flex;flex-shrink:0" ${attrs("content", state, 'data-index="0"')}>Acme Globex Initech</div>
    <div style="display:flex;flex-shrink:0" aria-hidden="true" ${attrs("content", state, 'data-index="1" data-copy')}>Acme Globex Initech</div>
  </div>
</div>`

const content = (host: HTMLElement) => getComputedStyle(q(host, '[data-part="content"]'))

describe("Marquee stylesheet", () => {
  it("runs only while running; paused holds; idle and static have no animation", () => {
    const of = (state: string) => {
      sheet()
      const c = content(mount(band(state)))
      const out = [c.animationName, c.animationPlayState]
      cleanup()
      return out
    }
    expect(of("running")).toEqual(["rind-marquee-x", "running"])
    expect(of("paused")).toEqual(["rind-marquee-x", "paused"])
    expect(of("idle")[0]).toBe("none")
    expect(of("static")[0]).toBe("none")
  })

  it("RTL uses the mirrored keyframes; the duration comes from the variable", () => {
    sheet()
    const c = content(mount(band("running", { dir: "rtl" })))
    expect(c.animationName).toBe("rind-marquee-x-rtl")
    expect(c.animationDuration).toBe("4s")
  })

  it("the edges fade by default; --rind-marquee-fade: 0px turns it off", () => {
    sheet()
    const on = getComputedStyle(q(mount(band("running")), '[data-part="viewport"]')).maskImage
    expect(on).toContain("linear-gradient")
    cleanup()
    sheet()
    const off = getComputedStyle(
      q(mount(band("running", { fade: "--rind-marquee-fade:0px" })), '[data-part="viewport"]'),
    ).maskImage
    expect(off).toContain("0px")
  })

  it("the trigger is at least 24 px and draws pause, then play", () => {
    sheet()
    const host = mount(band("running"))
    const t = q(host, '[data-part="pause-trigger"]')
    const box = t.getBoundingClientRect()
    expect(box.width).toBeGreaterThanOrEqual(24)
    expect(box.height).toBeGreaterThanOrEqual(24)
    const pause = getComputedStyle(t, "::before").maskImage
    cleanup()
    sheet()
    const play = getComputedStyle(
      q(mount(band("paused", { paused: true })), '[data-part="pause-trigger"]'),
      "::before",
    ).maskImage
    expect(pause).toContain("data:image/svg+xml")
    expect(play).not.toBe(pause)
  })

  it("reduced motion removes the animation; forced colors use system colours", () => {
    expect(marquee).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*animation: none/)
    expect(marquee).toMatch(/@media \(forced-colors: active\)[\s\S]*ButtonText/)
  })
})
