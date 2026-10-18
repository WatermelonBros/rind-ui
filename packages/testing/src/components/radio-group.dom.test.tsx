// biome-ignore-all lint/a11y: fixtures deliberately wrap, label and click arbitrary elements
import { domEnvironment } from "@rind-ui/core"
import { Field, Fieldset, RadioGroup, RindProvider } from "@rind-ui/react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import axe from "axe-core"
import { type ReactNode, useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { getRadioGroup, installAnnouncementLog } from "../index"

const platform = domEnvironment().platform
const SIZES = [
  { value: "s", label: "Small" },
  { value: "m", label: "Medium" },
  { value: "l", label: "Large" },
]

function Size(props: Partial<Parameters<typeof RadioGroup.Root>[0]>) {
  return (
    <form data-testid="f">
      <RadioGroup.Root name="size" {...props}>
        <RadioGroup.Label>Size</RadioGroup.Label>
        {SIZES.map((s) => (
          <RadioGroup.Item key={s.value} value={s.value}>
            <RadioGroup.ItemControl>
              <RadioGroup.ItemIndicator />
            </RadioGroup.ItemControl>
            <RadioGroup.ItemLabel>{s.label}</RadioGroup.ItemLabel>
          </RadioGroup.Item>
        ))}
      </RadioGroup.Root>
      <button type="button">After</button>
    </form>
  )
}

describe("RadioGroup smoke", () => {
  it("checks by press and arrow, one tab stop, submits", async () => {
    const onValueChange = vi.fn()
    render(<Size onValueChange={onValueChange} />)
    const g = getRadioGroup(screen, { name: "Size" }, { platform })
    expect(await g.radios()).toEqual(["Small", "Medium", "Large"])
    expect(await g.checked()).toBeNull()
    expect(await g.formValue()).toEqual([])
    await g.check("Medium")
    expect(await g.checked()).toBe("Medium")
    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(await g.formValue()).toEqual([["size", "m"]])
    await g.via("keyboard").check("Large")
    expect(await g.checked()).toBe("Large")
    const tabbable = screen.getAllByRole("radio").filter((r) => r.tabIndex === 0)
    expect(tabbable).toHaveLength(1)
    // Focus alone never checks.
    screen.getByRole("radio", { name: "Small" }).focus()
    expect(await g.checked()).toBe("Large")
    // No input inside a radio.
    expect(document.querySelector("[role=radio] input")).toBeNull()
  })
})

// ---- Spec scenarios: radio-group (tasks 3.2, 4.1, 5.3, A.2) ----
const inJsdom = navigator.userAgent.includes("jsdom")
const drv = (name = "Size") => getRadioGroup(screen, { name }, { platform })
const ctrl = (name: string) => screen.getByRole("radio", { name })
const hiddenInputs = () =>
  Array.from(document.querySelectorAll<HTMLInputElement>('[data-part="hidden-input"]'))
const formEl = () => screen.getByTestId("f") as HTMLFormElement
const formData = () => new FormData(formEl())
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

type ItemSpec = {
  value: string
  label: string
  disabled?: boolean
  extra?: ReactNode
  style?: React.CSSProperties
}
function Grp({
  items = SIZES,
  description,
  error,
  label = "Size",
  after = true,
  ...root
}: Partial<Parameters<typeof RadioGroup.Root>[0]> & {
  items?: ItemSpec[]
  description?: string
  error?: string
  label?: string | null
  after?: boolean
}) {
  return (
    <form data-testid="f">
      <button type="button">Before</button>
      <RadioGroup.Root name="size" {...root}>
        {label !== null && <RadioGroup.Label>{label}</RadioGroup.Label>}
        {description && <RadioGroup.Description>{description}</RadioGroup.Description>}
        {error && <RadioGroup.ErrorMessage>{error}</RadioGroup.ErrorMessage>}
        {items.map((s) => (
          <RadioGroup.Item key={s.value} value={s.value} disabled={s.disabled === true}>
            <RadioGroup.ItemControl {...(s.style ? { style: s.style } : {})}>
              <RadioGroup.ItemIndicator />
            </RadioGroup.ItemControl>
            <RadioGroup.ItemLabel>{s.label}</RadioGroup.ItemLabel>
            {s.extra}
          </RadioGroup.Item>
        ))}
      </RadioGroup.Root>
      {after && <button type="button">After</button>}
    </form>
  )
}
const focused = () => document.activeElement
const tokens = (el: Element, attr: string) =>
  (el.getAttribute(attr) ?? "").split(" ").filter(Boolean)

describe("Anatomy", () => {
  it("the hidden input is not nested and axe finds no nested-interactive (reka-ui#1597)", async () => {
    render(<Grp />)
    expect(hiddenInputs()).toHaveLength(3)
    expect(document.querySelector("[role=radio] input")).toBeNull()
    for (const i of hiddenInputs()) expect(i.closest("[role=radio]")).toBeNull()
    const { violations } = await axe.run(document.body, {
      rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
    })
    expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([])
  })

  it("arrows ignore a link inside an item (react-spectrum#2379, #6496)", async () => {
    const user = userEvent.setup()
    render(
      <Grp
        defaultValue="s"
        items={[
          { value: "s", label: "Small", extra: <a href="#docs">Docs</a> },
          { value: "m", label: "Medium", extra: <a href="#docs2">More</a> },
          { value: "l", label: "Large" },
        ]}
      />,
    )
    act(() => ctrl("Small").focus())
    await user.keyboard("{ArrowDown}")
    expect(focused()).toBe(ctrl("Medium"))
    expect(ctrl("Medium").getAttribute("aria-checked")).toBe("true")
  })

  it("every part carries its scope and part name", () => {
    render(<Grp description="d" invalid error="e" defaultValue="s" />)
    const parts = new Set(
      Array.from(document.querySelectorAll('[data-scope="radio-group"]')).map((e) =>
        e.getAttribute("data-part"),
      ),
    )
    for (const p of [
      "root",
      "label",
      "description",
      "error-message",
      "item",
      "item-control",
      "item-indicator",
      "item-label",
    ]) {
      expect(parts.has(p), p).toBe(true)
    }
  })
})

describe("Value", () => {
  it("pressing the checked radio changes nothing and calls nothing (react-spectrum#4971, radix#1336)", async () => {
    const onValueChange = vi.fn()
    render(<Grp onValueChange={onValueChange} />)
    await click(ctrl("Medium"))
    expect(onValueChange).toHaveBeenCalledTimes(1)
    await click(ctrl("Medium"))
    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(ctrl("Medium").getAttribute("aria-checked")).toBe("true")
  })

  it("a controlled null clears every radio", () => {
    const ui = (value: string | null) => <Grp value={value} onValueChange={() => {}} />
    const { rerender } = render(ui("m"))
    expect(ctrl("Medium").getAttribute("aria-checked")).toBe("true")
    rerender(ui(null))
    expect(screen.getAllByRole("radio").map((r) => r.getAttribute("aria-checked"))).toEqual([
      "false",
      "false",
      "false",
    ])
    expect(hiddenInputs().every((i) => !i.checked)).toBe(true)
  })

  it("a controlled parent that refuses keeps the value", async () => {
    const onValueChange = vi.fn()
    render(<Grp value="s" onValueChange={onValueChange} />)
    await click(ctrl("Medium"))
    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(ctrl("Small").getAttribute("aria-checked")).toBe("true")
    expect(ctrl("Medium").getAttribute("aria-checked")).toBe("false")
  })

  it("a controlled parent that applies follows", async () => {
    function C() {
      const [v, setV] = useState<string | null>(null)
      return <Grp value={v} onValueChange={setV} />
    }
    render(<C />)
    await drv().check("Large")
    expect(await drv().checked()).toBe("Large")
  })

  it("cancel() vetoes a change", async () => {
    render(<Grp defaultValue="s" onValueChange={(_v, d) => d.cancel()} />)
    await click(ctrl("Medium"))
    expect(await drv().checked()).toBe("Small")
  })
})

describe("Keyboard and activation", () => {
  it("an arrow focuses and checks in one step, reason NAVIGATE", async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(<Grp defaultValue="s" onValueChange={onValueChange} />)
    act(() => ctrl("Small").focus())
    await user.keyboard("{ArrowDown}")
    expect(focused()).toBe(ctrl("Medium"))
    expect(ctrl("Medium").getAttribute("aria-checked")).toBe("true")
    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(onValueChange.mock.calls[0]?.[0]).toBe("m")
    expect(onValueChange.mock.calls[0]?.[1].reason).toBe("NAVIGATE")
  })

  it("all four arrows move, wrapping, whatever the orientation", async () => {
    const user = userEvent.setup()
    render(<Grp orientation="horizontal" defaultValue="s" />)
    act(() => ctrl("Small").focus())
    await user.keyboard("{ArrowUp}")
    expect(focused()).toBe(ctrl("Large"))
    await user.keyboard("{ArrowRight}")
    expect(focused()).toBe(ctrl("Small"))
    await user.keyboard("{ArrowLeft}")
    expect(focused()).toBe(ctrl("Large"))
    expect(ctrl("Large").getAttribute("aria-checked")).toBe("true")
  })

  it("horizontal orientation: ArrowDown still moves and checks (radix#3622)", async () => {
    const user = userEvent.setup()
    render(<Grp orientation="horizontal" defaultValue="s" />)
    expect(screen.getByRole("radiogroup").getAttribute("aria-orientation")).toBe("horizontal")
    act(() => ctrl("Small").focus())
    await user.keyboard("{ArrowDown}")
    expect(focused()).toBe(ctrl("Medium"))
    expect(ctrl("Medium").getAttribute("aria-checked")).toBe("true")
  })

  it("programmatic focus does not check (radix#938, bits-ui#1198)", async () => {
    const onValueChange = vi.fn()
    render(<Grp defaultValue="s" onValueChange={onValueChange} />)
    act(() => ctrl("Large").focus())
    expect(focused()).toBe(ctrl("Large"))
    expect(await drv().checked()).toBe("Small")
    expect(await drv().focusedRadio()).toBe("Large")
    expect(onValueChange).not.toHaveBeenCalled()
  })

  it.skipIf(inJsdom)(
    "pointer down, moving off and releasing outside does not check (bits-ui#2097)",
    async () => {
      const onValueChange = vi.fn()
      render(<Grp defaultValue="s" onValueChange={onValueChange} />)
      const r = ctrl("Large").getBoundingClientRect()
      const down = { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }
      await act(() =>
        userEvent.setup().pointer([
          { keys: "[MouseLeft>]", target: ctrl("Large"), coords: down },
          { target: document.body, coords: { clientX: 600, clientY: 400 } },
          { keys: "[/MouseLeft]", target: document.body, coords: { clientX: 600, clientY: 400 } },
        ]),
      )
      expect(await drv().checked()).toBe("Small")
      expect(onValueChange).not.toHaveBeenCalled()
    },
  )

  it("an ignored Control+ArrowDown arms nothing (base-ui#5626)", async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(<Grp defaultValue="s" onValueChange={onValueChange} />)
    act(() => ctrl("Small").focus())
    await user.keyboard("{Control>}{ArrowDown}{/Control}")
    expect(focused()).toBe(ctrl("Small"))
    act(() => screen.getByRole("button", { name: "After" }).focus())
    await user.tab({ shift: true })
    expect(focused()).toBe(ctrl("Small"))
    expect(await drv().checked()).toBe("Small")
    expect(onValueChange).not.toHaveBeenCalled()
  })

  it("alt and meta arrows do nothing either", async () => {
    const user = userEvent.setup()
    render(<Grp defaultValue="s" />)
    act(() => ctrl("Small").focus())
    await user.keyboard("{Alt>}{ArrowDown}{/Alt}")
    await user.keyboard("{Meta>}{ArrowDown}{/Meta}")
    expect(focused()).toBe(ctrl("Small"))
    expect(await drv().checked()).toBe("Small")
  })

  it("Home, End and letters do nothing", async () => {
    const user = userEvent.setup()
    render(<Grp defaultValue="m" />)
    act(() => ctrl("Medium").focus())
    await user.keyboard("{Home}{End}l")
    expect(focused()).toBe(ctrl("Medium"))
    expect(await drv().checked()).toBe("Medium")
  })

  it("two ArrowDown faster than focus land on the third (radix#4094)", async () => {
    render(<Grp defaultValue="s" />)
    const first = ctrl("Small")
    act(() => first.focus())
    // Both events target the stale element: focus has not been allowed to move in between.
    fireEvent.keyDown(first, { key: "ArrowDown", code: "ArrowDown" })
    fireEvent.keyDown(first, { key: "ArrowDown", code: "ArrowDown" })
    expect(focused()).toBe(ctrl("Large"))
    expect(ctrl("Large").getAttribute("aria-checked")).toBe("true")
  })

  it("Space with nothing checked checks the first radio (base-ui#5042)", async () => {
    const user = userEvent.setup()
    render(<Grp />)
    act(() => screen.getByRole("button", { name: "Before" }).focus())
    await user.tab()
    expect(focused()).toBe(ctrl("Small"))
    await user.keyboard(" ")
    expect(await drv().checked()).toBe("Small")
  })

  it("Enter submits the form once and does not check (headlessui#394)", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault())
    const onValueChange = vi.fn()
    render(
      <form data-testid="f" onSubmit={onSubmit}>
        <RadioGroup.Root name="size" onValueChange={onValueChange}>
          <RadioGroup.Label>Size</RadioGroup.Label>
          {SIZES.map((s) => (
            <RadioGroup.Item key={s.value} value={s.value}>
              <RadioGroup.ItemControl />
              <RadioGroup.ItemLabel>{s.label}</RadioGroup.ItemLabel>
            </RadioGroup.Item>
          ))}
        </RadioGroup.Root>
        <button type="submit">Send</button>
      </form>,
    )
    act(() => ctrl("Large").focus())
    await user.keyboard("{Enter}")
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onValueChange).not.toHaveBeenCalled()
    expect(await drv().checked()).toBeNull()
  })

  it("a bare click (screen reader) checks once with modality virtual", async () => {
    const onValueChange = vi.fn()
    render(<Grp onValueChange={onValueChange} />)
    act(() => ctrl("Large").click())
    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(onValueChange.mock.calls[0]?.[0]).toBe("l")
    expect(onValueChange.mock.calls[0]?.[1].event.modality).toBe("virtual")
    expect(await drv().checked()).toBe("Large")
  })

  it("the virtual modality of the driver checks once", async () => {
    const onValueChange = vi.fn()
    render(<Grp onValueChange={onValueChange} />)
    await drv().via("virtual").check("Large")
    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(await drv().checked()).toBe("Large")
  })

  it("every driver modality checks", async () => {
    for (const modality of ["pointer", "touch", "keyboard", "virtual"] as const) {
      const { unmount } = render(<Grp />)
      await drv().via(modality).check("Large")
      expect(await drv().checked(), modality).toBe("Large")
      unmount()
    }
  })

  it("RTL: ArrowLeft moves to the next radio", async () => {
    const user = userEvent.setup()
    render(
      <RindProvider dir="rtl">
        <Grp defaultValue="s" />
      </RindProvider>,
    )
    act(() => ctrl("Small").focus())
    await user.keyboard("{ArrowLeft}")
    expect(focused()).toBe(ctrl("Medium"))
    expect(ctrl("Medium").getAttribute("aria-checked")).toBe("true")
    await user.keyboard("{ArrowRight}")
    expect(focused()).toBe(ctrl("Small"))
  })
})

