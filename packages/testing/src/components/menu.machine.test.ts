// The Menu machine in Node (openspec add-menu): every transition, close reasons, controlled
// refusal, item activation, submenu levels over a real MenuTree, the menubar host and
// navigation. Without a `document` the `open` effect (layer, positioning, focus) is a no-op,
// so the real machine runs unchanged; DOM wiring is covered by the jsdom and browser suites.

import {
  type CollectionKey,
  createListCollection,
  createMenuTree,
  createService,
  dismissRequest,
  type MenuCloseReason,
  type MenuEvent,
  type MenuLevelId,
  type MenuProps,
  type MenuTree,
  type MenuTreeHost,
  menuIds,
  menuLevelId,
  menuMachine,
  toKey,
} from "@rind-ui/core"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

interface Row {
  id: string
  disabled?: boolean
}
const rows = (...ids: string[]) =>
  createListCollection<Row>({
    items: ids.map((id) => ({ id, disabled: id.startsWith("x") })),
    getKey: (r) => r.id,
    getText: (r) => r.id,
    isDisabled: (r) => r.disabled === true,
  })

type Ctx = {
  closeReason: MenuCloseReason | null
  restoreFocus: boolean
  openToLast: boolean
  openModality: string | null
  hoverOpened: boolean
  keyActivation: "enter" | "space" | null
  highlightedKey: CollectionKey | null
  regionAnchor: unknown
}

const ROOT = menuLevelId("m")
const SUB = menuLevelId("s")

function make(
  over: Partial<MenuProps> = {},
  tree: MenuTree = createMenuTree(),
  extraEnv: Record<string, unknown> = {},
) {
  const level = over.level ?? "root"
  const levelId = over.levelId ?? (level === "root" ? ROOT : SUB)
  const env = {
    dom: { getById: () => null, activeElement: () => null },
    modality: { modality: () => "keyboard" },
    scheduler: {
      // fake-time: the `after` delay (submenu open delay) runs on vi fake timers
      setTimeout: (cb: () => void, ms: number) => setTimeout(cb, ms),
      clearTimeout: (h: unknown) => clearTimeout(h as never),
      requestAnimationFrame: () => 0,
      cancelAnimationFrame: () => {},
    },
    clock: { now: () => Date.now() },
    locale: { locale: () => "en-US" },
    menuTree: tree,
    ...extraEnv,
  }
  const onOpenChange = vi.fn()
  const props: MenuProps = {
    collection: rows("a", "b", "c"),
    strategy: "roving",
    ids: { list: "list", item: (k) => `item-${k}` },
    level,
    levelId,
    ...(level === "submenu" ? { parentLevel: ROOT } : {}),
    getTrigger: () => null,
    focusableWhenDisabled: false,
    loop: true,
    onOpenChange,
    ...over,
  }
  const s = createService(menuMachine, props as never, env as never)
  s.start()
  return {
    s,
    tree,
    onOpenChange,
    state: () => s.getSnapshot().state as string,
    open: () => (s.view().values as Record<string, unknown>)["open"],
    ctx: () => s.getSnapshot().context as unknown as Ctx,
    send: (e: MenuEvent) => s.send(e as never),
    setProps: (p: Partial<MenuProps>) => s.setProps({ ...props, ...p } as never),
    changes: () => onOpenChange.mock.calls.map((c) => [c[0], c[1].reason]),
    last: () => onOpenChange.mock.calls.at(-1) as [boolean, { reason: string }] | undefined,
  }
}

