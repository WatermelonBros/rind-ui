// add-floating-positioning 7.2: one test per spec scenario observable in a browser, through the
// fixture's driver and the layout invariant. Environments (strategy, RTL, frames, shadow roots,
// manual mode) are in environments.browser.test.tsx; viewports and perf in their own files.

import type { Placement, Service } from "@rind-ui/core"
import { render, screen } from "@testing-library/react"
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
  positioner,
  px,
  q,
  rect,
  trapErrors,
  triggerOf,
} from "./anchored.harness"
import type { AnchoredMachine } from "./anchored.machine"

let trap: ReturnType<typeof trapErrors>
let style: HTMLStyleElement
beforeEach(async () => {
  style = document.createElement("style")
  style.textContent = "*{margin:0;box-sizing:border-box}body{margin:0}"
  document.head.append(style)
  await page.viewport(800, 600)
  trap = trapErrors()
})
afterEach(() => {
  trap.stop()
  style.remove()
  document.documentElement.style.cssText = ""
  document.documentElement.removeAttribute("dir")
  expect(trap.seen.filter((m) => m.includes("ResizeObserver loop"))).toEqual([])
})

const driver = (label = "Open") => createDriver(anchoredContract, screen, label).via("pointer")
const open = async (label = "Open") => {
  const d = driver(label)
  await d.open()
  return d
}
const near = (a: number, b: number, tol = 0.6) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol)
const poll = (fn: () => void) => vi.waitFor(fn, { timeout: 2000, interval: 30 })

describe("Placement Options", () => {
  it("Preferred placement fits", async () => {
    render(
      <At x={100} y={100}>
        <Pop id="a" positioning={{ side: "bottom", align: "start", sideOffset: 4 }} />
      </At>,
    )
    await open()
    near(rect(positioner()).top, rect(triggerOf()).bottom + 4)
    near(rect(positioner()).left, rect(triggerOf()).left)
    expect(layoutProblems("a")).toEqual([])
  })

  it("Boundary mounted after open", async () => {
    render(
      <At x={300} y={100}>
        <Pop
          id="a"
          width={200}
          positioning={{
            align: "start",
            collisionBoundary: () => document.getElementById("late"),
          }}
        />
      </At>,
    )
    await open()
    expect(rect(positioner()).right).toBeGreaterThan(400)
    const late = document.createElement("div")
    late.id = "late"
    Object.assign(late.style, {
      position: "absolute",
      left: "0",
      top: "0",
      width: "400px",
      height: "500px",
    })
    document.body.append(late)
    window.dispatchEvent(new Event("resize"))
    await poll(() => expect(rect(positioner()).right).toBeLessThanOrEqual(392.6))
    late.remove()
  })
})

describe("Collision Avoidance", () => {
  it("Flip at the bottom edge", async () => {
    render(
      <At x={300} y={540}>
        <Pop id="a" height={100} />
      </At>,
    )
    const d = await open()
    expect(await d.side()).toBe("top")
    expect(rect(positioner()).bottom).toBeLessThanOrEqual(rect(triggerOf()).top + 0.5)
    expect(layoutProblems("a")).toEqual([])
  })

  it("Vertical fallback for a horizontal side", async () => {
    await page.viewport(400, 600)
    render(
      <At x={60} y={100}>
        <Pop
          id="a"
          width={300}
          positioning={{
            side: "left",
            align: "start",
            collisionAvoidance: { side: "flip", align: "shift", fallbackAxis: "end" },
          }}
        />
      </At>,
    )
    const d = await open()
    expect(await d.side()).toBe("bottom")
    expect(rect(positioner()).left).toBeGreaterThanOrEqual(7.5)
    expect(rect(positioner()).right).toBeLessThanOrEqual(392.5)
  })

  it("Scrollable list caps instead of switching axis", async () => {
    render(
      <At x={300} y={300}>
        <Pop
          id="a"
          preset="dropdown"
          height={1200}
          contentStyle={{ maxHeight: "var(--rind-available-height)", overflow: "auto" }}
        />
      </At>,
    )
    const d = await open()
    expect(["top", "bottom"]).toContain(await d.side())
    const avail = px(positioner(), "--rind-available-height")
    expect(avail).toBeGreaterThan(0)
    expect(avail).toBeLessThan(600)
    // The cap lands after the first pass measured the uncapped popup; one more frame settles it.
    await frames(3)
    expect(rect(positioner()).height).toBeLessThanOrEqual(
      px(positioner(), "--rind-available-height") + 0.5,
    )
    expect(layoutProblems("a")).toEqual([])
  })

  it("Centred input with the on-screen keyboard", async () => {
    // Room above (280) equals room below (280): the preferred side wins, and the cap leaves
    // exactly collisionPadding to the viewport edge.
    render(
      <At x={300} y={280}>
        <Pop
          id="a"
          preset="dropdown"
          height={400}
          triggerStyle={{ height: 40 }}
          contentStyle={{ maxHeight: "var(--rind-available-height)", overflow: "auto" }}
        />
      </At>,
    )
    const d = await open()
    expect(await d.side()).toBe("bottom")
    near(window.innerHeight - rect(positioner()).bottom, 8)
  })
})

