// Floating Panel's Angular parts through its driver: a non-modal dialog named by its Title; the
// DragTrigger moves and resizes by keys; stages minimise (Body inert, focus to the DragTrigger),
// maximise and restore; an outside press keeps it open, Close closes it. Pointer drags and the
// boundary need layout (browser engines only): a drag moves once on release, clamped; Escape
// mid-drag puts it back; the south-east handle resizes.
import { Component, signal } from "@angular/core"
import type { PanelStage } from "@rind-ui/core"
import { getFloatingPanel } from "@rind-ui/testing"
import axe from "axe-core"
import { describe, expect, it, vi } from "vitest"
import { mount } from "../../fixtures/mount"
import { FloatingPanel } from "./index"

/** Pointer drags and the boundary need layout: jsdom has no boxes. */
const jsdom = typeof navigator !== "undefined" && navigator.userAgent.includes("jsdom")

interface Cfg {
  defaultOpen: boolean | undefined
  stage: ReturnType<typeof signal<PanelStage | undefined>>
  positions: unknown[]
  sizes: unknown[]
}
/** The fixture's configuration, for the next mount. */
let current: Cfg

@Component({
  selector: "rind-f",
  imports: [FloatingPanel],
  template: `<div
      rindFloatingPanelRoot
      [defaultPosition]="{ x: 40, y: 40 }"
      [defaultOpen]="cfg.defaultOpen"
      [stage]="cfg.stage()"
      (positionChange)="cfg.positions.push($event)"
      (sizeChange)="cfg.sizes.push($event)"
    >
      <button rindFloatingPanelTrigger>Notes</button>
      <div rindFloatingPanelPositioner>
        <div rindFloatingPanelContent>
          <div rindFloatingPanelHeader>
            <button rindFloatingPanelDragTrigger>⠿</button>
            <h2 rindFloatingPanelTitle>Notes</h2>
            <div rindFloatingPanelControl>
              <button rindFloatingPanelStageTrigger stage="minimized">_</button>
              <button rindFloatingPanelStageTrigger stage="maximized">□</button>
              <button rindFloatingPanelCloseTrigger>×</button>
            </div>
          </div>
          <div rindFloatingPanelBody><textarea aria-label="Note"></textarea></div>
          <div rindFloatingPanelResizeTrigger axis="se"></div>
        </div>
      </div>
    </div>
    <button type="button">Outside</button>`,
})
class Tree {
  readonly cfg = current
}

@Component({
  selector: "rind-l",
  imports: [FloatingPanel],
  template: `<div style="position: relative; width: 600px; height: 400px">
    <div
      rindFloatingPanelRoot
      defaultOpen
      [defaultPosition]="{ x: 50, y: 50 }"
      [defaultSize]="{ width: 200, height: 150 }"
      (positionChange)="cfg.positions.push($event)"
    >
      <div rindFloatingPanelPositioner>
        <div rindFloatingPanelContent style="pointer-events: auto">
          <div rindFloatingPanelHeader>
            <button rindFloatingPanelDragTrigger>Drag</button>
            <h2 rindFloatingPanelTitle>Panel</h2>
          </div>
          <div rindFloatingPanelBody>Body</div>
          <div
            rindFloatingPanelResizeTrigger
            axis="se"
            style="position: absolute; right: 0; bottom: 0; width: 16px; height: 16px"
          ></div>
        </div>
      </div>
    </div>
  </div>`,
})
class Layout {
  readonly cfg = current
}

async function setup(p: { defaultOpen?: boolean; stage?: PanelStage } = { defaultOpen: true }) {
  current = {
    defaultOpen: p.defaultOpen,
    stage: signal<PanelStage | undefined>(p.stage),
    positions: [],
    sizes: [],
  }
  const cfg = current
  const m = await mount(Tree)
  const stable = () => m.rerender({})
  const q = (sel: string) => document.querySelector<HTMLElement>(sel)
  const byText = (text: string) =>
    [...document.querySelectorAll<HTMLElement>("button")].find((b) => b.textContent === text)
  return { ...m, cfg, stable, q, byText, d: () => getFloatingPanel(document.body) }
}

