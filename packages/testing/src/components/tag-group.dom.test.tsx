// Tag Group through its driver (task 5.1): the spec scenarios that run unchanged in jsdom and in
// real browsers. Removal goes through a consumer `onRemove` that drops the keys.
import { domEnvironment } from "@rind-ui/core"
import { Dialog, Listbox, RindProvider, TagGroup, type TagGroupRootProps } from "@rind-ui/react"
import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import axe from "axe-core"
import { useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { getTagGroup, installAnnouncementLog } from "../index"

const platform = domEnvironment().platform
const tg = (name = "Cities", modality?: "keyboard" | "pointer") =>
  getTagGroup(screen, { name }, { platform, ...(modality ? { modality } : {}) })
const row = (name: string) => screen.getByRole("row", { name })

type Item = { readonly key: string; readonly disabled?: boolean; readonly href?: string }

/** A group whose `onRemove` drops the keys from its data (or keeps them with `refuse`). */
function Cities(
  props: Partial<TagGroupRootProps> & {
    readonly initial?: readonly (string | Item)[]
    readonly refuse?: boolean
    readonly removable?: boolean
  },
) {
  const { initial = ["Rome", "Paris", "Oslo"], refuse, removable = true, ...root } = props
  const [items, setItems] = useState<readonly Item[]>(
    initial.map((i) => (typeof i === "string" ? { key: i } : i)),
  )
  const onRemove = (keys: readonly string[]) => {
    if (!refuse) setItems((all) => all.filter((i) => !keys.includes(i.key)))
  }
  return (
    <>
      <button type="button">Before</button>
      <TagGroup.Root {...(root as TagGroupRootProps)} {...(removable ? { onRemove } : {})}>
        <TagGroup.Label>Cities</TagGroup.Label>
        <TagGroup.List>
          {items.map((i) => (
            <TagGroup.Tag key={i.key} value={i.key} disabled={i.disabled} href={i.href}>
              <TagGroup.TagText>{i.key}</TagGroup.TagText>
              <TagGroup.TagRemove />
            </TagGroup.Tag>
          ))}
          <TagGroup.Empty>No cities</TagGroup.Empty>
        </TagGroup.List>
      </TagGroup.Root>
      <button type="button">After</button>
    </>
  )
}

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

afterEach(() => vi.restoreAllMocks())

describe("roles and names", () => {
  it("Minimal removable group: a grid of rows, each with one gridcell and a named button", async () => {
    render(<Cities />)
    expect(screen.getByRole("grid", { name: "Cities" })).toBeTruthy()
    expect(screen.getAllByRole("row")).toHaveLength(3)
    expect(screen.getAllByRole("gridcell")).toHaveLength(3)
    expect(screen.getByRole("button", { name: "Remove Rome" })).toBeTruthy()
    await a11y()
  })

  it("Row name excludes the remove button (RS#3070)", () => {
    render(<Cities />)
    expect(row("Rome")).toBeTruthy()
  })

  it("Display-only tags: a list of listitems, never focused by Tab", async () => {
    const user = userEvent.setup()
    render(<Cities removable={false} />)
    expect(screen.getByRole("list", { name: "Cities" })).toBeTruthy()
    expect(screen.getAllByRole("listitem")).toHaveLength(3)
    screen.getByRole("button", { name: "Before" }).focus()
    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "After" }))
    await a11y()
  })

  it("Data and static tags agree", () => {
    const { container: a } = render(
      <TagGroup.Root items={[{ key: "x", label: "X" }]} id="g" onRemove={() => {}}>
        <TagGroup.Label>G</TagGroup.Label>
        <TagGroup.List>
          <TagGroup.Tags />
        </TagGroup.List>
      </TagGroup.Root>,
    )
    const { container: b } = render(
      <TagGroup.Root id="g" onRemove={() => {}}>
        <TagGroup.Label>G</TagGroup.Label>
        <TagGroup.List>
          <TagGroup.Tag value="x" textValue="X">
            <TagGroup.TagText>X</TagGroup.TagText>
            <TagGroup.TagRemove />
          </TagGroup.Tag>
        </TagGroup.List>
      </TagGroup.Root>,
    )
    // Same elements and attributes (React may set them in a different order).
    const shape = (root: Element) =>
      [...root.querySelectorAll("*")].map((el) =>
        [el.tagName, ...[...el.attributes].map((x) => `${x.name}=${x.value}`).sort()].join(" "),
      )
    expect(shape(b)).toEqual(shape(a))
  })
})

