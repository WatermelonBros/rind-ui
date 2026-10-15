// add-floating-positioning 7.1/7.2: strategy, direction, documents, frames, shadow roots and
// manual mode, against real layout. Placement scenarios are in positioning.browser.test.tsx.
import { render, screen } from "@testing-library/react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { page } from "vitest/browser"
import { createDriver } from "../../src/index"
import { anchoredContract } from "./anchored.contract"
import {
  At,
  css,
  frames,
  layoutProblems,
  Pop,
  type PopProps,
  positioner,
  px,
  q,
  rect,
  trapErrors,
  triggerOf,
} from "./anchored.harness"

let trap: ReturnType<typeof trapErrors>
let style: HTMLStyleElement
const cleanups: (() => void)[] = []
beforeEach(async () => {
  style = document.createElement("style")
  style.textContent = "*{margin:0;box-sizing:border-box}body{margin:0}"
  document.head.append(style)
  await page.viewport(800, 600)
  trap = trapErrors()
})
afterEach(() => {
  for (const c of cleanups.splice(0).reverse()) c()
  trap.stop()
  style.remove()
  window.scrollTo(0, 0)
  document.documentElement.removeAttribute("dir")
  expect(trap.seen.filter((m) => m.includes("ResizeObserver loop"))).toEqual([])
})

const near = (a: number, b: number, tol = 0.6) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol)
const poll = (fn: () => void) => vi.waitFor(fn, { timeout: 2000, interval: 30 })
const open = async (label = "Open") => {
  const d = createDriver(anchoredContract, screen, label).via("pointer")
  await d.open()
  return d
}
const placed = (root: ParentNode) =>
  poll(() => {
    const p = root.querySelector('[data-part="positioner"]')
    expect(p).not.toBeNull()
    expect(p?.hasAttribute("data-placing")).toBe(false)
  })
const gap = (root: ParentNode) =>
  rect(q('[data-part="positioner"]', root)).top - rect(q('[data-part="trigger"]', root)).bottom

describe("Positioning Strategy", () => {
  it("Trigger in a fixed header", async () => {
    render(
      <div style={{ height: 3000 }}>
        <header style={{ position: "fixed", top: 0, left: 0, right: 0, height: 50 }}>
          <Pop id="a" triggerStyle={{ position: "absolute", left: 300, top: 10 }} />
        </header>
      </div>,
    )
    await open()
    expect(css(positioner(), "--rind-position")).toBe("fixed")
    const before = gap(document)
    window.scrollTo(0, 300)
    await frames(4)
    near(gap(document), before)
    near(rect(triggerOf()).top, 10)
  })

  it("Portalled into a native modal dialog", async () => {
    render(
      <div style={{ height: 3000 }}>
        <dialog
          data-dlg
          style={{
            position: "fixed",
            inset: 0,
            margin: "auto",
            width: 500,
            height: 300,
            padding: 0,
          }}
        >
          <Pop id="a" triggerStyle={{ position: "absolute", left: 100, top: 100 }} />
        </dialog>
      </div>,
    )
    window.scrollTo(0, 400)
    q<HTMLDialogElement>("[data-dlg]").showModal()
    await open()
    expect(positioner().closest("dialog")).toBe(q("[data-dlg]"))
    expect(css(positioner(), "--rind-position")).toBe("fixed")
    near(gap(document), 0)
    // Collisions against the viewport, not the dialog box: the 8 px padding is to the window.
    expect(rect(positioner()).bottom).toBeLessThanOrEqual(window.innerHeight)
    expect(layoutProblems("a")).toEqual([])
  })

  it("Fractional device pixel ratio", async () => {
    // Emulated: vitest browser mode cannot launch with deviceScaleFactor 1.25 per file, so the
    // property the engine reads is overridden. This proves the snapping, not the rasteriser.
    const desc = Object.getOwnPropertyDescriptor(window, "devicePixelRatio")
    if (desc && !desc.configurable) return
    Object.defineProperty(window, "devicePixelRatio", { get: () => 1.25, configurable: true })
    cleanups.push(() => {
      if (desc) Object.defineProperty(window, "devicePixelRatio", desc)
      else Reflect.deleteProperty(window, "devicePixelRatio")
    })
    render(
      <At x={310.3} y={210.3}>
        <Pop id="a" triggerStyle={{ width: 33.3 }} />
      </At>,
    )
    await open()
    const multiple = (v: number) =>
      expect(Math.abs(v / 0.8 - Math.round(v / 0.8))).toBeLessThan(1e-6)
    // The unsnapped values, from the layout: the popup is centred under the trigger.
    const t = rect(triggerOf())
    const raw = {
      "--rind-x": t.left + t.width / 2 - rect(positioner()).width / 2,
      "--rind-y": t.bottom,
      "--rind-anchor-width": t.width,
    }
    for (const [name, unsnapped] of Object.entries(raw)) {
      const snapped = px(positioner(), name)
      multiple(snapped)
      // Not vacuous: the raw value is not already on the 0.8 px grid.
      expect(Math.abs(unsnapped / 0.8 - Math.round(unsnapped / 0.8))).toBeGreaterThan(0.01)
      expect(snapped).not.toBeCloseTo(unsnapped, 3)
      expect(Math.abs(snapped - unsnapped)).toBeLessThanOrEqual(0.4 + 1e-6)
    }
  })
})