describe("Tab stop and focus", () => {
  const tabIn = async () => {
    const user = userEvent.setup()
    act(() => screen.getByRole("button", { name: "Before" }).focus())
    await user.tab()
  }
  const stops = () => screen.getAllByRole("radio").filter((r) => r.tabIndex === 0)

  it("nothing checked: Tab focuses the first enabled radio and checks nothing (headlessui#378)", async () => {
    render(<Grp items={[{ value: "s", label: "Small", disabled: true }, ...SIZES.slice(1)]} />)
    await tabIn()
    expect(focused()).toBe(ctrl("Medium"))
    expect(await drv().checked()).toBeNull()
    expect(stops()).toHaveLength(1)
  })

  it("the checked third radio is the stop (base-ui#1740)", async () => {
    render(<Grp defaultValue="l" />)
    await tabIn()
    expect(focused()).toBe(ctrl("Large"))
  })

  it("a disabled checked radio: the first enabled radio is the stop (bits-ui#1568)", async () => {
    render(
      <Grp
        defaultValue="l"
        items={[
          SIZES[0] as ItemSpec,
          SIZES[1] as ItemSpec,
          { ...(SIZES[2] as ItemSpec), disabled: true },
        ]}
      />,
    )
    await tabIn()
    expect(focused()).toBe(ctrl("Small"))
    const user = userEvent.setup()
    await user.keyboard("{ArrowDown}")
    expect(focused()).toBe(ctrl("Medium"))
  })

  it("a disabled group is skipped by Tab (base-ui#4174)", async () => {
    const user = userEvent.setup()
    render(<Grp disabled defaultValue="m" />)
    act(() => screen.getByRole("button", { name: "Before" }).focus())
    await user.tab()
    expect(focused()).toBe(screen.getByRole("button", { name: "After" }))
    expect(stops()).toHaveLength(0)
  })

  it("focusableWhenDisabled: the root is the one stop, aria-disabled, nothing checks", async () => {
    const user = userEvent.setup()
    render(<Grp disabled focusableWhenDisabled />)
    await tabIn()
    const root = screen.getByRole("radiogroup")
    expect(focused()).toBe(root)
    expect(root.getAttribute("aria-disabled")).toBe("true")
    await user.keyboard("{ArrowDown} ")
    expect(await drv().checked()).toBeNull()
    await user.tab()
    expect(focused()).toBe(screen.getByRole("button", { name: "After" }))
  })

  it("clicking a label checks and focuses its control, then ArrowDown checks the next (kobalte#230)", async () => {
    const user = userEvent.setup()
    render(<Grp />)
    await click(screen.getByText("Medium"))
    expect(await drv().checked()).toBe("Medium")
    expect(focused()).toBe(ctrl("Medium"))
    await user.keyboard("{ArrowDown}")
    expect(await drv().checked()).toBe("Large")
    expect(focused()).toBe(ctrl("Large"))
  })

  it("clicking a control focuses it", async () => {
    render(<Grp />)
    await click(ctrl("Large"))
    expect(focused()).toBe(ctrl("Large"))
  })

  it.skipIf(inJsdom)(
    "a click does not scroll the page or the container (zag#3239, ark#1502)",
    async () => {
      const tall = { display: "block", height: 30, width: 120 } as const
      render(
        <div>
          <div style={{ height: 1200 }} />
          <div data-testid="sc" style={{ height: 100, overflow: "auto" }}>
            <Grp
              items={["a", "b", "c", "d", "e", "f"].map((v) => ({
                value: v,
                label: v,
                style: tall,
              }))}
              after={false}
            />
          </div>
          <div style={{ height: 1200 }} />
        </div>,
      )
      const sc = screen.getByTestId("sc")
      sc.scrollTop = 30
      window.scrollTo(0, 1000)
      await frame()
      const before = { top: sc.scrollTop, y: window.scrollY }
      const target = screen.getAllByRole("radio").find((r) => {
        const b = r.getBoundingClientRect()
        const c = sc.getBoundingClientRect()
        return b.top >= c.top && b.bottom <= c.bottom && b.height > 0
      })
      expect(target).toBeTruthy()
      await click(target as Element)
      await frame()
      expect({ top: sc.scrollTop, y: window.scrollY }).toEqual(before)
    },
  )
})

