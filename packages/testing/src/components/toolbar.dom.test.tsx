// biome-ignore-all lint/a11y: fixtures deliberately use bare controls and a contenteditable
// Toolbar driver and React tests (tasks 3.2, 4.2, 5.1): every spec scenario that exists
// today, through the driver, in jsdom and in real browsers. Waiting for Menu / Select /
// Popover / Tooltip triggers: their scenarios are listed in the hand-off report.
import { domEnvironment } from "@rind-ui/core"
import {
  Link,
  Portal,
  RadioGroup,
  RindProvider,
  RouterProvider,
  ToggleGroup,
  Toolbar,
} from "@rind-ui/react"
import { act, render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import axe from "axe-core"
import { type ReactNode, type Ref, useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  fakeRouter,
  getRadioGroup,
  getSeparator,
  getToggleGroup,
  getToolbar,
  installAnnouncementLog,
  interceptNativeNavigation,
  navigationLog,
} from "../index"

const platform = domEnvironment().platform
afterEach(() => vi.restoreAllMocks())

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

type RootProps = Parameters<typeof Toolbar.Root>[0]
type Loose<T> = { [K in keyof T]?: T[K] | undefined }
type BarProps = Pick<
  Loose<RootProps>,
  | "orientation"
  | "loop"
  | "disabled"
  | "focusableWhenDisabled"
  | "actionsRef"
  | "render"
  | "children"
> & { dir?: "ltr" | "rtl" | undefined; label?: string | null | undefined }
const NAMES = ["Undo", "Bold", "Italic", "Link"]

/** The toolbar between a "Before" and an "After" button, so Tab in and out are real. */
function Bar({ children, dir, label = "Formatting", ...root }: BarProps) {
  return (
    <RindProvider {...(dir ? { dir } : {})}>
      <button type="button">Before</button>
      <Toolbar.Root
        {...(label === null ? {} : { "aria-label": label })}
        {...(root as RootProps)} // optional props only: undefined ones are the defaults
      >
        {children ??
          NAMES.map((n) => (
            <Toolbar.Button key={n} id={n}>
              {n}
            </Toolbar.Button>
          ))}
      </Toolbar.Root>
      <button type="button">After</button>
    </RindProvider>
  )
}

const drv = (name = "Formatting") => getToolbar(screen, { name }, { platform })
const byName = (name: string) => screen.getByRole("button", { name })
const focused = () => document.activeElement
const hosted = () => [...document.querySelectorAll<HTMLElement>('[data-host="toolbar"]')]
const stops = () => hosted().filter((c) => c.getAttribute("tabindex") === "0")
const focus = (el: HTMLElement) => act(() => el.focus())
/** Tab into the toolbar from "Before". */
async function enter(user = userEvent.setup()) {
  focus(byName("Before"))
  await user.tab()
  return user
}

describe("Anatomy and Roles And Naming", () => {
  it("root role toolbar named by aria-label; controls keep their roles", () => {
    render(<Bar />)
    const root = screen.getByRole("toolbar", { name: "Formatting" })
    expect(root.hasAttribute("aria-orientation")).toBe(false)
    expect(root.getAttribute("data-orientation")).toBe("horizontal")
    expect(NAMES.every((n) => byName(n).getAttribute("data-host") === "toolbar")).toBe(true)
    expect(root.hasAttribute("tabindex")).toBe(false)
  })

  it("vertical toolbar: aria-orientation=vertical", () => {
    render(<Bar orientation="vertical" />)
    expect(screen.getByRole("toolbar").getAttribute("aria-orientation")).toBe("vertical")
  })

  it("an unnamed toolbar warns in development", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    render(<Bar label={null} />)
    expect(warn.mock.calls.some((c) => String(c[0]).includes("no accessible name"))).toBe(true)
  })

  it("a named toolbar does not warn", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    render(<Bar />)
    expect(warn).not.toHaveBeenCalled()
  })

  it("buttons, a toggle group and a link: no axe violations, no invented roles (radix#949)", async () => {
    render(
      <Bar>
        <Toolbar.Button id="u">Undo</Toolbar.Button>
        <Toolbar.Separator />
        <ToggleGroup.Root aria-label="Style" selectionMode="multiple">
          <ToggleGroup.Item value="b">Bold</ToggleGroup.Item>
          <ToggleGroup.Item value="i">Italic</ToggleGroup.Item>
        </ToggleGroup.Root>
        <Toolbar.Link id="l" href="/docs">
          Docs
        </Toolbar.Link>
      </Bar>,
    )
    await a11y()
    const valid = new Set(["toolbar", "group", "separator", "link", "button", null])
    const roles = [...document.querySelectorAll("[role]")].map((e) => e.getAttribute("role"))
    expect(roles.every((r) => valid.has(r))).toBe(true)
  })
})