describe("Right-To-Left", () => {
  it("Submenu in RTL", async () => {
    document.documentElement.dir = "rtl"
    render(
      <At x={400} y={200}>
        <Pop id="a" preset="submenu" />
      </At>,
    )
    const d = await open()
    expect(await d.side()).toBe("left")
    expect(rect(positioner()).right).toBeLessThanOrEqual(rect(triggerOf()).left + 0.5)
    expect(positioner().getAttribute("dir")).toBe("rtl")
  })

  it("Portalled content keeps direction", async () => {
    render(
      <div dir="rtl">
        <At x={400} y={200}>
          <Pop id="a" preset="dropdown" width={240} triggerStyle={{ width: 60 }} />
        </At>
      </div>,
    )
    await open()
    expect(positioner().getAttribute("dir")).toBe("rtl")
    near(rect(positioner()).right, rect(triggerOf()).right)
  })

  // radix-ui/primitives#2172: with the scrollbar on the left (an RTL scroller on Chromium and
  // WebKit) the popup must sit exactly as it does with the scrollbar on the right.
  describe("RTL + left scrollbar", () => {
    // Force classic (space-taking) scrollbars where the platform defaults to overlay ones.
    beforeEach(() => {
      const bar = document.createElement("style")
      bar.textContent = "*::-webkit-scrollbar{width:15px;height:15px}"
      document.head.append(bar)
      cleanups.push(() => bar.remove())
    })
    const offset = () => {
      const p = rect(positioner())
      const t = rect(triggerOf())
      return { dx: p.left + p.width / 2 - (t.left + t.width / 2), dy: p.top - t.bottom }
    }

    // Firefox on macOS keeps overlay scrollbars whatever the page asks: nothing to compare.
    const overlay = navigator.userAgent.includes("Firefox")

    it.skipIf(overlay)("in a scroll container", async () => {
      const measure = async (dir: "ltr" | "rtl") => {
        const view = render(
          <div
            data-scroller
            dir={dir}
            style={{
              position: "absolute",
              left: 200,
              top: 100,
              width: 300,
              height: 250,
              overflow: "scroll",
            }}
          >
            <div style={{ height: 1000, paddingTop: 60 }}>
              <Pop id="a" preset="dropdown" width={240} triggerStyle={{ width: 60 }} />
            </div>
          </div>,
        )
        const sc = q("[data-scroller]")
        // Classic scrollbars take space (the browser project launches with them).
        expect(sc.offsetWidth - sc.clientWidth).toBeGreaterThan(0)
        // In RTL the bar is on the left (Chromium; WebKit's build here keeps it on the right,
        // which the same comparison covers): it shows up as the left border offset.
        if (navigator.userAgent.includes("Chrome")) expect(sc.clientLeft > 0).toBe(dir === "rtl")
        await open()
        await placed(document)
        const out = offset()
        view.unmount()
        return out
      }
      const ltr = await measure("ltr")
      const rtl = await measure("rtl")
      // Mirrored: the dropdown aligns to the trigger's inline start.
      near(rtl.dx, -ltr.dx, 1)
      near(rtl.dy, ltr.dy, 1)
    })

    it.skipIf(overlay)("on the document", async () => {
      const measure = async (dir: "ltr" | "rtl") => {
        document.documentElement.dir = dir
        document.body.style.height = "3000px"
        const view = render(
          <At x={400} y={200}>
            <Pop id="a" preset="dropdown" width={240} triggerStyle={{ width: 60 }} />
          </At>,
        )
        expect(window.innerWidth - document.documentElement.clientWidth).toBeGreaterThan(0)
        await open()
        await placed(document)
        const out = offset()
        view.unmount()
        document.body.style.height = ""
        return out
      }
      const ltr = await measure("ltr")
      const rtl = await measure("rtl")
      // Mirrored: the dropdown aligns to the trigger's inline start.
      near(rtl.dx, -ltr.dx, 1)
      near(rtl.dy, ltr.dy, 1)
    })
  })
})

