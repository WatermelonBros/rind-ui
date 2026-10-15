import { act, render } from "@testing-library/react"
import { StrictMode } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { Portal } from "./portal"

afterEach(() => {
  vi.restoreAllMocks()
})

const settle = () => act(() => new Promise<void>((r) => setTimeout(r, 0)))
const parentOf = () => document.getElementById("t")
const hosts = () => document.querySelectorAll("[data-rind-portal]")

describe("Portal", () => {
  it("renders nothing on the server", () => {
    const html = renderToString(
      <Portal>
        <p>content</p>
      </Portal>,
    )
    expect(html).toBe("")
  })

  it("mounts one host after the first render, also in Strict Mode, and removes it on unmount", () => {
    const { unmount } = render(
      <StrictMode>
        <Portal>
          <p>content</p>
        </Portal>
      </StrictMode>,
    )
    expect(hosts()).toHaveLength(1)
    expect(hosts()[0]?.parentElement).toBe(document.body)
    unmount()
    expect(hosts()).toHaveLength(0)
  })

  it("hydrates without a mismatch and mounts the content after", async () => {
    const tree = (
      <div id="root">
        <Portal>
          <p>content</p>
        </Portal>
      </div>
    )
    const container = document.createElement("div")
    container.innerHTML = renderToString(tree)
    document.body.append(container)
    expect(container.querySelector("[data-rind-portal]")).toBeNull()
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    let root: ReturnType<typeof hydrateRoot> | undefined
    await act(async () => {
      root = hydrateRoot(container, tree)
    })
    expect(error).not.toHaveBeenCalled()
    expect(hosts()).toHaveLength(1)
    expect(hosts()[0]?.textContent).toBe("content")
    act(() => root?.unmount())
  })

  it("copies dir, lang and theme from the logical parent's ancestors and follows a change", async () => {
    render(
      <div id="scope" dir="rtl" lang="ar" data-theme="dark" data-rind-theme="acme">
        <button id="t" type="button" />
        <Portal logicalParent={parentOf}>
          <p>content</p>
        </Portal>
      </div>,
    )
    const host = hosts()[0] as HTMLElement
    expect(host.getAttribute("dir")).toBe("rtl")
    expect(host.getAttribute("lang")).toBe("ar")
    expect(host.getAttribute("data-theme")).toBe("dark")
    expect(host.getAttribute("data-rind-theme")).toBe("acme")
    document.getElementById("scope")?.setAttribute("data-theme", "light")
    await settle()
    expect(host.getAttribute("data-theme")).toBe("light")
  })

  it("follows a container that changes from null to an element (radix#3599)", () => {
    const target = document.createElement("div")
    document.body.append(target)
    const ui = (container: Element | null) => (
      <Portal container={container}>
        <p>content</p>
      </Portal>
    )
    const { rerender } = render(ui(null))
    expect(hosts()[0]?.parentElement).toBe(document.body)
    rerender(ui(target))
    expect(hosts()).toHaveLength(1)
    expect(hosts()[0]?.parentElement).toBe(target)
    expect(target.textContent).toBe("content")
  })

  it("keeps syncing the host after the container changes", async () => {
    const target = document.createElement("div")
    document.body.append(target)
    const ui = (container: Element | null) => (
      <div id="scope" data-theme="dark">
        <button id="t" type="button" />
        <Portal container={container} logicalParent={parentOf}>
          <p>content</p>
        </Portal>
      </div>
    )
    const { rerender } = render(ui(null))
    rerender(ui(target))
    const host = hosts()[0] as HTMLElement
    expect(host.parentElement).toBe(target)
    document.getElementById("scope")?.setAttribute("data-theme", "light")
    await settle()
    expect(host.getAttribute("data-theme")).toBe("light")
  })
})
