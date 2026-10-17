// add-tour 1.2: waiting for late, hidden, replaced and removed targets, and abort. Runs in
// jsdom (computed-style fallback) and in real browsers (checkVisibility and the box).
import { afterEach, describe, expect, it, vi } from "vitest"
import { isRendered, WaitAbortedError, waitForElement, waitForEvent } from "./wait-for-element"

afterEach(() => {
  document.body.replaceChildren()
})

const box = (id: string) => {
  const el = document.createElement("div")
  el.id = id
  el.style.width = "20px"
  el.style.height = "20px"
  return el
}

describe("isRendered", () => {
  it("connected and visible is rendered; detached, display none, hidden are not", () => {
    const el = box("a")
    expect(isRendered(el)).toBe(false)
    document.body.append(el)
    expect(isRendered(el)).toBe(true)
    el.style.display = "none"
    expect(isRendered(el)).toBe(false)
    el.style.display = ""
    el.style.visibility = "hidden"
    expect(isRendered(el)).toBe(false)
    expect(isRendered(null)).toBe(false)
  })

  it("inside a collapsed display: none region is not rendered", () => {
    const wrap = document.createElement("section")
    wrap.style.display = "none"
    const el = box("a")
    wrap.append(el)
    document.body.append(wrap)
    expect(isRendered(el)).toBe(false)
  })
})

describe("waitForElement", () => {
  it("resolves at once when the element is already rendered", async () => {
    const el = box("a")
    document.body.append(el)
    await expect(waitForElement(() => document.getElementById("a"))).resolves.toBe(el)
  })

  it("picks up a late element as soon as it is inserted", async () => {
    const p = waitForElement(() => document.getElementById("late"))
    const el = box("late")
    document.body.append(el)
    await expect(p).resolves.toBe(el)
  })

  it("waits while the element is hidden and resolves when it is shown", async () => {
    const el = box("h")
    el.style.display = "none"
    document.body.append(el)
    const resolver = vi.fn(() => document.getElementById("h"))
    let settled = false
    const p = waitForElement(resolver).then((x) => {
      settled = true
      return x
    })
    // A mutation that leaves it hidden: the resolver runs again, the promise stays pending.
    el.setAttribute("class", "still-hidden")
    await vi.waitFor(() => expect(resolver).toHaveBeenCalledTimes(2))
    expect(settled).toBe(false)
    el.style.display = ""
    await expect(p).resolves.toBe(el)
  })

  it("follows a replaced element", async () => {
    const old = box("t")
    old.style.display = "none"
    document.body.append(old)
    const p = waitForElement(() => document.getElementById("t"))
    const fresh = box("t")
    old.replaceWith(fresh)
    await expect(p).resolves.toBe(fresh)
  })

  it("rejects on abort, and at once when already aborted", async () => {
    const controller = new AbortController()
    const p = waitForElement(() => document.getElementById("never"), { signal: controller.signal })
    controller.abort()
    await expect(p).rejects.toBeInstanceOf(WaitAbortedError)
    await expect(
      waitForElement(() => null, { signal: controller.signal }),
    ).rejects.toBeInstanceOf(WaitAbortedError)
  })

  it("rejects after the timeout through the given scheduler (fake time)", async () => {
    let fire: () => void = () => {}
    const scheduler = {
      setTimeout: (cb: () => void) => {
        fire = cb
        return 1
      },
      clearTimeout: () => {},
    }
    const p = waitForElement(() => null, { timeout: 5000, scheduler })
    fire()
    await expect(p).rejects.toThrow("timeout")
  })

  it("a removed element is waited for again", async () => {
    const el = box("r")
    document.body.append(el)
    el.remove()
    const p = waitForElement(() => document.getElementById("r"))
    document.body.append(el)
    await expect(p).resolves.toBe(el)
  })
})

describe("waitForEvent", () => {
  it("resolves on the event that passes the predicate", async () => {
    const button = document.createElement("button")
    document.body.append(button)
    const p = waitForEvent<MouseEvent>(button, "click", { predicate: (e) => e.detail === 2 })
    button.dispatchEvent(new MouseEvent("click", { detail: 1 }))
    button.dispatchEvent(new MouseEvent("click", { detail: 2 }))
    await expect(p).resolves.toHaveProperty("detail", 2)
  })

  it("never hangs on an absent element, and honours abort", async () => {
    await expect(waitForEvent(null, "click")).rejects.toBeInstanceOf(WaitAbortedError)
    const controller = new AbortController()
    const p = waitForEvent(document.body, "click", { signal: controller.signal })
    controller.abort()
    await expect(p).rejects.toBeInstanceOf(WaitAbortedError)
  })
})