describe("One Tab Stop With Focus Memory", () => {
  it("exactly one tab stop: the first control, before and after hydration of the collection", () => {
    render(<Bar />)
    expect(stops().map((c) => c.id)).toEqual(["Undo"])
  })

  it("returns to the last control after Tab out and Shift+Tab back", async () => {
    render(<Bar />)
    const user = await enter()
    expect(focused()).toBe(byName("Undo"))
    await user.keyboard("{ArrowRight}{ArrowRight}")
    expect(focused()).toBe(byName("Italic"))
    await user.tab()
    expect(focused()).toBe(byName("After"))
    await user.tab({ shift: true })
    expect(focused()).toBe(byName("Italic"))
    expect(stops().map((c) => c.id)).toEqual(["Italic"])
  })

  it("re-entry dispatches one focus event on one control (react-spectrum#5457)", async () => {
    render(<Bar />)
    const user = await enter()
    await user.keyboard("{ArrowRight}")
    await user.tab()
    const seen: string[] = []
    const on = (e: FocusEvent) => {
      if ((e.target as HTMLElement).getAttribute("data-host") === "toolbar") {
        seen.push((e.target as HTMLElement).id)
      }
    }
    document.addEventListener("focus", on, true)
    await user.tab({ shift: true })
    document.removeEventListener("focus", on, true)
    expect(seen).toEqual(["Bold"])
  })

  it("Tab leaves directly: no other control is focused on the way (react-spectrum#10496)", async () => {
    render(<Bar />)
    focus(byName("Before"))
    const seen: string[] = []
    const on = (e: FocusEvent) => seen.push((e.target as HTMLElement).textContent ?? "?")
    document.addEventListener("focus", on, true)
    const user = userEvent.setup()
    await user.tab()
    await user.tab()
    document.removeEventListener("focus", on, true)
    expect(seen).toEqual(["Undo", "After"])
  })

  it("highlight shows only while focus is inside; the control keeps tabIndex=0", async () => {
    render(<Bar />)
    const user = await enter()
    await user.keyboard("{ArrowRight}{ArrowRight}")
    expect(byName("Italic").hasAttribute("data-highlighted")).toBe(true)
    expect(hosted().filter((c) => c.hasAttribute("data-highlighted"))).toHaveLength(1)
    await user.tab()
    expect(hosted().some((c) => c.hasAttribute("data-highlighted"))).toBe(false)
    expect(byName("Italic").getAttribute("tabindex")).toBe("0")
  })

  it("Tab and Shift+Tab are not intercepted", async () => {
    render(<Bar />)
    const keys: boolean[] = []
    const on = (e: KeyboardEvent) => e.key === "Tab" && keys.push(e.defaultPrevented)
    document.addEventListener("keydown", on)
    const user = await enter()
    await user.tab()
    await user.tab({ shift: true })
    document.removeEventListener("keydown", on)
    expect(keys.every((p) => !p)).toBe(true)
  })
})

describe("Keyboard Navigation", () => {
  it("ArrowRight / ArrowLeft move, Home / End go to the ends, no activation", async () => {
    const onClick = vi.fn()
    render(
      <Bar>
        {NAMES.map((n) => (
          <Toolbar.Button key={n} id={n} onClick={onClick}>
            {n}
          </Toolbar.Button>
        ))}
      </Bar>,
    )
    const user = await enter()
    await user.keyboard("{ArrowRight}")
    expect(focused()).toBe(byName("Bold"))
    await user.keyboard("{End}")
    expect(focused()).toBe(byName("Link"))
    await user.keyboard("{ArrowLeft}")
    expect(focused()).toBe(byName("Italic"))
    await user.keyboard("{Home}")
    expect(focused()).toBe(byName("Undo"))
    expect(onClick).not.toHaveBeenCalled()
  })

  it("wraps at both ends", async () => {
    render(<Bar />)
    const user = await enter()
    await user.keyboard("{ArrowLeft}")
    expect(focused()).toBe(byName("Link"))
    await user.keyboard("{ArrowRight}")
    expect(focused()).toBe(byName("Undo"))
  })

  it("loop={false} stops at the ends", async () => {
    render(<Bar loop={false} />)
    const user = await enter()
    await user.keyboard("{ArrowLeft}")
    expect(focused()).toBe(byName("Undo"))
    await user.keyboard("{End}{ArrowRight}")
    expect(focused()).toBe(byName("Link"))
  })

  it("vertical: ArrowDown / ArrowUp; ArrowRight is left to the control", async () => {
    render(<Bar orientation="vertical" />)
    const user = await enter()
    await user.keyboard("{ArrowRight}")
    expect(focused()).toBe(byName("Undo"))
    await user.keyboard("{ArrowDown}")
    expect(focused()).toBe(byName("Bold"))
    await user.keyboard("{ArrowUp}")
    expect(focused()).toBe(byName("Undo"))
  })

  it("horizontal: ArrowDown / ArrowUp are left to the control", async () => {
    render(<Bar />)
    const user = await enter()
    await user.keyboard("{ArrowDown}{ArrowUp}")
    expect(focused()).toBe(byName("Undo"))
  })

  it("right-to-left mirrors the arrows (ariakit#6299)", async () => {
    render(<Bar dir="rtl" />)
    const user = await enter()
    await user.keyboard("{ArrowLeft}")
    expect(focused()).toBe(byName("Bold"))
    await user.keyboard("{ArrowRight}")
    expect(focused()).toBe(byName("Undo"))
  })

  it("separators and groups are skipped; the toolbar has no typeahead", async () => {
    render(
      <Bar>
        <Toolbar.Button id="a">Alpha</Toolbar.Button>
        <Toolbar.Separator />
        <Toolbar.Group aria-label="G">
          <Toolbar.Button id="b">Beta</Toolbar.Button>
        </Toolbar.Group>
        <Toolbar.Button id="c">Gamma</Toolbar.Button>
      </Bar>,
    )
    const user = await enter()
    await user.keyboard("{ArrowRight}")
    expect(focused()).toBe(byName("Beta"))
    await user.keyboard("g")
    expect(focused()).toBe(byName("Beta"))
    await user.keyboard("{ArrowRight}")
    expect(focused()).toBe(byName("Gamma"))
  })

  it("makes no announcements while navigating", async () => {
    const log = installAnnouncementLog()
    render(<Bar />)
    const before = log.length
    const user = await enter()
    await user.keyboard("{ArrowRight}{ArrowRight}{End}")
    expect(log.length).toBe(before)
    expect(document.querySelector("[aria-live]")).toBeNull()
  })
})