describe("focus and navigation", () => {
  it("One Tab stop (RS#9822); Shift+Tab leaves in one step (RS#9532)", async () => {
    const user = userEvent.setup()
    render(<Cities />)
    screen.getByRole("button", { name: "Before" }).focus()
    await user.tab()
    expect(document.activeElement).toBe(row("Rome"))
    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "After" }))
    await user.tab({ shift: true })
    await user.keyboard("{ArrowRight}{ArrowRight}")
    expect(document.activeElement).toBe(row("Oslo"))
    await user.tab({ shift: true })
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Before" }))
  })

  it("both arrow pairs, Home/End, loop", async () => {
    const user = userEvent.setup()
    render(<Cities />)
    row("Rome").focus()
    await user.keyboard("{ArrowDown}")
    expect(document.activeElement).toBe(row("Paris"))
    await user.keyboard("{End}")
    expect(document.activeElement).toBe(row("Oslo"))
    await user.keyboard("{ArrowRight}")
    expect(document.activeElement).toBe(row("Rome"))
    await user.keyboard("{ArrowUp}")
    expect(document.activeElement).toBe(row("Oslo"))
  })

  it("RTL: ArrowLeft moves to the next tag", async () => {
    const user = userEvent.setup()
    render(
      <RindProvider dir="rtl">
        <Cities />
      </RindProvider>,
    )
    row("Rome").focus()
    await user.keyboard("{ArrowLeft}")
    expect(document.activeElement).toBe(row("Paris"))
  })
})

describe("locating by a set of roles (component-contract amendment, RS#8354)", () => {
  it("an emptied group is still located; a second list with the name makes it fail", async () => {
    const user = userEvent.setup()
    const { unmount } = render(<Cities initial={["Rome"]} />)
    expect(await tg().tags()).toEqual(["Rome"])
    row("Rome").focus()
    await user.keyboard("{Delete}")
    expect(await tg().isEmpty()).toBe(true)
    unmount()
    render(
      <>
        <Cities initial={["Rome"]} />
        <ul aria-label="Cities">
          <li>Other</li>
        </ul>
      </>,
    )
    await expect(tg().tags()).rejects.toThrow(
      /role "grid \| group \| list" named "Cities"[\s\S]*<ul/,
    )
  })
})

