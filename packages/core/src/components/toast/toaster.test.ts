// Store and toast machine scenarios of the spec (fake scheduler, clock, visibility and a
// recording announcer: nothing here depends on elapsed time).
import { describe, expect, it } from "vitest"
import type { SwipeDirection } from "../../dom/swipe"
import type { ToastDismissReason, ToastId } from "./toast.types"
import { createToaster, type Toaster, type ToasterEnv, type ToasterOptions } from "./toaster"

interface Said {
  message: string
  priority: string | undefined
  key: string | undefined
}

function fakeEnv() {
  let now = 0
  const timers = new Map<number, { at: number; cb: () => void }>()
  let seq = 0
  const said: Said[] = []
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
      announce: (a) => void said.push({ message: a.message, priority: a.priority, key: a.key }),
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
  // Due timers run in order, the clock standing at each one's time.
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

function setup(options?: ToasterOptions, mounted = true) {
  const f = fakeEnv()
  const t = createToaster(options)
  const detach = mounted ? t.attach(f.env) : () => {}
  return { t, detach, ...f }
}

const state = (t: Toaster, id: ToastId) => t.get(id)?.state
const live = (t: Toaster) => t.toasts().filter((x) => x.state !== "dismissed")

function swipe(
  t: Toaster,
  id: ToastId,
  direction: SwipeDirection | null,
  offset: number,
  velocity: number,
) {
  const snap = t.get(id)
  if (!snap) throw new Error("no toast")
  t.service(snap.instance)?.send({ type: "SWIPE", direction, offset, velocity, size: 100 })
}

describe("lifetime and pausing", () => {
  it("radix#2233: loading paused while persistent becomes success, dismisses 5000 ms after the pause ends", () => {
    const { t, advance } = setup()
    const id = t.loading("Uploading…")
    t.regionReason("hover", true)
    t.update(id, { type: "success", duration: 5000 })
    advance(60_000) // fake-time: a long pause keeps it
    expect(state(t, id)).toBe("paused")
    t.regionReason("hover", false)
    advance(4999) // fake-time: just before the new lifetime ends
    expect(state(t, id)).toBe("timing")
    advance(1) // fake-time: the lifetime ends
    expect(state(t, id)).toBe("dismissed")
  })

  it("radix#2268: closing a focused toast releases the focus reason, later toasts dismiss on time", () => {
    const { t, advance } = setup({ duration: 1000 })
    const a = t.show("A")
    t.regionReason("focus", true)
    t.dismiss(a)
    expect(t.get(a)?.reasons.size).toBe(0)
    t.regionReason("focus", false)
    const b = t.show("B")
    advance(1000) // fake-time: B's lifetime
    expect(t.get(b)?.dismissReason).toBe("timeout")
  })

  it("radix#2268: a toast dismissed while paused holds no reason after the pause ends", () => {
    const { t } = setup()
    const id = t.show("A")
    t.regionReason("focus", true)
    t.regionReason("hover", true)
    t.dismiss(id)
    expect([...(t.get(id)?.reasons ?? [])]).toEqual([])
  })

  it("zag#2238: an explicit pause survives a tab switch until resume(id)", () => {
    const { t, advance, setHidden } = setup({ duration: 1000 })
    const id = t.show("A")
    t.pause(id)
    setHidden(true)
    advance(5000) // fake-time: hidden and paused
    setHidden(false)
    advance(5000) // fake-time: back, still paused
    expect(state(t, id)).toBe("paused")
    t.resume(id)
    advance(1000) // fake-time: the full lifetime remains
    expect(state(t, id)).toBe("dismissed")
  })

  it("store pause() and resume() hold every toast, also those shown while paused", () => {
    const { t, advance } = setup({ duration: 1000 })
    const a = t.show("A")
    t.pause()
    const b = t.show("B")
    advance(5000) // fake-time: paused
    expect([state(t, a), state(t, b)]).toEqual(["paused", "paused"])
    t.resume()
    advance(1000) // fake-time: full lifetimes
    expect([state(t, a), state(t, b)]).toEqual(["dismissed", "dismissed"])
  })

  it("zag#295: not earlier and not later than 5000 ms of un-hovered time", () => {
    const { t, advance } = setup({ duration: 5000 })
    const id = t.show("Hi")
    for (let i = 0; i < 3; i++) {
      advance(1000) // fake-time: un-hovered
      t.regionReason("hover", true)
      advance(1000) // fake-time: hovered
      t.regionReason("hover", false)
    }
    advance(1999) // fake-time: 4999 ms un-hovered
    expect(state(t, id)).toBe("timing")
    advance(1) // fake-time: 5000 ms un-hovered
    expect(state(t, id)).toBe("dismissed")
  })

  it("react-spectrum#8131: shown while hovered starts paused until the pointer leaves", () => {
    const { t, advance } = setup({ duration: 1000 })
    t.regionReason("hover", true)
    const id = t.show("A")
    advance(5000) // fake-time: hovered
    expect(state(t, id)).toBe("paused")
    t.regionReason("hover", false)
    advance(1000) // fake-time: full lifetime
    expect(state(t, id)).toBe("dismissed")
  })

  it("mui/base-ui#5955: a focus change while the store is empty applies to the next toast", () => {
    const { t, advance } = setup({ duration: 1000 })
    t.regionReason("focus", true)
    t.regionReason("focus", false)
    t.regionReason("hover", true)
    const id = t.show("A")
    expect(state(t, id)).toBe("paused")
    t.regionReason("hover", false)
    advance(1000) // fake-time: full lifetime
    expect(state(t, id)).toBe("dismissed")
  })

  it("mui/base-ui#5955: window blur is not a pause reason, a hidden page is", () => {
    const { t, advance, setHidden } = setup({ duration: 1000 })
    const id = t.show("A")
    advance(500) // fake-time: blur changes nothing, the timer keeps running
    setHidden(true)
    advance(60_000) // fake-time: hidden
    expect([...(t.get(id)?.reasons ?? [])]).toEqual(["hidden"])
    setHidden(false)
    advance(500) // fake-time: what was left
    expect(state(t, id)).toBe("dismissed")
  })

  it("react-spectrum#9930: one timer elapses and another toast is shown in the same task", () => {
    const { t, advance } = setup({ duration: 1000 })
    const a = t.show("A")
    advance(1000) // fake-time: A elapses
    const b = t.show("B")
    expect([state(t, a), state(t, b)]).toEqual(["dismissed", "timing"])
    advance(1000) // fake-time: B's own lifetime
    expect(state(t, b)).toBe("dismissed")
  })

  it("mui/base-ui#4253: a toast with an action and no duration never times out", () => {
    const { t, advance } = setup()
    const id = t.show({ title: "Archived", action: { label: "Undo", onAction: () => {} } })
    advance(10 * 60_000) // fake-time: far beyond any lifetime
    expect(state(t, id)).toBe("persistent")
  })

  it("an explicit duration on an actionable toast still times out", () => {
    const { t, advance } = setup()
    const id = t.show({ title: "A", duration: 100, action: { label: "Undo", onAction: () => {} } })
    advance(100) // fake-time: its duration
    expect(state(t, id)).toBe("dismissed")
  })

  it("same id while visible updates in place and restarts the lifetime", () => {
    const { t, advance } = setup({ duration: 1000 })
    const id = t.show({ id: "sync", title: "Syncing…" })
    advance(900) // fake-time: almost elapsed
    t.show({ id: "sync", title: "Synced" })
    expect(live(t)).toHaveLength(1)
    expect(t.get(id)?.data.title).toBe("Synced")
    advance(999) // fake-time: the restarted lifetime
    expect(state(t, id)).toBe("timing")
    advance(1) // fake-time: the restarted lifetime ends
    expect(state(t, id)).toBe("dismissed")
  })

  it("sonner#791: same id during exit is a new toast, the leaving one is independent", () => {
    const { t } = setup()
    const first = t.show({ id: "saved", title: "Saved" })
    const old = t.get(first)?.instance
    t.dismiss(first)
    t.show({ id: "saved", title: "Saved" })
    expect(t.toasts().map((x) => x.state)).toEqual(["timing", "dismissed"])
    expect(t.toasts()[0]?.dismissReason).toBeNull()
    if (old) t.remove(old)
    expect(t.toasts().map((x) => x.state)).toEqual(["timing"])
  })
})

describe("toasts without a region", () => {
  it("zag#2922: shown before a region, with its full lifetime once attached", () => {
    const { t, advance, env } = setup({ duration: 1000 }, false)
    const id = t.error("Could not save")
    advance(60_000) // fake-time: no region, no lifetime
    t.attach(env)
    advance(999) // fake-time: just under the full lifetime
    expect(state(t, id)).toBe("timing")
    advance(1) // fake-time: the lifetime ends
    expect(state(t, id)).toBe("dismissed")
  })

  it("sonner#786: a remount keeps the lifetime it had left; dismissed, no later mount shows it", () => {
    const { t, advance, env, detach } = setup({ duration: 5000 })
    const id = t.show("A")
    advance(2000) // fake-time: 3000 ms left
    detach()
    advance(60_000) // fake-time: no region
    expect(state(t, id)).toBe("paused")
    t.attach(env)
    advance(2999) // fake-time: just under what was left
    expect(state(t, id)).toBe("timing")
    advance(1) // fake-time: what was left
    expect(state(t, id)).toBe("dismissed")
    const instance = t.get(id)?.instance
    if (instance) t.remove(instance)
    t.attach(env)
    expect(t.toasts()).toEqual([])
  })

  it("a toast dismissed with no region is gone at once", () => {
    const { t } = setup(undefined, false)
    const id = t.show("A")
    t.dismiss(id)
    expect(t.toasts()).toEqual([])
  })

  it("two stores do not mix", () => {
    const a = setup()
    const b = setup({ placement: "top-center" })
    b.t.info("Offline")
    expect(a.t.toasts()).toEqual([])
    expect(b.t.toasts().map((x) => x.data.title)).toEqual(["Offline"])
    expect(b.t.options.placement).toBe("top-center")
    expect(a.t.options.placement).toBe("bottom-end")
  })
})

describe("visible limit", () => {
  it("zag#2403: five with limit 3, the newest dismissed, the held toast is presented again", () => {
    const { t } = setup({ limit: 3 })
    const ids = [1, 2, 3, 4, 5].map((n) => t.show(`T${n}`))
    expect(t.toasts().map((x) => x.limited)).toEqual([false, false, false, true, true])
    expect(
      t
        .toasts()
        .slice(3)
        .map((x) => x.state),
    ).toEqual(["paused", "paused"])
    t.dismiss(ids[4])
    expect(live(t).map((x) => [x.data.title, x.limited])).toEqual([
      ["T4", false],
      ["T3", false],
      ["T2", false],
      ["T1", true],
    ])
    t.dismiss(ids[3])
    t.dismiss(ids[2])
    expect(live(t).every((x) => !x.limited)).toBe(true)
    expect(live(t)).toHaveLength(2)
  })

  it("held toasts are not announced again when presented, and keep their lifetime", () => {
    const { t, said, advance } = setup({ limit: 1, duration: 1000 })
    t.show("A")
    t.show("B")
    expect(said.map((s) => s.message)).toEqual(["A", "B"])
    advance(1000) // fake-time: B elapses, A is presented again with its full lifetime
    expect(said.map((s) => s.message)).toEqual(["A", "B"])
    expect(live(t).map((x) => x.data.title)).toEqual(["A"])
    advance(1000) // fake-time: A's own lifetime
    expect(live(t)).toEqual([])
  })
})

describe("dismissal reasons", () => {
  const pressed = (type: "CLOSE_TRIGGER_PRESS" | "ESCAPE_KEY" | "ACTION_PRESS") => {
    const reasons: ToastDismissReason[] = []
    const ctx = setup()
    const id = ctx.t.show({
      title: "A",
      onDismiss: (r) => reasons.push(r),
      action: { label: "Undo", onAction: () => {} },
      duration: 1000,
    })
    const snap = ctx.t.get(id)
    if (!snap) throw new Error("no toast")
    ctx.t.service(snap.instance)?.send({ type, modality: "pointer" })
    return { reasons, ...ctx, id }
  }

  it("close trigger, escape and action pass their reason to onDismiss", () => {
    expect(pressed("CLOSE_TRIGGER_PRESS").reasons).toEqual(["close-trigger"])
    expect(pressed("ESCAPE_KEY").reasons).toEqual(["escape-key"])
    expect(pressed("ACTION_PRESS").reasons).toEqual(["action"])
  })

  it("timeout and api reasons", () => {
    const reasons: ToastDismissReason[] = []
    const { t, advance } = setup({ duration: 1000 })
    t.show({ title: "A", onDismiss: (r) => reasons.push(r) })
    advance(1000) // fake-time: its lifetime
    const b = t.show({ title: "B", onDismiss: (r) => reasons.push(r) })
    t.dismiss(b)
    expect(reasons).toEqual(["timeout", "api"])
  })

  it("subscribers see the dismissal with its reason", () => {
    const { t } = setup()
    const id = t.show("A")
    let seen: ToastDismissReason | null = null
    t.subscribe(() => {
      seen = t.get(id)?.dismissReason ?? null
    })
    t.dismiss(id)
    expect(seen).toBe("api")
  })

  it("an action with closes:false runs onAction and stays", () => {
    let ran = 0
    const { t } = setup()
    const id = t.show({
      title: "A",
      action: { label: "Retry", onAction: () => ran++, closes: false },
    })
    const snap = t.get(id)
    if (!snap) throw new Error("no toast")
    t.service(snap.instance)?.send({ type: "ACTION_PRESS", modality: "pointer" })
    expect(ran).toBe(1)
    expect(state(t, id)).toBe("persistent")
  })

  it("dismissible:false ignores close trigger, escape and swipe, but not the api", () => {
    const { t } = setup({ swipeDirections: ["down"] })
    const id = t.show({ title: "A", dismissible: false })
    const svc = t.service(t.get(id)?.instance as never)
    svc?.send({ type: "CLOSE_TRIGGER_PRESS", modality: "pointer" })
    svc?.send({ type: "ESCAPE_KEY", modality: "keyboard" })
    swipe(t, id, "down", 500, 5)
    expect(state(t, id)).toBe("timing")
    t.dismiss(id)
    expect(t.get(id)?.dismissReason).toBe("api")
  })
})

describe("swipe", () => {
  const opts = { swipeDirections: ["down", "right"] } as const

  it("an allowed direction past the offset dismisses with reason swipe", () => {
    const { t } = setup(opts)
    const id = t.show("A")
    swipe(t, id, "down", 45, 0)
    expect(t.get(id)?.dismissReason).toBe("swipe")
    expect(t.get(id)?.swipeDirection).toBe("down")
  })

  it("an allowed direction past the velocity dismisses", () => {
    const { t } = setup(opts)
    const id = t.show("A")
    swipe(t, id, "right", 10, 0.11)
    expect(t.get(id)?.dismissReason).toBe("swipe")
  })

  it("below both thresholds the toast returns to rest", () => {
    const { t } = setup(opts)
    const id = t.show("A")
    swipe(t, id, "down", 44, 0.1)
    expect(state(t, id)).toBe("timing")
    expect(t.get(id)?.swiping).toBe(false)
  })

  it("sonner#762: a fast flick in an excluded direction stays", () => {
    const { t } = setup({ swipeDirections: ["up", "right"] })
    const id = t.show("A")
    swipe(t, id, "left", 300, 2)
    swipe(t, id, null, 0, 0)
    expect(state(t, id)).toBe("timing")
  })

  it("a swipe in progress pauses through the swipe reason set by the part", () => {
    const { t, advance } = setup({ ...opts, duration: 1000 })
    const id = t.show("A")
    const svc = t.service(t.get(id)?.instance as never)
    svc?.send({ type: "SWIPE.START", modality: "pointer" })
    expect(t.get(id)?.swiping).toBe(true)
    svc?.send({ type: "PAUSE", reason: "swipe" })
    advance(5000) // fake-time: swiping
    expect(state(t, id)).toBe("paused")
    svc?.send({ type: "SWIPE.CANCEL" })
    svc?.send({ type: "RESUME", reason: "swipe" })
    expect(t.get(id)?.swiping).toBe(false)
    advance(1000) // fake-time: full lifetime
    expect(state(t, id)).toBe("dismissed")
  })
})

describe("announcements", () => {
  it("one polite announcement per show, keyed toast-<id>", () => {
    const { t, said } = setup()
    const id = t.info({ title: "Saved", description: "3 files" })
    expect(said).toEqual([{ message: "Saved. 3 files", priority: "polite", key: `toast-${id}` }])
  })

  it("assertive only for errors", () => {
    const { t, said } = setup()
    t.error("Bad")
    t.warning("Hmm")
    t.success("Ok")
    expect(said.map((s) => s.priority)).toEqual(["assertive", "polite", "polite"])
  })

  it("an update that changes title, description or type is announced again; others are not", () => {
    const { t, said } = setup()
    const id = t.show({ title: "A", description: "d" })
    t.update(id, { title: "B" })
    t.update(id, { description: "e" })
    t.update(id, { type: "error" })
    expect(said.map((s) => s.message)).toEqual(["A. d", "B. d", "B. e", "B. e"])
    expect(said[3]?.priority).toBe("assertive")
    t.update(id, { meta: { x: 1 } })
    t.update(id, { duration: 9000 })
    t.show({ id, title: "B", description: "e", type: "error" })
    expect(said).toHaveLength(4)
  })

  it("nothing is announced on dismissal", () => {
    const { t, said } = setup()
    const id = t.show("A")
    t.dismiss(id)
    expect(said).toHaveLength(1)
  })

  it("a toast shown before a region is announced once it starts", () => {
    const { t, said, env } = setup(undefined, false)
    t.show("A")
    expect(said).toEqual([])
    t.attach(env)
    expect(said.map((s) => s.message)).toEqual(["A"])
  })
})

describe("promise toasts", () => {
  const deferred = <T>() => {
    let resolve!: (v: T) => void
    let reject!: (e: unknown) => void
    const promise = new Promise<T>((a, b) => {
      resolve = a
      reject = b
    })
    return { promise, resolve, reject }
  }
  const tick = () => Promise.resolve().then(() => Promise.resolve())

  it("loading, then success", async () => {
    const { t, said } = setup()
    const d = deferred<number>()
    const { id } = t.promise(d.promise, {
      loading: "Uploading…",
      success: (n) => ({ title: `Uploaded ${n}` }),
      error: "Upload failed",
    })
    expect(t.get(id)?.data.type).toBe("loading")
    expect(state(t, id)).toBe("persistent")
    d.resolve(3)
    await tick()
    expect(t.get(id)?.data).toMatchObject({ type: "success", title: "Uploaded 3" })
    expect(said.map((s) => [s.message, s.priority])).toEqual([
      ["Uploading…", "polite"],
      ["Uploaded 3", "polite"],
    ])
  })

  it("loading, then error: announced assertively", async () => {
    const { t, said } = setup()
    const d = deferred<number>()
    const { id, result } = t.promise(() => d.promise, {
      loading: "Uploading…",
      error: (e) => `Failed: ${String(e)}`,
    })
    d.reject("nope")
    await expect(result).rejects.toBe("nope")
    await tick()
    expect(t.get(id)?.data).toMatchObject({ type: "error", title: "Failed: nope" })
    expect(said.map((s) => s.priority)).toEqual(["polite", "assertive"])
  })

  it("success omitted dismisses", async () => {
    const { t } = setup()
    const d = deferred<number>()
    const { id } = t.promise(d.promise, { loading: "Working" })
    d.resolve(1)
    await tick()
    expect(t.get(id)?.dismissReason).toBe("api")
  })

  it("mui/base-ui#2291: per-state duration", async () => {
    const { t, advance } = setup()
    const d = deferred<number>()
    const { id } = t.promise(d.promise, {
      loading: "Working",
      success: { title: "Done", duration: 2000 },
    })
    d.resolve(1)
    await tick()
    advance(1999) // fake-time: just under the success duration
    expect(state(t, id)).toBe("timing")
    advance(1) // fake-time: the success duration
    expect(state(t, id)).toBe("dismissed")
  })

  it("dismissed while loading: the promise never brings it back", async () => {
    const { t } = setup()
    const d = deferred<number>()
    const { id } = t.promise(d.promise, { loading: "Working", success: "Done" })
    t.dismiss(id)
    d.resolve(1)
    await tick()
    expect(t.get(id)?.data.title).toBe("Working")
    expect(live(t)).toEqual([])
  })

  it("re-shown with a new promise: the first does not update it", async () => {
    const { t } = setup()
    const d1 = deferred<number>()
    const d2 = deferred<number>()
    const first = t.promise(d1.promise, { loading: "One", success: "One done" })
    const first_instance = t.get(first.id)?.instance
    t.dismiss(first.id)
    if (first_instance) t.remove(first_instance)
    const second = t.promise(d2.promise, { loading: "Two", success: "Two done" }, { id: "x" })
    d1.resolve(1)
    await tick()
    expect(t.get(second.id)?.data.title).toBe("Two")
    d2.resolve(2)
    await tick()
    expect(t.get(second.id)?.data.title).toBe("Two done")
  })
})