describe("Available Size And Anchor Size", () => {
  it("Capped popup measured on the first pass", async () => {
    render(
      <At x={300} y={350}>
        <Pop
          id="a"
          preset="dropdown"
          height={2000}
          contentStyle={{
            // Capped to 10rem (fits below, 221 px of room); uncapped it would flip above.
            maxHeight: "min(10rem, var(--rind-available-height))",
            overflow: "auto",
          }}
        />
      </At>,
    )
    const d = await open()
    expect(await d.side()).toBe("bottom")
  })

  it("Viewport grows back", async () => {
    render(
      <At x={20} y={100}>
        <Pop id="a" positioning={{ side: "right" }} />
      </At>,
    )
    await open()
    const wide = px(positioner(), "--rind-available-width")
    await page.viewport(500, 600)
    await poll(() => expect(px(positioner(), "--rind-available-width")).toBeLessThan(wide))
    const narrow = px(positioner(), "--rind-available-width")
    await page.viewport(800, 600)
    await poll(() => expect(px(positioner(), "--rind-available-width")).toBeGreaterThan(narrow))
  })

  it("seeds the available size with 100vw and 100vh before the first pass", async () => {
    render(
      <At x={20} y={100}>
        <Pop id="a" keepMounted />
      </At>,
    )
    // Kept mounted and closed: never placed, so only the seed is there.
    await poll(() => expect(positioner()).not.toBeNull())
    const s = positioner().getAttribute("style") ?? ""
    expect(s).toContain("--rind-available-width: 100vw")
    expect(s).toContain("--rind-available-height: 100vh")
  })
})

describe("Arrow", () => {
  it("Arrow follows a shifted popup", async () => {
    render(
      <At x={10} y={100}>
        <Pop
          id="a"
          arrow
          width={300}
          triggerStyle={{ width: 40 }}
          positioning={{
            collisionAvoidance: { side: "flip", align: "shift", fallbackAxis: "end" },
          }}
        />
      </At>,
    )
    await open()
    const t = rect(triggerOf())
    // Centred on the trigger the popup would hang 110 px off the left edge: it shifted.
    expect(rect(positioner()).left).toBeGreaterThanOrEqual(7.5)
    const arrow = q('[data-part="arrow"]')
    near(rect(arrow).left + rect(arrow).width / 2, t.left + t.width / 2, 1)
    expect(layoutProblems("a")).toEqual([])
  })

  it("Arrow during a scale animation", async () => {
    const sheet = document.createElement("style")
    sheet.textContent =
      "@keyframes grow{from{transform:scale(.2)}to{transform:scale(1)}}[data-part=content]{animation:grow 400ms}"
    document.head.append(sheet)
    render(
      <At x={300} y={100}>
        <Pop id="a" arrow />
      </At>,
    )
    await open()
    const arrow = q('[data-part="arrow"]')
    const written = () =>
      `${css(positioner(), "--rind-arrow-x")}|${css(positioner(), "--rind-arrow-y")}`
    const before = written()
    const content = q('[data-part="content"]')
    expect(content.getAnimations().length).toBeGreaterThan(0)
    const left = rect(positioner()).left
    for (let i = 0; i < 10; i++) {
      await frames(2)
      expect(written()).toBe(before)
      near(rect(positioner()).left, left)
    }
    expect(arrow.isConnected).toBe(true)
    sheet.remove()
  })
})

