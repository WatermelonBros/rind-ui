import { describe, expect, it } from "vitest"
import type { PartProps } from "../../connect/props"
import { encodeKey } from "../../ids"
import {
  anchorProps,
  arrowProps,
  contentPlacementProps,
  placementFrom,
  positionerProps,
  unplaced,
} from "./connect"

const ids = { positioner: "pos", anchor: "a_b:c" }
const placed = placementFrom({ side: "top", align: "end", anchorHidden: false })
const style = (p: PartProps) => p["style"] as Record<string, string>

describe("positionerProps", () => {
  it("first frame: fixed at the origin, transparent, inert, data-placing", () => {
    const p = positionerProps(unplaced("bottom", "center"), ids)
    expect(p["data-placing"]).toBe("")
    expect(p["data-side"]).toBe("bottom")
    expect(p["data-align"]).toBe("center")
    expect(p["id"]).toBe("pos")
    expect(style(p)).toMatchObject({
      position: "fixed",
      top: "0",
      left: "0",
      opacity: "0",
      "pointer-events": "none",
      "--rind-available-width": "100vw",
      "--rind-available-height": "100vh",
    })
    expect(style(p)["transform"]).toBeUndefined()
  })

  it("placed: transform and position variables, no data-placing", () => {
    const p = positionerProps(placed, ids)
    expect(p["data-placing"]).toBeUndefined()
    expect(p["data-side"]).toBe("top")
    expect(p["data-align"]).toBe("end")
    expect(style(p)).toMatchObject({
      position: "var(--rind-position, absolute)",
      transform: "translate(var(--rind-x, 0px), var(--rind-y, 0px))",
    })
    expect(style(p)["opacity"]).toBeUndefined()
    expect(style(p)["pointer-events"]).toBeUndefined()
  })

  it("manual mode writes no position or transform but keeps position-anchor", () => {
    for (const s of [unplaced("bottom", "center"), placed]) {
      const st = style(positionerProps(s, ids, { manual: true }))
      expect(st["position"]).toBeUndefined()
      expect(st["transform"]).toBeUndefined()
      expect(st["opacity"]).toBeUndefined()
      expect(st["position-anchor"]).toBe(`--rind-anchor-${encodeKey("a_b:c")}`)
    }
  })

  it("passes dir through", () => {
    expect(positionerProps(placed, ids, { dir: "rtl" })["dir"]).toBe("rtl")
    expect(positionerProps(placed, ids)["dir"]).toBeUndefined()
  })

  it("data-anchor-hidden only when placed and hidden", () => {
    const hidden = placementFrom({ side: "top", align: "end", anchorHidden: true })
    expect(positionerProps(hidden, ids)["data-anchor-hidden"]).toBe("")
    expect(positionerProps(placed, ids)["data-anchor-hidden"]).toBeUndefined()
    expect(
      positionerProps({ ...unplaced("top", "end"), anchorHidden: true }, ids)["data-anchor-hidden"],
    ).toBeUndefined()
  })
})

describe("contentPlacementProps / arrowProps / anchorProps", () => {
  it("content has animation-name none only while placing", () => {
    const c = contentPlacementProps(unplaced("bottom", "start"))
    expect(c["data-placing"]).toBe("")
    expect(style(c)["animation-name"]).toBe("none")
    const d = contentPlacementProps(placed)
    expect(d["data-placing"]).toBeUndefined()
    expect(d["style"]).toBeUndefined()
    expect(d["data-side"]).toBe("top")
  })

  it("arrow is hidden from AT and reads its coordinates from variables", () => {
    const a = arrowProps(placed, "arr")
    expect(a["id"]).toBe("arr")
    expect(a["aria-hidden"]).toBe("true")
    expect(a["data-side"]).toBe("top")
    expect(style(a)).toMatchObject({
      position: "absolute",
      left: "var(--rind-arrow-x)",
      top: "var(--rind-arrow-y)",
    })
  })

  it("anchor-name uses the encoded id", () => {
    const n = style(anchorProps("a_b:c"))["anchor-name"]
    expect(n).toBe("--rind-anchor-a_5f_b_3a_c")
    expect(n).toBe(style(positionerProps(placed, ids))["position-anchor"])
  })
})
