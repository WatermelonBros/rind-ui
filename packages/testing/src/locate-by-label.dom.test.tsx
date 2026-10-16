// The `{ label }` locator in the DOM adapter: exact names only, through a <label>,
// aria-label and aria-labelledby (the pw twin is in fixtures/password-input).
import { PasswordInput } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { LabelledFields, labelledValues } from "../fixtures/password-input/labels"
import { getPasswordInput } from "./index"

describe("By { label }", () => {
  it("resolves the exact name, never a prefix of a longer one", async () => {
    render(
      <>
        <PasswordInput.Root>
          <PasswordInput.Label>Password</PasswordInput.Label>
          <PasswordInput.Input />
        </PasswordInput.Root>
        <LabelledFields />
      </>,
    )
    expect(await getPasswordInput(screen, { name: "Password" }).value()).toBe("")
    for (const [name, value] of Object.entries(labelledValues)) {
      expect(await getPasswordInput(screen, { name }).value(), name).toBe(value)
    }
  })

  it("a missing name says which label it looked for", async () => {
    render(<LabelledFields />)
    await expect(getPasswordInput(screen, { name: "Password" }).value()).rejects.toThrow(
      /labelled "Password"/,
    )
  })
})