describe("Disabled, read-only, required, invalid", () => {
  it("a disabled item is disabled, skipped by arrows and never checked", async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(
      <Grp
        defaultValue="s"
        onValueChange={onValueChange}
        items={[
          SIZES[0] as ItemSpec,
          { ...(SIZES[1] as ItemSpec), disabled: true },
          SIZES[2] as ItemSpec,
        ]}
      />,
    )
    const m = ctrl("Medium")
    expect(m.hasAttribute("disabled") || m.getAttribute("aria-disabled") === "true").toBe(true)
    expect(m.hasAttribute("data-disabled")).toBe(true)
    expect(await drv().isDisabled("Medium")).toBe(true)
    expect(await drv().isDisabled("Small")).toBe(false)
    act(() => ctrl("Small").focus())
    await user.keyboard("{ArrowDown}")
    expect(focused()).toBe(ctrl("Large"))
    expect(await drv().checked()).toBe("Large")
    await click(m)
    expect(await drv().checked()).toBe("Large")
    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(hiddenInputs().map((i) => i.disabled)).toEqual([false, true, false])
  })

  it("a disabled group disables every item and submits nothing (headlessui#1802 sibling)", async () => {
    render(<Grp disabled defaultValue="m" />)
    const root = screen.getByRole("radiogroup")
    expect(root.getAttribute("aria-disabled")).toBe("true")
    expect(root.hasAttribute("data-disabled")).toBe(true)
    expect(hiddenInputs().every((i) => i.disabled)).toBe(true)
    expect(formData().getAll("size")).toEqual([])
    await click(ctrl("Large"))
    expect(await drv().checked()).toBe("Medium")
  })

  it("inside a disabled fieldset every radio is disabled and nothing is submitted (headlessui#1802)", async () => {
    render(
      <fieldset disabled>
        <Grp defaultValue="m" />
      </fieldset>,
    )
    await waitFor(() => expect(hiddenInputs().every((i) => i.disabled)).toBe(true))
    expect(formData().getAll("size")).toEqual([])
    for (const r of screen.getAllByRole("radio")) {
      expect(r.hasAttribute("disabled") || r.getAttribute("aria-disabled") === "true").toBe(true)
    }
    await click(ctrl("Large"))
    expect(await drv().checked()).toBe("Medium")
  })

  it("read-only: ArrowDown moves without checking, Space and a click change nothing (zag#2675)", async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(<Grp readOnly defaultValue="s" onValueChange={onValueChange} />)
    expect(screen.getByRole("radiogroup").getAttribute("aria-readonly")).toBe("true")
    expect(await drv().isReadOnly()).toBe(true)
    act(() => ctrl("Small").focus())
    await user.keyboard("{ArrowDown}")
    expect(focused()).toBe(ctrl("Medium"))
    expect(await drv().checked()).toBe("Small")
    await user.keyboard(" ")
    expect(await drv().checked()).toBe("Small")
    await click(ctrl("Large"))
    expect(await drv().checked()).toBe("Small")
    await click(screen.getByText("Large"))
    expect(await drv().checked()).toBe("Small")
    expect(onValueChange).not.toHaveBeenCalled()
  })

  it("required is exposed on the root and on every hidden input (radix#1413, base-ui#2226)", async () => {
    render(<Grp required />)
    expect(screen.getByRole("radiogroup").getAttribute("aria-required")).toBe("true")
    expect(await drv().isRequired()).toBe(true)
    expect(hiddenInputs().every((i) => i.required)).toBe(true)
  })

  it("required alone is not invalid (react-spectrum#9809)", async () => {
    render(<Grp required />)
    expect(screen.getByRole("radiogroup").hasAttribute("aria-invalid")).toBe(false)
    for (const r of screen.getAllByRole("radio")) expect(r.hasAttribute("aria-invalid")).toBe(false)
    expect(await drv().isInvalid()).toBe(false)
  })

  it("invalid: aria-invalid on the root, described by the error message", async () => {
    render(<Grp invalid error="Pick one" />)
    const root = screen.getByRole("radiogroup")
    expect(root.getAttribute("aria-invalid")).toBe("true")
    expect(await drv().isInvalid()).toBe(true)
    const text = tokens(root, "aria-describedby")
      .map((id) => document.getElementById(id)?.textContent)
      .join(" ")
    expect(text).toContain("Pick one")
  })

  it("the error message is not rendered while valid", () => {
    render(<Grp error="Pick one" />)
    expect(screen.queryByText("Pick one")).toBeNull()
  })
})