const press: MenuEvent = { type: "TRIGGER_PRESS", modality: "pointer" }
const dismissal = (
  type: "ESCAPE_KEY" | "OUTSIDE_PRESS" | "OUTSIDE_FOCUS" | "PARENT_DISMISSED",
): MenuEvent => {
  const reason = {
    ESCAPE_KEY: "escape-key",
    OUTSIDE_PRESS: "outside-press",
    OUTSIDE_FOCUS: "outside-focus",
    PARENT_DISMISSED: "parent-dismissed",
  } as const
  return { type, request: dismissRequest(reason[type], undefined, null) }
}
const activate = (
  key: string,
  kind: "item" | "checkbox-item" | "radio-item" | "link-item" = "item",
  closeOnSelect = true,
  modality: "pointer" | "keyboard" = "pointer",
): MenuEvent => ({
  type: "ITEM_ACTIVATE",
  key: toKey(key),
  kind,
  closeOnSelect,
  modality,
})

function opened(over: Partial<MenuProps> = {}) {
  const m = make(over)
  m.send(press)
  m.onOpenChange.mockClear()
  return m
}

describe("opening", () => {
  it("starts closed and not open", () => {
    const m = make()
    expect(m.state()).toBe("closed")
    expect(m.open()).toBe(false)
  })

  it("TRIGGER_PRESS opens with reason trigger and records the modality", () => {
    const m = make()
    m.send({ type: "TRIGGER_PRESS", modality: "touch" })
    expect(m.state()).toBe("open")
    expect(m.open()).toBe(true)
    expect(m.changes()).toEqual([[true, "trigger"]])
    expect(m.ctx().openModality).toBe("touch")
    expect(m.ctx().closeReason).toBeNull()
  })

  it("TRIGGER_KEY opens with reason trigger-key; key last sets openToLast", () => {
    const first = make()
    first.send({ type: "TRIGGER_KEY", key: "first" })
    expect(first.changes()).toEqual([[true, "trigger-key"]])
    expect(first.ctx().openToLast).toBe(false)
    expect(first.ctx().openModality).toBe("keyboard")

    const last = make()
    last.send({ type: "TRIGGER_KEY", key: "last" })
    expect(last.ctx().openToLast).toBe(true)
  })

  it("OPEN opens with reason api", () => {
    const m = make()
    m.send({ type: "OPEN" })
    expect(m.changes()).toEqual([[true, "api"]])
  })

  it("a submenu ignores TRIGGER_KEY", () => {
    const m = make({ level: "submenu" })
    m.send({ type: "TRIGGER_KEY", key: "first" })
    expect(m.state()).toBe("closed")
    expect(m.onOpenChange).not.toHaveBeenCalled()
  })

  it("SUB_OPEN opens a submenu (reason trigger), is ignored at the root", () => {
    const sub = make({ level: "submenu" })
    sub.send({ type: "SUB_OPEN" })
    expect(sub.changes()).toEqual([[true, "trigger"]])
    expect(sub.ctx().openModality).toBe("keyboard")
    const root = make()
    root.send({ type: "SUB_OPEN" })
    expect(root.state()).toBe("closed")
  })

  it("each open resets the close reason, restoreFocus and the highlight", () => {
    const m = opened()
    m.send({ type: "WINDOW_BLUR" })
    expect(m.ctx().restoreFocus).toBe(false)
    m.send(press)
    expect(m.ctx().restoreFocus).toBe(true)
    expect(m.ctx().closeReason).toBeNull()
    expect(m.ctx().highlightedKey).toBeNull()
  })
})

