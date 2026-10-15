// The Tabs machine in Node (openspec add-tabs: selection, activation modes, initial and
// repaired selection, find-in-page, indicator and panel bookkeeping).
import { describe, expect, it, vi } from "vitest"
import { createListCollection } from "../../collection/list"
import { createService } from "../../machine/service"
import { type TabsEvent, type TabsProps, tabsMachine } from "./tabs.machine"

interface Item {
  readonly id: string
  readonly disabled?: boolean
}
const items = (...spec: (string | [string, boolean])[]): Item[] =>
  spec.map((s) => (typeof s === "string" ? { id: s } : { id: s[0], disabled: s[1] }))
const collectionOf = (list: Item[]) =>
  createListCollection<Item>({
    items: list,
    getKey: (i) => i.id,
    getText: (i) => i.id,
    isDisabled: (i) => i.disabled === true,
  })

/** `registered: false` starts with an empty collection, as React does before the tabs mount. */
function make(over: Partial<TabsProps> = {}, list: Item[] = items("a", "b", "c", "d")) {
  const onValueChange = vi.fn()
  let props: TabsProps = {
    collection: collectionOf(list),
    strategy: "roving",
    ids: { list: "l", item: (k) => `i-${k}` },
    loop: true,
    onValueChange,
    ...over,
  }
  const env = {
    dom: { getRootNode: () => document, getById: () => null, activeElement: () => null },
    clock: { now: () => 0 },
    layout: { pageTarget: () => null },
    locale: { locale: () => "en", dir: () => "ltr" },
    platform: {},
    announcer: { announce: () => {}, prepare: () => () => {}, cancel: () => {} },
    modality: {
      modality: () => "keyboard",
      subscribe: () => () => {},
      focusCause: () => "other",
      markFocus: () => {},
      unmarkFocus: () => {},
      recentFocus: () => [],
    },
  }
  const s = createService(tabsMachine, props as never, env as never)
  s.start()
  const send = (e: TabsEvent) => s.send(e as never)
  const setProps = (p: Partial<TabsProps>) => {
    props = { ...props, ...p }
    s.setProps(props as never)
  }
  return {
    send,
    setProps,
    /** Registers the real tabs after an empty start. */
    register: (l: Item[] = list) => setProps({ collection: collectionOf(l) }),
    value: () => (s.view().values as { value?: string | null }).value ?? null,
    ctx: () => s.view().context,
    highlighted: () => s.view().context.highlightedKey,
    state: () => s.view().state,
    focus: (key: string, modality: "keyboard" | "pointer" | "touch" | "virtual" = "keyboard") =>
      send({ type: "FOCUS", key, modality } as never),
    nav: (move: "next" | "previous" | "first" | "last") => send({ type: "NAVIGATE", move }),
    press: (key: string, modality: "pointer" | "touch" | "keyboard" | "virtual" = "pointer") =>
      send({ type: "PRESS", key, modality } as never),
    onValueChange,
  }
}
const reason = (m: ReturnType<typeof make>, call = 0) =>
  m.onValueChange.mock.calls[call]?.[1].reason

describe("focus never selects", () => {
  it("moves the highlight only, for every modality", () => {
    for (const modality of ["pointer", "touch", "keyboard", "virtual"] as const) {
      const m = make({ defaultValue: "a" })
      m.focus("c", modality)
      expect(m.highlighted(), modality).toBe("c")
      expect(m.value(), modality).toBe("a")
      expect(m.onValueChange, modality).not.toHaveBeenCalled()
    }
  })
})

describe("activation mode", () => {
  it("automatic: a keyboard move selects (reason NAVIGATE)", () => {
    const m = make({ defaultValue: "a" })
    m.focus("a")
    m.nav("next")
    expect(m.value()).toBe("b")
    expect(m.onValueChange).toHaveBeenCalledTimes(1)
    expect(reason(m)).toBe("NAVIGATE")
  })

  it("manual: a move only highlights; PRESS selects (reason PRESS)", () => {
    const m = make({ defaultValue: "a", activationMode: "manual" })
    m.focus("a")
    m.nav("next")
    expect(m.highlighted()).toBe("b")
    expect(m.value()).toBe("a")
    expect(m.onValueChange).not.toHaveBeenCalled()
    m.press("b", "keyboard")
    expect(m.value()).toBe("b")
    expect(reason(m)).toBe("PRESS")
  })
})

