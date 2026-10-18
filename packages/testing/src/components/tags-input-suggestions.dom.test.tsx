// Tags Input Suggestions (tags-input "Suggestions", combobox-pattern) through the driver.
import { TagsInput, type TagsInputRootProps } from "@rind-ui/react"
import { render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { getTagsInput, installAnnouncementLog } from "../index"

const ITEMS = ["Partner", "Party", "Apple", "Apricot"].map((label) => ({
  key: label.toLowerCase(),
  label,
}))

function Tags(props: Partial<TagsInputRootProps>) {
  return (
    <TagsInput.Root items={ITEMS} {...props}>
      <TagsInput.Label>Tags</TagsInput.Label>
      <TagsInput.Control>
        <TagsInput.Chips />
        <TagsInput.Input />
      </TagsInput.Control>
      <TagsInput.Positioner>
        <TagsInput.Popup>
          <TagsInput.List>
            <TagsInput.Items />
          </TagsInput.List>
          <TagsInput.Empty>No match</TagsInput.Empty>
        </TagsInput.Popup>
      </TagsInput.Positioner>
    </TagsInput.Root>
  )
}

const ti = () => getTagsInput(screen, { name: "Tags" })
const input = () => screen.getByRole("combobox", { name: "Tags" }) as HTMLInputElement
const user = async () => (await import("@testing-library/user-event")).userEvent.setup()

describe("Tags Input suggestions", () => {
  it("the input is a combobox over a listbox named by the label; options are never selected", async () => {
    render(<Tags />)
    expect(input().getAttribute("aria-expanded")).toBe("false")
    await ti().type("pa")
    await waitFor(() => expect(input().getAttribute("aria-expanded")).toBe("true"))
    const list = screen.getByRole("listbox", { name: "Tags" })
    expect(input().getAttribute("aria-controls")).toBe(list.id)
    expect(await ti().items()).toEqual(["Partner", "Party"])
    for (const o of screen.getAllByRole("option"))
      expect(o.getAttribute("aria-selected")).toBe("false")
  })

  it("one commit per action: paste, Enter, remove, choose (zag#1661, ark#2742)", async () => {
    const onValueChange = vi.fn()
    render(<Tags onValueChange={onValueChange} />)
    // No delimiter: the paste stays text.
    await ti().paste("part")
    expect(await ti().inputValue()).toBe("part")
    await ti().pressEnter()
    await ti().removeTag("part")
    await ti().type("part")
    await ti().choose("Partner")
    expect(onValueChange.mock.calls.map((c) => c[0])).toEqual([["part"], [], ["partner"]])
    expect(onValueChange).toHaveBeenLastCalledWith(["partner"], { reason: "item-press" })
    // The chip shows the option's text; the draft is cleared, the popup stays open.
    expect(await ti().tags()).toEqual(["Partner"])
    expect(await ti().inputValue()).toBe("")
    expect(await ti().isOpen()).toBe(true)
  })

  it("Enter on a highlighted suggestion does not submit the form; Escape closes", async () => {
    const onSubmit = vi.fn((e: { preventDefault(): void }) => e.preventDefault())
    render(
      <form onSubmit={onSubmit}>
        <Tags />
      </form>,
    )
    await ti().choose("Apple")
    expect(await ti().tags()).toEqual(["Apple"])
    expect(onSubmit).not.toHaveBeenCalled()
    // A chosen option leaves the list.
    expect(await ti().items()).not.toContain("Apple")
    await ti().close()
    expect(await ti().isOpen()).toBe(false)
  })

  it("remove buttons work with suggestions open (reka-ui#1579)", async () => {
    render(<Tags defaultValue={["apple"]} />)
    await ti().type("pa")
    await waitFor(async () => expect(await ti().isOpen()).toBe(true))
    await (await user()).click(screen.getByRole("button", { name: "Remove Apple" }))
    expect(await ti().tags()).toEqual([])
    expect(await ti().inputValue()).toBe("pa")
    expect(await ti().isOpen()).toBe(true)
    expect(document.activeElement).toBe(input())
  })

  it("choosing a suggestion is not a blur (reka-ui#2259)", async () => {
    render(<Tags blurBehavior="add" />)
    await ti().type("a")
    // A press on the option (the driver waits for the popup to be placed).
    await ti().choose("Apple")
    expect(await ti().tags()).toEqual(["Apple"])
    await ti().tabOut()
    expect(await ti().tags()).toEqual(["Apple"])
  })

  it("allowCustom false refuses typed text with reason invalid; the addition is announced", async () => {
    const log = installAnnouncementLog()
    const onRefuse = vi.fn()
    render(<Tags allowCustom={false} onRefuse={onRefuse} />)
    await ti().type("zzz")
    await ti().pressEnter()
    expect(onRefuse).toHaveBeenCalledWith({ reason: "invalid", text: "zzz" })
    expect(await ti().tags()).toEqual([])
    await ti().clearText()
    await ti().choose("Party")
    await waitFor(() => expect(log.map((a) => a.message)).toContain("Party added"))
  })

  it("no results: the listbox is hidden, the Empty part shows outside it", async () => {
    render(<Tags />)
    await ti().type("qq")
    await waitFor(async () => expect(await ti().isEmpty()).toBe(true))
    const empty = screen.getByText("No match")
    expect(empty.closest('[role="listbox"]')).toBeNull()
  })
})
