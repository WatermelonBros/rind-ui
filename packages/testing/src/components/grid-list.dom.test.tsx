// Grid List through its driver (tasks 4.x, 5.1): the collection-grid and grid-list scenarios
// that run unchanged in jsdom and in real browsers. Spatial moves need layout: the browser
// test measures them; here they fall back to collection order.
import { domEnvironment, platforms } from "@rind-ui/core"
import { GridList, type GridListRootProps, RindProvider, TagGroup } from "@rind-ui/react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import axe from "axe-core"
import { type ReactNode, useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { getGridList, installAnnouncementLog } from "../index"

const platform = domEnvironment().platform
const gl = (modality?: "keyboard" | "pointer") =>
  getGridList(screen, { name: "People" }, { platform, ...(modality ? { modality } : {}) })
const row = (name: string) => screen.getByRole("row", { name })
const button = (name: string) => screen.getByRole("button", { name })

type Person = { readonly key: string; readonly disabled?: boolean; readonly href?: string }

/** A list of people; each row may hold a checkbox, two buttons, a field or a nested group. */
function People(
  props: Partial<GridListRootProps> & {
    readonly people?: readonly (string | Person)[]
    readonly checkbox?: boolean
    readonly buttons?: boolean
    readonly field?: boolean
    readonly extra?: (key: string) => ReactNode
    readonly onEdit?: (key: string) => void
  },
) {
  const {
    people = ["Ada", "Grace", "Alan"],
    checkbox,
    buttons = true,
    field,
    extra,
    onEdit,
    ...root
  } = props
  const rows = people.map((p) => (typeof p === "string" ? { key: p } : p))
  return (
    <>
      <button type="button">Before</button>
      <GridList.Root {...(root as GridListRootProps)}>
        <GridList.Label>People</GridList.Label>
        <GridList.List>
          {rows.map((p) => (
            <GridList.Item key={p.key} value={p.key} disabled={p.disabled} href={p.href}>
              {checkbox ? <GridList.ItemCheckbox /> : null}
              <GridList.ItemText>{p.key}</GridList.ItemText>
              {field ? (
                <GridList.ItemControl
                  render={(props) => <input {...props} aria-label={`Note for ${p.key}`} />}
                />
              ) : null}
              {buttons ? (
                <>
                  <GridList.ItemControl onClick={() => onEdit?.(p.key)}>Edit</GridList.ItemControl>
                  <GridList.ItemControl>Delete</GridList.ItemControl>
                </>
              ) : null}
              {extra?.(p.key)}
            </GridList.Item>
          ))}
          <GridList.Empty>No people</GridList.Empty>
        </GridList.List>
      </GridList.Root>
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
const controlsOf = (name: string) =>
  [...row(name).querySelectorAll<HTMLElement>('[data-part="item-control"]')].map((c) => c.tabIndex)

afterEach(() => vi.restoreAllMocks())

describe("roles and names", () => {
  it("Minimal list: a named grid of rows with one gridcell each", async () => {
    render(<People />)
    expect(screen.getByRole("grid", { name: "People" })).toBeTruthy()
    expect(screen.getAllByRole("row")).toHaveLength(3)
    expect(screen.getAllByRole("gridcell")).toHaveLength(3)
    expect(row("Ada").hasAttribute("aria-selected")).toBe(false)
    await a11y()
  })

  it("Focused row reads its text only (RS#2946)", () => {
    render(<People checkbox selectionMode="multiple" />)
    expect(row("Ada")).toBeTruthy()
    expect(screen.getByRole("checkbox", { name: "Select Ada" })).toBeTruthy()
  })

  it("Empty list: a named group with the Empty content (RS#8354)", async () => {
    const { rerender } = render(<People people={["Ada"]} />)
    rerender(<People people={[]} />)
    expect(screen.getByRole("group", { name: "People" })).toBeTruthy()
    expect(screen.queryByRole("grid")).toBeNull()
    expect(screen.getByText("No people")).toBeTruthy()
    expect(await gl().isEmpty()).toBe(true)
    await a11y()
  })

  it("Data and static items agree", () => {
    const { container, unmount } = render(<People buttons={false} />)
    const attrs = (root: Element) =>
      [...root.querySelectorAll('[role="row"]')].map((r) =>
        Object.fromEntries(
          [...r.attributes].filter((a) => a.name !== "id").map((a) => [a.name, a.value]),
        ),
      )
    const fromParts = attrs(container)
    unmount()
    const data = render(
      <GridList.Root items={["Ada", "Grace", "Alan"].map((k) => ({ key: k, label: k }))}>
        <GridList.Label>People</GridList.Label>
        <GridList.List>
          <GridList.Items />
        </GridList.List>
      </GridList.Root>,
    )
    const strip = (rows: Record<string, string>[]) =>
      rows.map(({ "aria-labelledby": _l, "data-instance": _i, ...r }) => r)
    expect(strip(attrs(data.container))).toEqual(strip(fromParts))
  })
})

describe("child navigation", () => {
  it("Arrow into controls; ArrowLeft returns; no wrap at the end", async () => {
    const user = userEvent.setup()
    render(<People />)
    expect(controlsOf("Grace")).toEqual([-1, -1])
    row("Grace").focus()
    await user.keyboard("{ArrowRight}")
    expect(document.activeElement).toBe(row("Grace").querySelectorAll("button")[0])
    expect(row("Grace").hasAttribute("data-child-focused")).toBe(true)
    expect(await gl().highlighted()).toBe("Grace")
    await user.keyboard("{ArrowRight}{ArrowRight}")
    expect(document.activeElement?.textContent).toBe("Delete")
    await user.keyboard("{ArrowLeft}{ArrowLeft}")
    expect(document.activeElement).toBe(row("Grace"))
  })

  it("ArrowDown on a control moves to the next row; Escape returns to the row", async () => {
    const user = userEvent.setup()
    render(<People />)
    row("Ada").focus()
    await user.keyboard("{ArrowRight}{Escape}")
    expect(document.activeElement).toBe(row("Ada"))
    await user.keyboard("{ArrowRight}{ArrowDown}")
    expect(await gl().highlighted()).toBe("Grace")
    expect(document.activeElement).toBe(row("Grace"))
  })

  it("RTL mirrors: ArrowLeft enters the controls", async () => {
    const user = userEvent.setup()
    render(
      <RindProvider dir="rtl">
        <People />
      </RindProvider>,
    )
    row("Ada").focus()
    await user.keyboard("{ArrowLeft}")
    expect(document.activeElement?.textContent).toBe("Edit")
  })

  it("Tab mode order: the highlighted row's controls only, then out", async () => {
    const user = userEvent.setup()
    render(<People childNavigation="tab" />)
    button("Before").focus()
    await user.tab()
    expect(document.activeElement).toBe(row("Ada"))
    await user.keyboard("{ArrowDown}")
    expect(controlsOf("Grace")).toEqual([0, 0])
    expect(controlsOf("Ada")).toEqual([-1, -1])
    await user.keyboard("{ArrowRight}")
    expect(document.activeElement).toBe(row("Grace"))
    await user.tab()
    expect(document.activeElement?.textContent).toBe("Edit")
    await user.tab()
    await user.tab()
    expect(document.activeElement).toBe(button("After"))
    await user.tab({ shift: true })
    await user.tab({ shift: true })
    await user.tab({ shift: true })
    expect(document.activeElement).toBe(row("Grace"))
    await user.tab({ shift: true })
    expect(document.activeElement).toBe(button("Before"))
  })
})

describe("key ownership", () => {
  it("Space in a text field reaches the field; selection unchanged (RS#4674)", async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(<People field selectionMode="multiple" onValueChange={onValueChange} />)
    const input = screen.getByRole("textbox", { name: "Note for Ada" }) as HTMLInputElement
    await user.click(input)
    await user.keyboard("a b")
    expect(input.value).toBe("a b")
    expect(onValueChange).not.toHaveBeenCalled()
    await user.keyboard("{Escape}")
    expect(document.activeElement).toBe(row("Ada"))
  })

  it("Nested Tag Group handles its own keys (RS#5179, #6757)", async () => {
    const user = userEvent.setup()
    render(
      <People
        buttons={false}
        extra={(k) =>
          k === "Ada" ? (
            <TagGroup.Root onRemove={() => {}}>
              <TagGroup.Label>Skills</TagGroup.Label>
              <TagGroup.List>
                {["Math", "Code"].map((t) => (
                  <TagGroup.Tag key={t} value={t}>
                    <TagGroup.TagText>{t}</TagGroup.TagText>
                  </TagGroup.Tag>
                ))}
              </TagGroup.List>
            </TagGroup.Root>
          ) : null
        }
      />,
    )
    row("Ada").focus()
    screen.getByRole("row", { name: "Math" }).focus()
    await user.keyboard("{ArrowRight}")
    expect(document.activeElement).toBe(screen.getByRole("row", { name: "Code" }))
    expect(await gl().highlighted()).toBe("Ada")
  })

  it("A control that stops propagation never deselects its row (RS#4928)", async () => {
    const user = userEvent.setup()
    render(
      <People
        selectionMode="multiple"
        defaultValue={["Ada"]}
        buttons={false}
        extra={() => (
          <GridList.ItemControl onClick={(e) => e.stopPropagation()}>Info</GridList.ItemControl>
        )}
      />,
    )
    await user.click(screen.getAllByRole("button", { name: "Info" })[0] as HTMLElement)
    expect(await gl().selected()).toEqual(["Ada"])
  })

  it("A press on a control never selects or acts its row", async () => {
    const user = userEvent.setup()
    const onAction = vi.fn()
    const onEdit = vi.fn()
    render(<People selectionMode="multiple" onAction={onAction} onEdit={onEdit} />)
    await gl("pointer").pressControl("Grace", "Edit")
    expect(onEdit).toHaveBeenCalledWith("Grace")
    expect(onAction).not.toHaveBeenCalled()
    expect(await gl().selected()).toEqual([])
    await user.keyboard("{Enter}")
    expect(onAction).not.toHaveBeenCalled()
  })

  it("Modifier chords: ⌘/Ctrl+Shift+ArrowDown does not extend (RS#6904)", async () => {
    const user = userEvent.setup()
    render(<People selectionMode="multiple" />)
    row("Ada").focus()
    await user.keyboard("{Control>}{Shift>}{ArrowDown}{/Shift}{/Control}")
    await user.keyboard("{Meta>}{Shift>}{ArrowDown}{/Shift}{/Meta}")
    expect(await gl().selected()).toEqual([])
    await user.keyboard("{Shift>}{ArrowDown}{/Shift}")
    expect(await gl().selected()).toEqual(["Ada", "Grace"])
  })
})

describe("selection and action", () => {
  it("toggle: a press acts while nothing is selected, Space toggles, Enter acts", async () => {
    const user = userEvent.setup()
    const onAction = vi.fn()
    render(<People selectionMode="multiple" onAction={onAction} />)
    await user.click(screen.getByText("Ada"))
    expect(onAction).toHaveBeenLastCalledWith("Ada", { modality: "pointer", via: "press" })
    await user.keyboard(" ")
    expect(await gl().selected()).toEqual(["Ada"])
    expect(onAction).toHaveBeenCalledTimes(1)
    await user.click(screen.getByText("Grace"))
    expect(await gl().selected()).toEqual(["Ada", "Grace"])
    await user.keyboard("{Enter}")
    expect(onAction).toHaveBeenLastCalledWith("Grace", { modality: "keyboard", via: "enter" })
  })

  it("replace: a press selects only it; a double press acts", async () => {
    const user = userEvent.setup()
    const onAction = vi.fn()
    render(<People selectionMode="multiple" selectionBehavior="replace" onAction={onAction} />)
    await user.click(screen.getByText("Ada"))
    await user.click(screen.getByText("Alan"))
    expect(await gl().selected()).toEqual(["Alan"])
    await user.dblClick(screen.getByText("Grace"))
    expect(onAction).toHaveBeenCalledWith("Grace", expect.objectContaining({ via: "double-press" }))
  })

  it("Row press does not select with a checkbox (RS#9610); the checkbox overrides replace", async () => {
    const user = userEvent.setup()
    render(<People checkbox selectionMode="multiple" selectionBehavior="replace" />)
    await user.click(screen.getByText("Ada"))
    expect(await gl().selected()).toEqual([])
    await gl("pointer").check("Ada")
    await gl("pointer").check("Grace")
    expect(await gl().selected()).toEqual(["Ada", "Grace"])
    expect((screen.getByRole("checkbox", { name: "Select Ada" }) as HTMLInputElement).checked).toBe(
      true,
    )
    row("Alan").focus()
    await user.keyboard(" ")
    expect(await gl().selected()).toEqual(["Ada", "Grace", "Alan"])
  })

  it("Action stays available with checkboxes (RS#7962)", async () => {
    const user = userEvent.setup()
    const onAction = vi.fn()
    render(<People checkbox selectionMode="multiple" defaultValue={["Ada"]} onAction={onAction} />)
    await user.click(screen.getByText("Grace"))
    expect(onAction).toHaveBeenCalledWith("Grace", expect.anything())
    expect(await gl().selected()).toEqual(["Ada"])
  })

  it("Shift range with a controlled value: one change", async () => {
    const user = userEvent.setup()
    const changes: unknown[] = []
    function Controlled() {
      const [value, setValue] = useState<readonly string[]>([])
      return (
        <People
          people={["a", "b", "c", "d", "e"]}
          buttons={false}
          selectionMode="multiple"
          selectionBehavior="replace"
          value={value}
          onValueChange={(v) => {
            changes.push(v)
            setValue(v)
          }}
        />
      )
    }
    render(<Controlled />)
    await user.click(screen.getByText("b"))
    await user.keyboard("{Shift>}")
    await user.click(screen.getByText("e"))
    await user.keyboard("{/Shift}")
    expect(changes).toEqual([["b"], ["b", "c", "d", "e"]])
  })

  it("Keys 0 and empty take part in ranges and select all (RS#7076)", async () => {
    const user = userEvent.setup()
    render(
      <GridList.Root
        selectionMode="multiple"
        items={[
          { key: "0", label: "Zero" },
          { key: "", label: "Empty" },
          { key: "x", label: "Ex" },
        ]}
      >
        <GridList.Label>People</GridList.Label>
        <GridList.List>
          <GridList.Items />
        </GridList.List>
      </GridList.Root>,
    )
    row("Zero").focus()
    // platform-convention: select all is ⌘A on Apple, Ctrl+A elsewhere
    const mod = domEnvironment().platform.apple ? "Meta" : "Control"
    await user.keyboard(`{${mod}>}a{/${mod}}`)
    expect((await gl().selected()).length).toBe(3)
  })

  it("Escape does not clear the selection", async () => {
    const user = userEvent.setup()
    render(<People selectionMode="multiple" defaultValue={["Ada"]} />)
    row("Ada").focus()
    await user.keyboard("{Escape}")
    expect(await gl().selected()).toEqual(["Ada"])
  })
})

describe("controls", () => {
  it("Disabled row disables its buttons (RS#6323)", async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    render(
      <People
        childNavigation="tab"
        people={["Ada", { key: "Grace", disabled: true }]}
        onEdit={onEdit}
      />,
    )
    const edit = row("Grace").querySelector("button") as HTMLButtonElement
    expect(edit.getAttribute("aria-disabled")).toBe("true")
    expect(edit.tabIndex).toBe(-1)
    await user.click(edit)
    expect(onEdit).not.toHaveBeenCalled()
  })

  it("Foreign focusable: a development warning names it", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    render(
      <People buttons={false} extra={(k) => (k === "Ada" ? <a href="#ada">Profile</a> : null)} />,
    )
    expect(warn.mock.calls.some((c) => String(c[0]).includes("Profile"))).toBe(true)
  })
})

