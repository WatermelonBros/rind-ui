import { describe, expect, it, vi } from "vitest"
import type { Announcement } from "../../env"
import { createService } from "../../machine/service"
import { contextMeterConnect } from "./context-meter.connect"
import { contextMeterContract } from "./context-meter.contract"
import {
  type ContextMeterProps,
  contextMeterMachine,
  contextMeterState,
} from "./context-meter.machine"
import { contextMeterMessages } from "./context-meter.messages"
import { contextMeterMeta } from "./context-meter.meta"

function make(over: Partial<ContextMeterProps> = {}) {
  const announced: Announcement[] = []
  const onThreshold = vi.fn()
  let props: ContextMeterProps = { id: "c", used: 0, max: 100, onThreshold, ...over }
  const env = {
    announcer: {
      announce: (a: Announcement) => {
        announced.push(a)
      },
      prepare: () => () => {},
      cancel: () => {},
    },
    locale: { locale: () => "en-US", dir: () => "ltr" as const, subscribe: () => () => {} },
  }
  const s = createService(contextMeterMachine, props, env)
  s.start()
  const set = (p: Partial<ContextMeterProps>) => {
    props = { ...props, ...p }
    s.setProps(props)
  }
  return { s, set, announced, onThreshold, said: () => announced.map((a) => a.message) }
}

describe("context meter state", () => {
  it("thresholds", () => {
    expect([50, 80, 96, 110].map((used) => contextMeterState({ used, max: 100 }))).toEqual([
      "ok",
      "warning",
      "full",
      "over",
    ])
    expect(contextMeterState({ used: 5, max: null })).toBe("unknown")
    expect(contextMeterState({ used: 5, max: 0 })).toBe("unknown")
  })
})

describe("context meter announcements", () => {
  it("a rising crossing is said once; the stream is silent", () => {
    const t = make()
    for (const used of [10, 80, 81, 82, 90]) t.set({ used })
    expect(t.said()).toEqual(["Context almost full"])
    expect(t.onThreshold).toHaveBeenCalledWith("warning")
  })

  it("mount is silent, even when already full", () => {
    const t = make({ used: 99 })
    expect(t.said()).toEqual([])
    t.set({ used: 110 })
    expect(t.said()).toEqual(["Context limit exceeded"])
  })

  it("falling back re-arms what lies above; a new resetKey re-arms all", () => {
    const t = make()
    t.set({ used: 80 })
    t.set({ used: 50 })
    t.set({ used: 80 })
    expect(t.said()).toEqual(["Context almost full", "Context almost full"])
    t.set({ used: 85 })
    t.set({ resetKey: "thread-2", used: 10 })
    t.set({ used: 80 })
    expect(t.said()).toHaveLength(3)
  })

  it("announce off still reports the crossing", () => {
    const t = make({ announce: "off" })
    t.set({ used: 96 })
    expect(t.said()).toEqual([])
    expect(t.onThreshold).toHaveBeenCalledWith("full")
  })
})

const api = (over: Partial<Parameters<typeof contextMeterConnect>[0]> = {}) =>
  contextMeterConnect({
    instance: "c",
    used: 21_400,
    max: 128_000,
    locale: "en-US",
    messages: contextMeterMessages,
    ids: { label: "l" },
    rendered: { label: false },
    ...over,
  })

const dataKeys = (p: Record<string, unknown>) =>
  Object.keys(p)
    .filter((k) => k.startsWith("data-") && p[k] !== undefined)
    .sort()

describe("context meter connect", () => {
  it("a meter with the usage in words", () => {
    const root = api().root()
    expect(root).toMatchObject({
      role: "meter",
      "aria-valuemin": "0",
      "aria-valuemax": "128000",
      "aria-valuenow": "21400",
      "aria-label": "Context used",
      "data-zone": "ok",
    })
    expect(root["aria-valuetext"]).toBe("21K of 128K tokens, 17%")
    expect(api().valueTextPart()["aria-hidden"]).toBe("true")
  })

  it("no meter role without a known size", () => {
    const a = api({ max: null })
    expect(a.root()["role"]).toBeUndefined()
    expect(a.valueText).toBe("21K tokens used")
  })

  it("over caps the bar and zones as full", () => {
    const a = api({ used: 140_000 })
    expect(a.percent).toBe(100)
    expect(a.root()["data-zone"]).toBe("full")
    expect(a.root()["data-state"]).toBe("over")
  })

  it("meta matches the code", () => {
    const a = api()
    const parts = {
      root: a.root(),
      label: a.label(),
      "value-text": a.valueTextPart(),
      track: a.track(),
      indicator: a.indicator(),
      breakdown: a.breakdown(),
      "breakdown-item": a.breakdownItem("system"),
    }
    for (const [part, props] of Object.entries(parts)) {
      const meta =
        contextMeterMeta.dataAttributes[part as keyof typeof contextMeterMeta.dataAttributes]
      expect(Object.keys(meta).sort(), part).toEqual(dataKeys(props))
    }
    expect(contextMeterMeta.contract.queries).toEqual(Object.keys(contextMeterContract.queries))
  })
})
