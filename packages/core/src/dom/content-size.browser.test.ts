// content-size in real layout: the 0px -> px -> auto -> px -> 0px sequence, flex and grid
// measuring, nesting and panel switching. jsdom has no layout, so browser only.
import { afterEach, describe, expect, it, vi } from "vitest"
import { contentSize } from "./content-size"

const H = "--x-content-height"
const W = "--x-content-width"
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

function box(height: number, width = 100) {
  const d = document.createElement("div")
  d.style.cssText = `height:${height}px;width:${width}px;flex:none`
  return d
}
function mount(style = "", ...children: HTMLElement[]) {
  const el = document.createElement("div")
  el.style.cssText = `height:var(${H});overflow:hidden;${style}`
  el.append(...children)
  document.body.append(el)
  return el
}
const v = (el: HTMLElement, name: string) => el.style.getPropertyValue(name)
/** Every height-variable write, in order. */
function recordHeight(el: HTMLElement) {
  const writes: string[] = []
  const set = el.style.setProperty.bind(el.style)
  vi.spyOn(el.style, "setProperty").mockImplementation((name, value, priority) => {
    if (name === H) writes.push(String(value))
    set(name, value, priority ?? "")
  })
  return writes
}

afterEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ""
})

describe("content-size", () => {
  it("defines both variables as 0px from the start", () => {
    const el = mount("", box(100))
    contentSize(el, "x")
    expect(v(el, H)).toBe("0px")
    expect(v(el, W)).toBe("0px")
    expect(el.getBoundingClientRect().height).toBe(0)
  })

  it("opened() writes the natural px size, settled() writes auto", () => {
    const el = mount("width:300px", box(100, 180))
    const cs = contentSize(el, "x")
    cs.opened({ instant: false })
    expect(v(el, H)).toBe("100px")
    expect(v(el, W)).toBe("300px")
    cs.settled()
    expect(v(el, H)).toBe("auto")
    expect(v(el, W)).toBe("auto")
  })

  it("settled() without a pending open changes nothing", () => {
    const el = mount("", box(100))
    const cs = contentSize(el, "x")
    cs.settled()
    expect(v(el, H)).toBe("0px")
  })

  it("opened({ instant: true }) writes auto directly, with no px step", () => {
    const el = mount("", box(100))
    const cs = contentSize(el, "x")
    const writes = recordHeight(el)
    cs.opened({ instant: true })
    expect(writes).toEqual(["auto"])
    expect(v(el, W)).toBe("auto")
    expect(el.getBoundingClientRect().height).toBe(100)
  })

  it("closed() from auto writes the px size, then 0px", () => {
    const el = mount("", box(100))
    const cs = contentSize(el, "x")
    cs.opened({ instant: true })
    const writes = recordHeight(el)
    cs.closed()
    expect(writes.filter((w) => w !== "auto")).toEqual(["100px", "0px"])
    expect(v(el, H)).toBe("0px")
    expect(v(el, W)).toBe("0px")
  })

  it("a nested zero-size content defines its own variables (radix#3037)", () => {
    const inner = document.createElement("div")
    inner.style.cssText = `height:var(${H});overflow:hidden`
    const outer = mount("", inner)
    const outerSize = contentSize(outer, "x")
    outerSize.opened({ instant: true })
    const innerSize = contentSize(inner, "x")
    expect(v(inner, H)).toBe("0px")
    expect(getComputedStyle(inner).getPropertyValue(H).trim()).toBe("0px")
    expect(v(outer, H)).toBe("auto")
    innerSize.opened({ instant: true })
    expect(getComputedStyle(inner).getPropertyValue(H).trim()).toBe("auto")
    innerSize.opened({ instant: false })
    expect(v(inner, H)).toBe("0px")
  })

  it("measures the natural height of flex content centred on the main axis (radix#2832)", () => {
    const el = mount(
      "display:flex;flex-direction:column;justify-content:center;align-items:center;width:200px",
      box(100),
    )
    const cs = contentSize(el, "x")
    cs.opened({ instant: false })
    expect(v(el, H)).toBe("100px")
  })

  it("measures the natural height of grid content centred (base-ui#2767)", () => {
    const el = mount(
      "display:grid;justify-content:center;align-content:center;align-items:center;width:200px",
      box(100),
    )
    const cs = contentSize(el, "x")
    cs.opened({ instant: false })
    expect(v(el, H)).toBe("100px")
  })

  it("restores the inline alignment styles after measuring", () => {
    const el = mount("display:flex;justify-content:center;align-items:flex-end", box(100))
    const cs = contentSize(el, "x")
    cs.opened({ instant: false })
    expect(el.style.justifyContent).toBe("center")
    expect(el.style.alignItems).toBe("flex-end")
    // Alignment properties that were not set inline stay unset.
    expect(el.style.getPropertyValue("align-content")).toBe("")
    expect(el.style.getPropertyValue("justify-items")).toBe("")
  })

  it("content that grows after settling is not clipped (base-ui#1458)", () => {
    const el = mount("", box(100))
    const cs = contentSize(el, "x")
    cs.opened({ instant: false })
    cs.settled()
    el.append(box(50))
    expect(el.getBoundingClientRect().height).toBe(150)
    expect(el.scrollHeight).toBe(el.clientHeight)
  })

  it("first open runs the 0px -> px step with a flush between (radix#1265)", () => {
    const el = mount("", box(100))
    const cs = contentSize(el, "x")
    const writes = recordHeight(el)
    cs.opened({ instant: false })
    // measure() borrows auto, then restores; the last two real values are 0px then 100px.
    expect(writes[0]).toBe("0px")
    expect(writes.at(-1)).toBe("100px")
    expect(v(el, H)).toBe("100px")
  })
})

