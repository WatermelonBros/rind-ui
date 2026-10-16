// toolbarKeyAction (design §2, spec "Key Ownership"): which keydowns the toolbar acts on.
// Regressions: react-spectrum#7937, #8636, base-ui#4487, ariakit#7099.
import { describe, expect, it } from "vitest"
import { platforms } from "../../dom/platform"
import { type ToolbarKeyTarget, toolbarKeyAction } from "./toolbar.keys"

type Orientation = "horizontal" | "vertical"
const press = (
  key: string,
  over: Partial<{
    shift: boolean
    alt: boolean
    ctrl: boolean
    meta: boolean
    composing: boolean
    defaultPrevented: boolean
  }> = {},
) => ({
  key,
  code: key,
  shift: false,
  alt: false,
  ctrl: false,
  meta: false,
  repeat: false,
  composing: false,
  ...over,
})
const control: ToolbarKeyTarget = { isControl: true, textField: null }
const field = (value: number, start: number, end = start): ToolbarKeyTarget => ({
  isControl: true,
  textField: { value, start, end },
})
const act = (
  key: string,
  target: ToolbarKeyTarget = control,
  orientation: Orientation = "horizontal",
  dir: "ltr" | "rtl" = "ltr",
  over: Parameters<typeof press>[1] = {},
) => toolbarKeyAction(press(key, over), target, { orientation, dir, platform: platforms.linux })

describe("axis arrows", () => {
  it("horizontal: Right next, Left previous", () => {
    expect(act("ArrowRight")).toBe("next")
    expect(act("ArrowLeft")).toBe("previous")
  })
  it("vertical: Down next, Up previous", () => {
    expect(act("ArrowDown", control, "vertical")).toBe("next")
    expect(act("ArrowUp", control, "vertical")).toBe("previous")
  })
  it("rtl mirrors the horizontal axis only", () => {
    expect(act("ArrowLeft", control, "horizontal", "rtl")).toBe("next")
    expect(act("ArrowRight", control, "horizontal", "rtl")).toBe("previous")
    expect(act("ArrowDown", control, "vertical", "rtl")).toBe("next")
    expect(act("ArrowUp", control, "vertical", "rtl")).toBe("previous")
  })
  it("perpendicular arrows belong to the control (Select opens on ArrowDown)", () => {
    expect(act("ArrowUp")).toBeNull()
    expect(act("ArrowDown")).toBeNull()
    expect(act("ArrowLeft", control, "vertical")).toBeNull()
    expect(act("ArrowRight", control, "vertical")).toBeNull()
  })
  it("Home and End go to the ends in both orientations", () => {
    for (const o of ["horizontal", "vertical"] as const) {
      expect(act("Home", control, o)).toBe("first")
      expect(act("End", control, o)).toBe("last")
    }
  })
})

describe("keys the toolbar never owns", () => {
  it.each(["Enter", " ", "Escape", "Tab", "a", "PageDown", "PageUp", "F10"])("%s", (key) => {
    expect(act(key)).toBeNull()
  })
})

describe("guards", () => {
  it.each(["alt", "ctrl", "meta"] as const)("%s modifier: null for arrows, Home and End", (m) => {
    for (const key of ["ArrowRight", "ArrowLeft", "Home", "End"]) {
      expect(act(key, control, "horizontal", "ltr", { [m]: true })).toBeNull()
    }
  })
  it("composing (IME) is null", () => {
    expect(act("ArrowRight", control, "horizontal", "ltr", { composing: true })).toBeNull()
    expect(act("Home", control, "horizontal", "ltr", { composing: true })).toBeNull()
  })
  it("defaultPrevented by the control is respected", () => {
    expect(act("ArrowRight", control, "horizontal", "ltr", { defaultPrevented: true })).toBeNull()
    expect(act("End", control, "horizontal", "ltr", { defaultPrevented: true })).toBeNull()
  })
  it("a target that is not one of the toolbar's controls is ignored (popups, portals)", () => {
    const other: ToolbarKeyTarget = { isControl: false, textField: null }
    expect(act("ArrowRight", other)).toBeNull()
    expect(act("Home", other)).toBeNull()
  })
  it("Shift alone does not block arrows on a plain control", () => {
    expect(act("ArrowRight", control, "horizontal", "ltr", { shift: true })).toBe("next")
  })
})

describe("text field caret (react-spectrum#7937)", () => {
  // "hello": value 5.
  it("next only from the end, previous only from the start", () => {
    expect(act("ArrowRight", field(5, 5))).toBe("next")
    expect(act("ArrowLeft", field(5, 0))).toBe("previous")
  })
  it("caret in the middle: both arrows stay in the field", () => {
    expect(act("ArrowRight", field(5, 2))).toBeNull()
    expect(act("ArrowLeft", field(5, 2))).toBeNull()
  })
  it("caret at the start does not leave forward, at the end not backward", () => {
    expect(act("ArrowRight", field(5, 0))).toBeNull()
    expect(act("ArrowLeft", field(5, 5))).toBeNull()
  })
  it("empty value: the caret is at both ends", () => {
    expect(act("ArrowRight", field(0, 0))).toBe("next")
    expect(act("ArrowLeft", field(0, 0))).toBe("previous")
  })
  it("a selection keeps the arrow for the field, even when it touches an end", () => {
    expect(act("ArrowRight", field(5, 0, 5))).toBeNull()
    expect(act("ArrowLeft", field(5, 0, 5))).toBeNull()
    expect(act("ArrowRight", field(5, 3, 5))).toBeNull()
  })
  it("Shift+Arrow extends the selection: the field's", () => {
    expect(act("ArrowRight", field(5, 5), "horizontal", "ltr", { shift: true })).toBeNull()
    expect(act("ArrowLeft", field(5, 0), "horizontal", "ltr", { shift: true })).toBeNull()
  })
  it("rtl: the end an arrow points to is mirrored", () => {
    expect(act("ArrowLeft", field(5, 5), "horizontal", "rtl")).toBe("next")
    expect(act("ArrowRight", field(5, 0), "horizontal", "rtl")).toBe("previous")
    expect(act("ArrowLeft", field(5, 0), "horizontal", "rtl")).toBeNull()
  })
  it("vertical toolbar: same caret rules on ArrowDown / ArrowUp", () => {
    expect(act("ArrowDown", field(5, 5), "vertical")).toBe("next")
    expect(act("ArrowDown", field(5, 2), "vertical")).toBeNull()
    expect(act("ArrowUp", field(5, 0), "vertical")).toBe("previous")
  })
  it("Home and End belong to the field (react-spectrum#8636, base-ui#4487, ariakit#7099)", () => {
    for (const caret of [field(5, 0), field(5, 2), field(5, 5), field(0, 0)]) {
      expect(act("Home", caret)).toBeNull()
      expect(act("End", caret)).toBeNull()
    }
  })
})
