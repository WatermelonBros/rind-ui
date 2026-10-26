// Menubar connect (openspec add-menubar: Roles And Naming, Data Attributes, Keyboard On The
// Bar, Opening A Menu): the props of the root and of each bar item, and the keys they send.
import { describe, expect, it } from "vitest"
import type { CollectionKey } from "../../collection/key"
import { createListCollection } from "../../collection/list"
import { type MenubarConnectInput, menubarConnect } from "./menubar.connect"
import type { MenubarEvent } from "./menubar.machine"

const k = (s: string) => s as CollectionKey
const collection = createListCollection<string>({
  items: ["file", "edit", "view"],
  getKey: (i) => i,
  getText: (i) => i,
})

function make(over: Partial<MenubarConnectInput> = {}, dir: "ltr" | "rtl" = "ltr") {
  const sent: MenubarEvent[] = []
  const api = menubarConnect(
    {
      instance: "bar",
      collection,
      highlightedKey: null,
      focusWithin: false,
      pending: false,
      value: null,
      orientation: "horizontal",
      disabled: false,
      focusableWhenDisabled: true,
      modal: true,
      ...over,
    },
    (e) => sent.push(e),
    {
      platform: {} as never,
      locale: { dir: () => dir },
      modality: { modality: () => "keyboard" },
    } as never,
  )
  return { api, sent }
}

/** A keydown on bar item `key` (its element is inside the root). */
function keydown(key: string, on = "file", extra: Partial<KeyboardEventInit> = {}) {
  // A fake bar item: its key, inside a menubar root.
  const item = {
    getAttribute: (n: string) => (n === "data-key" ? on : null),
    // No `[dir]` ancestor: keys follow the locale's direction.
    closest: (selector: string) => (selector === "[dir]" ? null : {}),
  }
  let prevented = false
  const e = {
    key,
    target: item,
    currentTarget: item,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    isComposing: false,
    defaultPrevented: false,
    preventDefault: () => {
      prevented = true
    },
    ...extra,
  }
  return { e, prevented: () => prevented }
}

const handler = (props: Record<string, unknown>, name: string) =>
  props[name] as (e: unknown) => void

