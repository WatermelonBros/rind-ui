// The Select machine in Node (openspec add-select): every transition and its onOpenChange
// reason, SELECT in both modes, disabled / readOnly, controlled open and value, closed-trigger
// typeahead, form reset and autofill, closeReason and restoreFocus. Without a `document` the
// overlay effect is a no-op, so the real machine runs unchanged.
import { describe, expect, it, vi } from "vitest"
import { toKey } from "../../collection/key"
import { createListCollection } from "../../collection/list"
import { dismissRequest } from "../../dom/dismiss"
import { createService } from "../../machine/service"
import {
  type SelectCloseReason,
  type SelectEvent,
  type SelectProps,
  type SelectValue,
  selectMachine,
} from "./select.machine"

type Item = { id: string; text: string; off?: boolean }
const items: Item[] = [
  { id: "apple", text: "Apple" },
  { id: "banana", text: "Banana" },
  { id: "blue", text: "Blueberry", off: true },
  { id: "berry", text: "Berry" },
  { id: "cherry", text: "Cherry" },
]
const coll = (xs: Item[] = items) =>
  createListCollection({
    items: xs,
    getKey: (r) => r.id,
    getText: (r) => r.text,
    isDisabled: (r) => r.off === true,
  })

function make(over: Partial<SelectProps> = {}) {
  // fake-time: the typeahead reads the injected clock; tests move it by hand, never wait.
  let now = 0
  const env = {
    dom: { getRootNode: () => ({}), getById: () => null },
    clock: { now: () => now },
    locale: { locale: () => "en", dir: () => "ltr" },
    modality: { modality: () => "keyboard" },
    scheduler: { requestAnimationFrame: () => 0, cancelAnimationFrame: () => {} },
    position: { reposition: () => {}, track: () => ({ stop() {}, reposition() {} }) },
  }
  const onOpenChange = vi.fn()
  const onValueChange = vi.fn()
  const props: SelectProps = {
    root: "r",
    strategy: "roving",
    ids: { list: "list", item: (k) => `item-${k}` },
    // Explicit: see the "undefined selectionMode" test below.
    selectionMode: "single",
    collection: coll(),
    getTrigger: () => null,
    onOpenChange,
    onValueChange,
    ...over,
  }
  const s = createService(selectMachine, props as never, env as never)
  s.start()
  return {
    s,
    onOpenChange,
    onValueChange,
    advance: (ms: number) => {
      now += ms
    },
    send: (e: SelectEvent) => s.send(e as never),
    state: () => s.getSnapshot().state,
    ctx: () => s.getSnapshot().context,
    value: () => s.view().values["value"] as SelectValue,
    open: () => s.view().values["open"] as boolean,
    reasons: () => onOpenChange.mock.calls.map((c) => [c[0], c[1].reason]),
  }
}

const press = { type: "TRIGGER_PRESS", modality: "pointer" } as const
const dismissal = (
  type: "ESCAPE_KEY" | "OUTSIDE_PRESS" | "OUTSIDE_FOCUS" | "PARENT_DISMISSED",
  reason: Parameters<typeof dismissRequest>[0],
) => ({ type, request: dismissRequest(reason, undefined, null) }) as SelectEvent
const select = (key: string) =>
  ({
    type: "SELECT",
    key: toKey(key),
    modality: "pointer",
    shift: false,
    mod: false,
  }) as SelectEvent
const type = (char: string, over: object = {}) =>
  ({
    type: "TYPEAHEAD",
    char,
    composing: false,
    modifiers: { ctrl: false, meta: false, alt: false },
    ...over,
  }) as SelectEvent

const CLOSERS: [SelectCloseReason, SelectEvent][] = [
  ["trigger", press],
  ["escape-key", dismissal("ESCAPE_KEY", "escape-key")],
  ["outside-press", dismissal("OUTSIDE_PRESS", "outside-press")],
  ["outside-focus", dismissal("OUTSIDE_FOCUS", "outside-focus")],
  ["parent-dismissed", dismissal("PARENT_DISMISSED", "parent-dismissed")],
  ["tab-key", { type: "TAB_KEY", shift: false }],
  ["window-blur", { type: "WINDOW_BLUR" }],
  ["api", { type: "CLOSE" }],
]

