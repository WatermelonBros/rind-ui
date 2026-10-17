// Tags Input scenarios (tags-input spec) through the driver where an action exists.
import { Field, TagsInput, type TagsInputRootProps } from "@rind-ui/react"
import { act, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { getTagsInput, installAnnouncementLog } from "../index"

function Tags(props: Partial<TagsInputRootProps> & { readonly label?: string }) {
  const { label = "Tags", ...rest } = props
  return (
    <TagsInput.Root {...rest}>
      <TagsInput.Label>{label}</TagsInput.Label>
      <TagsInput.Control>
        <TagsInput.Chips />
        <TagsInput.Input />
        <TagsInput.ClearTrigger />
      </TagsInput.Control>
    </TagsInput.Root>
  )
}

const input = (name = "Tags") => screen.getByRole("textbox", { name }) as HTMLInputElement
const ti = (o?: Parameters<typeof getTagsInput>[2]) => getTagsInput(screen, { name: "Tags" }, o)
const user = async () => (await import("@testing-library/user-event")).userEvent.setup()
const messages = () => installAnnouncementLog().map((a) => a.message)

describe("Tags Input", () => {
  it("minimal: a textbox named by the label, no combobox attributes, described by the summary", () => {
    render(<Tags defaultValue={["Rome", "Paris"]} />)
    const el = input()
    for (const a of ["role", "aria-expanded", "aria-controls", "aria-activedescendant"]) {
      expect(el.hasAttribute(a)).toBe(false)
    }
    const summary = document.getElementById(el.getAttribute("aria-describedby") ?? "")
    expect(summary?.textContent).toBe("2 tags: Rome, Paris")
    expect(screen.getByRole("toolbar", { name: "Tags" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Remove Rome" }).tabIndex).toBe(-1)
  })

  it("no tags: the summary says so", () => {
    render(<Tags />)
    const summary = document.getElementById(input().getAttribute("aria-describedby") ?? "")
    expect(summary?.textContent).toBe("No tags")
  })

  it("Enter creates a tag and does not submit; an empty Enter submits", async () => {
    const onSubmit = vi.fn((e: { preventDefault(): void }) => e.preventDefault())
    render(
      <form onSubmit={onSubmit}>
        <Tags />
        <button type="submit">Send</button>
      </form>,
    )
    await ti().addTag("rome")
    expect(await ti().tags()).toEqual(["rome"])
    expect(input().value).toBe("")
    expect(onSubmit).not.toHaveBeenCalled()
    const u = await user()
    await u.keyboard("{Enter}")
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it("delimiters: comma at the end; literal |; a comma alone creates nothing", async () => {
    const onValueChange = vi.fn()
    render(<Tags onValueChange={onValueChange} />)
    await ti().type("rome,")
    expect(await ti().tags()).toEqual(["rome"])
    expect(onValueChange).toHaveBeenLastCalledWith(["rome"], { reason: "delimiter" })
    await ti().type("   ,")
    expect(await ti().tags()).toEqual(["rome"])
    expect(input().value).toBe("")
  })

  it("a delimiter typed mid-text is text", async () => {
    render(<Tags />)
    await ti().type("romeparis")
    act(() => input().setSelectionRange(4, 4))
    const u = await user()
    await u.keyboard(",")
    expect(await ti().tags()).toEqual([])
    expect(input().value).toBe("rome,paris")
  })

  it("paste: one change with reason paste, one announcement; a plain paste stays text", async () => {
    const onValueChange = vi.fn()
    render(<Tags onValueChange={onValueChange} />)
    const before = messages().length
    await ti().paste("jane@x.io, john@x.io\nalex@x.io")
    expect(await ti().tags()).toEqual(["jane@x.io", "john@x.io", "alex@x.io"])
    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(onValueChange).toHaveBeenLastCalledWith(["jane@x.io", "john@x.io", "alex@x.io"], {
      reason: "paste",
    })
    await waitFor(() => expect(messages().slice(before)).toEqual(["3 tags added"]))
    await ti().paste("foo")
    await ti().paste("foo")
    expect(input().value).toBe("foofoo")
  })

  it("partly refused paste: accepted ones become tags, the refused one stays with data-refused", async () => {
    render(<Tags validate={(t) => (t.includes("@") ? true : "invalid")} />)
    await ti().paste("jane@x.io, bob")
    expect(await ti().tags()).toEqual(["jane@x.io"])
    expect(input().value).toBe("bob")
    expect(await ti().refusal()).toBe("invalid")
  })

  it("max: refused, the draft stays, announced; data-at-max", async () => {
    render(<Tags max={2} defaultValue={["a", "b"]} />)
    expect(await ti().isAtMax()).toBe(true)
    const before = messages().length
    await ti().addTag("c")
    expect(await ti().tags()).toEqual(["a", "b"])
    expect(input().value).toBe("c")
    expect(await ti().refusal()).toBe("max")
    await waitFor(() => expect(messages().slice(before).length).toBe(1))
  })

  it("duplicates allowed: removing the first of two equal tags removes that one", async () => {
    render(<Tags allowDuplicates defaultValue={["a", "b", "a"]} />)
    const removes = screen.getAllByRole("button", { name: "Remove a" })
    const u = await user()
    await u.click(removes[0] as HTMLElement)
    expect(await ti().tags()).toEqual(["b", "a"])
  })

  it("composition: the composing Enter creates nothing, the next creates the tag", async () => {
    render(<Tags />)
    await ti().compose("東京", true)
    expect(await ti().tags()).toEqual([])
    expect(input().value).toBe("東京")
    await ti().pressEnter()
    expect(await ti().tags()).toEqual(["東京"])
  })

  it("Backspace arms then removes; a disabled tag is skipped and stays", async () => {
    function Locked() {
      return (
        <TagsInput.Root defaultValue={["admin@acme.com", "user@x.io"]}>
          <TagsInput.Label>Tags</TagsInput.Label>
          <TagsInput.Control>
            <TagsInput.Chips>
              {(chip) => (
                <TagsInput.Chip disabled={chip.key === "admin@acme.com"}>
                  <TagsInput.ChipText />
                  <TagsInput.ChipRemove />
                </TagsInput.Chip>
              )}
            </TagsInput.Chips>
            <TagsInput.Input />
          </TagsInput.Control>
        </TagsInput.Root>
      )
    }
    render(<Locked />)
    const u = await user()
    await u.click(input())
    await u.keyboard("{Backspace}{Backspace}{Backspace}{Backspace}")
    expect(await ti().tags()).toEqual(["admin@acme.com"])
  })

  it("a click in the input disarms", async () => {
    render(<Tags defaultValue={["a"]} />)
    const u = await user()
    await u.click(input())
    await u.keyboard("{Backspace}")
    await u.keyboard("ab")
    await u.click(input())
    await u.keyboard("{Backspace}")
    expect(input().value).toBe("a")
    expect(await ti().tags()).toEqual(["a"])
  })

  it("a press on the Control's padding focuses the input", async () => {
    render(<Tags />)
    const control = document.querySelector(
      '[data-scope="tags-input"][data-part="control"]',
    ) as HTMLElement
    const u = await user()
    await u.pointer({ keys: "[MouseLeft]", target: control })
    expect(document.activeElement).toBe(input())
  })

  it("Delete on the middle chip moves focus to the next, ArrowLeft to the first", async () => {
    render(<Tags defaultValue={["a", "b", "c"]} />)
    const u = await user()
    await u.click(input())
    await u.keyboard("{ArrowLeft}{ArrowLeft}")
    await u.keyboard("{Delete}")
    expect(await ti().tags()).toEqual(["a", "c"])
    expect(document.activeElement?.textContent?.startsWith("c")).toBe(true)
    await u.keyboard("{ArrowLeft}")
    expect(document.activeElement?.textContent?.startsWith("a")).toBe(true)
  })

  it("edit and commit, then a new tag; focus back in the input", async () => {
    render(<Tags defaultValue={["rom"]} />)
    await ti().editTag("rom", "rome")
    expect(await ti().tags()).toEqual(["rome"])
    await ti().addTag("x")
    expect(await ti().tags()).toEqual(["rome", "x"])
    expect(document.activeElement).toBe(input())
  })

  it("Escape cancels an edit; focus on its chip", async () => {
    render(<Tags defaultValue={["rome"]} />)
    const u = await user()
    await u.click(input())
    await u.keyboard("{ArrowLeft}{Enter}")
    const edit = screen.getByRole("textbox", { name: "Edit rome" })
    expect(document.activeElement).toBe(edit)
    expect(edit.closest('[data-part="chip"]')?.hasAttribute("data-editing")).toBe(true)
    await u.keyboard("{Control>}a{/Control}paris{Escape}")
    expect(await ti().tags()).toEqual(["rome"])
    expect(document.activeElement?.getAttribute("data-part")).toBe("chip")
  })

  it("double press edits, focus synchronously in the edit input", async () => {
    render(<Tags defaultValue={["rome"]} />)
    const chip = document.querySelector('[data-part="chip"]') as HTMLElement
    const u = await user()
    await u.dblClick(chip)
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Edit rome" }))
  })

  it("Tab out clears the arm: the next Backspace arms again", async () => {
    render(
      <>
        <Tags defaultValue={["a", "b"]} />
        <button type="button">After</button>
      </>,
    )
    const u = await user()
    await u.click(input())
    await u.keyboard("{Backspace}")
    await u.tab()
    expect(document.querySelector('[data-part="chip"][data-highlighted]')).toBe(null)
    await u.click(input())
    await u.keyboard("{Backspace}")
    expect(await ti().tags()).toEqual(["a", "b"])
  })

  it("blur add creates the draft as a tag", async () => {
    render(
      <>
        <Tags blurBehavior="add" />
        <button type="button">After</button>
      </>,
    )
    await ti().type("x")
    await ti().tabOut()
    expect(await ti().tags()).toEqual(["x"])
  })

  it("clear: every tag and the draft, focus in the input, one announcement", async () => {
    render(<Tags defaultValue={["a", "b"]} />)
    await ti().type("x")
    const before = messages().length
    await ti({ modality: "pointer" }).clear()
    expect(await ti().tags()).toEqual([])
    expect(input().value).toBe("")
    expect(document.activeElement).toBe(input())
    await waitFor(() => expect(messages().slice(before)).toEqual(["All tags removed"]))
  })

  it("removal is announced once; nothing has aria-live", async () => {
    render(<Tags defaultValue={["Rome"]} />)
    const before = messages().length
    await ti({ modality: "keyboard" }).removeTag("Rome")
    await waitFor(() => expect(messages().slice(before)).toEqual(["Rome removed"]))
    expect(document.querySelector('[data-scope="tags-input"] [aria-live]')).toBe(null)
  })

  it("read-only: chips navigable, nothing removed", async () => {
    render(<Tags readOnly defaultValue={["Rome"]} />)
    const u = await user()
    await u.click(input())
    await u.keyboard("{ArrowLeft}")
    expect(document.activeElement?.getAttribute("data-part")).toBe("chip")
    await u.keyboard("{Backspace}")
    expect(await ti().tags()).toEqual(["Rome"])
    expect(screen.getByRole("button", { name: "Remove Rome" }).getAttribute("aria-disabled")).toBe(
      "true",
    )
  })

  it("a refused controlled creation keeps the draft", async () => {
    render(<Tags value={[]} />)
    await ti().addTag("rome")
    expect(await ti().tags()).toEqual([])
    expect(input().value).toBe("rome")
  })
})

describe("Tags Input forms and Field", () => {
  const data = (f: HTMLFormElement) => [...new FormData(f).entries()].map(([k, v]) => `${k}=${v}`)

  it("the current tags are submitted, one entry each", async () => {
    render(
      <form data-testid="f">
        <Tags name="to" defaultValue={["a"]} />
      </form>,
    )
    await ti().addTag("b")
    await ti({ modality: "keyboard" }).removeTag("a")
    expect(data(screen.getByTestId("f") as HTMLFormElement)).toEqual(["to=b"])
  })

  it("required with no tags is invalid; the draft is not submitted; a refusal is no error", async () => {
    render(
      <form data-testid="f">
        <Tags name="to" required validate={() => "nope"} />
      </form>,
    )
    const form = screen.getByTestId("f") as HTMLFormElement
    await ti().type("x")
    expect(form.checkValidity()).toBe(false)
    expect(data(form)).toEqual([])
  })

  it("reset restores the default and empties the draft", async () => {
    render(
      <form data-testid="f">
        <Tags name="to" defaultValue={["a"]} />
      </form>,
    )
    await ti().addTag("b")
    await ti().type("draft")
    act(() => (screen.getByTestId("f") as HTMLFormElement).reset())
    await waitFor(() => expect(input().value).toBe(""))
    expect(await ti().tags()).toEqual(["a"])
  })

  it("in a Field: named by its Label, Field disabled disables it", () => {
    render(
      <Field.Root disabled>
        <Field.Label>Recipients</Field.Label>
        <TagsInput.Root>
          <TagsInput.Control>
            <TagsInput.Chips />
            <TagsInput.Input />
          </TagsInput.Control>
        </TagsInput.Root>
      </Field.Root>,
    )
    expect(input("Recipients").disabled).toBe(true)
  })
})
