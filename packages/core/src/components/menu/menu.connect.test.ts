// The Menu's attributes (openspec add-menu): "Roles And ARIA Attributes", "Accessible Name",
// "Data Attributes", "Groups, Labels And Separators", "Submenu Triggers On Apple Platforms".
import { describe, expect, it, vi } from "vitest"
import { createListCollection, toKey } from "../../collection"
import { CRITICAL } from "../../connect/props"
import { placementFrom, unplaced } from "../../dom/position/connect"
import type { PlatformFlags } from "../../env/capabilities"
import {
  type MenuConnectEnv,
  type MenuConnectInput,
  type MenuItemState,
  menuConnect,
} from "./menu.connect"
import { type MenuEvent, menuIds } from "./menu.machine"

const flags = (over: Partial<PlatformFlags> = {}): PlatformFlags => ({
  engine: "blink",
  apple: false,
  mac: false,
  ios: false,
  android: false,
  windows: true,
  webkit: false,
  chromium: true,
  firefox: false,
  ...over,
})
const mkEnv = (
  over: { platform?: Partial<PlatformFlags>; dir?: "ltr" | "rtl" } = {},
): MenuConnectEnv => ({
  platform: flags(over.platform),
  modality: { modality: () => "keyboard" } as MenuConnectEnv["modality"],
  locale: { dir: () => over.dir ?? "ltr" },
})

const collection = createListCollection({
  items: ["a", "b"],
  getKey: (x) => x,
  getText: (x) => x,
})
const placed = placementFrom({ side: "bottom", align: "start", anchorHidden: false } as never)
const base: MenuConnectInput = {
  instance: "m",
  level: "root",
  open: true,
  modal: false,
  placement: placed,
  closeReason: null,
  collection,
  highlightedKey: null,
  highlightSource: null,
  typingAhead: () => false,
  contentMounted: true,
}
const ids = menuIds("m")

function setup(over: Partial<MenuConnectInput> = {}, envOver: Parameters<typeof mkEnv>[0] = {}) {
  const send = vi.fn<(e: MenuEvent) => void>()
  return { send, api: menuConnect({ ...base, ...over }, send, mkEnv(envOver)) }
}

const btn = (over = {}) => ({
  focused: false,
  modality: "keyboard" as const,
  pressed: false,
  tag: "button",
  ...over,
})
const item = (over: Partial<MenuItemState> = {}): MenuItemState => ({
  kind: "item",
  disabled: false,
  closeOnSelect: true,
  ...over,
})

type Handler = (e: unknown) => void
const call = (p: object, name: string, e: unknown) => (p as Record<string, Handler>)[name]?.(e)

/** A keydown on the content element itself. */
const keyEvent = (key: string, over: Record<string, unknown> = {}) => {
  const content = { tagName: "DIV", getAttribute: () => null, hasAttribute: () => false }
  return {
    key,
    code: key,
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    repeat: false,
    target: content,
    currentTarget: content,
    timeStamp: 0,
    preventDefault: vi.fn(),
    ...over,
  }
}
const el = (attrs: Record<string, string>, tagName = "DIV") => ({
  tagName,
  getAttribute: (n: string) => attrs[n] ?? null,
  hasAttribute: (n: string) => n in attrs,
})
const ownItem = el({ "data-scope": "menu", "data-instance": "m", "data-part": "item" })

const keydown = (
  key: string,
  over: Record<string, unknown> = {},
  input: Partial<MenuConnectInput> = {},
  envOver: Parameters<typeof mkEnv>[0] = {},
) => {
  const { api, send } = setup(input, envOver)
  const e = keyEvent(key, over)
  call(api.content({}), "onKeyDown", e)
  return { send, e }
}

