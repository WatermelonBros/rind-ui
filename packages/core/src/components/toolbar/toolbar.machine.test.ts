// The Toolbar machine in Node (openspec add-toolbar: roving focus without selection, focus
// memory after BLUR, repair of the tab stop, programmatic FOCUS_TOOLBAR).
import { describe, expect, it, vi } from "vitest"
import { tabStop } from "../../collection/composite"
import type { CollectionKey } from "../../collection/key"
import { createListCollection } from "../../collection/list"
import { createService } from "../../machine/service"
import { type ToolbarEvent, type ToolbarProps, toolbarMachine } from "./toolbar.machine"

interface Item {
  readonly id: string
  /** Not navigable (disabled and not focusable when disabled): registered as skipped. */
  readonly skip?: boolean
}
const items = (...spec: (string | [string, boolean])[]): Item[] =>
  spec.map((s) => (typeof s === "string" ? { id: s } : { id: s[0], skip: s[1] }))
const collectionOf = (list: Item[]) =>
  createListCollection<Item>({
    items: list,
    getKey: (i) => i.id,
    getText: (i) => i.id,
    isDisabled: (i) => i.skip === true,
  })

function make(over: Partial<ToolbarProps> = {}, list: Item[] = items("a", "b", "c", "d")) {
  let active: { id: string; ownerDocument: unknown } | null = null
  const focused: string[] = []
  const marks: [string, string][] = []
  // Fake elements: focus() records and becomes the active element.
  const elements = new Map<string, unknown>()
  const element = (id: string) => {
    let el = elements.get(id)
    if (!el) {
      el = {
        id,
        ownerDocument: { body: null as unknown },
        contains: (o: { id: string } | null) => o !== null && o.id === id,
        focus: () => {
          focused.push(id)
          active = el as never
        },
      }
      ;(el as { ownerDocument: { body: unknown } }).ownerDocument.body = body
      elements.set(id, el)
    }
    return el
  }
  let props: ToolbarProps = {
    collection: collectionOf(list),
    strategy: "roving",
    ids: { list: "root", item: (k: CollectionKey) => k as string },
    loop: true,
    ...over,
  }
  const body = { id: "body", ownerDocument: null as unknown }
  body.ownerDocument = { body }
  const present = new Set<string>(["root", ...list.map((i) => i.id)])
  const env = {
    dom: {
      getRootNode: () => document,
      getById: (id: string) => (present.has(id) ? element(id) : null),
      activeElement: () => active,
    },
    clock: { now: () => 0 },
    layout: { pageTarget: () => null },
    locale: { locale: () => "en", dir: () => "ltr" },
    platform: {},
    announcer: { announce: vi.fn(), prepare: () => () => {}, cancel: () => {} },
    modality: {
      modality: () => "keyboard",
      subscribe: () => () => {},
      focusCause: () => "other",
      markFocus: (el: { id: string }, cause: string) => marks.push([el.id, cause]),
      unmarkFocus: () => {},
      recentFocus: () => [],
    },
  }
  const s = createService(toolbarMachine, props as never, env as never)
  s.start()
  const send = (e: ToolbarEvent) => s.send(e as never)
  const m = {
    send,
    focused,
    marks,
    env,
    announcer: env.announcer,
    state: () => s.view().state as string,
    highlighted: () => s.view().context.highlightedKey as string | null,
    stop: () =>
      tabStop({
        collection: props.collection,
        highlightedKey: s.view().context.highlightedKey,
        highlightSource: null,
        selection: new Set(),
        selectionMode: "none",
      }) as string | null,
    /** The browser focuses a control (a focus event reaches the machine). */
    focus: (key: string, modality: "keyboard" | "pointer" | "touch" | "virtual" = "keyboard") => {
      active = element(key) as never
      send({ type: "FOCUS", key: key as CollectionKey, modality })
    },
    nav: (move: "next" | "previous" | "first" | "last") => send({ type: "NAVIGATE", move }),
    /** The collection changes; `gone` elements leave the DOM (focus falls to <body>). */
    change: (l: Item[], gone: string[] = []) => {
      for (const g of gone) {
        present.delete(g)
        if (active?.id === g) active = body
      }
      for (const i of l) if (!gone.includes(i.id)) present.add(i.id)
      props = { ...props, collection: collectionOf(l) }
      s.setProps(props as never)
    },
    ctx: () => s.view().context,
  }
  return m
}

