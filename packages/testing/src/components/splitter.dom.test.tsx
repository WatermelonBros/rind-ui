// Spec scenarios (add-splitter tasks 3.2, 4.2, 5.2), through the driver where it can.
// Pointer scenarios need layout: they run in browser mode and are skipped in jsdom.
import { domEnvironment } from "@rind-ui/core"
import { RindProvider, Splitter, type SplitterRootProps } from "@rind-ui/react"
import { act, fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { expectRindWarning, getSplitter } from "../index"

const platform = domEnvironment().platform
const inJsdom = navigator.userAgent.includes("jsdom")
const browserIt = it.skipIf(inJsdom)

afterEach(() => vi.restoreAllMocks())

const NAMES = ["Sidebar", "Editor", "Preview"]

type Props = Partial<SplitterRootProps> & {
  readonly count?: number
  readonly width?: number
  readonly disabledHandle?: number
  readonly inner?: ReactNode
}

/** A laid-out Splitter (inline sizes, so browser runs measure without a theme). */
function S({ count = 2, width = 410, disabledHandle, inner, panels, ...props }: Props) {
  const vertical = props.orientation === "vertical"
  const list = panels ?? Array.from({ length: count }, () => ({}))
  return (
    <Splitter.Root
      panels={list}
      {...props}
      style={vertical ? { width: 200, height: width } : { width, height: 100 }}
    >
      {list.flatMap((_, i) => [
        // biome-ignore lint/suspicious/noArrayIndexKey: panels are identified by index
        <Splitter.Panel key={`p${i}`} index={i}>
          {i === 0 ? inner : null}
          {NAMES[i]}
        </Splitter.Panel>,
        i < list.length - 1 ? (
          <Splitter.Handle
            // biome-ignore lint/suspicious/noArrayIndexKey: handles are identified by index
            key={`h${i}`}
            index={i}
            aria-label={NAMES[i]}
            disabled={i === disabledHandle}
            style={vertical ? { height: 10 } : { width: 10 }}
          />
        ) : null,
      ])}
    </Splitter.Root>
  )
}

const drv = (name = "Sidebar") => getSplitter(screen, { name }, { platform })
const handles = () =>
  Array.from(document.querySelectorAll<HTMLElement>('[data-scope="splitter"][data-part="handle"]'))
const panelEls = () =>
  Array.from(document.querySelectorAll<HTMLElement>('[data-scope="splitter"][data-part="panel"]'))
const root = () =>
  document.querySelector<HTMLElement>('[data-scope="splitter"][data-part="root"]') as HTMLElement
const key = (el: Element, k: string, init: KeyboardEventInit = {}) =>
  act(() => {
    fireEvent.keyDown(el, { key: k, ...init })
  })
const aria = (el: Element | undefined) =>
  ["aria-valuenow", "aria-valuemin", "aria-valuemax"].map((a) => el?.getAttribute(a))

describe("Anatomy", () => {
  it("Two panels and a handle", () => {
    render(<S />)
    const sep = screen.getByRole("separator", { name: "Sidebar" })
    expect(sep.previousElementSibling).toBe(panelEls()[0])
    expect(sep.nextElementSibling).toBe(panelEls()[1])
    for (const el of [root(), sep, ...panelEls()]) {
      expect(el.getAttribute("data-scope")).toBe("splitter")
      expect(el.getAttribute("data-instance")).toBe(root().getAttribute("data-instance"))
    }
    expect(panelEls().map((p) => p.getAttribute("data-size"))).toEqual(["50", "50"])
  })

  it("render replaces the element without changing behaviour", async () => {
    render(
      <Splitter.Root panels={[{}, {}]} render={<section />}>
        <Splitter.Panel index={0} render={<aside />} />
        <Splitter.Handle index={0} aria-label="Sidebar" render={<span />} />
        <Splitter.Panel index={1} />
      </Splitter.Root>,
    )
    expect(root().tagName).toBe("SECTION")
    expect(panelEls()[0]?.tagName).toBe("ASIDE")
    await drv().step(0, "increase")
    expect(await drv().sizes()).toEqual([55, 45])
  })

  it("an unnamed handle warns in development", () => {
    expectRindWarning(/splitter: Handle 0 has no name/)
    render(
      <Splitter.Root panels={[{}, {}]}>
        <Splitter.Panel index={0} />
        <Splitter.Handle index={0} />
        <Splitter.Panel index={1} />
      </Splitter.Root>,
    )
  })
})

describe("Sizes and constraints", () => {
  it("Equal split", () => {
    render(<S count={3} />)
    for (const p of panelEls()) expect(Number(p.getAttribute("data-size"))).toBeCloseTo(33.333, 3)
  })

  it("Invalid controlled sizes (Ark#2967): clamped, nothing throws", () => {
    render(<S sizes={[100, 0]} panels={[{}, { min: 20 }]} />)
    expect(panelEls().map((p) => p.getAttribute("data-size"))).toEqual(["80", "20"])
  })

  it("a wrong-length array falls back to defaultSizes, then scales to 100", () => {
    render(<S sizes={[10]} defaultSizes={[1, 3]} />)
    expect(panelEls().map((p) => p.getAttribute("data-size"))).toEqual(["25", "75"])
  })

  browserIt("Pixel minimum after a window resize (RRP#720)", async () => {
    const { rerender } = render(<S width={410} panels={[{ min: "200px" }, {}]} />)
    const p0 = () => panelEls()[0]?.getBoundingClientRect().width ?? 0
    await expect.poll(() => p0()).toBeGreaterThanOrEqual(199.5)
    rerender(<S width={1010} panels={[{ min: "200px" }, {}]} />)
    await expect.poll(() => handles()[0]?.getAttribute("aria-valuemin")).toBe("20")
    expect(p0()).toBeGreaterThanOrEqual(199.5)
    rerender(<S width={410} panels={[{ min: "200px" }, {}]} />)
    await expect.poll(() => handles()[0]?.getAttribute("aria-valuemin")).toBe("50")
    expect(p0()).toBeGreaterThanOrEqual(199.5)
  })
})

describe("Handle semantics", () => {
  it("Bounds of the second handle (RRP#740)", () => {
    render(
      <S count={3} defaultSizes={[20, 30, 50]} panels={[{ min: 10 }, { min: 10 }, { min: 10 }]} />,
    )
    expect(aria(handles()[1])).toEqual(["30", "10", "70"])
    expect(aria(handles()[0])).toEqual(["20", "10", "80"])
  })

  it("Orientation is the perpendicular of the panel axis", () => {
    const { unmount } = render(<S />)
    expect(handles()[0]?.getAttribute("aria-orientation")).toBe("vertical")
    unmount()
    render(<S orientation="vertical" />)
    expect(handles()[0]?.getAttribute("aria-orientation")).toBe("horizontal")
  })

  it("aria-controls names the primary panel; one tab stop per handle", () => {
    render(<S count={3} />)
    expect(handles().map((h) => h.getAttribute("aria-controls"))).toEqual(
      panelEls()
        .slice(0, 2)
        .map((p) => p.id),
    )
    expect(handles().map((h) => h.tabIndex)).toEqual([0, 0])
  })
})

describe("Keyboard", () => {
  it("Driver: step grows the first panel by one step", async () => {
    render(<S />)
    await drv().step(0, "increase")
    expect(await drv().sizes()).toEqual([55, 45])
  })

  it("Vertical arrows (zag#2417)", async () => {
    render(<S orientation="vertical" />)
    const h = handles()[0] as HTMLElement
    key(h, "ArrowUp")
    expect(await drv().sizes()).toEqual([45, 55])
    key(h, "ArrowDown")
    key(h, "ArrowDown")
    expect(await drv().sizes()).toEqual([55, 45])
    // The other axis is the page's.
    key(h, "ArrowRight")
    expect(await drv().sizes()).toEqual([55, 45])
  })

  it("RTL: ArrowLeft grows the primary panel (it is on the right)", async () => {
    render(
      <RindProvider dir="rtl">
        <S />
      </RindProvider>,
    )
    key(handles()[0] as HTMLElement, "ArrowLeft")
    expect(await drv().sizes()).toEqual([55, 45])
  })

  it("modifiers are left to the page", async () => {
    render(<S />)
    const h = handles()[0] as HTMLElement
    for (const mod of [{ altKey: true }, { ctrlKey: true }, { metaKey: true }])
      key(h, "ArrowRight", mod)
    expect(await drv().sizes()).toEqual([50, 50])
  })

  it("Home and End reach the bounds", async () => {
    render(<S panels={[{ min: 20, max: 70 }, {}]} />)
    await drv().toEdge(0, "min")
    expect(await drv().sizes()).toEqual([20, 80])
    await drv().toEdge(0, "max")
    expect(await drv().sizes()).toEqual([70, 30])
  })

  it("Keys after hover (zag#3223)", async () => {
    render(<S />)
    const h = handles()[0] as HTMLElement
    fireEvent.pointerEnter(h, { pointerType: "mouse" })
    fireEvent.pointerMove(h, { pointerType: "mouse" })
    await drv().focusHandle(0)
    key(h, "ArrowRight")
    expect(await drv().sizes()).toEqual([55, 45])
  })

  it("Enter restores", async () => {
    const onSizesCommit = vi.fn()
    render(
      <S
        defaultSizes={[30, 70]}
        panels={[{ collapsible: true, min: 10 }, {}]}
        onSizesCommit={onSizesCommit}
      />,
    )
    await drv().toggleCollapse(0)
    expect(await drv().sizes()).toEqual([0, 100])
    expect(await drv().isCollapsed(0)).toBe(true)
    expect(panelEls()[0]?.getAttribute("data-state")).toBe("collapsed")
    await drv().toggleCollapse(0)
    expect(await drv().sizes()).toEqual([30, 70])
    expect(panelEls()[0]?.getAttribute("data-state")).toBe("expanded")
    expect(onSizesCommit).toHaveBeenCalledTimes(2)
    expect(onSizesCommit).toHaveBeenLastCalledWith([30, 70], { reason: "TOGGLE" })
  })

  it("a step at min collapses, a step from collapsed expands to min", async () => {
    render(<S defaultSizes={[20, 80]} panels={[{ collapsible: true, min: 20 }, {}]} />)
    await drv().step(0, "decrease")
    expect(await drv().sizes()).toEqual([0, 100])
    await drv().step(0, "increase")
    expect(await drv().sizes()).toEqual([20, 80])
  })

  it("Enter on a panel that is not collapsible does nothing", async () => {
    const onSizesCommit = vi.fn()
    render(<S onSizesCommit={onSizesCommit} />)
    await drv().toggleCollapse(0)
    expect(await drv().sizes()).toEqual([50, 50])
    expect(onSizesCommit).not.toHaveBeenCalled()
  })
})

describe("Disabled", () => {
  it("Disabled handle: no tab stop, keys ignored", async () => {
    render(<S count={3} disabledHandle={0} />)
    const h = handles()[0] as HTMLElement
    expect(h.hasAttribute("tabindex")).toBe(false)
    expect(h.getAttribute("aria-disabled")).toBe("true")
    expect(h.hasAttribute("data-disabled")).toBe(true)
    key(h, "ArrowRight")
    expect(panelEls()[0]?.getAttribute("data-size")).toBe("33.3333")
    expect(handles()[1]?.tabIndex).toBe(0)
  })

  it("a disabled Root: no handle is focusable", () => {
    render(<S count={3} disabled />)
    for (const h of handles()) expect(h.hasAttribute("tabindex")).toBe(false)
    expect(root().hasAttribute("data-disabled")).toBe(true)
  })

  browserIt("Disabled handle: a press starts no drag", async () => {
    render(<S disabledHandle={0} />)
    await drv().pointerDown(0)
    expect(await drv().isDragging()).toBe(false)
    await drv().pointerUp()
  })
})

describe("Pointer drag (browser)", () => {
  browserIt("One commit per drag", async () => {
    const onSizesChange = vi.fn()
    const onSizesCommit = vi.fn()
    render(<S onSizesChange={onSizesChange} onSizesCommit={onSizesCommit} />)
    const s = drv()
    await s.pointerDown(0)
    expect(document.activeElement).toBe(handles()[0])
    expect(handles()[0]?.hasAttribute("data-focus-visible")).toBe(false)
    expect(root().hasAttribute("data-dragging")).toBe(true)
    expect(handles()[0]?.hasAttribute("data-dragging")).toBe(true)
    for (let d = 1; d <= 10; d++) await s.pointerMove(d)
    await s.pointerUp()
    expect(await s.isDragging()).toBe(false)
    const [first] = await s.sizes()
    expect(first).toBeCloseTo(60, 0)
    expect(onSizesChange.mock.calls.length).toBeGreaterThanOrEqual(5)
    expect(onSizesCommit).toHaveBeenCalledTimes(1)
    expect(onSizesCommit.mock.calls[0]?.[1]).toEqual({ reason: "POINTER.UP" })
  })

  browserIt("Drag in RTL follows the pointer (RRP#446)", async () => {
    render(
      <RindProvider dir="rtl">
        <S />
      </RindProvider>,
    )
    await drv().setSize(0, 70)
    expect((await drv().sizes())[0]).toBeCloseTo(70, 0)
  })

  browserIt("touch drag", async () => {
    render(<S orientation="vertical" />)
    await drv().via("touch").setSize(0, 30)
    expect((await drv().sizes())[0]).toBeCloseTo(30, 0)
  })

  browserIt("Escape restores the press sizes and commits nothing", async () => {
    const onSizesCommit = vi.fn()
    render(<S onSizesCommit={onSizesCommit} />)
    const s = drv()
    await s.pointerDown(0)
    await s.pointerMove(20)
    expect((await s.sizes())[0]).toBeCloseTo(70, 0)
    await s.via("keyboard").cancelDrag()
    expect(await s.sizes()).toEqual([50, 50])
    expect(await s.isDragging()).toBe(false)
    expect(onSizesCommit).not.toHaveBeenCalled()
    await s.part("root").pointer("up", { at: { x: 0.5, y: 0.5 } })
  })

  browserIt("pointercancel restores the press sizes", async () => {
    render(<S />)
    const s = drv()
    await s.pointerDown(0)
    await s.pointerMove(-20)
    await s.cancelDrag()
    expect(await s.sizes()).toEqual([50, 50])
  })

  browserIt("Release over an iframe (RRP#688): a move without buttons ends the drag", async () => {
    render(<S inner={<iframe title="Doc" style={{ width: 50, height: 50 }} />} />)
    const s = drv()
    await s.pointerDown(0)
    await s.pointerMove(10)
    act(() => {
      document.dispatchEvent(
        new PointerEvent("pointermove", { bubbles: true, pointerId: 1, buttons: 0 }),
      )
    })
    await expect.poll(() => root().hasAttribute("data-dragging")).toBe(false)
    expect(handles()[0]?.hasAttribute("data-dragging")).toBe(false)
  })

  browserIt("Snap: a collapsible panel dragged below half its min collapses", async () => {
    render(<S panels={[{ collapsible: true, min: 20 }, {}]} />)
    await drv().setSize(0, 8)
    expect(await drv().sizes()).toEqual([0, 100])
    expect(panelEls()[0]?.getAttribute("data-state")).toBe("collapsed")
    await drv().setSize(0, 15)
    expect(await drv().sizes()).toEqual([20, 80])
  })

  browserIt("Disabled mid-drag cancels and restores", async () => {
    const { rerender } = render(<S />)
    const s = drv()
    await s.pointerDown(0)
    await s.pointerMove(20)
    rerender(<S disabled />)
    await expect.poll(() => root().hasAttribute("data-dragging")).toBe(false)
    expect(await s.sizes()).toEqual([50, 50])
  })

  browserIt("Nested splitters are independent", async () => {
    render(
      <S
        inner={
          <Splitter.Root
            panels={[{}, {}]}
            orientation="vertical"
            style={{ width: 100, height: 90 }}
          >
            <Splitter.Panel index={0} />
            <Splitter.Handle index={0} aria-label="Terminal" style={{ height: 10 }} />
            <Splitter.Panel index={1} />
          </Splitter.Root>
        }
      />,
    )
    const inner = drv("Terminal")
    await inner.setSize(0, 30)
    expect((await inner.sizes())[0]).toBeCloseTo(30, 0)
    expect(screen.getByRole("separator", { name: "Sidebar" }).getAttribute("aria-valuenow")).toBe(
      "50",
    )
  })
})

describe("Server render", () => {
  const tree = (props: Partial<SplitterRootProps> = {}) => (
    <Splitter.Root panels={[{}, { collapsible: true }]} {...props}>
      <Splitter.Panel index={0} />
      <Splitter.Handle index={0} aria-label="Sidebar" />
      <Splitter.Panel index={1} />
    </Splitter.Root>
  )

  it("Server render (RRP#692): flex-grow from the sizes, clean hydration", async () => {
    const node = tree({ defaultSizes: [30, 70] })
    const container = document.createElement("div")
    container.innerHTML = renderToString(node)
    const html = container.innerHTML
    const styles = () =>
      Array.from(container.querySelectorAll<HTMLElement>('[data-part="panel"]')).map(
        (p) => p.style.flex,
      )
    expect(styles()).toEqual(["30 1 0px", "70 1 0px"])
    expect(container.querySelector('[role="separator"]')?.getAttribute("aria-valuenow")).toBe("30")
    document.body.append(container)
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    let r: ReturnType<typeof hydrateRoot> | undefined
    await act(async () => {
      r = hydrateRoot(container, node, { onRecoverableError: (e) => error(String(e)) })
    })
    expect(error.mock.calls).toEqual([])
    expect(styles()).toEqual(["30 1 0px", "70 1 0px"])
    expect(html).toContain("data-state")
    await act(async () => r?.unmount())
    container.remove()
  })
})
