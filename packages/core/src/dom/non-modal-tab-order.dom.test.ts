// Non-modal Tab order (openspec add-popover, non-modal-tab-order): with real layers in the
// layer stack, a keydown stands for the key press and a small walker stands for the browser's
// default action (next tab stop in document order) when the handler lets it through.
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { domEnvironment } from "../env/dom-environment"
import { tabbables } from "./focus-scope"
import { getLayerStack, type LayerHandle, layerId } from "./layer-stack"
import { trackNonModalTabOrder } from "./non-modal-tab-order"
import { platforms } from "./platform"

const env = domEnvironment({ platform: platforms.windows })
const cleanups: (() => void)[] = []
let off = () => {}
beforeEach(() => {
  off = env.modality.subscribe(() => {})
})
afterEach(() => {
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

/** Opens a non-modal layer and starts the tab-order tracking, as the Popover machine does. */
function open(
  id: string,
  trigger: HTMLElement,
  content: HTMLElement,
  parent?: string,
): { layer: LayerHandle; stop: () => void } {
  const layer = getLayerStack(document).push({
    id: layerId(id),
    kind: "popover",
    family: "popover",
    modal: false,
    elements: () => [trigger, content],
    container: () => content,
    ...(parent ? { parent: layerId(parent) } : {}),
  })
  const stopTab = trackNonModalTabOrder(env, {
    trigger: () => trigger,
    content: () => content,
    layer,
  })
  const stop = () => {
    stopTab()
    layer.release()
  }
  cleanups.push(stop)
  return { layer, stop }
}

function key(from: Element, shiftKey = false, init: KeyboardEventInit = {}) {
  const e = new KeyboardEvent("keydown", {
    key: "Tab",
    shiftKey,
    bubbles: true,
    composed: true,
    cancelable: true,
    ...init,
  })
  from.dispatchEvent(e)
  return e
}
const deepActive = () => {
  let a: Element | null = document.activeElement
  while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement
  return a
}
const settle = () => new Promise((r) => setTimeout(r, 30))
const idOf = (el: Element | null) => el?.id ?? "(none)"

/** Presses Tab, then does what the browser would if nothing handled it. */
async function tabOnce(shift = false) {
  const from = deepActive() ?? document.body
  const e = key(from, shift)
  await settle()
  if (e.defaultPrevented) return
  const order = tabbables(document.body)
  const at = order.indexOf(from as HTMLElement)
  const next = order[at + (shift ? -1 : 1)]
  next?.focus()
}
async function walk(steps: number) {
  const seen: string[] = []
  for (let i = 0; i < steps; i++) {
    await tabOnce()
    seen.push(idOf(deepActive()))
  }
  return seen
}

describe("Content follows its trigger", () => {
  it("Tab from the trigger enters portalled content, not the next element in the DOM", async () => {
    html(`<button id="trigger">Open</button><button id="save">Save</button>
      <div id="portal"><div id="content" tabindex="-1"><input id="a"><button id="b">B</button></div></div>`)
    open("p", $("#trigger"), $("#content"))
    $("#trigger").focus()
    const e = key($("#trigger"))
    expect(e.defaultPrevented).toBe(true)
    await settle()
    expect(idOf(deepActive())).toBe("a")
  })

  it("content without tabbable elements: Tab on the trigger is left to the browser", async () => {
    html(`<button id="trigger">Open</button><button id="save">Save</button>
      <div id="content" tabindex="-1"><p>Text only</p></div>`)
    open("p", $("#trigger"), $("#content"))
    $("#trigger").focus()
    expect(key($("#trigger")).defaultPrevented).toBe(false)
    await tabOnce()
    expect(idOf(deepActive())).toBe("save")
  })

  it("positive tabindex first, as in focus containment", async () => {
    html(`<button id="trigger">Open</button>
      <div id="content" tabindex="-1"><input id="a"><input id="z" tabindex="1"></div>`)
    open("p", $("#trigger"), $("#content"))
    $("#trigger").focus()
    key($("#trigger"))
    await settle()
    expect(idOf(deepActive())).toBe("z")
  })

  it("modified Tab presses (Alt, Ctrl, Meta) and other keys are not handled", () => {
    html(`<button id="trigger">Open</button><div id="content" tabindex="-1"><input id="a"></div>`)
    open("p", $("#trigger"), $("#content"))
    for (const mod of ["altKey", "ctrlKey", "metaKey"] as const) {
      expect(key($("#trigger"), false, { [mod]: true }).defaultPrevented, mod).toBe(false)
    }
    const enter = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })
    $("#trigger").dispatchEvent(enter)
    expect(enter.defaultPrevented).toBe(false)
  })

  it("Shift+Tab on the trigger is not handled", () => {
    html(`<button id="trigger">Open</button><div id="content" tabindex="-1"><input id="a"></div>`)
    open("p", $("#trigger"), $("#content"))
    expect(key($("#trigger"), true).defaultPrevented).toBe(false)
  })
})