describe("Key Ownership", () => {
  const Fields = (props: { value?: string }) => (
    <Bar>
      <Toolbar.Button id="u">Undo</Toolbar.Button>
      <Toolbar.Item
        id="size"
        render={<input aria-label="Size" defaultValue={props.value ?? "hello"} />}
      />
      <Toolbar.Button id="b">Bold</Toolbar.Button>
    </Bar>
  )
  const input = () => screen.getByRole("textbox", { name: "Size" }) as HTMLInputElement

  it("caret moves inside a text field; only the sixth press leaves (react-spectrum#7937)", async () => {
    render(<Fields />)
    const user = userEvent.setup()
    focus(input())
    input().setSelectionRange(2, 2)
    await user.keyboard("{ArrowLeft}")
    expect(input().selectionStart).toBe(1)
    await user.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}")
    expect(input().selectionStart).toBe(5)
    expect(focused()).toBe(input())
    await user.keyboard("{ArrowRight}")
    expect(focused()).toBe(byName("Bold"))
  })

  it("ArrowLeft from the start of the value leaves; with a selection it does not", async () => {
    render(<Fields />)
    const user = userEvent.setup()
    focus(input())
    input().setSelectionRange(0, 5)
    await user.keyboard("{ArrowLeft}")
    expect(focused()).toBe(input())
    input().setSelectionRange(0, 0)
    await user.keyboard("{ArrowLeft}")
    expect(focused()).toBe(byName("Undo"))
  })

  it("Shift+Arrow extends the selection and stays in the field", async () => {
    render(<Fields />)
    const user = userEvent.setup()
    focus(input())
    input().setSelectionRange(5, 5)
    await user.keyboard("{Shift>}{ArrowRight}{/Shift}")
    expect(focused()).toBe(input())
  })

  it("Home and End belong to the field (react-spectrum#8636, base-ui#4487)", async () => {
    render(<Fields />)
    const user = userEvent.setup()
    focus(input())
    input().setSelectionRange(3, 3)
    await user.keyboard("{Home}")
    expect(focused()).toBe(input())
    expect(input().selectionStart).toBe(0)
    await user.keyboard("{End}")
    expect(focused()).toBe(input())
    expect(input().selectionStart).toBe(5)
  })

  it("an empty field hands both arrows over", async () => {
    render(<Fields value="" />)
    const user = userEvent.setup()
    focus(input())
    await user.keyboard("{ArrowRight}")
    expect(focused()).toBe(byName("Bold"))
  })

  it("a text field as first and last control", async () => {
    render(
      <Bar>
        <Toolbar.Item id="f" render={<input aria-label="First" defaultValue="" />} />
        <Toolbar.Button id="m">Mid</Toolbar.Button>
        <Toolbar.Item id="l" render={<input aria-label="Last" defaultValue="" />} />
      </Bar>,
    )
    const user = await enter()
    expect(focused()).toBe(screen.getByRole("textbox", { name: "First" }))
    await user.keyboard("{ArrowRight}{ArrowRight}")
    expect(focused()).toBe(screen.getByRole("textbox", { name: "Last" }))
    await user.keyboard("{ArrowRight}")
    expect(focused()).toBe(screen.getByRole("textbox", { name: "First" }))
  })

  it("Alt+Arrow is left alone (ariakit#7099)", async () => {
    render(<Bar />)
    const user = await enter()
    await user.keyboard("{Alt>}{ArrowRight}{/Alt}")
    expect(focused()).toBe(byName("Undo"))
    await user.keyboard("{Control>}{ArrowRight}{/Control}{Meta>}{End}{/Meta}")
    expect(focused()).toBe(byName("Undo"))
  })

  it("keys from a portalled element are ignored (base-ui#1759)", async () => {
    render(
      <Bar>
        <Toolbar.Button id="u">Undo</Toolbar.Button>
        <Toolbar.Button id="m">More</Toolbar.Button>
        <Portal>
          <button type="button" id="menu-item">
            Menu item
          </button>
        </Portal>
      </Bar>,
    )
    const item = await screen.findByRole("button", { name: "Menu item" })
    const user = userEvent.setup()
    focus(item)
    await user.keyboard("{ArrowRight}{ArrowLeft}{Home}{End}")
    expect(focused()).toBe(item)
  })

  it("a control that preventDefaults an arrow keeps it", async () => {
    render(
      <Bar>
        <Toolbar.Button id="u" onKeyDown={(e) => e.key === "ArrowRight" && e.preventDefault()}>
          Undo
        </Toolbar.Button>
        <Toolbar.Button id="b">Bold</Toolbar.Button>
      </Bar>,
    )
    const user = await enter()
    await user.keyboard("{ArrowRight}")
    expect(focused()).toBe(byName("Undo"))
  })

  it("Enter and Space stay with the control", async () => {
    const onClick = vi.fn()
    render(
      <Bar>
        <Toolbar.Button id="u" onPress={onClick}>
          Undo
        </Toolbar.Button>
        <Toolbar.Button id="b">Bold</Toolbar.Button>
      </Bar>,
    )
    const user = await enter()
    await user.keyboard("{Enter} ")
    expect(onClick).toHaveBeenCalledTimes(2)
    expect(focused()).toBe(byName("Undo"))
  })
})

