// The Tag Group machine in Node (tasks 1.3): removal sets, disabled exclusion, refused removal,
// activation precedence, announcements with a recording announcer, repair over disabled runs.
import { describe, expect, it, vi } from "vitest"
import { type CollectionKey, toKey } from "../../collection/key"
import { createListCollection } from "../../collection/list"
import { platforms } from "../../dom/platform"
import { createService } from "../../machine/service"
import { type TagGroupProps, type TagGroupValue, tagGroupMachine } from "./tag-group.machine"

type Tag = { readonly id: string; readonly disabled?: boolean }
const tags = (...items: (string | Tag)[]) =>
  createListCollection({
    items: items.map((t) => (typeof t === "string" ? { id: t } : t)),
    getKey: (t) => t.id,
    getText: (t) => t.id,
    isDisabled: (t) => t.disabled === true,
  })

const announce = vi.fn()
const env = {
  dom: { getRootNode: () => document, getById: () => null, activeElement: () => null },
  clock: { now: () => 0 },
  layout: { pageTarget: () => null },
  locale: { locale: () => "en", dir: () => "ltr" },
  platform: platforms.linux,
  announcer: { announce, prepare: () => () => {}, cancel: () => {} },
  modality: {
    modality: () => "keyboard",
    subscribe: () => () => {},
    focusCause: () => "other",
    markFocus: () => {},
    unmarkFocus: () => {},
    recentFocus: () => [],
  },
}

function make(over: Partial<TagGroupProps> = {}, data = tags("a", "b", "c")) {
  announce.mockClear()
  const onRemove = vi.fn()
  const onValueChange = vi.fn()
  const props: TagGroupProps = {
    collection: data,
    strategy: "roving",
    ids: { list: "list", item: (k) => `item-${k}` },
    instance: "t",
    focusableWhenDisabled: true,
    loop: true,
    onRemove,
    onValueChange,
    ...over,
  }
  const s = createService(tagGroupMachine, props as never, env as never)
  s.start()
  const send = (e: Parameters<typeof s.send>[0]) => s.send(e)
  let current = props
  return {
    s,
    onRemove,
    onValueChange,
    value: () => s.view().values.value as TagGroupValue,
    highlighted: () => s.getSnapshot().context.highlightedKey,
    focus: () => send({ type: "FOCUS", modality: "keyboard" }),
    remove: (key: string, via: "delete" | "backspace" | "button" = "delete") =>
      send({ type: "REMOVE", key: toKey(key), via }),
    activate: (key: string, via: "enter" | "space" | "press" = "enter") =>
      send({
        type: "ACTIVATE",
        key: toKey(key),
        modality: via === "press" ? "pointer" : "keyboard",
        via,
      }),
    /** The consumer's data after a removal: a new collection. */
    setData: (collection: TagGroupProps["collection"]) => {
      current = { ...current, collection }
      s.setProps(current as never)
    },
    setValue: (value: TagGroupValue) => {
      current = { ...current, value }
      s.setProps(current as never)
    },
  }
}
const keysOf = (fn: ReturnType<typeof vi.fn>, call = 0) =>
  (fn.mock.calls[call]?.[0] as readonly CollectionKey[] | undefined) ?? []

describe("removal", () => {
  it("Delete and Backspace request the same key (zag#1911)", () => {
    for (const via of ["delete", "backspace"] as const) {
      const m = make()
      m.focus()
      m.remove("b", via)
      expect(keysOf(m.onRemove)).toEqual(["b"])
      expect(m.onRemove.mock.calls[0]?.[1]).toEqual({ reason: via })
    }
  })

  it("a selected tag removes the selection; deselected once the rows are gone", () => {
    const m = make({ selectionMode: "multiple", defaultValue: ["a", "c"] })
    m.focus()
    m.remove("c")
    expect([...keysOf(m.onRemove)].sort()).toEqual(["a", "c"])
    // Still selected until the consumer's data drops them.
    expect(m.value()).toEqual(["a", "c"])
    m.setData(tags("b"))
    expect(m.value()).toEqual([])
  })

  it("a refused removal keeps the selection (uncontrolled)", () => {
    const m = make({ selectionMode: "multiple", defaultValue: ["a", "c"] })
    m.focus()
    m.remove("c")
    m.setData(tags("a", "b", "c"))
    expect(m.value()).toEqual(["a", "c"])
  })

  it("a disabled tag is never part of a removal (reka-ui#2785)", () => {
    const m = make(
      { selectionMode: "multiple", defaultValue: ["a", "b"] },
      tags({ id: "a", disabled: true }, "b", "c"),
    )
    m.focus()
    m.remove("b", "backspace")
    expect(keysOf(m.onRemove)).toEqual(["b"])
  })

  it("a disabled tag or group requests nothing", () => {
    const m = make({}, tags({ id: "a", disabled: true }, "b"))
    m.remove("a")
    expect(m.onRemove).not.toHaveBeenCalled()
    const g = make({ disabled: true })
    g.remove("a")
    expect(g.onRemove).not.toHaveBeenCalled()
  })

  it("the button removes its tag only, even when it is selected", () => {
    const m = make({ selectionMode: "multiple", defaultValue: ["a", "b"] })
    m.remove("b", "button")
    expect(keysOf(m.onRemove)).toEqual(["b"])
    expect(m.highlighted()).toBe("b")
    m.setData(tags("a", "c"))
    expect(m.value()).toEqual(["a"])
  })

  it("removal announces once the keys leave the collection: one tag", () => {
    const m = make()
    m.focus()
    m.remove("b")
    expect(announce).not.toHaveBeenCalled()
    m.setData(tags("a", "c"))
    expect(announce).toHaveBeenCalledTimes(1)
    expect(announce.mock.calls[0]?.[0]).toMatchObject({ message: "b removed", priority: "polite" })
  })

  it("several tags: one count announcement", () => {
    const m = make({ selectionMode: "multiple", defaultValue: ["a", "b", "c"] })
    m.focus()
    m.remove("a")
    m.setData(tags())
    expect(announce).toHaveBeenCalledTimes(1)
    expect(announce.mock.calls[0]?.[0]).toMatchObject({ message: "3 tags removed" })
  })

  it("a refused removal announces nothing, and a later change does not either", () => {
    const m = make()
    m.focus()
    m.remove("b")
    m.setData(tags("a", "b", "c"))
    m.setData(tags("a", "b", "c", "d"))
    expect(announce).not.toHaveBeenCalled()
  })
})

