// Multiple Combobox with chips (input-chips spec, combobox "Multiple Selection With Chips").
import { Combobox } from "@rind-ui/react"
import { act, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { getCombobox, installAnnouncementLog } from "../index"

const CITIES = [
  { key: "rome", label: "Rome" },
  { key: "paris", label: "Paris" },
  { key: "oslo", label: "Oslo" },
]

function Cities(props: {
  readonly defaultValue?: readonly string[]
  readonly onValueChange?: (v: readonly string[], d: { reason: string }) => void
  readonly readOnly?: boolean
}) {
  return (
    <>
      <Combobox.Root items={CITIES} multiple {...props}>
        <Combobox.Label>Cities</Combobox.Label>
        <Combobox.Control>
          <Combobox.Chips />
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
      <button type="button">After</button>
    </>
  )
}

const input = () => screen.getByRole("combobox", { name: "Cities" }) as HTMLInputElement
const chip = (name: string) =>
  screen
    .getAllByRole("toolbar")[0]
    ?.querySelector(`[data-part="chip"][id$="${name}"]`) as HTMLElement
const user = async () => (await import("@testing-library/user-event")).userEvent.setup()

describe("Combobox chips", () => {
  it("toolbar named, chips named by their text, remove buttons named, summary description", () => {
    render(<Cities defaultValue={["rome", "paris"]} />)
    const toolbar = screen.getByRole("toolbar", { name: "Selected options" })
    expect(toolbar.compareDocumentPosition(input()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByRole("button", { name: "Remove Rome" }).tabIndex).toBe(-1)
    expect(screen.getByRole("button", { name: "Remove Paris" })).toBeTruthy()
    const summary = document.getElementById(input().getAttribute("aria-describedby") ?? "")
    expect(summary?.textContent).toBe("Rome, Paris")
    for (const el of toolbar.querySelectorAll("[data-part]")) {
      expect(el.getAttribute("data-scope")).toBe("combobox")
    }
  })

  it("Backspace arms the last chip, then removes it (reason chip-remove); focus in the input", async () => {
    const onValueChange = vi.fn()
    render(<Cities defaultValue={["rome", "paris"]} onValueChange={onValueChange} />)
    const u = await user()
    await u.click(input())
    await u.keyboard("{Escape}")
    await u.keyboard("{Backspace}")
    expect(chip("paris").hasAttribute("data-highlighted")).toBe(true)
    expect(onValueChange).not.toHaveBeenCalled()
    await u.keyboard("{Backspace}")
    expect(onValueChange).toHaveBeenCalledWith(["rome"], { reason: "chip-remove" })
    expect(document.activeElement).toBe(input())
  })

  it("a caret move disarms: Backspace then edits the draft", async () => {
    const onValueChange = vi.fn()
    render(<Cities defaultValue={["rome"]} onValueChange={onValueChange} />)
    const u = await user()
    await u.click(input())
    await u.keyboard("{Backspace}")
    expect(chip("rome").hasAttribute("data-highlighted")).toBe(true)
    await u.keyboard("ab")
    await u.keyboard("{Backspace}")
    expect(input().value).toBe("a")
    expect(onValueChange).toHaveBeenCalledTimes(0)
  })

  it("ArrowLeft at the start moves to the last chip; Delete removes it and focus moves on", async () => {
    render(<Cities defaultValue={["rome", "paris", "oslo"]} />)
    const u = await user()
    await u.click(input())
    await u.keyboard("{Escape}{ArrowLeft}")
    expect(document.activeElement).toBe(chip("oslo"))
    await u.keyboard("{ArrowLeft}")
    expect(document.activeElement).toBe(chip("paris"))
    expect(chip("paris").hasAttribute("data-focus-visible")).toBe(true)
    await u.keyboard("{Delete}")
    await waitFor(() => expect(document.activeElement).toBe(chip("oslo")))
    await u.keyboard("{ArrowLeft}")
    expect(document.activeElement).toBe(chip("rome"))
    await u.keyboard("{ArrowRight}{ArrowRight}")
    expect(document.activeElement).toBe(input())
  })

  it("typing on a chip goes to the input", async () => {
    render(<Cities defaultValue={["rome"]} />)
    const u = await user()
    await u.click(input())
    await u.keyboard("{Escape}{ArrowLeft}")
    expect(document.activeElement).toBe(chip("rome"))
    await u.keyboard("m")
    expect(document.activeElement).toBe(input())
    expect(input().value.endsWith("m")).toBe(true)
  })

  it("chips count as inside: the popup stays open and the query is kept", async () => {
    render(<Cities defaultValue={["rome"]} />)
    const u = await user()
    await u.click(input())
    await u.keyboard("pa")
    expect(input().getAttribute("aria-expanded")).toBe("true")
    act(() => input().setSelectionRange(0, 0))
    await u.keyboard("{ArrowLeft}")
    expect(document.activeElement).toBe(chip("rome"))
    expect(screen.getByRole("listbox")).toBeTruthy()
    expect(input().value).toBe("pa")
  })

  it("the remove button deselects without taking focus; removal is announced", async () => {
    const log = installAnnouncementLog()
    render(<Cities defaultValue={["rome", "paris"]} />)
    const u = await user()
    await u.click(input())
    await u.click(screen.getByRole("button", { name: "Remove Rome" }))
    expect(screen.queryByRole("button", { name: "Remove Rome" })).toBe(null)
    expect(document.activeElement).toBe(input())
    await waitFor(() => expect(log.map((a) => a.message)).toContain("Rome removed"))
  })

  it("read-only: chips are disabled and never removed", async () => {
    const onValueChange = vi.fn()
    render(<Cities defaultValue={["rome"]} readOnly onValueChange={onValueChange} />)
    expect(chip("rome").hasAttribute("data-disabled")).toBe(true)
    const u = await user()
    await u.click(input())
    await u.keyboard("{Backspace}{Backspace}")
    expect(onValueChange).not.toHaveBeenCalled()
  })
})

describe("Combobox chips driver", () => {
  for (const modality of ["pointer", "keyboard"] as const) {
    it(`removeChip with ${modality}`, async () => {
      render(<Cities defaultValue={["rome", "paris"]} />)
      const cb = getCombobox(screen, { name: "Cities" }, { modality })
      expect(await cb.chips()).toEqual(["Rome", "Paris"])
      await cb.removeChip("Rome")
      expect(await cb.chips()).toEqual(["Paris"])
    })
  }
})