describe("removal", () => {
  it("Driver round trip: remove by keyboard, focus on the neighbour, announced", async () => {
    const log = installAnnouncementLog()
    render(<Cities initial={["Rome", "Paris"]} />)
    await tg("Cities", "keyboard").remove("Rome")
    expect(await tg().tags()).toEqual(["Paris"])
    expect(await tg().focusedItem()).toBe("Paris")
    await waitFor(() => expect(log.map((a) => a.message)).toEqual(["Rome removed"]))
  })

  it("Focus is never lost (RS#9471, #4224)", async () => {
    const user = userEvent.setup()
    render(<Cities />)
    row("Paris").focus()
    await user.keyboard("{Delete}")
    expect(document.activeElement).toBe(row("Oslo"))
  })

  it("Last tag removed: focus on the List, a named group (RS#8354)", async () => {
    const user = userEvent.setup()
    render(<Cities initial={["Rome"]} />)
    row("Rome").focus()
    await user.keyboard("{Backspace}")
    const group = screen.getByRole("group", { name: "Cities" })
    expect(document.activeElement).toBe(group)
    expect(group.textContent).toContain("No cities")
    await a11y()
  })

  it("Removal by pointer: the clicked button's tag goes, focus moves after it", async () => {
    const user = userEvent.setup()
    render(<Cities />)
    row("Rome").focus()
    await user.click(screen.getByRole("button", { name: "Remove Paris" }))
    expect(screen.queryByRole("row", { name: "Paris" })).toBeNull()
    expect(document.activeElement).toBe(row("Oslo"))
  })

  it("Consumer keeps the tag: it stays focused and nothing is announced", async () => {
    const log = installAnnouncementLog()
    const user = userEvent.setup()
    render(<Cities refuse />)
    row("Rome").focus()
    await user.keyboard("{Delete}")
    expect(document.activeElement).toBe(row("Rome"))
    expect(log).toEqual([])
  })

  it("Remove does not select; Enter selects a selectable tag and never removes", async () => {
    const onValueChange = vi.fn()
    const user = userEvent.setup()
    render(<Cities selectionMode="multiple" defaultValue={[]} onValueChange={onValueChange} />)
    await user.click(screen.getByRole("button", { name: "Remove Rome" }))
    expect(onValueChange).not.toHaveBeenCalled()
    row("Paris").focus()
    await user.keyboard("{Enter}")
    expect(row("Paris").getAttribute("aria-selected")).toBe("true")
    expect(screen.getAllByRole("row")).toHaveLength(2)
  })

  it("Enter removes a remove-only tag (RS#7483)", async () => {
    const user = userEvent.setup()
    render(<Cities />)
    row("Rome").focus()
    await user.keyboard("{Enter}")
    expect(screen.queryByRole("row", { name: "Rome" })).toBeNull()
  })
})

describe("hint, selection, actions, links", () => {
  it("Hint on the focused row for keyboard users, none for mouse users", async () => {
    const user = userEvent.setup()
    render(<Cities />)
    row("Rome").focus()
    await user.keyboard("{ArrowRight}")
    const id = row("Paris").getAttribute("aria-describedby")
    expect(id && document.getElementById(id)?.textContent).toBe("Press Delete to remove")
    await user.click(row("Oslo"))
    expect(row("Oslo").getAttribute("aria-describedby")).toBeNull()
  })

  it("Filter chips: Space toggles, Escape is left alone", async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(
      <Cities
        removable={false}
        selectionMode="multiple"
        defaultValue={[]}
        onValueChange={onValueChange}
      />,
    )
    row("Rome").focus()
    await user.keyboard(" {ArrowRight} ")
    expect(onValueChange).toHaveBeenLastCalledWith(["Rome", "Paris"], expect.anything())
    expect(row("Rome").getAttribute("aria-selected")).toBe("true")
  })

  it("Escape inside a dialog closes it and keeps the selection", async () => {
    const user = userEvent.setup()
    render(
      <Dialog.Root defaultOpen>
        <Dialog.Portal>
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Title>Filters</Dialog.Title>
              <Cities removable={false} selectionMode="single" defaultValue="Rome" />
            </Dialog.Content>
          </Dialog.Positioner>
        </Dialog.Portal>
      </Dialog.Root>,
    )
    row("Rome").focus()
    await user.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  })

  it("Actionable tags (RS#9205): Enter calls onAction once", async () => {
    const user = userEvent.setup()
    const onAction = vi.fn()
    render(<Cities removable={false} onAction={onAction} />)
    row("Paris").focus()
    await user.keyboard("{Enter}")
    expect(onAction).toHaveBeenCalledTimes(1)
    expect(onAction.mock.calls[0]?.[0]).toBe("Paris")
  })

  it("Link tag: Enter clicks the anchor once; the anchor is out of the Tab order", async () => {
    const user = userEvent.setup()
    const clicks = vi.fn((e: Event) => e.preventDefault())
    document.addEventListener("click", clicks)
    render(<Cities removable={false} initial={[{ key: "React", href: "/tags/react" }]} />)
    const link = screen.getByRole("link", { name: "React" })
    expect(link.getAttribute("tabindex")).toBe("-1")
    row("React").focus()
    await user.keyboard("{Enter}")
    expect(clicks.mock.calls.filter(([e]) => e.target === link)).toHaveLength(1)
    document.removeEventListener("click", clicks)
  })

  it("Disabled tags are discoverable (RS#3074); a disabled group has no Tab stop", async () => {
    const user = userEvent.setup()
    const { unmount } = render(<Cities initial={["a", { key: "b", disabled: true }, "c"]} />)
    row("a").focus()
    await user.keyboard("{ArrowRight}")
    expect(document.activeElement).toBe(row("b"))
    expect(row("b").getAttribute("aria-disabled")).toBe("true")
    unmount()
    render(<Cities disabled />)
    screen.getByRole("button", { name: "Before" }).focus()
    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "After" }))
  })
})

