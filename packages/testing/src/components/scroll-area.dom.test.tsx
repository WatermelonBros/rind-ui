// biome-ignore-all lint/a11y: fixtures deliberately build scrollable regions
// add-scroll-area 3.2, 4.2: parts and attributes, server render + hydration in Strict Mode,
// scrollbars hidden from assistive technology and never taking focus. Runs in jsdom (nothing
// is measured there) and in real browsers.
import { RindProvider, ScrollArea } from "@rind-ui/react"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { StrictMode } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function Area({ label = "Notes" }: { readonly label?: string }) {
  return (
    <ScrollArea.Root style={{ width: 200, height: 120 }} data-tone="danger">
      <ScrollArea.Viewport aria-label={label} style={{ width: "100%", height: "100%" }}>
        <ScrollArea.Content>
          <input aria-label="Search" />
          {Array.from({ length: 20 }, (_, i) => `Note ${i + 1}`).map((text) => (
            <p key={text}>{text}</p>
          ))}
        </ScrollArea.Content>
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar>
        <ScrollArea.Thumb />
      </ScrollArea.Scrollbar>
      <ScrollArea.Scrollbar orientation="horizontal">
        <ScrollArea.Thumb />
      </ScrollArea.Scrollbar>
      <ScrollArea.Corner />
    </ScrollArea.Root>
  )
}

const parts = (part: string) =>
  Array.from(document.querySelectorAll(`[data-scope="scroll-area"][data-part="${part}"]`))

describe("parts", () => {
  it("anatomy, the named region, consumer attributes passed through", () => {
    render(<Area />)
    const region = screen.getByRole("region", { name: "Notes" })
    expect(region.getAttribute("data-part")).toBe("viewport")
    expect(parts("root")[0]?.getAttribute("data-tone")).toBe("danger")
    expect(parts("root")[0]?.getAttribute("role")).toBeNull()
    expect(parts("content")[0]?.getAttribute("role")).toBeNull()
    // Content is the only element between the Viewport and the children.
    expect(region.children).toHaveLength(1)
    expect(parts("corner")).toHaveLength(1)
  })

  it("scrollbars, thumbs and the corner are aria-hidden and never take focus", () => {
    render(<Area />)
    for (const el of [...parts("scrollbar"), ...parts("thumb"), ...parts("corner")]) {
      expect(el.getAttribute("aria-hidden")).toBe("true")
      expect(el.getAttribute("tabindex")).toBeNull()
    }
    for (const el of [...parts("scrollbar"), ...parts("thumb")]) {
      const down = new MouseEvent("mousedown", { bubbles: true, cancelable: true })
      el.dispatchEvent(down)
      expect(down.defaultPrevented).toBe(true)
    }
  })

  it("pressing the thumb keeps focus in a field inside the Content", () => {
    render(<Area />)
    const field = screen.getByRole("textbox", { name: "Search" })
    field.focus()
    const thumb = parts("thumb")[0] as HTMLElement
    fireEvent.mouseDown(thumb)
    expect(document.activeElement).toBe(field)
  })

  it("no tab stop, no overflow attributes, hidden scrollbars before measuring", () => {
    render(<Area />)
    const vp = screen.getByRole("region")
    expect(vp.hasAttribute("tabindex")).toBe(false)
    expect(vp.hasAttribute("data-overflow-y")).toBe(false)
    for (const bar of parts("scrollbar")) expect(bar.getAttribute("data-state")).toBe("hidden")
  })

  it("only the Thumb has touch-action none (the track pans the page)", () => {
    render(<Area />)
    for (const t of parts("thumb")) expect((t as HTMLElement).style.touchAction).toBe("none")
    for (const b of parts("scrollbar")) expect((b as HTMLElement).style.touchAction).toBe("")
  })
})

describe("server rendering", () => {
  it("hydrates in Strict Mode with no mismatch", async () => {
    const tree = (
      <StrictMode>
        <Area />
      </StrictMode>
    )
    const container = document.createElement("div")
    container.innerHTML = renderToString(tree)
    document.body.append(container)
    expect(container.innerHTML).not.toContain("tabindex")
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    let root: ReturnType<typeof hydrateRoot> | undefined
    await act(async () => {
      root = hydrateRoot(container, tree, { onRecoverableError: (e) => error(String(e)) })
    })
    expect(error).not.toHaveBeenCalled()
    await act(async () => root?.unmount())
    container.remove()
  })

  it("the injected rule carries the provider's nonce, as text in an anonymous layer", async () => {
    render(
      <RindProvider environment={{ nonce: "abc" }}>
        <Area />
      </RindProvider>,
    )
    const style = await vi.waitFor(() => {
      const s = document.head.querySelector('style[data-rind-style="scroll-area"]')
      expect(s).not.toBeNull()
      return s as HTMLStyleElement
    })
    expect(style.getAttribute("nonce") ?? style.nonce).toBe("abc")
    expect(style.textContent).toContain("scrollbar-width: none")
    expect(style.textContent?.startsWith("@layer {")).toBe(true)
  })
})