describe("Roles and names", () => {
  it("the group is named by its Label, which is not a <label>", () => {
    render(<Grp description="Choose a size" />)
    const g = screen.getByRole("radiogroup", { name: "Size" })
    expect(g.getAttribute("aria-labelledby")).toBeTruthy()
    expect(screen.getByText("Size").tagName).not.toBe("LABEL")
    const d = tokens(g, "aria-describedby")
      .map((id) => document.getElementById(id)?.textContent)
      .join(" ")
    expect(d).toContain("Choose a size")
  })

  it("the role query count equals the number of items (radix#1694)", () => {
    render(<Grp items={[...SIZES, { value: "xl", label: "Extra large" }]} />)
    expect(screen.getAllByRole("radio")).toHaveLength(4)
    expect(hiddenInputs()).toHaveLength(4)
    for (const i of hiddenInputs()) {
      expect(i.getAttribute("aria-hidden")).toBe("true")
      expect(i.tabIndex).toBe(-1)
    }
  })

  it("the name comes from the label, never from the value (reka-ui#2860)", async () => {
    render(<Grp />)
    expect(await drv().radios()).toEqual(["Small", "Medium", "Large"])
    expect(screen.queryByRole("radio", { name: "m" })).toBeNull()
    expect(ctrl("Medium").getAttribute("aria-checked")).toBe("false")
  })

  it("located by role and name: exactly the visible control matches (ark#3792)", () => {
    render(<Grp />)
    const hits = screen.getAllByRole("radio", { name: "Medium" })
    expect(hits).toHaveLength(1)
    expect(hits[0]?.getAttribute("data-part")).toBe("item-control")
  })

  it("aria-checked is explicit on every radio", () => {
    render(<Grp defaultValue="m" />)
    expect(screen.getAllByRole("radio").map((r) => r.getAttribute("aria-checked"))).toEqual([
      "false",
      "true",
      "false",
    ])
  })

  it("an unnamed group warns in development", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    render(<Grp label={null} />)
    // checked after the Label's mount re-render (a microtask)
    await vi.waitFor(() =>
      expect(warn.mock.calls.some((c) => /no accessible name/.test(String(c[0])))).toBe(true),
    )
  })

  it("a named group (aria-label) does not warn", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    render(<Grp label={null} aria-label="Size" />)
    // the check runs in a microtask: let it run before asserting it said nothing
    await act(async () => {})
    expect(warn.mock.calls.filter((c) => /radio-group/.test(String(c[0])))).toEqual([])
  })
})

