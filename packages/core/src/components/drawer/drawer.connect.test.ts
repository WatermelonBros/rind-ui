// The Drawer's attributes (openspec add-drawer, "Data Attributes"): what connect owns, plus the
// Dialog's own attributes kept under data-scope "drawer".
import { describe, expect, it, vi } from "vitest"
import { CRITICAL } from "../../connect/props"
import {
  type DrawerConnectInput,
  type DrawerExtrasInput,
  drawerConnect,
  drawerExtras,
  drawerIndentProps,
} from "./drawer.connect"
import { drawerMessages } from "./drawer.messages"
import type { ResolvedSnapPoint } from "./snap-points"

const small: ResolvedSnapPoint = { point: 0.4, size: 320, offset: 480 }
const large: ResolvedSnapPoint = { point: 1, size: 800, offset: 0 }

const extras: DrawerExtrasInput = {
  instance: "r",
  open: true,
  closeReason: null,
  side: "bottom",
  swipe: "idle",
  nested: { count: 0, frontmostSize: 0, swiping: false },
  size: 800,
  resolved: [],
  snapPoint: null,
  messages: drawerMessages,
}
const input: DrawerConnectInput = {
  ...extras,
  instance: "r",
  modal: true,
  opener: "t1",
  rendered: { title: "drawer-r-title", description: "drawer-r-description" },
  contentMounted: true,
  titleFocusTarget: false,
}
const ex = (over: Partial<DrawerExtrasInput> = {}, send = vi.fn()) =>
  drawerExtras({ ...extras, ...over }, send)
const full = (over: Partial<DrawerConnectInput> = {}, send = vi.fn()) =>
  drawerConnect({ ...input, ...over }, send)
const style = (p: object) => (p as { style: Record<string, string> }).style
const handleState = { focused: false, modality: "keyboard" as const, pressed: false }

describe("data-side", () => {
  it.each(["top", "bottom", "left", "right"] as const)("%s on positioner and content", (side) => {
    const a = ex({ side })
    expect(a.positioner()["data-side"]).toBe(side)
    expect(a.content()["data-side"]).toBe(side)
  })
})

describe("data-swiping", () => {
  it("is on content and backdrop only while swiping", () => {
    const on = ex({ swipe: "swiping" })
    expect(on.content()["data-swiping"]).toBe("")
    expect(on.backdrop()["data-swiping"]).toBe("")
    for (const swipe of ["idle", "releasing"] as const) {
      const a = ex({ swipe })
      expect(a.content()["data-swiping"]).toBeUndefined()
      expect(a.backdrop()["data-swiping"]).toBeUndefined()
    }
  })
})

describe("data-swipe-dismiss", () => {
  it("is set while releasing", () => {
    expect(ex({ swipe: "releasing" }).content()["data-swipe-dismiss"]).toBe("")
  })

  it("is set after a swipe close, not after another reason or while open", () => {
    expect(ex({ open: false, closeReason: "swipe" }).content()["data-swipe-dismiss"]).toBe("")
    expect(
      ex({ open: false, closeReason: "escape-key" }).content()["data-swipe-dismiss"],
    ).toBeUndefined()
    expect(ex({ open: true, closeReason: "swipe" }).content()["data-swipe-dismiss"]).toBeUndefined()
    expect(ex().content()["data-swipe-dismiss"]).toBeUndefined()
  })
})

describe("snap points", () => {
  it("data-expanded is set with no points", () => {
    expect(ex().content()["data-expanded"]).toBe("")
  })

  it("data-expanded is set on the largest point only; data-snap-point is the index", () => {
    const resolved = [small, large]
    const atSmall = ex({ resolved, snapPoint: 0.4 }).content()
    expect(atSmall["data-expanded"]).toBeUndefined()
    expect(atSmall["data-snap-point"]).toBe("0")
    const atLarge = ex({ resolved, snapPoint: 1 }).content()
    expect(atLarge["data-expanded"]).toBe("")
    expect(atLarge["data-snap-point"]).toBe("1")
  })

  it("data-snap-point is absent without points or for an unknown point", () => {
    expect(ex().content()["data-snap-point"]).toBeUndefined()
    expect(ex({ resolved: [small, large], snapPoint: 0.7 }).content()["data-snap-point"]).toBe(
      undefined,
    )
  })

  it("--rind-drawer-snap-offset is the active point's offset, 0 otherwise", () => {
    expect(style(ex({ resolved: [small, large], snapPoint: 0.4 }).content())).toMatchObject({
      "--rind-drawer-snap-offset": "480px",
    })
    expect(style(ex({ resolved: [small, large], snapPoint: 1 }).content())).toMatchObject({
      "--rind-drawer-snap-offset": "0px",
    })
    expect(style(ex().content())["--rind-drawer-snap-offset"]).toBe("0px")
  })
})