describe("Leaving backward", () => {
  it("Shift+Tab from the first tabbable goes to the trigger; the layer stays open", async () => {
    html(`<button id="trigger">Open</button>
      <div id="content" tabindex="-1"><input id="a"><button id="b">B</button></div>`)
    const { layer } = open("p", $("#trigger"), $("#content"))
    $("#a").focus()
    expect(key($("#a"), true).defaultPrevented).toBe(true)
    await settle()
    expect(idOf(deepActive())).toBe("trigger")
    expect(getLayerStack(document).get(layer.id)).toBeDefined()
  })

  it("Shift+Tab from the content element itself goes to the trigger", async () => {
    html(`<button id="trigger">Open</button>
      <div id="content" tabindex="-1"><input id="a"></div>`)
    open("p", $("#trigger"), $("#content"))
    $("#content").focus()
    key($("#content"), true)
    await settle()
    expect(idOf(deepActive())).toBe("trigger")
  })

  it("Shift+Tab from a later element is left to the browser", () => {
    html(`<button id="trigger">Open</button>
      <div id="content" tabindex="-1"><input id="a"><button id="b">B</button></div>`)
    open("p", $("#trigger"), $("#content"))
    $("#b").focus()
    expect(key($("#b"), true).defaultPrevented).toBe(false)
  })
})

describe("Leaving forward", () => {
  it("Tab from the last tabbable continues after the trigger (radix#4128)", async () => {
    html(`<button id="trigger">Open</button><button id="save">Save</button>
      <div id="content" tabindex="-1"><input id="a"><button id="b">B</button></div>`)
    open("p", $("#trigger"), $("#content"))
    $("#b").focus()
    expect(key($("#b")).defaultPrevented).toBe(true)
    await settle()
    expect(idOf(deepActive())).toBe("save")
  })

  it("Tab from a middle element is left to the browser", () => {
    html(`<button id="trigger">Open</button>
      <div id="content" tabindex="-1"><input id="a"><button id="b">B</button></div>`)
    open("p", $("#trigger"), $("#content"))
    $("#a").focus()
    expect(key($("#a")).defaultPrevented).toBe(false)
  })

  it("from the content element itself when it has no tabbable element", async () => {
    html(`<button id="trigger">Open</button><button id="save">Save</button>
      <div id="content" tabindex="-1"><p>Text</p></div>`)
    open("p", $("#trigger"), $("#content"))
    $("#content").focus()
    expect(key($("#content")).defaultPrevented).toBe(true)
    await settle()
    expect(idOf(deepActive())).toBe("save")
  })

  it("skips the content and its descendant layers when looking after the trigger", async () => {
    // Both contents are inline right after the trigger, the child's after the parent's.
    html(`<button id="trigger">Open</button>
      <div id="content" tabindex="-1"><input id="a"><button id="child-trigger">C</button><button id="last">L</button></div>
      <div id="child" tabindex="-1"><button id="c">C1</button></div>
      <button id="save">Save</button>`)
    open("p", $("#trigger"), $("#content"))
    open("child", $("#child-trigger"), $("#child"), "p")
    $("#last").focus()
    key($("#last"))
    await settle()
    expect(idOf(deepActive())).toBe("save")
  })

  it("nothing after the trigger: no throw, no recursion, left to the browser (base-ui#5715)", () => {
    html(`<div id="content" tabindex="-1"><p>Text</p></div><button id="trigger">Open</button>`)
    open("p", $("#trigger"), $("#content"))
    $("#content").focus()
    let e: KeyboardEvent | undefined
    expect(() => {
      e = key($("#content"))
    }).not.toThrow()
    expect(e?.defaultPrevented).toBe(false)
    expect(document.activeElement).toBe($("#content"))
  })

  it("nothing after the trigger from the last tabbable: also left to the browser", () => {
    html(`<div id="content" tabindex="-1"><input id="a"></div><button id="trigger">Open</button>`)
    open("p", $("#trigger"), $("#content"))
    $("#a").focus()
    expect(key($("#a")).defaultPrevented).toBe(false)
  })
})

