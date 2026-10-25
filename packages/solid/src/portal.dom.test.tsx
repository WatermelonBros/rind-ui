/** @jsxImportSource solid-js */
// The layer portal: a host div[data-rind-portal] in the target (React's createPortal markup, no
// Solid wrapper), mounted after hydration, carrying the logical parent's dir and lang, crossing
// context, removed on cleanup and moved when the container changes.
import { createContext, createSignal, useContext } from "solid-js"
import { describe, expect, it } from "vitest"
import { mount } from "../fixtures/mount"
import { Portal } from "./portal"

const Ctx = createContext("outside")
const Read = () => <span data-testid="ctx">{useContext(Ctx)}</span>

describe("Solid Portal", () => {
  it("renders a host in body after mount, with the logical parent's dir and lang", () => {
    let trigger!: HTMLButtonElement
    mount(() => (
      <div dir="rtl" lang="ar">
        <button type="button" ref={trigger}>
          Open
        </button>
        <Portal logicalParent={() => trigger} class="layer">
          <p>content</p>
        </Portal>
      </div>
    ))
    const hosts = document.body.querySelectorAll(":scope > [data-rind-portal]")
    expect(hosts).toHaveLength(1)
    const host = hosts[0] as HTMLElement
    expect(host.getAttribute("dir")).toBe("rtl")
    expect(host.getAttribute("lang")).toBe("ar")
    expect(host.classList.contains("layer")).toBe(true)
    // No wrapper of Solid's own: the host's child is the content.
    expect(host.innerHTML).toBe("<p>content</p>")
  })

  it("context crosses the portal; cleanup removes the host and keeps the target's children", () => {
    const target = document.body.appendChild(document.createElement("section"))
    target.append(document.createElement("i"))
    const [shown, setShown] = createSignal(true)
    mount(() => (
      <Ctx.Provider value="inside">
        {shown() ? (
          <Portal container={target}>
            <Read />
          </Portal>
        ) : null}
      </Ctx.Provider>
    ))
    expect(target.querySelector("[data-testid=ctx]")?.textContent).toBe("inside")
    setShown(false)
    expect(target.querySelector("[data-rind-portal]")).toBeNull()
    expect(target.querySelector("i")).not.toBeNull()
    target.remove()
  })

  it("follows a changing container", () => {
    const a = document.body.appendChild(document.createElement("div"))
    const b = document.body.appendChild(document.createElement("div"))
    const [container, setContainer] = createSignal<HTMLElement>(a)
    mount(() => (
      <Portal container={container()}>
        <p>moved</p>
      </Portal>
    ))
    expect(a.querySelector("[data-rind-portal] p")).not.toBeNull()
    setContainer(b)
    expect(a.querySelector("[data-rind-portal]")).toBeNull()
    expect(b.querySelector("[data-rind-portal] p")?.textContent).toBe("moved")
    a.remove()
    b.remove()
  })
})