describe("Form participation", () => {
  it("native form data: no entry with nothing checked, exactly size=m with one (base-ui#2447)", async () => {
    render(<Grp />)
    expect(formData().getAll("size")).toEqual([])
    expect([...formData()]).toEqual([])
    await drv().check("Medium")
    expect([...formData()]).toEqual([["size", "m"]])
    expect(await drv().formValue()).toEqual([["size", "m"]])
  })

  it("reset restores the default value and the hidden input (headlessui#2851)", async () => {
    render(<Grp defaultValue="s" />)
    await drv().check("Large")
    expect(await drv().checked()).toBe("Large")
    act(() => formEl().reset())
    await waitFor(async () => expect(await drv().checked()).toBe("Small"))
    await waitFor(() => expect(hiddenInputs().map((i) => i.checked)).toEqual([true, false, false]))
    expect([...formData()]).toEqual([["size", "s"]])
  })

  it("a controlled reset proposes the default with reason RESET", async () => {
    const onValueChange = vi.fn()
    render(<Grp value="l" defaultValue="s" onValueChange={onValueChange} />)
    act(() => formEl().reset())
    await waitFor(() => expect(onValueChange).toHaveBeenCalledTimes(1))
    expect(onValueChange.mock.calls[0]?.[0]).toBe("s")
    expect(onValueChange.mock.calls[0]?.[1].reason).toBe("RESET")
  })

  it("an invalid submit is blocked and focuses the first enabled control (bits-ui#1727)", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const onSubmit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault())
    render(
      <form data-testid="f" onSubmit={onSubmit}>
        <RadioGroup.Root name="size" required>
          <RadioGroup.Label>Size</RadioGroup.Label>
          {SIZES.map((s, i) => (
            <RadioGroup.Item key={s.value} value={s.value} disabled={i === 0}>
              <RadioGroup.ItemControl />
              <RadioGroup.ItemLabel>{s.label}</RadioGroup.ItemLabel>
            </RadioGroup.Item>
          ))}
        </RadioGroup.Root>
      </form>,
    )
    act(() => formEl().requestSubmit())
    expect(onSubmit).not.toHaveBeenCalled()
    // jsdom runs constraint validation but does not move focus.
    if (!inJsdom) await waitFor(() => expect(focused()).toBe(ctrl("Medium")))
    expect(
      [...error.mock.calls, ...warn.mock.calls].filter((c) => /aria-hidden/.test(String(c[0]))),
    ).toEqual([])
    await drv().check("Large")
    act(() => formEl().requestSubmit())
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it("two groups without names in one form are independent (ariakit#3833)", async () => {
    const two = (
      <form data-testid="f">
        {["A", "B"].map((g) => (
          <RadioGroup.Root key={g}>
            <RadioGroup.Label>{`Group ${g}`}</RadioGroup.Label>
            {SIZES.map((s) => (
              <RadioGroup.Item key={s.value} value={s.value}>
                <RadioGroup.ItemControl />
                <RadioGroup.ItemLabel>{`${s.label} ${g}`}</RadioGroup.ItemLabel>
              </RadioGroup.Item>
            ))}
          </RadioGroup.Root>
        ))}
      </form>
    )
    render(two)
    const names = new Set(hiddenInputs().map((i) => i.name))
    expect(names.size).toBe(2)
    await getRadioGroup(screen, { name: "Group A" }, { platform }).check("Medium A")
    await getRadioGroup(screen, { name: "Group B" }, { platform }).check("Large B")
    expect(await getRadioGroup(screen, { name: "Group A" }, { platform }).checked()).toBe(
      "Medium A",
    )
    expect(await getRadioGroup(screen, { name: "Group B" }, { platform }).checked()).toBe("Large B")
    // The browser's own radio grouping would have unchecked A's input.
    expect(hiddenInputs().filter((i) => i.checked)).toHaveLength(2)
    expect(formData().getAll(hiddenInputs()[0]?.name ?? "").length).toBe(1)
  })

  it.skipIf(inJsdom)(
    "an RTL hidden input does not overflow a narrow container (base-ui#5635)",
    async () => {
      render(
        <div
          data-testid="box"
          dir="rtl"
          style={{
            width: 200,
            height: 60,
            overflowX: "auto",
            overflowY: "hidden",
            position: "relative",
          }}
        >
          <Grp defaultValue="m" after={false} />
        </div>,
      )
      await frame()
      const box = screen.getByTestId("box")
      // The box is wide enough for the visible content in any font (Linux metrics differ) and
      // overflowY is hidden so a classic vertical scrollbar cannot narrow clientWidth: any
      // horizontal overflow left is the hidden input's.
      expect(box.scrollWidth).toBe(box.clientWidth)
    },
  )

  it("a programmatic change dispatches no native input or change", async () => {
    const ui = (value: string | null) => <Grp value={value} onValueChange={() => {}} />
    const seen: { type: string; target: EventTarget | null; checked: boolean }[] = []
    const { rerender } = render(ui(null))
    for (const t of ["input", "change"]) {
      formEl().addEventListener(t, (e) =>
        seen.push({ type: t, target: e.target, checked: (e.target as HTMLInputElement).checked }),
      )
    }
    // A programmatic change (the parent sets the value): no event.
    rerender(ui("l"))
    await frame()
    expect(hiddenInputs()[2]?.checked).toBe(true)
    expect(seen).toEqual([])
  })

  it("a user change dispatches input then change once, on the newly checked input", async () => {
    render(<Grp defaultValue="s" />)
    const seen: { type: string; target: EventTarget | null; checked: boolean }[] = []
    for (const t of ["input", "change"]) {
      formEl().addEventListener(t, (e) =>
        seen.push({ type: t, target: e.target, checked: (e.target as HTMLInputElement).checked }),
      )
    }
    await drv().check("Medium")
    expect(seen.map((s) => s.type)).toEqual(["input", "change"])
    expect(seen.every((s) => s.target === hiddenInputs()[1] && s.checked)).toBe(true)
  })
})