describe("states", () => {
  it("starts idle with no highlight", () => {
    const m = make()
    expect(m.state()).toBe("idle")
    expect(m.highlighted()).toBeNull()
  })
  it("FOCUS enters focused and highlights; never selects or commits", () => {
    const m = make()
    m.focus("c")
    expect(m.state()).toBe("focused")
    expect(m.highlighted()).toBe("c")
  })
  it("FOCUS of an unknown key does not highlight", () => {
    const m = make()
    m.focus("zz")
    expect(m.highlighted()).toBeNull()
  })
  it("FOCUS inside focused only moves the highlight", () => {
    const m = make()
    m.focus("a")
    m.focus("c")
    expect(m.state()).toBe("focused")
    expect(m.highlighted()).toBe("c")
  })
  it("pointer and touch focus set the pointer source, keyboard and virtual the keyboard one", () => {
    const m = make()
    for (const [modality, source] of [
      ["pointer", "pointer"],
      ["touch", "pointer"],
      ["keyboard", "keyboard"],
      ["virtual", "keyboard"],
    ] as const) {
      m.focus("b", modality)
      expect(m.ctx().highlightSource).toBe(source)
    }
  })
})

describe("NAVIGATE", () => {
  it("moves the highlight and focuses the control", () => {
    const m = make()
    m.focus("a")
    m.nav("next")
    expect(m.highlighted()).toBe("b")
    expect(m.focused).toEqual(["b"])
    m.nav("previous")
    expect(m.highlighted()).toBe("a")
  })
  it("first and last", () => {
    const m = make()
    m.focus("b")
    m.nav("last")
    expect(m.highlighted()).toBe("d")
    m.nav("first")
    expect(m.highlighted()).toBe("a")
  })
  it("wraps with loop (default)", () => {
    const m = make()
    m.focus("d")
    m.nav("next")
    expect(m.highlighted()).toBe("a")
    m.nav("previous")
    expect(m.highlighted()).toBe("d")
  })
  it("stops at the ends with loop false", () => {
    const m = make({ loop: false })
    m.focus("d")
    m.nav("next")
    expect(m.highlighted()).toBe("d")
    m.focus("a")
    m.nav("previous")
    expect(m.highlighted()).toBe("a")
  })
  it("skips controls registered as skipped, and all-skipped stays put", () => {
    const m = make({}, items("a", ["b", true], "c"))
    m.focus("a")
    m.nav("next")
    expect(m.highlighted()).toBe("c")
    const all = make({}, items(["a", true], ["b", true]))
    all.focus("a") // a skipped control can still hold DOM focus; nothing else to move to
    all.nav("next")
    expect(all.highlighted()).toBe("a")
  })
  it("is ignored while idle", () => {
    const m = make()
    m.nav("next")
    expect(m.highlighted()).toBeNull()
    expect(m.focused).toEqual([])
  })
  it("makes no announcement and has no typeahead", () => {
    const m = make()
    m.focus("a")
    m.nav("next")
    m.nav("last")
    expect(m.announcer.announce).not.toHaveBeenCalled()
  })
})

describe("focus memory after BLUR", () => {
  it("BLUR goes idle and keeps the highlight", () => {
    const m = make()
    m.focus("a")
    m.nav("next")
    m.nav("next")
    m.send({ type: "BLUR" })
    expect(m.state()).toBe("idle")
    expect(m.highlighted()).toBe("c")
  })
  it("the tab stop is the remembered control, else the first", () => {
    const m = make()
    expect(m.stop()).toBe("a")
    m.focus("c")
    m.send({ type: "BLUR" })
    expect(m.stop()).toBe("c")
  })
  it("re-entry at the remembered control keeps the highlight", () => {
    const m = make()
    m.focus("b")
    m.send({ type: "BLUR" })
    m.focus("b")
    expect(m.state()).toBe("focused")
    expect(m.highlighted()).toBe("b")
  })
  it("NAVIGATE and BLUR are ignored while idle", () => {
    const m = make()
    m.send({ type: "BLUR" })
    expect(m.state()).toBe("idle")
  })
})