describe("Placement Attributes", () => {
  // Counts the placements that reach the machine (the capability's callback is the only way in).
  const counted = () => {
    const events: { placement: Placement; first: boolean }[] = []
    return {
      events,
      onPlacement: (placement: Placement, first: boolean) => events.push({ placement, first }),
    }
  }

  it("Scrolling does not notify the machine", async () => {
    await page.viewport(800, 1000)
    const c = counted()
    render(
      <div style={{ height: 3000 }}>
        <At x={300} y={700}>
          <Pop id="a" onPlacement={c.onPlacement} />
        </At>
      </div>,
    )
    const d = await open()
    const n = c.events.length
    const gap = rect(positioner()).top - rect(triggerOf()).bottom
    window.scrollTo(0, 500)
    await frames(5)
    expect(c.events.length).toBe(n)
    near(rect(positioner()).top - rect(triggerOf()).bottom, gap)
    expect(await d.side()).toBe("bottom")
  })

  it("Flip notifies once", async () => {
    const c = counted()
    render(
      <At x={300} y={400}>
        <Pop id="a" height={60} onPlacement={c.onPlacement} />
      </At>,
    )
    const d = await open()
    expect(await d.side()).toBe("bottom")
    const n = c.events.length
    await page.viewport(800, 520)
    await poll(async () => expect(await d.side()).toBe("top"))
    await frames(5)
    expect(c.events.length - n).toBe(1)
    expect(c.events.at(-1)?.placement.side).toBe("top")
  })
})

describe("First Frame", () => {
  it("is fixed at the origin, transparent and inert until placed, and focusable", async () => {
    render(
      <At x={300} y={100}>
        <Pop id="a" />
      </At>,
    )
    let sample: {
      placing: boolean
      opacity: string
      pe: string
      position: string
      focusable: boolean
    } | null = null
    const obs = new MutationObserver(() => {
      const p = document.querySelector<HTMLElement>('[data-part="positioner"]')
      if (!p || sample || p.getAttribute("data-placing") === null) return
      const s = getComputedStyle(p)
      const input = p.querySelector<HTMLElement>("input")
      input?.focus()
      sample = {
        placing: true,
        opacity: s.opacity,
        pe: s.pointerEvents,
        position: s.position,
        focusable: document.activeElement === input,
      }
    })
    obs.observe(document.body, { subtree: true, childList: true, attributes: true })
    await open()
    obs.disconnect()
    expect(sample).toEqual({
      placing: true,
      opacity: "0",
      pe: "none",
      position: "fixed",
      focusable: true,
    })
  })

  it("No flash at a stale position", async () => {
    render(
      <At x={0} y={0}>
        <Pop id="a" keepMounted triggerStyle={{ position: "absolute", left: 100, top: 100 }} />
      </At>,
    )
    const d = await open()
    const old = rect(positioner())
    await d.close()
    const trigger = triggerOf()
    Object.assign(trigger.style, { left: "500px", top: "300px" })
    const painted: { x: number; y: number }[] = []
    let live = true
    const watch = () => {
      const p = positioner()
      if (p && getComputedStyle(p).opacity !== "0") painted.push({ x: rect(p).x, y: rect(p).y })
      if (live) requestAnimationFrame(watch)
    }
    requestAnimationFrame(watch)
    await open()
    await frames(3)
    live = false
    expect(painted.length).toBeGreaterThan(0)
    for (const p of painted)
      expect(Math.abs(p.x - old.x) + Math.abs(p.y - old.y)).toBeGreaterThan(50)
  })

  it("Keyboard open does not scroll the page", async () => {
    render(
      <div style={{ height: 3000 }}>
        <div
          data-scroller
          style={{
            position: "absolute",
            top: 200,
            left: 50,
            width: 400,
            height: 200,
            overflow: "auto",
          }}
        >
          <div style={{ height: 1000, paddingTop: 300 }}>
            <Pop id="a" />
          </div>
        </div>
      </div>,
    )
    const scroller = q("[data-scroller]")
    scroller.scrollTop = 250
    window.scrollTo(0, 120)
    triggerOf().focus()
    const pageY = window.scrollY
    const top = scroller.scrollTop
    const d = createDriver(anchoredContract, screen, "Open").via("keyboard")
    await d.open()
    expect(await d.hasFocus()).toBe(true)
    expect(window.scrollY).toBe(pageY)
    expect(scroller.scrollTop).toBe(top)
  })

  it("Enter animation starts from the placed side", async () => {
    const sheet = document.createElement("style")
    sheet.textContent =
      "@keyframes from-top{from{opacity:.5}to{opacity:1}}@keyframes from-bottom{from{opacity:.4}to{opacity:1}}" +
      "[data-part=content][data-side=top]{animation:from-top 300ms}[data-part=content][data-side=bottom]{animation:from-bottom 300ms}"
    document.head.append(sheet)
    render(
      <At x={300} y={540}>
        <Pop id="a" height={100} />
      </At>,
    )
    const names = new Set<string>()
    let live = true
    const watch = () => {
      for (const a of document.getAnimations()) {
        if ("animationName" in a) names.add(String((a as CSSAnimation).animationName))
      }
      if (live) requestAnimationFrame(watch)
    }
    requestAnimationFrame(watch)
    const d = await open()
    await frames(4)
    live = false
    expect(await d.side()).toBe("top")
    expect([...names]).toEqual(["from-top"])
    sheet.remove()
  })
})

