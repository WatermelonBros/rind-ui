/** @jsxImportSource solid-js */
// Floating Panel's Solid parts through its driver: a non-modal dialog named by its Title; the
// DragTrigger moves and resizes by keys; stages minimise (Body inert, focus to the DragTrigger),
// maximise and restore; an outside press keeps it open, Close closes it. Pointer drags and the
// boundary need layout (browser engines only): a drag moves once on release, clamped; Escape
// mid-drag puts it back; the south-east handle resizes.
import type { PanelStage } from "@rind-ui/core"
import { getFloatingPanel } from "@rind-ui/testing"
import axe from "axe-core"
import { describe, expect, it, vi } from "vitest"
import { mount } from "../../fixtures/mount"
import { RindProvider } from "../index"
import { FloatingPanel, type FloatingPanelRootProps } from "./index"

/** Lets mount effects run (microtasks, no elapsed time). */
const settle = async () => {
  for (let i = 0; i < 4; i++) await Promise.resolve()
}
/** Pointer drags and the boundary need layout: jsdom has no boxes. */
const jsdom = typeof navigator !== "undefined" && navigator.userAgent.includes("jsdom")

type Props = Partial<FloatingPanelRootProps> & { stageProp?: PanelStage }

function setup(initial: Props = { defaultOpen: true }) {
  const m = mount(
    (p: Props) => (
      <RindProvider>
        <FloatingPanel.Root
          defaultPosition={{ x: 40, y: 40 }}
          defaultOpen={p.defaultOpen}
          stage={p.stageProp}
          onPositionChange={p.onPositionChange}
          onSizeChange={p.onSizeChange}
        >
          <FloatingPanel.Trigger>Notes</FloatingPanel.Trigger>
          <FloatingPanel.Positioner>
            <FloatingPanel.Content>
              <FloatingPanel.Header>
                <FloatingPanel.DragTrigger>⠿</FloatingPanel.DragTrigger>
                <FloatingPanel.Title>Notes</FloatingPanel.Title>
                <FloatingPanel.Control>
                  <FloatingPanel.StageTrigger stage="minimized">_</FloatingPanel.StageTrigger>
                  <FloatingPanel.StageTrigger stage="maximized">□</FloatingPanel.StageTrigger>
                  <FloatingPanel.CloseTrigger>×</FloatingPanel.CloseTrigger>
                </FloatingPanel.Control>
              </FloatingPanel.Header>
              <FloatingPanel.Body>
                <textarea aria-label="Note" />
              </FloatingPanel.Body>
              <FloatingPanel.ResizeTrigger axis="se" />
            </FloatingPanel.Content>
          </FloatingPanel.Positioner>
        </FloatingPanel.Root>
        <button type="button">Outside</button>
      </RindProvider>
    ),
    initial,
  )
  const q = (sel: string) => document.querySelector<HTMLElement>(sel)
  const byName = (name: string) =>
    [...document.querySelectorAll<HTMLElement>("button")].find(
      (b) => b.getAttribute("aria-label") === name || b.textContent === name,
    )
  return { ...m, q, byName, d: () => getFloatingPanel(document.body) }
}

/** The boundary and pointer drags: a 600×400 positioned box. */
function setupLayout() {
  const onPositionChange = vi.fn()
  mount(() => (
    <RindProvider>
      <div style={{ position: "relative", width: "600px", height: "400px" }}>
        <FloatingPanel.Root
          defaultOpen
          defaultPosition={{ x: 50, y: 50 }}
          defaultSize={{ width: 200, height: 150 }}
          onPositionChange={onPositionChange}
        >
          <FloatingPanel.Positioner>
            <FloatingPanel.Content style={{ "pointer-events": "auto" }}>
              <FloatingPanel.Header>
                <FloatingPanel.DragTrigger>Drag</FloatingPanel.DragTrigger>
                <FloatingPanel.Title>Panel</FloatingPanel.Title>
              </FloatingPanel.Header>
              <FloatingPanel.Body>Body</FloatingPanel.Body>
              <FloatingPanel.ResizeTrigger
                axis="se"
                style={{
                  position: "absolute",
                  right: "0",
                  bottom: "0",
                  width: "16px",
                  height: "16px",
                }}
              />
            </FloatingPanel.Content>
          </FloatingPanel.Positioner>
        </FloatingPanel.Root>
      </div>
    </RindProvider>
  ))
  return { onPositionChange, d: () => getFloatingPanel(document.body) }
}

const fire = (el: EventTarget, type: string, x: number, y: number) =>
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

