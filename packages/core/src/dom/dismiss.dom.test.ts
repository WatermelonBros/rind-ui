import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { PlatformFlags } from "../env/capabilities"
import { type DomEnvironment, domEnvironment } from "../env/dom-environment"
import { type DismissOptions, type DismissRequest, dismissable } from "./dismiss"
import { getLayerStack, type LayerHandle, type LayerKind, layerId } from "./layer-stack"
import { platforms } from "./platform"

const inBrowser = !navigator.userAgent.includes("jsdom")

type PointerKind = "mouse" | "touch" | "pen"
interface PointerInit {
  readonly type?: PointerKind
  readonly id?: number
  readonly button?: number
  readonly ctrlKey?: boolean
  readonly x?: number
  readonly y?: number
}

const offs: Array<() => void> = []

afterEach(() => {
  for (const off of offs.splice(0)) off()
  document.body.innerHTML = ""
  document.body.removeAttribute("style")
})

const makeEnv = (
  platform: PlatformFlags = platforms.windows,
  doc: Document = document,
): DomEnvironment => domEnvironment({ platform, getRootNode: () => doc })

// --- events -------------------------------------------------------------------------------

const pointer = (
  name: "pointerdown" | "pointerup" | "pointercancel",
  target: EventTarget,
  init: PointerInit = {},
) =>
  target.dispatchEvent(
    new PointerEvent(name, {
      bubbles: true,
      cancelable: true,
      composed: true,
      pointerId: init.id ?? 1,
      pointerType: init.type ?? "mouse",
      button: init.button ?? 0,
      ctrlKey: init.ctrlKey ?? false,
      clientX: init.x ?? 1,
      clientY: init.y ?? 1,
    }),
  )
const down = (t: EventTarget, i?: PointerInit) => pointer("pointerdown", t, i)
const up = (t: EventTarget, i?: PointerInit) => pointer("pointerup", t, i)
const click = (t: EventTarget) =>
  t.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, detail: 1 }))
/** A whole gesture on one target: down, up, then the compatibility click. */
const press = (t: EventTarget, i?: PointerInit) => {
  down(t, i)
  up(t, i)
  click(t)
}
const pressEscape = (target: EventTarget = document.body, init: KeyboardEventInit = {}) => {
  const e = new KeyboardEvent("keydown", {
    key: "Escape",
    bubbles: true,
    cancelable: true,
    ...init,
  })
  target.dispatchEvent(e)
  return e
}
/** Synthetic: real `focus()` is unreliable in a headless, unfocused page. */
const focusIn = (t: EventTarget) =>
  t.dispatchEvent(new FocusEvent("focusin", { bubbles: true, composed: true }))

// --- layers -------------------------------------------------------------------------------

interface LayerSpec {
  readonly kind?: LayerKind
  readonly modal?: boolean
  readonly parent?: string
  readonly backdrop?: boolean
  /** Cancel every request. */
  readonly veto?: boolean
  readonly dismiss?: Omit<DismissOptions, "onRequest">
  readonly env?: DomEnvironment
  readonly doc?: Document
}

/**
 * A layer with a content div (holding a button) and an optional backdrop surface. Like a real
 * owner, it releases the layer on a request that was not canceled.
 */
function layer(id: string, spec: LayerSpec = {}) {
  const doc = spec.doc ?? document
  const modal = spec.modal ?? false
  const backdrop = spec.backdrop ? doc.createElement("div") : undefined
  if (backdrop) doc.body.append(backdrop)
  const content = doc.createElement("div")
  const inner = doc.createElement("button")
  content.append(inner)
  doc.body.append(content)
  const handle = getLayerStack(doc).push({
    id: layerId(id),
    kind: spec.kind ?? (modal ? "dialog" : "popover"),
    modal,
    ...(spec.parent ? { parent: layerId(spec.parent) } : {}),
    elements: () => (backdrop ? [backdrop, content] : [content]),
    ...(backdrop ? { surfaces: () => [backdrop] } : {}),
  })
  const requests: DismissRequest[] = []
  const off = dismissable(spec.env ?? makeEnv(platforms.windows, doc), handle, {
    ...spec.dismiss,
    modal,
    onRequest: (r) => {
      requests.push(r)
      if (spec.veto) r.cancel()
      if (!r.canceled) handle.release()
    },
  })
  offs.push(off)
  return {
    content,
    inner,
    backdrop,
    handle,
    requests,
    reasons: () => requests.map((r) => r.reason),
  }
}