describe("Disabled Controls", () => {
  function Switchable({ rootProps = {} }: { rootProps?: Pick<BarProps, "focusableWhenDisabled"> }) {
    const [off, setOff] = useState(false)
    return (
      <>
        <button type="button" onClick={() => setOff(true)}>
          Disable first
        </button>
        <Bar {...rootProps}>
          <Toolbar.Button id="u" disabled={off}>
            Undo
          </Toolbar.Button>
          <Toolbar.Button id="b">Bold</Toolbar.Button>
          <Toolbar.Button id="i">Italic</Toolbar.Button>
        </Bar>
      </>
    )
  }

  it("a first control disabled after render is not the stop (ariakit#3232)", async () => {
    render(<Switchable rootProps={{ focusableWhenDisabled: false }} />)
    await userEvent.setup().click(screen.getByRole("button", { name: "Disable first" }))
    expect(stops().map((c) => c.id)).toEqual(["b"])
    const user = await enter()
    expect(focused()).toBe(byName("Bold"))
    await user.tab()
    expect(focused()).toBe(byName("After"))
  })

  it("disabling the focused control keeps focus on it with aria-disabled (ariakit#7359)", async () => {
    function Ctl() {
      const [off, setOff] = useState(false)
      return (
        <Bar>
          <Toolbar.Button id="u" disabled={off} onPress={() => setOff(true)}>
            Undo
          </Toolbar.Button>
          <Toolbar.Button id="b">Bold</Toolbar.Button>
        </Bar>
      )
    }
    render(<Ctl />)
    const user = await enter()
    await user.keyboard("{Enter}")
    expect(focused()).toBe(byName("Undo"))
    expect(byName("Undo").getAttribute("aria-disabled")).toBe("true")
    expect(stops()).toHaveLength(1)
    await user.keyboard("{ArrowRight}")
    expect(focused()).toBe(byName("Bold"))
  })

  it("disabled controls stay reachable, are aria-disabled and do not activate", async () => {
    const onClick = vi.fn()
    render(
      <Bar>
        <Toolbar.Button id="u">Undo</Toolbar.Button>
        <Toolbar.Button id="b" disabled onPress={onClick}>
          Bold
        </Toolbar.Button>
        <Toolbar.Button id="i">Italic</Toolbar.Button>
      </Bar>,
    )
    const user = await enter()
    await user.keyboard("{ArrowRight}")
    expect(focused()).toBe(byName("Bold"))
    expect(byName("Bold").getAttribute("aria-disabled")).toBe("true")
    expect(byName("Bold").hasAttribute("disabled")).toBe(false)
    await user.keyboard("{Enter} ")
    expect(onClick).not.toHaveBeenCalled()
    expect(await drv().isDisabled("Bold")).toBe(true)
  })

  it("focusableWhenDisabled={false}: native disabled, skipped by arrows (base-ui#2175)", async () => {
    render(
      <Bar>
        <Toolbar.Button id="u">Undo</Toolbar.Button>
        <Toolbar.Button id="b" disabled focusableWhenDisabled={false}>
          Bold
        </Toolbar.Button>
        <Toolbar.Button id="i">Italic</Toolbar.Button>
      </Bar>,
    )
    expect(byName("Bold").hasAttribute("disabled")).toBe(true)
    const user = await enter()
    await user.keyboard("{ArrowRight}")
    expect(focused()).toBe(byName("Italic"))
  })

  it("a disabled toolbar disables every control; a disabled group only its own", async () => {
    render(
      <Bar>
        <Toolbar.Button id="u">Undo</Toolbar.Button>
        <Toolbar.Group aria-label="G" disabled>
          <Toolbar.Button id="b">Bold</Toolbar.Button>
        </Toolbar.Group>
      </Bar>,
    )
    expect(byName("Undo").hasAttribute("aria-disabled")).toBe(false)
    expect(byName("Bold").getAttribute("aria-disabled")).toBe("true")
    expect(screen.getByRole("group", { name: "G" }).hasAttribute("data-disabled")).toBe(true)
  })

  it("root disabled: every control, root data-disabled", () => {
    render(<Bar disabled />)
    expect(screen.getByRole("toolbar").hasAttribute("data-disabled")).toBe(true)
    for (const n of NAMES) expect(byName(n).getAttribute("aria-disabled")).toBe("true")
  })

  it("a disabled focusable text field is read-only: typing and paste change nothing (base-ui#5366)", async () => {
    const onChange = vi.fn()
    render(
      <Bar>
        <Toolbar.Item
          id="f"
          disabled
          render={<input aria-label="Size" defaultValue="abc" onChange={onChange} />}
        />
        <Toolbar.Button id="b">Bold</Toolbar.Button>
      </Bar>,
    )
    const field = screen.getByRole("textbox", { name: "Size" }) as HTMLInputElement
    expect(field.readOnly).toBe(true)
    expect(field.getAttribute("aria-disabled")).toBe("true")
    const user = userEvent.setup()
    focus(field)
    await user.keyboard("xyz")
    await user.paste("pasted")
    // An IME commit: composition events followed by the input event.
    field.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }))
    field.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "日本語" }))
    expect(field.value).toBe("abc")
    expect(onChange).not.toHaveBeenCalled()
  })

  it("a disabled text field with focusableWhenDisabled={false} is natively disabled", () => {
    render(
      <Bar>
        <Toolbar.Item
          id="f"
          disabled
          focusableWhenDisabled={false}
          render={<input aria-label="Size" />}
        />
        <Toolbar.Button id="b">Bold</Toolbar.Button>
      </Bar>,
    )
    expect(screen.getByRole("textbox").hasAttribute("disabled")).toBe(true)
  })

  it("removing the tab-stop control keeps exactly one stop", async () => {
    function Ctl() {
      const [gone, setGone] = useState(false)
      return (
        <>
          <button type="button" onClick={() => setGone(true)}>
            Remove
          </button>
          <Bar>
            {!gone && <Toolbar.Button id="u">Undo</Toolbar.Button>}
            <Toolbar.Button id="b">Bold</Toolbar.Button>
          </Bar>
        </>
      )
    }
    render(<Ctl />)
    await userEvent.setup().click(screen.getByRole("button", { name: "Remove" }))
    expect(stops().map((c) => c.id)).toEqual(["b"])
  })
})