describe("Announcements", () => {
  it("arrowing records no announcement and renders no live region", async () => {
    const user = userEvent.setup()
    const log = installAnnouncementLog()
    render(<Grp defaultValue="s" />)
    const before = log.length
    act(() => ctrl("Small").focus())
    await user.keyboard("{ArrowDown}")
    expect(await drv().checked()).toBe("Medium")
    expect(log.length).toBe(before)
    expect(document.querySelector("[aria-live]")).toBeNull()
  })
})

describe("Data attributes", () => {
  it("data-focus-visible follows the arrows (zag#2629)", async () => {
    const user = userEvent.setup()
    render(<Grp defaultValue="s" />)
    act(() => screen.getByRole("button", { name: "Before" }).focus())
    await user.tab()
    expect(ctrl("Small").hasAttribute("data-focus-visible")).toBe(true)
    await user.keyboard("{ArrowDown}")
    expect(ctrl("Medium").hasAttribute("data-focus-visible")).toBe(true)
    expect(ctrl("Small").hasAttribute("data-focus-visible")).toBe(false)
    expect(ctrl("Medium").hasAttribute("data-highlighted")).toBe(true)
    expect(ctrl("Small").hasAttribute("data-highlighted")).toBe(false)
  })

  it("checked and disabled data-state on item, control and label", () => {
    render(
      <Grp
        defaultValue="m"
        items={[
          SIZES[0] as ItemSpec,
          SIZES[1] as ItemSpec,
          { ...(SIZES[2] as ItemSpec), disabled: true },
        ]}
      />,
    )
    const parts = (label: string) => {
      const control = ctrl(label)
      const item = control.closest('[data-part="item"]') as HTMLElement
      const text = screen.getByText(label)
      return [item, control, text]
    }
    for (const el of parts("Medium")) {
      expect(el.getAttribute("data-state"), el.getAttribute("data-part") ?? "").toBe("checked")
      expect(el.hasAttribute("data-disabled")).toBe(false)
    }
    for (const el of parts("Large")) {
      expect(el.getAttribute("data-state"), el.getAttribute("data-part") ?? "").toBe("unchecked")
      expect(el.hasAttribute("data-disabled"), el.getAttribute("data-part") ?? "").toBe(true)
    }
  })

  it("the indicator is aria-hidden and mounted only while checked", () => {
    render(<Grp defaultValue="m" />)
    const indicators = document.querySelectorAll('[data-part="item-indicator"]')
    expect(indicators).toHaveLength(1)
    expect(indicators[0]?.getAttribute("aria-hidden")).toBe("true")
    expect(ctrl("Medium").contains(indicators[0] as Node)).toBe(true)
  })

  it("root hooks: orientation, required, invalid, read-only, disabled", () => {
    render(<Grp required invalid readOnly disabled orientation="horizontal" />)
    const root = screen.getByRole("radiogroup")
    expect(root.getAttribute("data-scope")).toBe("radio-group")
    expect(root.getAttribute("data-orientation")).toBe("horizontal")
    for (const a of ["data-required", "data-invalid", "data-readonly", "data-disabled"]) {
      expect(root.hasAttribute(a), a).toBe(true)
    }
  })
})

