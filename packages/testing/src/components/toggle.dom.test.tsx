import { domEnvironment } from "@rind-ui/core"
import { Fieldset, ToggleGroup } from "@rind-ui/react"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { getToggle, installAnnouncementLog } from "../index"

const platform = domEnvironment().platform

describe("Toggle smoke", () => {
  it("toggles by every modality; aria-pressed explicit", async () => {
    const onPressedChange = vi.fn()
    render(<ToggleGroup.Item onPressedChange={onPressedChange}>Bold</ToggleGroup.Item>)
    const t = getToggle(screen, { name: "Bold" }, { platform })
    const el = screen.getByRole("button", { name: "Bold" })
    expect(el.getAttribute("aria-pressed")).toBe("false")
    expect(el.getAttribute("type")).toBe("button")
    await t.setPressed(true)
    expect(await t.isPressed()).toBe(true)
    expect(onPressedChange).toHaveBeenCalledTimes(1)
    await t.via("keyboard").setPressed(false)
    await t.via("keyboard").activateWithEnter(true)
    expect(el.getAttribute("data-state")).toBe("on")
  })

  it("warns when the name changes with the state", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    function Mute() {
      return (
        <ToggleGroup.Item
          render={(p, s) => <button {...p}>{s.pressed ? "Unmute" : "Mute"}</button>}
        />
      )
    }
    render(<Mute />)
    screen.getByRole("button", { name: "Mute" }).click()
    await vi.waitFor(() =>
      expect(warn.mock.calls.some(([m]) => /"Mute" → "Unmute"/.test(String(m)))).toBe(true),
    )
    warn.mockRestore()
  })
})

const driver = (name: string) => getToggle(screen, { name }, { platform })
const aria = (el: Element) => el.getAttribute("aria-pressed")

describe("substitution and composition", () => {
  it("disabled <span>: data-disabled, aria-disabled, role button, no disabled (base-ui#1084)", async () => {
    const onPressedChange = vi.fn()
    render(
      <ToggleGroup.Item render={<span />} disabled onPressedChange={onPressedChange}>
        Bold
      </ToggleGroup.Item>,
    )
    const el = screen.getByRole("button", { name: "Bold" })
    expect(el.tagName).toBe("SPAN")
    expect(el.hasAttribute("data-disabled")).toBe(true)
    expect(el.getAttribute("aria-disabled")).toBe("true")
    expect(el.getAttribute("role")).toBe("button")
    expect(el.hasAttribute("disabled")).toBe(false)
    await driver("Bold")
      .via("virtual")
      .setPressed(true)
      .catch(() => {})
    expect(onPressedChange).not.toHaveBeenCalled()
    expect(await driver("Bold").isDisabled()).toBe(true)
  })

  it("consumer onClick runs once and the Toggle toggles once (radix#1525)", async () => {
    const onClick = vi.fn()
    const onPressedChange = vi.fn()
    render(
      <ToggleGroup.Item onClick={onClick} onPressedChange={onPressedChange}>
        Bold
      </ToggleGroup.Item>,
    )
    await driver("Bold").setPressed(true)
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(onPressedChange).toHaveBeenCalledTimes(1)
  })

  it("an element that writes its own data-state keeps aria-pressed right (radix#602)", async () => {
    render(
      <ToggleGroup.Item render={<span data-state="open" />} defaultPressed>
        Bold
      </ToggleGroup.Item>,
    )
    const t = driver("Bold")
    expect(await t.isPressed()).toBe(true)
    await t.setPressed(false)
    expect(aria(screen.getByRole("button"))).toBe("false")
    expect(await t.isPressed()).toBe(false)
  })
})

