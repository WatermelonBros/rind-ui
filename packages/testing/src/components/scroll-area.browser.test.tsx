// biome-ignore-all lint/a11y: fixtures deliberately build scrollable regions
// add-scroll-area 2.3, 4.2, 5.2, 6.2: Scroll Area in a real browser. Layout is real, so every
// wait is a condition with a deadline (vi.waitFor), never a delay.
import { Dialog, ScrollArea, type ScrollAreaRootProps } from "@rind-ui/react"
import { cleanup, render, screen } from "@testing-library/react"
import axe from "axe-core"
import type { CSSProperties, ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { userEvent } from "vitest/browser"
import { getScrollArea } from "../index"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const lines = (n: number, prefix = "Line") =>
  Array.from({ length: n }, (_, i) => `${prefix} ${i + 1}`).map((text) => (
    <p key={text} style={{ margin: 0, height: 20 }}>
      {text}
    </p>
  ))

const barY: CSSProperties = { width: 10, display: "flex", flexDirection: "column" }
const barX: CSSProperties = { height: 10, display: "flex" }
const thumb: CSSProperties = { background: "gray", flex: "none" }

/** A laid-out area (inline sizes: no theme needed). */
function Area({
  children = lines(50),
  viewport,
  width = 200,
  height = 200,
  both = false,
  label,
  ...props
}: ScrollAreaRootProps & {
  readonly viewport?: CSSProperties
  readonly width?: number
  readonly height?: number
  readonly both?: boolean
  readonly label?: string
  readonly children?: ReactNode
}) {
  return (
    <ScrollArea.Root {...props} style={{ width, height }}>
      <ScrollArea.Viewport
        data-testid="vp"
        {...(label ? { "aria-label": label } : {})}
        style={{ width: "100%", height: "100%", ...viewport }}
      >
        <ScrollArea.Content>{children}</ScrollArea.Content>
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar data-testid="bar-y" style={barY}>
        <ScrollArea.Thumb
          data-testid="thumb-y"
          style={{ ...thumb, width: "100%", height: "var(--rind-scroll-area-thumb-size)" }}
        />
      </ScrollArea.Scrollbar>
      {both && (
        <ScrollArea.Scrollbar orientation="horizontal" data-testid="bar-x" style={barX}>
          <ScrollArea.Thumb
            data-testid="thumb-x"
            style={{ ...thumb, height: "100%", width: "var(--rind-scroll-area-thumb-size)" }}
          />
        </ScrollArea.Scrollbar>
      )}
      {both && <ScrollArea.Corner data-testid="corner" />}
    </ScrollArea.Root>
  )
}

const el = (id: string) => screen.getByTestId(id)
const root = () => el("vp").closest('[data-part="root"]') as HTMLElement
const measured = () => vi.waitFor(() => expect(el("thumb-y").style.visibility).not.toBe("hidden"))
const translate = (t: HTMLElement) => {
  const m = /translate3d\(([-\d.]+)px, ([-\d.]+)px/.exec(t.style.transform)
  return { x: Number(m?.[1] ?? 0), y: Number(m?.[2] ?? 0) }
}

describe("measuring", () => {
  it("overflow attributes, thumb size, no native scrollbar painted", async () => {
    render(<Area />)
    await measured()
    const vp = el("vp")
    expect(root().hasAttribute("data-overflow-y")).toBe(true)
    expect(root().hasAttribute("data-overflow-x")).toBe(false)
    expect(root().hasAttribute("data-overflow-y-end")).toBe(true)
    expect(root().hasAttribute("data-overflow-y-start")).toBe(false)
    // 200 / 1000 of a 200 px track.
    expect(el("thumb-y").style.getPropertyValue("--rind-scroll-area-thumb-size")).toBe("40px")
    expect(vp.offsetWidth - vp.clientWidth).toBe(0)
    expect(vp.style.getPropertyValue("--rind-scroll-area-overflow-y-end")).toBe("800px")
  })

  it("the thumb follows a scroll", async () => {
    render(<Area />)
    await measured()
    el("vp").scrollTop = 400
    await vi.waitFor(() => expect(translate(el("thumb-y")).y).toBeCloseTo(80, 0))
  })

  it("overflow-x hidden: no horizontal overflow (unovue/reka-ui#2802)", async () => {
    render(
      <Area both viewport={{ overflowX: "hidden" }}>
        <div style={{ width: 600 }}>{lines(50)}</div>
      </Area>,
    )
    await measured()
    expect(root().hasAttribute("data-overflow-x")).toBe(false)
    expect(el("bar-x").getAttribute("data-state")).toBe("hidden")
  })

  it("content grows while scrolled to the end: the thumb shrinks and moves (unovue/reka-ui#2303)", async () => {
    const { rerender } = render(<Area>{lines(50)}</Area>)
    await measured()
    const vp = el("vp")
    vp.scrollTop = 800
    await vi.waitFor(() => expect(translate(el("thumb-y")).y).toBeCloseTo(160, 0))
    rerender(<Area>{lines(100)}</Area>)
    await vi.waitFor(() =>
      expect(el("thumb-y").style.getPropertyValue("--rind-scroll-area-thumb-size")).toBe("20px"),
    )
    await vi.waitFor(() => expect(translate(el("thumb-y")).y).toBeCloseTo(80, 0))
  })

  it("corner resets when one axis stops overflowing (radix-ui/primitives#2383)", async () => {
    const { rerender } = render(
      <Area both>
        <div style={{ width: 600 }}>{lines(50)}</div>
      </Area>,
    )
    await measured()
    await vi.waitFor(() =>
      expect(root().style.getPropertyValue("--rind-scroll-area-corner-width")).toBe("10px"),
    )
    rerender(
      <Area both>
        <div style={{ width: 100 }}>{lines(50)}</div>
      </Area>,
    )
    await vi.waitFor(() =>
      expect(root().style.getPropertyValue("--rind-scroll-area-corner-width")).toBe("0px"),
    )
    expect(root().style.getPropertyValue("--rind-scroll-area-corner-height")).toBe("0px")
  })

  it("RTL without a provider: the horizontal thumb starts at the right (mui/base-ui#5300)", async () => {
    render(
      <div dir="rtl">
        <Area both>
          <div style={{ width: 600 }}>{lines(5)}</div>
        </Area>
      </div>,
    )
    await measured()
    await vi.waitFor(() => expect(translate(el("thumb-x")).x).toBeGreaterThan(100))
    expect(root().hasAttribute("data-overflow-x-end")).toBe(true)
    expect(root().hasAttribute("data-overflow-x-start")).toBe(false)
    el("vp").scrollLeft = -400
    await vi.waitFor(() => expect(translate(el("thumb-x")).x).toBeLessThan(10))
  })

  it("column-reverse: the thumb starts at the bottom (radix-ui/primitives#1585)", async () => {
    render(<Area viewport={{ display: "flex", flexDirection: "column-reverse" }} />)
    await measured()
    await vi.waitFor(() => expect(translate(el("thumb-y")).y).toBeCloseTo(160, 0))
    el("vp").scrollTop = -800
    await vi.waitFor(() => expect(translate(el("thumb-y")).y).toBeCloseTo(0, 0))
  })
})

describe("tab stop and names", () => {
  it("text-only overflowing content: the Viewport is a tab stop, axe scrollable-region-focusable passes", async () => {
    render(<Area label="Notes" />)
    await vi.waitFor(() => expect(el("vp").getAttribute("tabindex")).toBe("0"))
    expect(el("vp").getAttribute("role")).toBe("region")
    const r = await axe.run(root(), { runOnly: ["scrollable-region-focusable"] })
    expect(r.violations).toEqual([])
  })

  it("content with buttons: no extra stop", async () => {
    render(
      <Area>
        {Array.from({ length: 30 }, (_, i) => `Item ${i}`).map((text) => (
          <button key={text} type="button" style={{ display: "block", height: 30 }}>
            {text}
          </button>
        ))}
      </Area>,
    )
    await measured()
    expect(el("vp").hasAttribute("tabindex")).toBe(false)
  })

  it("no overflow, no stop", async () => {
    render(<Area>{lines(2)}</Area>)
    await vi.waitFor(() => expect(el("vp").hasAttribute("data-tab-stop")).toBe(false))
    expect(el("vp").hasAttribute("tabindex")).toBe(false)
  })

  it("native keys scroll the focused Viewport; PageDown then End (the driver reads the edge)", async () => {
    render(<Area label="Release notes" />)
    await vi.waitFor(() => expect(el("vp").getAttribute("tabindex")).toBe("0"))
    const area = getScrollArea(screen, { name: "Release notes" }, { modality: "keyboard" })
    // Real keys (the DOM adapter's are synthetic, which never scroll natively; the
    // Playwright fixture runs the driver's keyboard `scroll` itself).
    await area.focusViewport()
    await userEvent.keyboard("{PageDown}")
    await vi.waitFor(() => expect(el("vp").scrollTop).toBeGreaterThan(100))
    await userEvent.keyboard("{End}")
    await vi.waitFor(async () => expect(await area.atEnd("y")).toBe(true))
  })

  it("an unnamed tab stop warns once in development", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    render(<Area />)
    await vi.waitFor(() => expect(warn).toHaveBeenCalledWith(expect.stringContaining("no name")))
  })
})

describe("pointer", () => {
  it("dragging the thumb past the end scrolls to the maximum; only that axis drags", async () => {
    render(
      <Area both>
        <div style={{ width: 600 }}>{lines(50)}</div>
      </Area>,
    )
    await measured()
    const area = getScrollArea(screen, { text: "Line 1" })
    await area.dragThumb("y", 1)
    await vi.waitFor(() => expect(el("vp").scrollTop).toBeGreaterThan(780))
    expect(el("thumb-x").hasAttribute("data-dragging")).toBe(false)
  })

  it("snap is off during a drag and restored after", async () => {
    render(<Area viewport={{ scrollSnapType: "y mandatory" }} />)
    await measured()
    const t = el("thumb-y")
    const box = t.getBoundingClientRect()
    const at = { clientX: box.x + 5, clientY: box.y + 5, pointerId: 7, bubbles: true }
    t.dispatchEvent(
      new PointerEvent("pointerdown", { ...at, pointerType: "mouse", button: 0, buttons: 1 }),
    )
    expect(el("vp").style.scrollSnapType).toBe("none")
    await vi.waitFor(() => expect(el("thumb-y").hasAttribute("data-dragging")).toBe(true))
    document.dispatchEvent(new PointerEvent("pointerup", { ...at, pointerType: "mouse" }))
    await vi.waitFor(() => expect(el("vp").style.scrollSnapType).toBe("y mandatory"))
    expect(el("thumb-y").hasAttribute("data-dragging")).toBe(false)
  })

  it("a track press below the thumb scrolls one page", async () => {
    render(<Area />)
    await measured()
    const area = getScrollArea(screen, { text: "Line 1" })
    await area.pressTrack("y", "forward")
    await vi.waitFor(() => expect(el("vp").scrollTop).toBe(200))
  })

  it("a touch on the track does nothing (the finger pans the page, mui/base-ui#2825)", async () => {
    render(<Area />)
    await measured()
    const b = el("bar-y").getBoundingClientRect()
    el("bar-y").dispatchEvent(
      new PointerEvent("pointerdown", {
        clientX: b.x + 5,
        clientY: b.bottom - 5,
        pointerType: "touch",
        bubbles: true,
      }),
    )
    expect(el("vp").scrollTop).toBe(0)
    expect(getComputedStyle(el("bar-y")).touchAction).toBe("auto")
    expect(getComputedStyle(el("thumb-y")).touchAction).toBe("none")
  })
})

describe("drag edge cases", () => {
  const down = (t: HTMLElement, id: number) => {
    const b = t.getBoundingClientRect()
    t.dispatchEvent(
      new PointerEvent("pointerdown", {
        clientX: b.x + 5,
        clientY: b.y + 5,
        pointerId: id,
        pointerType: "mouse",
        button: 0,
        buttons: 1,
        bubbles: true,
      }),
    )
    return b
  }

  it("release outside keeps the dragged position (mui/base-ui#4433)", async () => {
    render(<Area />)
    await measured()
    const b = down(el("thumb-y"), 3)
    const move = { pointerId: 3, pointerType: "mouse", clientX: b.x + 5, bubbles: true }
    document.dispatchEvent(
      new PointerEvent("pointermove", { ...move, clientY: b.y + 85, buttons: 1 }),
    )
    await vi.waitFor(() => expect(el("vp").scrollTop).toBeGreaterThan(300))
    const at = el("vp").scrollTop
    document.dispatchEvent(new PointerEvent("pointerup", { ...move, clientX: 2000, clientY: 2000 }))
    await vi.waitFor(() => expect(el("thumb-y").hasAttribute("data-dragging")).toBe(false))
    expect(el("vp").scrollTop).toBe(at)
  })

  it("a move without a pressed button ends the drag and moves nothing (mui/base-ui#5371)", async () => {
    render(<Area />)
    await measured()
    const b = down(el("thumb-y"), 4)
    const move = { pointerId: 4, pointerType: "mouse", clientX: b.x + 5, bubbles: true }
    document.dispatchEvent(
      new PointerEvent("pointermove", { ...move, clientY: b.y + 85, buttons: 0 }),
    )
    await vi.waitFor(() => expect(el("thumb-y").hasAttribute("data-dragging")).toBe(false))
    expect(el("vp").scrollTop).toBe(0)
    document.dispatchEvent(
      new PointerEvent("pointermove", { ...move, clientY: b.y + 120, buttons: 0 }),
    )
    expect(el("vp").scrollTop).toBe(0)
  })

  it("nested areas: dragging the inner thumb leaves the outer one alone", async () => {
    render(
      <Area height={300}>
        {lines(5, "Outer")}
        <ScrollArea.Root style={{ width: 150, height: 100 }}>
          <ScrollArea.Viewport style={{ width: "100%", height: "100%" }}>
            <ScrollArea.Content>{lines(30, "Inner")}</ScrollArea.Content>
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar data-testid="inner-bar" style={barY}>
            <ScrollArea.Thumb
              data-testid="inner-thumb"
              style={{ ...thumb, width: "100%", height: "var(--rind-scroll-area-thumb-size)" }}
            />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>
        {lines(30, "Outer more")}
      </Area>,
    )
    await measured()
    await vi.waitFor(() => expect(el("inner-thumb").style.visibility).not.toBe("hidden"))
    down(el("inner-thumb"), 5)
    await vi.waitFor(() => expect(el("inner-thumb").hasAttribute("data-dragging")).toBe(true))
    expect(el("thumb-y").hasAttribute("data-dragging")).toBe(false)
    document.dispatchEvent(new PointerEvent("pointerup", { pointerId: 5, bubbles: true }))
    await vi.waitFor(() => expect(el("inner-thumb").hasAttribute("data-dragging")).toBe(false))
  })
})

describe("in a modal dialog (adobe/react-spectrum#10395)", () => {
  it("Tab reaches the text-only Viewport before the Close button; a key scrolls it", async () => {
    render(
      <Dialog.Root defaultOpen>
        <Dialog.Portal>
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Title>Terms</Dialog.Title>
              <button type="button">First</button>
              <Area label="Terms text" />
              <Dialog.CloseTrigger>Close</Dialog.CloseTrigger>
            </Dialog.Content>
          </Dialog.Positioner>
        </Dialog.Portal>
      </Dialog.Root>,
    )
    await vi.waitFor(() => expect(el("vp").getAttribute("tabindex")).toBe("0"))
    screen.getByRole("button", { name: "First" }).focus()
    await userEvent.tab()
    expect(document.activeElement).toBe(el("vp"))
    // PageDown: headless WebKit under Playwright does not scroll a focused element on arrows.
    await userEvent.keyboard("{PageDown}")
    await vi.waitFor(() => expect(el("vp").scrollTop).toBeGreaterThan(0))
  })
})

describe("wheel over a scrollbar", () => {
  const wheel = (deltaY: number, init: WheelEventInit = {}) => {
    const e = new WheelEvent("wheel", { deltaY, bubbles: true, cancelable: true, ...init })
    el("bar-y").dispatchEvent(e)
    return e
  }

  it("scrolls the Viewport and is prevented", async () => {
    render(<Area />)
    await measured()
    expect(wheel(100).defaultPrevented).toBe(true)
    expect(el("vp").scrollTop).toBe(100)
  })

  it("at the edge it chains (not prevented); with overscroll contain it is (radix-ui/primitives#1667)", async () => {
    const { unmount } = render(<Area />)
    await measured()
    el("vp").scrollTop = 800
    expect(wheel(100).defaultPrevented).toBe(false)
    unmount()
    render(<Area viewport={{ overscrollBehavior: "contain" }} />)
    await measured()
    el("vp").scrollTop = 800
    expect(wheel(100).defaultPrevented).toBe(true)
  })

  it("Ctrl+wheel is left to zoom", async () => {
    render(<Area />)
    await measured()
    expect(wheel(100, { ctrlKey: true }).defaultPrevented).toBe(false)
    expect(el("vp").scrollTop).toBe(0)
  })

  it("100 mounts leave no wheel listener behind (huntabyte/bits-ui#2116)", async () => {
    const added = vi.spyOn(EventTarget.prototype, "addEventListener")
    const removed = vi.spyOn(EventTarget.prototype, "removeEventListener")
    for (let i = 0; i < 100; i++) {
      const { unmount } = render(<Area />)
      await measured()
      unmount()
    }
    // Ours only: React's root containers add their own (passive) wheel listeners per render.
    const wheels = (spy: typeof added) =>
      spy.mock.calls.filter(
        ([type], i) =>
          type === "wheel" &&
          (spy.mock.contexts[i] as Element | undefined)?.closest?.('[data-scope="scroll-area"]'),
      ).length
    expect(wheels(added)).toBeGreaterThan(0)
    expect(wheels(removed)).toBe(wheels(added))
  })
})

describe("server rendering", () => {
  it("no tabindex, no overflow attributes, no thumb before measuring (mui/base-ui#4103)", async () => {
    const { renderToString } = await import("react-dom/server")
    const html = renderToString(<Area label="Notes" />)
    expect(html).not.toContain("tabindex")
    expect(html).not.toContain("data-overflow")
    expect(html).toContain('data-state="hidden"')
    expect(html).toContain("visibility:hidden")
    expect(html).not.toContain("--rind-scroll-area-thumb-size:")
  })
})
