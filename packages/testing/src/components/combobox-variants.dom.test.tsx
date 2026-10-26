// The Combobox variants (add-combobox-variants) through the driver where it can: free text
// (an autocomplete) and inline (a command palette). Runs in jsdom and in real browsers.
import { Combobox, Dialog, Field } from "@rind-ui/react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { type ReactNode, useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { getCombobox, installAnnouncementLog } from "../index"

const inJsdom = navigator.userAgent.includes("jsdom")
const browserIt = it.skipIf(inJsdom)

afterEach(() => {
  vi.restoreAllMocks()
  installAnnouncementLog().length = 0
})

const CITIES = [
  { key: "rome", label: "Rome" },
  { key: "roma", label: "Romania" },
  { key: "paris", label: "Paris" },
]

function Search(props: Record<string, unknown> & { readonly onSubmit?: (d: FormData) => void }) {
  const { onSubmit, ...rest } = props
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit?.(new FormData(e.currentTarget))
      }}
    >
      <Combobox.Root selectionMode="none" items={CITIES} name="q" {...rest}>
        <Combobox.Label>City</Combobox.Label>
        <Combobox.Control>
          <Combobox.Input />
        </Combobox.Control>
        <Combobox.Positioner>
          <Combobox.Popup>
            <Combobox.List>
              <Combobox.Items />
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Root>
      <button type="reset">Reset</button>
    </form>
  )
}
const city = () => screen.getByRole("combobox", { name: "City" }) as HTMLInputElement

describe("free text (autocomplete)", () => {
  it("Value in the form data (mui/base-ui#4724): one element carries the name", () => {
    render(<Search defaultInputValue="rust" />)
    const form = document.querySelector("form") as HTMLFormElement
    expect(new FormData(form).get("q")).toBe("rust")
    expect(document.querySelectorAll('[name="q"]')).toHaveLength(1)
    expect(city().getAttribute("name")).toBe("q")
  })

  it("Search on Enter (chakra-ui/zag#2521): nothing highlighted submits the text", async () => {
    const onSubmit = vi.fn()
    render(<Search onSubmit={onSubmit} />)
    await userEvent.click(city())
    await userEvent.keyboard("rust{Enter}")
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit.mock.lastCall?.[0].get("q")).toBe("rust")
  })

  it("Pick a suggestion: the text is filled, the popup closes, onValueChange never fires", async () => {
    const onValueChange = vi.fn()
    const onInputValueChange = vi.fn()
    const onAction = vi.fn()
    render(
      <Search
        onValueChange={onValueChange}
        onInputValueChange={onInputValueChange}
        onAction={onAction}
      />,
    )
    const d = getCombobox(screen, { name: "City" })
    await d.type("ro")
    await d.choose("Rome")
    expect(city().value).toBe("Rome")
    expect(await d.isOpen()).toBe(false)
    expect(onValueChange).not.toHaveBeenCalled()
    expect(onInputValueChange).toHaveBeenLastCalledWith("Rome", expect.anything())
    // The driver's default modality presses the option.
    expect(onAction).toHaveBeenCalledWith("rome", expect.objectContaining({ modality: "pointer" }))
  })

  it("Submit on choose: Enter on the highlight fills, then submits once", async () => {
    const onSubmit = vi.fn()
    render(<Search onSubmit={onSubmit} submitOnChoose />)
    await userEvent.click(city())
    await userEvent.keyboard("ro{ArrowDown}{Enter}")
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect(onSubmit.mock.lastCall?.[0].get("q")).toBe("Rome")
  })

  it("Options never read as selected (tailwindlabs/headlessui#1599)", async () => {
    render(<Search />)
    await userEvent.click(city())
    await userEvent.keyboard("{ArrowDown}")
    const options = screen.getAllByRole("option")
    expect(options).toHaveLength(3)
    for (const o of options) expect(o.getAttribute("aria-selected")).toBe("false")
  })

  it("Escape keeps free text (mui/base-ui#4245) and is left unhandled", async () => {
    render(<Search />)
    await userEvent.click(city())
    await userEvent.keyboard("Atlantis{Escape}")
    const e = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })
    act(() => {
      city().dispatchEvent(e)
    })
    expect(e.defaultPrevented).toBe(false)
    expect(city().value).toBe("Atlantis")
  })

  it("clearOnEscape clears a closed field's text", async () => {
    render(<Search clearOnEscape />)
    await userEvent.click(city())
    await userEvent.keyboard("Atlantis{Escape}{Escape}")
    expect(city().value).toBe("")
  })

  it("a form reset restores the default text", async () => {
    render(<Search defaultInputValue="Paris" />)
    await userEvent.click(city())
    await userEvent.keyboard("{Control>}a{/Control}x")
    fireEvent.click(screen.getByRole("button", { name: "Reset" }))
    await waitFor(() => expect(city().value).toBe("Paris"))
  })

  it("inside a required, invalid Field: the input is required and invalid", () => {
    render(
      <Field.Root required invalid>
        <Field.Label>City</Field.Label>
        <Combobox.Root selectionMode="none" items={CITIES} name="q">
          <Combobox.Control>
            <Combobox.Input />
          </Combobox.Control>
        </Combobox.Root>
        <Field.ErrorMessage>Pick a city</Field.ErrorMessage>
      </Field.Root>,
    )
    expect(city().required).toBe(true)
    expect(city().getAttribute("aria-invalid")).toBe("true")
  })
})

