// Select scenarios (openspec add-select) through the select driver, in jsdom and real browsers.
import { Select, type SelectRootProps } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { getSelect } from "../index"

const FRUITS = ["Apple", "Banana", "Cherry"]

function Fruit(root: Partial<SelectRootProps>) {
  return (
    <>
      <button type="button">Before</button>
      <Select.Root {...(root as SelectRootProps)} placeholder="Pick one">
        <Select.Label>Fruit</Select.Label>
        <Select.Trigger>
          <Select.ValueText />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Content>
              <Select.List>
                {FRUITS.map((f) => (
                  <Select.Item key={f} value={f.toLowerCase()}>
                    <Select.ItemText>{f}</Select.ItemText>
                  </Select.Item>
                ))}
              </Select.List>
            </Select.Content>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
      <button type="button">After</button>
    </>
  )
}

const fruit = () => getSelect(screen, { name: "Fruit" })

describe("Select: basics", () => {
  it("Closed: combobox named by the label, placeholder shown", async () => {
    render(<Fruit />)
    const t = screen.getByRole("combobox", { name: "Fruit" })
    expect(t.getAttribute("aria-expanded")).toBe("false")
    expect(await fruit().valueText()).toBe("Pick one")
    expect(await fruit().hasPlaceholder()).toBe(true)
  })

  for (const modality of ["pointer", "keyboard"] as const) {
    it(`Choose (${modality}): the value text and the form value follow, focus returns`, async () => {
      const onValueChange = vi.fn()
      render(<Fruit onValueChange={onValueChange} name="fruit" />)
      const s = fruit().via(modality)
      await s.choose("Banana")
      expect(await s.isOpen()).toBe(false)
      expect(await s.valueText()).toBe("Banana")
      expect(await s.formValue()).toBe("banana")
      expect(onValueChange).toHaveBeenLastCalledWith("banana", { reason: "select" })
      expect(document.activeElement).toBe(screen.getByRole("combobox", { name: "Fruit" }))
    })
  }

  it("Open: focus on the selected option; Escape closes to the trigger", async () => {
    render(<Fruit defaultValue="cherry" />)
    const s = fruit().via("keyboard")
    await s.open()
    expect(await s.focusedItem()).toBe("Cherry")
    expect(await s.selected()).toEqual(["Cherry"])
    await s.pressEscape()
    expect(document.activeElement).toBe(screen.getByRole("combobox", { name: "Fruit" }))
  })

  it("Closed typeahead selects the match without opening", async () => {
    const user = userEvent.setup()
    // Closed, no option is mounted: the data items carry the texts.
    render(<Fruit items={FRUITS.map((f) => ({ key: f.toLowerCase(), label: f }))} />)
    await user.tab()
    await user.tab()
    await user.keyboard("c")
    expect(await fruit().isOpen()).toBe(false)
    expect(await fruit().valueText()).toBe("Cherry")
  })

  it("Label press focuses the trigger and does not open", async () => {
    render(<Fruit />)
    await fruit().via("pointer").pressLabel()
    expect(await fruit().isOpen()).toBe(false)
  })
})

const DATA = FRUITS.map((f) => ({ key: f.toLowerCase(), label: f }))
const trigger = () => screen.getByRole("combobox", { name: "Fruit" })

describe("Select: closing rules", () => {
  it("Tab closes and focus moves past the trigger", async () => {
    render(<Fruit />)
    const s = fruit().via("keyboard")
    await s.open()
    await s.tabOut()
    expect(document.activeElement?.textContent).toBe("After")
  })

  it("Outside press closes with reason outside-press", async () => {
    const onOpenChange = vi.fn()
    render(<Fruit onOpenChange={onOpenChange} />)
    const s = fruit().via("pointer")
    await s.open()
    await s.pressOutside()
    expect(onOpenChange).toHaveBeenLastCalledWith(
      false,
      expect.objectContaining({ reason: "outside-press" }),
    )
  })

  it("ArrowUp on the closed trigger opens on the last option", async () => {
    render(<Fruit />)
    const s = fruit().via("keyboard")
    await s.openWithArrowUp()
    expect(await s.focusedItem()).toBe("Cherry")
  })

  it("Disabled: does not open, no typeahead; read-only: focusable, does not open", async () => {
    const user = userEvent.setup()
    const { unmount } = render(<Fruit disabled items={DATA} />)
    await user.click(trigger())
    expect(trigger().getAttribute("aria-expanded")).toBe("false")
    unmount()
    render(<Fruit readOnly items={DATA} />)
    trigger().focus()
    await user.keyboard("{Enter}c")
    expect(trigger().getAttribute("aria-expanded")).toBe("false")
    expect(await fruit().valueText()).toBe("Pick one")
  })

  it("Controlled open: a refused close keeps it open", async () => {
    render(<Fruit open onOpenChange={() => {}} />)
    const s = fruit().via("keyboard")
    expect(await s.isOpen()).toBe(true)
    await s.pressEscape().catch(() => {})
    expect(await s.isOpen()).toBe(true)
  })
})