// Page elements exist before any layer opens: a node added while a layer is open is, by design,
// never outside it.
let pool: HTMLElement[] = []
beforeEach(() => {
  pool = Array.from({ length: 6 }, () =>
    document.body.appendChild(document.createElement("button")),
  )
})
const outside = () => {
  const el = pool.shift()
  if (!el) throw new Error("outside() pool exhausted")
  return el
}
/** A node that appears while a layer is open (extension, third-party widget). */
const added = () => document.body.appendChild(document.createElement("button"))

// --- Dismiss Requests With Reasons And Veto -----------------------------------------------

describe("dismiss requests with reasons and veto", () => {
  it("delivers reason, event and target", () => {
    const a = layer("a")
    const e = pressEscape(a.inner)
    const r = a.requests[0]
    expect(r?.reason).toBe("escape-key")
    expect(r?.event).toBe(e)
    expect(r?.target).toBe(a.inner)
    expect(r?.canceled).toBe(false)
  })

  it("veto Escape: the layer stays open and no layer beneath closes", () => {
    const below = layer("below")
    const top = layer("top", { veto: true })
    const e = pressEscape()
    expect(top.reasons()).toEqual(["escape-key"])
    expect(top.requests[0]?.canceled).toBe(true)
    expect(below.requests).toHaveLength(0)
    expect(top.handle.isTopmost()).toBe(true)
    expect(e.defaultPrevented).toBe(false)
  })

  it("a source disabled per layer: outside press, Escape and outside focus", () => {
    const a = layer("a", { dismiss: { outsidePress: false, escape: false, outsideFocus: false } })
    const other = outside()
    press(other)
    pressEscape()
    focusIn(other)
    expect(a.requests).toHaveLength(0)
    expect(a.handle.isTopmost()).toBe(true)
  })

  it("a disabled outside press does not let the press reach the layer beneath", () => {
    const below = layer("below")
    layer("top", { dismiss: { outsidePress: false } })
    press(outside())
    expect(below.requests).toHaveLength(0)
  })
})

// --- Escape Closes Only The Topmost Layer -------------------------------------------------

describe("Escape closes only the topmost layer", () => {
  it("nested layers: the select closes first, a second Escape closes the dialog", () => {
    const dialog = layer("dialog", { modal: true })
    const select = layer("select", { kind: "listbox", parent: "dialog" })
    pressEscape()
    expect(select.reasons()).toEqual(["escape-key"])
    expect(dialog.requests).toHaveLength(0)
    pressEscape()
    expect(dialog.reasons()).toEqual(["escape-key"])
    expect(select.requests).toHaveLength(1)
  })

  it("works with focus on body", () => {
    const a = layer("a")
    expect(document.activeElement).toBe(document.body)
    pressEscape(document.body)
    expect(a.reasons()).toEqual(["escape-key"])
  })

  it("works with the target anywhere in the page", () => {
    const a = layer("a")
    pressEscape(outside())
    expect(a.reasons()).toEqual(["escape-key"])
  })

  it("is active right after registering, with no deferral", () => {
    const a = layer("a")
    pressEscape()
    expect(a.reasons()).toEqual(["escape-key"])
  })

  it("is a no-op when no layer is open", () => {
    const e = pressEscape()
    expect(e.defaultPrevented).toBe(false)
  })

  it("is a no-op after the layer is released", () => {
    const a = layer("a")
    a.handle.release()
    pressEscape()
    expect(a.requests).toHaveLength(0)
  })

  it("dismisses once per key press and consumes the key", () => {
    const a = layer("a")
    const e = pressEscape()
    expect(a.requests).toHaveLength(1)
    expect(e.defaultPrevented).toBe(true)
  })

  it("ignores other keys", () => {
    const a = layer("a")
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))
    expect(a.requests).toHaveLength(0)
  })

  it("ignores Escape while composing (isComposing)", () => {
    const a = layer("a")
    pressEscape(a.inner, { isComposing: true })
    expect(a.requests).toHaveLength(0)
  })

  it("ignores Escape with keyCode 229", () => {
    const a = layer("a")
    const e = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })
    Object.defineProperty(e, "keyCode", { value: 229 })
    a.inner.dispatchEvent(e)
    expect(a.requests).toHaveLength(0)
  })

  it("an inner widget that consumed Escape (preventDefault) keeps the layer open", () => {
    const a = layer("a")
    const search = document.createElement("input")
    a.content.append(search)
    search.addEventListener("keydown", (e) => e.preventDefault())
    pressEscape(search)
    expect(a.requests).toHaveLength(0)
  })

  it("a composite that does nothing with Escape does not block it (kobalte#688)", () => {
    const a = layer("a", { modal: true })
    const tab = document.createElement("div")
    tab.setAttribute("role", "tab")
    tab.tabIndex = 0
    a.content.append(tab)
    tab.addEventListener("keydown", () => {}) // roving-focus handler: ignores Escape
    pressEscape(tab)
    expect(a.reasons()).toEqual(["escape-key"])
  })
})