describe("closing", () => {
  const CLOSERS: [MenuCloseReason, MenuEvent][] = [
    ["trigger", press],
    ["escape-key", dismissal("ESCAPE_KEY")],
    ["outside-press", dismissal("OUTSIDE_PRESS")],
    ["outside-focus", dismissal("OUTSIDE_FOCUS")],
    ["parent-dismissed", dismissal("PARENT_DISMISSED")],
    ["window-blur", { type: "WINDOW_BLUR" }],
    ["api", { type: "CLOSE" }],
    ["tab-key", { type: "TAB_KEY", shift: false }],
    ["trigger", { type: "TREE.CLOSE", reason: "trigger" }],
    ["item-select", { type: "TREE.CLOSE", reason: "item-select" }],
    ["escape-key", { type: "TREE.CLOSE", reason: "escape-key" }],
    ["tab-key", { type: "TREE.CLOSE", reason: "tab-key" }],
    ["outside-press", { type: "TREE.CLOSE", reason: "outside-press" }],
    ["outside-focus", { type: "TREE.CLOSE", reason: "outside-focus" }],
    ["window-blur", { type: "TREE.CLOSE", reason: "window-blur" }],
    ["parent-dismissed", { type: "TREE.CLOSE", reason: "parent-dismissed" }],
    ["api", { type: "TREE.CLOSE", reason: "api" }],
  ]

  it.each(CLOSERS)("reports %s via %o", (reason, event) => {
    const m = opened()
    m.send(event)
    expect(m.state()).toBe("closed")
    expect(m.open()).toBe(false)
    expect(m.changes()).toEqual([[false, reason]])
    expect(m.ctx().closeReason).toBe(reason)
  })

  it("PARENT_DISMISSED carries its request to onOpenChange details", () => {
    const m = opened()
    const event = dismissal("PARENT_DISMISSED")
    m.send(event)
    expect(m.last()?.[1]).toMatchObject({ reason: "parent-dismissed" })
  })

  it("WINDOW_BLUR does not restore focus; Escape does", () => {
    const blur = opened()
    blur.send({ type: "WINDOW_BLUR" })
    expect(blur.ctx().restoreFocus).toBe(false)
    const esc = opened()
    esc.send(dismissal("ESCAPE_KEY"))
    expect(esc.ctx().restoreFocus).toBe(true)
  })

  it("WINDOW_BLUR is ignored by a submenu", () => {
    const tree = createMenuTree()
    const root = make({}, tree)
    root.send(press)
    const sub = make({ level: "submenu" }, tree)
    sub.send({ type: "SUB_OPEN" })
    sub.send({ type: "WINDOW_BLUR" })
    expect(sub.state()).toBe("open")
  })

  it("TREE.SIBLING_OPENED closes without restoring focus", () => {
    const m = opened()
    m.send({ type: "TREE.SIBLING_OPENED" })
    expect(m.state()).toBe("closed")
    expect(m.ctx().restoreFocus).toBe(false)
  })

  it("closed ignores every closer", () => {
    const m = make()
    for (const [, e] of [
      ["escape-key", dismissal("ESCAPE_KEY")],
      ["x", { type: "CLOSE" }],
    ] as [string, MenuEvent][]) {
      m.send(e)
    }
    expect(m.state()).toBe("closed")
    expect(m.onOpenChange).not.toHaveBeenCalled()
  })

  it("Tab at the root focuses the root trigger and closes with tab-key", () => {
    const focus = vi.fn()
    const tree = createMenuTree()
    const m = make({ getTrigger: () => ({ focus }) as never }, tree)
    m.send(press)
    m.send({ type: "TAB_KEY", shift: true })
    expect(m.changes().at(-1)).toEqual([false, "tab-key"])
    expect(focus).toHaveBeenCalledTimes(1)
  })

  it("Tab in a submenu closes the whole tree (root reports tab-key)", () => {
    const tree = createMenuTree()
    const root = make({}, tree)
    root.send(press)
    const sub = make({ level: "submenu" }, tree)
    sub.send({ type: "SUB_OPEN" })
    root.onOpenChange.mockClear()
    sub.send({ type: "TAB_KEY", shift: false })
    expect(root.state()).toBe("closed")
    expect(root.changes()).toEqual([[false, "tab-key"]])
  })
})

