// add-floating-positioning 7.4: a closed popup costs nothing, and an open one does bounded work.

import type { Service } from "@rind-ui/core"
import { render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { page } from "vitest/browser"
import { At, frames, Pop, positioner, triggerOf } from "./anchored.harness"
import type { AnchoredMachine } from "./anchored.machine"
import { AnchoredExample } from "./anchored.react"

const restore: (() => void)[] = []
beforeEach(async () => {
  await page.viewport(800, 600)
})
afterEach(() => {
  for (const r of restore.splice(0).reverse()) r()
  window.scrollTo(0, 0)
})

describe("Tracking", () => {
  it("Many closed popups", async () => {
    let observers = 0
    for (const name of ["ResizeObserver", "IntersectionObserver"] as const) {
      const Original = window[name] as typeof ResizeObserver
      window[name] = class extends Original {
        constructor(cb: never) {
          super(cb)
          observers++
        }
      } as never
      restore.push(() => {
        window[name] = Original as never
      })
    }
    const listeners: string[] = []
    const add = EventTarget.prototype.addEventListener
    EventTarget.prototype.addEventListener = function (
      this: EventTarget,
      type: string,
      ...rest: never[]
    ) {
      // React delegates every native event once per root (not per popup): not ours.
      const delegated = new Error().stack?.includes("listenToNativeEvent")
      if ((type === "scroll" || type === "resize") && !delegated) listeners.push(type)
      return (add as (...a: unknown[]) => void).call(this, type, ...rest)
    } as typeof add
    restore.push(() => {
      EventTarget.prototype.addEventListener = add
    })
    render(
      <div>
        {Array.from({ length: 200 }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: a static list
          <AnchoredExample key={i} id={`t${i}`} label={`Tip ${i}`} />
        ))}
      </div>,
    )
    await frames(4)
    expect(document.querySelectorAll('[data-part="trigger"]').length).toBe(200)
    expect(observers).toBe(0)
    expect(listeners).toEqual([])
    // No positioner mounted, so no positioning event can have been sent.
    expect(document.querySelector('[data-part="positioner"]')).toBeNull()
    expect(document.querySelector("[data-placing]")).toBeNull()
  })
})

describe("Scroll work is bounded", () => {
  it("at most one pass per frame, and unchanged variables are never rewritten", async () => {
    let svc: Service<AnchoredMachine> | undefined
    render(
      <div style={{ height: 4000 }}>
        <At x={300} y={1300}>
          <Pop id="a" onService={(s) => (svc = s)} />
        </At>
      </div>,
    )
    window.scrollTo(0, 1000)
    await frames(2)
    triggerOf().click()
    await vi.waitFor(() => expect(positioner()?.hasAttribute("data-placing")).toBe(false))
    await frames(3)
    // A pass reads the positioner's box once or more; calibrate with a direct reposition.
    let boxReads = 0
    const read = Element.prototype.getBoundingClientRect
    Element.prototype.getBoundingClientRect = function (this: Element) {
      if (this.getAttribute("data-part") === "positioner") boxReads++
      return read.call(this)
    }
    restore.push(() => {
      Element.prototype.getBoundingClientRect = read
    })
    svc?.send({ type: "POSITION.REPOSITION" })
    await frames(3)
    const perPass = boxReads
    expect(perPass).toBeGreaterThan(0)
    boxReads = 0

    const last = new Map<string, string>()
    let rewrites = 0
    const set = CSSStyleDeclaration.prototype.setProperty
    CSSStyleDeclaration.prototype.setProperty = function (
      this: CSSStyleDeclaration,
      name: string,
      value: string | null,
      priority?: string,
    ) {
      if (name.startsWith("--rind-")) {
        const key = `p:${name}`
        if (last.get(key) === String(value)) rewrites++
        last.set(key, String(value))
      }
      return set.call(this, name, value, priority)
    }
    restore.push(() => {
      CSSStyleDeclaration.prototype.setProperty = set
    })
    for (const name of ["--rind-x", "--rind-y"])
      last.set(`p:${name}`, positioner().style.getPropertyValue(name))

    let elapsed = 0
    await new Promise<void>((resolve) => {
      const step = () => {
        window.scrollTo(0, 1000 - elapsed * 50)
        if (++elapsed > 20) return resolve()
        requestAnimationFrame(step)
      }
      step()
    })
    await frames(3)
    expect(window.scrollY).toBe(0)
    expect(boxReads / perPass).toBeLessThanOrEqual(elapsed + 3)
    expect(rewrites).toBe(0)
  })
})