// --- What Counts As An Outside Press ------------------------------------------------------

describe("what counts as an outside press", () => {
  it("a mouse press outside dismisses on pointerup", () => {
    const a = layer("a")
    const other = outside()
    down(other)
    expect(a.requests).toHaveLength(0)
    up(other)
    expect(a.reasons()).toEqual(["outside-press"])
    expect(a.requests[0]?.target).toBe(other)
    click(other)
    expect(a.requests).toHaveLength(1)
  })

  it("a press inside does not dismiss", () => {
    const a = layer("a")
    press(a.inner)
    expect(a.requests).toHaveLength(0)
  })

  it("the opening click: a press that began before the layer registered is not outside", () => {
    layer("base") // keeps the router installed, as in an app with another overlay open
    const trigger = outside()
    down(trigger)
    const popover = layer("popover")
    up(document.body)
    click(document.body)
    expect(popover.requests).toHaveLength(0)
  })

  it("the opening click, with no other layer open yet", () => {
    const trigger = outside()
    down(trigger)
    const popover = layer("popover")
    up(document.body)
    expect(popover.requests).toHaveLength(0)
  })

  it("outside press right after opening closes on that click (bits-ui#2141)", () => {
    const menu = layer("menu", { kind: "menu" })
    press(outside())
    expect(menu.reasons()).toEqual(["outside-press"])
  })

  it("text selection ending outside keeps the dialog open", () => {
    const dialog = layer("dialog", { modal: true })
    down(dialog.inner)
    up(outside())
    expect(dialog.requests).toHaveLength(0)
  })

  it("a press starting outside and ending inside does not dismiss", () => {
    const a = layer("a")
    down(outside())
    up(a.inner)
    expect(a.requests).toHaveLength(0)
  })

  it.runIf(inBrowser)("a press on the page scrollbar keeps a non-modal layer open", () => {
    document.body.style.height = "5000px"
    const a = layer("a")
    const x = document.documentElement.clientWidth
    press(document.documentElement, { x, y: 10 })
    expect(a.requests).toHaveLength(0)
    // The same press just inside the viewport is an outside press.
    press(document.body, { x: x - 1, y: 10 })
    expect(a.reasons()).toEqual(["outside-press"])
  })

  it.runIf(inBrowser)("a press on a scroll container's scrollbar keeps the layer open", () => {
    const scroller = document.createElement("div")
    scroller.style.cssText =
      "position:fixed;left:200px;top:200px;width:100px;height:100px;overflow:scroll"
    const filler = document.createElement("div")
    filler.style.cssText = "width:500px;height:500px"
    scroller.append(filler)
    document.body.append(scroller)
    const a = layer("a")
    // Skipped where scrollbars overlay content (no space is reserved for them).
    if (scroller.offsetWidth - scroller.clientWidth > 0) {
      const barX = scroller.getBoundingClientRect().right - 2
      press(scroller, { x: barX, y: 250 })
      expect(a.requests).toHaveLength(0)
    }
    press(filler, { x: 210, y: 210 })
    expect(a.reasons()).toEqual(["outside-press"])
  })

  it("right click outside keeps the dialog open", () => {
    const dialog = layer("dialog", { modal: true })
    press(outside(), { button: 2 })
    expect(dialog.requests).toHaveLength(0)
  })

  it("Control-click on macOS keeps the dialog open", () => {
    const dialog = layer("dialog", { modal: true, env: makeEnv(platforms.apple) })
    press(outside(), { ctrlKey: true })
    expect(dialog.requests).toHaveLength(0)
    press(outside())
    expect(dialog.reasons()).toEqual(["outside-press"])
  })

  it("Control-click is a normal press elsewhere", () => {
    const a = layer("a")
    press(outside(), { ctrlKey: true })
    expect(a.reasons()).toEqual(["outside-press"])
  })

  it("a handler calling stopPropagation on pointerdown does not break the single press", () => {
    const popover = layer("popover")
    popover.inner.addEventListener("pointerdown", (e) => e.stopPropagation())
    press(popover.inner)
    expect(popover.requests).toHaveLength(0)
    const other = outside()
    other.addEventListener("pointerdown", (e) => e.stopPropagation())
    other.addEventListener("pointerup", (e) => e.stopPropagation())
    press(other)
    expect(popover.reasons()).toEqual(["outside-press"])
  })

  it("a bare click with no pointer events is never an outside press", () => {
    const a = layer("a")
    click(outside())
    click(document.body)
    expect(a.requests).toHaveLength(0)
  })

  it("a bare click after a touch gesture was consumed is not an outside press", () => {
    const a = layer("a", { veto: true })
    press(outside(), { type: "touch" })
    expect(a.requests).toHaveLength(1)
    click(outside())
    expect(a.requests).toHaveLength(1)
  })

  it("a target that is no longer connected is not an outside press", () => {
    const a = layer("a")
    const gone = outside()
    down(gone, { type: "touch" })
    up(gone, { type: "touch" })
    gone.remove()
    click(document.body)
    expect(a.requests).toHaveLength(0)
  })

  it("pointercancel discards the press", () => {
    const a = layer("a")
    const other = outside()
    down(other, { type: "touch" })
    pointer("pointercancel", other, { type: "touch" })
    click(other)
    expect(a.requests).toHaveLength(0)
  })

  it("a second touch point makes the gesture not a single touch", () => {
    const a = layer("a")
    const other = outside()
    down(other, { type: "touch", id: 1 })
    down(other, { type: "touch", id: 2 })
    up(other, { type: "touch", id: 2 })
    up(other, { type: "touch", id: 1 })
    click(other)
    expect(a.requests).toHaveLength(0)
  })

  it("a stray pointerup after the press was consumed does nothing", () => {
    const a = layer("a", { veto: true })
    const other = outside()
    press(other)
    up(other)
    expect(a.requests).toHaveLength(1)
  })
})