describe("repair (ariakit#3232, #7359)", () => {
  it("idle: the remembered control disabled-and-skipped → the next navigable is the stop", () => {
    const m = make()
    m.focus("a")
    m.send({ type: "BLUR" })
    m.change(items(["a", true], "b", "c", "d"))
    expect(m.stop()).toBe("b")
    expect(m.highlighted()).toBe("b")
  })
  it("idle: the first control disabled before any focus → first enabled is the stop", () => {
    const m = make({}, items("a", "b"))
    m.change(items(["a", true], "b"))
    expect(m.stop()).toBe("b")
  })
  it("idle: the remembered control removed → exactly one stop remains", () => {
    const m = make()
    m.focus("c")
    m.send({ type: "BLUR" })
    m.change(items("a", "b", "d"), ["c"])
    const stop = m.stop()
    expect(stop).not.toBeNull()
    expect(["a", "b", "d"]).toContain(stop)
    expect(m.state()).toBe("idle")
  })
  it("focused on a control that becomes skipped: highlight repairs and focus stays inside", () => {
    const m = make()
    m.focus("b")
    m.change(items("a", ["b", true], "c", "d"))
    expect(m.highlighted()).not.toBe("b")
    expect(m.highlighted()).not.toBeNull()
    expect(m.state()).toBe("focused")
  })
  it("focused control removed: focus follows the repaired highlight, never <body>", () => {
    const m = make()
    m.focus("b")
    m.change(items("a", "c", "d"), ["b"])
    const key = m.highlighted()
    expect(key).not.toBeNull()
    expect(m.focused.at(-1)).toBe(key)
  })
  it("a focused control that stays navigable keeps the highlight and focus", () => {
    const m = make()
    m.focus("b")
    m.change(items("a", "b", "c", "d", "e"))
    expect(m.highlighted()).toBe("b")
    expect(m.focused).toEqual([])
  })
  it("controls added after an empty start (React registers on mount)", () => {
    const m = make({}, [])
    expect(m.stop()).toBeNull()
    m.change(items("a", "b"))
    expect(m.stop()).toBe("a")
  })
})

describe("FOCUS_TOOLBAR", () => {
  it("focuses the tab stop with the programmatic source and highlights it", () => {
    const m = make()
    m.send({ type: "FOCUS_TOOLBAR" })
    expect(m.focused).toEqual(["a"])
    expect(m.marks).toEqual([["a", "programmatic"]])
    expect(m.highlighted()).toBe("a")
  })
  it("focuses the remembered control after BLUR", () => {
    const m = make()
    m.focus("c")
    m.send({ type: "BLUR" })
    m.send({ type: "FOCUS_TOOLBAR" })
    expect(m.focused).toEqual(["c"])
  })
  it("skips a skipped first control", () => {
    const m = make({}, items(["a", true], "b"))
    m.send({ type: "FOCUS_TOOLBAR" })
    expect(m.focused).toEqual(["b"])
  })
  it("does nothing without controls", () => {
    const m = make({}, [])
    m.send({ type: "FOCUS_TOOLBAR" })
    expect(m.focused).toEqual([])
  })
  it("does nothing when the element is not in the DOM", () => {
    const m = make()
    m.change(items("a", "b", "c", "d"), ["a"])
    m.send({ type: "FOCUS_TOOLBAR" })
    expect(m.focused).toEqual([])
  })
  it("works while focused as well", () => {
    const m = make()
    m.focus("b")
    m.send({ type: "FOCUS_TOOLBAR" })
    expect(m.focused).toEqual(["b"])
  })
})
