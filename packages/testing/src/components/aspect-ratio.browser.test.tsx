// add-aspect-ratio 2.2: the recipe's layout checks. Aspect Ratio is the native CSS property,
// not a component; these check that the recipe on docs/components/aspect-ratio.md holds in
// every engine (the markup mirrors apps/site/examples/aspect-ratio.tsx).
import { afterEach, describe, expect, it } from "vitest"

const hosts: HTMLElement[] = []
afterEach(() => {
  for (const h of hosts.splice(0)) h.remove()
  document.documentElement.style.fontSize = ""
})

function mount(html: string): HTMLElement {
  const host = document.createElement("div")
  host.innerHTML = html
  document.body.append(host)
  hosts.push(host)
  return host
}

const size = (el: Element) => {
  const r = el.getBoundingClientRect()
  return { width: r.width, height: r.height }
}

describe("Aspect Ratio recipe", () => {
  for (const width of [640, 320]) {
    it(`block flow: height = width / ratio at ${width}px`, () => {
      const host = mount(
        `<div style="inline-size:${width}px"><div id="box" style="aspect-ratio:16 / 9;inline-size:100%"></div></div>`,
      )
      const box = size(host.querySelector("#box") as Element)
      expect(box.width).toBe(width)
      expect(box.height).toBeCloseTo((width * 9) / 16, 1)
    })

    it(`flex row: height = width / ratio at ${width}px (chakra-ui#2582)`, () => {
      const host = mount(
        `<div style="display:flex;inline-size:${width}px"><div id="box" style="aspect-ratio:16 / 9;inline-size:50%"></div><p style="margin:0">Text</p></div>`,
      )
      const box = size(host.querySelector("#box") as Element)
      expect(box.width).toBe(width / 2)
      expect(box.height).toBeCloseTo((width / 2) * (9 / 16), 1)
    })
  }

  it("a 16:9 box at 50% of a 640px flex row is 320 × 180", () => {
    const host = mount(
      `<div style="display:flex;inline-size:640px"><div id="box" style="aspect-ratio:16 / 9;inline-size:50%"></div></div>`,
    )
    expect(size(host.querySelector("#box") as Element)).toEqual({ width: 320, height: 180 })
  })

  it("zoomed text grows a square card instead of clipping it", () => {
    document.documentElement.style.fontSize = "200%"
    const host = mount(
      `<article id="card" style="aspect-ratio:1;inline-size:12rem;padding:1rem;box-sizing:border-box;font-size:1rem"><h3>Square card</h3><p>When the text needs more room, at 200 % zoom or in a longer language, the card grows taller instead of clipping it.</p></article>`,
    )
    const card = host.querySelector("#card") as HTMLElement
    const box = size(card)
    expect(box.height).toBeGreaterThan(box.width)
    // Nothing overflows: the box holds all its text.
    expect(card.scrollHeight).toBeLessThanOrEqual(card.clientHeight)
  })
})
