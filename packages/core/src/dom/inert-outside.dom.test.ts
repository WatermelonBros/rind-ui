import { afterEach, describe, expect, it } from "vitest"
import { hideOutsideModal, inertOutside } from "./inert-outside"
import { getLayerStack, type LayerHandle, type LayerId, layerId } from "./layer-stack"

const inBrowser = !navigator.userAgent.includes("jsdom")

afterEach(() => {
  document.body.innerHTML = ""
})

const stack = () => getLayerStack(document)
const isInert = (el: Element) => el.hasAttribute("inert")

/** A realistic page: app root with nested sections, a script and a style. */
function page() {
  document.body.innerHTML = `
    <div id="app">
      <header id="header"><nav><a href="#x">Home</a></nav></header>
      <main id="main"><section id="section"><button id="open">Open</button></section></main>
      <script id="script">/* noop */</script>
      <style id="style">.x { color: red }</style>
    </div>
    <script id="body-script">/* noop */</script>
    <template id="tpl"><p>t</p></template>
    <link id="link" rel="stylesheet" href="data:text/css," />`
  const q = (id: string) => document.getElementById(id) as HTMLElement
  return { app: q("app"), main: q("main"), section: q("section"), header: q("header") }
}

/** Portalled dialog content at the end of <body>, with an inner button. */
function portal(id = "dialog") {
  const wrapper = document.createElement("div")
  wrapper.dataset["portal"] = id
  const content = document.createElement("div")
  content.id = id
  content.setAttribute("role", "dialog")
  content.innerHTML = `<button id="${id}-btn">ok</button>`
  wrapper.append(content)
  document.body.append(wrapper)
  return { wrapper, content }
}

function open(
  id: string,
  content: Element,
  extra: { modal?: boolean; parent?: LayerId; kind?: "dialog" | "listbox" | "popover" } = {},
): LayerHandle {
  return stack().push({
    id: layerId(id),
    kind: extra.kind ?? "dialog",
    modal: extra.modal ?? true,
    parent: extra.parent,
    elements: () => [content],
  })
}

const snapshot = () =>
  Array.from(document.querySelectorAll("*")).map((el) => [el, el.getAttribute("inert")] as const)

describe("page behind a dialog", () => {
  it("makes the app inert and exposes the dialog and its ancestors", () => {
    const { app } = page()
    const { wrapper, content } = portal()
    hideOutsideModal(document)
    open("d1", content)

    expect(isInert(app)).toBe(true)
    expect(isInert(content)).toBe(false)
    expect(isInert(wrapper)).toBe(false)
    expect(isInert(document.body)).toBe(false)
    expect(isInert(document.documentElement)).toBe(false)
  })

  it("never puts inert or aria-hidden on html and body, nor aria-hidden anywhere", () => {
    page()
    const { content } = portal()
    hideOutsideModal(document)
    open("d1", content)

    for (const el of [document.documentElement, document.body]) {
      expect(el.hasAttribute("inert")).toBe(false)
      expect(el.hasAttribute("aria-hidden")).toBe(false)
    }
    expect(document.querySelectorAll("[aria-hidden]")).toHaveLength(0)
  })

  it("never marks script, style, template or link", () => {
    page()
    const { content } = portal()
    hideOutsideModal(document)
    open("d1", content)

    for (const id of ["script", "style", "body-script", "tpl", "link"]) {
      expect(isInert(document.getElementById(id) as Element)).toBe(false)
    }
  })
})

describe("recomputed from the stack", () => {
  it("nested modal: parent inert, nested and its ancestors not; parent exposed again after release", () => {
    const { app } = page()
    const parent = portal("parent")
    hideOutsideModal(document)
    open("d1", parent.content)
    expect(isInert(app)).toBe(true)
    expect(isInert(parent.content)).toBe(false)

    const nested = portal("nested")
    const handle = open("d2", nested.content, { parent: layerId("d1") })

    expect(isInert(parent.wrapper)).toBe(true)
    expect(isInert(app)).toBe(true)
    expect(isInert(nested.content)).toBe(false)
    expect(isInert(nested.wrapper)).toBe(false)
    for (let n: Element | null = nested.content; n; n = n.parentElement) {
      expect(isInert(n)).toBe(false)
      expect(n.closest("[aria-hidden]")).toBeNull()
    }

    handle.release()
    expect(isInert(parent.wrapper)).toBe(false)
    expect(isInert(parent.content)).toBe(false)
    expect(isInert(app)).toBe(true)
    // The nested content is closing: inert until its presence completes.
    expect(isInert(nested.content)).toBe(true)
    handle.dispose()
    expect(isInert(nested.content)).toBe(false)
  })

  it("a nested layer sharing the parent's portal keeps both exposed", () => {
    page()
    const { wrapper, content } = portal("parent")
    const inner = document.createElement("div")
    wrapper.append(inner)
    hideOutsideModal(document)
    open("d1", content)
    open("d2", inner, { parent: layerId("d1") })

    expect(isInert(content)).toBe(true)
    expect(isInert(inner)).toBe(false)
    expect(isInert(wrapper)).toBe(false)
  })

  it("non-modal layer alone: nothing is inert", () => {
    page()
    const { content } = portal("popup")
    hideOutsideModal(document)
    open("c1", content, { modal: false, kind: "listbox" })

    expect(document.querySelectorAll("[inert]")).toHaveLength(0)
    expect(document.querySelectorAll("[aria-hidden]")).toHaveLength(0)
  })

  it("portalled child of a modal (select) is not inert", () => {
    const { app } = page()
    const dialog = portal("dialog")
    hideOutsideModal(document)
    open("d1", dialog.content)

    const listbox = document.createElement("div")
    listbox.setAttribute("role", "listbox")
    document.body.append(listbox)
    open("s1", listbox, { modal: false, kind: "listbox", parent: layerId("d1") })

    expect(isInert(listbox)).toBe(false)
    expect(isInert(dialog.content)).toBe(false)
    expect(isInert(app)).toBe(true)
  })
})