describe("Field binding", () => {
  const fieldGroup = (
    field: Partial<Parameters<typeof Field.Root>[0]>,
    root: Partial<Parameters<typeof RadioGroup.Root>[0]> = {},
  ) => (
    <Field.Root {...field}>
      <Field.Label>Size</Field.Label>
      <RadioGroup.Root name="size" {...root}>
        {SIZES.map((s) => (
          <RadioGroup.Item key={s.value} value={s.value}>
            <RadioGroup.ItemControl />
            <RadioGroup.ItemLabel>{s.label}</RadioGroup.ItemLabel>
          </RadioGroup.Item>
        ))}
      </RadioGroup.Root>
      <Field.ErrorMessage>Pick one</Field.ErrorMessage>
    </Field.Root>
  )

  it("in a required Field displaying an error only the group registers (base-ui#4121)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    render(fieldGroup({ required: true, invalid: true }))
    expect(warn.mock.calls.filter((c) => /second control/.test(String(c[0])))).toEqual([])
    const root = screen.getByRole("radiogroup", { name: "Size" })
    expect(root.getAttribute("aria-invalid")).toBe("true")
    expect(root.getAttribute("aria-required")).toBe("true")
    const ids = screen.getAllByRole("radio").map((r) => r.id)
    expect(new Set(ids).size).toBe(3)
    expect(ids.every(Boolean)).toBe(true)
    const fieldIds = tokens(root, "aria-describedby")
    expect(fieldIds.length).toBeGreaterThan(0)
    const described = fieldIds.map((id) => document.getElementById(id)?.textContent).join(" ")
    expect(described).toContain("Pick one")
    for (const r of screen.getAllByRole("radio")) {
      for (const id of fieldIds) expect(tokens(r, "aria-describedby")).not.toContain(id)
    }
  })

  it("a read-only Field: ArrowDown moves focus without checking", async () => {
    const user = userEvent.setup()
    render(fieldGroup({ readOnly: true }, { defaultValue: "s" }))
    act(() => ctrl("Small").focus())
    await user.keyboard("{ArrowDown}")
    expect(focused()).toBe(ctrl("Medium"))
    expect(ctrl("Small").getAttribute("aria-checked")).toBe("true")
    expect(ctrl("Medium").getAttribute("aria-checked")).toBe("false")
  })

  it("a disabled Fieldset disables the group", async () => {
    render(
      <Fieldset.Root disabled>
        <Fieldset.Legend>Order</Fieldset.Legend>
        {fieldGroup({}, { defaultValue: "s" })}
      </Fieldset.Root>,
    )
    await waitFor(() => expect(hiddenInputs().every((i) => i.disabled)).toBe(true))
    expect(screen.getByRole("radiogroup").getAttribute("aria-disabled")).toBe("true")
  })
})

