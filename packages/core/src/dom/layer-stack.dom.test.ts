import { afterEach, describe, expect, it, vi } from "vitest"
import { getLayerStack, type LayerKind, type LayerOptions, layerId } from "./layer-stack"

const inBrowser = !navigator.userAgent.includes("jsdom")
const KEY = Symbol.for("rind-ui.layer-stack@1")

afterEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ""
})

const div = (parent: Element = document.body) => {
  const el = document.createElement("div")
  parent.append(el)
  return el
}

/** Options for a layer holding `content`; overrides win. */
function opts(
  id: string,
  content: Element,
  extra: Partial<Omit<LayerOptions, "id" | "elements">> & { kind?: LayerKind } = {},
): LayerOptions {
  return { kind: "dialog", modal: false, ...extra, id: layerId(id), elements: () => [content] }
}

const stack = () => getLayerStack(document)

describe("one stack per document", () => {
  it("returns the same stack for the same document", () => {
    expect(getLayerStack(document)).toBe(getLayerStack(document))
  })

  it("is shared by two module copies", async () => {
    // Two real module instances in both projects: browser mode keys modules by URL (a
    // query makes another instance), jsdom by the module registry (resetModules).
    vi.resetModules()
    const a = await import(/* @vite-ignore */ `./layer-stack${inBrowser ? "?copy=a" : ""}`)
    vi.resetModules()
    const b = await import(/* @vite-ignore */ `./layer-stack${inBrowser ? "?copy=b" : ""}`)
    expect(a).not.toBe(b)
    const content = div()
    const handle = a.getLayerStack(document).push(opts("copy-a", content))
    const other = b.getLayerStack(document)
    expect(other.topmost()?.id).toBe(handle.id)
    expect(other.topmost()?.contains(content)).toBe(true)
  })

  it("gives a same-origin iframe its own stack", () => {
    const iframe = document.createElement("iframe")
    document.body.append(iframe)
    const doc = iframe.contentDocument as Document
    const inner = doc.createElement("div")
    doc.body.append(inner)
    getLayerStack(doc).push(opts("in-frame", inner))
    expect(getLayerStack(doc).layers()).toHaveLength(1)
    expect(stack().layers()).toHaveLength(0)
    expect(stack().get(layerId("in-frame"))).toBeUndefined()
  })

  it("falls back to a separate working stack for an incompatible stored shape", () => {
    const iframe = document.createElement("iframe")
    document.body.append(iframe)
    const doc = iframe.contentDocument as Document
    Reflect.set(doc, KEY, { version: 999, stack: {} })
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const s = getLayerStack(doc)
    const inner = doc.createElement("div")
    doc.body.append(inner)
    s.push(opts("fallback", inner))
    expect(s.layers()).toHaveLength(1)
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it("warns only once across repeated lookups", () => {
    const iframe = document.createElement("iframe")
    document.body.append(iframe)
    const doc = iframe.contentDocument as Document
    Reflect.set(doc, KEY, { version: 999, stack: {} })
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    expect(getLayerStack(doc)).toBe(getLayerStack(doc))
    expect(warn).toHaveBeenCalledTimes(1)
  })
})

describe("registering", () => {
  it("returns a handle and is idempotent per id while open", () => {
    const content = div()
    const first = stack().push(opts("same", content))
    const second = stack().push(opts("same", content))
    expect(first.id).toBe(layerId("same"))
    expect(second).toBe(first)
    expect(stack().layers()).toHaveLength(1)
  })

  it("survives register, release, register again with the same id", () => {
    const content = div()
    stack().push(opts("strict", content)).release()
    const again = stack().push(opts("strict", content))
    expect(stack().layers()).toHaveLength(1)
    expect(again.isTopmost()).toBe(true)
    expect(again.meta()).toMatchObject({ index: 0, depth: 0, nested: false, hasNested: false })
  })

  it("treats releasing or disposing twice as a no-op", () => {
    const handle = stack().push(opts("twice", div()))
    expect(() => {
      handle.release()
      handle.release()
      handle.dispose()
      handle.dispose()
    }).not.toThrow()
    expect(stack().layers()).toHaveLength(0)
  })

  it("is empty when nothing is pushed", () => {
    expect(stack().topmost()).toBeUndefined()
    expect(stack().topmostModal()).toBeUndefined()
    expect(stack().layers()).toHaveLength(0)
  })
})

describe("parentage", () => {
  it("prefers the declared parent over the opener", () => {
    const a = div()
    const b = div()
    const trigger = div(b)
    stack().push(opts("a", a))
    stack().push(opts("b", b))
    const content = div()
    const child = stack().push(opts("d", content, { parent: layerId("a"), opener: () => trigger }))
    expect(stack().get(layerId("a"))?.contains(content)).toBe(true)
    expect(stack().get(layerId("b"))?.contains(content)).toBe(false)
    expect(child.meta().depth).toBe(1)
  })

  it("makes a portalled layer the child of the layer holding its opener", () => {
    const dialogContent = div()
    const trigger = div(dialogContent)
    const dialog = stack().push(opts("dialog", dialogContent, { modal: true }))
    const menuContent = div() // appended at the end of body, outside the dialog
    const menu = stack().push(opts("menu", menuContent, { kind: "menu", opener: () => trigger }))
    expect(dialog.contains(menuContent)).toBe(true)
    expect(menu.meta().depth).toBe(1)
  })

  it("keeps two root layers opened one after the other as siblings", () => {
    const first = stack().push(opts("first", div()))
    const second = stack().push(opts("second", div()))
    expect(second.meta().depth).toBe(0)
    expect(first.meta().hasNested).toBe(false)
    expect(first.contains(document.body.lastElementChild)).toBe(false)
  })
})

describe("inside and topmost", () => {
  it("contains a grandchild's target in every ancestor and tracks topmost and topmostModal", () => {
    const dc = div()
    const sc = div()
    const tc = div()
    const target = div(tc)
    const dialog = stack().push(opts("dialog", dc, { modal: true }))
    const select = stack().push(opts("select", sc, { kind: "listbox", parent: layerId("dialog") }))
    const tooltip = stack().push(
      opts("tooltip", tc, { kind: "tooltip", parent: layerId("select") }),
    )
    for (const h of [tooltip, select, dialog]) expect(h.contains(target)).toBe(true)
    expect(tooltip.contains(null)).toBe(false)
    expect(stack().topmost()?.id).toBe(tooltip.id)
    expect(stack().topmostModal()?.id).toBe(dialog.id)
    expect(stack().layerOf(target)?.id).toBe(tooltip.id)
  })
})

describe("isLogicallyInside", () => {
  it("sees portalled popups of a field's control as inside the field", () => {
    const field = div()
    const trigger = div(field)
    const content = div()
    const option = div(content)
    const tipContent = div()
    stack().push(opts("select", content, { kind: "listbox", opener: () => trigger }))
    stack().push(opts("tip", tipContent, { kind: "tooltip", parent: layerId("select") }))
    expect(stack().isLogicallyInside(option, field)).toBe(true)
    expect(stack().isLogicallyInside(tipContent, field)).toBe(true)

    const outside = div()
    const dialogContent = div()
    stack().push(opts("dialog", dialogContent, { opener: () => outside, modal: true }))
    expect(stack().isLogicallyInside(dialogContent, field)).toBe(false)
    expect(stack().isLogicallyInside(null, field)).toBe(false)
  })
})

describe("release", () => {
  it("removes the layer from topmost and layers, exposing the one beneath", () => {
    const below = stack().push(opts("below", div()))
    const top = stack().push(opts("top", div()))
    top.release()
    expect(top.isTopmost()).toBe(false)
    expect(
      stack()
        .layers()
        .map((h) => h.id),
    ).toEqual([below.id])
    expect(stack().topmost()?.id).toBe(below.id)
  })

  it("dismisses open descendants topmost first, even if their owners do not release", () => {
    const order: string[] = []
    const dialog = stack().push(opts("dialog", div(), { modal: true }))
    stack().push(
      opts("menu", div(), {
        kind: "menu",
        parent: layerId("dialog"),
        onParentDismissed: () => order.push("menu"),
      }),
    )
    stack().push(
      opts("submenu", div(), {
        kind: "menu",
        parent: layerId("menu"),
        onParentDismissed: () => order.push("submenu"),
      }),
    )
    dialog.release()
    expect(order).toEqual(["submenu", "menu"])
    expect(stack().layers()).toHaveLength(0)
  })
})

describe("exiting", () => {
  it.runIf(inBrowser)("keeps a released layer hit-testable until dispose", () => {
    const content = div()
    content.style.cssText = "position:fixed;left:10px;top:10px;width:100px;height:100px"
    const handle = stack().push(opts("exit", content))
    const r = content.getBoundingClientRect()
    const x = r.left + r.width / 2
    const y = r.top + r.height / 2
    expect(stack().isExitingAt(x, y)).toBe(false)
    handle.release()
    expect(handle.isTopmost()).toBe(false)
    expect(stack().isExitingAt(x, y)).toBe(true)
    handle.dispose()
    expect(stack().isExitingAt(x, y)).toBe(false)
  })
})

describe("stacking metadata", () => {
  it("counts nested dialogs and ignores other families", () => {
    const parent = stack().push(opts("parent", div(), { modal: true }))
    const child = stack().push(opts("child", div(), { modal: true, parent: layerId("parent") }))
    expect(parent.meta()).toMatchObject({ hasNested: true, nestedCount: 1, nested: false })
    expect(child.meta()).toMatchObject({ nested: true, hasNested: false })
    expect(child.meta().index).toBe(parent.meta().index + 1)
  })

  it("treats an alertdialog of family dialog as nested in a dialog", () => {
    const parent = stack().push(opts("parent", div(), { family: "dialog", modal: true }))
    const alert = stack().push(
      opts("alert", div(), {
        kind: "alertdialog",
        family: "dialog",
        modal: true,
        parent: layerId("parent"),
      }),
    )
    expect(parent.meta()).toMatchObject({ hasNested: true, nestedCount: 1 })
    expect(alert.meta().nested).toBe(true)
  })

  it("does not count a menu inside a dialog as a nested dialog", () => {
    const dialog = stack().push(opts("dialog", div(), { modal: true }))
    const menu = stack().push(opts("menu", div(), { kind: "menu", parent: layerId("dialog") }))
    expect(dialog.meta().hasNested).toBe(false)
    expect(menu.meta().nested).toBe(false)
  })
})

describe("subscribe", () => {
  it("notifies on push, release and dispose until unsubscribed", () => {
    const listener = vi.fn()
    const off = stack().subscribe(listener)
    const handle = stack().push(opts("sub", div()))
    expect(listener).toHaveBeenCalledTimes(1)
    handle.release()
    expect(listener).toHaveBeenCalledTimes(2)
    handle.dispose()
    expect(listener).toHaveBeenCalledTimes(3)
    off()
    stack().push(opts("after", div()))
    expect(listener).toHaveBeenCalledTimes(3)
  })
})