// --- Dismiss Surfaces ---------------------------------------------------------------------

describe("dismiss surfaces", () => {
  it("backdrop click closes a modal dialog with outside-press", () => {
    const dialog = layer("dialog", { modal: true, backdrop: true })
    press(dialog.backdrop as Element)
    expect(dialog.reasons()).toEqual(["outside-press"])
    expect(dialog.requests[0]?.target).toBe(dialog.backdrop)
  })

  it("the backdrop still belongs to the layer", () => {
    const dialog = layer("dialog", { modal: true, backdrop: true })
    expect(dialog.handle.contains(dialog.backdrop as Element)).toBe(true)
  })

  it("a press starting in the content and ending on the backdrop makes no request", () => {
    const dialog = layer("dialog", { modal: true, backdrop: true })
    down(dialog.inner)
    up(dialog.backdrop as Element)
    expect(dialog.requests).toHaveLength(0)
  })

  it("a press starting on the backdrop and ending in the content makes no request", () => {
    const dialog = layer("dialog", { modal: true, backdrop: true })
    down(dialog.backdrop as Element)
    up(dialog.inner)
    expect(dialog.requests).toHaveLength(0)
  })

  it("a press in the content does not dismiss", () => {
    const dialog = layer("dialog", { modal: true, backdrop: true })
    press(dialog.inner)
    press(dialog.content)
    expect(dialog.requests).toHaveLength(0)
  })

  it("the positioner around the content is a surface; the content is not", () => {
    const positioner = document.createElement("div")
    const content = document.createElement("div")
    const inner = document.createElement("button")
    content.append(inner)
    positioner.append(content)
    document.body.append(positioner)
    const stack = getLayerStack(document)
    const handle = stack.push({
      id: layerId("dialog"),
      kind: "dialog",
      modal: true,
      elements: () => [positioner, content],
      surfaces: () => [positioner],
    })
    const requests: DismissRequest[] = []
    offs.push(
      dismissable(makeEnv(), handle, {
        modal: true,
        onRequest: (r) => requests.push(r),
      }),
    )
    press(inner)
    press(content)
    expect(requests).toHaveLength(0)
    press(positioner)
    expect(requests.map((r) => r.reason)).toEqual(["outside-press"])
  })

  it("a surface press follows the other rules (right click does not dismiss)", () => {
    const dialog = layer("dialog", { modal: true, backdrop: true })
    press(dialog.backdrop as Element, { button: 2 })
    expect(dialog.requests).toHaveLength(0)
  })
})

// --- Touch Presses Dismiss On Click -------------------------------------------------------