describe("Transform Origin", () => {
  it("Context menu opened near the bottom-right corner", async () => {
    render(
      <Pop
        id="a"
        preset="pointer"
        anchor={{ x: 780, y: 580 }}
        width={200}
        height={150}
        triggerStyle={{ position: "absolute" }}
      />,
    )
    await open()
    const r = rect(positioner())
    const [ox, oy] = css(positioner(), "--rind-transform-origin").split(" ").map(Number.parseFloat)
    near(ox ?? Number.NaN, r.width, 1)
    near(oy ?? Number.NaN, r.height, 1)
    near(r.right, 780, 1)
    near(r.bottom, 580, 1)
  })
})

describe("Hidden Anchor", () => {
  it("Submenu item scrolled out of a scrollable menu", async () => {
    render(
      <div
        data-scroller
        style={{
          position: "absolute",
          left: 100,
          top: 100,
          width: 200,
          height: 60,
          overflow: "auto",
        }}
      >
        <div style={{ height: 600 }}>
          <Pop id="a" />
        </div>
      </div>,
    )
    const d = await open()
    expect(await d.isAnchorHidden()).toBe(false)
    q("[data-scroller]").scrollTop = 300
    await poll(async () => expect(await d.isAnchorHidden()).toBe(true))
    expect(q('[data-part="content"]').hasAttribute("data-anchor-hidden")).toBe(true)
  })

  it("Anchor hidden by CSS", async () => {
    render(
      <At x={300} y={100}>
        <Pop id="a" />
      </At>,
    )
    await open()
    triggerOf().style.display = "none"
    // (the driver locates the trigger by role, and display: none removes it from the tree)
    await poll(() => expect(positioner().hasAttribute("data-anchor-hidden")).toBe(true))
    // Focus stays inside: the popup is neither hidden nor inert.
    expect(positioner().contains(document.activeElement)).toBe(true)
    expect(positioner().closest("[inert]")).toBeNull()
  })
})

