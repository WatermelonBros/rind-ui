// The Select's attributes (openspec add-select): trigger ARIA and data, value text, list
// naming, keyboard on the trigger and the list, hidden input, content close reason.
import { describe, expect, it, vi } from "vitest"
import { toKey } from "../../collection/key"
import { createListCollection } from "../../collection/list"
import { CRITICAL } from "../../connect/props"
import { placementFrom } from "../../dom/position/connect"
import type { PlatformFlags } from "../../env/capabilities"
import {
  type SelectConnectInput,
  type SelectTriggerState,
  selectConnect,
  selectedTexts,
} from "./select.connect"
import { type SelectEvent, selectIds } from "./select.machine"

const flags: PlatformFlags = {
  engine: "blink",
  apple: false,
  mac: false,
  ios: false,
  android: false,
  windows: true,
  webkit: false,
  chromium: true,
  firefox: false,
}
const env = {
  platform: flags,
  modality: { modality: () => "keyboard" },
  locale: { dir: () => "ltr" },
} as never
const collection = createListCollection({
  items: [
    { id: "a", text: "Apple" },
    { id: "b", text: "Banana" },
    { id: "c", text: "Cherry" },
  ],
  getKey: (r) => r.id,
  getText: (r) => r.text,
})
const placed = placementFrom({ side: "bottom", align: "start", anchorHidden: false } as never)
const base: SelectConnectInput = {
  instance: "s",
  open: false,
  collection,
  selection: new Set(),
  multiple: false,
  highlightedKey: null,
  highlightSource: null,
  typingAhead: () => false,
  placement: placed,
  closeReason: null,
  modal: true,
  disabled: false,
  readOnly: false,
  required: false,
  invalid: false,
  autofilled: false,
  texts: new Map(),
  placeholder: "Pick",
  listFormat: (t) => t.join(" & "),
  mounted: {
    label: false,
    description: false,
    list: false,
    empty: false,
    itemDescription: () => false,
  },
  listFocused: false,
  modality: "keyboard",
}
const ids = selectIds("s")
const ts: SelectTriggerState = {
  tag: "button",
  focused: false,
  modality: "keyboard",
  pressed: false,
}

function make(over: Partial<SelectConnectInput> = {}) {
  const send = vi.fn<(e: SelectEvent) => void>()
  return { send, c: selectConnect({ ...base, ...over }, send, env) }
}
const key = (k: string, o: Record<string, unknown> = {}) => {
  const currentTarget = {}
  return {
    key: k,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    isComposing: false,
    preventDefault: vi.fn(),
    currentTarget,
    target: currentTarget,
    ...o,
  } as Record<string, unknown>
}
const keyDown = (p: Record<string, unknown>, e: unknown) =>
  (p["onKeyDown"] as (e: unknown) => void)(e)