describe("touch presses dismiss on click", () => {
  it.each(["touch", "pen"] as const)(
    "a %s press dismisses on the click, not on pointerup",
    (type) => {
      const a = layer("a")
      const other = outside()
      down(other, { type })
      up(other, { type })
      expect(a.requests).toHaveLength(0)
      click(other)
      expect(a.reasons()).toEqual(["outside-press"])
    },
  )

  it("ghost click: the select is already asked to close before the button underneath is clicked", () => {
    const select = layer("select", { kind: "listbox" })
    const under = outside()
    const seen: number[] = []
    under.addEventListener("pointerup", () => seen.push(select.requests.length))
    under.addEventListener("click", () => seen.push(select.requests.length))
    press(under, { type: "touch" })
    expect(seen).toEqual([0, 1])
  })

  it("one gesture dismisses at most once", () => {
    const a = layer("a", { veto: true })
    const other = outside()
    press(other, { type: "touch" })
    click(other)
    click(other)
    expect(a.requests).toHaveLength(1)
  })

  it("one gesture dismisses each layer once", () => {
    const p1 = layer("p1")
    const p2 = layer("p2")
    press(outside(), { type: "touch" })
    click(document.body)
    expect(p1.requests).toHaveLength(1)
    expect(p2.requests).toHaveLength(1)
  })

  it("tapping the close button of a child dialog closes only the child (ark#2557)", () => {
    const popover = layer("popover")
    const parent = layer("parent", { modal: true, parent: "popover" })
    const child = layer("child", { modal: true, parent: "parent" })
    const close = child.inner
    close.addEventListener("click", () => child.handle.release())
    press(close, { type: "touch" })
    expect(child.handle.isTopmost()).toBe(false)
    expect(parent.requests).toHaveLength(0)
    expect(popover.requests).toHaveLength(0)
    expect(parent.handle.isTopmost()).toBe(true)
  })
})

// --- Screen reader activation -------------------------------------------------------------

describe("screen reader activation", () => {
  it("a synthesized click with no pointer events does not dismiss an open select", () => {
    const select = layer("select", { kind: "listbox" })
    const option = outside()
    click(option)
    click(option)
    expect(select.requests).toHaveLength(0)
  })
})

// --- Which Layers One Outside Press Dismisses ---------------------------------------------

describe("which layers one outside press dismisses", () => {
  it("menu inside a controlled dialog: a backdrop click closes only the menu (radix#4035)", () => {
    const dialog = layer("dialog", { modal: true, backdrop: true })
    const menu = layer("menu", { kind: "menu", parent: "dialog" })
    press(dialog.backdrop as Element)
    expect(menu.reasons()).toEqual(["outside-press"])
    expect(dialog.requests).toHaveLength(0)
    // The next press, now that the dialog is topmost, closes the dialog.
    press(dialog.backdrop as Element)
    expect(dialog.reasons()).toEqual(["outside-press"])
  })

  it("submenu chain: a click on the page closes the submenu and the menu", () => {
    const menu = layer("menu", { kind: "menu" })
    const sub = layer("sub", { kind: "menu", parent: "menu" })
    press(outside())
    expect(sub.reasons()).toEqual(["outside-press"])
    expect(menu.reasons()).toEqual(["outside-press"])
  })

  it("stops at the first layer that cancels", () => {
    const menu = layer("menu", { kind: "menu" })
    const sub = layer("sub", { kind: "menu", parent: "menu", veto: true })
    press(outside())
    expect(sub.reasons()).toEqual(["outside-press"])
    expect(menu.requests).toHaveLength(0)
  })

  it("stops at the first layer that contains the target", () => {
    const menu = layer("menu", { kind: "menu" })
    const sub = layer("sub", { kind: "menu", parent: "menu" })
    press(menu.inner)
    expect(sub.reasons()).toEqual(["outside-press"])
    expect(menu.requests).toHaveLength(0)
  })

  it("stops at a modal layer: the layers beneath it are not dismissed", () => {
    const popover = layer("popover")
    const dialog = layer("dialog", { modal: true })
    press(outside())
    expect(dialog.reasons()).toEqual(["outside-press"])
    expect(popover.requests).toHaveLength(0)
  })

  it("a modal that was not topmost when the press started is not dismissed", () => {
    const dialog = layer("dialog", { modal: true })
    const menu = layer("menu", { kind: "menu", parent: "dialog" })
    down(outside())
    menu.handle.release()
    up(document.body)
    expect(dialog.requests).toHaveLength(0)
    expect(menu.requests).toHaveLength(0)
  })

  it("press inside a lower non-modal layer closes only the topmost sibling", () => {
    const first = layer("first")
    const second = layer("second")
    press(first.inner)
    expect(second.reasons()).toEqual(["outside-press"])
    expect(first.requests).toHaveLength(0)
  })

  it("a layer without dismiss options is a boundary", () => {
    const below = layer("below")
    const el = document.createElement("div")
    document.body.append(el)
    getLayerStack(document).push({
      id: layerId("plain"),
      kind: "popover",
      modal: false,
      elements: () => [el],
    })
    press(outside())
    expect(below.requests).toHaveLength(0)
  })
})

