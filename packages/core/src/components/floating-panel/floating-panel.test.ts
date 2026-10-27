import { describe, expect, it, vi } from "vitest"
import { platforms } from "../../dom/platform"
import { clampRect, resizeRect } from "../../dom/rect-bounds"
import { createService } from "../../machine/service"
import { floatingPanelConnect, floatingPanelKeyEvent } from "./floating-panel.connect"
import { floatingPanelContract } from "./floating-panel.contract"
import { type FloatingPanelProps, floatingPanelMachine } from "./floating-panel.machine"
import { floatingPanelMessages } from "./floating-panel.messages"
import { floatingPanelMeta } from "./floating-panel.meta"

const limits = {
  boundary: { width: 1000, height: 800 },
  minSize: { width: 200, height: 120 },
  minVisible: 48,
}

describe("rect bounds", () => {
  it("keeps minVisible px inside; the top never above 0", () => {
    expect(clampRect({ x: 5000, y: -50, width: 300, height: 200 }, limits)).toEqual({
      x: 952,
      y: 0,
      width: 300,
      height: 200,
    })
  })

  it("a west resize keeps the right edge", () => {
    const r = resizeRect({ x: 100, y: 100, width: 300, height: 200 }, "w", -40, 0, limits)
    expect([r.x, r.width, r.x + r.width]).toEqual([60, 340, 400])
    const min = resizeRect({ x: 100, y: 100, width: 300, height: 200 }, "nw", 500, 500, limits)
    expect([min.width, min.height, min.x + min.width, min.y + min.height]).toEqual([
      200, 120, 400, 300,
    ])
  })
})

function make(over: Partial<FloatingPanelProps> = {}) {
  const onPositionChange = vi.fn()
  const props: FloatingPanelProps = {
    defaultPosition: { x: 20, y: 30 },
    defaultSize: { width: 300, height: 200 },
    onPositionChange,
    ...over,
  }
  const s = createService(floatingPanelMachine, props, {})
  s.start()
  s.send({ type: "BOUNDARY", width: 1000, height: 800 })
  const v = () => s.view(props).values
  return { s, v, onPositionChange, state: () => s.getSnapshot().state }
}

describe("floating panel machine", () => {
  it("a drag is seen at its end, clamped", () => {
    const t = make()
    t.s.send({ type: "DRAG.START", mode: "move" })
    expect(t.state()).toBe("moving")
    t.s.send({ type: "DRAG.END", dx: 5000, dy: 10 })
    expect(t.v().position).toEqual({ x: 952, y: 40 })
    expect(t.onPositionChange).toHaveBeenCalledTimes(1)
  })

  it("a cancelled drag changes nothing (Escape)", () => {
    const t = make()
    t.s.send({ type: "DRAG.START", mode: "resize", axis: "se" })
    t.s.send({ type: "DRAG.CANCEL" })
    expect([t.state(), t.v().size]).toEqual(["idle", { width: 300, height: 200 }])
  })

  it("keys move and resize by step", () => {
    const t = make()
    t.s.send({ type: "MOVE.STEP", dx: 1, dy: 0, large: false })
    t.s.send({ type: "MOVE.STEP", dx: 0, dy: 1, large: true })
    expect(t.v().position).toEqual({ x: 30, y: 80 })
    t.s.send({ type: "RESIZE.STEP", dx: 1, dy: 0, large: false })
    expect(t.v().size).toEqual({ width: 310, height: 200 })
  })

  it("maximise then restore brings back the rect; maximised does not move", () => {
    const t = make()
    t.s.send({ type: "STAGE.TOGGLE_MAXIMIZED" })
    expect(t.v().stage).toBe("maximized")
    t.s.send({ type: "MOVE.STEP", dx: 1, dy: 0, large: false })
    t.s.send({ type: "STAGE", stage: "default" })
    expect([t.v().stage, t.v().position, t.v().size]).toEqual([
      "default",
      { x: 20, y: 30 },
      { width: 300, height: 200 },
    ])
  })

  it("a smaller boundary re-clamps", () => {
    const t = make({ defaultPosition: { x: 900, y: 30 } })
    t.s.send({ type: "BOUNDARY", width: 600, height: 800 })
    expect(t.v().position.x).toBe(552)
  })

  it("keys: arrows move, Alt resizes, Enter maximises, Escape only while dragging", () => {
    const k = (key: string, mods: Partial<Record<"alt" | "shift", boolean>> = {}) =>
      floatingPanelKeyEvent(
        {
          key,
          shift: false,
          alt: false,
          ctrl: false,
          meta: false,
          composing: false,
          ...mods,
        } as never,
        { dir: "ltr", dragging: false },
      )
    expect(k("ArrowRight")).toEqual({ type: "MOVE.STEP", dx: 1, dy: 0, large: false })
    expect(k("ArrowDown", { alt: true, shift: true })).toEqual({
      type: "RESIZE.STEP",
      dx: 0,
      dy: 1,
      large: true,
    })
    expect(k("Enter")).toEqual({ type: "STAGE.TOGGLE_MAXIMIZED" })
    expect(k("Escape")).toBeNull()
  })
})

