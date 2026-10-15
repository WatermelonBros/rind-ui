// mergeFieldProps (field-control spec): booleans OR'ed, describedby order, no dangling ids.
import { describe, expect, it } from "vitest"
import type { FieldControlBinding, FieldControlOwn } from "./field-control"
import { mergeFieldProps } from "./field-control"

const own = (over: Partial<FieldControlOwn> = {}): FieldControlOwn => ({
  role: "textbox",
  labelable: true,
  ...over,
})

function binding(over: {
  state?: Partial<FieldControlBinding["state"]>
  ids?: FieldControlBinding["ids"]
  errorMessageAttribute?: "describedby" | "both"
  name?: string
}): FieldControlBinding {
  return {
    ids: over.ids ?? {},
    state: {
      disabled: false,
      readOnly: false,
      required: false,
      invalid: false,
      validationBehavior: "native",
      ...over.state,
    },
    data: {},
    name: over.name,
    controlId: "ctl",
    errorMessageAttribute: over.errorMessageAttribute ?? "describedby",
    claim: () => true,
    release: () => {},
    register: () => () => {},
    report: () => {},
  }
}

const ids = { label: "lbl", description: "desc", error: "err" }

describe("booleans are OR'ed", () => {
  it.each(["disabled", "readOnly", "required", "invalid"] as const)(
    "%s: the control's own prop or the Field's",
    (key) => {
      expect(mergeFieldProps(own(), null)[key]).toBe(false)
      expect(mergeFieldProps(own({ [key]: true }), null)[key]).toBe(true)
      expect(mergeFieldProps(own(), binding({ state: { [key]: true } }))[key]).toBe(true)
      expect(mergeFieldProps(own({ [key]: true }), binding({ state: { [key]: true } }))[key]).toBe(
        true,
      )
      // A control's explicit false does not cancel the Field's true.
      expect(mergeFieldProps(own({ [key]: false }), binding({ state: { [key]: true } }))[key]).toBe(
        true,
      )
    },
  )

  it("without a Field the control's own props are used as given", () => {
    const merged = mergeFieldProps(own({ disabled: true, name: "email" }), null)
    expect(merged).toMatchObject({ disabled: true, name: "email" })
    expect(merged["aria-describedby"]).toBeUndefined()
    expect(merged["aria-labelledby"]).toBeUndefined()
  })
})

describe("aria-describedby", () => {
  it("lists description, error (while invalid), own ids, consumer ids, in that order", () => {
    const merged = mergeFieldProps(
      own({ describedBy: "own", consumerDescribedBy: "mine" }),
      binding({ ids, state: { invalid: true } }),
    )
    expect(merged["aria-describedby"]).toBe("desc err own mine")
  })

  it("leaves out the error while the Field is not invalid (react-spectrum#2330)", () => {
    const merged = mergeFieldProps(own({ consumerDescribedBy: "mine" }), binding({ ids }))
    expect(merged["aria-describedby"]).toBe("desc mine")
  })

  it("leaves out parts that are not rendered", () => {
    const merged = mergeFieldProps(
      own(),
      binding({ ids: { error: "err" }, state: { invalid: true } }),
    )
    expect(merged["aria-describedby"]).toBe("err")
  })

  it("is undefined, never an empty string, when nothing is listed (ark#3824)", () => {
    for (const b of [null, binding({}), binding({ ids: { label: "lbl" } })]) {
      expect(mergeFieldProps(own(), b)["aria-describedby"]).toBeUndefined()
      expect(mergeFieldProps(own({ describedBy: "", consumerDescribedBy: "" }), b)).toHaveProperty(
        "aria-describedby",
        undefined,
      )
    }
  })

  it("an invalid control's own invalid prop lists the Field's error too", () => {
    const merged = mergeFieldProps(own({ invalid: true }), binding({ ids }))
    expect(merged["aria-describedby"]).toBe("desc err")
  })
})

describe("aria-labelledby and the name", () => {
  it("a labelable control is named by the Label's for: no aria-labelledby", () => {
    expect(mergeFieldProps(own({ labelable: true }), binding({ ids }))["aria-labelledby"]).toBe(
      undefined,
    )
  })

  it("a non-labelable control points at the Label only", () => {
    const merged = mergeFieldProps(
      own({ labelable: false, role: "radiogroup" }),
      binding({ ids, state: { invalid: true } }),
    )
    expect(merged["aria-labelledby"]).toBe("lbl")
  })

  it("the error is never in aria-labelledby (kobalte#534)", () => {
    const merged = mergeFieldProps(
      own({ labelable: false }),
      binding({ ids, state: { invalid: true } }),
    )
    expect(merged["aria-labelledby"]).not.toContain("err")
    expect(merged["aria-labelledby"]).not.toContain("desc")
  })

  it("a consumer aria-label means no aria-labelledby", () => {
    const merged = mergeFieldProps(own({ labelable: false, ariaLabel: "Search" }), binding({ ids }))
    expect(merged["aria-labelledby"]).toBeUndefined()
  })

  it("a consumer aria-labelledby is used as given", () => {
    const merged = mergeFieldProps(
      own({ labelable: false, ariaLabelledBy: "mine" }),
      binding({ ids }),
    )
    expect(merged["aria-labelledby"]).toBe("mine")
  })

  it("no Label rendered: no aria-labelledby at all (ark#3824)", () => {
    const merged = mergeFieldProps(own({ labelable: false, ariaLabel: "Search" }), binding({}))
    expect(merged["aria-labelledby"]).toBeUndefined()
    expect(mergeFieldProps(own({ labelable: false }), binding({}))["aria-labelledby"]).toBe(
      undefined,
    )
  })
})