async function setupLayout() {
  current = { defaultOpen: true, stage: signal(undefined), positions: [], sizes: [] }
  const cfg = current
  const m = await mount(Layout)
  return { ...m, cfg, stable: () => m.rerender({}), d: () => getFloatingPanel(document.body) }
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

describe("Angular FloatingPanel", () => {
  it("a non-modal dialog named by the Title; the DragTrigger a described button", async () => {
    const t = await setup()
    const dialog = t.q('[role="dialog"]') as HTMLElement
    expect(dialog.hasAttribute("aria-modal")).toBe(false)
    expect(document.getElementById(dialog.getAttribute("aria-labelledby") ?? "")?.textContent).toBe(
      "Notes",
    )
    const move = t.q('[data-part="drag-trigger"]') as HTMLElement
    expect(move.getAttribute("aria-describedby")).toBe(t.q('[data-part="drag-hint"]')?.id)
    expect(t.q('[data-part="resize-trigger"]')?.getAttribute("aria-hidden")).toBe("true")
    expect(await t.d().position()).toEqual({ x: 40, y: 40 })
    const { violations } = await axe.run(document.body, {
      rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
    })
    expect(violations.map((v) => v.id)).toEqual([])
  })

  it("arrows move by 10, Shift by 50, Alt resizes; each step reports once", async () => {
    const t = await setup()
    await t.d().moveBy(20, -10)
    await t.stable()
    expect(await t.d().position()).toEqual({ x: 60, y: 30 })
    expect(t.cfg.positions).toHaveLength(3)
    await t.d().resizeBy(20, 0)
    await t.stable()
    expect(await t.d().size()).toEqual({ width: 380, height: 240 })
    expect(t.cfg.sizes).toHaveLength(2)
  })

  it("minimised from inside the Body: the Body hides and focus goes to the DragTrigger", async () => {
    const t = await setup({ defaultOpen: true, stage: "default" })
    ;(t.q('textarea[aria-label="Note"]') as HTMLElement).focus()
    t.cfg.stage.set("minimized")
    await t.stable()
    expect(t.q('[data-part="body"]')?.hidden).toBe(true)
    expect(document.activeElement).toBe(t.q('[data-part="drag-trigger"]'))
  })

  it("the stage triggers minimise and restore; Enter on the DragTrigger maximises", async () => {
    const t = await setup()
    await t.d().via("pointer").minimize()
    await t.stable()
    expect(t.q('[data-part="body"]')?.hidden).toBe(true)
    await t.d().via("pointer").restore()
    expect(await t.d().stage()).toBe("default")
    await t.d().via("keyboard").maximize()
    expect(await t.d().stage()).toBe("maximized")
  })

  it("opens from the Trigger; an outside press keeps it open; Close closes it", async () => {
    const t = await setup({})
    ;(t.byText("Notes") as HTMLElement).click()
    await vi.waitFor(async () => {
      await t.stable()
      expect(await t.d().isOpen()).toBe(true)
    })
    const outside = t.byText("Outside") as HTMLElement
    outside.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }))
    outside.click()
    await t.stable()
    expect(await t.d().isOpen()).toBe(true)
    await t.d().via("pointer").close()
    await vi.waitFor(async () => {
      await t.stable()
      expect(t.q('[role="dialog"]')).toBeNull()
    })
  })

  it.skipIf(jsdom)("a drag moves the panel once, on release, clamped to the boundary", async () => {
    const t = await setupLayout()
    const handle = document.querySelector('[data-part="drag-trigger"]') as HTMLElement
    fire(handle, "pointerdown", 100, 100)
    fire(document, "pointermove", 130, 120)
    await vi.waitFor(async () => expect(await t.d().position()).toEqual({ x: 80, y: 70 }))
    expect(t.cfg.positions).toEqual([])
    fire(document, "pointerup", 130, 120)
    await vi.waitFor(async () => {
      await t.stable()
      expect(t.cfg.positions).toEqual([{ x: 80, y: 70 }])
    })
    // Far up and left: the top edge stays at 0, 48 px stay visible on the left.
    fire(handle, "pointerdown", 100, 100)
    fire(document, "pointermove", -900, -900)
    fire(document, "pointerup", -900, -900)
    await vi.waitFor(async () => {
      await t.stable()
      expect(await t.d().position()).toEqual({ x: -152, y: 0 })
    })
  })

  it.skipIf(jsdom)("Escape mid-drag puts the panel back and keeps it open", async () => {
    const t = await setupLayout()
    const handle = document.querySelector('[data-part="drag-trigger"]') as HTMLElement
    handle.focus()
    fire(handle, "pointerdown", 100, 100)
    fire(document, "pointermove", 160, 160)
    await vi.waitFor(async () => {
      await t.stable()
      expect(await t.d().isDragging()).toBe(true)
    })
    handle.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
    )
    await vi.waitFor(async () => {
      await t.stable()
      expect(await t.d().isDragging()).toBe(false)
    })
    expect(await t.d().position()).toEqual({ x: 50, y: 50 })
    expect(await t.d().isOpen()).toBe(true)
  })

  it.skipIf(jsdom)("the south-east handle resizes", async () => {
    const t = await setupLayout()
    const grip = document.querySelector('[data-part="resize-trigger"]') as HTMLElement
    fire(grip, "pointerdown", 300, 300)
    fire(document, "pointermove", 340, 330)
    fire(document, "pointerup", 340, 330)
    await vi.waitFor(async () => {
      await t.stable()
      expect(await t.d().size()).toEqual({ width: 240, height: 180 })
    })
  })
})