describe("Buttons And Links", () => {
  it("a link: Space dispatches one click and does not scroll; Enter stays native", async () => {
    const router = fakeRouter()
    render(
      <RouterProvider navigate={router.navigate}>
        <Bar>
          <Toolbar.Button id="u">Undo</Toolbar.Button>
          <Toolbar.Link id="l" href="/docs">
            Docs
          </Toolbar.Link>
        </Bar>
      </RouterProvider>,
    )
    interceptNativeNavigation(window)
    const prevented: boolean[] = []
    const on = (e: KeyboardEvent) => e.key === " " && prevented.push(e.defaultPrevented)
    document.addEventListener("keydown", on)
    const link = screen.getByRole("link", { name: "Docs" })
    const user = userEvent.setup()
    focus(link)
    await user.keyboard(" ")
    document.removeEventListener("keydown", on)
    // The toolbar's handler runs on the link before this document-level observer (bubbling).
    expect(prevented).toEqual([true])
    expect(router.calls).toHaveLength(1)
    await user.keyboard("{Enter}")
    expect(router.calls).toHaveLength(2)
  })

  it("Enter on a link inside a group navigates (bits-ui#642)", async () => {
    const router = fakeRouter()
    render(
      <RouterProvider navigate={router.navigate}>
        <Bar>
          <Toolbar.Group aria-label="Links">
            <Toolbar.Link id="l" href="/docs">
              Docs
            </Toolbar.Link>
          </Toolbar.Group>
          <Toolbar.Button id="u">Undo</Toolbar.Button>
        </Bar>
      </RouterProvider>,
    )
    const user = await enter()
    expect(focused()).toBe(screen.getByRole("link", { name: "Docs" }))
    await user.keyboard("{Enter}")
    expect(router.calls).toEqual([{ href: "/docs", routerOptions: undefined }])
  })

  it("a toolbar link uses the environment router; the new-tab click is left to the browser", async () => {
    interceptNativeNavigation(window)
    navigationLog().length = 0
    const router = fakeRouter()
    render(
      <RouterProvider navigate={router.navigate}>
        <Bar>
          <Toolbar.Link id="l" href="/docs">
            Docs
          </Toolbar.Link>
        </Bar>
      </RouterProvider>,
    )
    // The link driver locates `link.link`; a toolbar link is `toolbar.link`: click directly.
    const link = screen.getByRole("link", { name: "Docs" })
    act(() => {
      link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }))
    })
    expect(router.calls).toEqual([{ href: "/docs", routerOptions: undefined }])
    act(() => {
      link.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true, metaKey: true, ctrlKey: true }),
      )
    })
    expect(router.calls).toHaveLength(1)
    expect(navigationLog().map((n) => [n.via, n.newTab])).toEqual([
      ["router", false],
      ["browser", true],
    ])
  })

  it("a link is a roving control with a tab stop like the others", async () => {
    render(
      <Bar>
        <Toolbar.Link id="l" href="/a">
          A
        </Toolbar.Link>
        <Toolbar.Button id="b">B</Toolbar.Button>
      </Bar>,
    )
    expect(stops().map((c) => c.id)).toEqual(["l"])
    const user = await enter()
    await user.keyboard("{ArrowRight}")
    expect(focused()).toBe(byName("B"))
  })
})

describe("Pointer Interaction", () => {
  it("a press focuses the control and makes it the tab stop", async () => {
    render(<Bar />)
    await drv().press("Italic")
    expect(focused()).toBe(byName("Italic"))
    expect(stops().map((c) => c.id)).toEqual(["Italic"])
  })

  it("focusOnPress={false} activates while the editor keeps focus (radix#2507)", async () => {
    const onClick = vi.fn()
    render(
      <Bar>
        <Toolbar.Button id="bold" focusOnPress={false} onClick={onClick}>
          Bold
        </Toolbar.Button>
        <Toolbar.Button id="it">Italic</Toolbar.Button>
      </Bar>,
    )
    const editor = document.createElement("div")
    editor.contentEditable = "true"
    editor.tabIndex = 0
    editor.textContent = "text"
    document.body.append(editor)
    focus(editor)
    await drv().press("Bold")
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(focused()).toBe(editor)
    expect(stops().map((c) => c.id)).toEqual(["bold"])
    editor.remove()
  })

  it("hovering never focuses or highlights (base-ui#3094)", async () => {
    render(<Bar />)
    const user = userEvent.setup()
    for (const n of NAMES) await user.hover(byName(n))
    expect(focused()).toBe(document.body)
    expect(hosted().some((c) => c.hasAttribute("data-highlighted"))).toBe(false)
  })
})

describe("Programmatic Focus", () => {
  it("actionsRef.focus() focuses the tab stop, visibly (base-ui#1454)", () => {
    const ref: { current: { focus(): void } | null } = { current: null }
    render(<Bar actionsRef={ref as Ref<{ focus(): void }>} />)
    act(() => ref.current?.focus())
    expect(focused()).toBe(byName("Undo"))
    expect(byName("Undo").hasAttribute("data-focus-visible")).toBe(true)
  })

  it("focus() returns to the remembered control", async () => {
    const ref: { current: { focus(): void } | null } = { current: null }
    render(<Bar actionsRef={ref as Ref<{ focus(): void }>} />)
    const user = await enter()
    await user.keyboard("{ArrowRight}")
    await user.tab()
    act(() => ref.current?.focus())
    expect(focused()).toBe(byName("Bold"))
  })
})

