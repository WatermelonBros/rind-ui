// More Combobox scenarios: controlled text, inside a modal dialog, static items, separator,
// two side by side, in a Portal (tasks 4.2, 4.3, A.1).
import { Combobox, Dialog, Portal } from "@rind-ui/react"
import { act, render, screen, waitFor } from "@testing-library/react"
import { type ReactNode, useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { getCombobox } from "../index"

const ITEMS = [
  { key: "rome", label: "Rome" },
  { key: "paris", label: "Paris" },
]

function Box({
  label = "City",
  portal = false,
  children,
  ...props
}: Record<string, unknown> & { label?: string; portal?: boolean; children?: ReactNode }) {
  const popup = (
    <Combobox.Positioner>
      <Combobox.Popup>
        <Combobox.List>{children ?? <Combobox.Items />}</Combobox.List>
      </Combobox.Popup>
    </Combobox.Positioner>
  )
  return (
    <Combobox.Root {...(children ? {} : { items: ITEMS })} {...props}>
      <Combobox.Label>{label}</Combobox.Label>
      <Combobox.Control>
        <Combobox.Input />
        <Combobox.Trigger />
      </Combobox.Control>
      {portal ? <Portal>{popup}</Portal> : popup}
    </Combobox.Root>
  )
}

const input = (name = "City") => screen.getByRole("combobox", { name }) as HTMLInputElement
const key = (k: string) => {
  const e = new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true })
  act(() => {
    document.activeElement?.dispatchEvent(e)
  })
  return e
}

describe("Combobox: controlled text", () => {
  it("a parent ignoring onInputValueChange keeps its text in the input", async () => {
    const onInputValueChange = vi.fn()
    render(<Box inputValue="Ro" onInputValueChange={onInputValueChange} />)
    const { userEvent } = await import("@testing-library/user-event")
    await userEvent.setup().type(input(), "x")
    expect(onInputValueChange).toHaveBeenCalledWith("Rox", expect.anything())
    expect(input().value).toBe("Ro")
  })

  it("a parent mirroring the text agrees after an outside press reverts it", async () => {
    let parentText = ""
    function Mirror() {
      const [text, setText] = useState("")
      parentText = text
      return (
        <>
          <Box defaultValue="rome" inputValue={text || undefined} onInputValueChange={setText} />
          <button type="button">Outside</button>
        </>
      )
    }
    render(<Mirror />)
    const cb = getCombobox(screen, { name: "City" })
    await cb.type("x")
    const { userEvent } = await import("@testing-library/user-event")
    await userEvent.setup().click(screen.getByRole("button", { name: "Outside" }))
    await waitFor(() => expect(input().value).toBe("Rome"))
    expect(parentText).toBe("Rome")
  })
})

describe("Combobox inside a modal dialog", () => {
  const inDialog = () =>
    render(
      <Dialog.Root defaultOpen>
        <Dialog.Positioner style={{ position: "fixed", inset: 0 }}>
          <Dialog.Content>
            <Dialog.Title>Pick</Dialog.Title>
            <Box defaultValue="rome" />
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>,
    )

  it("Escape with the popup open closes only the popup; the next Escape closes the dialog", async () => {
    inDialog()
    const cb = getCombobox(screen, { name: "City" })
    await cb.open()
    expect(key("Escape").defaultPrevented).toBe(true)
    await waitFor(() => expect(input().getAttribute("aria-expanded")).toBe("false"))
    expect(screen.getByRole("dialog")).toBeTruthy()
    // Nothing to revert: this Escape is the dialog's.
    key("Escape")
    await waitFor(() => expect(screen.queryByRole("dialog")).toBe(null))
  })

  it("an option chosen inside the dialog works with the pointer", async () => {
    inDialog()
    await getCombobox(screen, { name: "City" }, { modality: "pointer" }).choose("Paris")
    expect(input().value).toBe("Paris")
    expect(screen.getByRole("dialog")).toBeTruthy()
  })
})

describe("Combobox static items", () => {
  it("static items filter; hidden ones keep their place; a separator is role none", async () => {
    render(
      <Box>
        <Combobox.Group section={{ key: "it", label: "Italy" }}>
          <Combobox.Item value="rome">Rome</Combobox.Item>
          <Combobox.Item value="milan">Milan</Combobox.Item>
        </Combobox.Group>
        <Combobox.Separator />
        <Combobox.Group section={{ key: "fr", label: "France" }}>
          <Combobox.Item value="paris">Paris</Combobox.Item>
        </Combobox.Group>
      </Box>,
    )
    const cb = getCombobox(screen, { name: "City" })
    await cb.open()
    expect(await cb.items()).toEqual(["Rome", "Milan", "Paris"])
    expect(document.querySelector('[data-part="separator"]')?.getAttribute("role")).toBe("none")
    await cb.type("mi")
    expect(await cb.items()).toEqual(["Milan"])
    // France has no match: its group is hidden.
    expect(screen.queryByRole("group", { name: "France" })).toBe(null)
    await cb.choose("Milan")
    expect(input().value).toBe("Milan")
  })
})

describe("Combobox: two side by side, and in a Portal", () => {
  it("two comboboxes keep separate state and ids", async () => {
    render(
      <>
        <Box label="From" />
        <Box label="To" />
      </>,
    )
    await getCombobox(screen, { name: "From" }).choose("Rome")
    await getCombobox(screen, { name: "To" }).choose("Paris")
    expect(input("From").value).toBe("Rome")
    expect(input("To").value).toBe("Paris")
    expect(input("From").id).not.toBe(input("To").id)
  })

  it("a portalled popup keeps every behaviour", async () => {
    render(<Box portal />)
    const cb = getCombobox(screen, { name: "City" }, { modality: "pointer" })
    await cb.choose("Paris")
    expect(input().value).toBe("Paris")
    expect(document.activeElement).toBe(input())
  })
})
