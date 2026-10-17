// Combobox scenarios (combobox + combobox-pattern specs) in a DOM.
import { Combobox } from "@rind-ui/react"
import { act, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { getCombobox } from "../index"

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

describe("Combobox driver", () => {
  const cb = () => getCombobox(screen, { name: "City" })

  it("pick a city by keyboard: type, choose, value and text", async () => {
    render(<City />)
    await cb().type("p")
    expect(await cb().items()).toEqual(["Paris", "Prague"])
    await cb().choose("Prague")
    expect(await cb().inputValue()).toBe("Prague")
    expect(await cb().value()).toEqual(["Prague"])
    expect(await cb().isOpen()).toBe(false)
  })

  it("open by keyboard and pointer; close with Escape", async () => {
    render(<City />)
    await cb().open()
    expect(await cb().isOpen()).toBe(true)
    await cb().close()
    expect(await cb().isOpen()).toBe(false)
  })

  it("composition through the driver: the composing Enter selects nothing", async () => {
    render(<City autoHighlight />)
    await cb().type("p")
    await cb().compose("r", false)
    await cb().pressEnter()
    expect(await cb().value()).toEqual([])
    expect(await cb().isOpen()).toBe(true)
  })

  it("isEmpty in the empty state", async () => {
    render(<City />)
    await cb().type("zz")
    expect(await cb().isEmpty()).toBe(true)
  })

  it("clear with the keyboard: select all, Delete, blur", async () => {
    render(
      <>
        <City defaultValue="rome" />
        <button type="button">After</button>
      </>,
    )
    await cb().clear()
    expect(await cb().value()).toEqual([])
  })
})

describe("Combobox forms", () => {
  const formData = (form: HTMLFormElement) =>
    [...new FormData(form).entries()].map(([k, v]) => `${k}=${v}`)

  it("the key is submitted, not the text", () => {
    render(
      <form data-testid="f">
        <City name="city" defaultValue="rome" />
      </form>,
    )
    expect(formData(screen.getByTestId("f") as HTMLFormElement)).toEqual(["city=rome"])
  })

  it("inputName submits the text too", () => {
    render(
      <form data-testid="f">
        <City name="city" inputName="cityText" defaultValue="rome" />
      </form>,
    )
    expect(formData(screen.getByTestId("f") as HTMLFormElement).sort()).toEqual([
      "city=rome",
      "cityText=Rome",
    ])
  })

  it("multiple values submitted, one entry per key", () => {
    render(
      <form data-testid="f">
        <City name="cities" multiple defaultValue={["rome", "paris"]} />
      </form>,
    )
    expect(formData(screen.getByTestId("f") as HTMLFormElement)).toEqual([
      "cities=rome",
      "cities=paris",
    ])
  })

  it("required and empty: invalid; focus moves to the visible input", async () => {
    render(
      <form data-testid="f">
        <City name="city" required />
      </form>,
    )
    const form = screen.getByTestId("f") as HTMLFormElement
    expect(form.checkValidity()).toBe(false)
    const hidden = form.querySelector('[data-part="hidden-input"]') as HTMLInputElement
    act(() => hidden.focus())
    await waitFor(() => expect(document.activeElement).toBe(input()))
  })

  it("required with a selection is valid", () => {
    render(
      <form data-testid="f">
        <City name="city" required defaultValue="rome" />
      </form>,
    )
    expect((screen.getByTestId("f") as HTMLFormElement).checkValidity()).toBe(true)
  })

  it("reset restores the default value and its text", async () => {
    render(
      <form data-testid="f">
        <City name="city" defaultValue="paris" />
      </form>,
    )
    const cb = getCombobox(screen, { name: "City" })
    await cb.choose("Rome")
    expect(input().value).toBe("Rome")
    act(() => (screen.getByTestId("f") as HTMLFormElement).reset())
    await waitFor(() => expect(input().value).toBe("Paris"))
    expect(formData(screen.getByTestId("f") as HTMLFormElement)).toEqual(["city=paris"])
  })

  it("browser autofill of the hidden input selects by key, else by text", async () => {
    render(
      <form data-testid="f">
        <City name="city" />
      </form>,
    )
    const hidden = screen
      .getByTestId("f")
      .querySelector('[data-part="hidden-input"]') as HTMLInputElement
    act(() => {
      hidden.value = "Prague"
      hidden.dispatchEvent(new Event("input", { bubbles: true }))
    })
    await waitFor(() => expect(input().value).toBe("Prague"))
    expect(formData(screen.getByTestId("f") as HTMLFormElement)).toEqual(["city=prague"])
  })

  it("a user choice dispatches input and change on the hidden input", async () => {
    const onChange = vi.fn()
    render(
      <form data-testid="f" onChange={onChange}>
        <City name="city" />
      </form>,
    )
    await getCombobox(screen, { name: "City" }).choose("Paris")
    await waitFor(() => expect(onChange).toHaveBeenCalled())
  })
})

describe("Combobox label activation", () => {
  it("a Label click focuses the input and does not open it, also with openOnInputPress", async () => {
    render(<City openOnInputPress />)
    const { userEvent } = await import("@testing-library/user-event")
    await userEvent.setup().click(screen.getByText("City"))
    expect(document.activeElement).toBe(input())
    expect(input().getAttribute("aria-expanded")).toBe("false")
  })

  it("a direct press on the input opens with openOnInputPress", async () => {
    render(<City openOnInputPress />)
    const { userEvent } = await import("@testing-library/user-event")
    await userEvent.setup().click(input())
    expect(input().getAttribute("aria-expanded")).toBe("true")
  })

  it("wrapped in a label: trigger opens, an option is chosen, it does not reopen", async () => {
    render(
      // biome-ignore lint/a11y/noLabelWithoutControl: the wrapping-label case under test
      <label>
        Wrapper
        <City />
      </label>,
    )
    const { userEvent } = await import("@testing-library/user-event")
    const u = userEvent.setup()
    await u.click(screen.getByRole("button", { name: "Show suggestions" }))
    await waitFor(() => expect(document.querySelector("[data-placing]")).toBe(null))
    await u.click(screen.getByRole("option", { name: "Paris" }))
    expect(input().value).toBe("Paris")
    await waitFor(() => expect(input().getAttribute("aria-expanded")).toBe("false"))
    expect(screen.queryByRole("listbox")).toBe(null)
  })
})