describe("development warnings", () => {
  it("Tag Group in an option (RS#8740): a warning, and the page renders", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    render(
      <Listbox.Root>
        <Listbox.Label>Options</Listbox.Label>
        <Listbox.List>
          <Listbox.Item value="x">
            <Cities />
          </Listbox.Item>
        </Listbox.List>
      </Listbox.Root>,
    )
    await waitFor(() =>
      expect(warn.mock.calls.flat().join(" ")).toMatch(/TagGroup: a Tag Group is inside a option/),
    )
  })

  it("an interactive list without a name warns", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    render(
      <TagGroup.Root onRemove={() => {}}>
        <TagGroup.List>
          <TagGroup.Tag value="x">
            <TagGroup.TagText>x</TagGroup.TagText>
          </TagGroup.Tag>
        </TagGroup.List>
      </TagGroup.Root>,
    )
    await waitFor(() => expect(warn.mock.calls.flat().join(" ")).toMatch(/no accessible name/))
  })

  it("Messages: a localised remove label", () => {
    render(<Cities messages={{ removeLabel: (t) => `Rimuovi ${t}` }} initial={["Roma"]} />)
    expect(screen.getByRole("button", { name: "Rimuovi Roma" })).toBeTruthy()
  })
})

describe("server render", () => {
  it("hydrates with the tab stop on the selected or first tag", async () => {
    const { renderToString } = await import("react-dom/server")
    const { hydrateRoot } = await import("react-dom/client")
    const tree = (
      <TagGroup.Root
        items={[
          { key: "a", label: "a" },
          { key: "b", label: "b" },
        ]}
        selectionMode="single"
        defaultValue="b"
        onRemove={() => {}}
      >
        <TagGroup.Label>Server</TagGroup.Label>
        <TagGroup.List>
          <TagGroup.Tags />
        </TagGroup.List>
      </TagGroup.Root>
    )
    const container = document.createElement("div")
    container.innerHTML = renderToString(tree)
    document.body.append(container)
    const error = vi.spyOn(console, "error")
    await act(async () => {
      hydrateRoot(container, tree)
    })
    expect(error).not.toHaveBeenCalled()
    const stops = [...container.querySelectorAll('[role="row"]')].filter(
      (r) => r.getAttribute("tabindex") === "0",
    )
    expect(stops.map((r) => r.textContent)).toEqual(["b"])
    container.remove()
  })
})

describe("empty state", () => {
  it("Empty inside List shows when the group starts with no tags", async () => {
    render(
      <TagGroup.Root onRemove={() => {}}>
        <TagGroup.Label>Saved filters</TagGroup.Label>
        <TagGroup.List>
          <TagGroup.Empty>No filters saved</TagGroup.Empty>
        </TagGroup.List>
      </TagGroup.Root>,
    )
    await waitFor(() => expect(screen.getByText("No filters saved")).toBeTruthy())
  })
})
