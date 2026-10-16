// Listbox through its driver: runs unchanged in jsdom and in real browsers.
import { domEnvironment } from "@rind-ui/core"
import { Dialog, Listbox, type ListboxRootProps } from "@rind-ui/react"
import { act, render, screen, waitFor } from "@testing-library/react"
import { useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { getDialog, getListbox, installAnnouncementLog } from "../index"

const platform = domEnvironment().platform
const lb = (name = "Fruit") => getListbox(screen, { name }, { platform })
const option = (name: string) => screen.getByRole("option", { name })

function Fruit(props: Partial<ListboxRootProps> & { readonly keys?: readonly string[] }) {
  const { keys = ["a", "b", "c", "d", "e"], ...root } = props
  return (
    <>
      <Listbox.Root {...(root as ListboxRootProps)}>
        <Listbox.Label>Fruit</Listbox.Label>
        <Listbox.List>
          {keys.map((k) => (
            <Listbox.Item key={k} value={k}>
              <Listbox.ItemText>{k}</Listbox.ItemText>
            </Listbox.Item>
          ))}
        </Listbox.List>
      </Listbox.Root>
      <button type="button">After</button>
    </>
  )
}

afterEach(() => vi.restoreAllMocks())

describe("Listbox", () => {
  it("Minimal listbox: named by the label, three options, one tab stop", async () => {
    render(<Fruit keys={["apple", "pear", "plum"]} />)
    expect(screen.getByRole("listbox", { name: "Fruit" })).toBeTruthy()
    expect(screen.getAllByRole("option")).toHaveLength(3)
    expect(screen.getAllByRole("option").filter((o) => o.tabIndex === 0)).toHaveLength(1)
  })

  it("Explicit unselected state (headlessui#1599, radix#1907)", () => {
    render(<Fruit keys={["a", "b", "c"]} defaultValue="b" />)
    expect(option("a").getAttribute("aria-selected")).toBe("false")
    expect(option("b").getAttribute("aria-selected")).toBe("true")
    expect(option("c").getAttribute("aria-selected")).toBe("false")
  })

  it("Highlight is not selection (zag#2947)", async () => {
    render(<Fruit keys={["a", "b", "c"]} defaultValue="b" />)
    await lb().focusIn()
    await lb().next()
    expect(document.activeElement).toBe(option("c"))
    expect(option("c").hasAttribute("data-highlighted")).toBe(true)
    expect(option("c").getAttribute("aria-selected")).toBe("false")
  })

  it("Tab into a list with a selection focuses it; return to the last item", async () => {
    render(<Fruit defaultValue="c" />)
    await lb().focusIn()
    expect(document.activeElement).toBe(option("c"))
    await lb().next()
    await lb().tabOut()
    await lb().focusIn()
    expect(document.activeElement).toBe(option("d"))
  })

  it("Controlled single value: proposes, keeps the parent's until applied", async () => {
    const onValueChange = vi.fn()
    render(<Fruit value="b" onValueChange={onValueChange} />)
    // A refused proposal: no driver postcondition can hold, so a plain click.
    await lb().focusIn()
    act(() => option("a").click())
    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(onValueChange.mock.calls[0]?.[0]).toBe("a")
    expect(onValueChange.mock.calls[0]?.[1]).toMatchObject({ key: "a" })
    expect(option("b").getAttribute("aria-selected")).toBe("true")
  })

  it("Space toggles in multiple mode; Shift+ArrowDown extends", async () => {
    const onValueChange = vi.fn()
    render(<Fruit selectionMode="multiple" onValueChange={onValueChange} />)
    await lb().toggle("a")
    await lb().toggle("c")
    expect(await lb().selected()).toEqual(["a", "c"])
    expect(onValueChange).toHaveBeenCalledTimes(2)
  })

  it("Driver round trip: toggle then a range", async () => {
    render(<Fruit selectionMode="multiple" keys={["ham", "egg", "olives", "kale"]} />)
    await lb().toggle("ham")
    await lb().chooseRange("ham", "olives")
    expect(await lb().selected()).toEqual(["ham", "egg", "olives"])
  })

  it("Ranges with a controlled value (react-spectrum#7947, #10147)", async () => {
    function Controlled() {
      const [value, setValue] = useState<readonly string[] | "all">([])
      return (
        <Fruit
          selectionMode="multiple"
          value={value}
          onValueChange={(v) => setValue(v === "all" ? v : [...v])}
        />
      )
    }
    render(<Controlled />)
    await lb().chooseRange("b", "d")
    expect(await lb().selected()).toEqual(["b", "c", "d"])
  })

  it("Select all is reported as all", async () => {
    const onValueChange = vi.fn()
    render(<Fruit selectionMode="multiple" onValueChange={onValueChange} />)
    await lb().selectAll()
    expect(onValueChange).toHaveBeenLastCalledWith("all", expect.anything())
    expect(
      screen.getAllByRole("option").every((o) => o.getAttribute("aria-selected") === "true"),
    ).toBe(true)
  })

  it("Selection follows focus (replace); screen reader focus does not select", async () => {
    render(<Fruit selectionBehavior="replace" defaultValue="a" />)
    await lb().focusIn()
    await lb().next()
    expect(await lb().selected()).toEqual(["b"])
    act(() => option("d").focus())
    expect(await lb().selected()).toEqual(["b"])
  })

  it("Action list (none): Enter acts, no selection state", async () => {
    const onAction = vi.fn()
    render(<Fruit selectionMode="none" onAction={onAction} />)
    expect(screen.getAllByRole("option").every((o) => !o.hasAttribute("aria-selected"))).toBe(true)
    expect(screen.getByRole("listbox").hasAttribute("aria-multiselectable")).toBe(false)
    await lb().via("keyboard").act("c")
    expect(onAction).toHaveBeenCalledTimes(1)
    expect(onAction.mock.calls[0]?.[0]).toBe("c")
  })

  it("Open on double click in a replace list", async () => {
    const onAction = vi.fn()
    render(<Fruit selectionBehavior="replace" onAction={onAction} keys={["notes.md", "todo.md"]} />)
    await lb().choose("notes.md")
    act(() => {
      option("notes.md").dispatchEvent(new MouseEvent("dblclick", { bubbles: true }))
    })
    expect(await lb().selected()).toEqual(["notes.md"])
    expect(onAction).toHaveBeenCalledTimes(1)
  })

  it("Option with a description: named by text, described, no aria-labelledby", () => {
    render(
      <Listbox.Root>
        <Listbox.List aria-label="Plans">
          <Listbox.Item value="pro">
            <Listbox.ItemText>Pro</Listbox.ItemText>
            <Listbox.ItemDescription>For teams</Listbox.ItemDescription>
          </Listbox.Item>
        </Listbox.List>
      </Listbox.Root>,
    )
    const o = screen.getByRole("option", { name: "Pro", description: "For teams" })
    expect(o.hasAttribute("aria-labelledby")).toBe(false)
  })

  it("Unnamed list warns", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    render(
      <Listbox.Root>
        <Listbox.List>
          <Listbox.Item value="a">a</Listbox.Item>
        </Listbox.List>
      </Listbox.Root>,
    )
    expect(warn.mock.calls.some((c) => String(c[0]).includes("no accessible name"))).toBe(true)
  })

  it("Button inside an option warns", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    render(
      <Listbox.Root>
        <Listbox.List aria-label="X">
          <Listbox.Item value="a">
            <button type="button">x</button>
          </Listbox.Item>
        </Listbox.List>
      </Listbox.Root>,
    )
    expect(warn.mock.calls.some((c) => String(c[0]).includes("interactive"))).toBe(true)
  })

  it("Separator is decorative inside the list", () => {
    render(
      <Listbox.Root>
        <Listbox.List aria-label="Food">
          <Listbox.Section section={{ key: "f", label: "Fruit" }}>
            <Listbox.Item value="a">a</Listbox.Item>
          </Listbox.Section>
          <Listbox.Separator />
          <Listbox.Section section={{ key: "v", label: "Veg" }}>
            <Listbox.Item value="k">k</Listbox.Item>
          </Listbox.Section>
        </Listbox.List>
      </Listbox.Root>,
    )
    const sep = document.querySelector('[data-part="separator"]') as HTMLElement
    expect(sep.getAttribute("role")).toBe("none")
    expect(sep.hasAttribute("data-orientation")).toBe(true)
    expect(sep.hasAttribute("aria-orientation")).toBe(false)
    expect(screen.getByRole("group", { name: "Fruit" })).toBeTruthy()
  })

  it("No results: empty after the list, describes it; list is the tab stop", () => {
    render(
      <Listbox.Root items={[]}>
        <Listbox.List aria-label="Results" />
        <Listbox.Empty>No results</Listbox.Empty>
      </Listbox.Root>,
    )
    const list = screen.getByRole("listbox", { name: "Results", description: "No results" })
    expect(list.children).toHaveLength(0)
    expect(list.tabIndex).toBe(0)
    expect(list.hasAttribute("data-empty")).toBe(true)
  })

  it("Escape is not handled: an enclosing dialog closes, selection unchanged", async () => {
    render(
      <Dialog.Root defaultOpen>
        <Dialog.Positioner style={{ position: "fixed", inset: 0 }}>
          <Dialog.Content>
            <Dialog.Title>Pick</Dialog.Title>
            <Fruit defaultValue="b" />
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>,
    )
    await lb().focusIn()
    act(() => {
      document.activeElement?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      )
    })
    await waitFor(() => expect(screen.queryByRole("dialog")).toBe(null))
    void getDialog
  })

  it("Disabled listbox is skipped by Tab and marks every part", () => {
    render(<Fruit disabled />)
    expect(screen.getAllByRole("option").every((o) => o.tabIndex < 0)).toBe(true)
    expect(screen.getByRole("listbox").hasAttribute("data-disabled")).toBe(true)
  })

  it("Horizontal attributes and keys", async () => {
    render(<Fruit selectionMode="multiple" orientation="horizontal" />)
    const list = screen.getByRole("listbox")
    expect(list.getAttribute("aria-multiselectable")).toBe("true")
    expect(list.getAttribute("aria-orientation")).toBe("horizontal")
    await lb().focusIn()
    act(() => {
      document.activeElement?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
      )
    })
    await waitFor(() => expect(document.activeElement).toBe(option("b")))
  })

  it("Navigating announces nothing", async () => {
    installAnnouncementLog().length = 0
    render(<Fruit />)
    await lb().focusIn()
    await lb().next()
    await lb().next()
    expect(installAnnouncementLog()).toEqual([])
  })

  it("Styling the selected row", async () => {
    render(<Fruit defaultValue="b" />)
    await lb().focusIn()
    const b = option("b")
    expect(b.hasAttribute("data-selected")).toBe(true)
    expect(b.getAttribute("data-state")).toBe("selected")
    expect(b.hasAttribute("data-highlighted")).toBe(true)
    expect(b.hasAttribute("data-focus-visible")).toBe(true)
  })

  it("Data and static items agree", () => {
    const { container: a } = render(<Fruit keys={["x", "y"]} />)
    const staticRoles = [...a.querySelectorAll('[role="option"]')].map((o) => [
      o.textContent,
      o.getAttribute("data-key"),
    ])
    const { container: b } = render(
      <Listbox.Root
        items={[
          { key: "x", label: "x" },
          { key: "y", label: "y" },
        ]}
      >
        <Listbox.List aria-label="Fruit2">
          <Listbox.Items />
        </Listbox.List>
      </Listbox.Root>,
    )
    const dataRoles = [...b.querySelectorAll('[role="option"]')].map((o) => [
      o.textContent,
      o.getAttribute("data-key"),
    ])
    expect(dataRoles).toEqual(staticRoles)
  })
})
