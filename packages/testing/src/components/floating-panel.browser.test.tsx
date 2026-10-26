// Floating Panel (React) in a real browser: a pointer drag on the DragTrigger moves the panel
// (previewed on the CSS variables, committed once on release); it stays inside its boundary;
// a resize handle resizes; Escape mid-drag puts it back and keeps the panel open.
import { FloatingPanel, RindProvider } from "@rind-ui/react"
import { render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { getFloatingPanel } from "../index"

function setup() {
  const onPositionChange = vi.fn()
  render(
    <RindProvider>
      <div style={{ position: "relative", width: 600, height: 400 }}>
        <FloatingPanel.Root
          defaultOpen
          defaultPosition={{ x: 50, y: 50 }}
          defaultSize={{ width: 200, height: 150 }}
          onPositionChange={onPositionChange}
        >
          <FloatingPanel.Positioner>
            <FloatingPanel.Content style={{ pointerEvents: "auto" }}>
              <FloatingPanel.Header>
                <FloatingPanel.DragTrigger>Drag</FloatingPanel.DragTrigger>
                <FloatingPanel.Title>Panel</FloatingPanel.Title>
              </FloatingPanel.Header>
              <FloatingPanel.Body>Body</FloatingPanel.Body>
              <FloatingPanel.ResizeTrigger
                axis="se"
                style={{ position: "absolute", right: 0, bottom: 0, width: 16, height: 16 }}
              />
            </FloatingPanel.Content>
          </FloatingPanel.Positioner>
        </FloatingPanel.Root>
      </div>
    </RindProvider>,
  )
  return { onPositionChange, d: () => getFloatingPanel(document.body) }
}

const fire = (el: Element | Document, type: string, x: number, y: number) =>
  el.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      clientX: x,
      clientY: y,
      pointerId: 1,
      isPrimary: true,
      button: 0,
      buttons: type === "pointerup" ? 0 : 1,
      pointerType: "mouse",
    }),
  )

describe("React FloatingPanel drag", () => {
  it("a drag moves the panel once, on release, clamped to the boundary", async () => {
    const t = setup()
    const handle = document.querySelector('[data-part="drag-trigger"]') as HTMLElement
    fire(handle, "pointerdown", 100, 100)
    fire(document, "pointermove", 130, 120)
    await vi.waitFor(async () => expect(await t.d().position()).toEqual({ x: 80, y: 70 }))
    expect(t.onPositionChange).not.toHaveBeenCalled()
    fire(document, "pointerup", 130, 120)
    await vi.waitFor(() => expect(t.onPositionChange).toHaveBeenCalledTimes(1))
    expect(t.onPositionChange.mock.lastCall?.[0]).toEqual({ x: 80, y: 70 })
    // Far up and left: the top edge stays at 0, 48 px stay visible on the left.
    fire(handle, "pointerdown", 100, 100)
    fire(document, "pointermove", -900, -900)
    fire(document, "pointerup", -900, -900)
    await vi.waitFor(async () => expect(await t.d().position()).toEqual({ x: -152, y: 0 }))
  })

  it("Escape mid-drag puts the panel back and keeps it open", async () => {
    const t = setup()
    const handle = document.querySelector('[data-part="drag-trigger"]') as HTMLElement
    handle.focus()
    fire(handle, "pointerdown", 100, 100)
    fire(document, "pointermove", 160, 160)
    await vi.waitFor(async () => expect(await t.d().isDragging()).toBe(true))
    handle.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
    await vi.waitFor(async () => expect(await t.d().isDragging()).toBe(false))
    expect(await t.d().position()).toEqual({ x: 50, y: 50 })
    expect(await t.d().isOpen()).toBe(true)
  })

  it("the south-east handle resizes", async () => {
    const t = setup()
    const grip = document.querySelector('[data-part="resize-trigger"]') as HTMLElement
    fire(grip, "pointerdown", 300, 300)
    fire(document, "pointermove", 340, 330)
    fire(document, "pointerup", 340, 330)
    await vi.waitFor(async () => expect(await t.d().size()).toEqual({ width: 240, height: 180 }))
  })
})