describe("Tracking", () => {
  it("Anchor in a scroll container", async () => {
    render(
      <div
        data-scroller
        style={{
          position: "absolute",
          left: 100,
          top: 100,
          width: 300,
          height: 300,
          overflow: "auto",
        }}
      >
        <div style={{ height: 1200, paddingTop: 100 }}>
          <Pop id="a" />
        </div>
      </div>,
    )
    await open()
    const gap = rect(positioner()).top - rect(triggerOf()).bottom
    q("[data-scroller]").scrollTop = 40
    await poll(() => near(rect(positioner()).top - rect(triggerOf()).bottom, gap))
    expect(rect(triggerOf()).top).toBeLessThan(200)
  })

  it("Sticky anchor", async () => {
    render(
      <div
        data-scroller
        style={{
          position: "absolute",
          left: 100,
          top: 100,
          width: 300,
          height: 300,
          overflow: "auto",
        }}
      >
        <div style={{ height: 1500, paddingTop: 100 }}>
          <Pop id="a" triggerStyle={{ position: "sticky", top: 0 }} />
        </div>
      </div>,
    )
    await open()
    const attached = () => near(rect(positioner()).top - rect(triggerOf()).bottom, 0, 1)
    attached()
    const sc = q("[data-scroller]")
    // Before it sticks, while it sticks (the trigger stays at the container's top), and after.
    for (const top of [40, 160, 400]) {
      sc.scrollTop = top
      await poll(attached)
    }
    near(rect(triggerOf()).top, 100, 1)
    near(rect(positioner()).top, rect(triggerOf()).bottom, 1)
  })

  it("Popup grows while open", async () => {
    render(
      <At x={300} y={380}>
        <Pop id="a" height={50} />
      </At>,
    )
    const d = await open()
    expect(await d.side()).toBe("bottom")
    const before = px(positioner(), "--rind-available-height")
    // 50 -> 150 px: no longer fits below (191 px of room), fits above.
    q("[data-filler]").style.height = "150px"
    await poll(() => {
      const r = rect(positioner())
      expect(r.bottom).toBeLessThanOrEqual(window.innerHeight)
      expect(r.top).toBeGreaterThanOrEqual(0)
      expect(px(positioner(), "--rind-available-height")).not.toBe(before)
    })
  })

  it("Flip does not cause a ResizeObserver loop", async () => {
    render(
      <At x={300} y={300}>
        <Pop
          id="a"
          height={150}
          triggerStyle={{ height: 40 }}
          // Content capped by the available size: a flip changes the cap, which resizes the
          // popup, which is what can feed back into the observers (a loop needs this).
          contentStyle={{ maxHeight: "var(--rind-available-height)", overflow: "auto" }}
        />
      </At>,
    )
    const d = await open()
    expect(await d.side()).toBe("bottom")
    const capBefore = px(positioner(), "--rind-available-height")
    // The anchor grows: the list no longer fits below and flips above.
    triggerOf().style.height = "320px"
    await poll(async () => expect(await d.side()).toBe("top"))
    await frames(5)
    expect(px(positioner(), "--rind-available-height")).not.toBe(capBefore)
    // (the afterEach hook fails the test on any "ResizeObserver loop" error event)
    expect(trap.seen.filter((m) => m.includes("ResizeObserver loop"))).toEqual([])
  })

  it("Anchor inside an animating dialog", async () => {
    const sheet = document.createElement("style")
    sheet.textContent =
      "@keyframes scale-in{from{transform:scale(.5)}to{transform:scale(1)}}[data-dialog]{animation:scale-in 500ms}"
    document.head.append(sheet)
    render(
      <div
        data-dialog
        style={{ position: "absolute", left: 200, top: 100, width: 300, height: 200 }}
      >
        <Pop id="a" />
      </div>,
    )
    await open()
    await Promise.all(document.getAnimations().map((a) => a.finished))
    await poll(() => near(rect(positioner()).top, rect(triggerOf()).bottom))
    near(
      rect(positioner()).left + rect(positioner()).width / 2,
      rect(triggerOf()).left + rect(triggerOf()).width / 2,
      1,
    )
    sheet.remove()
  })

  it("Scroll lock reserves a gutter", async () => {
    // A moving virtual anchor, so that only the layer-stack change can explain a pass.
    const { getLayerStack, layerId, lockScrollForModals } = await import("@rind-ui/core")
    let box = { x: 400, y: 100 }
    const rectOf = () => ({
      x: box.x,
      y: box.y,
      width: 40,
      height: 20,
      top: box.y,
      left: box.x,
      right: box.x + 40,
      bottom: box.y + 20,
    })
    render(
      <Pop
        id="a"
        positioning={{ side: "left" }}
        anchor={{ get: () => ({ getBoundingClientRect: rectOf }) }}
      />,
    )
    await open("Open")
    near(rect(positioner()).right, 400, 1)
    lockScrollForModals(document)
    box = { x: 450, y: 100 }
    const host = document.body.appendChild(document.createElement("div"))
    const layer = getLayerStack(document).push({
      id: layerId("modal-x"),
      kind: "dialog",
      modal: true,
      elements: () => [host],
    })
    await poll(() => near(rect(positioner()).right, 450, 1))
    layer.release()
    layer.dispose()
    host.remove()
  })

  it("Stale pass after a fast sweep", async () => {
    let svc: Service<AnchoredMachine> | undefined
    // The first point flips (near the bottom edge): its pass does more async work than the
    // others, so it resolves after them and, unguarded, would be written last.
    const pts = [
      { x: 100, y: 570 },
      { x: 300, y: 200 },
      { x: 600, y: 100 },
    ]
    let at = pts[0] ?? { x: 0, y: 0 }
    // Each pass gets the point current when it started (a pass reads its anchor lazily).
    const vr = () => {
      const p = at
      return {
        getBoundingClientRect: () => ({
          x: p.x,
          y: p.y,
          width: 60,
          height: 20,
          top: p.y,
          left: p.x,
          right: p.x + 60,
          bottom: p.y + 20,
        }),
      }
    }
    render(<Pop id="a" anchor={{ get: vr }} onService={(s) => (svc = s)} />)
    await open()
    const writes: string[] = []
    const set = positioner().style.setProperty.bind(positioner().style)
    vi.spyOn(positioner().style, "setProperty").mockImplementation((n, v, pr) => {
      if (n === "--rind-y") writes.push(String(v))
      set(n, v, pr)
    })
    for (const p of pts) {
      at = p
      svc?.send({ type: "POSITION.REPOSITION" })
      // One microtask: the earlier pass is mid-flight when the next one starts.
      await Promise.resolve()
    }
    await frames(4)
    const r = rect(positioner())
    near(r.top, 100 + 20, 1)
    near(r.left + r.width / 2, 600 + 30, 1)
    expect(r.top).toBeGreaterThan(0)
    // Only the last pass wrote: the superseded ones were dropped, never applied then undone,
    // and none of them was the origin.
    expect(new Set(writes).size).toBe(1)
    expect(writes.at(-1)).toBe(css(positioner(), "--rind-y"))
    expect(Number.parseFloat(css(positioner(), "--rind-y"))).toBeGreaterThan(0)
  })
})