describe("trigger", () => {
  it("has haspopup, expanded, controls when mounted, state", () => {
    const { api } = setup()
    const p = api.trigger(btn())
    expect(p["aria-haspopup"]).toBe("menu")
    expect(p["aria-expanded"]).toBe("true")
    expect(p["aria-controls"]).toBe(ids.content)
    expect(p["data-state"]).toBe("open")
    expect(p["id"]).toBe(ids.trigger)
    expect(p[CRITICAL]).toContain("aria-expanded")
  })

  it("closed and unmounted: no aria-controls", () => {
    const p = setup({ open: false, contentMounted: false }).api.trigger(btn())
    expect(p["aria-expanded"]).toBe("false")
    expect(p["aria-controls"]).toBeUndefined()
    expect(p["data-state"]).toBe("closed")
  })

  it("data-disabled when disabled", () => {
    expect(setup().api.trigger(btn({ disabled: true }))["data-disabled"]).toBe("")
    expect(setup().api.trigger(btn())["data-disabled"]).toBeUndefined()
  })

  it("menubar mode: menuitem, roving tabindex, no button role", () => {
    const p = setup({ inMenubar: true }).api.trigger(btn({ tabIndex: 0 }))
    expect(p["role"]).toBe("menuitem")
    expect(p["tabindex"]).toBe(0)
    expect(p["aria-haspopup"]).toBe("menu")
    expect(setup({ inMenubar: true }).api.trigger(btn())["tabindex"]).toBe(-1)
  })

  it("standalone mode is a button", () => {
    expect(setup().api.trigger(btn({ tag: "div" }))["role"]).toBe("button")
  })

  describe("ArrowDown / ArrowUp on a closed trigger", () => {
    const press = (
      key: string,
      over: Record<string, unknown> = {},
      input: Partial<MenuConnectInput> = { open: false },
      state = {},
    ) => {
      const { api, send } = setup(input)
      const t = {}
      const e = {
        key,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        target: t,
        currentTarget: t,
        preventDefault: vi.fn(),
        ...over,
      }
      call(api.trigger(btn(state)), "onKeyDown", e)
      return { send, e }
    }

    it("ArrowDown opens on first, ArrowUp on last, with preventDefault", () => {
      const down = press("ArrowDown")
      expect(down.send).toHaveBeenCalledWith({ type: "TRIGGER_KEY", key: "first" })
      expect(down.e.preventDefault).toHaveBeenCalled()
      const up = press("ArrowUp")
      expect(up.send).toHaveBeenCalledWith({ type: "TRIGGER_KEY", key: "last" })
    })

    it("ignored when open, disabled, modified, composing, foreign target, menubar or other key", () => {
      expect(press("ArrowDown", {}, { open: true }).send).not.toHaveBeenCalled()
      expect(
        press("ArrowDown", {}, { open: false }, { disabled: true }).send,
      ).not.toHaveBeenCalled()
      for (const m of ["altKey", "ctrlKey", "metaKey", "isComposing"]) {
        expect(press("ArrowDown", { [m]: true }).send).not.toHaveBeenCalled()
      }
      expect(press("ArrowDown", { target: {} }).send).not.toHaveBeenCalled()
      expect(press("ArrowDown", {}, { open: false, inMenubar: true }).send).not.toHaveBeenCalled()
      expect(press("Enter").send).not.toHaveBeenCalled()
    })
  })
})