describe("nesting and size variables", () => {
  it("data-nested-swiping follows the nested swipe", () => {
    expect(
      ex({ nested: { count: 1, frontmostSize: 300, swiping: true } }).content()[
        "data-nested-swiping"
      ],
    ).toBe("")
    expect(ex().content()["data-nested-swiping"]).toBeUndefined()
  })

  it("--rind-drawer-size is the rounded size", () => {
    expect(style(ex({ size: 412.6 }).content())["--rind-drawer-size"]).toBe("413px")
    expect(style(ex({ size: 0 }).content())["--rind-drawer-size"]).toBe("0px")
  })

  it("--rind-drawer-frontmost-size only with a nested drawer", () => {
    expect(style(ex().content())).not.toHaveProperty("--rind-drawer-frontmost-size")
    const nested = { count: 1, frontmostSize: 300, swiping: false }
    expect(style(ex({ nested }).content())["--rind-drawer-frontmost-size"]).toBe("300px")
  })
})

describe("handle", () => {
  it("is a button with two or more points, named for where a press goes", () => {
    const resolved = [small, large]
    const up = ex({ resolved, snapPoint: 0.4 })
    const p = up.handle(handleState)
    expect(up.handleIsButton).toBe(true)
    expect(p["type"]).toBe("button")
    expect(p["aria-label"]).toBe("Expand drawer")
    expect(p["aria-hidden"]).toBeUndefined()
    expect(p["data-part"]).toBe("handle")
    expect(p["data-scope"]).toBe("drawer")
    expect(p["data-snap-point"]).toBe("0")
    expect(ex({ resolved, snapPoint: 1 }).handle(handleState)["aria-label"]).toBe("Collapse drawer")
  })

  it("carries focus and press state as a button", () => {
    const p = ex({ resolved: [small, large], snapPoint: 0.4 }).handle({
      focused: true,
      modality: "keyboard",
      pressed: true,
    })
    expect(p["data-focus"]).toBe("")
    expect(p["data-focus-visible"]).toBe("")
    expect(p["data-pressed"]).toBe("")
  })

  it.each([[[]], [[small]]] as const)("is decorative with fewer than two points", (resolved) => {
    const a = ex({ resolved, snapPoint: resolved[0]?.point ?? null })
    const p = a.handle(handleState)
    expect(a.handleIsButton).toBe(false)
    expect(p["aria-hidden"]).toBe("true")
    expect(p["type"]).toBeUndefined()
    expect(p["aria-label"]).toBeUndefined()
  })

  it("pressHandle sends HANDLE_PRESS", () => {
    const send = vi.fn()
    ex({}, send).pressHandle("touch")
    expect(send).toHaveBeenCalledWith({ type: "HANDLE_PRESS", modality: "touch" })
  })

  it("uses custom messages", () => {
    const messages = { ...drawerMessages, expand: "Mehr" }
    expect(
      ex({ resolved: [small, large], snapPoint: 0.4, messages }).handle(handleState)["aria-label"],
    ).toBe("Mehr")
  })
})

describe("indent", () => {
  it.each(["indent", "indent-background"] as const)("%s data-active follows the flag", (part) => {
    const on = drawerIndentProps(part, true)
    expect(on).toMatchObject({ "data-scope": "drawer", "data-part": part, "data-active": "" })
    expect(drawerIndentProps(part, false)["data-active"]).toBeUndefined()
  })
})

describe("the Dialog's attributes under scope drawer", () => {
  it("every part is scoped drawer", () => {
    const a = full()
    const btn = { id: "t1", focused: false, modality: "keyboard" as const, pressed: false }
    const parts = {
      trigger: a.trigger(btn),
      backdrop: a.backdrop(),
      positioner: a.positioner(),
      content: a.content({}),
      description: a.description(),
    }
    for (const [part, props] of Object.entries(parts)) {
      expect(props["data-scope"], part).toBe("drawer")
      expect(props["data-part"], part).toBe(part)
      expect(props["data-instance"], part).toBe("r")
    }
  })

  it("content is role dialog, modal, with the Dialog's ids", () => {
    const p = full().content({})
    expect(p["role"]).toBe("dialog")
    expect(p["tabindex"]).toBe(-1)
    expect(p["aria-modal"]).toBe("true")
    expect(p["aria-labelledby"]).toBe("drawer-r-title")
    expect(p["id"]).toBe("drawer-r-content")
  })

  it("a non-modal drawer has no aria-modal", () => {
    expect(full({ modal: false }).content({})["aria-modal"]).toBeUndefined()
  })

  it("the trigger keeps aria-haspopup=dialog and its critical aria-expanded", () => {
    const t = full().trigger({ id: "t1", focused: false, modality: "keyboard", pressed: false })
    expect(t["aria-haspopup"]).toBe("dialog")
    expect(t["aria-expanded"]).toBe("true")
    expect(t[CRITICAL]).toContain("aria-expanded")
  })

  it("content merges the drawer's attributes and style without losing the Dialog's", () => {
    const p = full({ swipe: "swiping", side: "left" }).content({})
    expect(p["data-side"]).toBe("left")
    expect(p["data-swiping"]).toBe("")
    expect(p["data-state"]).toBe("open")
    expect(style(p)["--rind-drawer-size"]).toBe("800px")
  })

  it("positioner and backdrop merge the drawer's attributes", () => {
    const a = full({ swipe: "swiping" })
    expect(a.positioner()["data-side"]).toBe("bottom")
    expect(a.positioner()["data-scope"]).toBe("drawer")
    expect(a.backdrop()["data-swiping"]).toBe("")
    expect(a.backdrop()["data-state"]).toBe("open")
  })
})
