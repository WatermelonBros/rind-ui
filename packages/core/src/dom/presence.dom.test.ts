import { afterEach, describe, expect, it } from "vitest"
import { createService } from "../machine/service"
import { presenceMachine } from "../presence/presence.machine"
import { waitForExit } from "./presence"

const inBrowser = !navigator.userAgent.includes("jsdom")
const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()))

/** Freezes the element's running animations so the test, not the clock, decides when they end. */
function hold(el: Element) {
  const held = el.getAnimations({ subtree: true })
  for (const a of held) a.pause()
  return held
}
const release = (held: Animation[]) => {
  for (const a of held) a.finish()
}

/** Tracks whether a promise has settled, without awaiting it. */
function track(p: Promise<unknown>) {
  const t = { done: false }
  void p.then(() => {
    t.done = true
  })
  return t
}

function mount(css = "") {
  const style = document.createElement("style")
  style.textContent = `@keyframes fade { from { opacity: 1 } to { opacity: 0 } }
@keyframes spin { to { transform: rotate(360deg) } } ${css}`
  const el = document.createElement("div")
  el.textContent = "x"
  document.body.append(style, el)
  return el
}

afterEach(() => {
  document.body.innerHTML = ""
})

describe("waitForExit", () => {
  it("jsdom: resolves in the same task when getAnimations is absent", async () => {
    if (inBrowser) return
    const el = mount()
    let timer = false
    setTimeout(() => {
      timer = true
    }, 0)
    await waitForExit(el)
    expect(timer).toBe(false)
  })

  it.runIf(inBrowser)("waits for a CSS transition, not less", async () => {
    const el = mount()
    el.style.transition = "opacity 200ms linear"
    el.style.opacity = "1"
    void el.offsetWidth
    await frame()
    el.style.opacity = "0"
    const held = hold(el)
    expect(held.length).toBeGreaterThan(0)
    const t = track(waitForExit(el))
    await frame()
    expect(t.done).toBe(false)
    release(held)
    await expect.poll(() => t.done).toBe(true)
  })

  it.runIf(inBrowser)("waits for a finite CSS keyframe animation", async () => {
    const el = mount()
    el.style.animation = "fade 200ms linear forwards"
    const held = hold(el)
    expect(held.length).toBeGreaterThan(0)
    const t = track(waitForExit(el))
    await frame()
    expect(t.done).toBe(false)
    release(held)
    await expect.poll(() => t.done).toBe(true)
  })

  it.runIf(inBrowser)("waits for a Web Animation", async () => {
    const el = mount()
    el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150 })
    const held = hold(el)
    const t = track(waitForExit(el))
    await frame()
    expect(t.done).toBe(false)
    release(held)
    await expect.poll(() => t.done).toBe(true)
  })

  it.runIf(inBrowser)(
    "does not wait for an animation that finished before observation",
    async () => {
      const el = mount()
      el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 10, fill: "forwards" })
      await Promise.all(el.getAnimations().map((a) => a.finished))
      const t = track(waitForExit(el))
      await Promise.resolve()
      await Promise.resolve()
      expect(t.done).toBe(true)
    },
  )

  it.runIf(inBrowser)("ignores infinite animations on a child and on the element", async () => {
    const el = mount()
    const child = document.createElement("span")
    el.append(child)
    child.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 100, iterations: Infinity })
    el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 100, iterations: Infinity })
    await waitForExit(el, { subtree: true })
  })

  it.runIf(inBrowser)("ignores a child's finite animation unless subtree", async () => {
    const el = mount()
    const child = document.createElement("span")
    el.append(child)
    child.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200 })
    const held = hold(el)
    await waitForExit(el)
    const t = track(waitForExit(el, { subtree: true }))
    await frame()
    expect(t.done).toBe(false)
    release(held)
    await expect.poll(() => t.done).toBe(true)
  })

  // A hidden document cannot be emulated reliably in the test browser, so `doc.hidden`
  // short-circuiting is not covered here.

  it.runIf(inBrowser)("settles after the signal aborts", async () => {
    const el = mount()
    el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 5000 })
    const controller = new AbortController()
    const t = track(waitForExit(el, {}, controller.signal))
    await frame()
    controller.abort()
    // Abort is only observed between animations, so end the pending one too.
    for (const a of el.getAnimations()) a.cancel()
    await expect.poll(() => t.done).toBe(true)
  })

  it.runIf(inBrowser)(
    "waits for the animation that replaces a cancelled one (retarget)",
    async () => {
      const el = mount()
      // Durations long enough that a loaded CI runner cannot finish the first transition
      // before the retarget (the 200 ms version raced on shared runners).
      el.style.transition = "opacity 1500ms linear"
      el.style.opacity = "1"
      void el.offsetWidth
      await frame()
      el.style.opacity = "0"
      hold(el)
      const t = track(waitForExit(el))
      await frame()
      el.style.opacity = "0.5"
      const held = hold(el)
      await frame()
      expect(t.done).toBe(false)
      release(held)
      await expect.poll(() => t.done).toBe(true)
    },
  )

  it.runIf(inBrowser)("reopening mid-exit keeps the node present", async () => {
    const el = mount()
    const service = createService(
      presenceMachine,
      {},
      { presence: { waitForExit: (signal) => waitForExit(el, {}, signal) } },
    )
    service.start()
    service.send({ type: "OPEN" })
    service.send({ type: "CLOSE" })
    el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300 })
    const held = hold(el)
    await frame()
    service.send({ type: "OPEN" })
    expect(service.getSnapshot().state).toBe("present")
    release(held)
    await frame()
    await frame()
    expect(service.getSnapshot().state).toBe("present")
    expect(el.isConnected).toBe(true)
    service.stop()
  })
})