describe("content", () => {
  it("role menu, tabindex -1, labelled by the trigger", () => {
    const p = setup().api.content({})
    expect(p["role"]).toBe("menu")
    expect(p["tabindex"]).toBe(-1)
    expect(p["id"]).toBe(ids.content)
    expect(p["aria-labelledby"]).toBe(ids.trigger)
    expect(p["data-state"]).toBe("open")
    expect(p["data-orientation"]).toBe("vertical")
  })

  it("a submenu is labelled by its trigger item", () => {
    expect(
      setup({ level: "submenu", labelledBy: "sub-trigger" }).api.content({})["aria-labelledby"],
    ).toBe("sub-trigger")
  })

  it("an own aria-label drops the default labelledby", () => {
    const p = setup({ labelledBy: "x" }).api.content({ label: "Actions" })
    expect(p["aria-label"]).toBe("Actions")
    expect(p["aria-labelledby"]).toBeUndefined()
  })

  it("an own labelledBy wins", () => {
    expect(setup().api.content({ labelledBy: "mine" })["aria-labelledby"]).toBe("mine")
  })

  it("aria-orientation only when horizontal", () => {
    expect(setup().api.content({})["aria-orientation"]).toBeUndefined()
    const h = setup({ orientation: "horizontal" }).api.content({})
    expect(h["aria-orientation"]).toBe("horizontal")
    expect(h["data-orientation"]).toBe("horizontal")
  })

  it("data-modal only for root + modal", () => {
    expect(setup({ modal: true }).api.content({})["data-modal"]).toBe("")
    expect(setup({ modal: false }).api.content({})["data-modal"]).toBeUndefined()
    expect(setup({ modal: true, level: "submenu" }).api.content({})["data-modal"]).toBeUndefined()
  })

  it("data-close-reason only while closed", () => {
    expect(
      setup({ open: false, closeReason: "escape-key" }).api.content({})["data-close-reason"],
    ).toBe("escape-key")
    expect(
      setup({ open: true, closeReason: "escape-key" }).api.content({})["data-close-reason"],
    ).toBeUndefined()
    expect(
      setup({ open: false, closeReason: null }).api.content({})["data-close-reason"],
    ).toBeUndefined()
  })

  it("layer meta adds nesting attributes and an unplaced animation guard", () => {
    const meta = { index: 1, nested: true, hasNested: false, nestedCount: 0 } as never
    const p = setup({ meta, placement: unplaced("bottom", "start") }).api.content({})
    expect(p["data-nested"]).toBe("")
    expect(p["data-has-nested"]).toBeUndefined()
    expect(p["style"]).toMatchObject({ "animation-name": "none", "--layer-index": "1" })
  })

  it("pointer leave sends POINTER_LEAVE for mouse, not touch or closed", () => {
    const { api, send } = setup()
    call(api.content({}), "onPointerLeave", { pointerType: "mouse" })
    expect(send).toHaveBeenCalledWith({ type: "POINTER_LEAVE" })
    send.mockClear()
    call(api.content({}), "onPointerLeave", { pointerType: "touch" })
    call(setup({ open: false }).api.content({}), "onPointerLeave", { pointerType: "mouse" })
    expect(send).not.toHaveBeenCalled()
  })
})