describe("initial selection", () => {
  it("picks the first enabled tab once, reason INITIAL", () => {
    const m = make({}, [])
    expect(m.value()).toBeNull()
    m.register(items("a", "b"))
    expect(m.value()).toBe("a")
    expect(m.onValueChange).toHaveBeenCalledTimes(1)
    expect(reason(m)).toBe("INITIAL")
  })

  it("skips a disabled first tab", () => {
    const m = make({}, [])
    m.register(items(["a", true], "b"))
    expect(m.value()).toBe("b")
    expect(m.onValueChange).toHaveBeenCalledTimes(1)
  })

  it("defaultValue: no callback on registration", () => {
    const m = make({ defaultValue: "b" }, [])
    m.register(items("a", "b", "c"))
    expect(m.value()).toBe("b")
    expect(m.onValueChange).not.toHaveBeenCalled()
  })

  it("controlled null stays null without a callback", () => {
    const m = make({ value: null }, [])
    m.register(items("a", "b"))
    expect(m.value()).toBeNull()
    expect(m.onValueChange).not.toHaveBeenCalled()
  })
})

describe("collection repair", () => {
  it("a removed selected tab falls to the next one (COLLECTION.CHANGE)", () => {
    const m = make({ defaultValue: "c" })
    m.setProps({ collection: collectionOf(items("a", "b", "d")) })
    expect(m.value()).toBe("d")
    expect(m.onValueChange).toHaveBeenCalledTimes(1)
    expect(reason(m)).toBe("COLLECTION.CHANGE")
  })
})

describe("disabled", () => {
  it("PRESS never selects a disabled tab", () => {
    const m = make({ defaultValue: "a" }, items("a", ["b", true], "c"))
    m.press("b")
    expect(m.value()).toBe("a")
    expect(m.onValueChange).not.toHaveBeenCalled()
  })

  it("all tabs disabled: nothing selected and NAVIGATE terminates", () => {
    const m = make({}, [])
    m.register(items(["a", true], ["b", true]))
    expect(m.value()).toBeNull()
    m.focus("a")
    m.nav("next")
    m.nav("last")
    expect(m.value()).toBeNull()
    expect(m.onValueChange).not.toHaveBeenCalled()
  })
})

describe("direction", () => {
  it("is previous going backwards and next going forwards", () => {
    const m = make({ defaultValue: "c" })
    m.press("a")
    expect(m.ctx().direction).toBe("previous")
    m.press("b")
    expect(m.ctx().direction).toBe("next")
  })
})

describe("roving stop", () => {
  it("BLUR clears the highlight, also after a controlled value change", () => {
    const m = make({ value: "a" })
    m.focus("c")
    m.send({ type: "BLUR" })
    m.setProps({ value: "b" })
    expect(m.state()).toBe("idle")
    expect(m.highlighted()).toBeNull()
    expect(m.value()).toBe("b")
  })
})

describe("find-in-page", () => {
  it("selects with its own reason and reveals; a later PRESS clears it", () => {
    const m = make({ defaultValue: "a" })
    m.send({ type: "find-in-page", key: "c" } as never)
    expect(m.value()).toBe("c")
    expect(reason(m)).toBe("find-in-page")
    expect(m.ctx().revealed).toBe("c")
    m.press("b")
    expect(m.ctx().revealed).toBeNull()
  })
})

describe("bookkeeping", () => {
  it("PANEL.TABBABLE updates the map", () => {
    const m = make()
    m.send({ type: "PANEL.TABBABLE", key: "a", tabbable: true } as never)
    expect(m.ctx().panelTabbable).toEqual({ a: true })
    m.send({ type: "PANEL.TABBABLE", key: "a", tabbable: false } as never)
    expect(m.ctx().panelTabbable).toEqual({ a: false })
  })

  it("INDICATOR.MEASURE sets and clears the indicator", () => {
    const m = make()
    const box = { x: 1, y: 2, width: 3, height: 4 }
    m.send({ type: "INDICATOR.MEASURE", box, cause: "selection" } as never)
    expect(m.ctx().indicator).toEqual({ box, cause: "selection" })
    m.send({ type: "INDICATOR.MEASURE", box: null, cause: "selection" } as never)
    expect(m.ctx().indicator).toBeNull()
  })
})
