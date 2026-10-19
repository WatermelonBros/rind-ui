// The copy states with a fake clipboard and a manual scheduler (fake time, no real delays).
import { describe, expect, it } from "vitest"
import type { Announcement, Clipboard, Scheduler } from "../../env"
import { createService } from "../../machine/service"
import {
  type ClipboardCopyDetails,
  type ClipboardProps,
  clipboardMachine,
} from "./clipboard.machine"
import { clipboardMessages } from "./clipboard.messages"

function manualScheduler() {
  let now = 0
  const timers = new Map<number, { at: number; fn: () => void }>()
  let next = 1
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
    now += ms
    for (const [id, t] of [...timers]) {
      if (t.at <= now) {
        timers.delete(id)
        t.fn()
      }
    }
  }
  return { scheduler, advance }
}

const resolved: Clipboard = { writeText: () => Promise.resolve() }

function make(clipboard: Clipboard, over: Partial<ClipboardProps> = {}) {
  const log: Announcement[] = []
  const results: ClipboardCopyDetails[] = []
  const time = manualScheduler()
  const props: ClipboardProps = {
    value: "sk-123",
    messages: clipboardMessages,
    id: "c1",
    onCopy: (d) => results.push(d),
    ...over,
  }
  const env = {
    scheduler: time.scheduler,
    clipboard,
    announcer: {
      announce: (a: Announcement) => {
        log.push(a)
      },
      prepare: () => () => {},
      cancel: () => {},
    },
  }
  const s = createService(clipboardMachine, props, env)
  s.start()
  return { s, props, log, results, advance: time.advance, state: () => s.getSnapshot().state }
}

const flush = () => Promise.resolve().then(() => undefined)
const messages = (log: readonly Announcement[]) => log.map((a) => a.message)

describe("clipboard machine", () => {
  it("copied only after the write resolves, with the value", async () => {
    const writes: string[] = []
    let resolve = () => {}
    const { s, log, results, state } = make({
      writeText: (t) => {
        writes.push(t)
        return new Promise<void>((r) => {
          resolve = r
        })
      },
    })
    s.send({ type: "COPY" })
    expect(state()).toBe("copying")
    expect(writes).toEqual(["sk-123"])
    await flush()
    expect(state()).toBe("copying")
    expect(log).toEqual([])
    resolve()
    await flush()
    expect(state()).toBe("copied")
    expect(messages(log)).toEqual(["Copied"])
    expect(log[0]?.key).toBe("clipboard-c1")
    expect(results).toEqual([{ ok: true, source: "trigger" }])
  })

  it("a rejection is error, never copied, with the error", async () => {
    const boom = new Error("denied")
    const seen: string[] = []
    const { s, log, results, state } = make({ writeText: () => Promise.reject(boom) })
    s.subscribe(() => seen.push(state()))
    s.send({ type: "COPY" })
    await flush()
    await flush()
    expect(state()).toBe("error")
    expect(seen).not.toContain("copied")
    expect(messages(log)).toEqual(["Copy failed"])
    expect(results).toEqual([{ ok: false, error: boom, source: "trigger" }])
  })

  it("a synchronous throw is a rejection", async () => {
    const { s, state } = make({
      writeText: () => {
        throw new Error("no clipboard")
      },
    })
    s.send({ type: "COPY" })
    await flush()
    await flush()
    expect(state()).toBe("error")
  })

  it("writeText is called before send returns (the click's task)", () => {
    let called = false
    const { s } = make({
      writeText: () => {
        called = true
        return new Promise<void>(() => {})
      },
    })
    s.send({ type: "COPY" })
    expect(called).toBe(true)
  })

  it("feedback ends after 2000 ms, not 1999", async () => {
    const { s, state, advance } = make(resolved)
    s.send({ type: "COPY" })
    await flush()
    expect(state()).toBe("copied")
    advance(1999)
    expect(state()).toBe("copied")
    advance(1)
    expect(state()).toBe("idle")
  })

  it("copying again restarts the timer from the new result", async () => {
    const { s, state, advance, log } = make(resolved)
    s.send({ type: "COPY" })
    await flush()
    advance(1500)
    s.send({ type: "COPY" })
    await flush()
    expect(state()).toBe("copied")
    advance(1000)
    expect(state()).toBe("copied")
    advance(1000)
    expect(state()).toBe("idle")
    expect(messages(log)).toEqual(["Copied", "Copied"])
  })

  it("a press while copying is ignored: one write, one result", async () => {
    let writes = 0
    let resolve = () => {}
    const { s, results } = make({
      writeText: () => {
        writes++
        return new Promise<void>((r) => {
          resolve = r
        })
      },
    })
    s.send({ type: "COPY" })
    s.send({ type: "COPY" })
    resolve()
    await flush()
    expect(writes).toBe(1)
    expect(results).toHaveLength(1)
  })

  it("the value is read when the write starts", () => {
    const writes: string[] = []
    const { s, props } = make({
      writeText: (t) => {
        writes.push(t)
        return Promise.resolve()
      },
    })
    s.setProps({ ...props, value: "b" })
    s.send({ type: "COPY" })
    expect(writes).toEqual(["b"])
  })

  it("stopped while copying: the result is dropped", async () => {
    let resolve = () => {}
    const { s, log, results } = make({
      writeText: () =>
        new Promise<void>((r) => {
          resolve = r
        }),
    })
    s.send({ type: "COPY" })
    s.stop()
    resolve()
    await flush()
    expect(log).toEqual([])
    expect(results).toEqual([])
  })

  it("disabled: a press does not copy", () => {
    let writes = 0
    const { s, state } = make(
      {
        writeText: () => {
          writes++
          return Promise.resolve()
        },
      },
      { disabled: true },
    )
    s.send({ type: "COPY" })
    expect(state()).toBe("idle")
    expect(writes).toBe(0)
  })

  it("disabled while copying: the result is still reported", async () => {
    let resolve = () => {}
    const { s, props, state, results } = make({
      writeText: () =>
        new Promise<void>((r) => {
          resolve = r
        }),
    })
    s.send({ type: "COPY" })
    s.setProps({ ...props, disabled: true })
    resolve()
    await flush()
    expect(state()).toBe("copied")
    expect(results).toEqual([{ ok: true, source: "trigger" }])
  })

  it("a whole-value input copy is copied without a write; a partial one changes nothing", () => {
    let writes = 0
    const { s, state, log, results } = make({
      writeText: () => {
        writes++
        return Promise.resolve()
      },
    })
    s.send({ type: "INPUT.COPY", whole: false })
    expect(state()).toBe("idle")
    expect(log).toEqual([])
    s.send({ type: "INPUT.COPY", whole: true })
    expect(state()).toBe("copied")
    expect(writes).toBe(0)
    expect(results).toEqual([{ ok: true, source: "input" }])
  })

  it("a second whole input copy reports again and restarts the timer", () => {
    const { s, state, log, advance } = make(resolved)
    s.send({ type: "INPUT.COPY", whole: true })
    advance(1500)
    s.send({ type: "INPUT.COPY", whole: true })
    advance(1000)
    expect(state()).toBe("copied")
    expect(messages(log)).toEqual(["Copied", "Copied"])
    advance(1000)
    expect(state()).toBe("idle")
  })

  it("the announcement carries the language", async () => {
    const { s, log } = make(resolved, {
      lang: "it",
      messages: { ...clipboardMessages, copied: "Copiato" },
    })
    s.send({ type: "COPY" })
    await flush()
    expect(log[0]).toMatchObject({ message: "Copiato", lang: "it", priority: "polite" })
  })
})
