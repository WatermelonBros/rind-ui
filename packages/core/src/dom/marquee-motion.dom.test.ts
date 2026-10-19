// marquee-motion: hidden copies stay untabbable as content changes (jsdom and browser); in the
// browser, retime keeps progress, mirror keeps position, reveal seeks without scrolling.
import { afterEach, describe, expect, it } from "vitest"
import { mirror, retime, reveal, untabbable } from "./marquee-motion"

afterEach(() => {
  document.body.innerHTML = ""
})

const flush = () => new Promise<void>((r) => queueMicrotask(r))

describe("untabbable", () => {
  it("every tabbable gets tabindex -1, including ones added later; negatives are kept", async () => {
    document.body.innerHTML = `<div id="c"><a href="#a">A</a><button>B</button><span tabindex="0">S</span><i tabindex="-2"></i></div>`
    const copy = document.getElementById("c") as HTMLElement
    const stop = untabbable(copy)
    expect(
      [...copy.querySelectorAll("a, button, span")].map((e) => e.getAttribute("tabindex")),
    ).toEqual(["-1", "-1", "-1"])
    expect(copy.querySelector("i")?.getAttribute("tabindex")).toBe("-2")
    const late = document.createElement("a")
    late.href = "#late"
    copy.append(late)
    await flush()
    expect(late.getAttribute("tabindex")).toBe("-1")
    stop()
  })
})

const browser =
  typeof Element.prototype.animate === "function" && !navigator.userAgent.includes("jsdom")

describe.runIf(browser)("retime, mirror, reveal", () => {
  const band = () => {
    document.body.innerHTML = `<div id="v" style="inline-size:200px;overflow:clip;display:flex"><div id="c" style="display:flex;flex-shrink:0;inline-size:400px"><span style="inline-size:300px;flex:none">x</span><a id="t" href="#t" style="inline-size:100px;flex:none">t</a></div></div>`
    const copy = document.getElementById("c") as HTMLElement
    const anim = copy.animate([{ translate: "0" }, { translate: "-100%" }], {
      duration: 1000,
      iterations: Number.POSITIVE_INFINITY,
    })
    anim.pause()
    return { copy, anim, viewport: document.getElementById("v") as HTMLElement }
  }

  it("retime keeps the progress", () => {
    const { copy, anim } = band()
    anim.currentTime = 250
    retime([copy], 1000, 2000)
    expect(anim.currentTime).toBe(500)
  })

  it("mirror keeps the position", () => {
    const { copy, anim } = band()
    anim.currentTime = 1250
    mirror([copy], 1000)
    expect(anim.currentTime).toBe(750)
  })

  it("reveal seeks the target to the viewport's start, never scrolling", () => {
    const { copy, anim, viewport } = band()
    anim.currentTime = 0
    const target = document.getElementById("t") as HTMLElement
    reveal(target, viewport, [copy], { axis: "x", dir: "ltr", reversed: false, durationMs: 1000 })
    expect(anim.currentTime).toBe(750)
    expect(viewport.scrollLeft).toBe(0)
  })
})