describe("links", () => {
  it("A link row follows on Enter and press, and is not selected", async () => {
    const user = userEvent.setup()
    const followed: string[] = []
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element).closest("a")
      if (a) {
        followed.push(a.getAttribute("href") ?? "")
        e.preventDefault()
      }
    }
    // Capture: the synthetic anchor of a link row stops its click from bubbling.
    document.addEventListener("click", onClick, true)
    try {
      render(
        <People
          buttons={false}
          selectionMode="multiple"
          people={[{ key: "Ada", href: "#ada" }, "Grace"]}
        />,
      )
      row("Ada").focus()
      await user.keyboard("{Enter}")
      await user.click(screen.getByText("Ada"))
      expect(followed).toEqual(["#ada", "#ada"])
      expect(row("Ada").hasAttribute("aria-selected")).toBe(false)
      expect(await gl().selected()).toEqual([])
    } finally {
      document.removeEventListener("click", onClick, true)
    }
  })
})

describe("keyboard and typeahead", () => {
  it("End highlights the last row and its default is prevented (RS#10720)", async () => {
    render(<People />)
    row("Ada").focus()
    const e = new KeyboardEvent("keydown", { key: "End", bubbles: true, cancelable: true })
    row("Ada").dispatchEvent(e)
    expect(e.defaultPrevented).toBe(true)
    await waitFor(async () => expect(await gl().highlighted()).toBe("Alan"))
  })

  it("Typeahead moves; disallowTypeAhead keeps the highlight (RS#9120)", async () => {
    const user = userEvent.setup()
    const { unmount } = render(<People />)
    row("Ada").focus()
    await user.keyboard("g")
    expect(await gl().highlighted()).toBe("Grace")
    unmount()
    render(<People disallowTypeAhead />)
    row("Ada").focus()
    await user.keyboard("g")
    expect(await gl().highlighted()).toBe("Ada")
  })

  it("No measurement: ArrowDown in a grid layout goes to the next item", async () => {
    const user = userEvent.setup()
    render(<People layout="grid" buttons={false} />)
    row("Ada").focus()
    await user.keyboard("{ArrowDown}")
    expect(await gl().highlighted()).toBe("Grace")
  })
})