describe("opening", () => {
  it("TRIGGER_PRESS toggles: open with reason trigger, close with reason trigger", () => {
    const m = make()
    expect(m.state()).toBe("closed")
    m.send(press)
    expect(m.state()).toBe("open")
    m.send(press)
    expect(m.state()).toBe("closed")
    expect(m.reasons()).toEqual([
      [true, "trigger"],
      [false, "trigger"],
    ])
  })

  it("TRIGGER_KEY first and last open with reason trigger-key and set openToLast", () => {
    const a = make()
    a.send({ type: "TRIGGER_KEY", key: "first" })
    expect(a.state()).toBe("open")
    expect(a.ctx().openToLast).toBe(false)
    expect(a.ctx().openModality).toBe("keyboard")
    const b = make()
    b.send({ type: "TRIGGER_KEY", key: "last" })
    expect(b.ctx().openToLast).toBe(true)
    expect(b.reasons()).toEqual([[true, "trigger-key"]])
  })

  it("OPEN opens with reason api; OPEN while open is ignored", () => {
    const m = make()
    m.send({ type: "OPEN" })
    m.send({ type: "OPEN" })
    expect(m.state()).toBe("open")
    expect(m.reasons()).toEqual([[true, "api"]])
  })

  it("a pointer press records its modality; the close reason clears on reopen", () => {
    const m = make()
    m.send(press)
    expect(m.ctx().openModality).toBe("pointer")
    m.send({ type: "WINDOW_BLUR" })
    expect(m.ctx().closeReason).toBe("window-blur")
    m.send(press)
    expect(m.ctx().closeReason).toBeNull()
  })

  it("defaultOpen starts open", () => {
    expect(make({ defaultOpen: true }).state()).toBe("open")
  })
})

describe("closing", () => {
  it.each(CLOSERS)("%s closes with that reason in onOpenChange and closeReason", (reason, e) => {
    const m = make({ defaultOpen: true })
    m.send(e)
    expect(m.state()).toBe("closed")
    expect(m.open()).toBe(false)
    expect(m.reasons()).toEqual([[false, reason]])
    expect(m.ctx().closeReason).toBe(reason)
  })

  it("close events are ignored while closed", () => {
    const m = make()
    for (const [, e] of CLOSERS.slice(1)) m.send(e)
    expect(m.state()).toBe("closed")
    expect(m.onOpenChange).not.toHaveBeenCalled()
    expect(m.ctx().closeReason).toBeNull()
  })

  it("restoreFocus is false after TAB_KEY and WINDOW_BLUR, true otherwise", () => {
    for (const [reason, e] of CLOSERS) {
      const m = make({ defaultOpen: true })
      m.send(e)
      expect(m.ctx().restoreFocus, reason).toBe(reason !== "tab-key" && reason !== "window-blur")
    }
  })

  it("reopening restores restoreFocus to true", () => {
    const m = make({ defaultOpen: true })
    m.send({ type: "TAB_KEY", shift: true })
    m.send(press)
    expect(m.ctx().restoreFocus).toBe(true)
  })
})

describe("SELECT", () => {
  it("single: sets the value, closes with reason item-select", () => {
    const m = make({ defaultOpen: true })
    m.send(select("banana"))
    expect(m.value()).toBe("banana")
    expect(m.state()).toBe("closed")
    expect(m.reasons()).toEqual([[false, "item-select"]])
    expect(m.onValueChange.mock.calls[0]?.[0]).toBe("banana")
    expect(m.ctx().closeReason).toBe("item-select")
  })

  it("multiple: stays open and toggles", () => {
    const m = make({ defaultOpen: true, selectionMode: "multiple" })
    m.send(select("apple"))
    m.send(select("cherry"))
    expect(m.state()).toBe("open")
    expect(m.value()).toEqual(["apple", "cherry"])
    m.send(select("apple"))
    expect(m.value()).toEqual(["cherry"])
    expect(m.onOpenChange).not.toHaveBeenCalled()
  })

  it("a disabled item is ignored: no value, no close", () => {
    const m = make({ defaultOpen: true })
    m.send(select("blue"))
    expect(m.state()).toBe("open")
    expect(m.value()).toBeNull()
    expect(m.onValueChange).not.toHaveBeenCalled()
    expect(m.onOpenChange).not.toHaveBeenCalled()
  })

  it("SELECT while closed does nothing", () => {
    const m = make()
    m.send(select("apple"))
    expect(m.value()).toBeNull()
  })
})

describe("disabled and readOnly", () => {
  it.each(["disabled", "readOnly"] as const)("%s refuses every way to open", (flag) => {
    const m = make({ [flag]: true })
    m.send(press)
    m.send({ type: "TRIGGER_KEY", key: "first" })
    m.send({ type: "OPEN" })
    expect(m.state()).toBe("closed")
    expect(m.onOpenChange).not.toHaveBeenCalled()
  })

  it.each(["disabled", "readOnly"] as const)("%s ignores closed typeahead", (flag) => {
    const m = make({ [flag]: true })
    m.send(type("c"))
    expect(m.value()).toBeNull()
    expect(m.onValueChange).not.toHaveBeenCalled()
  })
})

describe("controlled values", () => {
  it("controlled open=false: onOpenChange fires, state stays closed", () => {
    const m = make({ open: false })
    m.send(press)
    expect(m.reasons()).toEqual([[true, "trigger"]])
    expect(m.state()).toBe("closed")
    expect(m.open()).toBe(false)
  })

  it("controlled open=true: a close is proposed, state stays open", () => {
    const m = make({ open: true })
    m.send(dismissal("ESCAPE_KEY", "escape-key"))
    expect(m.reasons()).toEqual([[false, "escape-key"]])
    expect(m.state()).toBe("open")
    expect(m.open()).toBe(true)
  })

  it("controlled value: onValueChange fires, the value stays", () => {
    const m = make({ defaultOpen: true, value: "apple" })
    m.send(select("cherry"))
    expect(m.onValueChange.mock.calls[0]?.[0]).toBe("cherry")
    expect(m.value()).toBe("apple")
  })

  it("controlled value: closed typeahead proposes, the value stays", () => {
    const m = make({ value: "apple" })
    m.send(type("c"))
    expect(m.onValueChange.mock.calls[0]?.[0]).toBe("cherry")
    expect(m.value()).toBe("apple")
  })
})