describe("Side Lock", () => {
  it("Filtering does not flip", async () => {
    render(
      <At x={300} y={360}>
        <Pop id="a" preset="dropdown" height={300} />
      </At>,
    )
    const d = await open()
    expect(await d.side()).toBe("top")
    q("[data-filler]").style.height = "20px"
    await frames(6)
    expect(await d.side()).toBe("top")
  })

  it("Arrowing through a menu partly off-screen", async () => {
    render(
      <At x={300} y={300}>
        <Pop
          id="a"
          preset="dropdown"
          contentStyle={{ height: 100, overflow: "auto" }}
          height={800}
        />
      </At>,
    )
    await open()
    const before = rect(positioner())
    const writes = vi.spyOn(CSSStyleDeclaration.prototype, "setProperty")
    q('[data-part="content"]').scrollTop = 400
    await frames(5)
    expect(writes.mock.calls.filter(([k]) => String(k).startsWith("--rind-"))).toEqual([])
    writes.mockRestore()
    expect(rect(positioner()).top).toBe(before.top)
  })
})

describe("Anchors", () => {
  it("Context menu at the pointer", async () => {
    render(
      <Pop
        id="a"
        preset="pointer"
        anchor={{ x: 600, y: 400 }}
        triggerStyle={{ position: "absolute" }}
      />,
    )
    await open()
    const r = rect(positioner())
    near(r.left, 600, 0.6)
    near(r.top, 400, 0.6)
  })

  it("Moving virtual anchor", async () => {
    let svc: Service<AnchoredMachine> | undefined
    let m = { x: 200, y: 200 }
    const get = () => ({
      getBoundingClientRect: () => ({
        x: m.x,
        y: m.y,
        width: 20,
        height: 20,
        top: m.y,
        left: m.x,
        right: m.x + 20,
        bottom: m.y + 20,
      }),
    })
    render(<Pop id="a" anchor={{ get }} onService={(s) => (svc = s)} />)
    await open()
    near(rect(positioner()).top, 220, 1)
    m = { x: 420, y: 120 }
    svc?.send({ type: "POSITION.REPOSITION" })
    await poll(() => {
      near(rect(positioner()).top, 140, 1)
      near(rect(positioner()).left + rect(positioner()).width / 2, 430, 1)
    })
  })

  const wrapped = (positioning: { inline: true | { x: number; y: number } }) => (
    <>
      <p
        data-link-box
        style={{
          position: "absolute",
          left: 100,
          top: 100,
          width: 190,
          font: "16px/24px sans-serif",
        }}
      >
        see <span data-link>a rather long link text here</span>
      </p>
      <Pop
        id="a"
        positioning={positioning}
        triggerStyle={{ position: "absolute", left: 600, top: 10 }}
        anchor={{
          get: () => {
            const link = q("[data-link]")
            return {
              getBoundingClientRect: () => link.getBoundingClientRect(),
              getClientRects: () => [...link.getClientRects()],
              contextElement: link,
            }
          },
        }}
      />
    </>
  )

  it("Wrapped link", async () => {
    // Hovered on the second line: the pointer picks the line box.
    const view = render(wrapped({ inline: true }))
    const lines = [...q("[data-link]").getClientRects()]
    expect(lines.length).toBe(2)
    const second = lines[1] as DOMRect
    view.rerender(wrapped({ inline: { x: second.left + 5, y: second.top + 5 } }))
    await open()
    near(rect(positioner()).top, second.bottom, 1.5)
  })

  it("Wrapped link hovered on its first line", async () => {
    const view = render(wrapped({ inline: true }))
    const first = [...q("[data-link]").getClientRects()][0] as DOMRect
    view.rerender(wrapped({ inline: { x: first.right - 5, y: first.top + 5 } }))
    await open()
    near(rect(positioner()).top, first.bottom, 1.5)
  })

  it("Wrapped link without a pointer uses the first line", async () => {
    render(wrapped({ inline: true }))
    const first = [...q("[data-link]").getClientRects()][0] as DOMRect
    await open()
    near(rect(positioner()).top, first.bottom, 1.5)
  })
})

