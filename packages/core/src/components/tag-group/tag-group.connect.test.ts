// Tag Group connect (task 2.3): roles by interactivity and emptiness, names, the removal hint,
// TagRemove, and the data attributes, for interactive, empty, display-only, selectable, link
// and disabled groups.
import { describe, expect, it, vi } from "vitest"
import { toKey } from "../../collection/key"
import { createListCollection } from "../../collection/list"
import { platforms } from "../../dom/platform"
import { type TagGroupView, tagGroupConnect } from "./tag-group.connect"

const tags = (...items: (string | { id: string; disabled?: boolean })[]) =>
  createListCollection({
    items: items.map((t) => (typeof t === "string" ? { id: t } : t)),
    getKey: (t) => t.id,
    getText: (t) => t.id,
    isDisabled: (t) => t.disabled === true,
  })
const env = {
  platform: platforms.linux,
  locale: { dir: () => "ltr" as const },
  modality: {
    modality: () => "keyboard" as const,
    subscribe: () => () => {},
    focusCause: () => "other" as const,
    markFocus: () => {},
    unmarkFocus: () => {},
    recentFocus: () => [],
  },
}

function connect(over: Partial<TagGroupView> = {}) {
  const view: TagGroupView = {
    instance: "t",
    collection: tags("rome", "paris"),
    context: { highlightedKey: null, highlightSource: null },
    selection: new Set(),
    selectionMode: "none",
    removable: true,
    actions: false,
    links: new Set(),
    disabled: false,
    focusableWhenDisabled: true,
    pending: false,
    focused: false,
    modality: "keyboard",
    touchDevice: false,
    hoveredKey: null,
    pressedKey: null,
    typingAhead: () => false,
    mounted: { label: true, description: false },
    send: vi.fn(),
    ...over,
  }
  return tagGroupConnect(view, env as never)
}
const K = toKey

describe("roles by interactivity", () => {
  it("removable: grid of rows, one gridcell each, named by the label", () => {
    const p = connect()
    expect(p.list()).toMatchObject({ role: "grid", "aria-labelledby": p.ids.label })
    expect(p.item(K("rome"))).toMatchObject({
      role: "row",
      "aria-labelledby": p.ids.text(K("rome")),
      "data-removable": "",
    })
    expect(p.itemCell()).toMatchObject({ role: "gridcell", "data-part": "item-cell" })
  })

  it("empty interactive: a named group, a container Tab stop, no multiselectable (RS#8354)", () => {
    const p = connect({ collection: tags(), selectionMode: "multiple" })
    const list = p.list()
    expect(list["role"]).toBe("group")
    expect(list["aria-labelledby"]).toBe(p.ids.label)
    expect(list["tabindex"]).toBe(0)
    expect(list["aria-multiselectable"]).toBeUndefined()
    expect(list["data-empty"]).toBe("")
  })

  it("display-only: list of listitems, no Tab stop, no handlers", () => {
    const p = connect({ removable: false })
    const list = p.list()
    expect(list["role"]).toBe("list")
    expect(list["tabindex"]).toBeUndefined()
    expect(list["onKeyDown"]).toBeUndefined()
    const item = p.item(K("rome"))
    expect(item["role"]).toBe("listitem")
    expect(item["tabindex"]).toBeUndefined()
    expect(p.itemCell()["role"]).toBeUndefined()
  })

  it("selectable: explicit aria-selected and multiselectable", () => {
    const p = connect({
      removable: false,
      selectionMode: "multiple",
      selection: new Set([K("rome")]),
    })
    expect(p.list()["aria-multiselectable"]).toBe("true")
    expect(p.list()["data-selection-mode"]).toBe("multiple")
    expect(p.item(K("rome"))["aria-selected"]).toBe("true")
    expect(p.item(K("paris"))["aria-selected"]).toBe("false")
  })

  it("a link tag: interactive, data-link, no selection state, anchor out of the Tab order", () => {
    const p = connect({
      removable: false,
      selectionMode: "multiple",
      links: new Set([K("rome")]),
    })
    expect(p.list()["role"]).toBe("grid")
    expect(p.item(K("rome"))["data-link"]).toBe("")
    expect(p.item(K("rome"))["aria-selected"]).toBeUndefined()
    expect(p.itemText(K("rome"))["tabIndex"]).toBe(-1)
    expect(p.itemText(K("paris"))["tabIndex"]).toBeUndefined()
  })
})

