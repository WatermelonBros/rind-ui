// The field-associated trait (field-control "Field-Associated Trait"): a control inside a
// Field follows it; a broken control that ignores the Field's disabled fails, naming it.

import { mergeFieldProps } from "@rind-ui/core"
import { Field, useFieldControl } from "@rind-ui/react"
import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { collectDom } from "./collect"
import { traitInvariants } from "./invariants"

function Control({ ignoreDisabled = false }: { readonly ignoreDisabled?: boolean }) {
  const binding = useFieldControl()
  const f = mergeFieldProps({ role: "textbox", labelable: true }, binding)
  return (
    <input
      data-scope="probe"
      data-part="input"
      data-instance="p"
      id={binding?.controlId}
      disabled={!ignoreDisabled && f.disabled}
      aria-describedby={f["aria-describedby"]}
    />
  )
}

const check = () => {
  const snap = collectDom({ scope: "probe", instance: "p" })
  return traitInvariants["field-associated"]?.({ after: snap } as never) ?? []
}

describe("field-associated trait", () => {
  it("a control that follows its Field passes", () => {
    render(
      <Field.Root disabled>
        <Field.Label>Email</Field.Label>
        <Control />
        <Field.Description>Help</Field.Description>
      </Field.Root>,
    )
    expect(check()).toEqual([])
  })

  it("Broken control ignores the Field: fails on disabled", () => {
    render(
      <Field.Root disabled>
        <Field.Label>Email</Field.Label>
        <Control ignoreDisabled />
      </Field.Root>,
    )
    expect(check().join("\n")).toMatch(/disabled disagrees with the Field's data-disabled/)
  })

  it("outside a Field it checks nothing", () => {
    render(<Control />)
    expect(check()).toEqual([])
  })
})
