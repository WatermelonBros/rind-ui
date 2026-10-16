import { afterEach, describe, expect, it } from "vitest"
import { portalHostAttributes, resolvePortalTarget, syncPortalHost } from "./portal"

afterEach(() => {
  Reflect.deleteProperty(document, "fullscreenElement")
  document.body.innerHTML = ""
})

const html = (markup: string) => {
  document.body.innerHTML = markup
}
const q = (sel: string) => document.querySelector(sel) as HTMLElement

describe("resolvePortalTarget", () => {
  it("defaults to the body, also without a logical parent", () => {
    html(`<div><button id="t"></button></div>`)
    expect(resolvePortalTarget(q("#t"))).toBe(document.body)
    expect(resolvePortalTarget(null)).toBe(document.body)
  })

  it("lets an explicit container win over everything", () => {
    html(`<dialog id="d"><button id="t"></button></dialog><div id="c"></div>`)
    expect(resolvePortalTarget(q("#t"), q("#c"))).toBe(q("#c"))
  })

  it.runIf(typeof HTMLDialogElement.prototype.showModal === "function")(
    "renders inside an open modal dialog holding the parent",
    () => {
      html(`<dialog id="d"><button id="t"></button></dialog>`)
      const dialog = q("#d") as HTMLDialogElement
      dialog.showModal()
      expect(resolvePortalTarget(q("#t"))).toBe(dialog)
      dialog.close()
      expect(resolvePortalTarget(q("#t"))).toBe(document.body)
    },
  )

  it.runIf(
    typeof HTMLElement.prototype.showPopover === "function" &&
      typeof CSS !== "undefined" &&
      CSS.supports("selector(:popover-open)"),
  )("renders inside an open [popover] holding the parent", () => {
    html(`<div id="p" popover="manual"><button id="t"></button></div>`)
    q("#p").showPopover()
    expect(resolvePortalTarget(q("#t"))).toBe(q("#p"))
    q("#p").hidePopover()
    expect(resolvePortalTarget(q("#t"))).toBe(document.body)
  })

  it("renders inside the fullscreen element holding the parent", () => {
    html(`<div id="fs"><button id="t"></button></div><button id="other"></button>`)
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      get: () => q("#fs"),
    })
    expect(resolvePortalTarget(q("#t"))).toBe(q("#fs"))
    expect(resolvePortalTarget(q("#other"))).toBe(document.body)
  })

  it("renders into the shadow root holding the parent", () => {
    html(`<div id="host"></div>`)
    const shadow = q("#host").attachShadow({ mode: "open" })
    shadow.innerHTML = `<button id="t"></button>`
    const trigger = shadow.getElementById("t") as HTMLElement
    expect(resolvePortalTarget(trigger)).toBe(shadow)
  })
})

describe("portalHostAttributes", () => {
  it("reads dir, lang and theme from the nearest ancestors", () => {
    html(`
      <div data-theme="dark" data-rind-theme="acme">
        <section dir="rtl" lang="ar"><div dir="ltr"><button id="t"></button></div></section>
      </div>`)
    expect(portalHostAttributes(q("#t"))).toEqual({
      dir: "ltr",
      lang: "ar",
      "data-rind-theme": "acme",
      "data-theme": "dark",
    })
  })

  it("is empty without a parent or any such ancestor", () => {
    html(`<button id="t"></button>`)
    expect(portalHostAttributes(null)).toEqual({})
    expect(portalHostAttributes(q("#t"))["data-theme"]).toBeUndefined()
  })
})

describe("syncPortalHost", () => {
  const settle = async () => {
    await Promise.resolve()
    await new Promise<void>((r) => requestAnimationFrame(() => r()))
  }

  it("copies the attributes and follows ancestor changes until cleaned up", async () => {
    html(`
      <div id="scope" data-theme="light" dir="rtl" lang="ar"><button id="t"></button></div>
      <div id="host"></div>`)
    const host = q("#host")
    const stop = syncPortalHost(host, () => q("#t"))
    expect(host.getAttribute("data-theme")).toBe("light")
    expect(host.getAttribute("dir")).toBe("rtl")
    expect(host.getAttribute("lang")).toBe("ar")

    q("#scope").setAttribute("data-theme", "dark")
    await settle()
    expect(host.getAttribute("data-theme")).toBe("dark")

    q("#scope").removeAttribute("data-theme")
    await settle()
    expect(host.hasAttribute("data-theme")).toBe(false)

    stop()
    q("#scope").setAttribute("data-theme", "dark")
    await settle()
    expect(host.hasAttribute("data-theme")).toBe(false)
  })
})
