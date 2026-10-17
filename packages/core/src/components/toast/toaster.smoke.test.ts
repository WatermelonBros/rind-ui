// Store smoke test: before mount, lifetime, hover pause, limit, update to success.
import { describe, expect, it } from "vitest"
import { createToaster, type ToasterEnv } from "./toaster"

function fakeEnv() {
  let now = 0
  const timers = new Map<number, { at: number; cb: () => void }>()
  let seq = 0
  const said: { message: string; priority?: string }[] = []
  let hidden = false
  const subs = new Set<(h: boolean) => void>()
  const env: ToasterEnv = {
    scheduler: {
      setTimeout: (cb, ms) => {
        timers.set(++seq, { at: now + ms, cb })
        return seq as never
      },
      clearTimeout: (h) => void timers.delete(h as number),
      requestAnimationFrame: () => 0 as never,
      cancelAnimationFrame: () => {},
    },
    clock: { now: () => now },
    announcer: {
      announce: (a) => void said.push({ message: a.message, priority: a.priority }),
      prepare: () => () => {},
      cancel: () => {},
    },
    locale: { locale: () => "en", dir: () => "ltr", subscribe: () => () => {} } as never,
    visibility: {
      hidden: () => hidden,
      subscribe: (l) => {
        subs.add(l)
        return () => subs.delete(l)
      },
    },
  }
  // fake-time: a manual clock; due timers run in order
  const advance = (ms: number) => {
    const end = now + ms
    for (;;) {
      const due = [...timers].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0]
      if (!due) break
      timers.delete(due[0])
      now = due[1].at
      due[1].cb()
    }
    now = end
  }
  const setHidden = (h: boolean) => {
    hidden = h
    for (const l of subs) l(h)
  }
  return { env, advance, said, setHidden }
}

describe("toaster store", () => {
  it("before a region mounts: kept, shown with its full lifetime once attached (zag#2922)", () => {
    const t = createToaster({ duration: 5000 })
    const { env, advance, said } = fakeEnv()
    t.error("Could not save")
    advance(10_000)
    t.attach(env)
    expect(t.toasts().map((x) => x.state)).toEqual(["timing"])
    expect(said).toEqual([{ message: "Could not save", priority: "assertive" }])
    advance(4999)
    expect(t.toasts()[0]?.state).toBe("timing")
    advance(1)
    expect(t.toasts()[0]?.state).toBe("dismissed")
    expect(t.toasts()[0]?.dismissReason).toBe("timeout")
  })

  it("repeated hover: 5000 ms of un-hovered time in total (zag#295)", () => {
    const t = createToaster({ duration: 5000 })
    const { env, advance } = fakeEnv()
    t.attach(env)
    t.show("Hi")
    for (let i = 0; i < 3; i++) {
      advance(1000)
      t.regionReason("hover", true)
      advance(1000)
      t.regionReason("hover", false)
    }
    advance(1999)
    expect(t.toasts()[0]?.state).toBe("timing")
    advance(1)
    expect(t.toasts()[0]?.state).toBe("dismissed")
  })

  it("limit 3: the fourth and fifth hold older ones, none dropped (zag#2403)", () => {
    const t = createToaster({ limit: 3 })
    const { env } = fakeEnv()
    t.attach(env)
    const ids = [1, 2, 3, 4, 5].map((n) => t.show(`T${n}`))
    expect(t.toasts().map((x) => x.limited)).toEqual([false, false, false, true, true])
    t.dismiss(ids[4])
    expect(
      t
        .toasts()
        .filter((x) => x.state !== "dismissed")
        .map((x) => x.limited),
    ).toEqual([false, false, false, true])
  })

  it("loading paused while persistent becomes success: dismisses 5000 ms after the pause ends (radix#2233)", () => {
    const t = createToaster()
    const { env, advance } = fakeEnv()
    t.attach(env)
    const id = t.loading("Uploading…")
    t.regionReason("hover", true)
    t.update(id, { type: "success", title: "Done", duration: 5000 })
    advance(10_000)
    expect(t.get(id)?.state).toBe("paused")
    t.regionReason("hover", false)
    advance(4999)
    expect(t.get(id)?.state).toBe("timing")
    advance(1)
    expect(t.get(id)?.state).toBe("dismissed")
  })

  it("a hidden page pauses; window blur is not a reason", () => {
    const t = createToaster({ duration: 1000 })
    const { env, advance, setHidden } = fakeEnv()
    t.attach(env)
    t.show("Hi")
    setHidden(true)
    advance(60_000)
    expect(t.toasts()[0]?.state).toBe("paused")
    setHidden(false)
    advance(1000)
    expect(t.toasts()[0]?.state).toBe("dismissed")
  })
})