describe("trigger attributes", () => {
  it("is a combobox with aria-expanded, critical", () => {
    const p = make().c.trigger(ts)
    expect(p["role"]).toBe("combobox")
    expect(p["aria-expanded"]).toBe("false")
    expect(p["id"]).toBe(ids.trigger)
    expect(p[CRITICAL]).toEqual(["aria-expanded", "role"])
    expect(make({ open: true }).c.trigger(ts)["aria-expanded"]).toBe("true")
  })

  it("aria-controls only when the list is mounted", () => {
    expect(make().c.trigger(ts)["aria-controls"]).toBeUndefined()
    const mounted = { ...base.mounted, list: true }
    expect(make({ mounted }).c.trigger(ts)["aria-controls"]).toBe(ids.list)
  })

  it("aria-labelledby is the label id only when mounted and the consumer named nothing", () => {
    const mounted = { ...base.mounted, label: true }
    expect(make().c.trigger(ts)["aria-labelledby"]).toBeUndefined()
    expect(make({ mounted }).c.trigger(ts)["aria-labelledby"]).toBe(ids.label)
    const withLabel = make({ mounted }).c.trigger({ ...ts, label: "Fruit" })
    expect(withLabel["aria-labelledby"]).toBeUndefined()
    expect(withLabel["aria-label"]).toBe("Fruit")
    const withBy = make({ mounted }).c.trigger({ ...ts, labelledBy: "ext" })
    expect(withBy["aria-labelledby"]).toBe("ext")
  })

  it("aria-label passes through", () => {
    expect(make().c.trigger({ ...ts, label: "Fruit" })["aria-label"]).toBe("Fruit")
    expect(make().c.trigger(ts)["aria-label"]).toBeUndefined()
  })

  it("aria-describedby joins the consumer's ids and the mounted description", () => {
    const d = { ...base.mounted, description: true }
    expect(make().c.trigger(ts)["aria-describedby"]).toBeUndefined()
    expect(make({ mounted: d }).c.trigger(ts)["aria-describedby"]).toBe(ids.description)
    expect(make({ mounted: d }).c.trigger({ ...ts, describedBy: "x" })["aria-describedby"]).toBe(
      `x ${ids.description}`,
    )
    expect(make().c.trigger({ ...ts, describedBy: "x" })["aria-describedby"]).toBe("x")
  })

  it("aria-required and aria-invalid", () => {
    const off = make().c.trigger(ts)
    expect(off["aria-required"]).toBeUndefined()
    expect(off["aria-invalid"]).toBeUndefined()
    const on = make({ required: true, invalid: true }).c.trigger(ts)
    expect(on["aria-required"]).toBe("true")
    expect(on["aria-invalid"]).toBe("true")
  })

  it("data-state, data-placeholder, data-autofill", () => {
    const closed = make().c.trigger(ts)
    expect(closed["data-state"]).toBe("closed")
    expect(closed["data-placeholder"]).toBe("")
    expect(closed["data-autofill"]).toBeUndefined()
    const open = make({
      open: true,
      selection: new Set([toKey("a")]),
      autofilled: true,
    }).c.trigger(ts)
    expect(open["data-state"]).toBe("open")
    expect(open["data-placeholder"]).toBeUndefined()
    expect(open["data-autofill"]).toBe("")
  })

  it("data-disabled / readonly / required / invalid", () => {
    const off = make().c.trigger(ts)
    for (const a of ["data-disabled", "data-readonly", "data-required", "data-invalid"]) {
      expect(off[a]).toBeUndefined()
    }
    const on = make({ disabled: true, readOnly: true, required: true, invalid: true }).c.trigger(ts)
    for (const a of ["data-disabled", "data-readonly", "data-required", "data-invalid"]) {
      expect(on[a]).toBe("")
    }
  })

  it("pressTrigger sends TRIGGER_PRESS with the modality", () => {
    const m = make()
    m.c.pressTrigger("touch")
    expect(m.send).toHaveBeenCalledWith({ type: "TRIGGER_PRESS", modality: "touch" })
  })
})

describe("value text", () => {
  it("placeholder when nothing is selected", () => {
    const m = make()
    expect(m.c.placeholder).toBe(true)
    expect(m.c.valueTextContent()).toBe("Pick")
    expect(make({ placeholder: undefined }).c.valueTextContent()).toBe("")
  })

  it("single: the selected text", () => {
    const m = make({ selection: new Set([toKey("b")]) })
    expect(m.c.placeholder).toBe(false)
    expect(m.c.valueTextContent()).toBe("Banana")
    expect(m.c.valueText()["data-placeholder"]).toBeUndefined()
  })

  it("multiple: the texts through listFormat", () => {
    const m = make({ multiple: true, selection: new Set([toKey("c"), toKey("a")]) })
    expect(m.c.valueTextContent()).toBe("Apple & Cherry")
  })

  it("selectedTexts follows collection order, not selection order", () => {
    expect(
      selectedTexts(collection, new Set([toKey("c"), toKey("a"), toKey("b")]), new Map()),
    ).toEqual(["Apple", "Banana", "Cherry"])
  })

  it("a key missing from the collection uses the texts map, after collection items", () => {
    const texts = new Map([[toKey("gone"), "Gone fruit"]])
    expect(selectedTexts(collection, new Set([toKey("gone"), toKey("a")]), texts)).toEqual([
      "Apple",
      "Gone fruit",
    ])
    expect(selectedTexts(collection, new Set([toKey("nope")]), new Map())).toEqual([""])
  })
})

