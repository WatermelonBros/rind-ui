import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { domEnvironment } from "../env/dom-environment"
import { captureFocus } from "./focus-restore"
import { containFocus, focusInitial, tabbables, trapTab } from "./focus-scope"
import { getLayerStack, type LayerHandle, layerId } from "./layer-stack"
import { platforms } from "./platform"

const inBrowser = !navigator.userAgent.includes("jsdom")
const env = domEnvironment({ platform: platforms.windows })
let off = () => {}
const cleanups: (() => void)[] = []

beforeEach(() => {
  off = env.modality.subscribe(() => {})
})
afterEach(() => {
  vi.useRealTimers()
  for (const c of cleanups.splice(0)) c()
  off()
  document.body.innerHTML = ""
})

const html = (markup: string) => {
  document.body.innerHTML = markup
}
const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => {
  const el = root.querySelector<T>(sel)
  if (!el) throw new Error(`missing ${sel}`)
  return el
}
const settle = () => new Promise((r) => setTimeout(r, 0))
const frame = () => new Promise((r) => requestAnimationFrame(() => r(null)))
const scrollerStyle = "overflow:auto;height:20px"
const longText = "text ".repeat(200)

function open(id: string, container: HTMLElement, parent?: string): LayerHandle {
  return getLayerStack(document).push({
    id: layerId(id),
    kind: "dialog",
    modal: true,
    elements: () => [container],
    ...(parent ? { parent: layerId(parent) } : {}),
  })
}
function contain(id: string, container: HTMLElement): LayerHandle {
  const handle = open(id, container)
  cleanups.push(containFocus(env, handle, container))
  return handle
}
function tab(from: Element, shiftKey = false) {
  const e = new KeyboardEvent("keydown", {
    key: "Tab",
    shiftKey,
    bubbles: true,
    composed: true,
    cancelable: true,
  })
  from.dispatchEvent(e)
  return e
}

describe("initial focus", () => {
  const dialog = `<div id="d"><input id="field"><button>ok</button></div>`
  // In view, so the nearest-edge scroll has nothing to do and any page scroll is a bug.
  const fixed = `<div id="d" style="position:fixed;top:0"><input id="field"><button>ok</button></div>`

  it("focuses the first tabbable and does not scroll the page", async () => {
    html(`<div style="height:3000px"></div>${fixed}`)
    const before = window.scrollY
    focusInitial(env, $("#d"))
    await frame()
    expect(document.activeElement).toBe($("#field"))
    expect(window.scrollY).toBe(before)
  })

  it("prefers data-autofocus over the first tabbable", async () => {
    html(`<div id="d"><input><button data-autofocus>ok</button></div>`)
    focusInitial(env, $("#d"))
    await frame()
    expect(document.activeElement).toBe($("button"))
  })

  it("uses the consumer's choice", async () => {
    html(dialog)
    focusInitial(env, $("#d"), () => $("button"))
    await frame()
    expect(document.activeElement).toBe($("button"))
  })

  it("focuses the container when opened by touch", async () => {
    html(dialog)
    focusInitial(env, $("#d"), undefined, "touch")
    await frame()
    expect(document.activeElement).toBe($("#d"))
  })

  it("does not move focus when the choice is false", async () => {
    html(dialog)
    focusInitial(env, $("#d"), () => false)
    await frame()
    expect(document.activeElement).toBe(document.body)
  })

  it("leaves focus alone when it moved before the frame ran", async () => {
    html(`${dialog}<input id="outside">`)
    focusInitial(env, $("#d"))
    $("button").focus()
    await frame()
    expect(document.activeElement).toBe($("button"))
  })

  it("focuses the container with tabindex -1 when nothing is tabbable", async () => {
    html(`<div id="d"><p>only text</p></div>`)
    focusInitial(env, $("#d"))
    await frame()
    expect(document.activeElement).toBe($("#d"))
    expect($("#d").getAttribute("tabindex")).toBe("-1")
  })

  it("returns a cancel that stops the move", async () => {
    html(dialog)
    focusInitial(env, $("#d"))()
    await frame()
    expect(document.activeElement).toBe(document.body)
  })
})

