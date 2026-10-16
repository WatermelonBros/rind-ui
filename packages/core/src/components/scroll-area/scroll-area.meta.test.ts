import { describe, expect, it } from "vitest"
import { scrollAreaConnect } from "./scroll-area.connect"
import { scrollAreaContract } from "./scroll-area.contract"
import { scrollAreaMachine } from "./scroll-area.machine"
import { scrollAreaMeta } from "./scroll-area.meta"

describe("scroll-area meta matches the code", () => {
  it("contract and states", () => {
    expect(Object.keys(scrollAreaMeta.contract.actions)).toEqual(
      Object.keys(scrollAreaContract.actions),
    )
    expect(scrollAreaMeta.contract.queries).toEqual(Object.keys(scrollAreaContract.queries))
    expect(scrollAreaMeta.contract.traits).toEqual(scrollAreaContract.traits)
    expect(Object.keys(scrollAreaMeta.states)).toEqual(Object.keys(scrollAreaMachine.def.states))
  })
  it("data attributes", () => {
    const c = scrollAreaConnect({
      instance: "i",
      state: "idle",
      type: "hover",
      modality: "keyboard",
      context: {
        hovered: false,
        focusInside: false,
        viewportFocused: false,
        onScrollbar: null,
        scrolling: null,
        dragAxis: null,
        measured: true,
        overflow: { x: true, y: true },
        edges: { xStart: true, xEnd: true, yStart: true, yEnd: true },
        tabbableContent: false,
        tabStop: true,
      },
    })
    const noop = () => {}
    const keys = (p: object) => Object.keys(p).filter((k) => k.startsWith("data-"))
    const parts = {
      root: c.root(noop),
      viewport: c.viewport(noop, false),
      content: c.content(),
      scrollbar: c.scrollbar(noop, "vertical"),
      thumb: c.thumb("vertical"),
      corner: c.corner(),
    }
    for (const [part, props] of Object.entries(parts)) {
      expect(Object.keys(scrollAreaMeta.dataAttributes[part as keyof typeof parts]).sort()).toEqual(
        keys(props).sort(),
      )
    }
  })
})