describe("menubar connect", () => {
  it("root: role, orientation only when vertical, data attributes", () => {
    expect(make().api.root()).toMatchObject({
      role: "menubar",
      "aria-orientation": undefined,
      "data-scope": "menubar",
      "data-part": "root",
      "data-orientation": "horizontal",
      "data-state": "closed",
      "data-modal": "",
    })
    const open = make({ value: "edit", orientation: "vertical", disabled: true }).api.root()
    expect(open).toMatchObject({
      "aria-orientation": "vertical",
      "data-state": "open",
      "data-disabled": "",
    })
  })

  it("items: one tab stop, data-highlighted only with focus inside", () => {
    const { api } = make({ highlightedKey: k("edit"), focusWithin: true })
    const props = ["file", "edit", "view"].map((x) =>
      api.item({ key: k(x), disabled: false, first: x === "file" }),
    )
    expect(props.map((p) => p["tabindex"])).toEqual([-1, 0, -1])
    expect(props.map((p) => p["data-highlighted"])).toEqual([undefined, "", undefined])
    expect(props.map((p) => p["data-host"])).toEqual(["menubar", "menubar", "menubar"])
    const out = make({ highlightedKey: k("edit") }).api.item({
      key: k("edit"),
      disabled: false,
      first: false,
    })
    expect(out["data-highlighted"]).toBeUndefined()
  })

  it("before items register, the first rendered item is the tab stop", () => {
    const { api } = make({ pending: true })
    expect(api.item({ key: k("file"), disabled: false, first: true })["tabindex"]).toBe(0)
    expect(api.item({ key: k("edit"), disabled: false, first: false })["tabindex"]).toBe(-1)
  })

  it.each([
    ["horizontal", "ltr", "ArrowRight", "next"],
    ["horizontal", "ltr", "ArrowLeft", "previous"],
    ["horizontal", "rtl", "ArrowLeft", "next"],
    ["vertical", "ltr", "ArrowDown", "next"],
    ["vertical", "ltr", "ArrowUp", "previous"],
    ["horizontal", "ltr", "Home", "first"],
    ["horizontal", "ltr", "End", "last"],
  ] as const)("%s %s: %s moves %s", (orientation, dir, key, move) => {
    const { api, sent } = make({ orientation }, dir)
    const { e, prevented } = keydown(key)
    handler(api.root(), "onKeyDown")(e)
    expect(sent).toEqual([{ type: "NAVIGATE", move }])
    expect(prevented()).toBe(true)
  })

  it("printable keys are typeahead; modified keys and keys from elsewhere are not the bar's", () => {
    const { api, sent } = make()
    handler(api.root(), "onKeyDown")(keydown("v").e)
    expect(sent).toEqual([expect.objectContaining({ type: "TYPEAHEAD", char: "v" })])
    sent.length = 0
    handler(api.root(), "onKeyDown")(keydown("ArrowRight", "file", { ctrlKey: true }).e)
    // A key from a popup elsewhere (no bar item target: huntabyte/bits-ui#1593).
    const outside = {
      ...keydown("ArrowDown").e,
      target: { getAttribute: () => null, closest: () => null },
    }
    handler(api.root(), "onKeyDown")(outside)
    expect(sent).toEqual([])
  })

  it("the bar's keys stop while a menu is open; Tab then closes it", () => {
    const { api, sent } = make({ value: "file" })
    handler(api.root(), "onKeyDown")(keydown("ArrowRight").e)
    expect(sent).toEqual([])
    handler(api.root(), "onKeyDown")(keydown("Tab").e)
    expect(sent).toEqual([{ type: "CLOSE", reason: "tab-key" }])
  })

  it.each([
    ["horizontal", "ltr", "ArrowDown", "first"],
    ["horizontal", "ltr", "ArrowUp", "last"],
    ["vertical", "ltr", "ArrowRight", "first"],
    ["vertical", "rtl", "ArrowLeft", "first"],
  ] as const)("%s %s: %s on an item opens on its %s item", (orientation, dir, key, edge) => {
    const { api, sent } = make({ orientation }, dir)
    const item = api.item({ key: k("edit"), disabled: false, first: false })
    const { e } = keydown(key, "edit")
    handler(item, "onKeyDown")(e)
    expect(sent).toEqual([{ type: "TRIGGER_KEY", key: "edit", edge }])
  })

  it("Enter and Space are the trigger's press, not an item key; a disabled item opens nothing", () => {
    const { api, sent } = make()
    const item = api.item({ key: k("edit"), disabled: false, first: false })
    handler(item, "onKeyDown")(keydown("Enter", "edit").e)
    handler(item, "onKeyDown")(keydown(" ", "edit").e)
    const off = make({ disabled: true })
    const disabled = off.api.item({ key: k("edit"), disabled: false, first: false })
    handler(disabled, "onKeyDown")(keydown("ArrowDown", "edit").e)
    expect([...sent, ...off.sent]).toEqual([])
  })

  it("hover switches only from mouse or pen, only while another menu is open", () => {
    const hover = (value: string | null, pointerType: string) => {
      const { api, sent } = make({ value })
      handler(
        api.item({ key: k("edit"), disabled: false, first: false }),
        "onPointerMove",
      )({
        pointerType,
      })
      return sent
    }
    expect(hover("file", "mouse")).toEqual([{ type: "TRIGGER_HOVER", key: "edit" }])
    expect(hover("file", "pen")).toHaveLength(1)
    expect(hover("file", "touch")).toEqual([])
    expect(hover(null, "mouse")).toEqual([])
    expect(hover("edit", "mouse")).toEqual([])
  })
})