describe("Tab containment", () => {
  const dialog = `<div id="d" tabindex="-1"><button id="a">a</button><button id="b">b</button><button id="c">c</button></div>`

  it("wraps forward from the last tabbable", async () => {
    html(dialog)
    contain("d1", $("#d"))
    $("#c").focus()
    const e = tab($("#c"))
    await settle()
    expect(e.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe($("#a"))
  })

  it("wraps backward from the first tabbable and from the container", async () => {
    html(dialog)
    contain("d1", $("#d"))
    $("#a").focus()
    expect(tab($("#a"), true).defaultPrevented).toBe(true)
    await settle()
    expect(document.activeElement).toBe($("#c"))
    $("#d").focus()
    tab($("#d"), true)
    await settle()
    expect(document.activeElement).toBe($("#c"))
  })

  it("does not interfere in the middle of the layer", () => {
    html(dialog)
    contain("d1", $("#d"))
    $("#b").focus()
    expect(tab($("#b")).defaultPrevented).toBe(false)
  })

  it("trapTab wraps standalone", async () => {
    html(dialog)
    cleanups.push(trapTab(env, $("#d")))
    $("#c").focus()
    tab($("#c"))
    await settle()
    expect(document.activeElement).toBe($("#a"))
  })

  it("keeps focus on the only tab stop (checked radio) and never leaves", async () => {
    html(
      `<div id="d"><input type="radio" name="r" id="r1"><input type="radio" name="r" id="r2" checked><input type="radio" name="r" id="r3"></div>`,
    )
    contain("d1", $("#d"))
    $("#r2").focus()
    const e = tab($("#r2"))
    await settle()
    expect(e.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe($("#r2"))
    tab($("#r2"), true)
    await settle()
    expect(document.activeElement).toBe($("#r2"))
  })

  it("keeps focus on the container when nothing is tabbable", async () => {
    html(`<div id="d" tabindex="-1"><p>text</p></div>`)
    contain("d1", $("#d"))
    $("#d").focus()
    const e = tab($("#d"))
    await settle()
    expect(e.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe($("#d"))
  })

  it("does not contain non-modal layers", () => {
    html(dialog)
    const container = $("#d")
    const handle = getLayerStack(document).push({
      id: layerId("p1"),
      kind: "popover",
      modal: false,
      elements: () => [container],
    })
    cleanups.push(containFocus(env, handle, container))
    $("#c").focus()
    expect(tab($("#c")).defaultPrevented).toBe(false)
    expect(document.activeElement).toBe($("#c"))
  })

  it.runIf(inBrowser)("includes a keyboard-focusable scroller before the next button", () => {
    html(
      `<div id="d"><button id="a">a</button><div id="s" style="${scrollerStyle}">${longText}</div><button id="b">b</button></div>`,
    )
    expect(tabbables($("#d")).map((el) => el.id)).toEqual(["a", "s", "b"])
  })

  it.runIf(inBrowser)("wrapping does not scroll the page", async () => {
    html(
      `<div style="height:3000px"></div>${dialog.replace('id="d"', 'id="d" style="position:fixed;top:0"')}`,
    )
    contain("d1", $("#d"))
    $("#c").focus({ preventScroll: true })
    window.scrollTo(0, 0)
    const before = window.scrollY
    tab($("#c"))
    await settle()
    expect(document.activeElement).toBe($("#a"))
    expect(window.scrollY).toBe(before)
  })

  it("adds no focus sentinels", () => {
    html(dialog)
    contain("d1", $("#d"))
    const stops = document.querySelectorAll('[tabindex="0"]')
    expect(stops.length).toBe(0)
    expect(document.body.children.length).toBe(1)
  })
})

describe("tabbables helper", () => {
  const markup = `<div id="d">
    <input id="text">
    <input type="radio" name="g" id="r1"><input type="radio" name="g" id="r2"><input type="radio" name="g" id="r3">
    <button id="two" tabindex="2">two</button>
    <div id="s" style="${scrollerStyle}">${longText}</div>
  </div>`

  it("orders positive tabindex first, one radio per group (jsdom: no layout, no scroller)", () => {
    html(markup)
    const ids = tabbables($("#d")).map((el) => el.id)
    expect(ids.slice(0, 3)).toEqual(["two", "text", "r1"])
  })

  it.runIf(inBrowser)("returns button, field, first radio, scroller", () => {
    html(markup)
    expect(tabbables($("#d")).map((el) => el.id)).toEqual(["two", "text", "r1", "s"])
  })

  it.runIf(inBrowser)("wrap visits the same first and last elements", async () => {
    html(markup)
    // The detected engine: WebKit does not stop on (or focus) scroll containers.
    const detected = domEnvironment()
    cleanups.push(detected.modality.subscribe(() => {}))
    const handle = open("d1", $("#d"))
    cleanups.push(containFocus(detected, handle, $("#d")))
    const stops = tabbables($("#d"), { scrollers: !detected.platform.webkit })
    stops.at(-1)?.focus()
    tab(stops.at(-1) as HTMLElement)
    await settle()
    expect(document.activeElement).toBe(stops[0])
    tab(stops[0] as HTMLElement, true)
    await settle()
    expect(document.activeElement).toBe(stops.at(-1))
  })

  it("skips checked-radio siblings, disabled, hidden and inert elements", () => {
    html(
      `<div id="d"><input type="radio" name="g" id="r1"><input type="radio" name="g" id="r2" checked><button disabled>x</button><button hidden>y</button><div inert><button>z</button></div></div>`,
    )
    expect(tabbables($("#d")).map((el) => el.id)).toEqual(["r2"])
  })
})

describe("containment across documents", () => {
  it("neither document moves focus back when focus moves between them", async (ctx) => {
    html(
      `<div id="host" tabindex="-1"><button id="hb1">1</button><button id="hb2">2</button></div><iframe id="f"></iframe>`,
    )
    const frameEl = $<HTMLIFrameElement>("#f")
    const idoc = frameEl.contentDocument as Document
    idoc.body.innerHTML = `<div id="d" tabindex="-1"><button id="ib1">1</button><button id="ib2">2</button></div>`
    const hostHandle = contain("host", $("#host"))
    expect(hostHandle.isTopmost()).toBe(true)
    const inner = $("#d", idoc)
    const handle = getLayerStack(idoc).push({
      id: layerId("inner"),
      kind: "dialog",
      modal: true,
      elements: () => [inner],
    })
    cleanups.push(containFocus(env, handle, inner))

    $("#hb1").focus()
    $("#ib1", idoc).focus()
    await settle()
    // Firefox reports <body> for a frame focused programmatically: only "not pulled back
    // into the host" is engine-independent.
    const notInHost = () => !$("#host").contains(document.activeElement)
    expect(notInHost()).toBe(true)
    // Headless Firefox does not focus inside a frame whose window is not focused.
    if (idoc.activeElement !== $("#ib1", idoc)) ctx.skip("this engine did not focus the frame")

    // The host never handled a Tab that happened in the iframe.
    tab($("#ib2", idoc))
    await settle()
    expect(notInHost()).toBe(true)
  })
})

describe("paused by a modal above", () => {
  it("returns focus to Open nested when the nested dialog closes", async () => {
    html(
      `<div id="p" tabindex="-1"><button id="first">first</button><button id="nest">Open nested</button></div><div id="n" tabindex="-1"><button id="nb">close</button></div>`,
    )
    contain("parent", $("#p"))
    $("#nest").focus()
    const nested = open("nested", $("#n"), "parent")
    const ret = captureFocus(env, nested, document)
    const stopNested = containFocus(env, nested, $("#n"))
    $("#nb").focus()
    await settle()
    // Parent containment is paused: no recovery or wrap pulled focus out of the nested dialog.
    expect(document.activeElement).toBe($("#nb"))
    expect(tab($("#nb")).defaultPrevented).toBe(true)
    expect(document.activeElement).toBe($("#nb"))

    nested.release()
    stopNested()
    ret.restore()
    await settle()
    expect(document.activeElement).toBe($("#nest"))
    // Resumed: parent wraps again.
    $("#nest").focus()
    tab($("#nest"))
    await settle()
    expect(document.activeElement).toBe($("#first"))
  })
})

describe("recovery when the focused element is removed", () => {
  const dialog = `<div id="d"><button id="rm">Remove</button><button id="keep">keep</button><button id="keep2">keep</button></div>`

  it("moves focus to the container", async () => {
    html(dialog)
    contain("d1", $("#d"))
    $("#rm").focus()
    $("#rm").remove()
    await settle()
    expect(document.activeElement).toBe($("#d"))
    expect($("#d").getAttribute("tabindex")).toBe("-1")
    expect(tab($("#d")).defaultPrevented).toBe(false)
  })

  it("does not recover when body is active but the element is still connected", async () => {
    html(dialog)
    contain("d1", $("#d"))
    const outside = document.createElement("p")
    $("#rm").focus()
    $("#rm").blur()
    document.body.append(outside)
    await settle()
    expect(document.activeElement).toBe(document.body)
  })
})

describe("focus restore", () => {
  const trigger = `<button id="t">open</button>`

  function dialogOpen(markup: string, opener?: () => Element | null) {
    html(markup)
    const container = $("#d")
    const handle = open("d1", container)
    return { handle, container, ret: captureFocus(env, handle, document, opener) }
  }

  it("returns to the trigger", async () => {
    $("body").focus()
    html(`${trigger}<div id="d"><button id="x">x</button></div>`)
    $("#t").focus()
    const handle = open("d1", $("#d"))
    const ret = captureFocus(env, handle, document)
    $("#x").focus()
    handle.release()
    ret.restore()
    await settle()
    expect(document.activeElement).toBe($("#t"))
  })

  it("uses the opener when nothing was focused (open at mount)", async () => {
    const { handle, ret } = dialogOpen(
      `${trigger}<div id="d"><button id="x">x</button></div>`,
      () => $("#t"),
    )
    $("#x").focus()
    handle.release()
    ret.restore()
    await settle()
    expect(document.activeElement).toBe($("#t"))
  })

  it("restores to body-active focus too", async () => {
    const { handle, ret } = dialogOpen(`${trigger}<div id="d"><button>x</button></div>`, () =>
      $("#t"),
    )
    handle.release()
    ret.restore()
    await settle()
    expect(document.activeElement).toBe($("#t"))
  })

  it("honours the consumer's choice, and false means do not move", async () => {
    html(`${trigger}<button id="o">other</button><div id="d"><button id="x">x</button></div>`)
    const handle = open("d1", $("#d"))
    const ret = captureFocus(env, handle, document, () => $("#t"))
    $("#x").focus()
    ret.restore(() => $("#o"))
    await settle()
    expect(document.activeElement).toBe($("#o"))
    $("#x").focus()
    ret.restore(() => false)
    await settle()
    expect(document.activeElement).toBe($("#x"))
  })

  it("falls back to the most recent connected element of the focus history (trigger focused after history started)", async () => {
    html(
      `<button id="mt">menu</button><div id="menu"><button id="mi">item</button></div><div id="d"><button id="x">x</button></div>`,
    )
    $("#mt").focus()
    const menu = open("menu", $("#menu"))
    captureFocus(env, menu, document)
    // The history starts at the first capture; the trigger was focused before it, so focus it again.
    $("#mt").blur()
    $("#mt").focus()
    $("#mi").focus()
    const dialogHandle = open("d1", $("#d"))
    const ret = captureFocus(env, dialogHandle, document)
    $("#x").focus()
    $("#menu").remove()
    dialogHandle.release()
    ret.restore()
    await settle()
    expect(document.activeElement).toBe($("#mt"))
  })

  // The history is installed lazily by the first captureFocus, so a trigger focused just before
  // the first layer opened (the normal click-then-open flow) is never recorded: focus ends on body.
  it("falls back to the trigger focused before the first layer opened (react-spectrum#2444)", async () => {
    html(
      `<button id="mt">menu</button><div id="menu"><button id="mi">item</button></div><div id="d"><button id="x">x</button></div>`,
    )
    $("#mt").focus()
    const menu = open("menu", $("#menu"))
    captureFocus(env, menu, document)
    $("#mi").focus()
    const dialogHandle = open("d1", $("#d"))
    const ret = captureFocus(env, dialogHandle, document)
    $("#x").focus()
    $("#menu").remove()
    dialogHandle.release()
    ret.restore()
    await settle()
    expect(document.activeElement).toBe($("#mt"))
  })

  it("restores into a trigger that was inert while open", async () => {
    html(`<div id="app">${trigger}</div><div id="d"><button id="x">x</button></div>`)
    $("#t").focus()
    const handle = open("d1", $("#d"))
    const ret = captureFocus(env, handle, document)
    $("#app").setAttribute("inert", "")
    $("#x").focus()
    handle.release()
    $("#app").removeAttribute("inert")
    ret.restore()
    await settle()
    expect(document.activeElement).toBe($("#t"))
  })

  it("never focuses inside an inert subtree", async () => {
    html(`<div id="app">${trigger}</div><div id="d"><button id="x">x</button></div>`)
    $("#t").focus()
    const handle = open("d1", $("#d"))
    const ret = captureFocus(env, handle, document)
    $("#app").setAttribute("inert", "")
    $("#x").focus()
    handle.release()
    ret.restore()
    await settle()
    expect(document.activeElement).not.toBe($("#t"))
  })

  it("leaves focus the user moved elsewhere", async () => {
    html(`${trigger}<input id="field"><div id="d"><button id="x">x</button></div>`)
    $("#t").focus()
    const handle = open("d1", $("#d"))
    const ret = captureFocus(env, handle, document)
    $("#x").focus()
    $("#field").focus()
    handle.release()
    ret.restore()
    await settle()
    expect(document.activeElement).toBe($("#field"))
  })

  it("falls back to the parent layer's container", async () => {
    html(`<div id="p"><button id="pb">pb</button></div><div id="d"><button id="x">x</button></div>`)
    const parent = open("parent", $("#p"))
    const child = open("d1", $("#d"), "parent")
    expect(child.parentId).toBe(parent.id)
    const ret = captureFocus(env, child, document)
    $("#x").focus()
    $("#pb").remove()
    child.release()
    ret.restore()
    await settle()
    expect(document.activeElement).toBe($("#p"))
  })

  it("falls back to the parent's declared container, not its first element", async () => {
    html(
      `<div id="pos"><div id="pc" role="dialog"></div></div><div id="d"><button id="x">x</button></div>`,
    )
    const st = getLayerStack(document)
    st.push({
      id: layerId("parent"),
      kind: "dialog",
      modal: true,
      elements: () => [$("#pos"), $("#pc")],
      container: () => $("#pc"),
    })
    const child = open("d1", $("#d"), "parent")
    const ret = captureFocus(env, child, document)
    $("#x").focus()
    child.release()
    ret.restore()
    await settle()
    expect(document.activeElement).toBe($("#pc"))
    expect($("#pos").hasAttribute("tabindex")).toBe(false)
  })

  it("schedules no timers", async () => {
    const { handle, ret } = dialogOpen(
      `${trigger}<div id="d"><button id="x">x</button></div>`,
      () => $("#t"),
    )
    $("#x").focus()
    vi.useFakeTimers()
    const pending = vi.getTimerCount()
    handle.release()
    ret.restore()
    await Promise.resolve()
    // jsdom's own focus() schedules a timer under fake timers, so only real browsers can tell.
    if (inBrowser) expect(vi.getTimerCount()).toBe(pending)
    expect(document.activeElement).toBe($("#t"))
  })

  it("keeps the keyboard modality after a keyboard close", async () => {
    html(`${trigger}<div id="d"><button id="x">x</button></div>`)
    $("#t").focus()
    const handle = open("d1", $("#d"))
    const ret = captureFocus(env, handle, document)
    $("#x").focus()
    $("#x").dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
    handle.release()
    ret.restore()
    await settle()
    expect(document.activeElement).toBe($("#t"))
    expect(env.modality.modality()).toBe("keyboard")
  })

  it("keeps the pointer modality after a pointer close", async () => {
    html(`${trigger}<div id="d"><button id="x">x</button></div>`)
    $("#t").focus()
    const handle = open("d1", $("#d"))
    const ret = captureFocus(env, handle, document)
    $("#x").focus()
    $("#x").dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        pointerType: "mouse",
        width: 10,
        height: 10,
        pressure: 0.5,
      }),
    )
    handle.release()
    ret.restore()
    await settle()
    expect(document.activeElement).toBe($("#t"))
    expect(env.modality.modality()).toBe("pointer")
  })
})