describe("focus repair", () => {
  it("the removed tag's highlight moves to the next one", () => {
    const m = make()
    m.focus()
    m.remove("b", "button")
    m.setData(tags("a", "c"))
    expect(m.highlighted()).toBe("c")
  })

  it("the last tag: the nearest before it, over disabled-but-focusable tags (RS#6616)", () => {
    const m = make({}, tags("a", { id: "b", disabled: true }, { id: "c", disabled: true }, "d"))
    m.focus()
    m.remove("d", "button")
    m.setData(tags("a", { id: "b", disabled: true }, { id: "c", disabled: true }))
    expect(m.highlighted()).toBe("c")
  })

  it("the only tag: no highlight (focus goes to the List)", () => {
    const m = make({}, tags("a"))
    m.focus()
    m.remove("a")
    m.setData(tags())
    expect(m.highlighted()).toBeNull()
  })
})

describe("activation precedence", () => {
  it("Enter removes a remove-only tag (RS#7483); a press never removes", () => {
    const m = make()
    m.focus()
    m.activate("a", "enter")
    expect(keysOf(m.onRemove)).toEqual(["a"])
    m.activate("b", "press")
    expect(m.onRemove).toHaveBeenCalledTimes(1)
  })

  it("Enter and Space toggle a selectable tag and never remove", () => {
    const m = make({ selectionMode: "multiple", defaultValue: [] })
    m.focus()
    m.activate("a", "space")
    m.activate("c", "enter")
    expect(m.value()).toEqual(["a", "c"])
    m.activate("a", "press")
    expect(m.value()).toEqual(["c"])
    expect(m.onRemove).not.toHaveBeenCalled()
  })

  it("an action wins over selection and removal (RS#9205)", () => {
    const onAction = vi.fn()
    const m = make({ selectionMode: "multiple", defaultValue: [], onAction })
    m.focus()
    m.activate("b", "enter")
    expect(onAction).toHaveBeenCalledWith("b", { modality: "keyboard", via: "enter" })
    expect(m.value()).toEqual([])
    expect(m.onRemove).not.toHaveBeenCalled()
  })

  it("a link wins over everything: no action, no selection", () => {
    const onAction = vi.fn()
    const m = make({
      selectionMode: "multiple",
      defaultValue: [],
      onAction,
      links: new Set([toKey("a")]),
    })
    m.focus()
    m.activate("a", "enter")
    expect(onAction).not.toHaveBeenCalled()
    expect(m.value()).toEqual([])
  })

  it("a disabled tag is never activated", () => {
    const onAction = vi.fn()
    const m = make({ onAction }, tags({ id: "a", disabled: true }))
    m.activate("a", "enter")
    expect(onAction).not.toHaveBeenCalled()
  })
})

describe("selection", () => {
  it("single mode holds one key; a parent's equal array is not a change", () => {
    const m = make({ selectionMode: "single", defaultValue: null })
    m.focus()
    m.activate("a", "space")
    m.activate("b", "space")
    expect(m.value()).toBe("b")
    const c = make({ selectionMode: "multiple", value: ["a", "b"] })
    c.setValue(["b", "a"])
    expect(c.onValueChange).not.toHaveBeenCalled()
  })
})
