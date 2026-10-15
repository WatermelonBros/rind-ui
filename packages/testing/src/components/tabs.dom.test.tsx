// Tabs driver and React tests (tasks 4.2, 5.3): every spec scenario through the driver,
// in jsdom and in real browsers.
import { domEnvironment } from "@rind-ui/core"
import { RindProvider, Tabs } from "@rind-ui/react"
import { act, render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { type ReactNode, useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { getTabs, installAnnouncementLog } from "../index"

const platform = domEnvironment().platform
afterEach(() => vi.restoreAllMocks())

type TabSpec = { value: string; label: string; disabled?: boolean }
const THREE: TabSpec[] = [
  { value: "general", label: "General" },
  { value: "billing", label: "Billing" },
  { value: "team", label: "Team" },
]
const at = (i: number): TabSpec => THREE[i] ?? { value: "", label: "" }
const FOUR: TabSpec[] = [
  { value: "a", label: "A" },
  { value: "b", label: "B" },
  { value: "c", label: "C" },
  { value: "d", label: "D" },
]

type RootProps = Parameters<typeof Tabs.Root>[0]

function Settings({
  items = THREE,
  label = "Settings",
  panelContent,
  ...root
}: Partial<RootProps> & {
  items?: TabSpec[]
  label?: string | null
  panelContent?: (t: TabSpec) => ReactNode
}) {
  return (
    <>
      <button type="button">Before</button>
      <Tabs.Root {...root}>
        <Tabs.List {...(label === null ? {} : { "aria-label": label })}>
          {items.map((t) => (
            <Tabs.Tab key={t.value} value={t.value} disabled={t.disabled === true}>
              {t.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>
        {items.map((t) => (
          <Tabs.Panel key={t.value} value={t.value}>
            {panelContent ? panelContent(t) : `${t.label} panel`}
          </Tabs.Panel>
        ))}
      </Tabs.Root>
      <button type="button">After</button>
    </>
  )
}

const drv = (name = "Settings") => getTabs(screen, { name }, { platform })
const tab = (name: string) => screen.getByRole("tab", { name })
const focused = () => document.activeElement
const panels = () => [...document.querySelectorAll<HTMLElement>('[role="tabpanel"]')]
const visiblePanel = () => panels().find((p) => !p.hasAttribute("hidden"))

describe("Default selection", () => {
  it("selects the first enabled tab and reports it once with reason INITIAL", async () => {
    const onValueChange = vi.fn()
    render(
      <Settings
        items={[{ ...at(0), disabled: true }, ...THREE.slice(1)]}
        onValueChange={onValueChange}
      />,
    )
    expect(await drv().selected()).toBe("Billing")
    expect(await drv().tabs()).toEqual(["General", "Billing", "Team"])
    expect(await drv().panel()).toEqual({ name: "Billing", text: "Billing panel" })
    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(onValueChange.mock.calls[0]?.[0]).toBe("billing")
    expect(onValueChange.mock.calls[0]?.[1].reason).toBe("INITIAL")
  })

  it("defaultValue selects without a callback", async () => {
    const onValueChange = vi.fn()
    render(<Settings defaultValue="team" onValueChange={onValueChange} />)
    expect(await drv().selected()).toBe("Team")
    expect(tab("Team").tabIndex).toBe(0)
    expect(tab("General").tabIndex).toBe(-1)
    expect(onValueChange).not.toHaveBeenCalled()
  })

  it("controlled null: nothing selected, no panel, no callback", async () => {
    const onValueChange = vi.fn()
    render(<Settings value={null} onValueChange={onValueChange} />)
    expect(await drv().selected()).toBeNull()
    expect(await drv().panel()).toBeNull()
    expect(visiblePanel()).toBeUndefined()
    for (const t of screen.getAllByRole("tab"))
      expect(t.getAttribute("aria-selected")).toBe("false")
    expect(onValueChange).not.toHaveBeenCalled()
  })

  it("the selected tab removed: the next tab is selected", async () => {
    const { rerender } = render(<Settings defaultValue="billing" />)
    rerender(<Settings defaultValue="billing" items={[at(0), at(2)]} />)
    expect(await drv().selected()).toBe("Team")
    expect(visiblePanel()?.textContent).toBe("Team panel")
  })
})

describe("Dynamic tabs", () => {
  it("a tab inserted before the selected one keeps the selection (headlessui#1834)", async () => {
    const { rerender } = render(<Settings defaultValue="billing" />)
    rerender(<Settings defaultValue="billing" items={[{ value: "new", label: "New" }, ...THREE]} />)
    expect(await drv().tabs()).toEqual(["New", "General", "Billing", "Team"])
    expect(await drv().selected()).toBe("Billing")
    expect(visiblePanel()?.textContent).toBe("Billing panel")
  })

  it("reordering keeps the selection and the tab stop (headlessui#2131)", async () => {
    const { rerender } = render(<Settings defaultValue="billing" />)
    rerender(<Settings defaultValue="billing" items={[at(2), at(1), at(0)]} />)
    expect(await drv().tabs()).toEqual(["Team", "Billing", "General"])
    expect(await drv().selected()).toBe("Billing")
    expect(["Team", "Billing", "General"].map((n) => tab(n).tabIndex)).toEqual([-1, 0, -1])
    // Arrows follow the new order.
    act(() => tab("Billing").focus())
    await userEvent.setup().keyboard("{ArrowRight}")
    expect(await drv().selected()).toBe("General")
  })

  it("a nested Tabs: End stays in the outer list (bits-ui#2189)", async () => {
    const user = userEvent.setup()
    render(
      <Tabs.Root defaultValue="o1">
        <Tabs.List aria-label="Outer">
          {["o1", "o2", "o3"].map((v) => (
            <Tabs.Tab key={v} value={v}>
              {v}
            </Tabs.Tab>
          ))}
        </Tabs.List>
        <Tabs.Panel value="o1">
          <Tabs.Root defaultValue="i1">
            <Tabs.List aria-label="Inner">
              {["i1", "i2"].map((v) => (
                <Tabs.Tab key={v} value={v}>
                  {v}
                </Tabs.Tab>
              ))}
            </Tabs.List>
            <Tabs.Panel value="i1">inner 1</Tabs.Panel>
            <Tabs.Panel value="i2">inner 2</Tabs.Panel>
          </Tabs.Root>
        </Tabs.Panel>
        <Tabs.Panel value="o2">two</Tabs.Panel>
        <Tabs.Panel value="o3">three</Tabs.Panel>
      </Tabs.Root>,
    )
    act(() => tab("o1").focus())
    await user.keyboard("{End}")
    expect(focused()).toBe(tab("o3"))
    expect(tab("o3").getAttribute("aria-selected")).toBe("true")
  })

  it("a nested Tabs: arrows in the inner list do not move the outer one", async () => {
    const user = userEvent.setup()
    render(
      <Tabs.Root defaultValue="o1">
        <Tabs.List aria-label="Outer">
          {["o1", "o2"].map((v) => (
            <Tabs.Tab key={v} value={v}>
              {v}
            </Tabs.Tab>
          ))}
        </Tabs.List>
        <Tabs.Panel value="o1">
          <Tabs.Root defaultValue="i1">
            <Tabs.List aria-label="Inner">
              {["i1", "i2"].map((v) => (
                <Tabs.Tab key={v} value={v}>
                  {v}
                </Tabs.Tab>
              ))}
            </Tabs.List>
            <Tabs.Panel value="i1">inner 1</Tabs.Panel>
            <Tabs.Panel value="i2">inner 2</Tabs.Panel>
          </Tabs.Root>
        </Tabs.Panel>
        <Tabs.Panel value="o2">two</Tabs.Panel>
      </Tabs.Root>,
    )
    act(() => tab("i1").focus())
    await user.keyboard("{ArrowRight}")
    expect(focused()).toBe(tab("i2"))
    expect(tab("o1").getAttribute("aria-selected")).toBe("true")
    expect(tab("o2").getAttribute("aria-selected")).toBe("false")
  })
})

describe("Anatomy", () => {
  it("a tab rendered as a span keeps role and behaviour", async () => {
    const user = userEvent.setup()
    render(
      <Tabs.Root>
        <Tabs.List aria-label="Settings">
          {THREE.map((t) => (
            <Tabs.Tab key={t.value} value={t.value} render={<span />}>
              {t.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>
        {THREE.map((t) => (
          <Tabs.Panel key={t.value} value={t.value}>
            {t.label} panel
          </Tabs.Panel>
        ))}
      </Tabs.Root>,
    )
    const billing = tab("Billing")
    expect(billing.tagName).toBe("SPAN")
    expect(billing.getAttribute("role")).toBe("tab")
    expect(tab("General").getAttribute("aria-selected")).toBe("true")
    act(() => tab("General").focus())
    await user.keyboard("{ArrowRight}")
    expect(focused()).toBe(billing)
    expect(billing.getAttribute("aria-selected")).toBe("true")
    expect(await drv().selected()).toBe("Billing")
  })

  it("the list is a named tablist; roles and links are wired", () => {
    render(<Settings defaultValue="billing" />)
    const list = screen.getByRole("tablist", { name: "Settings" })
    expect(list.hasAttribute("aria-orientation")).toBe(false)
    const billing = tab("Billing")
    const panel = visiblePanel()
    expect(billing.getAttribute("aria-controls")).toBe(panel?.id)
    expect(panel?.getAttribute("aria-labelledby")).toBe(billing.id)
  })

  it("vertical sets aria-orientation", () => {
    render(<Settings orientation="vertical" />)
    expect(screen.getByRole("tablist").getAttribute("aria-orientation")).toBe("vertical")
  })

  it("an unnamed list warns in development", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    render(<Settings label={null} />)
    expect(
      warn.mock.calls.some((c) => /tabs: the list .*no accessible name/.test(String(c[0]))),
    ).toBe(true)
  })

  it("a named list does not warn", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    render(<Settings />)
    expect(warn.mock.calls.filter((c) => /tabs/.test(String(c[0])))).toEqual([])
  })
})

describe("Keyboard and activation", () => {
  it("automatic: an arrow moves focus and selects", async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(<Settings onValueChange={onValueChange} />)
    act(() => tab("General").focus())
    await user.keyboard("{ArrowRight}")
    expect(focused()).toBe(tab("Billing"))
    expect(await drv().selected()).toBe("Billing")
    expect(visiblePanel()?.textContent).toBe("Billing panel")
    expect(onValueChange.mock.calls.at(-1)?.[0]).toBe("billing")
  })

  it("manual: an arrow only moves; Enter selects", async () => {
    const user = userEvent.setup()
    render(<Settings activationMode="manual" />)
    act(() => tab("General").focus())
    await user.keyboard("{ArrowRight}")
    expect(focused()).toBe(tab("Billing"))
    expect(await drv().selected()).toBe("General")
    expect(visiblePanel()?.textContent).toBe("General panel")
    await user.keyboard("{Enter}")
    expect(await drv().selected()).toBe("Billing")
  })

  it("manual: Space selects", async () => {
    const user = userEvent.setup()
    render(<Settings activationMode="manual" />)
    act(() => tab("General").focus())
    await user.keyboard("{ArrowRight} ")
    expect(await drv().selected()).toBe("Billing")
  })

  it("Home and End move to (and select) the first and last tab", async () => {
    const user = userEvent.setup()
    render(<Settings items={FOUR} defaultValue="b" />)
    act(() => tab("B").focus())
    await user.keyboard("{End}")
    expect(focused()).toBe(tab("D"))
    expect(await drv().selected()).toBe("D")
    await user.keyboard("{Home}")
    expect(focused()).toBe(tab("A"))
    expect(await drv().selected()).toBe("A")
  })

  it("wraps at both ends by default and stops with loop=false", async () => {
    const user = userEvent.setup()
    const { unmount } = render(<Settings defaultValue="team" />)
    act(() => tab("Team").focus())
    await user.keyboard("{ArrowRight}")
    expect(focused()).toBe(tab("General"))
    unmount()
    render(<Settings defaultValue="team" loop={false} />)
    act(() => tab("Team").focus())
    await user.keyboard("{ArrowRight}")
    expect(focused()).toBe(tab("Team"))
  })

  it("RTL: ArrowLeft moves to the next tab", async () => {
    const user = userEvent.setup()
    render(
      <RindProvider dir="rtl">
        <Settings />
      </RindProvider>,
    )
    act(() => tab("General").focus())
    await user.keyboard("{ArrowLeft}")
    expect(focused()).toBe(tab("Billing"))
    expect(await drv().selected()).toBe("Billing")
    await user.keyboard("{ArrowRight}")
    expect(focused()).toBe(tab("General"))
  })

  it("vertical: ArrowRight and ArrowDown both move to the next tab", async () => {
    const user = userEvent.setup()
    render(<Settings orientation="vertical" />)
    act(() => tab("General").focus())
    await user.keyboard("{ArrowRight}")
    expect(focused()).toBe(tab("Billing"))
    await user.keyboard("{ArrowDown}")
    expect(focused()).toBe(tab("Team"))
    await user.keyboard("{ArrowUp}{ArrowLeft}")
    expect(focused()).toBe(tab("General"))
  })

  it("horizontal: ArrowDown does nothing and is not prevented", () => {
    render(<Settings />)
    act(() => tab("General").focus())
    const down = new KeyboardEvent("keydown", {
      key: "ArrowDown",
      code: "ArrowDown",
      bubbles: true,
      cancelable: true,
    })
    act(() => {
      tab("General").dispatchEvent(down)
    })
    expect(down.defaultPrevented).toBe(false)
    expect(focused()).toBe(tab("General"))
  })

  it("Alt+Arrow and Control+Arrow are ignored", async () => {
    const user = userEvent.setup()
    render(<Settings />)
    act(() => tab("General").focus())
    await user.keyboard("{Alt>}{ArrowRight}{/Alt}")
    await user.keyboard("{Control>}{ArrowRight}{/Control}")
    expect(focused()).toBe(tab("General"))
    expect(await drv().selected()).toBe("General")
  })

  it("Space typed in an input inside a tab does not select it in manual mode (radix#2915)", async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(
      <Tabs.Root activationMode="manual" defaultValue="a" onValueChange={onValueChange}>
        <Tabs.List aria-label="Settings">
          <Tabs.Tab value="a">A</Tabs.Tab>
          <Tabs.Tab value="b" render={<div />}>
            <input aria-label="Rename" />
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="a">a</Tabs.Panel>
        <Tabs.Panel value="b">b</Tabs.Panel>
      </Tabs.Root>,
    )
    const input = screen.getByRole("textbox", { name: "Rename" })
    act(() => input.focus())
    await user.keyboard("x y")
    expect((input as HTMLInputElement).value).toBe("x y")
    expect(onValueChange).not.toHaveBeenCalled()
    expect(tab("A").getAttribute("aria-selected")).toBe("true")
  })

  it("programmatic focus never selects", async () => {
    const onValueChange = vi.fn()
    render(<Settings onValueChange={onValueChange} />)
    onValueChange.mockClear()
    act(() => tab("Team").focus())
    expect(await drv().selected()).toBe("General")
    expect(onValueChange).not.toHaveBeenCalled()
  })
})

describe("Driver in every modality", () => {
  it("select works in pointer, touch and keyboard (automatic)", async () => {
    for (const modality of ["pointer", "touch", "keyboard"] as const) {
      const { unmount } = render(<Settings />)
      const g = drv().via(modality)
      await g.select("Team")
      expect(await g.selected(), modality).toBe("Team")
      expect(await g.panel(), modality).toEqual({ name: "Team", text: "Team panel" })
      await g.select("Billing")
      expect(await g.selected(), modality).toBe("Billing")
      unmount()
    }
  })

  it("select in manual mode: keyboard arrows then Enter; pointer presses", async () => {
    for (const modality of ["pointer", "touch", "keyboard"] as const) {
      const { unmount } = render(<Settings activationMode="manual" />)
      const g = drv().via(modality)
      await g.select("Team")
      expect(await g.selected(), modality).toBe("Team")
      unmount()
    }
  })

  it("a virtual click selects; virtual focus does not", async () => {
    const onValueChange = vi.fn()
    render(<Settings onValueChange={onValueChange} />)
    onValueChange.mockClear()
    const g = drv().via("virtual")
    await g.select("Billing")
    expect(await g.selected()).toBe("Billing")
    onValueChange.mockClear()
    act(() => tab("Team").focus())
    expect(await g.selected()).toBe("Billing")
    expect(onValueChange).not.toHaveBeenCalled()
  })

  it("focusTab (keyboard) moves focus; focusedTab reports it", async () => {
    render(<Settings activationMode="manual" />)
    const g = drv().via("keyboard")
    await g.focusTab("Team")
    expect(await g.focusedTab()).toBe("Team")
    expect(await g.selected()).toBe("General")
  })

  it("RTL, vertical: the driver's keyboard select still reaches the tab", async () => {
    const { unmount } = render(
      <RindProvider dir="rtl">
        <Settings activationMode="manual" />
      </RindProvider>,
    )
    await drv().via("keyboard").select("Team")
    expect(await drv().selected()).toBe("Team")
    unmount()
    render(<Settings orientation="vertical" activationMode="manual" />)
    await drv().via("keyboard").select("Team")
    expect(await drv().selected()).toBe("Team")
  })
})

describe("Disabled tabs", () => {
  const withDisabled: TabSpec[] = [
    { value: "a", label: "A" },
    { value: "b", label: "B", disabled: true },
    { value: "c", label: "C", disabled: true },
    { value: "d", label: "D" },
  ]

  it("a disabled run is skipped by arrows and never selected", async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(<Settings items={withDisabled} onValueChange={onValueChange} />)
    act(() => tab("A").focus())
    await user.keyboard("{ArrowRight}")
    expect(focused()).toBe(tab("D"))
    expect(await drv().selected()).toBe("D")
    await user.click(tab("B"))
    expect(await drv().selected()).toBe("D")
    expect(await drv().isDisabled("B")).toBe(true)
    expect(await drv().isDisabled("A")).toBe(false)
    expect(tab("B").getAttribute("aria-disabled")).toBe("true")
    expect(tab("B").hasAttribute("data-disabled")).toBe(true)
  })

  it("a keyboard select of a disabled tab completes without selecting it", async () => {
    render(<Settings items={withDisabled} activationMode="manual" />)
    await drv().via("keyboard").select("B")
    expect(await drv().selected()).toBe("A")
    expect(await drv().isDisabled("B")).toBe(true)
  })

  it("focusableWhenDisabled: reachable by arrows, never selected", async () => {
    const user = userEvent.setup()
    render(<Settings items={withDisabled} focusableWhenDisabled activationMode="manual" />)
    act(() => tab("A").focus())
    await user.keyboard("{ArrowRight}")
    expect(focused()).toBe(tab("B"))
    expect(tab("B").getAttribute("aria-disabled")).toBe("true")
    await user.keyboard("{Enter} ")
    expect(await drv().selected()).toBe("A")
    expect(visiblePanel()?.textContent).toBe("A panel")
  })

  it("focusableWhenDisabled in automatic mode: focus on a disabled tab keeps the old selection", async () => {
    const user = userEvent.setup()
    render(<Settings items={withDisabled} focusableWhenDisabled />)
    act(() => tab("A").focus())
    await user.keyboard("{ArrowRight}")
    expect(focused()).toBe(tab("B"))
    expect(await drv().selected()).toBe("A")
  })

  it("every tab disabled: the list is the tab stop and nothing hangs", async () => {
    const all = FOUR.map((t) => ({ ...t, disabled: true }))
    const user = userEvent.setup()
    render(<Settings items={all} />)
    const list = screen.getByRole("tablist")
    expect(list.tabIndex).toBe(0)
    for (const t of screen.getAllByRole("tab")) expect(t.tabIndex).toBe(-1)
    expect(await drv().selected()).toBeNull()
    expect(visiblePanel()).toBeUndefined()
    act(() => tab("A").focus?.())
    act(() => list.focus())
    await user.keyboard("{ArrowRight}{End}")
    expect(await drv().selected()).toBeNull()
    await drv().via("keyboard").select("A")
    expect(await drv().isDisabled("A")).toBe(true)
  })

  it("a disabled list: every tab inert, no selection change", async () => {
    const onValueChange = vi.fn()
    render(<Settings disabled defaultValue="general" onValueChange={onValueChange} />)
    await userEvent.setup().click(tab("Team"))
    expect(await drv().selected()).toBe("General")
    expect(onValueChange).not.toHaveBeenCalled()
  })
})

describe("Tab stop", () => {
  it("exactly one tab is a Tab stop and it is the selected tab", async () => {
    const user = userEvent.setup()
    render(<Settings defaultValue="billing" />)
    expect(["General", "Billing", "Team"].map((n) => tab(n).tabIndex)).toEqual([-1, 0, -1])
    expect(screen.getByRole("tablist").hasAttribute("tabindex")).toBe(false)
    act(() => screen.getByRole("button", { name: "Before" }).focus())
    await user.tab()
    expect(focused()).toBe(tab("Billing"))
  })

  it("Tab from the tab goes to the selected panel (a stop when text only)", async () => {
    const user = userEvent.setup()
    render(<Settings />)
    act(() => tab("General").focus())
    await user.tab()
    expect(focused()).toBe(visiblePanel())
  })

  it("focus leaving the list returns the stop to the selected tab", async () => {
    const user = userEvent.setup()
    render(<Settings activationMode="manual" />)
    act(() => tab("General").focus())
    await user.keyboard("{ArrowRight}")
    expect(tab("Billing").tabIndex).toBe(0)
    act(() => screen.getByRole("button", { name: "After" }).focus())
    expect(["General", "Billing", "Team"].map((n) => tab(n).tabIndex)).toEqual([0, -1, -1])
    expect(document.querySelector("[data-highlighted]")).toBeNull()
  })
})

describe("Panels", () => {
  it("unmount (default): only the selected panel exists, only its tab has aria-controls", async () => {
    render(<Settings defaultValue="billing" />)
    expect(panels()).toHaveLength(1)
    expect(panels()[0]?.textContent).toBe("Billing panel")
    expect(screen.getAllByRole("tab").map((t) => t.hasAttribute("aria-controls"))).toEqual([
      false,
      true,
      false,
    ])
    await drv().select("Team")
    expect(panels()).toHaveLength(1)
    expect(panels()[0]?.textContent).toBe("Team panel")
    expect(screen.getAllByRole("tab").map((t) => t.hasAttribute("aria-controls"))).toEqual([
      false,
      false,
      true,
    ])
  })

  it("hidden: every panel stays mounted, the others carry hidden", () => {
    render(<Settings defaultValue="billing" inactivePanels="hidden" />)
    expect(panels()).toHaveLength(3)
    expect(panels().map((p) => p.hasAttribute("hidden"))).toEqual([true, false, true])
    for (const t of screen.getAllByRole("tab")) {
      const id = t.getAttribute("aria-controls")
      expect(id && document.getElementById(id)).toBeTruthy()
    }
    // Hidden panels are out of the accessibility tree.
    expect(screen.getAllByRole("tabpanel")).toHaveLength(1)
  })

  it("until-found: panels stay mounted and only the selected is shown", () => {
    render(<Settings defaultValue="billing" inactivePanels="until-found" />)
    expect(panels()).toHaveLength(3)
    expect(visiblePanel()?.textContent).toBe("Billing panel")
  })

  it("panel tabindex: 0 for text only, none when it holds a button", () => {
    const { unmount } = render(<Settings />)
    expect(visiblePanel()?.getAttribute("tabindex")).toBe("0")
    unmount()
    render(<Settings panelContent={() => <button type="button">Save</button>} />)
    expect(visiblePanel()?.hasAttribute("tabindex")).toBe(false)
  })

  it("panel tabindex follows live content changes (ariakit#6332)", async () => {
    function Live() {
      const [form, setForm] = useState(false)
      return (
        <>
          <button type="button" onClick={() => setForm((f) => !f)}>
            Toggle form
          </button>
          <Settings panelContent={() => (form ? <input aria-label="Name" /> : "Text only")} />
        </>
      )
    }
    render(<Live />)
    const toggle = screen.getByRole("button", { name: "Toggle form" })
    expect(visiblePanel()?.getAttribute("tabindex")).toBe("0")
    await act(async () => toggle.click())
    await vi.waitFor(() => expect(visiblePanel()?.hasAttribute("tabindex")).toBe(false))
    await act(async () => toggle.click())
    await vi.waitFor(() => expect(visiblePanel()?.getAttribute("tabindex")).toBe("0"))
  })

  it("a blur in the old panel fires before the switch (radix#3600)", async () => {
    const seen: { panel: string | undefined; selected: string | null }[] = []
    render(
      <Tabs.Root defaultValue="a">
        <Tabs.List aria-label="Settings">
          <Tabs.Tab value="a">A</Tabs.Tab>
          <Tabs.Tab value="b">B</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="a">
          <input
            aria-label="Field"
            onBlur={() =>
              seen.push({
                panel: visiblePanel()?.getAttribute("data-key") ?? undefined,
                selected:
                  document
                    .querySelector('[role="tab"][aria-selected="true"]')
                    ?.getAttribute("data-key") ?? null,
              })
            }
          />
        </Tabs.Panel>
        <Tabs.Panel value="b">b</Tabs.Panel>
      </Tabs.Root>,
    )
    act(() => screen.getByRole("textbox", { name: "Field" }).focus())
    await drv().select("B")
    expect(seen).toEqual([{ panel: "a", selected: "a" }])
    expect(await drv().selected()).toBe("B")
  })
})

describe("Data attributes", () => {
  it("selected tab and panel, activation direction on root and list", async () => {
    render(<Settings defaultValue="general" />)
    const list = screen.getByRole("tablist")
    expect(tab("General").getAttribute("data-selected")).toBe("")
    expect(tab("Billing").hasAttribute("data-selected")).toBe(false)
    expect(visiblePanel()?.getAttribute("data-selected")).toBe("")
    expect(list.getAttribute("data-activation-direction")).toBe("none")
    await drv().select("Team")
    expect(list.getAttribute("data-activation-direction")).toBe("next")
    expect(
      list
        .closest('[data-scope="tabs"][data-part="root"]')
        ?.getAttribute("data-activation-direction"),
    ).toBe("next")
    await drv().select("Billing")
    expect(list.getAttribute("data-activation-direction")).toBe("previous")
  })
})

describe("Announcements", () => {
  it("selecting records no announcement and renders no live region", async () => {
    const log = installAnnouncementLog()
    render(<Settings />)
    const before = log.length
    await drv().select("Team")
    expect(log.length).toBe(before)
    expect(document.querySelector("[aria-live]")).toBeNull()
  })
})