describe("list", () => {
  const list = (
    over: Partial<SelectConnectInput>,
    t: Parameters<ReturnType<typeof make>["c"]["list"]>[0] = {},
  ) => make(over).c.list(t)
  const mountedLabel = { ...base.mounted, label: true }

  it("has the list id and tabindex -1", () => {
    const p = list({})
    expect(p["id"]).toBe(ids.list)
    expect(p["tabindex"]).toBe(-1)
  })

  it("label mounted: no own naming, even if the trigger has one", () => {
    const p = list({ mounted: mountedLabel }, { label: "Fruit", labelledBy: "ext" })
    expect(p["aria-label"]).toBeUndefined()
    expect(p["aria-labelledby"]).toBe(ids.label)
  })

  it("no label: copies the trigger aria-label", () => {
    const p = list({}, { label: "Fruit", labelledBy: "ext" })
    expect(p["aria-label"]).toBe("Fruit")
    expect(p["aria-labelledby"]).toBeUndefined()
  })

  it("no label, no aria-label: the consumer aria-labelledby", () => {
    expect(list({}, { labelledBy: "ext" })["aria-labelledby"]).toBe("ext")
  })

  it("never the trigger id", () => {
    for (const p of [list({}), list({}, { label: "x" }), list({}, { labelledBy: "ext" })]) {
      expect(p["aria-labelledby"]).not.toBe(ids.trigger)
    }
    expect(list({})["aria-label"]).toBeUndefined()
    expect(list({})["aria-labelledby"]).toBeUndefined()
  })

  it("Tab sends TAB_KEY with shift; composing Tab does not", () => {
    const m = make({ open: true })
    const p = m.c.list({})
    keyDown(p, key("Tab"))
    keyDown(p, key("Tab", { shiftKey: true }))
    keyDown(p, key("Tab", { isComposing: true }))
    expect(m.send.mock.calls.map((c) => c[0])).toEqual([
      { type: "TAB_KEY", shift: false },
      { type: "TAB_KEY", shift: true },
    ])
  })

  it("other keys reach the listbox keyboard", () => {
    const m = make({ open: true })
    keyDown(m.c.list({}), key("ArrowDown"))
    expect(m.send).toHaveBeenCalledWith(expect.objectContaining({ type: "NAVIGATE", move: "next" }))
  })
})

