// The anchored fixture machine in Node with the fake `position` capability. Without a
// `document` the overlay effect is a no-op (guarded in overlayEffect), so the real machine
// runs unchanged; only the env members read outside that guard are stubbed.
import { createService, type DomEnvironment, type PositionEnv } from "@rind-ui/core"
import { describe, expect, it } from "vitest"
import { fakePositioning } from "../../src/positioning"
import { connect } from "./anchored.connect"
import { type AnchoredProps, anchoredIds, anchoredMachine } from "./anchored.machine"

function make(extra: Partial<AnchoredProps> = {}) {
  const position = fakePositioning()
  // Only `modality.modality()` and `dom.getById` are read in Node; the rest is unused here,
  // so the stub is asserted to the full type (sound: unreached members are never called).
  const env = {
    position,
    modality: { modality: () => "keyboard" },
    dom: { getById: () => null },
  } as unknown as DomEnvironment & PositionEnv
  const props: AnchoredProps = { root: "r", ...extra }
  const service = createService(anchoredMachine, props, env)
  service.start()
  const placement = () => service.getSnapshot().context.placement
  const positioner = () =>
    connect({ open: true, placement: placement() }, () => {}, "r").positioner()
  return { service, position, placement, positioner }
}

const ids = anchoredIds("r")

describe("anchored machine with fakePositioning", () => {
  it("OPEN tracks one request: element anchor = trigger, positioner id", () => {
    const { service, position } = make()
    expect(position.requests).toHaveLength(0)
    service.send({ type: "OPEN" })
    expect(position.requests).toHaveLength(1)
    const r = position.requests[0]
    expect(r?.anchor).toEqual({ kind: "element", id: ids.trigger })
    expect(r?.positioner).toBe(ids.positioner)
    expect(r?.arrow).toBeUndefined()
    expect(r?.options().side).toBe("bottom")
  })

  it("tracks the arrow id when the fixture has an arrow", () => {
    const { service, position } = make({ arrow: true })
    service.send({ type: "OPEN" })
    expect(position.requests[0]?.arrow).toBe(ids.arrow)
  })

  it("a first placement is stored and the positioner reflects it", () => {
    const { service, position, placement, positioner } = make()
    service.send({ type: "OPEN" })
    expect(placement().placed).toBe(false)
    expect(positioner()["data-placing"]).toBe("")
    position.emit({ side: "top", align: "center", anchorHidden: false }, { first: true })
    expect(placement()).toEqual({
      placed: true,
      side: "top",
      align: "center",
      anchorHidden: false,
    })
    expect(positioner()["data-side"]).toBe("top")
    expect(positioner()["data-placing"]).toBeUndefined()
  })

  it("stores a repeated or later placement as reported (dedupe is the capability's job)", () => {
    const { service, position, placement } = make()
    service.send({ type: "OPEN" })
    position.emit({ side: "top", align: "center", anchorHidden: false })
    position.emit({ side: "top", align: "center", anchorHidden: false }, { first: false })
    expect(placement().side).toBe("top")
    position.emit({ side: "left", align: "end", anchorHidden: true }, { first: false })
    expect(placement()).toEqual({
      placed: true,
      side: "left",
      align: "end",
      anchorHidden: true,
    })
  })

  it("CLOSE stops tracking and resets to unplaced; reopening starts fresh", () => {
    const { service, position, placement } = make()
    service.send({ type: "OPEN" })
    position.emit({ side: "top", align: "end", anchorHidden: false })
    service.send({ type: "CLOSE" })
    expect(position.requests).toHaveLength(0)
    expect(placement()).toEqual({
      placed: false,
      side: "bottom",
      align: "center",
      anchorHidden: false,
    })
    service.send({ type: "OPEN" })
    expect(position.requests).toHaveLength(1)
    expect(placement().placed).toBe(false)
    position.emit({ side: "bottom", align: "center", anchorHidden: false })
    expect(placement().placed).toBe(true)
  })

  it("POSITION.REPOSITION reaches the capability for this positioner", () => {
    const { service, position } = make()
    service.send({ type: "OPEN" })
    expect(position.repositions).toBe(0)
    service.send({ type: "POSITION.REPOSITION" })
    expect(position.repositions).toBe(1)
  })

  it("a point anchor prop becomes a point AnchorSource", () => {
    const { service, position } = make({ anchor: { x: 12, y: 34 } })
    service.send({ type: "OPEN" })
    expect(position.requests[0]?.anchor).toEqual({ kind: "point", x: 12, y: 34 })
  })

  it("a virtual anchor prop becomes a virtual AnchorSource", () => {
    const get = () => null
    const { service, position } = make({ anchor: { get } })
    service.send({ type: "OPEN" })
    const a = position.requests[0]?.anchor
    expect(a?.kind).toBe("virtual")
    expect(a?.kind === "virtual" && a.get).toBe(get)
  })

  it("positioning props reach the live options", () => {
    const { service, position } = make({ preset: "dropdown", positioning: { sideOffset: 6 } })
    service.send({ type: "OPEN" })
    const o = position.requests[0]?.options()
    expect(o?.sideOffset).toBe(6)
    expect(o?.align).toBe("start")
  })
})
