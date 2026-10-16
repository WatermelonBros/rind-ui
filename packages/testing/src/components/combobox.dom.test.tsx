// Combobox scenarios (combobox + combobox-pattern specs) in a DOM.
import { Combobox } from "@rind-ui/react"
import { act, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

const CITIES = [
  { key: "rome", label: "Rome" },
  { key: "paris", label: "Paris" },
  { key: "prague", label: "Prague" },
  { key: "oslo", label: "Oslo", disabled: true },
]

function City(props: Partial<Parameters<typeof Combobox.Root>[0]> & { label?: string }) {
  const { label = "City", ...rest } = props
  return (
    <Combobox.Root items={CITIES} {...(rest as object)}>
      <Combobox.Label>{label}</Combobox.Label>
      <Combobox.Control>
        <Combobox.Input />
        <Combobox.Trigger />
        <Combobox.ClearTrigger />
      </Combobox.Control>
      <Combobox.Positioner>
        <Combobox.Popup>
          <Combobox.List>
            <Combobox.Items />
          </Combobox.List>
          <Combobox.Empty>No results</Combobox.Empty>
        </Combobox.Popup>
      </Combobox.Positioner>
    </Combobox.Root>
  )
}

const input = () => screen.getByRole("combobox", { name: "City" }) as HTMLInputElement
const key = (k: string, o: KeyboardEventInit = {}) => {
  const e = new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...o })
  act(() => {
    input().dispatchEvent(e)
  })
  return e
}
async function type(text: string) {
  const { userEvent } = await import("@testing-library/user-event")
  await userEvent.setup().type(input(), text)
}

describe("Combobox", () => {
  it("minimal combobox: role, name, closed", () => {
    render(<City />)
    expect(input().getAttribute("aria-expanded")).toBe("false")
    expect(input().getAttribute("aria-autocomplete")).toBe("list")
    expect(input().getAttribute("autocomplete")).toBe("off")
    expect(input().hasAttribute("aria-controls")).toBe(false)
  })

  it("typing filters; the listbox is named by the label; no active descendant", async () => {
    render(<City />)
    await type("pr")
    expect(input().getAttribute("aria-expanded")).toBe("true")
    const lb = screen.getByRole("listbox", { name: "City" })
    expect(input().getAttribute("aria-controls")).toBe(lb.id)
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Prague"])
    expect(input().hasAttribute("aria-activedescendant")).toBe(false)
  })

  it("ArrowDown opens on the first option; Enter chooses it, prevented, focus stays", async () => {
    const onValueChange = vi.fn()
    render(<City onValueChange={onValueChange} />)
    act(() => input().focus())
    key("ArrowDown")
    const rome = screen.getByRole("option", { name: "Rome" })
    expect(input().getAttribute("aria-activedescendant")).toBe(rome.id)
    expect(rome.hasAttribute("data-focus-visible")).toBe(true)
    const e = key("Enter")
    expect(e.defaultPrevented).toBe(true)
    expect(onValueChange).toHaveBeenCalledWith("rome", { reason: "enter" })
    expect(input().value).toBe("Rome")
    await waitFor(() => expect(input().getAttribute("aria-expanded")).toBe("false"))
    expect(document.activeElement).toBe(input())
  })

  it("click an option: chosen, input keeps focus", async () => {
    render(<City />)
    await type("pa")
    await waitFor(() => expect(document.querySelector("[data-placing]")).toBe(null))
    const { userEvent } = await import("@testing-library/user-event")
    await userEvent.setup().click(screen.getByRole("option", { name: "Paris" }))
    expect(input().value).toBe("Paris")
    expect(document.activeElement).toBe(input())
  })

  it("empty state: aria-expanded false, Empty outside the listbox", async () => {
    render(<City />)
    await type("zz")
    expect(input().getAttribute("aria-expanded")).toBe("false")
    const empty = screen.getByText("No results")
    expect(empty.closest('[role="listbox"]')).toBe(null)
  })

  it("Escape closes and reverts; a second Escape is not prevented", async () => {
    render(<City defaultValue="rome" />)
    expect(input().value).toBe("Rome")
    await type("x")
    expect(key("Escape").defaultPrevented).toBe(true)
    expect(input().value).toBe("Rome")
    expect(key("Escape").defaultPrevented).toBe(false)
  })

  it("item data-state checked / unchecked; aria-selected explicit", async () => {
    render(<City defaultValue="paris" />)
    act(() => input().focus())
    key("ArrowDown")
    const paris = screen.getByRole("option", { name: "Paris" })
    expect(paris.getAttribute("data-state")).toBe("checked")
    expect(paris.getAttribute("aria-selected")).toBe("true")
    expect(screen.getByRole("option", { name: "Rome" }).getAttribute("aria-selected")).toBe("false")
  })

  it("clear: text and value empty, one callback each, focus in the input", async () => {
    const onValueChange = vi.fn()
    const onInputValueChange = vi.fn()
    render(
      <City
        defaultValue="rome"
        onValueChange={onValueChange}
        onInputValueChange={onInputValueChange}
      />,
    )
    act(() => input().focus())
    const { userEvent } = await import("@testing-library/user-event")
    await userEvent.setup().click(screen.getByRole("button", { name: "Clear" }))
    expect(input().value).toBe("")
    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(onInputValueChange).toHaveBeenCalledTimes(1)
    expect(document.activeElement).toBe(input())
  })
})
