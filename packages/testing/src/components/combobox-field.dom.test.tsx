// Combobox in a Field (combobox "Field Control Binding", task A.3).
import { Combobox, Field } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { getCombobox } from "../index"

const ITEMS = [
  { key: "rome", label: "Rome" },
  { key: "paris", label: "Paris" },
]

function Box(props: Record<string, unknown>) {
  return (
    <Combobox.Root items={ITEMS} {...props}>
      <Combobox.Control>
        <Combobox.Input />
        <Combobox.Trigger />
      </Combobox.Control>
      <Combobox.Positioner>
        <Combobox.Popup>
          <Combobox.List>
            <Combobox.Items />
          </Combobox.List>
        </Combobox.Popup>
      </Combobox.Positioner>
    </Combobox.Root>
  )
}

const input = () => screen.getByRole("combobox") as HTMLInputElement

describe("Combobox Field binding", () => {
  it("named by the Field's Label; invalid Field: aria-invalid and the error on the input only", () => {
    render(
      <Field.Root invalid>
        <Field.Label>City</Field.Label>
        <Box />
        <Field.Description>Where you live</Field.Description>
        <Field.ErrorMessage>Pick one</Field.ErrorMessage>
      </Field.Root>,
    )
    expect(screen.getByRole("combobox", { name: "City" })).toBe(input())
    expect(input().getAttribute("aria-invalid")).toBe("true")
    const described = input().getAttribute("aria-describedby") ?? ""
    expect(described).toContain(screen.getByText("Pick one").id)
    expect(described).toContain(screen.getByText("Where you live").id)
    // Only the registered input: nothing else in the control carries the Field's wiring.
    const others = document.querySelectorAll('[aria-invalid="true"]')
    expect([...others]).toEqual([input()])
  })

  it("a disabled Field disables it exactly like its own disabled, and it does not open", async () => {
    render(
      <Field.Root disabled>
        <Field.Label>City</Field.Label>
        <Box />
      </Field.Root>,
    )
    expect(input().disabled).toBe(true)
    expect(
      (screen.getByRole("button", { name: "Show suggestions" }) as HTMLButtonElement).disabled,
    ).toBe(true)
    expect(input().getAttribute("aria-expanded")).toBe("false")
  })

  const matrix = [
    { prop: "disabled", check: (i: HTMLInputElement) => i.disabled },
    { prop: "readOnly", check: (i: HTMLInputElement) => i.readOnly },
    {
      prop: "required",
      check: () =>
        (document.querySelector('[data-part="hidden-input"]') as HTMLInputElement).required,
    },
    { prop: "invalid", check: (i: HTMLInputElement) => i.getAttribute("aria-invalid") === "true" },
  ] as const
  for (const { prop, check } of matrix) {
    for (const where of ["field", "combobox", "neither"] as const) {
      it(`Field prop × control: ${prop} on ${where}`, () => {
        const on = { [prop]: true }
        render(
          <Field.Root {...(where === "field" ? on : {})}>
            <Field.Label>City</Field.Label>
            <Box {...(where === "combobox" ? on : {})} />
          </Field.Root>,
        )
        expect(check(input())).toBe(where !== "neither")
      })
    }
  }

  it("works with the driver by the Field's label", async () => {
    render(
      <Field.Root>
        <Field.Label>City</Field.Label>
        <Box />
      </Field.Root>,
    )
    const cb = getCombobox(screen, { name: "City" })
    await cb.choose("Paris")
    expect(await cb.inputValue()).toBe("Paris")
  })
})