describe("content-size switched()", () => {
  const rendered = (el: HTMLElement) => el.getBoundingClientRect().height

  // The incoming panel is committed out of flow beside the outgoing one: replacing the
  // settled content in place under `auto` would lose the size to start from.
  const incoming = (height: number) => {
    const b = box(height)
    b.style.cssText += ";position:absolute;top:0"
    return b
  }

  it("animates between panel sizes without passing through 0px (mui/base-ui#4619)", () => {
    const el = mount("position:relative;transition:height 1s linear", box(200))
    const cs = contentSize(el, "x")
    cs.opened({ instant: true })
    expect(rendered(el)).toBe(200)
    const writes = recordHeight(el)
    el.append(incoming(320))
    cs.switched()
    expect(writes).not.toContain("0px")
    // (measuring borrows `auto` and restores the previous value)
    expect([...new Set(writes.filter((w) => w !== "auto"))]).toEqual(["200px", "320px"])
    expect(v(el, H)).toBe("320px")
  })

  it("a second switch mid-animation starts from the rendered height and ends at 120px", async () => {
    const el = mount("position:relative;transition:height 1s linear", box(200))
    const cs = contentSize(el, "x")
    cs.opened({ instant: true })
    el.append(incoming(320))
    cs.switched()
    await wait(300)
    const mid = rendered(el)
    expect(mid).toBeGreaterThan(200)
    expect(mid).toBeLessThan(320)

    const writes = recordHeight(el)
    el.replaceChildren(incoming(120))
    cs.switched()
    const first = Number.parseFloat(writes.find((w) => w !== "auto") ?? "")
    expect(first).toBeGreaterThan(200)
    expect(first).toBeLessThan(320)
    expect(Math.abs(first - mid)).toBeLessThan(60)
    expect(writes).not.toContain("0px")
    expect(writes.at(-1)).toBe("120px")
    expect(v(el, H)).toBe("120px")

    cs.settled()
    expect(v(el, H)).toBe("auto")
    expect(v(el, W)).toBe("auto")
  })
})
