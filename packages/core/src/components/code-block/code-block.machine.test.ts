// The copy states with a fake clipboard and a manual scheduler (fake time, no real delays).
import { describe, expect, it } from "vitest"
import type { Announcement, Clipboard, Scheduler } from "../../env"
import { createService } from "../../machine/service"
import {
  type CodeBlockCopyDetails,
  type CodeBlockProps,
  codeBlockMachine,
} from "./code-block.machine"
import { codeBlockMessages } from "./code-block.messages"

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

function make(clipboard: Clipboard, over: Partial<CodeBlockProps> = {}) {
  const log: Announcement[] = []
  const results: CodeBlockCopyDetails[] = []
  const time = manualScheduler()
  const props: CodeBlockProps = {
    code: "\tconst a = 1\n  b",
    messages: codeBlockMessages,
    id: "b1",
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
  const s = createService(codeBlockMachine, props, env)
  s.start()
  return { s, log, results, advance: time.advance, state: () => s.getSnapshot().state }
}

const flush = () => Promise.resolve().then(() => undefined)

describe("code-block machine: copy", () => {
  it("copied only after the write resolves; writes the exact source", async () => {
    const writes: string[] = []
    let resolve = () => {}
    const { s, log, results, state, advance } = make({
      writeText: (t) => {
        writes.push(t)
        return new Promise<void>((r) => {
          resolve = r
        })
      },
    })
    s.send({ type: "COPY" })
    expect(state()).toBe("copying")
    expect(log).toEqual([])
    resolve()
    await flush()
    expect(state()).toBe("copied")
    expect(writes).toEqual(["\tconst a = 1\n  b"])
    expect(log).toEqual([{ message: "Copied", priority: "polite", key: "code-block-b1" }])
    expect(results).toEqual([{ ok: true }])
    advance(1999)
    expect(state()).toBe("copied")
    advance(1)
    expect(state()).toBe("idle")
  })

  it("a rejected write is an error, never Copied (Zag clipboard regression)", async () => {
    const boom = new Error("denied")
    const { s, log, results, state } = make({ writeText: () => Promise.reject(boom) })
    s.send({ type: "COPY" })
    await flush()
    await flush()
    expect(state()).toBe("error")
    expect(log.map((a) => a.message)).toEqual(["Copy failed"])
    expect(results).toEqual([{ ok: false, error: boom }])
  })

  it("a clipboard that throws synchronously is an error too", async () => {
    const { s, state } = make({
      writeText: () => {
        throw new Error("sync")
      },
    })
    s.send({ type: "COPY" })
    await flush()
    await flush()
    expect(state()).toBe("error")
  })

  it("pressing again while copied copies again and restarts the timer", async () => {
    const { s, state, advance, log } = make(
      { writeText: () => Promise.resolve() },
      { copyFeedbackDuration: 100 },
    )
    s.send({ type: "COPY" })
    await flush()
    advance(60)
    s.send({ type: "COPY" })
    expect(state()).toBe("copying")
    await flush()
    advance(60)
    expect(state()).toBe("copied")
    advance(40)
    expect(state()).toBe("idle")
    expect(log).toHaveLength(2)
  })

  it("a result after unmount is dropped", async () => {
    let resolve = () => {}
    const { s, log } = make({
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
  })

  it("passes the anchor as near", async () => {
    const anchor = {} as Element // only its identity is compared
    let near: Element | undefined
    const { s } = make(
      {
        writeText: (_t, o) => {
          near = o?.near
          return Promise.resolve()
        },
      },
      { getCopyAnchor: () => anchor },
    )
    s.send({ type: "COPY" })
    expect(near).toBe(anchor)
  })
})

describe("code-block machine: wrap, expand, overflow", () => {
  const ok: Clipboard = { writeText: () => Promise.resolve() }
  it("wrap toggles", () => {
    const { s } = make(ok)
    s.send({ type: "WRAP.TOGGLE" })
    expect(s.view().values.wrapped).toBe(true)
  })
  it("expand toggles only when collapsible", () => {
    const a = make(ok, { defaultExpanded: true })
    a.s.send({ type: "EXPAND.TOGGLE" })
    expect(a.s.view().values.expanded).toBe(true)
    const b = make(ok, { collapsible: true, defaultExpanded: false })
    b.s.send({ type: "EXPAND.TOGGLE" })
    expect(b.s.view().values.expanded).toBe(true)
  })
  it("overflow sets scrollable", () => {
    const { s } = make(ok)
    s.send({ type: "OVERFLOW.CHANGE", overflow: true })
    expect(s.getSnapshot().context.scrollable).toBe(true)
  })
})
