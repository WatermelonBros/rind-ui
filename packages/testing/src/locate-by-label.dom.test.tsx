// The `{ label }` locator in the DOM adapter: exact names only, through a <label>,
// aria-label and aria-labelledby (the pw twin is in fixtures/text-field-password).
import { TextField } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { LabelledFields, labelledValues } from "../fixtures/text-field-password/labels"
import { getTextField } from "./index"

describe("By { label }", () => {
  it("resolves the exact name, never a prefix of a longer one", async () => {
    render(
      <>
        <TextField.Root type="password">
          <TextField.Label>Password</TextField.Label>
          <TextField.Input />
        </TextField.Root>
        <LabelledFields />
      </>,
    )
    expect(await getTextField(screen, { name: "Password" }).value()).toBe("")
    for (const [name, value] of Object.entries(labelledValues)) {
      expect(await getTextField(screen, { name }).value(), name).toBe(value)
    }
  })

  it("a missing name says which label it looked for", async () => {
    render(<LabelledFields />)
    await expect(getTextField(screen, { name: "Password" }).value()).rejects.toThrow(
      /labelled "Password"/,
    )
  })
})