describe("Toolbar Contract driver", () => {
  it("round trip: tabIn, moveTo, press (getToolbar)", async () => {
    const onClick = vi.fn()
    render(
      <Bar>
        {NAMES.map((n) => (
          <Toolbar.Button key={n} id={n} onClick={n === "Italic" ? onClick : undefined}>
            {n}
          </Toolbar.Button>
        ))}
      </Bar>,
    )
    const t = drv()
    await t.tabIn()
    expect(await t.focusedItem()).toBe("Undo")
    await t.moveTo("Italic")
    expect(await t.focusedItem()).toBe("Italic")
    await t.press("Italic")
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(await t.items()).toEqual(NAMES)
    expect(await t.tabStop()).toBe("Italic")
    expect(await t.orientation()).toBe("horizontal")
    await t.tabOut()
    expect(await t.focusedItem()).toBeNull()
  })

  it("vertical: moveTo arrows down", async () => {
    render(<Bar orientation="vertical" />)
    const t = drv()
    await t.tabIn()
    await t.moveTo("Italic")
    expect(await t.focusedItem()).toBe("Italic")
    expect(await t.orientation()).toBe("vertical")
  })

  it("getSeparator with the toolbar host: vertical in a horizontal toolbar", async () => {
    render(
      <Bar>
        <Toolbar.Button id="u">Undo</Toolbar.Button>
        <Toolbar.Separator />
        <Toolbar.Button id="b">Bold</Toolbar.Button>
      </Bar>,
    )
    const sep = getSeparator(
      screen,
      { within: screen.getByRole("toolbar"), host: "toolbar" },
      { platform },
    )
    expect(await sep.orientation()).toBe("vertical")
    const el = screen.getByRole("separator")
    expect(el.getAttribute("aria-orientation")).toBe("vertical")
    expect(el.getAttribute("data-scope")).toBe("toolbar")
    expect(el.getAttribute("data-part")).toBe("separator")
  })

  it("separators: perpendicular default in a vertical toolbar, explicit orientation wins", () => {
    render(
      <Bar orientation="vertical">
        <Toolbar.Button id="u">Undo</Toolbar.Button>
        <Toolbar.Separator />
        <Toolbar.Separator orientation="vertical" />
      </Bar>,
    )
    const seps = screen.getAllByRole("separator")
    expect(seps.map((s) => s.getAttribute("data-orientation"))).toEqual(["horizontal", "vertical"])
  })
})