describe("announcements (webkit-grid-selection-not-announced)", () => {
  it("Safari on macOS: one polite message per selection", async () => {
    const log = installAnnouncementLog()
    const user = userEvent.setup()
    render(
      <RindProvider environment={{ platform: platforms.apple }}>
        <People selectionMode="multiple" buttons={false} />
      </RindProvider>,
    )
    row("Ada").focus()
    await user.keyboard(" ")
    await waitFor(() => expect(log.map((a) => a.message)).toEqual(["Ada selected"]))
  })

  it("Chrome on Windows: nothing", async () => {
    const log = installAnnouncementLog()
    const user = userEvent.setup()
    render(
      <RindProvider environment={{ platform: platforms.windows }}>
        <People selectionMode="multiple" buttons={false} />
      </RindProvider>,
    )
    row("Ada").focus()
    await user.keyboard(" ")
    expect(await gl().selected()).toEqual(["Ada"])
    expect(log).toEqual([])
  })
})

describe("hover", () => {
  it("Hover without selection: data-hover on the row (RS#8988)", async () => {
    const user = userEvent.setup()
    render(<People buttons={false} />)
    await user.hover(row("Grace"))
    expect(row("Grace").hasAttribute("data-hover")).toBe(true)
  })
})

describe("driver", () => {
  it("Driver round trip: act, check and controls", async () => {
    const onAction = vi.fn()
    render(<People checkbox selectionMode="multiple" onAction={onAction} />)
    expect(await gl().rows()).toEqual(["Ada", "Grace", "Alan"])
    expect(await gl().controls("Ada")).toEqual(["Edit", "Delete"])
    await gl("keyboard").act("Grace")
    expect(onAction).toHaveBeenCalledWith("Grace", expect.anything())
    await gl("keyboard").focusControl("Alan", "Delete")
    expect(document.activeElement?.textContent).toBe("Delete")
    await gl("pointer").check("Ada")
    expect(await gl().selected()).toEqual(["Ada"])
  })
})