describe("activation", () => {
  it("inside a form it does not submit", async () => {
    const onSubmit = vi.fn((e: Event) => e.preventDefault())
    render(
      <form onSubmit={(e) => onSubmit(e.nativeEvent)}>
        <ToggleGroup.Item>Bold</ToggleGroup.Item>
      </form>,
    )
    const t = driver("Bold")
    await t.setPressed(true)
    await t.via("keyboard").setPressed(false)
    await t.via("keyboard").activateWithEnter(true)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("held Space toggles once, on release", async () => {
    const onPressedChange = vi.fn()
    render(<ToggleGroup.Item onPressedChange={onPressedChange}>Bold</ToggleGroup.Item>)
    screen.getByRole("button").focus()
    await userEvent.keyboard("{ }")
    expect(onPressedChange).toHaveBeenCalledTimes(1)
    await userEvent.keyboard("{ >5}{/ }")
    expect(onPressedChange).toHaveBeenCalledTimes(2)
  })

  it("Enter and Space each toggle once (ark#2946)", async () => {
    const onPressedChange = vi.fn()
    render(<ToggleGroup.Item onPressedChange={onPressedChange}>Bold</ToggleGroup.Item>)
    screen.getByRole("button").focus()
    await userEvent.keyboard("{Enter}")
    expect(onPressedChange).toHaveBeenLastCalledWith(true, expect.anything())
    await userEvent.keyboard(" ")
    expect(onPressedChange).toHaveBeenLastCalledWith(false, expect.anything())
    expect(onPressedChange).toHaveBeenCalledTimes(2)
  })

  it("a bare click (detail 0) toggles once, as virtual", async () => {
    const onPressedChange = vi.fn()
    render(<ToggleGroup.Item onPressedChange={onPressedChange}>Bold</ToggleGroup.Item>)
    fireEvent.click(screen.getByRole("button"), { detail: 0 })
    expect(onPressedChange).toHaveBeenCalledTimes(1)
    expect(onPressedChange.mock.calls[0]?.[1].event).toMatchObject({
      type: "PRESS",
      modality: "virtual",
    })
  })

  it("programmatic focus does not toggle", () => {
    render(<ToggleGroup.Item>Bold</ToggleGroup.Item>)
    const el = screen.getByRole("button")
    act(() => el.focus())
    expect(aria(el)).toBe("false")
  })

  it("focusableWhenDisabled: Tab reaches it, aria-disabled, Space does not toggle (base-ui#5834)", async () => {
    const onPressedChange = vi.fn()
    render(
      <ToggleGroup.Item disabled focusableWhenDisabled onPressedChange={onPressedChange}>
        Bold
      </ToggleGroup.Item>,
    )
    const el = screen.getByRole("button")
    await userEvent.tab()
    expect(document.activeElement).toBe(el)
    expect(el.getAttribute("aria-disabled")).toBe("true")
    await userEvent.keyboard(" ")
    await userEvent.keyboard("{Enter}")
    expect(aria(el)).toBe("false")
    expect(onPressedChange).not.toHaveBeenCalled()
  })

  it("no announcement is recorded when toggling", async () => {
    const log = installAnnouncementLog()
    log.length = 0
    render(<ToggleGroup.Item>Bold</ToggleGroup.Item>)
    await driver("Bold").via("keyboard").setPressed(true)
    expect(log).toEqual([])
    expect(aria(screen.getByRole("button"))).toBe("true")
  })

  it("icon swap through Indicator keeps the name", async () => {
    render(
      <ToggleGroup.Item aria-label="Mute">
        <ToggleGroup.ItemIndicator fallback={<span data-testid="off">🔊</span>}>
          <span data-testid="on">🔇</span>
        </ToggleGroup.ItemIndicator>
      </ToggleGroup.Item>,
    )
    expect(screen.queryByTestId("off")).toBeTruthy()
    await driver("Mute").setPressed(true)
    expect(screen.queryByTestId("on")).toBeTruthy()
    expect(screen.queryByTestId("off")).toBeNull()
    expect(screen.getByRole("button", { name: "Mute" })).toBeTruthy()
  })

  it("a disabled fieldset disables it", async () => {
    const onPressedChange = vi.fn()
    render(
      <>
        <Fieldset.Root disabled>
          <Fieldset.Legend>Group</Fieldset.Legend>
          <ToggleGroup.Item onPressedChange={onPressedChange}>Rind</ToggleGroup.Item>
        </Fieldset.Root>
        <fieldset disabled>
          <ToggleGroup.Item onPressedChange={onPressedChange}>Native</ToggleGroup.Item>
        </fieldset>
      </>,
    )
    for (const name of ["Rind", "Native"]) {
      await vi.waitFor(async () => expect(await driver(name).isDisabled()).toBe(true))
      await userEvent.setup().click(screen.getByRole("button", { name }))
    }
    expect(onPressedChange).not.toHaveBeenCalled()
  })
})

describe("every action in every modality", () => {
  it.each(["pointer", "touch", "keyboard", "virtual"] as const)("setPressed via %s", async (m) => {
    render(<ToggleGroup.Item>Bold</ToggleGroup.Item>)
    const t = driver("Bold").via(m)
    await t.setPressed(true)
    expect(await t.isPressed()).toBe(true)
    await t.setPressed(true)
    expect(await t.isPressed()).toBe(true)
    await t.setPressed(false)
    expect(await t.isPressed()).toBe(false)
  })

  it("activateWithEnter", async () => {
    render(<ToggleGroup.Item>Bold</ToggleGroup.Item>)
    const t = driver("Bold").via("keyboard")
    await t.activateWithEnter(true)
    expect(await t.isPressed()).toBe(true)
    await t.activateWithEnter(false)
    expect(await t.isPressed()).toBe(false)
  })

  it("isDisabled", async () => {
    render(<ToggleGroup.Item disabled>Bold</ToggleGroup.Item>)
    expect(await driver("Bold").isDisabled()).toBe(true)
  })
})

describe("data-pressed", () => {
  it("only while the pointer is held; data-state stays on", async () => {
    render(<ToggleGroup.Item defaultPressed>Bold</ToggleGroup.Item>)
    const el = screen.getByRole("button")
    const user = userEvent.setup()
    expect(el.hasAttribute("data-pressed")).toBe(false)
    // At the element's centre: without coordinates the pointer is at 0,0, and the release
    // is hit-tested there (outside the button in WebKit's layout).
    const r = el.getBoundingClientRect()
    const coords = { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }
    await user.pointer({ keys: "[MouseLeft>]", target: el, coords })
    expect(el.hasAttribute("data-pressed")).toBe(true)
    expect(el.getAttribute("data-state")).toBe("on")
    await user.pointer({ keys: "[/MouseLeft]", target: el, coords })
    expect(el.hasAttribute("data-pressed")).toBe(false)
    expect(el.getAttribute("data-state")).toBe("off")
  })
})