/** Mounts a Pop in an iframe's document; every cleanup is registered. */
async function mountInFrame(props: Partial<PopProps> = {}) {
  const iframe = document.createElement("iframe")
  Object.assign(iframe.style, {
    position: "absolute",
    left: "0",
    top: "0",
    width: "500px",
    height: "500px",
    border: "0",
  })
  document.body.append(iframe)
  const doc = iframe.contentDocument as Document
  doc.body.style.margin = "0"
  const tall = doc.createElement("div")
  tall.style.height = "2000px"
  const mount = doc.createElement("div")
  Object.assign(mount.style, { position: "absolute", left: "100px", top: "100px" })
  doc.body.append(tall, mount)
  const root: Root = createRoot(mount)
  root.render(<Pop id="a" rootNode={() => doc} {...props} />)
  cleanups.push(() => {
    root.unmount()
    iframe.remove()
  })
  return { iframe, doc, win: iframe.contentWindow as Window }
}

describe("Documents, Frames And Shadow Roots", () => {
  it("Popup inside an iframe", async () => {
    const { doc, win } = await mountInFrame()
    await poll(() => expect(doc.querySelector('[data-part="trigger"]')).not.toBeNull())
    ;(doc.querySelector('[data-part="trigger"]') as HTMLElement).click()
    await placed(doc)
    const before = gap(doc)
    expect(q('[data-part="positioner"]', doc).ownerDocument).toBe(doc)
    win.scrollTo(0, 60)
    await frames(4)
    near(gap(doc), before)
    expect(win.scrollY).toBe(60)
  })

  it("Iframe removed while open", async () => {
    const { iframe, doc, win } = await mountInFrame()
    // What positioning registers: its listener types, and any observer, on that window.
    const types = new Set(["scroll", "resize", "animationend", "transitionend", "pagehide"])
    const live = new Map<string, number>()
    const track = (target: EventTarget, name: string) => {
      const add = target.addEventListener.bind(target)
      const remove = target.removeEventListener.bind(target)
      target.addEventListener = (t: string, l: never, o?: never) => {
        if (types.has(t)) live.set(`${name}:${t}`, (live.get(`${name}:${t}`) ?? 0) + 1)
        return add(t, l, o)
      }
      target.removeEventListener = (t: string, l: never, o?: never) => {
        if (types.has(t)) live.set(`${name}:${t}`, (live.get(`${name}:${t}`) ?? 0) - 1)
        return remove(t, l, o)
      }
    }
    track(win, "window")
    track(doc, "document")
    if (win.visualViewport) track(win.visualViewport, "visualViewport")
    await poll(() => expect(doc.querySelector('[data-part="trigger"]')).not.toBeNull())
    ;(doc.querySelector('[data-part="trigger"]') as HTMLElement).click()
    await placed(doc)
    expect([...live].some(([, n]) => n > 0)).toBe(true)
    iframe.remove()
    await frames(3)
    // pagehide itself is removed with the rest; only positioning's listeners count here.
    const left = [...live].filter(([, n]) => n > 0)
    expect(left).toEqual([])
  })

  it("Popup inside a shadow root", async () => {
    document.body.style.height = "3000px"
    const host = document.createElement("div")
    Object.assign(host.style, { position: "absolute", left: "200px", top: "200px" })
    document.body.append(host)
    const shadow = host.attachShadow({ mode: "open" })
    const mount = document.createElement("div")
    shadow.append(mount)
    const root = createRoot(mount)
    root.render(<Pop id="a" rootNode={() => shadow} />)
    cleanups.push(() => {
      root.unmount()
      host.remove()
      document.body.style.height = ""
    })
    await poll(() => expect(shadow.querySelector('[data-part="trigger"]')).not.toBeNull())
    ;(shadow.querySelector('[data-part="trigger"]') as HTMLElement).click()
    await placed(shadow)
    const before = gap(shadow)
    expect(q('[data-part="positioner"]', shadow).getRootNode()).toBe(shadow)
    window.scrollTo(0, 150)
    await frames(4)
    near(gap(shadow), before)
  })
})

describe("Manual Mode", () => {
  it("CSS-positioned popover", async () => {
    const sheet = document.createElement("style")
    sheet.textContent = "[data-part=positioner]{position:fixed;position-area:bottom}"
    document.head.append(sheet)
    cleanups.push(() => sheet.remove())
    render(
      <At x={300} y={200}>
        <Pop id="a" positioning={{ mode: "manual" }} />
      </At>,
    )
    const d = await open()
    expect(await d.isPlaced()).toBe(true)
    expect(await d.side()).toBe("bottom")
    const p = positioner()
    for (const prop of ["top", "left", "transform"]) expect(p.style.getPropertyValue(prop)).toBe("")
    const written = [...p.style].filter(
      (n) => n.startsWith("--rind-") && !n.startsWith("--rind-available"),
    )
    expect(written).toEqual([])
    expect(p.style.getPropertyValue("position-anchor")).toMatch(/^--rind-anchor-/)
    expect(triggerOf().style.getPropertyValue("anchor-name")).toBe(
      p.style.getPropertyValue("position-anchor"),
    )
    if (CSS.supports("position-area", "bottom")) {
      near(rect(p).top, rect(triggerOf()).bottom, 1)
    }
  })
})