describe("content keyboard", () => {
  it("ArrowDown navigates next with preventDefault", () => {
    const { send, e } = keydown("ArrowDown")
    expect(send).toHaveBeenCalledWith({ type: "NAVIGATE", move: "next" })
    expect(e.preventDefault).toHaveBeenCalled()
  })

  it("ArrowUp, Home, End", () => {
    expect(keydown("ArrowUp").send).toHaveBeenCalledWith({ type: "NAVIGATE", move: "previous" })
    expect(keydown("Home").send).toHaveBeenCalledWith({ type: "NAVIGATE", move: "first" })
    expect(keydown("End").send).toHaveBeenCalledWith({ type: "NAVIGATE", move: "last" })
  })

  it("Tab sends TAB_KEY and does not preventDefault", () => {
    const { send, e } = keydown("Tab", { shiftKey: true })
    expect(send).toHaveBeenCalledWith({ type: "TAB_KEY", shift: true })
    expect(e.preventDefault).not.toHaveBeenCalled()
  })

  it("Enter and Space on an item activate with the right flag", () => {
    const enter = keydown("Enter", { target: ownItem })
    expect(enter.send).toHaveBeenCalledWith({ type: "KEY_ACTIVATE", space: false })
    expect(enter.e.preventDefault).toHaveBeenCalled()
    const space = keydown(" ", { target: ownItem })
    expect(space.send).toHaveBeenCalledWith({ type: "KEY_ACTIVATE", space: true })
    expect(space.e.preventDefault).toHaveBeenCalled()
  })

  it("Enter on the content itself sends nothing", () => {
    expect(keydown("Enter").send).not.toHaveBeenCalled()
  })

  it("modified Enter sends nothing", () => {
    expect(keydown("Enter", { target: ownItem, ctrlKey: true }).send).not.toHaveBeenCalled()
  })

  it("Space while typing ahead extends the search", () => {
    const { send, e } = keydown(" ", { target: ownItem }, { typingAhead: () => true })
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ type: "TYPEAHEAD", char: " ", composing: false }),
    )
    expect(e.preventDefault).toHaveBeenCalled()
  })

  it("Enter on an <a href> target sends nothing and keeps the browser's activation", () => {
    const link = el(
      { "data-scope": "menu", "data-instance": "m", "data-part": "item", href: "/x" },
      "A",
    )
    const { send, e } = keydown("Enter", { target: link })
    expect(send).not.toHaveBeenCalled()
    expect(e.preventDefault).not.toHaveBeenCalled()
  })

  it("a printable character is typeahead", () => {
    const { send, e } = keydown("s")
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ type: "TYPEAHEAD", char: "s", composing: false }),
    )
    expect(e.preventDefault).toHaveBeenCalled()
  })

  it("a modified printable character is not typeahead", () => {
    expect(keydown("s", { ctrlKey: true }).send).not.toHaveBeenCalled()
  })

  it("ArrowRight expands, ArrowLeft collapses (ltr)", () => {
    const r = keydown("ArrowRight")
    expect(r.send).toHaveBeenCalledWith({ type: "EXPAND" })
    expect(r.e.preventDefault).toHaveBeenCalled()
    expect(keydown("ArrowLeft").send).toHaveBeenCalledWith({ type: "COLLAPSE" })
  })

  it("arrows mirror in rtl", () => {
    expect(keydown("ArrowLeft", {}, {}, { dir: "rtl" }).send).toHaveBeenCalledWith({
      type: "EXPAND",
    })
    expect(keydown("ArrowRight", {}, {}, { dir: "rtl" }).send).toHaveBeenCalledWith({
      type: "COLLAPSE",
    })
  })

  it("composing keys are ignored", () => {
    expect(keydown("ArrowDown", { isComposing: true }).send).not.toHaveBeenCalled()
    expect(keydown("a", { keyCode: 229 }).send).not.toHaveBeenCalled()
  })

  it("a foreign target inside (an input without data-scope) sends nothing", () => {
    const input = el({}, "INPUT")
    for (const key of ["ArrowDown", "Enter", " ", "a", "Tab"]) {
      const { send, e } = keydown(key, { target: input })
      expect(send, key).not.toHaveBeenCalled()
      expect(e.preventDefault, key).not.toHaveBeenCalled()
    }
  })

  it("an item of another menu level is foreign", () => {
    const other = el({ "data-scope": "menu", "data-instance": "other", "data-part": "item" })
    expect(keydown("ArrowDown", { target: other }).send).not.toHaveBeenCalled()
  })
})

