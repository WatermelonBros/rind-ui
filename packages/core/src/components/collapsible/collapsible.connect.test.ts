// Collapsible part props (spec "Disclosure Semantics", "Styling Attributes") in Node.
import { describe, expect, it } from "vitest"
import { CRITICAL } from "../../connect/props"
import { type CollapsibleConnectInput, collapsibleConnect } from "./collapsible.connect"

function make(over: Partial<CollapsibleConnectInput> = {}) {
  const input: CollapsibleConnectInput = {
    instance: "i1",
    open: false,
    reveal: null,
    disabled: false,
    focusableWhenDisabled: false,
    closedContent: "until-found",
    triggerTag: "button",
    triggerFocused: false,
    modality: "keyboard",
    pressed: false,
    hovered: false,
    triggerId: "t1",
    contentId: "c1",
    contentRendered: true,
    ...over,
  }
  // The link branch is not reached by a collapsible trigger: an empty environment is enough.
  return collapsibleConnect(input, {} as never)
}
const attr = (props: object, name: string) => (props as Record<string, unknown>)[name]

describe("trigger", () => {
  it("aria-expanded follows the open value", () => {
    expect(attr(make().trigger(), "aria-expanded")).toBe("false")
    expect(attr(make({ open: true }).trigger(), "aria-expanded")).toBe("true")
  })

  it("aria-controls only while the content is rendered", () => {
    expect(attr(make({ contentRendered: true }).trigger(), "aria-controls")).toBe("c1")
    expect(attr(make({ contentRendered: false }).trigger(), "aria-controls")).toBeUndefined()
  })

  it("is a native button of type button with its id", () => {
    expect(make().trigger()).toMatchObject({ type: "button", id: "t1" })
    expect(attr(make().trigger(), "role")).toBeUndefined()
  })

  it("disabled: native disabled, or aria-disabled and focusable with focusableWhenDisabled", () => {
    const native = make({ disabled: true }).trigger()
    expect(attr(native, "disabled")).toBe(true)
    expect(attr(native, "aria-disabled")).toBeUndefined()
    const focusable = make({ disabled: true, focusableWhenDisabled: true }).trigger()
    expect(attr(focusable, "disabled")).toBeUndefined()
    expect(attr(focusable, "aria-disabled")).toBe("true")
  })

  it("a span trigger gets role button and tabindex 0", () => {
    const p = make({ triggerTag: "span" }).trigger()
    expect(attr(p, "role")).toBe("button")
    expect(attr(p, "tabindex")).toBe(0)
  })

  it("a disabled span leaves the tab order unless focusableWhenDisabled", () => {
    const p = make({ triggerTag: "span", disabled: true }).trigger()
    expect(attr(p, "tabindex")).toBe(-1)
    expect(attr(p, "aria-disabled")).toBe("true")
    expect(
      attr(
        make({ triggerTag: "span", disabled: true, focusableWhenDisabled: true }).trigger(),
        "tabindex",
      ),
    ).toBe(0)
  })

  it("marks aria-expanded and aria-controls as critical", () => {
    expect(make().trigger()[CRITICAL]).toEqual(["aria-expanded", "aria-controls"])
  })

  it("data-pressed, data-hover, data-focus, data-focus-visible", () => {
    const off = make().trigger()
    for (const n of ["data-pressed", "data-hover", "data-focus", "data-focus-visible"]) {
      expect(attr(off, n)).toBeUndefined()
    }
    const on = make({
      pressed: true,
      hovered: true,
      triggerFocused: true,
      modality: "keyboard",
    }).trigger()
    expect(attr(on, "data-pressed")).toBe("")
    expect(attr(on, "data-hover")).toBe("")
    expect(attr(on, "data-focus")).toBe("")
    expect(attr(on, "data-focus-visible")).toBe("")
    const pointer = make({ triggerFocused: true, modality: "pointer" }).trigger()
    expect(attr(pointer, "data-focus")).toBe("")
    expect(attr(pointer, "data-focus-visible")).toBeUndefined()
  })
})

describe("content", () => {
  it("has an id, no role and no aria-hidden, in any state", () => {
    for (const hidden of [true, false]) {
      const p = make().content(hidden)
      expect(attr(p, "id")).toBe("c1")
      expect(attr(p, "role")).toBeUndefined()
      expect("aria-hidden" in p).toBe(false)
    }
  })

  it("hidden follows the parameter", () => {
    expect(attr(make().content(true), "hidden")).toBe(true)
    expect(attr(make().content(false), "hidden")).toBeUndefined()
  })

  it("data-reveal is present only while the context has one", () => {
    expect(attr(make({ reveal: "mount" }).content(false), "data-reveal")).toBe("mount")
    expect(attr(make({ reveal: "find-in-page" }).content(false), "data-reveal")).toBe(
      "find-in-page",
    )
    expect(attr(make({ reveal: null }).content(false), "data-reveal")).toBeUndefined()
  })
})

describe("indicator", () => {
  it("is aria-hidden", () => {
    expect(attr(make().indicator(), "aria-hidden")).toBe("true")
  })
})

describe("state attributes on every part", () => {
  it("scope, part, instance and data-state", () => {
    const api = make({ open: true })
    const parts = {
      root: api.root(),
      trigger: api.trigger(),
      content: api.content(false),
      indicator: api.indicator(),
    }
    for (const [part, p] of Object.entries(parts)) {
      expect(p).toMatchObject({
        "data-scope": "collapsible",
        "data-part": part,
        "data-instance": "i1",
        "data-state": "open",
      })
      expect(attr(p, "data-disabled")).toBeUndefined()
    }
    expect(make().root()).toMatchObject({ "data-state": "closed" })
  })

  it("open and disabled: every part has data-state open and data-disabled", () => {
    const api = make({ open: true, disabled: true })
    for (const p of [api.root(), api.trigger(), api.content(false), api.indicator()]) {
      expect(p).toMatchObject({ "data-state": "open", "data-disabled": "" })
    }
    expect(attr(api.trigger(), "aria-expanded")).toBe("true")
  })
})