describe("what stays exposed", () => {
  it("toast region above a dialog is not inert", () => {
    page()
    const toast = document.createElement("div")
    toast.dataset["rindTopLayer"] = ""
    toast.innerHTML = `<button id="undo">Undo</button>`
    document.body.append(toast)
    const { content } = portal()
    hideOutsideModal(document)
    open("d1", content)

    expect(isInert(toast)).toBe(false)
    expect(toast.querySelector("#undo")?.closest("[inert]")).toBeNull()
  })

  it("the live announcer stays exposed", () => {
    const { app } = page()
    const announcer = document.createElement("div")
    announcer.dataset["liveAnnouncer"] = ""
    document.body.append(announcer)
    const { content } = portal()
    hideOutsideModal(document)
    open("d1", content)

    expect(isInert(announcer)).toBe(false)
    expect(isInert(app)).toBe(true)
  })

  it("a status region inside the app and its path are exposed, its siblings are not", () => {
    const { app, main, section, header } = page()
    const status = document.createElement("div")
    status.setAttribute("role", "status")
    section.append(status)
    const { content } = portal()
    hideOutsideModal(document)
    open("d1", content)

    expect(isInert(app)).toBe(false)
    expect(isInert(main)).toBe(false)
    expect(isInert(section)).toBe(false)
    expect(isInert(status)).toBe(false)
    expect(status.closest("[inert]")).toBeNull()
    expect(isInert(header)).toBe(true)
    expect(isInert(document.getElementById("open") as Element)).toBe(true)
  })

  it("inertOutside honours the keep-visible rule on its own", () => {
    page()
    const region = document.createElement("div")
    region.setAttribute("aria-live", "polite")
    document.body.append(region)
    const { content } = portal()
    const undo = inertOutside(document, [content])

    expect(isInert(region)).toBe(false)
    expect(isInert(document.getElementById("app") as Element)).toBe(true)
    undo()
    expect(document.querySelectorAll("[inert]")).toHaveLength(0)
  })
})

describe("nodes added while open", () => {
  it("a password manager node appended to body is left alone", () => {
    page()
    const { content } = portal()
    hideOutsideModal(document)
    open("d1", content)

    const menu = document.createElement("div")
    menu.dataset["extension"] = "autofill"
    document.body.append(menu)
    // A further stack change that keeps the same topmost modal must not re-walk.
    const popup = document.createElement("div")
    open("p1", popup, { modal: false, kind: "popover", parent: layerId("d1") })

    expect(isInert(menu)).toBe(false)
  })
})

describe("reference-counted, exact restore", () => {
  it("keeps the author's own inert through open and close", () => {
    const { section } = page()
    section.setAttribute("inert", "")
    const { content } = portal()
    hideOutsideModal(document)
    const handle = open("d1", content)
    expect(isInert(section)).toBe(true)

    handle.release()
    handle.dispose()
    expect(isInert(section)).toBe(true)
    expect(section.getAttribute("inert")).toBe("")
  })

  it.each([
    ["first opened closes first", 0],
    ["first opened closes last", 1],
  ])("two sibling modals: %s, DOM is back to its starting attributes", (_name, order) => {
    page()
    const a = portal("a")
    const b = portal("b")
    const before = snapshot()
    hideOutsideModal(document)

    const ha = open("a", a.content)
    const hb = open("b", b.content)
    expect(isInert(a.wrapper)).toBe(true)
    expect(isInert(b.wrapper)).toBe(false)

    const [first, second] = order === 0 ? [ha, hb] : [hb, ha]
    first.release()
    first.dispose()
    second.release()
    second.dispose()

    expect(snapshot()).toEqual(before)
    expect(document.querySelectorAll("[inert]")).toHaveLength(0)
  })

  it("two stacked modals closed topmost first restore the page", () => {
    page()
    const a = portal("a")
    const b = portal("b")
    const before = snapshot()
    hideOutsideModal(document)
    const ha = open("a", a.content)
    const hb = open("b", b.content)

    hb.release()
    hb.dispose()
    ha.release()
    ha.dispose()

    expect(snapshot()).toEqual(before)
  })
})

describe("closing content is inert while it exits", () => {
  it("is inert from release until dispose", () => {
    page()
    const { content, wrapper } = portal()
    hideOutsideModal(document)
    const handle = open("d1", content)
    expect(isInert(content)).toBe(false)

    handle.release()
    expect(isInert(content)).toBe(true)
    // The page is back: nothing else is inert while the dialog animates out.
    expect(isInert(document.getElementById("app") as Element)).toBe(false)
    expect(isInert(wrapper)).toBe(false)

    handle.dispose()
    expect(isInert(content)).toBe(false)
  })

  it.runIf(inBrowser)("Tab during exit: focus cannot stay in or enter the closing content", () => {
    page()
    const { content } = portal()
    const button = content.querySelector("button") as HTMLButtonElement
    hideOutsideModal(document)
    const handle = open("d1", content)
    button.focus()
    expect(document.activeElement).toBe(button)

    handle.release()
    // Blur first: the browser's own focus fix-up for a newly inert element runs asynchronously.
    button.blur()
    button.focus()
    expect(document.activeElement).not.toBe(button)
    handle.dispose()
  })
})