// --- Nodes Added While Open Are Not Outside -----------------------------------------------

describe("nodes added while open are not outside", () => {
  it("an extension panel added to body after opening does not dismiss a modal dialog", () => {
    const dialog = layer("dialog", { modal: true })
    const panel = document.createElement("div")
    const button = document.createElement("button")
    panel.append(button)
    document.body.append(panel)
    press(panel)
    press(button)
    expect(dialog.requests).toHaveLength(0)
  })

  it("a third-party option portalled to body is not outside; a press on a pre-existing node is", () => {
    const before = outside()
    const dialog = layer("dialog", { modal: true })
    const listbox = document.createElement("ul")
    const option = document.createElement("li")
    listbox.append(option)
    document.body.append(listbox)
    press(option)
    expect(dialog.requests).toHaveLength(0)
    press(before)
    expect(dialog.reasons()).toEqual(["outside-press"])
  })

  it("a press on a toast in a data-rind-top-layer region does not dismiss a dialog", () => {
    const region = document.createElement("div")
    region.setAttribute("data-rind-top-layer", "")
    const undo = document.createElement("button")
    region.append(undo)
    document.body.append(region)
    const dialog = layer("dialog", { modal: true })
    const action = vi.fn()
    undo.addEventListener("click", action)
    press(undo)
    expect(dialog.requests).toHaveLength(0)
    expect(action).toHaveBeenCalledTimes(1)
  })

  it("a top-layer region added later is not outside either", () => {
    const dialog = layer("dialog", { modal: true })
    const region = document.createElement("div")
    region.setAttribute("data-rind-top-layer", "")
    const undo = document.createElement("button")
    region.append(undo)
    document.body.append(region)
    press(undo)
    expect(dialog.requests).toHaveLength(0)
  })

  it("the isInside option marks persistent elements as inside", () => {
    const persistent = outside()
    const a = layer("a", { dismiss: { isInside: (t) => t === persistent } })
    press(persistent)
    expect(a.requests).toHaveLength(0)
    press(outside())
    expect(a.reasons()).toEqual(["outside-press"])
  })
})

// --- Outside Focus ------------------------------------------------------------------------

describe("outside focus", () => {
  it("focus moving to an element outside a non-modal layer dismisses it", () => {
    const popover = layer("popover")
    const other = outside()
    focusIn(popover.inner)
    expect(popover.requests).toHaveLength(0)
    focusIn(other)
    expect(popover.reasons()).toEqual(["outside-focus"])
    expect(popover.requests[0]?.target).toBe(other)
  })

  it("tabbing out of the last element of a popover closes it with outside-focus", () => {
    const popover = layer("popover")
    const last = document.createElement("button")
    popover.content.append(last)
    focusIn(last)
    focusIn(outside())
    expect(popover.reasons()).toEqual(["outside-focus"])
  })

  it("window blur and focus moving to null do not dismiss (tab switch)", () => {
    const popover = layer("popover")
    window.dispatchEvent(new Event("blur"))
    document.dispatchEvent(new FocusEvent("focusin", { bubbles: true }))
    window.dispatchEvent(new FocusEvent("focusin", { relatedTarget: null }))
    window.dispatchEvent(new Event("focus"))
    expect(popover.requests).toHaveLength(0)
  })

  it("modal layers are never dismissed by focus moving outside", () => {
    const dialog = layer("dialog", { modal: true })
    focusIn(outside())
    expect(dialog.requests).toHaveLength(0)
  })

  it("focus in a descendant layer is not outside", () => {
    const popover = layer("popover")
    const child = layer("child", { kind: "menu", parent: "popover" })
    focusIn(child.inner)
    expect(popover.requests).toHaveLength(0)
    expect(child.requests).toHaveLength(0)
  })

  it("focus on a node added while open is not outside", () => {
    const popover = layer("popover")
    focusIn(added())
    expect(popover.requests).toHaveLength(0)
  })

  it("focus in a data-rind-top-layer region is not outside", () => {
    const region = document.createElement("div")
    region.setAttribute("data-rind-top-layer", "")
    const undo = document.createElement("button")
    region.append(undo)
    document.body.append(region)
    const popover = layer("popover")
    focusIn(undo)
    expect(popover.requests).toHaveLength(0)
  })

  it("focus during a pointer press does not dismiss (the press decides)", () => {
    const popover = layer("popover")
    const other = outside()
    down(other)
    focusIn(other)
    expect(popover.requests).toHaveLength(0)
    up(other)
    expect(popover.reasons()).toEqual(["outside-press"])
  })

  it("focus outside a pre-existing node dismisses the layer beneath the top one as well", () => {
    const outsideBefore = outside()
    const first = layer("first")
    const second = layer("second")
    focusIn(outsideBefore)
    expect(second.reasons()).toEqual(["outside-focus"])
    expect(first.reasons()).toEqual(["outside-focus"])
  })

  it("a canceled outside-focus request stops the chain", () => {
    const outsideBefore = outside()
    const first = layer("first")
    const second = layer("second", { veto: true })
    focusIn(outsideBefore)
    expect(second.reasons()).toEqual(["outside-focus"])
    expect(first.requests).toHaveLength(0)
  })
})