describe("closed-trigger typeahead", () => {
  it("single: selects the match without opening", () => {
    const m = make()
    m.send(type("c"))
    expect(m.value()).toBe("cherry")
    expect(m.state()).toBe("closed")
    expect(m.onOpenChange).not.toHaveBeenCalled()
  })

  it("starts after the selected option and cycles", () => {
    const m = make({ defaultValue: "banana" })
    // fake-time: past the 1000 ms timeout so each press is a fresh single-char search.
    m.send(type("b"))
    expect(m.value()).toBe("berry") // skips the disabled Blueberry
    m.advance(2000)
    m.send(type("b"))
    expect(m.value()).toBe("banana") // wraps around
  })

  it("skips disabled items", () => {
    const m = make({ defaultValue: "apple" })
    m.send(type("b"))
    m.send(type("l"))
    // "bl" only matches the disabled Blueberry: no change from Banana.
    expect(m.value()).toBe("banana")
  })

  it("a growing query stays within the time window", () => {
    const m = make()
    m.send(type("b"))
    m.advance(500) // fake-time: inside the window, the query grows
    m.send(type("e"))
    expect(m.value()).toBe("berry")
  })

  it("ignores modifier chords and composition", () => {
    const m = make()
    m.send(type("c", { modifiers: { ctrl: true, meta: false, alt: false } }))
    m.send(type("c", { composing: true }))
    expect(m.value()).toBeNull()
  })

  it("is ignored in multiple mode", () => {
    const m = make({ selectionMode: "multiple" })
    m.send(type("c"))
    expect(m.value()).toBeNull()
    expect(m.onValueChange).not.toHaveBeenCalled()
  })

  it("no match leaves the value", () => {
    const m = make({ defaultValue: "apple" })
    m.send(type("z"))
    expect(m.value()).toBe("apple")
  })
})

describe("form", () => {
  it("FORM.RESET restores defaultValue", () => {
    const m = make({ defaultValue: "banana" })
    m.send(type("c"))
    expect(m.value()).toBe("cherry")
    m.send({ type: "FORM.RESET" })
    expect(m.value()).toBe("banana")
  })

  it("FORM.RESET without a default clears to none", () => {
    const m = make()
    m.send(type("c"))
    m.send({ type: "FORM.RESET" })
    expect(m.value()).toBeNull()
  })

  it("FORM.AUTOFILL matches by key and sets autofilled", () => {
    const m = make()
    m.send({ type: "FORM.AUTOFILL", text: "cherry" })
    expect(m.value()).toBe("cherry")
    expect(m.ctx().autofilled).toBe(true)
  })

  it("FORM.AUTOFILL matches by text through the collator, case-insensitive", () => {
    const m = make()
    m.send({ type: "FORM.AUTOFILL", text: "BANANA" })
    expect(m.value()).toBe("banana")
    expect(m.ctx().autofilled).toBe(true)
  })

  it("FORM.AUTOFILL with no match, or a disabled match, changes nothing", () => {
    const m = make()
    m.send({ type: "FORM.AUTOFILL", text: "nope" })
    m.send({ type: "FORM.AUTOFILL", text: "blueberry" })
    expect(m.value()).toBeNull()
    expect(m.ctx().autofilled).toBe(false)
  })

  it("a later user SELECT clears autofilled", () => {
    const m = make()
    m.send({ type: "FORM.AUTOFILL", text: "apple" })
    m.send(press)
    m.send(select("cherry"))
    expect(m.ctx().autofilled).toBe(false)
  })

  it("a closed typeahead and FORM.RESET clear autofilled", () => {
    const m = make()
    m.send({ type: "FORM.AUTOFILL", text: "apple" })
    m.send(type("c"))
    expect(m.ctx().autofilled).toBe(false)
    m.send({ type: "FORM.AUTOFILL", text: "apple" })
    m.send({ type: "FORM.RESET" })
    expect(m.ctx().autofilled).toBe(false)
  })

  it("FORM.AUTOFILL is ignored in multiple mode", () => {
    const m = make({ selectionMode: "multiple" })
    m.send({ type: "FORM.AUTOFILL", text: "apple" })
    expect(m.value()).toBeNull()
  })
})

describe("default selection mode", () => {
  // BUG (source): isSingle treats an undefined selectionMode as single, but the collection
  // pieces read it as "none", so canSelect refuses every SELECT: the popup can never pick.
  it("an undefined selectionMode selects in single mode", () => {
    const m = make({ defaultOpen: true, selectionMode: undefined })
    m.send(select("banana"))
    expect(m.state()).toBe("closed")
    expect(m.value()).toBe("banana")
  })
})
