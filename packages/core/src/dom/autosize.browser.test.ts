// autosize-textarea in real layout, both branches: the native `field-sizing` branch and the
// measured fallback (forced by stubbing `CSS.supports`). jsdom has no layout, so browser only.
import { afterEach, describe, expect, it, vi } from "vitest"
import { domEnvironment } from "../env/dom-environment"
import { autosize } from "./autosize"

const env = domEnvironment()
const frame = () =>
  new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
const lines = (n: number) => Array.from({ length: n }, (_, i) => `line ${i + 1}`).join("\n")
const nativeSupported = CSS.supports("field-sizing", "content")

function mount(style = "", rows = 2) {
  const el = document.createElement("textarea")
  el.rows = rows
  el.style.cssText = `width:300px;font:16px/20px monospace;padding:4px;border:1px solid #000;box-sizing:border-box;${style}`
  document.body.append(el)
  return el
}
const set = (el: HTMLTextAreaElement, v: string) => {
  el.value = v
  el.dispatchEvent(new Event("input", { bubbles: true }))
}

afterEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ""
  document.body.style.zoom = ""
})

const branches = [
  { name: "native", force: false },
  { name: "fallback", force: true },
] as const

for (const { name, force } of branches) {
  describe(`autosize (${name} branch)`, () => {
    const attach = (el: HTMLTextAreaElement) => {
      if (force) vi.spyOn(CSS, "supports").mockReturnValue(false)
      return autosize(el, env)
    }
    const run = force || nativeSupported ? it : it.skip

    run("grows to five lines and returns to two after deletion", async () => {
      const el = mount()
      const a = attach(el)
      await frame()
      const two = el.getBoundingClientRect().height
      set(el, lines(5))
      await frame()
      const five = el.getBoundingClientRect().height
      expect(five).toBeGreaterThan(two + 50)
      expect(el.scrollHeight).toBeLessThanOrEqual(el.clientHeight + 1)
      set(el, "")
      await frame()
      expect(Math.abs(el.getBoundingClientRect().height - two)).toBeLessThanOrEqual(1)
      a.dispose()
    })

    run("stops at the maximum height and scrolls", async () => {
      const el = mount("max-height:100px")
      const a = attach(el)
      set(el, lines(30))
      await frame()
      expect(el.getBoundingClientRect().height).toBeLessThanOrEqual(101)
      expect(el.scrollHeight).toBeGreaterThan(el.clientHeight + 20)
      a.dispose()
    })

    run("a programmatic value followed by measure() fits (kobalte#484)", async () => {
      const el = mount()
      const a = attach(el)
      await frame()
      const before = el.getBoundingClientRect().height
      el.value = lines(10) // no input event: a controlled or programmatic change
      a.measure()
      await frame()
      expect(el.getBoundingClientRect().height).toBeGreaterThan(before + 100)
      expect(el.scrollHeight).toBeLessThanOrEqual(el.clientHeight + 1)
      a.dispose()
    })

    run(
      "fits three lines at 110% zoom with fractional chrome, no scrollbar (zag#2312)",
      async () => {
        const el = mount("border-width:1.5px;padding:3.3px")
        document.body.style.zoom = "1.1"
        const a = attach(el)
        set(el, lines(3))
        await frame()
        expect(el.scrollHeight).toBeLessThanOrEqual(el.clientHeight + 1)
        a.dispose()
      },
    )

    run("dispose, then a window resize: no error (base-ui#164)", async () => {
      const el = mount()
      const a = attach(el)
      const errors: unknown[] = []
      const onError = (e: ErrorEvent) => errors.push(e.message)
      window.addEventListener("error", onError)
      set(el, lines(3)) // a frame is pending
      a.dispose()
      el.remove()
      window.dispatchEvent(new Event("resize"))
      await frame()
      window.removeEventListener("error", onError)
      expect(errors).toEqual([])
    })

    run("never redefines the value property (zag#3204)", async () => {
      const el = mount()
      const a = attach(el)
      expect(Object.getOwnPropertyDescriptor(el, "value")).toBeUndefined()
      set(el, "x")
      await frame()
      expect(Object.getOwnPropertyDescriptor(el, "value")).toBeUndefined()
      a.dispose()
    })

    run("dispatches no event of its own", async () => {
      const el = mount()
      const a = attach(el)
      const seen: string[] = []
      for (const t of ["input", "change"]) el.addEventListener(t, () => seen.push(t))
      a.measure()
      await frame()
      expect(seen).toEqual([])
      a.dispose()
    })
  })
}

describe("autosize native branch", () => {
  it.skipIf(!nativeSupported)(
    "applies field-sizing: content and writes no inline height",
    async () => {
      const el = mount()
      const heights: string[] = []
      new MutationObserver(() => heights.push(el.style.height)).observe(el, {
        attributes: true,
        attributeFilter: ["style"],
      })
      const a = autosize(el, env)
      expect(getComputedStyle(el).fieldSizing).toBe("content")
      set(el, lines(5))
      a.measure()
      await frame()
      expect(el.style.height).toBe("")
      expect(heights.every((h) => h === "")).toBe(true)
      a.dispose()
    },
  )
})

describe("autosize fallback branch", () => {
  it("writes an inline height", async () => {
    vi.spyOn(CSS, "supports").mockReturnValue(false)
    const el = mount()
    const a = autosize(el, env)
    set(el, lines(5))
    await frame()
    expect(el.style.height).toMatch(/px$/)
    a.dispose()
  })

  it("reports no ResizeObserver loop error while a parent animates (zag#2281)", async () => {
    vi.spyOn(CSS, "supports").mockReturnValue(false)
    const parent = document.createElement("div")
    parent.style.cssText = "width:100px"
    document.body.append(parent)
    const el = mount()
    parent.append(el)
    el.style.width = "100%"
    const errors: string[] = []
    const onError = (e: ErrorEvent) => errors.push(e.message)
    window.addEventListener("error", onError)
    const a = autosize(el, env)
    set(el, lines(6))
    for (let w = 100; w <= 300; w += 25) {
      parent.style.width = `${w}px`
      await frame()
    }
    window.removeEventListener("error", onError)
    expect(errors.filter((m) => /ResizeObserver/.test(m))).toEqual([])
    a.dispose()
  })
})

// Review fix: the empty textarea's minimum is `rows` lines plus padding and border (a
// border-box textarea), in both branches: rows 2 × 20px + 2 × 4px + 2 × 1px = 50px.
for (const { name, force } of branches) {
  it.skipIf(!force && !nativeSupported)(`empty rows=2 keeps rows + chrome (${name})`, async () => {
    if (force) vi.spyOn(CSS, "supports").mockReturnValue(false)
    const el = mount()
    autosize(el, env)
    await frame()
    expect(Math.abs(el.getBoundingClientRect().height - 50)).toBeLessThanOrEqual(1)
  })
}
