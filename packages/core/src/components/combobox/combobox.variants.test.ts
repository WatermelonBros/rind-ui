// The Combobox variants in Node (add-combobox-variants): the inline machine (a command palette)
// and free text (an autocomplete). The harness recomputes the results like the adapter does.
import { describe, expect, it, vi } from "vitest"
import { toKey } from "../../collection/key"
import { type Collection, createListCollection } from "../../collection/list"
import { platforms } from "../../dom/platform"
import { createService } from "../../machine/service"
import { type ComboboxProps, comboboxMachine, inlineComboboxMachine } from "./combobox.machine"
import { comboboxMessages } from "./combobox.messages"
import { patternQuery, patternResults } from "./pattern/pattern"

const COMMANDS = ["New file", "Open recent", "Save", "Settings", "Toggle theme"]
const build = (labels: readonly string[]) =>
  createListCollection({
    items: labels.map((label) => ({ id: label.toLowerCase().replace(/ /g, "-"), label })),
    getKey: (r) => r.id,
    getText: (r) => r.label,
    isDisabled: (r) => r.id === "save",
  })
const items = build(COMMANDS)

function make(inline: boolean, over: Partial<ComboboxProps> = {}) {
  const announce = vi.fn()
  const timers: (() => void)[] = []
  const env = {
    scheduler: { setTimeout: (f: () => void) => timers.push(f), clearTimeout: () => {} },
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
  const onAction = vi.fn()
  const onValueChange = vi.fn()
  const onInputValueChange = vi.fn()
  let all: Collection<unknown> = items
  let current = {
    items,
    collection: items,
    strategy: "active-descendant",
    ids: { list: "list", item: (k: string) => `item-${k}` },
    selectionMode: "none",
    locale: "en",
    messages: comboboxMessages,
    root: "r",
    onAction,
    onValueChange,
    onInputValueChange,
    ...(inline ? { autoHighlight: true, keepHighlight: true } : {}),
    ...over,
  } as unknown as ComboboxProps
  let lastQuery = ""
  const machine = (inline ? inlineComboboxMachine : comboboxMachine) as typeof comboboxMachine
  const s = createService(machine, current as never, env as never)
  s.start()
  const sync = (force = false) => {
    const snap = s.getSnapshot()
    const v = s.view().values
    const query = patternQuery({
      inputValue: v.inputValue as string,
      dirty: snap.context.dirty,
      openReason: snap.context.openReason,
    })
    if (query === lastQuery && !force) return
    lastQuery = query
    current = { ...current, items: all, collection: patternResults(all, query, undefined, "en") }
    s.setProps(current as never)
  }
  const send = (e: Parameters<typeof s.send>[0]) => {
    s.send(e)
    sync()
  }
  return {
    s,
    send,
    announce,
    onAction,
    onValueChange,
    onInputValueChange,
    runTimers: () => {
      for (const f of timers.splice(0)) f()
    },
    type: (text: string) =>
      send({
        type: "INPUT.CHANGE",
        text,
        inputType: "insertText",
        composing: false,
        caretAtEnd: true,
      }),
    text: () => s.view().values.inputValue as string,
    state: () => s.getSnapshot().state,
    highlighted: () => s.getSnapshot().context.highlightedKey,
    focus: () => send({ type: "INPUT.FOCUS", modality: "keyboard", cause: "key" }),
    down: () => send({ type: "ARROW", key: "NEXT", alt: false, composing: false }),
    enter: () => send({ type: "ENTER", composing: false }),
    escape: () => send({ type: "ESCAPE", composing: false }),
    caret: () => send({ type: "CARET" }),
    backspace: () => send({ type: "BACKSPACE_EMPTY" }),
    choose: (k: string) => send({ type: "ITEM.CHOOSE", key: toKey(k), modality: "pointer" }),
    setProps: (p: Partial<ComboboxProps>) => {
      current = { ...current, ...p } as ComboboxProps
      s.setProps(current as never)
      // The adapter re-derives the results after the render the change caused.
      sync()
    },
    setItems: (labels: readonly string[]) => {
      all = build(labels)
      sync(true)
    },
  }
}

describe("inline combobox (command palette)", () => {
  it("has one state, open, and highlights the first item at mount without announcing", () => {
    const m = make(true)
    expect(m.state()).toBe("open")
    expect(Object.keys(inlineComboboxMachine.def.states)).toEqual(["open"])
    expect(m.highlighted()).toBe("new-file")
    expect(m.announce).not.toHaveBeenCalled()
  })

  it("a query highlights its first item and announces the count once", () => {
    const m = make(true)
    m.focus()
    m.type("t")
    // "Open recent", "Settings", "Toggle theme" contain a t.
    expect(m.highlighted()).toBe("open-recent")
    expect(m.announce).toHaveBeenLastCalledWith(
      expect.objectContaining({ message: "3 results", key: "combobox-count:r" }),
    )
  })

  it("appended items keep the highlight (dip/cmdk#97)", () => {
    const m = make(true)
    m.focus()
    m.down()
    m.down()
    // Save is disabled: two moves from "New file" reach "Settings".
    expect(m.highlighted()).toBe("settings")
    const before = m.highlighted()
    m.setItems([...COMMANDS, "Zoom in", "Zoom out"])
    expect(m.highlighted()).toBe(before)
  })

  it("Enter runs the highlighted item: onAction once, text unchanged, highlight kept", () => {
    const m = make(true)
    m.focus()
    m.enter()
    expect(m.onAction).toHaveBeenCalledTimes(1)
    expect(m.onAction).toHaveBeenCalledWith("new-file", {
      modality: "keyboard",
      modifiers: { shift: false, alt: false, ctrl: false, meta: false, mod: false },
    })
    expect(m.text()).toBe("")
    expect(m.highlighted()).toBe("new-file")
    expect(m.onValueChange).not.toHaveBeenCalled()
  })

  it("a press runs the item; disabled items never run", () => {
    const m = make(true)
    m.choose("settings")
    m.choose("save")
    expect(m.onAction.mock.calls.map((c) => c[0])).toEqual(["settings"])
  })

  it("Home/End (CARET) keep the highlight", () => {
    const m = make(true)
    m.focus()
    m.down()
    const h = m.highlighted()
    m.caret()
    expect(m.highlighted()).toBe(h)
  })

  it("Escape clears the query, then asks the host to close; without a host it does nothing", () => {
    const requestClose = vi.fn()
    const m = make(true, { requestClose })
    m.focus()
    m.type("theme")
    m.escape()
    expect(m.text()).toBe("")
    expect(requestClose).not.toHaveBeenCalled()
    m.escape()
    expect(requestClose).toHaveBeenCalledTimes(1)
    expect(m.state()).toBe("open")
  })

  it("Backspace on an empty query goes back only above the root page", () => {
    const onBack = vi.fn()
    const m = make(true, { onBack, page: { key: "root", label: "Commands", depth: 0 } })
    m.focus()
    m.backspace()
    expect(onBack).not.toHaveBeenCalled()
    m.setProps({ page: { key: "projects", label: "Projects", depth: 1 } })
    m.backspace()
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it("a page change clears the query, highlights the first item and announces the label", () => {
    const m = make(true)
    m.focus()
    m.type("pro")
    m.setItems(["Rind", "Reado"])
    m.setProps({ page: { key: "projects", label: "Projects", depth: 1 } })
    expect(m.text()).toBe("")
    expect(m.highlighted()).toBe("rind")
    expect(m.announce).toHaveBeenLastCalledWith(
      expect.objectContaining({ message: "Projects", key: "combobox-page:r" }),
    )
  })

  it("arrows work again after an empty result (huntabyte/bits-ui#996)", () => {
    const m = make(true)
    m.focus()
    m.type("zzz")
    expect(m.highlighted()).toBeNull()
    m.type("t")
    expect(m.highlighted()).toBe("open-recent")
    m.down()
    expect(m.highlighted()).toBe("settings")
  })
})

describe("free-text combobox (autocomplete)", () => {
  it("choosing fills the text, closes, calls onAction; onValueChange never fires", () => {
    const m = make(false)
    m.focus()
    m.type("se")
    m.down()
    m.enter()
    expect(m.text()).toBe("Settings")
    expect(m.state()).toBe("closed")
    expect(m.onAction).toHaveBeenCalledWith(
      "settings",
      expect.objectContaining({ modality: "keyboard" }),
    )
    expect(m.onValueChange).not.toHaveBeenCalled()
    expect(m.onInputValueChange).toHaveBeenLastCalledWith("Settings", expect.anything())
  })

  it("free text survives blur (unovue/reka-ui#779)", () => {
    const m = make(false)
    m.focus()
    m.type("Atlantis")
    m.send({ type: "INPUT.BLUR" })
    expect(m.text()).toBe("Atlantis")
  })

  it("Escape on a closed popup keeps the text unless clearOnEscape", () => {
    const keep = make(false)
    keep.focus()
    keep.type("Atlantis")
    keep.escape()
    keep.escape()
    expect(keep.text()).toBe("Atlantis")
    const clear = make(false, { clearOnEscape: true })
    clear.focus()
    clear.type("Atlantis")
    clear.escape()
    clear.escape()
    expect(clear.text()).toBe("")
  })
})