describe("controlled", () => {
  it("Escape proposes onOpenChange(false, escape-key) and stays open", () => {
    const m = make({ open: true })
    expect(m.state()).toBe("open")
    m.send(dismissal("ESCAPE_KEY"))
    expect(m.changes()).toEqual([[false, "escape-key"]])
    expect(m.state()).toBe("open")
    expect(m.open()).toBe(true)
  })

  it("the parent accepting the proposal closes it", () => {
    const m = make({ open: true })
    m.send(dismissal("ESCAPE_KEY"))
    m.setProps({ open: false })
    expect(m.open()).toBe(false)
  })

  // open=false resolves to the first false state in declaration order: `closed` must come
  // before `opening`, or the root's `after` would reopen it.
  it("a controlled close lands in `closed`, not `opening`", () => {
    const m = make({ open: true })
    m.setProps({ open: false })
    expect(m.state()).toBe("closed")
    // fake-time: past the 100 ms submenu delay that `opening` would run (no reopen)
    vi.advanceTimersByTime(1000)
    expect(m.state()).toBe("closed")
  })

  it("controlled closed: a press proposes open and stays closed", () => {
    const m = make({ open: false })
    m.send(press)
    expect(m.changes()).toEqual([[true, "trigger"]])
    expect(m.state()).toBe("closed")
  })
})

describe("ITEM_ACTIVATE", () => {
  it("calls onActivate with key, kind, modality and via, then closes with item-select", () => {
    const onActivate = vi.fn(() => true)
    const m = opened({ onActivate })
    m.send(activate("b", "checkbox-item", true, "pointer"))
    expect(onActivate).toHaveBeenCalledWith({
      key: "b",
      kind: "checkbox-item",
      modality: "pointer",
      via: null,
    })
    expect(m.state()).toBe("closed")
    expect(m.changes()).toEqual([[false, "item-select"]])
    expect(m.ctx().closeReason).toBe("item-select")
  })

  it("stays open when onActivate returns false", () => {
    const m = opened({ onActivate: () => false })
    m.send(activate("a"))
    expect(m.state()).toBe("open")
  })

  it("stays open when closeOnSelect is false", () => {
    const m = opened({ onActivate: () => true })
    m.send(activate("a", "item", false))
    expect(m.state()).toBe("open")
  })

  it("closes without an onActivate", () => {
    const m = opened()
    m.send(activate("a", "link-item"))
    expect(m.state()).toBe("closed")
  })

  // Space is dispatched through the highlighted item's click; the fake item's click sends
  // the ITEM_ACTIVATE a real element would, while keyActivation is set.
  function keyed(kind: "item" | "checkbox-item" | "radio-item", space: boolean) {
    const onActivate = vi.fn(() => true)
    let service: ReturnType<typeof make> | undefined
    const click = vi.fn(() => service?.send(activate("a", kind, true, "keyboard")))
    const m = make({ onActivate }, createMenuTree(), {
      dom: {
        getById: (id: string) =>
          id === menuIds(ROOT).item(toKey("a")) ? { click, focus: () => {} } : null,
        activeElement: () => null,
      },
    })
    service = m
    m.send(press)
    m.onOpenChange.mockClear()
    m.send({ type: "HIGHLIGHT", key: toKey("a"), source: "keyboard" })
    m.send({ type: "KEY_ACTIVATE", space })
    return { m, onActivate, click }
  }

  it("Enter on a checkbox item closes and reports via enter", () => {
    const { m, onActivate, click } = keyed("checkbox-item", false)
    expect(click).toHaveBeenCalledTimes(1)
    expect(onActivate).toHaveBeenCalledWith(expect.objectContaining({ via: "enter" }))
    expect(m.state()).toBe("closed")
    expect(m.ctx().keyActivation).toBeNull()
  })

  it.each(["checkbox-item", "radio-item"] as const)(
    "Space on a %s activates (via space) but keeps the menu open",
    (kind) => {
      const { m, onActivate } = keyed(kind, true)
      expect(onActivate).toHaveBeenCalledWith(expect.objectContaining({ via: "space" }))
      expect(m.state()).toBe("open")
      expect(m.ctx().keyActivation).toBeNull()
    },
  )

  it("Space on a plain item closes", () => {
    const { m } = keyed("item", true)
    expect(m.state()).toBe("closed")
  })

  it("KEY_ACTIVATE with nothing highlighted does nothing", () => {
    const m = opened()
    m.send({ type: "KEY_ACTIVATE", space: false })
    expect(m.ctx().keyActivation).toBeNull()
    expect(m.state()).toBe("open")
  })
})