const COMMANDS = [
  { key: "new", label: "New file" },
  { key: "open", label: "Open recent" },
  { key: "settings", label: "Settings" },
  { key: "theme", label: "Toggle theme" },
]

function Palette({
  children,
  ...props
}: Record<string, unknown> & { readonly children?: ReactNode }) {
  return (
    <Combobox.Root inline {...(children ? {} : { items: COMMANDS })} {...props}>
      <Combobox.Label>Search commands</Combobox.Label>
      <Combobox.Control>
        <Combobox.Input />
      </Combobox.Control>
      <Combobox.List>{children ?? <Combobox.Items />}</Combobox.List>
      <Combobox.Empty>No results</Combobox.Empty>
      <Combobox.Loading>Loading…</Combobox.Loading>
    </Combobox.Root>
  )
}
const search = () => screen.getByRole("combobox", { name: "Search commands" }) as HTMLInputElement
const highlightedText = () => document.querySelector("[data-highlighted]")?.textContent ?? null

describe("inline (command palette)", () => {
  it("Minimal palette: the list in place, the first item highlighted, expanded", () => {
    render(<Palette />)
    expect(
      screen.getByRole("listbox").closest('[data-scope="combobox"][data-part="popup"]'),
    ).toBeNull()
    expect(screen.getAllByRole("option")).toHaveLength(4)
    expect(highlightedText()).toBe("New file")
    expect(search().getAttribute("aria-expanded")).toBe("true")
    expect(
      document
        .querySelector('[data-scope="combobox"][data-part="control"]')
        ?.getAttribute("data-state"),
    ).toBe("open")
  })

  it("Nothing matches: listbox hidden, aria-expanded false, Empty shown, noResults said once", async () => {
    const log = installAnnouncementLog()
    render(<Palette />)
    await userEvent.click(search())
    await userEvent.keyboard("zzz")
    expect(search().getAttribute("aria-expanded")).toBe("false")
    expect(screen.queryByRole("listbox")).toBeNull()
    expect(screen.getByText("No results").hidden).toBe(false)
    await waitFor(() =>
      expect(log.filter((a) => a.message === "No results").length).toBeGreaterThan(0),
    )
  })

  it("Run by keyboard: onAction once, text unchanged, nothing selected", async () => {
    const onAction = vi.fn()
    render(<Palette onAction={onAction} />)
    const d = getCombobox(screen, { name: "Search commands" }, { inline: true })
    await d.type("the")
    await d.run("Toggle theme")
    expect(onAction).toHaveBeenCalledTimes(1)
    expect(onAction.mock.lastCall?.[0]).toBe("theme")
    expect(search().value).toBe("the")
    for (const o of screen.getAllByRole("option"))
      expect(o.getAttribute("aria-selected")).toBe("false")
  })

  it("Click keeps the highlight (huntabyte/bits-ui#2063)", async () => {
    const onAction = vi.fn()
    render(<Palette onAction={onAction} />)
    await userEvent.click(screen.getByRole("option", { name: "Settings" }))
    expect(onAction.mock.lastCall?.[0]).toBe("settings")
    act(() => search().focus())
    await userEvent.keyboard("{ArrowDown}")
    expect(highlightedText()).toBe("Toggle theme")
  })

  it("Navigation loops by default: ArrowUp on the first item reaches the last", async () => {
    render(<Palette />)
    await userEvent.click(search())
    expect(highlightedText()).toBe("New file")
    await userEvent.keyboard("{ArrowUp}")
    expect(highlightedText()).toBe("Toggle theme")
  })

  it("Home edits the text (dip/cmdk#341): the highlight stays", async () => {
    render(<Palette />)
    await userEvent.click(search())
    await userEvent.keyboard("e{ArrowDown}")
    const before = highlightedText()
    await userEvent.keyboard("{Home}")
    expect(highlightedText()).toBe(before)
  })

  it("Clear then close: Escape clears, the next calls onOpenChange(false) and is prevented", async () => {
    const onOpenChange = vi.fn()
    render(<Palette onOpenChange={onOpenChange} />)
    await userEvent.click(search())
    await userEvent.keyboard("theme{Escape}")
    expect(search().value).toBe("")
    expect(onOpenChange).not.toHaveBeenCalled()
    const e = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })
    act(() => {
      search().dispatchEvent(e)
    })
    expect(onOpenChange).toHaveBeenCalledWith(false, { reason: "escape" })
    expect(e.defaultPrevented).toBe(true)
  })

  it("inside a dialog: the second Escape closes the dialog through onOpenChange", async () => {
    function InDialog() {
      const [open, setOpen] = useState(true)
      return (
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Content>
            <Dialog.Title>Command palette</Dialog.Title>
            <Palette onOpenChange={(o: boolean) => !o && setOpen(false)} />
          </Dialog.Content>
        </Dialog.Root>
      )
    }
    render(<InDialog />)
    await waitFor(() => expect(document.activeElement).toBe(search()))
    await userEvent.keyboard("theme{Escape}")
    expect(screen.getByRole("dialog")).toBeTruthy()
    await userEvent.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  })

  it("Pages: Backspace on an empty query goes back above the root page only", async () => {
    const onBack = vi.fn()
    const { rerender } = render(
      <Palette onBack={onBack} page={{ key: "root", label: "Commands", depth: 0 }} />,
    )
    await userEvent.click(search())
    await userEvent.keyboard("{Backspace}")
    expect(onBack).not.toHaveBeenCalled()
    rerender(<Palette onBack={onBack} page={{ key: "projects", label: "Projects", depth: 1 }} />)
    await userEvent.keyboard("ab{Backspace}")
    expect(onBack).not.toHaveBeenCalled()
    expect(search().value).toBe("a")
    await userEvent.keyboard("{Backspace}{Backspace}")
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it("a parent re-render with a literal page keeps the query and the highlight", async () => {
    function Parent() {
      const [, setTick] = useState(0)
      return (
        <>
          <Palette page={{ key: "root", label: "Commands", depth: 0 }} />
          <button type="button" onClick={() => setTick((t) => t + 1)}>
            Rerender
          </button>
        </>
      )
    }
    const log = installAnnouncementLog()
    render(<Parent />)
    await userEvent.click(search())
    await userEvent.keyboard("se{ArrowDown}")
    const highlight = highlightedText()
    fireEvent.click(screen.getByRole("button", { name: "Rerender" }))
    fireEvent.click(screen.getByRole("button", { name: "Rerender" }))
    expect(search().value).toBe("se")
    expect(highlightedText()).toBe(highlight)
    expect(log.filter((a) => a.message === "Commands")).toHaveLength(0)
  })

  it("Loading: a sibling of the listbox, aria-busy, Empty not shown", () => {
    render(<Palette loading="loading" items={[]} />)
    const loading = screen.getByText("Loading…")
    expect(loading.hidden).toBe(false)
    expect(loading.closest('[role="listbox"]')).toBeNull()
    expect(loading.getAttribute("role")).toBeNull()
    const empty = screen.queryByText("No results")
    expect(empty === null || empty.hidden).toBe(true)
  })

  it("Item descriptions describe their option", () => {
    render(
      <Palette>
        <Combobox.Item value="new">
          <Combobox.ItemText>New file</Combobox.ItemText>
          <Combobox.ItemDescription>Ctrl+N</Combobox.ItemDescription>
        </Combobox.Item>
      </Palette>,
    )
    const option = screen.getByRole("option", { name: "New file" })
    const ids = option.getAttribute("aria-describedby") ?? ""
    expect(document.getElementById(ids)?.textContent).toBe("Ctrl+N")
  })

  it("A link item opens once with the Enter's modifiers (adobe/react-spectrum#9431, #8992)", async () => {
    const clicks: MouseEvent[] = []
    render(
      <Palette>
        <Combobox.Item value="settings" render={<a href="#settings" />}>
          <Combobox.ItemText>Settings</Combobox.ItemText>
        </Combobox.Item>
      </Palette>,
    )
    const link = document.querySelector('a[href="#settings"]') as HTMLAnchorElement
    link.addEventListener("click", (e) => {
      clicks.push(e)
      e.preventDefault()
    })
    act(() => search().focus())
    await userEvent.keyboard("{Control>}{Enter}{/Control}")
    expect(clicks).toHaveLength(1)
    expect(clicks[0]?.ctrlKey).toBe(true)
  })

  browserIt("Mount does not scroll the page (dip/cmdk#405)", () => {
    const spacer = document.createElement("div")
    spacer.style.height = "3000px"
    document.body.prepend(spacer)
    render(<Palette />)
    expect(window.scrollY).toBe(0)
    spacer.remove()
  })
})

describe("single selection: Enter on rejected text", () => {
  it("does not submit the form while the text reverts to the selection", async () => {
    const onSubmit = vi.fn()
    render(
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit()
        }}
      >
        <Combobox.Root items={CITIES} defaultValue="rome" name="city">
          <Combobox.Label>City</Combobox.Label>
          <Combobox.Control>
            <Combobox.Input />
          </Combobox.Control>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Items />
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Root>
        <button type="submit">Send</button>
      </form>,
    )
    await userEvent.click(city())
    await userEvent.keyboard("{Escape}")
    await userEvent.clear(city())
    await userEvent.type(city(), "Romx")
    await userEvent.keyboard("{Enter}")
    expect(city().value).toBe("Rome")
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