describe("Independent of DOM position", () => {
  const fixture = (portalled: boolean) => {
    const content = `<div id="content" tabindex="-1"><input id="a"><button id="b">B</button></div>`
    html(`<button id="before">Before</button>
      <button id="trigger">Open</button>${portalled ? "" : content}
      <button id="save">Save</button><button id="end">End</button>
      ${portalled ? `<div id="portal">${content}</div>` : ""}`)
    open("p", $("#trigger"), $("#content"))
    $("#before").focus()
  }

  it("inline and portalled content give the same Tab order", async () => {
    fixture(true)
    const portalled = await walk(5)
    for (const c of cleanups.splice(0)) c()
    fixture(false)
    const inline = await walk(5)
    expect(portalled).toEqual(["trigger", "a", "b", "save", "end"])
    expect(inline).toEqual(portalled)
  })

  it("Shift+Tab retraces the same sequence", async () => {
    fixture(true)
    await walk(3) // trigger, a, b
    const back: string[] = []
    for (let i = 0; i < 3; i++) {
      await tabOnce(true)
      back.push(idOf(deepActive()))
    }
    expect(back).toEqual(["a", "trigger", "before"])
  })
})

describe("Nested non-modal layers", () => {
  it("B's last element continues after B's trigger inside A; A stays", async () => {
    html(`<button id="trigger">A</button><button id="outside">Outside</button>
      <div id="a-content" tabindex="-1">
        <button id="b-trigger">B</button><button id="a-next">Next in A</button>
      </div>
      <div id="b-content" tabindex="-1"><input id="b1"><button id="b2">B2</button></div>`)
    const a = open("a", $("#trigger"), $("#a-content"))
    const b = open("b", $("#b-trigger"), $("#b-content"), "a")
    $("#b2").focus()
    expect(key($("#b2")).defaultPrevented).toBe(true)
    await settle()
    expect(idOf(deepActive())).toBe("a-next")
    expect(getLayerStack(document).get(a.layer.id)).toBeDefined()
    expect(getLayerStack(document).get(b.layer.id)).toBeDefined()
  })

  it("Tab on B's trigger enters B's content, not A's", async () => {
    html(`<button id="trigger">A</button>
      <div id="a-content" tabindex="-1"><button id="b-trigger">B</button><button id="a-next">N</button></div>
      <div id="b-content" tabindex="-1"><input id="b1"></div>`)
    open("a", $("#trigger"), $("#a-content"))
    open("b", $("#b-trigger"), $("#b-content"), "a")
    $("#b-trigger").focus()
    key($("#b-trigger"))
    await settle()
    expect(idOf(deepActive())).toBe("b1")
  })

  it("the parent ignores keys pressed inside a descendant layer's content", async () => {
    html(`<button id="trigger">A</button><button id="outside">Outside</button>
      <div id="a-content" tabindex="-1"><button id="b-trigger">B</button></div>
      <div id="b-content" tabindex="-1"><button id="b1">B1</button></div>`)
    open("a", $("#trigger"), $("#a-content"))
    open("b", $("#b-trigger"), $("#b-content"), "a")
    $("#b1").focus()
    key($("#b1"), true) // first of B: back to B's trigger, not A's
    await settle()
    expect(idOf(deepActive())).toBe("b-trigger")
  })
})