// --- Multiple documents and module copies -------------------------------------------------

describe("multiple documents", () => {
  it("Escape in an iframe document never closes a main-document layer", () => {
    const main = layer("main")
    const iframe = document.createElement("iframe")
    document.body.append(iframe)
    const doc = iframe.contentDocument as Document
    const win = iframe.contentWindow as Window & typeof globalThis
    const inner = layer("inner", { doc })
    doc.body.dispatchEvent(
      new win.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
    )
    expect(inner.reasons()).toEqual(["escape-key"])
    expect(main.requests).toHaveLength(0)
    // And the other way: Escape in the main document leaves the iframe layer alone.
    const second = layer("inner2", { doc })
    pressEscape()
    expect(main.reasons()).toEqual(["escape-key"])
    expect(second.requests).toHaveLength(0)
  })

  it("Escape in an iframe with no layer of its own does nothing to the main layer", () => {
    const main = layer("main")
    const iframe = document.createElement("iframe")
    document.body.append(iframe)
    const doc = iframe.contentDocument as Document
    const win = iframe.contentWindow as Window & typeof globalThis
    doc.body.dispatchEvent(
      new win.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
    )
    expect(main.requests).toHaveLength(0)
  })
})

describe("two copies of the library", () => {
  /** A real second module instance: browser mode keys modules by URL, jsdom by the registry. */
  async function copy(tag: "a" | "b") {
    vi.resetModules()
    const query = inBrowser ? `?copy=${tag}` : ""
    const d = await import(/* @vite-ignore */ `./dismiss${query}`)
    const l = await import(/* @vite-ignore */ `./layer-stack${query}`)
    // Sound: dynamic import of a computed specifier is untyped; these are the same modules.
    return {
      dismissable: d.dismissable as typeof dismissable,
      getLayerStack: l.getLayerStack as typeof getLayerStack,
      layerId: l.layerId as typeof layerId,
    }
  }

  async function open(mod: Awaited<ReturnType<typeof copy>>, id: string, parent?: string) {
    const content = document.createElement("div")
    const inner = document.createElement("button")
    content.append(inner)
    document.body.append(content)
    const handle: LayerHandle = mod.getLayerStack(document).push({
      id: mod.layerId(id),
      kind: parent ? "menu" : "popover",
      modal: false,
      ...(parent ? { parent: mod.layerId(parent) } : {}),
      elements: () => [content],
    })
    const requests: DismissRequest[] = []
    offs.push(
      mod.dismissable(makeEnv(), handle, {
        modal: false,
        onRequest: (r) => {
          requests.push(r)
          handle.release()
        },
      }),
    )
    return { inner, handle, requests }
  }

  it("Escape closes only the topmost layer", async () => {
    const a = await copy("a")
    const parent = await open(a, "parent")
    const b = await copy("b")
    expect(a.getLayerStack).not.toBe(b.getLayerStack)
    const child = await open(b, "child", "parent")
    pressEscape()
    expect(child.requests.map((r) => r.reason)).toEqual(["escape-key"])
    expect(parent.requests).toHaveLength(0)
    pressEscape()
    expect(parent.requests.map((r) => r.reason)).toEqual(["escape-key"])
  })

  it("an outside press inside the child does not dismiss the parent", async () => {
    const a = await copy("a")
    const parent = await open(a, "parent")
    const b = await copy("b")
    const child = await open(b, "child", "parent")
    press(child.inner)
    expect(child.requests).toHaveLength(0)
    expect(parent.requests).toHaveLength(0)
    press(outside())
    expect(child.requests).toHaveLength(1)
    expect(parent.requests).toHaveLength(1)
  })
})

// --- Escape during an exit animation ------------------------------------------------------

