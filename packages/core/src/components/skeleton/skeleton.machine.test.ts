// The Skeleton machine with a recording announcer (add-skeleton 1.2, chakra-ui#2864).
import { describe, expect, it } from "vitest"
import type { Announcement } from "../../env"
import { createService } from "../../machine/service"
import { type SkeletonProps, skeletonMachine } from "./skeleton.machine"

function make(over: Partial<SkeletonProps> = {}) {
  const log: Announcement[] = []
  let prepared = 0
  let props: SkeletonProps = {
    messages: { loading: "Loading", loaded: "Loaded" },
    id: "s1",
    ...over,
  }
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
  const s = createService(skeletonMachine, props, env)
  s.start()
  const set = (loading: boolean) => {
    props = { ...props, loading }
    s.setProps(props)
  }
  return { s, log, set, prepared: () => prepared }
}

describe("skeleton machine", () => {
  it("starts in the state the prop says (default loading)", () => {
    expect(make().s.getSnapshot().state).toBe("loading")
    expect(make({ loading: false }).s.getSnapshot().state).toBe("loaded")
  })

  it("follows the prop both ways", () => {
    const { s, set } = make({ loading: true })
    set(false)
    expect(s.getSnapshot().state).toBe("loaded")
    set(true)
    expect(s.getSnapshot().state).toBe("loading")
  })

  it("never announces without announceOnLoad", () => {
    const { set, log, prepared } = make({ loading: true })
    set(false)
    set(true)
    set(false)
    expect(log).toEqual([])
    expect(prepared()).toBe(0)
  })

  it("announces messages.loaded once on loading → loaded with announceOnLoad", () => {
    const { set, log, prepared } = make({ loading: true, announceOnLoad: true })
    expect(prepared()).toBe(1)
    set(false)
    expect(log).toEqual([{ message: "Loaded", priority: "polite", key: "skeleton-s1" }])
  })

  it("announces the string, again on every reload, never on loaded → loading", () => {
    const { set, log } = make({ loading: true, announceOnLoad: "12 comments loaded" })
    set(false)
    set(true)
    expect(log).toHaveLength(1)
    set(false)
    expect(log.map((a) => a.message)).toEqual(["12 comments loaded", "12 comments loaded"])
  })

  it("does not announce when mounted loaded (chakra-ui#2864) or mounted loading", () => {
    expect(make({ loading: false, announceOnLoad: true }).log).toEqual([])
    expect(make({ loading: true, announceOnLoad: true }).log).toEqual([])
  })

  it("passes lang through", () => {
    const { set, log } = make({ loading: true, announceOnLoad: true, lang: "it" })
    set(false)
    expect(log[0]?.lang).toBe("it")
  })
})
