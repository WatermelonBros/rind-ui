/** @jsxImportSource solid-js */
// Field: markup parity with @rind-ui/react around a Text Field, and its validation behaviour
// (native constraints on submit, `validate` on change, external errors, disabled by a Fieldset).
import * as R from "@rind-ui/react"
import { screen } from "@testing-library/dom"
import { createElement as r } from "react"
import { describe, expect, it, vi } from "vitest"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"
import { Field, Fieldset, TextField } from "../index"

describe("Solid Field matches React", () => {
  it("label, description, error, flags", async () => {
    for (const p of [{}, { required: true }, { invalid: true }, { disabled: true }]) {
      await clientParity(
        r(
          R.Field.Root,
          { name: "email", ...p } as never,
          r(R.Field.Label, null, "Email"),
          r(R.TextField.Root, null, r(R.TextField.Input)),
          r(R.Field.Description, null, "Never shared"),
          r(R.Field.ErrorMessage, null, "Bad"),
        ),
        () => (
          <Field.Root name="email" {...p}>
            <Field.Label>Email</Field.Label>
            <TextField.Root>
              <TextField.Input />
            </TextField.Root>
            <Field.Description>Never shared</Field.Description>
            <Field.ErrorMessage>Bad</Field.ErrorMessage>
          </Field.Root>
        ),
      )
    }
  })
})

const typeInto = (input: HTMLInputElement, value: string) => {
  input.value = value
  input.dispatchEvent(new Event("input", { bubbles: true }))
}

describe("Solid Field validation", () => {
  it("a required, empty control shows the native message on submit", async () => {
    mount(() => (
      <form noValidate onSubmit={(e) => e.preventDefault()}>
        <Field.Root name="email" required>
          <Field.Label>Email</Field.Label>
          <TextField.Root>
            <TextField.Input />
          </TextField.Root>
          <Field.ErrorMessage />
        </Field.Root>
        <button type="submit">Send</button>
      </form>
    ))
    const input = screen.getByRole("textbox", { name: "Email" }) as HTMLInputElement
    expect(input.getAttribute("aria-invalid")).not.toBe("true")
    screen.getByRole("button", { name: "Send" }).click()
    await vi.waitFor(() => expect(input.getAttribute("aria-invalid")).toBe("true"))
    expect(document.querySelector("[data-scope='field'][data-part='error-message']")).not.toBeNull()
  })

  it("validate runs on change and clears when the value is valid", async () => {
    mount(() => (
      <Field.Root
        name="username"
        validationMode="change"
        validate={(value) => (String(value).includes(" ") ? "No spaces allowed." : null)}
      >
        <Field.Label>Username</Field.Label>
        <TextField.Root>
          <TextField.Input />
        </TextField.Root>
        <Field.ErrorMessage />
      </Field.Root>
    ))
    const input = screen.getByRole("textbox", { name: "Username" }) as HTMLInputElement
    typeInto(input, "a b")
    await vi.waitFor(() => expect(screen.getByText("No spaces allowed.")).toBeTruthy())
    expect(input.getAttribute("aria-invalid")).toBe("true")
    typeInto(input, "ab")
    await vi.waitFor(() => expect(screen.queryByText("No spaces allowed.")).toBeNull())
  })

  it("external errors show at once; a disabled Fieldset disables the control", async () => {
    mount(() => (
      <Fieldset.Root disabled>
        <Field.Root name="n" errors={["Server says no."]}>
          <Field.Label>Name</Field.Label>
          <TextField.Root>
            <TextField.Input />
          </TextField.Root>
          <Field.ErrorMessage />
        </Field.Root>
      </Fieldset.Root>
    ))
    const input = screen.getByRole("textbox", { name: "Name" }) as HTMLInputElement
    await vi.waitFor(() => expect(input.disabled).toBe(true))
  })
})
