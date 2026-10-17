// Select scenarios (openspec add-select) through the select driver, in jsdom and real browsers.
import { Dialog, Field, Select, type SelectRootProps } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { useState } from "react"
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
                {(root.items ?? FRUITS.map((f) => ({ key: f.toLowerCase(), label: f }))).map(
                  (i) => (
                    <Select.Item key={i.key} value={i.key}>
                      <Select.ItemText>{i.label}</Select.ItemText>
                    </Select.Item>
                  ),
                )}
              </Select.List>
            </Select.Content>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
      <button type="button">After</button>
    </>
  )
}

const inJsdom = navigator.userAgent.includes("jsdom")
const fruit = () => getSelect(screen, { name: "Fruit" })

describe("Select: basics", () => {
  it("Closed: combobox named by the label, placeholder shown", async () => {
    render(<Fruit />)
    const t = screen.getByRole("combobox", { name: "Fruit" })
    expect(t.getAttribute("aria-expanded")).toBe("false")
    expect(await fruit().value()).toBe("Pick one")
    expect(await fruit().isPlaceholder()).toBe(true)
  })

  for (const modality of ["pointer", "keyboard"] as const) {
    it(`Choose (${modality}): the value text and the form value follow, focus returns`, async () => {
      const onValueChange = vi.fn()
      render(<Fruit onValueChange={onValueChange} name="fruit" />)
      const s = fruit().via(modality)
      await s.choose("Banana")
      expect(await s.isOpen()).toBe(false)
      expect(await s.value()).toBe("Banana")
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
    expect(await fruit().value()).toBe("Cherry")
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
    expect(await fruit().value()).toBe("Pick one")
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
    expect(await fruit().value()).toBe("Apple and Cherry")
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
    await vi.waitFor(async () => expect(await fruit().value()).toBe("Apple"))
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
    const hidden = document.querySelector<HTMLInputElement>('[data-part="hidden-input"]')
    expect(trigger().getAttribute("aria-required")).toBe("true")
    expect(hidden?.validity.valueMissing).toBe(true)
    expect(form.checkValidity()).toBe(false)
    await fruit().via("pointer").choose("Apple")
    expect(hidden?.validity.valueMissing).toBe(false)
    expect(form.checkValidity()).toBe(true)
  })

  // jsdom's validation focuses nothing: the browser's does.
  it.skipIf(inJsdom)(
    "Required: submitting with none focuses the trigger, with the focus ring",
    async () => {
      render(
        <form aria-label="f">
          <Fruit name="fruit" required items={DATA} />
        </form>,
      )
      const form = screen.getByRole("form") as HTMLFormElement
      form.requestSubmit()
      // The browser focuses the invalid hidden input; it forwards focus to the trigger.
      form.reportValidity()
      await vi.waitFor(() => expect(document.activeElement).toBe(trigger()))
      await vi.waitFor(() => expect(trigger().hasAttribute("data-focus-visible")).toBe(true))
    },
  )

  it('Required with the "" option chosen: valid, and "" is submitted', async () => {
    render(
      <form aria-label="f">
        <Fruit name="fruit" required items={[{ key: "", label: "Built-in" }, ...DATA]} />
      </form>,
    )
    const form = screen.getByRole("form") as HTMLFormElement
    expect(form.checkValidity()).toBe(false)
    await fruit().via("keyboard").choose("Built-in")
    expect(form.checkValidity()).toBe(true)
    expect([...new FormData(form).entries()]).toEqual([["fruit", ""]])
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
    await vi.waitFor(async () => expect(await fruit().value()).toBe("Cherry"))
    expect(onValueChange).toHaveBeenLastCalledWith("cherry", { reason: "autofill" })
    expect(trigger().hasAttribute("data-autofill")).toBe(true)
  })

  it("A user change: one input and one change from the hidden input; a controlled change: none (radix#4102)", async () => {
    const events: string[] = []
    function Controlled() {
      const [value, setValue] = useState<string | null>(null)
      return (
        <>
          <Fruit
            name="fruit"
            items={DATA}
            value={value}
            onValueChange={(v: string | null) => setValue(v)}
          />
          <button type="button" onClick={() => setValue("cherry")}>
            Set cherry
          </button>
        </>
      )
    }
    render(<Controlled />)
    const hidden = document.querySelector<HTMLInputElement>('[data-part="hidden-input"]')
    for (const type of ["input", "change"]) {
      hidden?.addEventListener(type, () => events.push(type))
    }
    await fruit().via("pointer").choose("Banana")
    expect(events).toEqual(["input", "change"])
    events.length = 0
    await userEvent.click(screen.getByRole("button", { name: "Set cherry" }))
    expect(await fruit().value()).toBe("Cherry")
    expect(events).toEqual([])
  })
})

describe("Select: hidden input focus", () => {
  it("Focusing the hidden input while open keeps it open, focus in the select", async () => {
    const onOpenChange = vi.fn()
    render(<Fruit name="fruit" onOpenChange={onOpenChange} />)
    const s = fruit().via("keyboard")
    await s.open()
    const hidden = document.querySelector<HTMLInputElement>('[data-part="hidden-input"]')
    hidden?.focus()
    await vi.waitFor(() =>
      expect(
        trigger() === document.activeElement ||
          screen.getByRole("listbox").contains(document.activeElement),
      ).toBe(true),
    )
    expect(onOpenChange).toHaveBeenCalledTimes(1)
    expect(await s.isOpen()).toBe(true)
  })
})

/** The select's parts without a Select.Label (the name comes from elsewhere). */
function Bare(root: Partial<SelectRootProps>) {
  return (
    <Select.Root {...(root as SelectRootProps)} items={DATA} placeholder="Pick one">
      <Select.Trigger>
        <Select.ValueText />
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner>
          <Select.Content>
            <Select.List>
              {DATA.map((i) => (
                <Select.Item key={i.key} value={i.key}>
                  <Select.ItemText>{i.label}</Select.ItemText>
                </Select.Item>
              ))}
              <Select.Separator />
            </Select.List>
          </Select.Content>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  )
}

describe("Select: naming, Field and nesting", () => {
  it("Field: its label names the trigger and the list; a label click focuses and does not open (headlessui#3787)", async () => {
    const user = userEvent.setup()
    render(
      <Field.Root>
        <Field.Label>Fruit</Field.Label>
        <Bare name="fruit" />
        <Field.Description>Your favourite</Field.Description>
      </Field.Root>,
    )
    const t = trigger()
    expect(t.getAttribute("aria-describedby")).toContain(screen.getByText("Your favourite").id)
    await user.click(screen.getByText("Fruit"))
    expect(document.activeElement).toBe(t)
    expect(t.getAttribute("aria-expanded")).toBe("false")
    await fruit().via("keyboard").open()
    expect(screen.getByRole("listbox", { name: "Fruit" })).toBeTruthy()
  })

  it("Field disabled: the trigger and the hidden input are disabled", () => {
    render(
      <Field.Root disabled>
        <Field.Label>Fruit</Field.Label>
        <Bare name="fruit" />
      </Field.Root>,
    )
    expect(trigger().hasAttribute("data-disabled")).toBe(true)
    const hidden = document.querySelector<HTMLInputElement>('[data-part="hidden-input"]')
    expect(hidden?.disabled).toBe(true)
  })

  it("Wrapping label: names the trigger; a press on its text focuses without opening (radix#3679)", async () => {
    const user = userEvent.setup()
    render(
      // biome-ignore lint/a11y/noLabelWithoutControl: the trigger inside is the control
      <label>
        <span>Fruit</span>
        <Bare />
      </label>,
    )
    await user.click(screen.getByText("Fruit"))
    expect(document.activeElement).toBe(trigger())
    expect(trigger().getAttribute("aria-expanded")).toBe("false")
  })

  it("aria-label on the trigger is copied to the list (never named by its value)", async () => {
    render(
      <Select.Root items={DATA} defaultValue="apple">
        <Select.Trigger aria-label="Fruit">
          <Select.ValueText />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Content>
              <Select.List>
                {DATA.map((i) => (
                  <Select.Item key={i.key} value={i.key}>
                    {i.label}
                  </Select.Item>
                ))}
              </Select.List>
            </Select.Content>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>,
    )
    await fruit().via("keyboard").open()
    expect(screen.getByRole("listbox").getAttribute("aria-label")).toBe("Fruit")
    expect(screen.getByRole("listbox").getAttribute("aria-labelledby")).toBe(null)
  })

  it("Unnamed trigger: a development warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    render(<Bare />)
    expect(warn.mock.calls.flat().join(" ")).toMatch(/no accessible name/)
    warn.mockRestore()
  })

  it("In a dialog: Escape closes only the select", async () => {
    render(
      <Dialog.Root defaultOpen>
        <Dialog.Portal>
          <Dialog.Content>
            <Dialog.Title>Settings</Dialog.Title>
            <Fruit />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>,
    )
    const s = fruit().via("keyboard")
    await s.open()
    await s.pressEscape()
    expect(screen.getByRole("dialog", { name: "Settings" })).toBeTruthy()
    expect(document.activeElement).toBe(trigger())
  })

  it("render: a custom trigger element keeps the behaviour", async () => {
    render(
      <Select.Root items={DATA}>
        <Select.Label>Fruit</Select.Label>
        <Select.Trigger render={<div />}>
          <Select.ValueText />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Content>
              <Select.List>
                {DATA.map((i) => (
                  <Select.Item key={i.key} value={i.key}>
                    {i.label}
                  </Select.Item>
                ))}
              </Select.List>
            </Select.Content>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>,
    )
    expect(trigger().tagName).toBe("DIV")
    expect(trigger().getAttribute("tabindex")).toBe("0")
    await fruit().via("keyboard").choose("Banana")
    expect(await fruit().value()).toBe("Banana")
  })

  it("Separator: role none inside the listbox (mui/base-ui#5398)", async () => {
    render(
      <Field.Root>
        <Field.Label>Fruit</Field.Label>
        <Bare />
      </Field.Root>,
    )
    await fruit().via("pointer").open()
    const sep = document.querySelector('[data-scope="select"][data-part="separator"]')
    expect(sep?.getAttribute("role")).toBe("none")
  })
})

describe("Select: mounting and empty-string keys", () => {
  it("Lazy: no content before the first open; keepMounted keeps it hidden after closing", async () => {
    const { unmount } = render(<Fruit />)
    expect(document.querySelector('[data-scope="select"][data-part="content"]')).toBe(null)
    unmount()
    render(<Fruit keepMounted />)
    const s = fruit().via("keyboard")
    await s.open()
    await s.pressEscape()
    const content = document.querySelector<HTMLElement>(
      '[data-scope="select"][data-part="content"]',
    )
    expect(content?.hidden).toBe(true)
  })

  it('"" is a key distinct from none: selected, shown and submitted (radix#2706)', async () => {
    render(
      <form aria-label="f">
        <Fruit name="fruit" defaultValue="" items={[{ key: "", label: "Built-in" }, ...DATA]} />
      </form>,
    )
    expect(await fruit().value()).toBe("Built-in")
    expect(await fruit().isPlaceholder()).toBe(false)
    expect([...new FormData(screen.getByRole("form") as HTMLFormElement).entries()]).toEqual([
      ["fruit", ""],
    ])
  })
})
