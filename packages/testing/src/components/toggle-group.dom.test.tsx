import { domEnvironment } from "@rind-ui/core"
import { RindProvider, ToggleGroup } from "@rind-ui/react"
import { act, render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { getToggleGroup, installAnnouncementLog } from "../index"

const platform = domEnvironment().platform
const ALIGN = [
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
]

function Align(props: Partial<Parameters<typeof ToggleGroup.Root>[0]>) {
  return (
    <>
      <ToggleGroup.Root aria-label="Alignment" {...props}>
        {ALIGN.map((a) => (
          <ToggleGroup.Item key={a.value} value={a.value}>
            {a.label}
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>
      <button type="button">After</button>
    </>
  )
}

describe("ToggleGroup smoke", () => {
  it("single replaces and deselects; arrows only move; one tab stop", async () => {
    const onValueChange = vi.fn()
    render(<Align onValueChange={onValueChange} />)
    const g = getToggleGroup(screen, { name: "Alignment" }, { platform })
    expect(await g.items()).toEqual(["Left", "Center", "Right"])
    await g.toggle("Left")
    expect(await g.pressed()).toEqual(["Left"])
    await g.toggle("Right")
    expect(await g.pressed()).toEqual(["Right"])
    await g.toggle("Right")
    expect(await g.pressed()).toEqual([])
    expect(onValueChange).toHaveBeenCalledTimes(3)
    expect(screen.queryAllByRole("radio")).toHaveLength(0)
    screen.getByRole("button", { name: "Left" }).focus()
    await g.via("keyboard").arrowNext()
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Center" }))
    expect(await g.pressed()).toEqual([])
    const stops = screen.getAllByRole("button").filter((b) => b.tabIndex === 0)
    // The group's tab stop plus the "After" button.
    expect(stops).toHaveLength(2)
  })

  it("multiple adds and removes", async () => {
    render(<Align selectionMode="multiple" />)
    const g = getToggleGroup(screen, { name: "Alignment" }, { platform })
    await g.toggle("Left")
    await g.toggle("Center")
    await g.toggle("Left")
    expect(await g.pressed()).toEqual(["Center"])
  })
})

// ---- Spec scenarios: toggle-group (tasks 3.2, 4.3) ----
const inJsdom = navigator.userAgent.includes("jsdom")
const drv = (name = "Alignment") => getToggleGroup(screen, { name }, { platform })
const btn = (name: string) => screen.getByRole("button", { name })
const focused = () => document.activeElement
const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()))

afterEach(() => vi.restoreAllMocks())

/** A real pointer press at the element's centre: a click without coordinates lands at 0,0. */
async function click(el: Element) {
  const r = el.getBoundingClientRect()
  const coords = { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }
  await act(() =>
    userEvent.setup().pointer([
      { target: el, coords },
      { keys: "[MouseLeft]", target: el, coords },
    ]),
  )
}

type ItemSpec = { value: string; label: string; disabled?: boolean; render?: ReactNode }
const TEXT: ItemSpec[] = [
  { value: "bold", label: "Bold" },
  { value: "italic", label: "Italic" },
  { value: "underline", label: "Underline" },
]
const FOUR: ItemSpec[] = [
  { value: "a", label: "A" },
  { value: "b", label: "B" },
  { value: "c", label: "C" },
  { value: "d", label: "D" },
]

function Grp({
  items = ALIGN,
  label = "Alignment",
  ...root
}: Partial<Parameters<typeof ToggleGroup.Root>[0]> & {
  items?: ItemSpec[]
  label?: string | null
}) {
  return (
    <>
      <button type="button">Before</button>
      <ToggleGroup.Root {...(label === null ? {} : { "aria-label": label })} {...root}>
        {items.map((i) => (
          <ToggleGroup.Item key={i.value} value={i.value} disabled={i.disabled === true}>
            {i.label}
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>
      <button type="button">After</button>
    </>
  )
}

describe("Anatomy", () => {
  it("an item rendered as a span keeps toggle behaviour", async () => {
    const user = userEvent.setup()
    render(
      <ToggleGroup.Root aria-label="Alignment">
        {ALIGN.map((a) => (
          <ToggleGroup.Item key={a.value} value={a.value} render={<span />}>
            {a.label}
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>,
    )
    const left = btn("Left")
    expect(left.tagName).toBe("SPAN")
    expect(left.getAttribute("role")).toBe("button")
    expect(left.getAttribute("aria-pressed")).toBe("false")
    expect(left.tabIndex).toBe(0)
    expect(btn("Center").tabIndex).toBe(-1)
    act(() => left.focus())
    await user.keyboard(" ")
    expect(left.getAttribute("aria-pressed")).toBe("true")
    await user.keyboard(" ")
    expect(left.getAttribute("aria-pressed")).toBe("false")
  })

  it("a disabled group reaches every item (react-spectrum#7798)", async () => {
    const onValueChange = vi.fn()
    const user = userEvent.setup()
    render(<Grp disabled defaultValue={["left"]} onValueChange={onValueChange} />)
    for (const name of ["Left", "Center", "Right"]) {
      const el = btn(name)
      expect(el.hasAttribute("data-disabled"), name).toBe(true)
      expect((el as HTMLButtonElement).disabled, name).toBe(true)
      await user.hover(el)
      await user.click(el)
      expect(el.hasAttribute("data-hover"), name).toBe(false)
      expect(el.hasAttribute("data-pressed"), name).toBe(false)
    }
    expect(onValueChange).not.toHaveBeenCalled()
    expect(await drv().pressed()).toEqual(["Left"])
    expect(await drv().isDisabled("Center")).toBe(true)
  })
})

describe("Semantics", () => {
  it("single mode is toggle buttons, never radios (radix#4119, base-ui#3525)", () => {
    render(<Grp defaultValue={["left"]} />)
    expect(screen.getByRole("group", { name: "Alignment" })).toBeTruthy()
    expect(screen.queryAllByRole("radio")).toHaveLength(0)
    expect(screen.queryAllByRole("radiogroup")).toHaveLength(0)
    expect(document.querySelector("[aria-checked]")).toBeNull()
    expect(["Left", "Center", "Right"].map((n) => btn(n).getAttribute("aria-pressed"))).toEqual([
      "true",
      "false",
      "false",
    ])
  })

  it("multiple mode has explicit aria-pressed on every item", () => {
    render(<Grp items={TEXT} selectionMode="multiple" defaultValue={["bold", "underline"]} />)
    expect(["Bold", "Italic", "Underline"].map((n) => btn(n).getAttribute("aria-pressed"))).toEqual(
      ["true", "false", "true"],
    )
  })

  it("an unnamed group warns and names the root (radix#754)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    render(<Grp label={null} />)
    expect(
      warn.mock.calls.some((c) => /toggle-group: the root .*no accessible name/.test(String(c[0]))),
    ).toBe(true)
  })

  it("a named group does not warn", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    render(<Grp />)
    expect(warn.mock.calls.filter((c) => /toggle-group/.test(String(c[0])))).toEqual([])
  })

  it("a vertical group has data-orientation and no aria-orientation (radix#964)", () => {
    render(<Grp orientation="vertical" />)
    const root = screen.getByRole("group", { name: "Alignment" })
    expect(root.getAttribute("data-orientation")).toBe("vertical")
    expect(root.hasAttribute("aria-orientation")).toBe(false)
    expect(btn("Left").getAttribute("data-orientation")).toBe("vertical")
  })
})

describe("Value and selection modes", () => {
  it("controlled single: one click on the pressed item proposes [] once (radix#721)", async () => {
    const seen: (readonly string[])[] = []
    function Parent() {
      const [value, setValue] = useState<readonly string[]>(["bold"])
      return (
        <Grp
          items={TEXT}
          value={value}
          onValueChange={(v) => {
            seen.push(v)
            setValue(v)
          }}
        />
      )
    }
    render(<Parent />)
    await click(btn("Bold"))
    expect(seen).toEqual([[]])
    expect(await drv().pressed()).toEqual([])
  })

  it("single replaces", async () => {
    const onValueChange = vi.fn()
    render(<Grp defaultValue={["left"]} onValueChange={onValueChange} />)
    await drv().toggle("Right")
    expect(await drv().pressed()).toEqual(["Right"])
    expect(onValueChange.mock.calls.at(-1)?.[0]).toEqual(["right"])
    expect(onValueChange.mock.calls.at(-1)?.[1].reason).toBe("PRESS")
  })

  it("multiple adds and removes", async () => {
    const onValueChange = vi.fn()
    render(<Grp items={TEXT} selectionMode="multiple" onValueChange={onValueChange} />)
    const g = drv()
    await g.toggle("Bold")
    await g.toggle("Italic")
    await g.toggle("Bold")
    expect(await g.pressed()).toEqual(["Italic"])
    expect(onValueChange.mock.calls.at(-1)?.[0]).toEqual(["italic"])
  })

  it("disallowEmptySelection keeps the only pressed item with no callback (zag#2412)", async () => {
    const onValueChange = vi.fn()
    render(<Grp defaultValue={["left"]} disallowEmptySelection onValueChange={onValueChange} />)
    await click(btn("Left"))
    expect(await drv().pressed()).toEqual(["Left"])
    expect(onValueChange).not.toHaveBeenCalled()
  })

  it("uncontrolled single: pressing the pressed item gives [] without error (reka-ui#992)", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    const onValueChange = vi.fn()
    render(<Grp onValueChange={onValueChange} />)
    await click(btn("Left"))
    await click(btn("Left"))
    expect(await drv().pressed()).toEqual([])
    expect(onValueChange.mock.calls.at(-1)?.[0]).toEqual([])
    expect(error).not.toHaveBeenCalled()
  })
})

describe("Keyboard and activation", () => {
  it("arrows only move focus; the value stays", async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(<Grp defaultValue={["left"]} onValueChange={onValueChange} />)
    act(() => btn("Left").focus())
    await user.keyboard("{ArrowRight}")
    expect(focused()).toBe(btn("Center"))
    expect(await drv().pressed()).toEqual(["Left"])
    await user.keyboard("{ArrowLeft}{ArrowLeft}")
    expect(focused()).toBe(btn("Right"))
    expect(onValueChange).not.toHaveBeenCalled()
  })

  it("horizontal: ArrowUp and ArrowDown do nothing", async () => {
    const user = userEvent.setup()
    render(<Grp />)
    act(() => btn("Left").focus())
    await user.keyboard("{ArrowDown}{ArrowUp}")
    expect(focused()).toBe(btn("Left"))
  })

  it("Home and End move to the first and last item (base-ui#3970)", async () => {
    const user = userEvent.setup()
    render(<Grp items={FOUR} defaultValue={["b"]} />)
    act(() => btn("B").focus())
    await user.keyboard("{End}")
    expect(focused()).toBe(btn("D"))
    await user.keyboard("{Home}")
    expect(focused()).toBe(btn("A"))
    expect(await drv().pressed()).toEqual(["B"])
  })

  it("Enter presses (reka-ui#638)", async () => {
    const user = userEvent.setup()
    render(<Grp />)
    act(() => btn("Center").focus())
    await user.keyboard("{Enter}")
    expect(await drv().pressed()).toEqual(["Center"])
  })

  it("Space presses exactly once per activation", async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(<Grp onValueChange={onValueChange} />)
    act(() => btn("Center").focus())
    await user.keyboard(" ")
    expect(onValueChange).toHaveBeenCalledTimes(1)
  })

  it("a vertical group: ArrowRight moves to the next item", async () => {
    const user = userEvent.setup()
    render(<Grp orientation="vertical" />)
    act(() => btn("Left").focus())
    await user.keyboard("{ArrowRight}")
    expect(focused()).toBe(btn("Center"))
    await user.keyboard("{ArrowDown}")
    expect(focused()).toBe(btn("Right"))
    await user.keyboard("{ArrowUp}{ArrowLeft}")
    expect(focused()).toBe(btn("Left"))
  })

  it("RTL: ArrowLeft on the first item moves to the second", async () => {
    const user = userEvent.setup()
    render(
      <RindProvider dir="rtl">
        <Grp />
      </RindProvider>,
    )
    act(() => btn("Left").focus())
    await user.keyboard("{ArrowLeft}")
    expect(focused()).toBe(btn("Center"))
    await user.keyboard("{ArrowRight}")
    expect(focused()).toBe(btn("Left"))
  })

  it("wraps with loop (default) and stops without it", async () => {
    const user = userEvent.setup()
    const { unmount } = render(<Grp />)
    act(() => btn("Right").focus())
    await user.keyboard("{ArrowRight}")
    expect(focused()).toBe(btn("Left"))
    unmount()
    render(<Grp loop={false} />)
    act(() => btn("Right").focus())
    await user.keyboard("{ArrowRight}")
    expect(focused()).toBe(btn("Right"))
  })

  it("Control+ArrowRight does nothing", async () => {
    const user = userEvent.setup()
    render(<Grp />)
    act(() => btn("Left").focus())
    await user.keyboard("{Control>}{ArrowRight}{/Control}")
    expect(focused()).toBe(btn("Left"))
  })

  it("programmatic focus does not press", async () => {
    const onValueChange = vi.fn()
    render(<Grp onValueChange={onValueChange} />)
    act(() => btn("Center").focus())
    act(() => btn("Right").focus())
    expect(await drv().pressed()).toEqual([])
    expect(onValueChange).not.toHaveBeenCalled()
  })

  it("every action works in every modality", async () => {
    for (const modality of ["pointer", "touch", "keyboard"] as const) {
      const { unmount } = render(<Grp items={TEXT} selectionMode="multiple" />)
      const g = drv().via(modality)
      await g.toggle("Italic")
      expect(await g.pressed(), modality).toEqual(["Italic"])
      await g.toggle("Underline")
      expect(await g.pressed(), modality).toEqual(["Italic", "Underline"])
      await g.toggle("Italic")
      expect(await g.pressed(), modality).toEqual(["Underline"])
      unmount()
    }
  })
})

describe("Tab stop and focus", () => {
  // `native`: the browser's own dialog focus steps; otherwise the first tabbable (what focus
  // traps do). A native dialog also counts tabindex=-1 items as focusable, so it only lands
  // on the tab stop when that is the first item.
  function InDialog({ value, native }: { value?: string[]; native?: boolean }) {
    const ref = useRef<HTMLDialogElement>(null)
    useEffect(() => {
      const d = ref.current
      if (!d) return
      if (native && typeof d.showModal === "function" && !inJsdom) d.showModal()
      else {
        // jsdom has no dialog focus steps: the first tabbable, as a browser would pick.
        d.setAttribute("open", "")
        d.querySelector<HTMLElement>("[tabindex='0']")?.focus()
      }
    }, [native])
    return (
      <dialog ref={ref} aria-label="Dialog">
        <ToggleGroup.Root aria-label="Alignment" defaultValue={value ?? []}>
          {ALIGN.map((a) => (
            <ToggleGroup.Item key={a.value} value={a.value}>
              {a.label}
            </ToggleGroup.Item>
          ))}
        </ToggleGroup.Root>
        <button type="button">Close</button>
      </dialog>
    )
  }

  it("dialog initial focus lands on the tab-stop item (radix#3077)", async () => {
    const { unmount } = render(<InDialog native />)
    await frame()
    expect(focused()).toBe(btn("Left"))
    unmount()
    render(<InDialog value={["center"]} />)
    await frame()
    expect(focused()).toBe(btn("Center"))
  })

  it("exactly one item is a Tab stop and the root never is", async () => {
    const user = userEvent.setup()
    render(<Grp defaultValue={["center"]} />)
    const root = screen.getByRole("group", { name: "Alignment" })
    expect(root.hasAttribute("tabindex")).toBe(false)
    expect(["Left", "Center", "Right"].map((n) => btn(n).tabIndex)).toEqual([-1, 0, -1])
    act(() => btn("Before").focus())
    await user.tab()
    expect(focused()).toBe(btn("Center"))
    await user.tab()
    expect(focused()).toBe(btn("After"))
  })

  it("a click focuses the item and it becomes the tab stop (radix#703)", async () => {
    render(<Grp />)
    await click(btn("Right"))
    expect(focused()).toBe(btn("Right"))
    expect(["Left", "Center", "Right"].map((n) => btn(n).tabIndex)).toEqual([-1, -1, 0])
  })

  it("focus attributes are cleared when focus leaves (zag#2190)", async () => {
    render(<Grp />)
    const root = screen.getByRole("group", { name: "Alignment" })
    act(() => btn("Center").focus())
    expect(root.hasAttribute("data-focus")).toBe(true)
    expect(btn("Center").hasAttribute("data-focus")).toBe(true)
    expect(btn("Center").hasAttribute("data-highlighted")).toBe(true)
    act(() => btn("After").focus())
    expect(document.querySelector("[data-focus]")).toBeNull()
    expect(document.querySelector("[data-highlighted]")).toBeNull()
    expect(await drv().focusedItem()).toBeNull()
  })

  it("focusedItem follows the arrows", async () => {
    const user = userEvent.setup()
    render(<Grp />)
    act(() => btn("Left").focus())
    await user.keyboard("{ArrowRight}")
    expect(await drv().focusedItem()).toBe("Center")
  })
})

describe("Disabled items", () => {
  const withDisabled: ItemSpec[] = [
    { value: "left", label: "Left" },
    { value: "center", label: "Center", disabled: true },
    { value: "right", label: "Right" },
  ]

  it("a disabled item is skipped by the arrows and never pressed", async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(<Grp items={withDisabled} onValueChange={onValueChange} />)
    act(() => btn("Left").focus())
    await user.keyboard("{ArrowRight}")
    expect(focused()).toBe(btn("Right"))
    await user.click(btn("Center"))
    expect(await drv().pressed()).toEqual([])
    expect(await drv().isDisabled("Center")).toBe(true)
    expect(await drv().isDisabled("Left")).toBe(false)
  })

  it("focusableWhenDisabled reaches the disabled item and Space does not toggle (base-ui#5834)", async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(<Grp items={withDisabled} focusableWhenDisabled onValueChange={onValueChange} />)
    act(() => btn("Left").focus())
    await user.keyboard("{ArrowRight}")
    expect(focused()).toBe(btn("Center"))
    expect(btn("Center").getAttribute("aria-disabled")).toBe("true")
    await user.keyboard(" ")
    expect(btn("Center").getAttribute("aria-pressed")).toBe("false")
    expect(onValueChange).not.toHaveBeenCalled()
  })

  it("a keyboard toggle of a disabled item completes without pressing it", async () => {
    render(<Grp items={withDisabled} />)
    await drv().via("keyboard").toggle("Center")
    expect(await drv().pressed()).toEqual([])
  })
})

describe("Announcements", () => {
  it("pressing records no announcement and renders no live region", async () => {
    const user = userEvent.setup()
    const log = installAnnouncementLog()
    render(<Grp />)
    const before = log.length
    act(() => btn("Left").focus())
    await user.keyboard(" ")
    expect(await drv().pressed()).toEqual(["Left"])
    expect(log.length).toBe(before)
    expect(document.querySelector("[aria-live]")).toBeNull()
  })
})

describe("Data attributes", () => {
  it("root and item carry the scope, mode, state and key", () => {
    render(<Grp items={TEXT} selectionMode="multiple" defaultValue={["italic"]} />)
    const root = screen.getByRole("group", { name: "Alignment" })
    expect(root).toHaveProperty("dataset.scope", "toggle-group")
    expect(root.getAttribute("data-part")).toBe("root")
    expect(root.getAttribute("data-selection-mode")).toBe("multiple")
    expect(btn("Italic").getAttribute("data-state")).toBe("on")
    expect(btn("Bold").getAttribute("data-state")).toBe("off")
    expect(btn("Bold").getAttribute("data-key")).toBe("bold")
    expect(btn("Bold").getAttribute("data-part")).toBe("item")
  })

  it("pressed (on) versus being pressed", async () => {
    render(<Grp items={TEXT} selectionMode="multiple" defaultValue={["bold"]} />)
    const italic = btn("Italic")
    const r = italic.getBoundingClientRect()
    const coords = { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }
    const user = userEvent.setup()
    await act(() => user.pointer({ keys: "[MouseLeft>]", target: italic, coords }))
    expect(btn("Bold").getAttribute("data-state")).toBe("on")
    expect(btn("Bold").hasAttribute("data-pressed")).toBe(false)
    expect(italic.hasAttribute("data-pressed")).toBe(true)
    expect(italic.getAttribute("data-state")).toBe("off")
    await act(() => user.pointer({ keys: "[/MouseLeft]", target: italic, coords }))
    expect(italic.hasAttribute("data-pressed")).toBe(false)
    expect(italic.getAttribute("data-state")).toBe("on")
  })
})