describe("submenu level", () => {
  function pair(subOver: Partial<MenuProps> = {}) {
    const tree = createMenuTree()
    const root = make({}, tree)
    root.send(press)
    const sub = make({ level: "submenu", ...subOver }, tree)
    return { tree, root, sub }
  }

  it("HOVER.START opens after the default 100 ms, hoverOpened true", () => {
    const { sub } = pair()
    sub.send({ type: "HOVER.START" })
    expect(sub.state()).toBe("opening")
    expect(sub.open()).toBe(false)
    vi.advanceTimersByTime(99)
    expect(sub.state()).toBe("opening")
    vi.advanceTimersByTime(1)
    expect(sub.state()).toBe("open")
    expect(sub.ctx().hoverOpened).toBe(true)
    expect(sub.changes()).toEqual([[true, "trigger"]])
  })

  it("honours submenuOpenDelay", () => {
    const { sub } = pair({ submenuOpenDelay: 250 })
    sub.send({ type: "HOVER.START" })
    vi.advanceTimersByTime(249)
    expect(sub.state()).toBe("opening")
    vi.advanceTimersByTime(1)
    expect(sub.state()).toBe("open")
  })

  it("HOVER.START is ignored at the root", () => {
    const m = make()
    m.send({ type: "HOVER.START" })
    expect(m.state()).toBe("closed")
  })

  it("HOVER.END (trigger) while opening cancels; the timer no longer opens it", () => {
    const { sub } = pair()
    sub.send({ type: "HOVER.START" })
    sub.send({ type: "HOVER.END" })
    expect(sub.state()).toBe("closed")
    vi.advanceTimersByTime(500)
    expect(sub.state()).toBe("closed")
    expect(sub.onOpenChange).not.toHaveBeenCalled()
  })

  it("HOVER.END zone while opening is ignored", () => {
    const { sub } = pair()
    sub.send({ type: "HOVER.START" })
    sub.send({ type: "HOVER.END", zone: true })
    expect(sub.state()).toBe("opening")
  })

  it("HOVER.END zone closes an open submenu; the trigger's HOVER.END does not", () => {
    const { sub } = pair()
    sub.send({ type: "HOVER.START" })
    vi.advanceTimersByTime(100)
    sub.send({ type: "HOVER.END" })
    expect(sub.state()).toBe("open")
    sub.send({ type: "HOVER.END", zone: true })
    expect(sub.state()).toBe("closed")
  })

  it("a press while opening opens at once", () => {
    const { sub } = pair()
    sub.send({ type: "HOVER.START" })
    sub.send(press)
    expect(sub.state()).toBe("open")
    expect(sub.ctx().hoverOpened).toBe(false)
  })

  it("COLLAPSE closes a submenu with reason escape-key", () => {
    const { sub } = pair()
    sub.send({ type: "SUB_OPEN" })
    sub.onOpenChange.mockClear()
    sub.send({ type: "COLLAPSE" })
    expect(sub.state()).toBe("closed")
    expect(sub.changes()).toEqual([[false, "escape-key"]])
  })

  it("opening joins the tree path; closing leaves it", () => {
    const { tree, sub } = pair()
    expect(tree.openPath()).toEqual([])
    sub.send({ type: "SUB_OPEN" })
    expect(tree.openPath()).toEqual([SUB])
    sub.send({ type: "COLLAPSE" })
    expect(tree.openPath()).toEqual([])
  })

  it("opening a sibling closes the first without restoring focus", () => {
    const tree = createMenuTree()
    const root = make({}, tree)
    root.send(press)
    const a = make({ level: "submenu", levelId: menuLevelId("s1") }, tree)
    const b = make({ level: "submenu", levelId: menuLevelId("s2") }, tree)
    a.send({ type: "SUB_OPEN" })
    b.send({ type: "SUB_OPEN" })
    expect(a.state()).toBe("closed")
    expect(a.ctx().restoreFocus).toBe(false)
    expect(b.state()).toBe("open")
    expect(tree.openPath()).toEqual(["s2" as MenuLevelId])
  })

  it("an item activated in a submenu closes the root with item-select", () => {
    const { root, sub } = pair()
    sub.send({ type: "SUB_OPEN" })
    root.onOpenChange.mockClear()
    sub.send(activate("a"))
    expect(root.state()).toBe("closed")
    expect(root.changes()).toEqual([[false, "item-select"]])
  })

  it("a closing root dismisses via TREE.CLOSE; opening state closes on TREE.CLOSE too", () => {
    const { sub } = pair()
    sub.send({ type: "HOVER.START" })
    sub.send({ type: "TREE.CLOSE", reason: "api" })
    expect(sub.state()).toBe("closed")
  })
})

