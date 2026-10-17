// The completion announcement with a recording announcer (add-progress 2.1).
import { describe, expect, it } from "vitest"
import type { Announcement } from "../../env"
import { createService } from "../../machine/service"
import { type ProgressProps, progressMachine } from "./progress.machine"
import { progressMessages } from "./progress.messages"

function make(over: Partial<ProgressProps> = {}) {
  const log: Announcement[] = []
  let prepared = 0
  let props: ProgressProps = { messages: progressMessages, id: "p1", ...over }
  const env = {
    announcer: {
      announce: (a: Announcement) => {
        log.push(a)
      },
      prepare: () => {
        prepared += 1
        return () => {}
      },
      cancel: () => {},
    },
  }
  const s = createService(progressMachine, props, env)
  s.start()
  const to = (value: number | null) => {
    props = { ...props, value }
    s.setProps(props)
  }
  return { log, to, prepared: () => prepared }
}

describe("progress machine", () => {
  it("40 → 90 → 100 announces Complete once, politely, keyed", () => {
    const { log, to, prepared } = make({ value: 40, announceCompletion: true })
    to(90)
    to(100)
    expect(log).toEqual([{ message: "Complete", priority: "polite", key: "progress-p1" }])
    expect(prepared()).toBe(1)
  })

  it("mounting at max is silent", () => {
    const { log } = make({ value: 100, announceCompletion: true })
    expect(log).toEqual([])
  })

  it("100 → 40 → 100 announces twice", () => {
    const { log, to } = make({ value: 100, announceCompletion: true })
    to(40)
    to(100)
    to(40)
    to(100)
    expect(log).toHaveLength(2)
  })

  it("indeterminate → max announces", () => {
    const { log, to } = make({ value: null, announceCompletion: true })
    to(100)
    expect(log).toHaveLength(1)
  })

  it("custom max: reaching 8 of 0–8 announces", () => {
    const { log, to } = make({ value: 2, max: 8, announceCompletion: true })
    to(8)
    expect(log).toHaveLength(1)
  })

  it("flag off: silent, the announcer not prepared", () => {
    const { log, to, prepared } = make({ value: 40 })
    to(100)
    expect(log).toEqual([])
    expect(prepared()).toBe(0)
  })

  it("no flood: 50 changes while loading announce nothing", () => {
    const { log, to } = make({ value: 0, announceCompletion: true })
    for (let v = 1; v <= 50; v += 1) to(v)
    expect(log).toEqual([])
  })

  it("lang is passed to the announcement", () => {
    const { log, to } = make({ value: 1, announceCompletion: true, lang: "it-IT" })
    to(100)
    expect(log[0]?.lang).toBe("it-IT")
  })
})
