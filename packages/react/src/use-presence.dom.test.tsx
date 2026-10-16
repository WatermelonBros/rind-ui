import { act, render, waitFor } from "@testing-library/react"
import { useRef } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { type PresenceOptions, usePresence } from "./use-presence"

const jsdom = navigator.userAgent.includes("jsdom")

function Probe({ open, ...options }: { open: boolean } & PresenceOptions) {
  const ref = useRef<HTMLDivElement | null>(null)
  const { mounted } = usePresence(open, ref, options)
  return mounted ? <div ref={ref} id="p" data-state={open ? "open" : "closed"} /> : null
}
const node = () => document.getElementById("p")

// Drain animation frames inside act — no elapsed-time wait.
const settle = () =>
  act(async () => {
    for (let i = 0; i < 3; i++) await new Promise<void>((r) => requestAnimationFrame(() => r()))
  })

afterEach(() => {
  for (const s of document.head.querySelectorAll("style[data-test]")) s.remove()
})

describe("usePresence", () => {
  it("is mounted while open, also on the first render", () => {
    render(<Probe open />)
    expect(node()?.getAttribute("data-state")).toBe("open")
  })

  it.runIf(jsdom)("unmounts in the same task as the close when nothing animates", async () => {
    const { rerender } = render(<Probe open />)
    await act(async () => rerender(<Probe open={false} />))
    expect(node()).toBeNull()
  })

  it.runIf(!jsdom)("stays mounted while the exit animation runs, then unmounts", async () => {
    const style = document.createElement("style")
    style.dataset["test"] = ""
    style.textContent = `#p { opacity: 1; transition: opacity 150ms } #p[data-state=closed] { opacity: 0 }`
    document.head.append(style)
    const { rerender } = render(<Probe open />)
    // A transition needs a resolved before-change style.
    getComputedStyle(node() as Element).opacity
    await act(async () => rerender(<Probe open={false} />))
    expect(node()?.getAttribute("data-state")).toBe("closed")
    await waitFor(() => expect(node()).toBeNull(), { timeout: 2000 })
  })

  it.runIf(!jsdom)("reopening during the exit keeps the same DOM node", async () => {
    const style = document.createElement("style")
    style.dataset["test"] = ""
    style.textContent = `#p { opacity: 1; transition: opacity 400ms } #p[data-state=closed] { opacity: 0 }`
    document.head.append(style)
    const { rerender } = render(<Probe open />)
    const before = node()
    getComputedStyle(before as Element).opacity
    await act(async () => rerender(<Probe open={false} />))
    expect(node()).toBe(before)
    await act(async () => rerender(<Probe open />))
    expect(node()).toBe(before)
    // End the (reversed) transition ourselves instead of waiting out its duration.
    for (const a of before?.getAnimations() ?? []) a.finish()
    await settle()
    expect(node()).toBe(before)
    expect(node()?.getAttribute("data-state")).toBe("open")
  })

  it("keepMounted never unmounts", async () => {
    const { rerender } = render(<Probe open keepMounted />)
    await act(async () => rerender(<Probe open={false} keepMounted />))
    await settle()
    expect(node()?.getAttribute("data-state")).toBe("closed")
  })

  it("calls onExitComplete once per exit", async () => {
    const onExitComplete = vi.fn()
    const { rerender } = render(<Probe open onExitComplete={onExitComplete} />)
    await act(async () => rerender(<Probe open={false} onExitComplete={onExitComplete} />))
    await waitFor(() => expect(node()).toBeNull(), { timeout: 2000 })
    await settle()
    expect(onExitComplete).toHaveBeenCalledTimes(1)
  })
})