describe("items", () => {
  it.each([
    ["item", "menuitem"],
    ["link-item", "menuitem"],
    ["checkbox-item", "menuitemcheckbox"],
    ["radio-item", "menuitemradio"],
  ] as const)("%s has role %s", (kind, role) => {
    expect(setup().api.item(toKey("a"), item({ kind }))["role"]).toBe(role)
  })

  it("aria-checked and data-state only for checkable kinds", () => {
    const { api } = setup()
    const plain = api.item(toKey("a"), item())
    expect(plain["aria-checked"]).toBeUndefined()
    expect(plain["data-state"]).toBeUndefined()
    const on = api.item(toKey("a"), item({ kind: "checkbox-item", checked: true }))
    expect(on["aria-checked"]).toBe("true")
    expect(on["data-state"]).toBe("checked")
    const off = api.item(toKey("a"), item({ kind: "radio-item", checked: false }))
    expect(off["aria-checked"]).toBe("false")
    expect(off["data-state"]).toBe("unchecked")
    expect(api.item(toKey("a"), item({ kind: "checkbox-item" }))["aria-checked"]).toBe("false")
  })

  it("part names: link-item is an item, others keep their kind", () => {
    const { api } = setup()
    expect(api.item(toKey("a"), item({ kind: "link-item" }))["data-part"]).toBe("item")
    expect(api.item(toKey("a"), item({ kind: "checkbox-item" }))["data-part"]).toBe("checkbox-item")
    expect(api.item(toKey("a"), item({ kind: "radio-item" }))["data-part"]).toBe("radio-item")
    expect(api.item(toKey("a"), item())["id"]).toBe(ids.item(toKey("a")))
    expect(api.item(toKey("a"), item())["tabindex"]).toBe(-1)
  })

  it("data-highlighted for the highlighted key present in the collection", () => {
    const { api } = setup({ highlightedKey: toKey("a") })
    expect(api.item(toKey("a"), item())["data-highlighted"]).toBe("")
    expect(api.item(toKey("b"), item())["data-highlighted"]).toBeUndefined()
    expect(
      setup({ highlightedKey: toKey("zzz") }).api.item(toKey("zzz"), item())["data-highlighted"],
    ).toBeUndefined()
  })

  it("data-focus-visible only for keyboard (and typeahead) highlights", () => {
    const at = (highlightSource: string | null) =>
      setup({ highlightedKey: toKey("a"), highlightSource }).api.item(toKey("a"), item())[
        "data-focus-visible"
      ]
    expect(at("keyboard")).toBe("")
    expect(at("typeahead")).toBe("")
    expect(at("pointer")).toBeUndefined()
    expect(
      setup({ highlightSource: "keyboard" }).api.item(toKey("a"), item())["data-focus-visible"],
    ).toBeUndefined()
  })

  it("disabled: aria-disabled and data-disabled", () => {
    const p = setup().api.item(toKey("a"), item({ disabled: true }))
    expect(p["aria-disabled"]).toBe("true")
    expect(p["data-disabled"]).toBe("")
    expect(setup().api.item(toKey("a"), item())["aria-disabled"]).toBeUndefined()
  })

  it("click sends ITEM_ACTIVATE with kind, closeOnSelect and modality", () => {
    const { api, send } = setup()
    call(api.item(toKey("a"), item({ kind: "checkbox-item", closeOnSelect: false })), "onClick", {})
    expect(send).toHaveBeenCalledWith({
      type: "ITEM_ACTIVATE",
      key: "a",
      kind: "checkbox-item",
      closeOnSelect: false,
      modality: "keyboard",
    })
  })

  it("disabled click prevents default and sends nothing", () => {
    const { api, send } = setup()
    const e = { preventDefault: vi.fn() }
    call(api.item(toKey("a"), item({ disabled: true })), "onClick", e)
    expect(e.preventDefault).toHaveBeenCalled()
    expect(send).not.toHaveBeenCalled()
  })

  it("link-item click sends nothing; activateLink does", () => {
    const { api, send } = setup()
    call(api.item(toKey("a"), item({ kind: "link-item" })), "onClick", {})
    expect(send).not.toHaveBeenCalled()
    api.activateLink(toKey("a"), "pointer")
    expect(send).toHaveBeenCalledWith({
      type: "ITEM_ACTIVATE",
      key: "a",
      kind: "link-item",
      closeOnSelect: true,
      modality: "pointer",
    })
  })

  describe("pointermove", () => {
    const move = (disabled: boolean, over: Record<string, unknown> = {}, input = {}) => {
      const { api, send } = setup(input)
      call(api.item(toKey("a"), item({ disabled })), "onPointerMove", {
        pointerType: "mouse",
        clientX: 1,
        clientY: 1,
        currentTarget: { ownerDocument: { defaultView: null } },
        ...over,
      })
      return send
    }

    it("highlights an enabled item", () => {
      expect(move(false)).toHaveBeenCalledWith({ type: "POINTER_MOVE", key: "a" })
    })

    it("a disabled item sends POINTER_LEAVE", () => {
      expect(move(true)).toHaveBeenCalledWith({ type: "POINTER_LEAVE" })
    })

    it("ignores touch and a closed menu", () => {
      expect(move(false, { pointerType: "touch" })).not.toHaveBeenCalled()
      expect(move(false, {}, { open: false })).not.toHaveBeenCalled()
    })
  })

  it("focus highlights with a source from the modality", () => {
    const { api, send } = setup()
    call(api.item(toKey("a"), item()), "onFocus", {})
    expect(send).toHaveBeenCalledWith({ type: "HIGHLIGHT", key: "a", source: "keyboard" })
    send.mockClear()
    call(setup({ highlightedKey: toKey("a") }).api.item(toKey("a"), item()), "onFocus", {})
    expect(send).not.toHaveBeenCalled()
  })
})