describe("No sentinels and no focus reclaim", () => {
  it("adds no tabindex=0 element and no element at all", () => {
    html(`<button id="trigger">Open</button><div id="content" tabindex="-1"><input id="a"></div>`)
    const before = document.body.innerHTML
    const tab0 = document.querySelectorAll('[tabindex="0"]').length
    open("p", $("#trigger"), $("#content"))
    expect(document.querySelectorAll('[tabindex="0"]').length).toBe(tab0)
    expect(document.body.innerHTML).toBe(before)
  })

  it("an inner widget that handles Tab (preventDefault) keeps focus", async () => {
    html(`<button id="trigger">Open</button><button id="save">Save</button>
      <div id="content" tabindex="-1"><textarea id="editor"></textarea></div>`)
    open("p", $("#trigger"), $("#content"))
    $("#editor").addEventListener("keydown", (e) => {
      if (e.key === "Tab") e.preventDefault()
    })
    $("#editor").focus()
    const e = key($("#editor"))
    await settle()
    expect(e.defaultPrevented).toBe(true)
    expect(idOf(deepActive())).toBe("editor")
  })

  it("does not redirect focusin: focusing outside the content stays there", async () => {
    html(`<button id="trigger">Open</button><button id="other">Other</button>
      <div id="content" tabindex="-1"><input id="a"></div>`)
    open("p", $("#trigger"), $("#content"))
    $("#other").focus()
    await settle()
    expect(idOf(deepActive())).toBe("other")
  })

  it("IME composition Tab is not handled", () => {
    html(`<button id="trigger">Open</button><div id="content" tabindex="-1"><input id="a"></div>`)
    open("p", $("#trigger"), $("#content"))
    expect(
      key($("#trigger"), false, { isComposing: true } as KeyboardEventInit).defaultPrevented,
    ).toBe(false)
  })

  it("the cleanup removes the handlers", () => {
    html(`<button id="trigger">Open</button><div id="content" tabindex="-1"><input id="a"></div>`)
    const { stop } = open("p", $("#trigger"), $("#content"))
    stop()
    expect(key($("#trigger")).defaultPrevented).toBe(false)
    $("#a").focus()
    expect(key($("#a"), true).defaultPrevented).toBe(false)
  })
})

describe("Shadow roots", () => {
  it("trigger inside an open shadow root: leaving forward focuses the button after it (headlessui#2951)", async () => {
    const host = document.createElement("div")
    host.id = "host"
    document.body.append(host)
    const shadow = host.attachShadow({ mode: "open" })
    shadow.innerHTML = `<button id="trigger">Open</button><button id="in-shadow">After</button>`
    const content = document.createElement("div")
    content.id = "content"
    content.tabIndex = -1
    content.innerHTML = `<input id="a"><button id="b">B</button>`
    document.body.append(content)
    const trigger = $("#trigger", shadow)
    open("p", trigger, content)
    $("#b").focus()
    expect(key($("#b")).defaultPrevented).toBe(true)
    await settle()
    expect(deepActive()).toBe($("#in-shadow", shadow))
  })

  it("Tab on a trigger in a shadow root enters the content", async () => {
    const host = document.createElement("div")
    document.body.append(host)
    const shadow = host.attachShadow({ mode: "open" })
    shadow.innerHTML = `<button id="trigger">Open</button>`
    const content = document.createElement("div")
    content.tabIndex = -1
    content.innerHTML = `<input id="a">`
    document.body.append(content)
    const trigger = $("#trigger", shadow)
    open("p", trigger, content)
    trigger.focus()
    key(trigger)
    await settle()
    expect(idOf(deepActive())).toBe("a")
  })

  it("content inside a shadow root keeps the order", async () => {
    html(`<button id="trigger">Open</button><button id="save">Save</button><div id="host"></div>`)
    const shadow = $("#host").attachShadow({ mode: "open" })
    shadow.innerHTML = `<div id="content" tabindex="-1"><input id="a"><button id="b">B</button></div>`
    open("p", $("#trigger"), $("#content", shadow))
    $("#trigger").focus()
    key($("#trigger"))
    await settle()
    expect(deepActive()).toBe($("#a", shadow))
    $("#b", shadow).focus()
    key($("#b", shadow))
    await settle()
    expect(idOf(deepActive())).toBe("save")
  })
})