describe("review fixes", () => {
  it("focus moved straight into a nested Tag Group stays there", async () => {
    render(
      <People
        buttons={false}
        extra={(k) =>
          k === "Ada" ? (
            <TagGroup.Root selectionMode="single">
              <TagGroup.Label>Labels of Ada</TagGroup.Label>
              <TagGroup.List>
                <TagGroup.Tag value="math">
                  <TagGroup.TagText>math</TagGroup.TagText>
                </TagGroup.Tag>
              </TagGroup.List>
            </TagGroup.Root>
          ) : null
        }
      />,
    )
    const tag = screen.getByRole("row", { name: "math" })
    tag.focus()
    await waitFor(() => expect(document.activeElement).toBe(tag))
    await new Promise<void>((r) => queueMicrotask(r))
    expect(document.activeElement).toBe(tag)
  })

  it('layout="grid": Left/Right move cards, Tab reaches the card\'s controls', async () => {
    const user = userEvent.setup()
    render(<People layout="grid" />)
    expect(screen.getByRole("grid").getAttribute("data-child-navigation")).toBe("tab")
    row("Ada").focus()
    await user.keyboard("{ArrowRight}")
    expect(document.activeElement).toBe(row("Grace"))
    await user.tab()
    expect(document.activeElement?.textContent).toBe("Edit")
  })

  it("a row added while a control has focus leaves focus on the control", async () => {
    const user = userEvent.setup()
    const { rerender } = render(<People />)
    row("Ada").focus()
    await user.keyboard("{ArrowRight}")
    const edit = document.activeElement
    expect(edit?.textContent).toBe("Edit")
    rerender(<People people={["Ada", "Grace", "Alan", "Barbara"]} />)
    await new Promise<void>((r) => queueMicrotask(r))
    expect(document.activeElement).toBe(edit)
  })

  it('disabledBehavior="selection": a disabled row still acts; its controls stay enabled', async () => {
    const user = userEvent.setup()
    const onAction = vi.fn()
    render(
      <People
        selectionMode="multiple"
        disabledBehavior="selection"
        onAction={onAction}
        people={["Ada", { key: "Grace", disabled: true }, "Alan"]}
      />,
    )
    const edit = row("Grace").querySelector('[data-part="item-control"]') as HTMLElement
    expect(edit.getAttribute("aria-disabled")).toBeNull()
    row("Grace").focus()
    await user.keyboard("{Enter}")
    expect(onAction).toHaveBeenCalledWith("Grace", expect.anything())
    await user.keyboard(" ")
    expect(await gl().selected()).toEqual([])
  })

  it("a Shift range announces the count on Safari", async () => {
    const log = installAnnouncementLog()
    const user = userEvent.setup()
    render(
      <RindProvider environment={{ platform: platforms.apple }}>
        <People selectionMode="multiple" buttons={false} />
      </RindProvider>,
    )
    row("Ada").focus()
    await user.keyboard(" ")
    await user.keyboard("{Shift>}{ArrowDown}{ArrowDown}{/Shift}")
    await waitFor(() => expect(log.map((a) => a.message).at(-1)).toMatch(/3/))
  })

  it("a mouse press selects on pointer down; selectOnPressUp waits for pointer up", async () => {
    const user = userEvent.setup()
    const { unmount } = render(<People selectionMode="multiple" buttons={false} />)
    await user.pointer({ keys: "[MouseLeft>]", target: row("Grace") })
    expect(await gl().selected()).toEqual(["Grace"])
    await user.pointer({ keys: "[/MouseLeft]", target: row("Grace") })
    expect(await gl().selected()).toEqual(["Grace"])
    unmount()
    render(<People selectionMode="multiple" buttons={false} selectOnPressUp />)
    await user.pointer({ keys: "[MouseLeft>]", target: row("Grace") })
    expect(await gl().selected()).toEqual([])
    await user.pointer({ keys: "[/MouseLeft]", target: row("Grace") })
    expect(await gl().selected()).toEqual(["Grace"])
  })

  it("autoFocus focuses the selected row", async () => {
    render(<People selectionMode="single" defaultValue="Alan" autoFocus />)
    await waitFor(() => expect(document.activeElement).toBe(row("Alan")))
  })

  it("an Item's own onAction runs for that row", async () => {
    const user = userEvent.setup()
    const onRow = vi.fn()
    render(
      <GridList.Root>
        <GridList.Label>People</GridList.Label>
        <GridList.List>
          <GridList.Item value="Ada" onAction={onRow}>
            <GridList.ItemText>Ada</GridList.ItemText>
          </GridList.Item>
          <GridList.Item value="Grace">
            <GridList.ItemText>Grace</GridList.ItemText>
          </GridList.Item>
        </GridList.List>
      </GridList.Root>,
    )
    row("Ada").focus()
    await user.keyboard("{Enter}")
    expect(onRow).toHaveBeenCalledTimes(1)
    row("Grace").focus()
    await user.keyboard("{Enter}")
    expect(onRow).toHaveBeenCalledTimes(1)
  })

  it("the select-all checkbox: unchecked, mixed, checked; it selects all, then clears", async () => {
    const user = userEvent.setup()
    render(
      <GridList.Root selectionMode="multiple">
        <GridList.ItemCheckbox all />
        <GridList.Label>People</GridList.Label>
        <GridList.List>
          {["Ada", "Grace"].map((p) => (
            <GridList.Item key={p} value={p}>
              <GridList.ItemCheckbox />
              <GridList.ItemText>{p}</GridList.ItemText>
            </GridList.Item>
          ))}
        </GridList.List>
      </GridList.Root>,
    )
    const all = screen.getByRole("checkbox", { name: "Select all" }) as HTMLInputElement
    expect(all.checked).toBe(false)
    await user.click(screen.getByRole("checkbox", { name: "Select Ada" }))
    expect(all.indeterminate).toBe(true)
    await user.click(all)
    expect(await gl().selected()).toEqual(["Ada", "Grace"])
    expect(all.checked).toBe(true)
    await user.click(all)
    expect(await gl().selected()).toEqual([])
  })

  it("pressControl leaves the row's selection and action untouched", async () => {
    const onAction = vi.fn()
    render(<People selectionMode="multiple" onAction={onAction} />)
    await gl("pointer").pressControl("Ada", "Edit")
    expect(onAction).not.toHaveBeenCalled()
  })
})