describe("submenuTrigger", () => {
  const sub = (open: boolean, over = {}) => ({
    disabled: false,
    focused: false,
    open,
    contentId: "sub-content",
    contentMounted: true,
    ...over,
  })

  it("haspopup, expanded mirrors open, controls when mounted, state", () => {
    const { api } = setup()
    const closed = api.submenuTrigger(toKey("a"), sub(false, { contentMounted: false }))
    expect(closed["role"]).toBe("menuitem")
    expect(closed["aria-haspopup"]).toBe("menu")
    expect(closed["aria-expanded"]).toBe("false")
    expect(closed["aria-controls"]).toBeUndefined()
    expect(closed["data-state"]).toBe("closed")
    const open = api.submenuTrigger(toKey("a"), sub(true))
    expect(open["aria-expanded"]).toBe("true")
    expect(open["aria-controls"]).toBe("sub-content")
    expect(open["data-state"]).toBe("open")
  })

  it("stays highlighted while open only when focused", () => {
    const { api } = setup({ highlightedKey: toKey("a") })
    expect(api.submenuTrigger(toKey("a"), sub(false))["data-highlighted"]).toBe("")
    expect(api.submenuTrigger(toKey("a"), sub(true))["data-highlighted"]).toBeUndefined()
    expect(api.submenuTrigger(toKey("a"), sub(true, { focused: true }))["data-highlighted"]).toBe(
      "",
    )
  })

  it("Apple platform: aria-expanded omitted while open (vo-submenu-expanded), kept when closed", () => {
    const { api } = setup({}, { platform: { apple: true, mac: true, windows: false } })
    expect(api.submenuTrigger(toKey("a"), sub(true))["aria-expanded"]).toBeUndefined()
    expect(api.submenuTrigger(toKey("a"), sub(false))["aria-expanded"]).toBe("false")
  })

  it("Windows keeps aria-expanded while open", () => {
    expect(setup().api.submenuTrigger(toKey("a"), sub(true))["aria-expanded"]).toBe("true")
  })
})

describe("separator", () => {
  it("vertical menu: horizontal separator, no aria-orientation", () => {
    const p = setup().api.separator({ tag: "div" })
    expect(p["role"]).toBe("separator")
    expect(p["data-orientation"]).toBe("horizontal")
    expect(p["aria-orientation"]).toBeUndefined()
  })

  it("horizontal menu: vertical separator with aria-orientation", () => {
    const p = setup({ orientation: "horizontal" }).api.separator({ tag: "div" })
    expect(p["data-orientation"]).toBe("vertical")
    expect(p["aria-orientation"]).toBe("vertical")
  })

  it("an explicit orientation wins", () => {
    const p = setup().api.separator({ tag: "div", orientation: "vertical" })
    expect(p["data-orientation"]).toBe("vertical")
    expect(p["aria-orientation"]).toBe("vertical")
  })
})

describe("groups", () => {
  it("group is labelled by its label", () => {
    const p = setup().api.group("g-label")
    expect(p["role"]).toBe("group")
    expect(p["aria-labelledby"]).toBe("g-label")
    expect(p["data-part"]).toBe("group")
  })

  it("groupLabel carries the id", () => {
    const p = setup().api.groupLabel("g-label")
    expect(p["id"]).toBe("g-label")
    expect(p["data-part"]).toBe("group-label")
  })

  it("itemIndicator is hidden and mirrors checked", () => {
    const { api } = setup()
    expect(api.itemIndicator(true)["aria-hidden"]).toBe("true")
    expect(api.itemIndicator(true)["data-state"]).toBe("checked")
    expect(api.itemIndicator(false)["data-state"]).toBe("unchecked")
  })

  it("radioGroup is a group with data-disabled", () => {
    const { api } = setup()
    const p = api.radioGroup({ disabled: true, labelledBy: "l" })
    expect(p["role"]).toBe("group")
    expect(p["aria-labelledby"]).toBe("l")
    expect(p["data-disabled"]).toBe("")
    expect(api.radioGroup({ disabled: false })["data-disabled"]).toBeUndefined()
  })
})
