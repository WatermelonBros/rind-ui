// Menu regression scenarios (openspec add-menu): one test per scenario, named after the
// spec scenario and the upstream issue it guards. jsdom and chromium unless layout is needed.
import { Menu } from "@rind-ui/react"
import { act, render, screen, waitFor } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { getMenu } from "../index"

const isJsdom = navigator.userAgent.includes("jsdom")
const active = () => document.activeElement
const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()))
const frames = async (n = 3) => {
  for (let i = 0; i < n; i++) await frame()
}

function Simple({
  onSelect = () => {},
  label = "Actions",
  children,
  onOpenChange,
}: {
  onSelect?: (k: string) => void
  label?: string
  children?: React.ReactNode
  onOpenChange?: (open: boolean) => void
}) {
  return (
    <Menu.Root {...(onOpenChange ? { onOpenChange } : {})}>
      <Menu.Trigger>{label}</Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner>
          <Menu.Content>
            <Menu.Item onSelect={() => onSelect("copy")}>Copy</Menu.Item>
            <Menu.Item onSelect={() => onSelect("paste")}>Paste</Menu.Item>
            {children}
          </Menu.Content>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}

function Sub({ title, items }: { title: string; items: string[] }) {
  return (
    <Menu.Submenu>
      <Menu.SubmenuTrigger>{title}</Menu.SubmenuTrigger>
      <Menu.Portal>
        <Menu.Positioner>
          <Menu.Content>
            {items.map((i) => (
              <Menu.Item key={i}>{i}</Menu.Item>
            ))}
          </Menu.Content>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Submenu>
  )
}

const openPath = () =>
  [...document.querySelectorAll('[data-part="submenu-trigger"][data-state="open"]')].map(
    (e) => e.textContent,
  )

describe("Menu scenarios", () => {
  it("Pointer cancellation: press on the trigger, release elsewhere does not open (radix#3124)", async () => {
    render(
      <>
        <Simple />
        <button type="button">Elsewhere</button>
      </>,
    )
    const trigger = screen.getByRole("button", { name: "Actions" })
    await userEvent.pointer([
      { keys: "[MouseLeft>]", target: trigger },
      { target: screen.getByRole("button", { name: "Elsewhere" }) },
      { keys: "[/MouseLeft]" },
    ])
    await frames()
    expect(trigger.getAttribute("aria-expanded")).toBe("false")
    expect(screen.queryByRole("menu")).toBeNull()
  })

  it("Right click on an item selects nothing and keeps the menu open (radix#2756)", async () => {
    const onSelect = vi.fn()
    render(<Simple onSelect={onSelect} />)
    const m = getMenu(screen, { name: "Actions" }).via("pointer")
    await m.open()
    await userEvent.pointer({
      keys: "[MouseRight]",
      target: screen.getByRole("menuitem", { name: "Copy" }),
    })
    await frames()
    expect(onSelect).not.toHaveBeenCalled()
    expect(await m.isOpen()).toBe(true)
  })

  it("Typing in a text input inside the content neither selects nor closes (radix#3232)", async () => {
    const onSelect = vi.fn()
    render(
      <Simple onSelect={onSelect}>
        <input aria-label="Name" />
      </Simple>,
    )
    const m = getMenu(screen, { name: "Actions" }).via("keyboard")
    await m.open()
    const input = screen.getByLabelText("Name") as HTMLInputElement
    act(() => input.focus())
    await userEvent.keyboard("a b{Enter}")
    await frames()
    expect(input.value).toBe("a b")
    expect(await m.isOpen()).toBe(true)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it("An item whose onSelect focuses an editor leaves the focus there (mui/base-ui#5930)", async () => {
    render(
      <>
        <textarea aria-label="Editor" />
        <Menu.Root>
          <Menu.Trigger>Edit</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Content>
                <Menu.Item onSelect={() => screen.getByLabelText("Editor").focus()}>
                  Focus editor
                </Menu.Item>
              </Menu.Content>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </>,
    )
    const m = getMenu(screen, { name: "Edit" }).via("pointer")
    await m.open()
    await m.choose("Focus editor")
    await waitFor(async () => expect(await m.isOpen()).toBe(false))
    await frames()
    expect(active()).toBe(screen.getByLabelText("Editor"))
  })

  it("Click outside a mouse-opened menu closes it with no item ever highlighted (react-spectrum#10767)", async () => {
    render(<Simple />)
    const seen: string[] = []
    const mo = new MutationObserver((records) => {
      for (const r of records) {
        const el = r.target as Element
        if (el.hasAttribute("data-highlighted")) seen.push(el.textContent ?? "")
      }
    })
    mo.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ["data-highlighted"],
    })
    try {
      const m = getMenu(screen, { name: "Actions" }).via("pointer")
      await m.open()
      await m.pressOutside()
      await waitFor(async () => expect(await m.isOpen()).toBe(false))
      await frames()
    } finally {
      mo.disconnect()
    }
    expect(seen).toEqual([])
  })

  it("TalkBack: a bare click on the open submenu trigger closes the submenu only", async () => {
    render(
      <Menu.Root>
        <Menu.Trigger>Enc</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Content>
              <Sub title="Reopen with" items={["UTF-8", "UTF-16"]} />
              <Menu.Item>Other</Menu.Item>
            </Menu.Content>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>,
    )
    const m = getMenu(screen, { name: "Enc" }).via("keyboard")
    await m.open()
    await m.openSubmenu("Reopen with")
    expect(openPath()).toEqual(["Reopen with"])
    act(() => screen.getByRole("menuitem", { name: "Reopen with" }).click())
    await waitFor(() => expect(openPath()).toEqual([]))
    expect(await m.isOpen()).toBe(true)
  })

  it("Focus moving to the parent menu closes the submenu (mui/base-ui#5794)", async () => {
    render(
      <Menu.Root>
        <Menu.Trigger>Enc</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Content>
              <Menu.Item>Save</Menu.Item>
              <Sub title="Reopen with" items={["UTF-8", "UTF-16"]} />
            </Menu.Content>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>,
    )
    const m = getMenu(screen, { name: "Enc" }).via("keyboard")
    await m.open()
    await m.openSubmenu("Reopen with")
    expect(openPath()).toEqual(["Reopen with"])
    act(() => screen.getByRole("menuitem", { name: "Save" }).focus())
    await waitFor(() => expect(openPath()).toEqual([]))
    expect(await m.isOpen()).toBe(true)
  })

  it("A submenu mounted later opens with ArrowRight (react-spectrum#9915)", async () => {
    let setShow: (v: boolean) => void = () => {}
    function Late() {
      const [show, set] = useState(false)
      setShow = set
      return (
        <Menu.Root>
          <Menu.Trigger>Enc</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Content>
                <Sub title="First" items={["A1", "A2"]} />
                {show ? <Sub title="Second" items={["B1", "B2"]} /> : null}
              </Menu.Content>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      )
    }
    render(<Late />)
    const m = getMenu(screen, { name: "Enc" }).via("keyboard")
    await m.open()
    await m.openSubmenu("First")
    await m.closeSubmenu()
    await waitFor(() => expect(openPath()).toEqual([]))
    act(() => setShow(true))
    await screen.findByRole("menuitem", { name: "Second" })
    await m.openSubmenu("Second")
    expect(openPath()).toEqual(["Second"])
  })

  it("Rows that arrive after opening: ArrowDown focuses the first row, initial focus does not move again (ariakit#7766)", async () => {
    function Lazy() {
      const [rows, setRows] = useState<string[]>([])
      return (
        <Menu.Root onOpenChange={(open) => open && setRows(["Row 1", "Row 2"])}>
          <Menu.Trigger>Lazy</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Content>
                {rows.map((r) => (
                  <Menu.Item key={r}>{r}</Menu.Item>
                ))}
              </Menu.Content>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      )
    }
    render(<Lazy />)
    const m = getMenu(screen, { name: "Lazy" }).via("keyboard")
    await m.open()
    await screen.findByRole("menuitem", { name: "Row 1" })
    await frames()
    expect(active()).toBe(screen.getByRole("menu"))
    await userEvent.keyboard("{ArrowDown}")
    await waitFor(() => expect(active()?.textContent).toBe("Row 1"))
  })

  it("The menu is named by the trigger's current text (UTF-8 to UTF-16)", async () => {
    let setLabel: (v: string) => void = () => {}
    function Changing() {
      const [label, set] = useState("UTF-8")
      setLabel = set
      return <Simple label={label} />
    }
    render(<Changing />)
    act(() => setLabel("UTF-16"))
    const m = getMenu(screen, { name: "UTF-16" }).via("keyboard")
    await m.open()
    expect(screen.getByRole("menu", { name: "UTF-16" })).toBeTruthy()
  })

  it("A trigger wrapped in a label: choosing an item does not reopen the menu (radix#3679)", async () => {
    const onSelect = vi.fn()
    render(
      <Menu.Root>
        {/* biome-ignore lint/a11y/noLabelWithoutControl: the wrapping label is the scenario */}
        <label>
          <Menu.Trigger>Wrapped</Menu.Trigger>
        </label>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Content>
              <Menu.Item onSelect={() => onSelect("copy")}>Copy</Menu.Item>
            </Menu.Content>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>,
    )
    const m = getMenu(screen, { name: /Wrapped/ }).via("pointer")
    await m.open()
    await m.choose("Copy")
    await waitFor(async () => expect(await m.isOpen()).toBe(false))
    await frames()
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(await m.isOpen()).toBe(false)
  })

  it.runIf(!isJsdom)("Space on an item does not scroll the page (radix#623)", async () => {
    render(
      <>
        <div style={{ height: 3000 }} />
        <Simple />
        <div style={{ height: 3000 }} />
      </>,
    )
    const trigger = screen.getByRole("button", { name: "Actions" })
    trigger.scrollIntoView({ block: "center" })
    const before = window.scrollY
    const m = getMenu(screen, { name: "Actions" }).via("keyboard")
    await m.open()
    await userEvent.keyboard(" ")
    await frames()
    expect(window.scrollY).toBe(before)
  })

  it.runIf(!isJsdom)(
    "Touch selection over a page button does not click it (react-spectrum#1513)",
    async () => {
      const onSelect = vi.fn()
      const pageClick = vi.fn()
      render(<Simple onSelect={onSelect} />)
      const m = getMenu(screen, { name: "Actions" }).via("touch")
      await m.open()
      const r = screen.getByRole("menuitem", { name: "Copy" }).getBoundingClientRect()
      const under = document.createElement("button")
      under.type = "button"
      under.textContent = "Under"
      Object.assign(under.style, {
        position: "fixed",
        left: `${r.left}px`,
        top: `${r.top}px`,
        width: `${r.width}px`,
        height: `${r.height}px`,
        zIndex: "-1",
      })
      under.addEventListener("click", pageClick)
      document.body.append(under)
      try {
        await m.choose("Copy")
        await waitFor(() => expect(onSelect).toHaveBeenCalledTimes(1))
        await frames()
        expect(pageClick).not.toHaveBeenCalled()
      } finally {
        under.remove()
      }
    },
  )

  it("The Escape that closes the menu is default-prevented (radix#1420)", async () => {
    render(<Simple />)
    const seen: boolean[] = []
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") seen.push(e.defaultPrevented)
    }
    try {
      const m = getMenu(screen, { name: "Actions" }).via("keyboard")
      await m.open()
      // After the open: the menu's own document listener runs before this one.
      document.addEventListener("keydown", onKey)
      await m.pressEscape()
      await waitFor(async () => expect(await m.isOpen()).toBe(false))
    } finally {
      document.removeEventListener("keydown", onKey)
    }
    expect(seen[0]).toBe(true)
  })
})