describe("Solid FloatingPanel", () => {
  it("a non-modal dialog named by the Title; the DragTrigger a described button", async () => {
    const t = setup()
    await settle()
    const dialog = t.q('[role="dialog"]') as HTMLElement
    expect(dialog.hasAttribute("aria-modal")).toBe(false)
    expect(document.getElementById(dialog.getAttribute("aria-labelledby") ?? "")?.textContent).toBe(
      "Notes",
    )
    const move = t.q('[data-part="drag-trigger"]') as HTMLElement
    expect(move.tagName).toBe("BUTTON")
    expect(move.getAttribute("aria-describedby")).toBe(t.q('[data-part="drag-hint"]')?.id)
    expect(t.q('[data-part="resize-trigger"]')?.getAttribute("aria-hidden")).toBe("true")
    expect(await t.d().position()).toEqual({ x: 40, y: 40 })
    const { violations } = await axe.run(document.body, {
      rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
    })
    expect(violations.map((v) => v.id)).toEqual([])
  })

  it("arrows move by 10, Shift by 50, Alt resizes; each step reports once", async () => {
    const onPositionChange = vi.fn()
    const onSizeChange = vi.fn()
    const t = setup({ defaultOpen: true, onPositionChange, onSizeChange })
    await settle()
    await t.d().moveBy(20, -10)
    expect(await t.d().position()).toEqual({ x: 60, y: 30 })
    expect(onPositionChange).toHaveBeenCalledTimes(3)
    await t.d().resizeBy(20, 0)
    expect(await t.d().size()).toEqual({ width: 380, height: 240 })
    expect(onSizeChange).toHaveBeenCalledTimes(2)
  })

  it("minimised from inside the Body: the Body hides and focus goes to the DragTrigger", async () => {
    const t = setup({ defaultOpen: true, stageProp: "default" })
    await settle()
    ;(t.q('textarea[aria-label="Note"]') as HTMLElement).focus()
    await t.rerender({ defaultOpen: true, stageProp: "minimized" })
    await settle()
    expect(t.q('[data-part="body"]')?.hidden).toBe(true)
    expect(document.activeElement).toBe(t.q('[data-part="drag-trigger"]'))
  })

  it("the stage triggers minimise and restore; Enter on the DragTrigger maximises", async () => {
    const t = setup()
    await settle()
    await t.d().via("pointer").minimize()
    expect(t.q('[data-part="body"]')?.hidden).toBe(true)
    await t.d().via("pointer").restore()
    expect(await t.d().stage()).toBe("default")
    await t.d().via("keyboard").maximize()
    expect(await t.d().stage()).toBe("maximized")
  })

  it("opens from the Trigger; an outside press keeps it open; Close closes it", async () => {
    const t = setup({})
    await settle()
    ;(t.byName("Notes") as HTMLElement).click()
    await vi.waitFor(async () => expect(await t.d().isOpen()).toBe(true))
    const outside = t.byName("Outside") as HTMLElement
    outside.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }))
    outside.click()
    await settle()
    expect(await t.d().isOpen()).toBe(true)
    await t.d().via("pointer").close()
    await vi.waitFor(() => expect(t.q('[role="dialog"]')).toBeNull())
  })

  it.skipIf(jsdom)("a drag moves the panel once, on release, clamped to the boundary", async () => {
    const t = setupLayout()
    await settle()
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

  it.skipIf(jsdom)("Escape mid-drag puts the panel back and keeps it open", async () => {
    const t = setupLayout()
    await settle()
    const handle = document.querySelector('[data-part="drag-trigger"]') as HTMLElement
    handle.focus()
    fire(handle, "pointerdown", 100, 100)
    fire(document, "pointermove", 160, 160)
    await vi.waitFor(async () => expect(await t.d().isDragging()).toBe(true))
    // Cancelable, as a real key press: the part prevents it, so the dialog's Escape skips it.
    handle.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
    )
    await vi.waitFor(async () => expect(await t.d().isDragging()).toBe(false))
    expect(await t.d().position()).toEqual({ x: 50, y: 50 })
    expect(await t.d().isOpen()).toBe(true)
  })

  it.skipIf(jsdom)("the south-east handle resizes", async () => {
    const t = setupLayout()
    await settle()
    const grip = document.querySelector('[data-part="resize-trigger"]') as HTMLElement
    fire(grip, "pointerdown", 300, 300)
    fire(document, "pointermove", 340, 330)
    fire(document, "pointerup", 340, 330)
    await vi.waitFor(async () => expect(await t.d().size()).toEqual({ width: 240, height: 180 }))
  })
})