describe("EXPAND / COLLAPSE", () => {
  const host = () => {
    const navigate = vi.fn()
    const h: MenuTreeHost = { elements: () => [], navigate, press: () => {} }
    return { navigate, tree: createMenuTree({ parentKind: "menubar", host: h }) }
  }

  it("EXPAND asks openSubmenu with the highlighted key", () => {
    const openSubmenu = vi.fn(() => true)
    const m = opened({ openSubmenu })
    m.send({ type: "HIGHLIGHT", key: toKey("b"), source: "keyboard" })
    m.send({ type: "EXPAND" })
    expect(openSubmenu).toHaveBeenCalledWith("b")
  })

  it("EXPAND without a menubar host does nothing more when refused", () => {
    const { navigate } = host()
    const m = opened({ openSubmenu: () => false })
    m.send({ type: "EXPAND" })
    expect(navigate).not.toHaveBeenCalled()
  })

  it("EXPAND refused under a menubar navigates the bar (expand)", () => {
    const { navigate, tree } = host()
    const m = make({ openSubmenu: () => false }, tree)
    m.send(press)
    m.send({ type: "HIGHLIGHT", key: toKey("a"), source: "keyboard" })
    m.send({ type: "EXPAND" })
    expect(navigate).toHaveBeenCalledWith({ from: ROOT, direction: "expand" })
  })

  it("EXPAND accepted under a menubar does not navigate the bar", () => {
    const { navigate, tree } = host()
    const m = make({ openSubmenu: () => true }, tree)
    m.send(press)
    m.send({ type: "HIGHLIGHT", key: toKey("a"), source: "keyboard" })
    m.send({ type: "EXPAND" })
    expect(navigate).not.toHaveBeenCalled()
  })

  it("EXPAND with no highlight under a menubar navigates the bar", () => {
    const { navigate, tree } = host()
    const m = make({ openSubmenu: () => true }, tree)
    m.send(press)
    m.send({ type: "EXPAND" })
    expect(navigate).toHaveBeenCalledWith({ from: ROOT, direction: "expand" })
  })

  it("COLLAPSE at a menubar root navigates the bar (collapse) and stays open", () => {
    const { navigate, tree } = host()
    const m = make({}, tree)
    m.send(press)
    m.send({ type: "COLLAPSE" })
    expect(navigate).toHaveBeenCalledWith({ from: ROOT, direction: "collapse" })
    expect(m.state()).toBe("open")
  })

  it("COLLAPSE at a plain root does nothing", () => {
    const m = opened()
    m.send({ type: "COLLAPSE" })
    expect(m.state()).toBe("open")
    expect(m.onOpenChange).not.toHaveBeenCalled()
  })
})