describe("Wrapped link (element anchor)", () => {
  // The trigger itself is the anchor (kind "element"), not a virtual one. A button cannot wrap,
  // so its line boxes are stubbed: line 1 spans the full width, line 2 is shorter.
  const mountWrapped = (positioning: { inline: true | { x: number; y: number } }) => {
    render(
      <Pop
        id="a"
        positioning={positioning}
        triggerStyle={{ position: "absolute", left: 100, top: 100, width: 80, height: 40 }}
      />,
    )
    const b = triggerOf().getBoundingClientRect()
    const lines = [
      new DOMRect(b.left, b.top, 80, 20),
      new DOMRect(b.left, b.top + 20, 40, 20),
    ] as DOMRect[]
    triggerOf().getClientRects = () => lines as unknown as DOMRectList
    return lines as [DOMRect, DOMRect]
  }
  const placedAt = async () => {
    await open()
    await poll(() => expect(positioner().hasAttribute("data-placing")).toBe(false))
    const r = rect(positioner())
    return { top: r.top, centre: r.left + r.width / 2 }
  }

  it("is placed against the line under the pointer", async () => {
    const [, second] = mountWrapped({ inline: { x: 110, y: 130 } })
    const at = await placedAt()
    near(at.top, second.bottom, 1.5)
    near(at.centre, second.left + second.width / 2, 1.5)
  })

  it("without a pointer uses the first line", async () => {
    const [first] = mountWrapped({ inline: true })
    const at = await placedAt()
    near(at.top, first.bottom, 1.5)
    near(at.centre, first.left + first.width / 2, 1.5)
  })
})

describe("Accessibility Of Positioning", () => {
  it("Positioning leaves the tree untouched", async () => {
    const snap = async (positioning?: { mode: "manual" }) => {
      const view = render(
        <At x={300} y={540}>
          <Pop id="a" height={100} {...(positioning ? { positioning } : {})} />
        </At>,
      )
      await open()
      const content = q('[data-part="content"]')
      const out = {
        role: content.getAttribute("role"),
        name: screen.getByRole("dialog").getAttribute("aria-labelledby") && q("h2").textContent,
        parent: content.parentElement?.parentElement?.tagName,
        tabs: [...content.querySelectorAll("input,button")].map(
          (e) => e.getAttribute("aria-label") ?? e.textContent,
        ),
      }
      view.unmount()
      return out
    }
    const placed = await snap()
    const manual = await snap({ mode: "manual" })
    expect(placed).toEqual(manual)
  })

  it("Invariant catches an overflowing popup", async () => {
    render(
      <Pop
        id="a"
        width={200}
        positioning={{ mode: "manual" }}
        positionerStyle={{ position: "fixed", top: 100, left: window.innerWidth - 200 + 20 }}
        triggerStyle={{ position: "absolute", left: 10, top: 10 }}
      />,
    )
    await open()
    const problems = layoutProblems("a")
    expect(problems.join("\n")).toMatch(
      /positioner.*side.*overflows the viewport's right edge by 20 px/s,
    )
  })
})