// ---- Hosted components (R.1, R.2, composite-host) ----
const Hosted = ({
  onValueChange,
  value,
  radio,
  children,
  ...root
}: BarProps & {
  onValueChange?: (v: readonly string[]) => void
  value?: readonly string[]
  radio?: (v: string | null) => void
  children?: ReactNode
}) => (
  <Bar {...root}>
    <Toolbar.Button id="undo">Undo</Toolbar.Button>
    <ToggleGroup.Root
      aria-label="Style"
      selectionMode="multiple"
      {...(value ? { value } : {})}
      {...(onValueChange ? { onValueChange } : {})}
    >
      <ToggleGroup.Item value="b">Bold</ToggleGroup.Item>
      <ToggleGroup.Item value="i">Italic</ToggleGroup.Item>
    </ToggleGroup.Root>
    <Toolbar.Link id="link" href="/x">
      Link
    </Toolbar.Link>
    <Toolbar.Separator />
    <RadioGroup.Root
      aria-label="Alignment"
      defaultValue="left"
      {...(radio ? { onValueChange: radio } : {})}
    >
      {["Left", "Center", "Right"].map((l) => (
        <RadioGroup.Item key={l} value={l.toLowerCase()}>
          <RadioGroup.ItemControl />
          <RadioGroup.ItemLabel>{l}</RadioGroup.ItemLabel>
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
    {children}
  </Bar>
)
const radio = (name: string) => screen.getByRole("radio", { name })

describe("Hosted toggle group and radio group", () => {
  it("arrows cross the toggle group in both directions: Undo, Bold, Italic, Link", async () => {
    render(<Hosted />)
    const user = await enter()
    expect(focused()).toBe(byName("Undo"))
    await user.keyboard("{ArrowRight}")
    expect(focused()).toBe(byName("Bold"))
    await user.keyboard("{ArrowRight}")
    expect(focused()).toBe(byName("Italic"))
    await user.keyboard("{ArrowRight}")
    expect(focused()).toBe(screen.getByRole("link", { name: "Link" }))
    await user.keyboard("{ArrowLeft}{ArrowLeft}")
    expect(focused()).toBe(byName("Bold"))
  })

  it("one tab stop overall; the group roots have no tabindex", () => {
    render(<Hosted />)
    expect(hosted()).toHaveLength(7)
    expect(stops()).toHaveLength(1)
    expect(screen.getByRole("group", { name: "Style" }).hasAttribute("tabindex")).toBe(false)
    expect(screen.getByRole("radiogroup").hasAttribute("tabindex")).toBe(false)
  })

  it("two hosted groups and three buttons: exactly one of seven controls is the stop", () => {
    render(
      <Bar>
        <Toolbar.Button id="a">A</Toolbar.Button>
        <ToggleGroup.Root aria-label="One">
          <ToggleGroup.Item value="1">One-1</ToggleGroup.Item>
          <ToggleGroup.Item value="2">One-2</ToggleGroup.Item>
        </ToggleGroup.Root>
        <Toolbar.Button id="b">B</Toolbar.Button>
        <ToggleGroup.Root aria-label="Two">
          <ToggleGroup.Item value="1">Two-1</ToggleGroup.Item>
          <ToggleGroup.Item value="2">Two-2</ToggleGroup.Item>
        </ToggleGroup.Root>
        <Toolbar.Button id="c">C</Toolbar.Button>
      </Bar>,
    )
    expect(hosted()).toHaveLength(7)
    expect(stops()).toHaveLength(1)
  })

  it("no onValueChange on mount, exactly one on a press (bits-ui#446)", async () => {
    const onValueChange = vi.fn()
    function Controlled() {
      const [value, setValue] = useState<readonly string[]>([])
      return (
        <Hosted
          value={value}
          onValueChange={(v) => {
            onValueChange(v)
            setValue(v)
          }}
        />
      )
    }
    render(<Controlled />)
    expect(onValueChange).not.toHaveBeenCalled()
    await getToggleGroup(screen, { name: "Style" }, { platform }).toggle("Bold")
    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(byName("Bold").getAttribute("aria-pressed")).toBe("true")
    expect(stops()).toHaveLength(1)
  })

  it("arrows never press a toggle", async () => {
    const onValueChange = vi.fn()
    render(<Hosted onValueChange={onValueChange} />)
    const user = await enter()
    await user.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}")
    expect(onValueChange).not.toHaveBeenCalled()
    expect(byName("Bold").getAttribute("aria-pressed")).toBe("false")
    expect(byName("Italic").getAttribute("aria-pressed")).toBe("false")
  })

  it("a hosted toggle group keeps aria-pressed and role group (radix#4119)", () => {
    render(
      <Bar>
        <Toolbar.Button id="u">Undo</Toolbar.Button>
        <ToggleGroup.Root aria-label="Style">
          <ToggleGroup.Item value="b">Bold</ToggleGroup.Item>
        </ToggleGroup.Root>
      </Bar>,
    )
    expect(screen.getByRole("group", { name: "Style" })).toBeTruthy()
    expect(byName("Bold").getAttribute("aria-pressed")).toBe("false")
    expect(byName("Bold").getAttribute("role")).toBeNull()
  })

  it("Enter and Space still press a hosted toggle", async () => {
    render(<Hosted />)
    const user = await enter()
    await user.keyboard("{ArrowRight}{Enter}")
    expect(byName("Bold").getAttribute("aria-pressed")).toBe("true")
    await user.keyboard(" ")
    expect(byName("Bold").getAttribute("aria-pressed")).toBe("false")
  })

  it("a hosted radio: arrows move without checking; Enter checks once (radix#2146, kobalte#579)", async () => {
    const onValueChange = vi.fn()
    render(<Hosted radio={onValueChange} />)
    const user = await enter()
    await user.keyboard("{End}")
    expect(focused()).toBe(radio("Right"))
    await user.keyboard("{ArrowLeft}{ArrowRight}")
    expect(focused()).toBe(radio("Right"))
    expect(radio("Left").getAttribute("aria-checked")).toBe("true")
    expect(onValueChange).not.toHaveBeenCalled()
    await user.keyboard("{Enter}")
    expect(radio("Right").getAttribute("aria-checked")).toBe("true")
    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(screen.getByRole("radiogroup").getAttribute("role")).toBe("radiogroup")
  })

  it("Space checks the focused hosted radio", async () => {
    render(<Hosted />)
    const user = await enter()
    await user.keyboard("{End}{ArrowLeft} ")
    expect(radio("Center").getAttribute("aria-checked")).toBe("true")
  })

  it("focusing a hosted radio without a key never checks (screen reader cursor)", () => {
    const onValueChange = vi.fn()
    render(<Hosted radio={onValueChange} />)
    focus(radio("Right"))
    expect(radio("Right").getAttribute("aria-checked")).toBe("false")
    expect(radio("Left").getAttribute("aria-checked")).toBe("true")
    expect(onValueChange).not.toHaveBeenCalled()
  })

  it("the radio and toggle drivers work unchanged inside the toolbar", async () => {
    render(<Hosted />)
    const align = getRadioGroup(screen, { name: "Alignment" }, { platform })
    await align.check("Center")
    expect(await align.checked()).toBe("Center")
    // Not via("keyboard").check(): that action checks by arrows, which a host never does.
    const style = getToggleGroup(screen, { name: "Style" }, { platform })
    await style.toggle("Italic")
    expect(byName("Italic").getAttribute("aria-pressed")).toBe("true")
  })

  it("a disabled toolbar disables the hosted items; pressing changes nothing", async () => {
    const onValueChange = vi.fn()
    render(<Hosted disabled onValueChange={onValueChange} />)
    expect(byName("Bold").getAttribute("aria-disabled")).toBe("true")
    expect(radio("Center").getAttribute("aria-disabled")).toBe("true")
    await userEvent.setup().click(byName("Bold"))
    expect(onValueChange).not.toHaveBeenCalled()
    expect(byName("Bold").getAttribute("aria-pressed")).toBe("false")
  })

  it("a disabled toolbar group disables the hosted groups inside it", () => {
    render(
      <Bar>
        <Toolbar.Group aria-label="G" disabled>
          <ToggleGroup.Root aria-label="Style">
            <ToggleGroup.Item value="b">Bold</ToggleGroup.Item>
          </ToggleGroup.Root>
        </Toolbar.Group>
      </Bar>,
    )
    expect(byName("Bold").getAttribute("aria-disabled")).toBe("true")
  })

  it("a radio group inside a Portal is standalone (own tab stop and arrows)", async () => {
    render(
      <Bar>
        <Toolbar.Button id="u">Undo</Toolbar.Button>
        <Portal>
          <RadioGroup.Root aria-label="Popup" defaultValue="a">
            {["a", "b"].map((v) => (
              <RadioGroup.Item key={v} value={v}>
                <RadioGroup.ItemControl />
                <RadioGroup.ItemLabel>{v}</RadioGroup.ItemLabel>
              </RadioGroup.Item>
            ))}
          </RadioGroup.Root>
        </Portal>
      </Bar>,
    )
    const a = await screen.findByRole("radio", { name: "a" })
    expect(a.hasAttribute("data-host")).toBe(false)
    expect(a.getAttribute("tabindex")).toBe("0")
    expect(stops().map((c) => c.id)).toEqual(["u"])
    focus(a)
    await userEvent.setup().keyboard("{ArrowDown}")
    expect(radio("b").getAttribute("aria-checked")).toBe("true")
    expect(focused()).toBe(radio("b"))
  })

  it("axe: a toolbar with hosted groups has no violations", async () => {
    render(<Hosted />)
    await a11y()
  })
})

describe("Item", () => {
  it("any control: a checkbox joins the roving focus and keeps its role", async () => {
    render(
      <Bar>
        <Toolbar.Button id="u">Undo</Toolbar.Button>
        <Toolbar.Item id="c" render={<input type="checkbox" aria-label="Wrap" />} />
        <Toolbar.Button id="b">Bold</Toolbar.Button>
      </Bar>,
    )
    const user = await enter()
    await user.keyboard("{ArrowRight}")
    expect(focused()).toBe(screen.getByRole("checkbox", { name: "Wrap" }))
    await user.keyboard("{ArrowRight}")
    expect(focused()).toBe(byName("Bold"))
    expect(stops()).toHaveLength(1)
  })

  it("a substituted control activates once per press (radix#1525)", async () => {
    const onClick = vi.fn()
    render(
      <Bar>
        <Toolbar.Item id="x" onClick={onClick} render={<button type="button" />}>
          Extra
        </Toolbar.Item>
      </Bar>,
    )
    await drv().press("Extra")
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it("render on the root and groups keeps behaviour", async () => {
    render(
      <Bar render={<section />}>
        <Toolbar.Group aria-label="G" render={<fieldset />}>
          <Toolbar.Button id="u">Undo</Toolbar.Button>
        </Toolbar.Group>
      </Bar>,
    )
    expect(screen.getByRole("toolbar").tagName).toBe("SECTION")
    expect(byName("Undo").getAttribute("data-host")).toBe("toolbar")
  })
})

describe("Data attributes", () => {
  it("every part carries scope, part and instance; variant / size / tone are forwarded", () => {
    render(
      <Bar>
        <Toolbar.Button id="u" data-variant="ghost" data-size="sm" data-tone="danger">
          Undo
        </Toolbar.Button>
        <Toolbar.Group aria-label="G" data-tone="danger">
          <Toolbar.Link id="l" href="/a">
            A
          </Toolbar.Link>
        </Toolbar.Group>
        <Toolbar.Separator />
      </Bar>,
    )
    const parts = [...document.querySelectorAll('[data-scope="toolbar"]')]
    const kinds = parts.map((p) => p.getAttribute("data-part"))
    expect(kinds).toEqual(["root", "button", "group", "link", "separator"])
    expect(parts.every((p) => p.getAttribute("data-instance"))).toBe(true)
    expect(byName("Undo").getAttribute("data-tone")).toBe("danger")
    expect(byName("Undo").getAttribute("data-variant")).toBe("ghost")
    expect(byName("Undo").getAttribute("data-size")).toBe("sm")
    expect(byName("Undo").getAttribute("data-key")).toBe("u")
    expect(screen.getByRole("group").getAttribute("data-tone")).toBe("danger")
  })
})

describe("Link inside the library keeps working alone", () => {
  it("a plain Link outside a toolbar is unaffected by the host context", () => {
    render(<Link href="/a">Plain</Link>)
    expect(screen.getByRole("link", { name: "Plain" }).hasAttribute("data-host")).toBe(false)
  })
  it("a toolbar part outside a toolbar throws a readable error", () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    expect(() => render(<Toolbar.Button>X</Toolbar.Button>)).toThrow(/must be inside Toolbar.Root/)
  })
})

describe("Text field in an iframe (ariakit#6316)", () => {
  it("a toolbar rendered into a same-origin iframe by the parent window keeps the caret rules", async () => {
    const frame = document.createElement("iframe")
    document.body.append(frame)
    const doc = frame.contentDocument as Document
    const host = doc.createElement("div")
    doc.body.append(host)
    const { createRoot } = await import("react-dom/client")
    const root = createRoot(host)
    await act(async () => {
      root.render(
        <RindProvider>
          <Toolbar.Root aria-label="Framed">
            <Toolbar.Button id="u">Undo</Toolbar.Button>
            <Toolbar.Item id="f" render={<input aria-label="Size" defaultValue="hello" />} />
            <Toolbar.Button id="b">Bold</Toolbar.Button>
          </Toolbar.Root>
        </RindProvider>,
      )
    })
    const field = doc.querySelector("input") as HTMLInputElement
    let prevented: boolean | null = null
    const key = (k: string) =>
      act(() => {
        const e = new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true })
        field.dispatchEvent(e)
        prevented = e.defaultPrevented
      })
    act(() => field.focus())
    field.setSelectionRange(2, 2)
    key("ArrowLeft")
    expect(doc.activeElement).toBe(field)
    // The toolbar left the arrow to the field (it would have prevented it to move focus).
    expect(prevented).toBe(false)
    // Not asserted: moving focus out of the iframe's document (the machine's environment
    // is the parent window's) is outside the scenario; see the hand-off report.
    await act(async () => root.unmount())
    frame.remove()
  })
})