describe("shadow DOM", () => {
  function shadowDialog() {
    html(`<div id="d"><div id="host"></div></div>`)
    const root = $("#host").attachShadow({ mode: "open" })
    root.innerHTML = `<button id="a">a</button><button id="b">b</button>`
    return root
  }

  it("lists tab stops through shadow roots", () => {
    const root = shadowDialog()
    expect(tabbables($("#d")).map((el) => el.id)).toEqual(["a", "b"])
    expect(root.querySelectorAll("button").length).toBe(2)
  })

  it("wraps Tab from the last shadow element to the first", async () => {
    const root = shadowDialog()
    contain("d1", $("#d"))
    $("#b", root).focus()
    const e = tab($("#b", root))
    await settle()
    expect(e.defaultPrevented).toBe(true)
    expect(root.activeElement).toBe($("#a", root))
  })

  it("recovers when the focused element inside a shadow root is removed", async () => {
    const root = shadowDialog()
    contain("d1", $("#d"))
    $("#a", root).focus()
    $("#a", root).remove()
    await settle()
    expect(document.activeElement).toBe($("#d"))
  })

  it("recovers inside a modal whose container lives in a shadow root", async () => {
    html(`<div id="host"></div>`)
    const root = $("#host").attachShadow({ mode: "open" })
    root.innerHTML = `<div id="c"><button id="rm">rm</button><button id="k">k</button></div>`
    contain("d1", $("#c", root))
    $("#rm", root).focus()
    $("#rm", root).remove()
    await settle()
    expect(root.activeElement).toBe($("#c", root))
  })

  it("moves initial focus into the shadow root", async () => {
    const root = shadowDialog()
    focusInitial(env, $("#d"))
    await frame()
    expect(root.activeElement).toBe($("#a", root))
  })
})