describe("aria-invalid", () => {
  it("is set when invalid, by role", () => {
    for (const role of ["textbox", "combobox", "checkbox", "radiogroup", "slider", "spinbutton"]) {
      const merged = mergeFieldProps(own({ role }), binding({ state: { invalid: true } }))
      expect(merged["aria-invalid"]).toBe("true")
    }
  })

  it("is absent while valid", () => {
    expect(mergeFieldProps(own(), binding({}))["aria-invalid"]).toBeUndefined()
  })

  it("is never set on role button (react-spectrum#8382); invalid and the error id still are", () => {
    const merged = mergeFieldProps(
      own({ role: "button" }),
      binding({ ids, state: { invalid: true } }),
    )
    expect(merged["aria-invalid"]).toBeUndefined()
    expect(merged.invalid).toBe(true)
    expect(merged["aria-describedby"]).toBe("desc err")
  })

  it("a Select trigger is a button element with role combobox: it gets aria-invalid", () => {
    const merged = mergeFieldProps(own({ role: "combobox" }), binding({ state: { invalid: true } }))
    expect(merged["aria-invalid"]).toBe("true")
  })
})

describe("aria-errormessage", () => {
  const invalid = { ids, state: { invalid: true } }

  it("is absent by default: the error is in aria-describedby only (ark#4150)", () => {
    const merged = mergeFieldProps(own(), binding(invalid))
    expect(merged["aria-errormessage"]).toBeUndefined()
    expect(merged["aria-describedby"]).toContain("err")
  })

  it('in "both" it is the error id while invalid', () => {
    const merged = mergeFieldProps(own(), binding({ ...invalid, errorMessageAttribute: "both" }))
    expect(merged["aria-errormessage"]).toBe("err")
    expect(merged["aria-describedby"]).toContain("err")
  })

  it('in "both" it is absent while valid', () => {
    const merged = mergeFieldProps(
      own(),
      binding({ ids, errorMessageAttribute: "both", state: { invalid: false } }),
    )
    expect(merged["aria-errormessage"]).toBeUndefined()
  })

  it('in "both" it is absent when no ErrorMessage is rendered', () => {
    const merged = mergeFieldProps(
      own(),
      binding({
        ids: { description: "desc" },
        errorMessageAttribute: "both",
        state: { invalid: true },
      }),
    )
    expect(merged["aria-errormessage"]).toBeUndefined()
  })

  it('in "both" it is absent on role button (no aria-invalid there)', () => {
    const merged = mergeFieldProps(
      own({ role: "button" }),
      binding({ ...invalid, errorMessageAttribute: "both" }),
    )
    expect(merged["aria-errormessage"]).toBeUndefined()
  })
})

describe("behaviour: native or aria", () => {
  it("native: required is the attribute, no aria-required", () => {
    const merged = mergeFieldProps(own(), binding({ state: { required: true } }))
    expect(merged.required).toBe(true)
    expect(merged["aria-required"]).toBeUndefined()
  })

  it("aria: aria-required and no required attribute", () => {
    const merged = mergeFieldProps(
      own(),
      binding({ state: { required: true, validationBehavior: "aria" } }),
    )
    expect(merged.required).toBe(false)
    expect(merged["aria-required"]).toBe("true")
  })

  it("aria: the control's own required prop follows the same rule", () => {
    const merged = mergeFieldProps(
      own({ required: true }),
      binding({ state: { validationBehavior: "aria" } }),
    )
    expect(merged).toMatchObject({ required: false, "aria-required": "true" })
  })

  it("not required: neither", () => {
    const merged = mergeFieldProps(own(), binding({ state: { validationBehavior: "aria" } }))
    expect(merged.required).toBe(false)
    expect(merged["aria-required"]).toBeUndefined()
  })
})

describe("name", () => {
  it("falls back to the Field's name", () => {
    expect(mergeFieldProps(own(), binding({ name: "email" })).name).toBe("email")
  })
  it("the control's own name wins", () => {
    expect(mergeFieldProps(own({ name: "mine" }), binding({ name: "email" })).name).toBe("mine")
  })
  it("is undefined when neither has one", () => {
    expect(mergeFieldProps(own(), binding({})).name).toBeUndefined()
  })
})
