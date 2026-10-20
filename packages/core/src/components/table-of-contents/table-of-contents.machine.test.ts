// Table of Contents' rules in Node on a manual clock: the position drives the current
// section, a followed link holds its section through the jump (tocbot #376) until the scroll
// settles or the user scrolls, controlled values.
import { describe, expect, it } from "vitest"
import type { Scheduler } from "../../env"
import { createService } from "../../machine/service"
import { type TableOfContentsProps, tableOfContentsMachine } from "./table-of-contents.machine"

function make(over: Partial<TableOfContentsProps> = {}) {
  let now = 0
  let next = 1
  const timers = new Map<number, { at: number; fn: () => void }>()
  const scheduler: Scheduler = {
    setTimeout: (fn, ms) => {
      timers.set(next, { at: now + ms, fn })
      return next++
    },
    clearTimeout: (h) => {
      timers.delete(h as number)
    },
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
  }
  const advance = (ms: number) => {
    const end = now + ms
    for (;;) {
      const due = [...timers].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0]
      if (!due) break
      timers.delete(due[0])
      now = due[1].at
      due[1].fn()
    }
    now = end
  }
  const changes: { value: string; reason: string }[] = []
  let props: TableOfContentsProps = {
    id: "t",
    onValueChange: (value, d) => changes.push({ value, reason: d.reason }),
    ...over,
  }
  const s = createService(tableOfContentsMachine, props, { scheduler })
  s.start()
  const position = (current: string | null, visible: readonly string[] = []) =>
    s.send({ type: "POSITION", current, visible })
  const set = (next: Partial<TableOfContentsProps>) => {
    props = { ...props, ...next }
    s.setProps(props)
  }
  return { s, position, advance, changes, set, value: () => s.view().values.value }
}

describe("table of contents machine", () => {
  it("the reading position drives the current section", () => {
    const t = make()
    t.position("intro", ["intro", "install"])
    expect(t.value()).toBe("intro")
    expect(t.s.view().context.visible).toEqual(["intro", "install"])
    t.position("install")
    expect(t.value()).toBe("install")
    expect(t.changes).toEqual([
      { value: "intro", reason: "scroll" },
      { value: "install", reason: "scroll" },
    ])
  })

  it("a followed link is current at once and holds through the jump (tocbot #376)", () => {
    const t = make()
    t.position("intro")
    t.s.send({ type: "NAVIGATE", id: "faq" })
    expect(t.value()).toBe("faq")
    // The smooth scroll passes the sections in between.
    for (const id of ["install", "usage", "api"]) {
      t.position(id)
      t.advance(100)
      expect(t.value()).toBe("faq")
    }
    t.position("faq")
    t.advance(150)
    expect(t.s.view().state).toBe("tracking")
    expect(t.value()).toBe("faq")
    expect(t.changes.map((c) => c.reason)).toEqual(["scroll", "navigate"])
  })

  it("after the jump the position takes over, even when it disagrees", () => {
    const t = make()
    t.s.send({ type: "NAVIGATE", id: "faq" })
    t.position("api")
    t.advance(150)
    expect(t.value()).toBe("api")
  })

  it("the user's own scroll ends the hold at once", () => {
    const t = make()
    t.s.send({ type: "NAVIGATE", id: "faq" })
    t.position("usage")
    t.s.send({ type: "USER.SCROLL" })
    expect(t.s.view().state).toBe("tracking")
    expect(t.value()).toBe("usage")
  })

  it("controlled: proposes, and follows the prop", () => {
    const t = make({ value: "intro" })
    t.position("install")
    expect(t.changes.at(-1)).toEqual({ value: "install", reason: "scroll" })
    expect(t.value()).toBe("intro")
    t.set({ value: "install" })
    expect(t.value()).toBe("install")
  })
})