describe("review fixes (add-radio-group r1): external Field errors (base-ui#1745)", () => {
  function InField({ value, errors }: { value?: string | null; errors: readonly string[] }) {
    return (
      <form data-testid="ef">
        <Field.Root errors={errors}>
          <Field.Label>Size</Field.Label>
          <RadioGroup.Root {...(value === undefined ? {} : { value })} defaultValue="s">
            {["s", "m"].map((v) => (
              <RadioGroup.Item key={v} value={v}>
                <RadioGroup.ItemControl />
                <RadioGroup.ItemLabel>{v.toUpperCase()}</RadioGroup.ItemLabel>
              </RadioGroup.Item>
            ))}
          </RadioGroup.Root>
          <Field.ErrorMessage />
        </Field.Root>
      </form>
    )
  }

  it("survives a programmatic change", async () => {
    const { rerender } = render(<InField value="s" errors={["Taken"]} />)
    expect(screen.getByText("Taken")).toBeTruthy()
    rerender(<InField value="m" errors={["Taken"]} />)
    expect(screen.queryByText("Taken")).toBeTruthy()
    // A form reset clears the Field's external errors by the Field's own reset (field
    // "reset": a user's reset button clears everything); what the group reports for it is
    // not a user change, which the programmatic case above already exercises.
  })

  it("a user change clears it", async () => {
    render(<InField errors={["Taken"]} />)
    expect(screen.getByText("Taken")).toBeTruthy()
    await getRadioGroup(screen, { name: "Size" }, { platform }).check("M")
    await waitFor(() => expect(screen.queryByText("Taken")).toBeNull())
  })
})