describe("Select: multiple", () => {
  it("Choosing toggles and keeps the popup open; the value text lists them", async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(<Fruit multiple onValueChange={onValueChange} items={DATA} />)
    await fruit().via("pointer").open()
    await user.click(screen.getByRole("option", { name: "Cherry" }))
    await user.click(screen.getByRole("option", { name: "Apple" }))
    expect(trigger().getAttribute("aria-expanded")).toBe("true")
    expect(onValueChange).toHaveBeenLastCalledWith(["apple", "cherry"], { reason: "select" })
    expect(await fruit().valueText()).toBe("Apple and Cherry")
  })
})

describe("Select: forms", () => {
  const submitted = (form: HTMLFormElement) => [...new FormData(form).entries()]

  it("Single: submits the key, '' with none; reset restores the default", async () => {
    render(
      <form aria-label="f">
        <Fruit name="fruit" defaultValue="apple" items={DATA} />
      </form>,
    )
    const form = screen.getByRole("form") as HTMLFormElement
    expect(submitted(form)).toEqual([["fruit", "apple"]])
    await fruit().via("keyboard").choose("Banana")
    expect(submitted(form)).toEqual([["fruit", "banana"]])
    form.reset()
    await vi.waitFor(async () => expect(await fruit().valueText()).toBe("Apple"))
    expect(submitted(form)).toEqual([["fruit", "apple"]])
  })

  it("Multiple: one entry per key", async () => {
    render(
      <form aria-label="f">
        <Fruit name="fruit" multiple defaultValue={["apple", "cherry"]} items={DATA} />
      </form>,
    )
    expect(submitted(screen.getByRole("form") as HTMLFormElement)).toEqual([
      ["fruit", "apple"],
      ["fruit", "cherry"],
    ])
  })

  it("Required: invalid with none, valid once chosen", async () => {
    render(
      <form aria-label="f">
        <Fruit name="fruit" required items={DATA} />
      </form>,
    )
    const form = screen.getByRole("form") as HTMLFormElement
    expect(trigger().getAttribute("aria-required")).toBe("true")
    expect(form.checkValidity()).toBe(false)
    await fruit().via("pointer").choose("Apple")
    expect(form.checkValidity()).toBe(true)
  })

  it("Autofill: a native input on the hidden input selects by key or text", async () => {
    const onValueChange = vi.fn()
    const { container } = render(<Fruit name="fruit" items={DATA} onValueChange={onValueChange} />)
    const hidden = container.ownerDocument.querySelector<HTMLInputElement>(
      '[data-scope="select"][data-part="hidden-input"]',
    )
    if (!hidden) throw new Error("no hidden input")
    hidden.value = "Cherry"
    hidden.dispatchEvent(new Event("input", { bubbles: true }))
    await vi.waitFor(async () => expect(await fruit().valueText()).toBe("Cherry"))
    expect(onValueChange).toHaveBeenLastCalledWith("cherry", { reason: "autofill" })
    expect(trigger().hasAttribute("data-autofill")).toBe(true)
  })

  it("A user change fires change on the hidden input", async () => {
    const onChange = vi.fn()
    render(
      <form aria-label="f" onChange={onChange}>
        <Fruit name="fruit" items={DATA} />
      </form>,
    )
    await fruit().via("pointer").choose("Banana")
    expect(onChange).toHaveBeenCalledTimes(1)
  })
})