describe("trigger keyboard", () => {
  const press = (
    k: string,
    over: Partial<SelectConnectInput> = {},
    o: Record<string, unknown> = {},
  ) => {
    const m = make(over)
    const e = key(k, o)
    keyDown(m.c.trigger(ts), e)
    return { m, e, sent: m.send.mock.calls.map((c) => c[0]) }
  }

  it("ArrowDown, ArrowUp and Alt+ArrowDown send TRIGGER_KEY first, last, first", () => {
    expect(press("ArrowDown").sent).toEqual([{ type: "TRIGGER_KEY", key: "first" }])
    expect(press("ArrowUp").sent).toEqual([{ type: "TRIGGER_KEY", key: "last" }])
    expect(press("ArrowDown", {}, { altKey: true }).sent).toEqual([
      { type: "TRIGGER_KEY", key: "first" },
    ])
    expect(press("ArrowUp", {}, { altKey: true }).sent).toEqual([
      { type: "TRIGGER_KEY", key: "first" },
    ])
    expect(press("ArrowDown").e["preventDefault"]).toHaveBeenCalled()
  })

  it("Ctrl/Meta arrows are left alone", () => {
    expect(press("ArrowDown", {}, { ctrlKey: true }).sent).toEqual([])
    expect(press("ArrowUp", {}, { metaKey: true }).sent).toEqual([])
  })

  it("a printable character sends TYPEAHEAD", () => {
    const { sent, e } = press("c")
    expect(sent).toEqual([
      {
        type: "TYPEAHEAD",
        char: "c",
        composing: false,
        modifiers: { ctrl: false, meta: false, alt: false },
      },
    ])
    expect(e["preventDefault"]).toHaveBeenCalled()
  })

  it("modified or non-printable keys send nothing", () => {
    expect(press("c", {}, { ctrlKey: true }).sent).toEqual([])
    expect(press("c", {}, { metaKey: true }).sent).toEqual([])
    expect(press("c", {}, { altKey: true }).sent).toEqual([])
    expect(press("Enter").sent).toEqual([])
    expect(press("Escape").sent).toEqual([])
  })

  it("Space sends TYPEAHEAD only while typingAhead() is true", () => {
    expect(press(" ").sent).toEqual([])
    expect(press(" ", { typingAhead: () => true }).sent).toEqual([
      expect.objectContaining({ type: "TYPEAHEAD", char: " " }),
    ])
  })

  it("nothing while open, disabled, readOnly, composing, or from a descendant", () => {
    expect(press("ArrowDown", { open: true }).sent).toEqual([])
    expect(press("c", { open: true }).sent).toEqual([])
    expect(press("ArrowDown", { disabled: true }).sent).toEqual([])
    expect(press("c", { disabled: true }).sent).toEqual([])
    expect(press("ArrowDown", { readOnly: true }).sent).toEqual([])
    expect(press("c", { readOnly: true }).sent).toEqual([])
    expect(press("ArrowDown", {}, { isComposing: true }).sent).toEqual([])
    expect(press("ArrowDown", {}, { target: {} }).sent).toEqual([])
  })
})

describe("hidden input", () => {
  it("single: name, form, autocomplete and the selected key as defaultValue", () => {
    const p = make({ selection: new Set([toKey("b")]) }).c.hiddenInput({
      name: "fruit",
      form: "f",
      autoComplete: "off",
    })
    expect(p["id"]).toBe(ids.hiddenInput)
    expect(p["name"]).toBe("fruit")
    expect(p["form"]).toBe("f")
    expect(p["autocomplete"]).toBe("off")
    expect(p["defaultValue"]).toBe("b")
    expect(p["aria-hidden"]).toBe("true")
    expect(p["tabindex"]).toBe(-1)
  })

  it("single, empty: defaultValue is an empty string", () => {
    expect(make().c.hiddenInput({})["defaultValue"]).toBe("")
  })

  it("multiple: no name, a marker value only while something is selected", () => {
    const some = make({ multiple: true, selection: new Set([toKey("a")]) }).c.hiddenInput({
      name: "fruit",
    })
    expect(some["name"]).toBeUndefined()
    expect(some["defaultValue"]).toBe("x")
    expect(make({ multiple: true }).c.hiddenInput({ name: "fruit" })["defaultValue"]).toBe("")
  })

  it("required and disabled", () => {
    const off = make().c.hiddenInput({})
    expect(off["required"]).toBeUndefined()
    expect(off["disabled"]).toBeUndefined()
    const on = make({ required: true, disabled: true }).c.hiddenInput({})
    expect(on["required"]).toBe(true)
    expect(on["disabled"]).toBe(true)
  })
})

describe("content", () => {
  it("data-close-reason only while closed", () => {
    expect(make({ closeReason: "escape-key" }).c.content()["data-close-reason"]).toBe("escape-key")
    expect(make({ closeReason: "escape-key", open: true }).c.content()["data-close-reason"]).toBe(
      undefined,
    )
    expect(make().c.content()["data-close-reason"]).toBeUndefined()
  })

  it("data-state and data-modal", () => {
    const p = make({ open: true }).c.content()
    expect(p["data-state"]).toBe("open")
    expect(p["data-modal"]).toBe("")
    expect(p["id"]).toBe(ids.content)
    expect(make({ modal: false }).c.content()["data-modal"]).toBeUndefined()
  })
})