const env = { platform: platforms.linux } as unknown as Parameters<typeof floatingPanelConnect>[1] // only platform is read
const api = (over: Partial<Parameters<typeof floatingPanelConnect>[0]> = {}) =>
  floatingPanelConnect(
    {
      instance: "p",
      open: true,
      state: "moving",
      rect: { x: 20, y: 30, width: 300, height: 200 },
      stage: "default",
      disabled: true,
      draggable: true,
      resizable: true,
      messages: floatingPanelMessages,
      ids: { content: "c", title: "t", description: "d", hint: "h" },
      rendered: { description: true },
      ...over,
    },
    env,
  )
const b = { tag: "button", focused: true, modality: "keyboard" as const }
const dataKeys = (p: Record<string, unknown>) =>
  Object.keys(p)
    .filter((k) => k.startsWith("data-") && p[k] !== undefined)
    .sort()

describe("floating panel connect", () => {
  it("a non-modal dialog named by the title; the rect as variables", () => {
    const c = api().content()
    expect(c).toMatchObject({ role: "dialog", "aria-labelledby": "t" })
    expect(c["aria-modal"]).toBeUndefined()
    const style = api().positioner()["style"] as Record<string, string>
    expect([style["--rind-floating-panel-x"], style["--rind-floating-panel-width"]]).toEqual([
      "20px",
      "300px",
    ])
  })

  it("stage triggers name what they will do; minimised body is inert", () => {
    expect(api().stageTrigger("maximized", b)["aria-label"]).toBe("Maximise")
    expect(api({ stage: "maximized" }).stageTrigger("maximized", b)["aria-label"]).toBe("Restore")
    expect(api({ stage: "minimized" }).body()).toMatchObject({ inert: true, hidden: true })
    expect(api().resizeTrigger("se")["aria-hidden"]).toBe("true")
  })

  it("meta matches the code", () => {
    const a = api({ state: "resizing" })
    const parts = {
      root: a.root(),
      trigger: a.trigger(b),
      positioner: a.positioner(),
      content: a.content(),
      header: a.header(),
      "drag-trigger": a.dragTrigger(b),
      title: a.title(),
      description: a.description(),
      control: a.control(),
      "stage-trigger": a.stageTrigger("minimized", b),
      "close-trigger": a.closeTrigger(b),
      body: a.body(),
      "resize-trigger": a.resizeTrigger("n"),
    }
    for (const [part, props] of Object.entries(parts)) {
      const meta =
        floatingPanelMeta.dataAttributes[part as keyof typeof floatingPanelMeta.dataAttributes]
      const keys = dataKeys(props).filter((k) => k !== "data-dragging")
      expect(
        Object.keys(meta)
          .filter((k) => k !== "data-dragging")
          .sort(),
        part,
      ).toEqual(keys)
    }
    expect(floatingPanelMeta.contract.queries).toEqual(Object.keys(floatingPanelContract.queries))
    expect(Object.keys(floatingPanelMeta.states)).toEqual(
      Object.keys(floatingPanelMachine.def.states),
    )
  })
})