describe("names", () => {
  it("a consumer aria-label on the tag replaces the text name (RS#7310)", () => {
    const p = connect()
    expect(p.item(K("rome"), { "aria-label": "Rome, Italy" })["aria-labelledby"]).toBeUndefined()
  })

  it("a consumer name on the list replaces the label", () => {
    expect(connect().list({ "aria-label": "Cities" })["aria-labelledby"]).toBeUndefined()
  })
})

describe("removal hint", () => {
  it("on enabled removable tags in keyboard and virtual modality only", () => {
    for (const modality of ["keyboard", "virtual"] as const) {
      const p = connect({ modality })
      expect(p.item(K("rome"))["aria-describedby"]).toBe(p.ids.hint)
    }
    expect(connect({ modality: "pointer" }).item(K("rome"))["aria-describedby"]).toBeUndefined()
    expect(connect({ touchDevice: true }).item(K("rome"))["aria-describedby"]).toBeUndefined()
    const d = connect({ collection: tags({ id: "rome", disabled: true }) })
    expect(d.item(K("rome"))["aria-describedby"]).toBeUndefined()
  })

  it("the hint node is hidden and carries the message; never on TagRemove", () => {
    const p = connect()
    expect(p.hint()).toMatchObject({ id: p.ids.hint, hidden: true })
    expect(p.hintText).toBe("Press Delete to remove")
    expect(p.itemRemove(K("rome"))["aria-describedby"]).toBeUndefined()
  })
})

describe("TagRemove", () => {
  it('a button "Remove <text>" out of the Tab order, never aria-hidden', () => {
    const r = connect().itemRemove(K("rome"))
    expect(r).toMatchObject({ type: "button", tabIndex: -1, "aria-label": "Remove rome" })
    expect(r["aria-hidden"]).toBeUndefined()
  })

  it("disabled with its tag or the group", () => {
    expect(connect({ disabled: true }).itemRemove(K("rome"))["disabled"]).toBe(true)
    const d = connect({ collection: tags({ id: "rome", disabled: true }) })
    expect(d.itemRemove(K("rome"))["disabled"]).toBe(true)
  })

  it("localised label", () => {
    const p = connect({ messages: { removeLabel: (t) => `Rimuovi ${t}` } })
    expect(p.itemRemove(K("rome"))["aria-label"]).toBe("Rimuovi rome")
  })
})

describe("data attributes", () => {
  it("a selected removable tag (spec scenario)", () => {
    const p = connect({ selectionMode: "multiple", selection: new Set([K("rome")]) })
    expect(p.item(K("rome"))).toMatchObject({
      "data-part": "item",
      "data-key": "rome",
      "data-selected": "",
      "data-removable": "",
    })
  })

  it("hover and press on an interactive tag; root and list empty and disabled", () => {
    const p = connect({ hoveredKey: K("rome"), pressedKey: K("paris") })
    expect(p.item(K("rome"))["data-hover"]).toBe("")
    expect(p.item(K("paris"))["data-pressed"]).toBe("")
    const e = connect({ collection: tags(), disabled: true })
    expect(e.root()).toMatchObject({ "data-empty": "", "data-disabled": "" })
    expect(e.list()).toMatchObject({ "data-empty": "", "data-disabled": "" })
  })

  it("no inline style and no aria-live anywhere", () => {
    const p = connect()
    for (const part of [p.root(), p.list(), p.item(K("rome")), p.itemCell(), p.empty()]) {
      expect(part["style"]).toBeUndefined()
      expect(part["aria-live"]).toBeUndefined()
    }
  })
})