describe("navigation", () => {
  const nav = (m: ReturnType<typeof make>, move: "next" | "previous" | "first" | "last") => {
    m.send({ type: "NAVIGATE", move })
    return m.ctx().highlightedKey
  }
  const type = (m: ReturnType<typeof make>, char: string) =>
    m.send({
      type: "TYPEAHEAD",
      char,
      composing: false,
      modifiers: { ctrl: false, meta: false, alt: false },
    })

  it("loops by default as the adapter passes it", () => {
    const m = opened()
    expect(nav(m, "next")).toBe("a")
    expect(nav(m, "next")).toBe("b")
    expect(nav(m, "next")).toBe("c")
    expect(nav(m, "next")).toBe("a")
    expect(nav(m, "previous")).toBe("c")
  })

  it("loop false stops at the ends", () => {
    const m = opened({ loop: false })
    expect(nav(m, "last")).toBe("c")
    expect(nav(m, "next")).toBe("c")
    expect(nav(m, "first")).toBe("a")
    expect(nav(m, "previous")).toBe("a")
  })

  it("skips disabled items when focusableWhenDisabled is false", () => {
    const m = opened({ collection: rows("a", "xb", "c") })
    expect(nav(m, "first")).toBe("a")
    expect(nav(m, "next")).toBe("c")
  })

  it("reaches disabled items when focusableWhenDisabled is true", () => {
    const m = opened({ collection: rows("a", "xb", "c"), focusableWhenDisabled: true })
    expect(nav(m, "first")).toBe("a")
    expect(nav(m, "next")).toBe("xb")
  })

  it("typeahead highlights the matching item", () => {
    const m = opened({ collection: rows("apple", "banana", "cherry") })
    type(m, "c")
    expect(m.ctx().highlightedKey).toBe("cherry")
  })

  it("typeahead skips disabled items unless focusable", () => {
    const skip = opened({ collection: rows("apple", "xray", "berry") })
    type(skip, "x")
    expect(skip.ctx().highlightedKey).toBeNull()
    const keep = opened({ collection: rows("apple", "xray", "berry"), focusableWhenDisabled: true })
    type(keep, "x")
    expect(keep.ctx().highlightedKey).toBe("xray")
  })

  it("closed ignores navigation", () => {
    const m = make()
    m.send({ type: "NAVIGATE", move: "next" })
    expect(m.ctx().highlightedKey).toBeNull()
  })

  it("closing drops the typeahead buffer so the next search starts fresh", () => {
    const m = opened({ collection: rows("aa", "ab", "b") })
    type(m, "a")
    m.send({ type: "CLOSE" })
    m.send(press)
    type(m, "b")
    expect(m.ctx().highlightedKey).toBe("b")
  })
})

describe("menu machine: a context menu's region root", () => {
  const right: MenuEvent = {
    type: "REGION.CONTEXTMENU",
    point: { x: 40, y: 60 },
    target: null,
    virtual: false,
  }

  it("a right click opens with reason context-menu and anchors at its point", () => {
    const m = make({ region: true })
    m.send(right)
    expect(m.state()).toBe("open")
    expect(m.changes()).toEqual([[true, "context-menu"]])
    expect(m.ctx().regionAnchor).toEqual({ kind: "point", x: 40, y: 60, target: null })
  })

  it("an open without a gesture anchors at no earlier point (the region's corner)", () => {
    const m = make({ region: true })
    m.send(right)
    m.send({ type: "CLOSE" })
    m.send({ type: "OPEN" })
    expect(m.state()).toBe("open")
    expect(m.ctx().regionAnchor).toBe(null)
  })

  it("a right click elsewhere closes with outside-press; one in the region re-anchors", () => {
    const m = make({ region: true }, undefined, { position: { reposition: () => {} } })
    m.send(right)
    m.send({ type: "DOCUMENT.CONTEXTMENU", point: { x: 80, y: 90 }, target: null, inRegion: true })
    expect(m.state()).toBe("open")
    expect(m.ctx().regionAnchor).toEqual({ kind: "point", x: 80, y: 90, target: null })
    m.send({ type: "DOCUMENT.CONTEXTMENU", point: { x: 0, y: 0 }, target: null, inRegion: false })
    expect(m.state()).toBe("closed")
    expect(m.changes().at(-1)).toEqual([false, "outside-press"])
  })
})
