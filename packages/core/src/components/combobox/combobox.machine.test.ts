// The Combobox machine in Node: commit rules, open reasons, Enter/Escape/Tab, inline
// completion, IME, multiple. The harness recomputes the results like the adapter does.
import { describe, expect, it, vi } from "vitest"
import { toKey } from "../../collection/key"
import { createListCollection } from "../../collection/list"
import { platforms } from "../../dom/platform"
import { createService } from "../../machine/service"
import { type ComboboxProps, type ComboboxValue, comboboxMachine } from "./combobox.machine"
import { comboboxMessages } from "./combobox.messages"
import { patternQuery, patternResults } from "./pattern/pattern"

const FRUITS = ["Apple", "Apricot", "Banana", "Cherry", "Grape"]
const items = createListCollection({
  items: FRUITS.map((label) => ({ id: label.toLowerCase(), label })),
  getKey: (r) => r.id,
  getText: (r) => r.label,
  isDisabled: (r) => r.id === "grape",
})
const announce = vi.fn()
const env = {
  dom: { getRootNode: () => undefined, getById: () => null, activeElement: () => null },
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

type Over = Partial<Omit<ComboboxProps, "collection" | "items">>

function make(over: Over = {}) {
  const onValueChange = vi.fn()
  const onInputValueChange = vi.fn()
  const onOpenChange = vi.fn()
  const base = {
    items,
    collection: items,
    strategy: "active-descendant",
    ids: { list: "list", item: (k: string) => `item-${k}` },
    selectionMode: "single",
    locale: "en",
    messages: comboboxMessages,
    root: "r",
    onValueChange,
    onInputValueChange,
    onOpenChange,
    ...over,
  } as unknown as ComboboxProps
  let current = base
  let lastQuery = ""
  const s = createService(comboboxMachine, base as never, env as never)
  s.start()
  // The adapter's derivation: results of the current query.
  const sync = () => {
    const snap = s.getSnapshot()
    const v = s.view().values
    const query = patternQuery({
      inputValue: v.inputValue as string,
      dirty: snap.context.dirty,
      openReason: snap.context.openReason,
    })
    if (query === lastQuery) return
    lastQuery = query
    current = { ...current, collection: patternResults(items, query, undefined, "en") }
    s.setProps(current as never)
  }
  const send = (e: Parameters<typeof s.send>[0]) => {
    s.send(e)
    sync()
  }
  const type = (text: string, o: { caretAtEnd?: boolean; inputType?: string } = {}) =>
    send({
      type: "INPUT.CHANGE",
      text,
      inputType: o.inputType ?? "insertText",
      composing: false,
      caretAtEnd: o.caretAtEnd ?? true,
    })
  return {
    s,
    send,
    type,
    onValueChange,
    onInputValueChange,
    value: () => s.view().values.value as ComboboxValue,
    text: () => s.view().values.inputValue as string,
    open: () => s.view().values.open as boolean,
    highlighted: () => s.getSnapshot().context.highlightedKey,
    completion: () => s.getSnapshot().context.completion,
    focus: () => send({ type: "INPUT.FOCUS", modality: "keyboard", cause: "key" }),
    blur: () => send({ type: "INPUT.BLUR" }),
    down: (alt = false) => send({ type: "ARROW", key: "NEXT", alt, composing: false }),
    up: () => send({ type: "ARROW", key: "PREV", alt: false, composing: false }),
    enter: () => send({ type: "ENTER", composing: false }),
    escape: () => send({ type: "ESCAPE", composing: false }),
    tab: () => send({ type: "TAB", composing: false }),
    choose: (k: string) => send({ type: "ITEM.CHOOSE", key: toKey(k), modality: "pointer" }),
    results: () => [...current.collection].map((n) => n.key),
    setProps: (p: Over) => {
      current = { ...current, ...p } as ComboboxProps
      s.setProps(current as never)
    },
  }
}

describe("Combobox machine", () => {
  it("typing opens, filters and clears the highlight", () => {
    const m = make()
    m.focus()
    m.type("ap")
    expect(m.open()).toBe(true)
    expect(m.results()).toEqual(["apple", "apricot", "grape"])
    expect(m.highlighted()).toBe(null)
  })

  it("ArrowDown on a closed combobox opens on the first option; Alt+ArrowDown opens only", () => {
    const m = make()
    m.focus()
    m.down()
    expect(m.open()).toBe(true)
    expect(m.highlighted()).toBe("apple")
    const n = make()
    n.focus()
    n.down(true)
    expect(n.open()).toBe(true)
    expect(n.highlighted()).toBe(null)
  })

  it("an arrow open shows every option, also with a selection's text in the input", () => {
    const m = make({ defaultValue: "cherry" })
    expect(m.text()).toBe("Cherry")
    m.focus()
    m.down()
    expect(m.results().length).toBe(FRUITS.length)
    // The selected option is the entry highlight.
    expect(m.highlighted()).toBe("cherry")
  })

  it("Enter chooses the highlighted option, sets its text and closes", () => {
    const m = make()
    m.focus()
    m.type("ban")
    m.down()
    m.enter()
    expect(m.value()).toBe("banana")
    expect(m.text()).toBe("Banana")
    expect(m.open()).toBe(false)
    expect(m.onValueChange).toHaveBeenCalledTimes(1)
  })

  it("an exact typed match commits on blur (case-insensitive)", () => {
    const m = make()
    m.focus()
    m.type("cherry")
    m.blur()
    expect(m.value()).toBe("cherry")
    expect(m.text()).toBe("Cherry")
  })

  it("a non-matching text reverts to the selection without custom values", () => {
    const m = make({ defaultValue: "apple" })
    m.focus()
    m.type("zzz")
    m.blur()
    expect(m.value()).toBe("apple")
    expect(m.text()).toBe("Apple")
    expect(m.onValueChange).not.toHaveBeenCalled()
  })

  it("allowCustomValue keeps the text and clears the value", () => {
    const m = make({ defaultValue: "apple", allowCustomValue: true })
    m.focus()
    m.type("zzz")
    m.tab()
    expect(m.text()).toBe("zzz")
    expect(m.value()).toBe(null)
  })

  it("emptying the text clears the selection, unless empty selection is disallowed", () => {
    const m = make({ defaultValue: "apple" })
    m.focus()
    m.type("")
    m.blur()
    expect(m.value()).toBe(null)
    const n = make({ defaultValue: "apple", disallowEmptySelection: true })
    n.focus()
    n.type("")
    n.blur()
    expect(n.value()).toBe("apple")
    expect(n.text()).toBe("Apple")
  })

  it("Escape closes and reverts; Escape on a closed clean combobox does nothing", () => {
    const m = make({ defaultValue: "apple" })
    m.focus()
    m.type("ba")
    m.escape()
    expect(m.open()).toBe(false)
    expect(m.text()).toBe("Apple")
    m.onInputValueChange.mockClear()
    m.escape()
    expect(m.onInputValueChange).not.toHaveBeenCalled()
  })

  it("a disabled option is never chosen", () => {
    const m = make()
    m.focus()
    m.down()
    m.choose("grape")
    expect(m.value()).toBe(null)
  })

  it("autoHighlight highlights the first typing result; Enter chooses it", () => {
    const m = make({ autoHighlight: true })
    m.focus()
    m.type("ch")
    expect(m.highlighted()).toBe("cherry")
    m.enter()
    expect(m.value()).toBe("cherry")
  })

  it("autoComplete both completes the highlighted option inline, only typing forward", () => {
    const m = make({ autoComplete: "both", autoHighlight: true })
    m.focus()
    m.type("apr")
    m.down()
    expect(m.highlighted()).toBe("apricot")
    expect(m.completion()).toBe("apricot")
    m.escape()
    // First Escape removes the completion and stays open.
    expect(m.completion()).toBe(null)
    expect(m.open()).toBe(true)
    m.type("ap", { inputType: "deleteContentBackward" })
    m.down()
    expect(m.completion()).toBe(null)
  })

  it("a composition never commits, opens or navigates", () => {
    const m = make()
    m.focus()
    m.send({ type: "COMPOSITION.START" })
    m.send({
      type: "INPUT.CHANGE",
      text: "a",
      inputType: "insertCompositionText",
      composing: true,
      caretAtEnd: true,
    })
    expect(m.open()).toBe(false)
    m.send({ type: "ENTER", composing: true })
    m.send({ type: "ARROW", key: "NEXT", alt: false, composing: true })
    expect(m.open()).toBe(false)
    expect(m.value()).toBe(null)
    m.send({ type: "COMPOSITION.END", text: "ap" })
    expect(m.open()).toBe(true)
    expect(m.text()).toBe("ap")
  })

  it("Tab chooses the highlight only with selectOnTab", () => {
    const m = make()
    m.focus()
    m.down()
    m.tab()
    expect(m.value()).toBe(null)
    expect(m.open()).toBe(false)
    const n = make({ selectOnTab: true })
    n.focus()
    n.down()
    n.tab()
    expect(n.value()).toBe("apple")
  })

  it("multiple: choices toggle, keep open, clear the text", () => {
    const m = make({ selectionMode: "multiple" })
    m.focus()
    m.type("a")
    m.choose("apple")
    m.choose("banana")
    expect(m.value()).toEqual(["apple", "banana"])
    expect(m.open()).toBe(true)
    expect(m.text()).toBe("")
    m.choose("apple")
    expect(m.value()).toEqual(["banana"])
  })

  it("count and no-results are announced politely under one key", () => {
    announce.mockClear()
    const m = make()
    m.focus()
    m.type("zz")
    expect(announce).toHaveBeenLastCalledWith(
      expect.objectContaining({ message: "No results", key: "combobox-count:r" }),
    )
  })

  it("readOnly opens on arrows but never commits typing", () => {
    const m = make({ readOnly: true, defaultValue: "apple" })
    m.focus()
    m.type("zzz")
    expect(m.text()).toBe("Apple")
    m.down()
    expect(m.open()).toBe(true)
    m.enter()
    expect(m.value()).toBe("apple")
  })

  it("a controlled value change updates the text when not dirty", () => {
    const m = make({ value: "apple" })
    expect(m.text()).toBe("Apple")
    m.setProps({ value: "cherry" })
    expect(m.text()).toBe("Cherry")
  })
})