describe("exiting layers", () => {
  it("a released, not yet disposed nested layer does not swallow Escape", () => {
    const parent = layer("parent")
    const child = layer("child", { kind: "menu", parent: "parent" })
    child.handle.release() // exit animation running: not disposed
    pressEscape()
    expect(parent.reasons()).toEqual(["escape-key"])
    expect(child.requests).toHaveLength(0)
  })

  const fixed = (el: HTMLElement, left: number, top: number, size = 100) => {
    el.style.cssText = `position:fixed;left:${left}px;top:${top}px;width:${size}px;height:${size}px`
  }

  it.runIf(inBrowser)(
    "a press over a released, not yet disposed layer does not dismiss the modal beneath",
    () => {
      const dialog = layer("dialog", { modal: true })
      fixed(dialog.content, 400, 400, 100)
      const menu = layer("menu", { kind: "menu", parent: "dialog" })
      fixed(menu.content, 20, 20)
      menu.handle.release()
      // The point is over the exiting menu; the hit target is the page.
      press(document.body, { x: 60, y: 60 })
      expect(dialog.requests).toHaveLength(0)
      press(document.body, { x: 60, y: 60, type: "touch" })
      expect(dialog.requests).toHaveLength(0)
      menu.handle.dispose()
      press(document.body, { x: 60, y: 60 })
      expect(dialog.reasons()).toEqual(["outside-press"])
    },
  )
})

// --- No Pointer-Events Mutation -----------------------------------------------------------

describe("no pointer-events mutation", () => {
  it("a dialog opened from a menu item leaves body without pointer-events and the page clickable", () => {
    const page = outside()
    const onPage = vi.fn()
    page.addEventListener("click", onPage)
    const menu = layer("menu", { kind: "menu" })
    expect(document.body.style.pointerEvents).toBe("")
    // The menu item opens a modal dialog and the menu closes.
    menu.handle.release()
    const dialog = layer("dialog", { modal: true, backdrop: true })
    expect(document.body.style.pointerEvents).toBe("")
    pressEscape()
    expect(dialog.reasons()).toEqual(["escape-key"])
    press(page)
    expect(onPage).toHaveBeenCalledTimes(1)
    expect(document.body.style.pointerEvents).toBe("")
    expect(document.documentElement.style.pointerEvents).toBe("")
  })

  it("dismissal by press and by focus sets no pointer-events anywhere", () => {
    layer("a")
    press(outside())
    const b = layer("b", { modal: true })
    press(b.backdrop ?? outside())
    expect(document.body.style.pointerEvents).toBe("")
    expect(document.querySelectorAll("[style*='pointer-events']")).toHaveLength(0)
  })
})

describe("review fixes: shadow DOM, key repeat, stale touch press", () => {
  /** A layer whose content lives inside an open shadow root. */
  function shadowLayer() {
    const host = document.body.appendChild(document.createElement("div"))
    const root = host.attachShadow({ mode: "open" })
    const content = root.appendChild(document.createElement("div"))
    const inner = content.appendChild(document.createElement("button"))
    const requests: DismissRequest[] = []
    const handle = getLayerStack(document).push({
      id: layerId("shadow"),
      kind: "popover",
      modal: false,
      elements: () => [content],
    })
    offs.push(
      dismissable(makeEnv(), handle, {
        modal: false,
        onRequest: (r) => {
          requests.push(r)
          r.cancel()
        },
      }),
    )
    return { inner, requests }
  }

  it("a press inside a layer in an open shadow root is not outside", () => {
    const outsideEl = outside()
    const s = shadowLayer()
    press(s.inner)
    expect(s.requests).toHaveLength(0)
    press(outsideEl)
    expect(s.requests.map((r) => r.reason)).toEqual(["outside-press"])
  })

  it("focus inside a layer in an open shadow root is not outside", () => {
    const outsideEl = outside()
    const s = shadowLayer()
    focusIn(s.inner)
    expect(s.requests).toHaveLength(0)
    focusIn(outsideEl)
    expect(s.requests.map((r) => r.reason)).toEqual(["outside-focus"])
  })

  it("a repeated Escape keydown closes nothing: holding the key does not unwind the stack", () => {
    const a = layer("a")
    const b = layer("b", { parent: "a" })
    pressEscape()
    pressEscape(document.body, { repeat: true })
    expect(b.reasons()).toEqual(["escape-key"])
    expect(a.requests).toHaveLength(0)
  })

  it("a bare click inside the layer after a touch press with no click is not outside", () => {
    const a = layer("a")
    const o = outside()
    down(o, { type: "touch" })
    up(o, { type: "touch" })
    a.inner.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 0 }))
    expect(a.requests).toHaveLength(0)
    // The stale press was dropped: a later bare click outside is not outside either.
    click(outside())
    expect(a.requests).toHaveLength(0)
  })
})
