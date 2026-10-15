import { domEnvironment } from "@rind-ui/core"
import { Button, Fieldset, Portal, RindProvider, RouterProvider } from "@rind-ui/react"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fakeRouter, getButton, interceptNativeNavigation, navigationLog } from "../index"

const platform = domEnvironment().platform
const driver = (name: string, role?: "link") =>
  getButton(screen, role ? { name, role } : { name }, { platform })

beforeEach(() => {
  interceptNativeNavigation(window)
  navigationLog().length = 0
})
afterEach(() => vi.restoreAllMocks())

describe("Button smoke", () => {
  it("presses once per input; pending ignores; submit swaps to button while pending", async () => {
    const onPress = vi.fn()
    const onSubmit = vi.fn((e: Event) => e.preventDefault())
    const { rerender } = render(
      <form onSubmit={(e) => onSubmit(e.nativeEvent)}>
        <Button type="submit" onPress={onPress}>
          Save
        </Button>
      </form>,
    )
    const b = getButton(screen, { name: "Save" }, { platform })
    await b.press()
    await b.via("keyboard").press()
    await b.via("keyboard").pressWithSpace()
    await b.via("virtual").press()
    expect(onPress.mock.calls.map((c) => c[0].modality)).toEqual([
      "pointer",
      "keyboard",
      "keyboard",
      "virtual",
    ])
    expect(onSubmit).toHaveBeenCalledTimes(4)
    rerender(
      <form onSubmit={(e) => onSubmit(e.nativeEvent)}>
        <Button type="submit" pending onPress={onPress}>
          Save
        </Button>
      </form>,
    )
    const el = screen.getByRole("button")
    expect(el.getAttribute("type")).toBe("button")
    expect(el.getAttribute("aria-disabled")).toBe("true")
    expect(el.hasAttribute("disabled")).toBe(false)
    expect(await b.isPending()).toBe(true)
    await b.press()
    await b.via("keyboard").press()
    expect(onPress).toHaveBeenCalledTimes(4)
    expect(onSubmit).toHaveBeenCalledTimes(4)
  })

  it("div and anchor substitution", async () => {
    const onPress = vi.fn()
    const router = fakeRouter()
    render(
      <RouterProvider navigate={router.navigate}>
        <Button render={<div />} onPress={onPress}>
          Div
        </Button>
        <Button render={<a href="/docs" />} onPress={onPress}>
          Docs
        </Button>
      </RouterProvider>,
    )
    const div = screen.getByRole("button", { name: "Div" })
    expect(div.getAttribute("role")).toBe("button")
    expect(div.getAttribute("tabindex")).toBe("0")
    const d = getButton(screen, { name: "Div" }, { platform })
    await d.press()
    await d.via("keyboard").press()
    await d.via("keyboard").pressWithSpace()
    await d.via("virtual").press()
    expect(onPress).toHaveBeenCalledTimes(4)
    const link = screen.getByRole("link", { name: "Docs" })
    expect(link.hasAttribute("role")).toBe(false)
    expect(link.hasAttribute("type")).toBe(false)
    const l = getButton(screen, { name: "Docs", role: "link" }, { platform })
    await l.press()
    expect(router.calls.map((c) => c.href)).toEqual(["/docs"])
    expect(onPress).toHaveBeenCalledTimes(5)
  })
})

// 1.4: substitution matrix. Every input on every element in every state: one activation, or
// none, as specified. A link takes Enter but not Space (link-navigation).
describe("substitution matrix", () => {
  type Input = "pointer" | "Enter" | "Space" | "touch" | "bare click"
  const inputs: Input[] = ["pointer", "Enter", "Space", "touch", "bare click"]
  const states = ["enabled", "disabled", "focusableWhenDisabled"] as const
  const elements = {
    button: { render: undefined, role: undefined, space: 1 },
    // biome-ignore lint/a11y/useAnchorContent: Button supplies the content
    "a[href]": { render: <a href="/docs" />, role: "link" as const, space: 0 },
    div: { render: <div />, role: undefined, space: 1 },
  }

  async function fire(name: string, role: "link" | undefined, input: Input) {
    const b = driver(name, role)
    if (input === "pointer") await b.press()
    else if (input === "touch") await b.via("touch").press()
    else if (input === "bare click") await b.via("virtual").press()
    else if (input === "Enter") await b.via("keyboard").press()
    else await b.via("keyboard").pressWithSpace()
  }

  for (const [elName, el] of Object.entries(elements)) {
    for (const state of states) {
      for (const input of inputs) {
        it(`${elName} ${state}: ${input}`, async () => {
          const router = fakeRouter()
          const onPress = vi.fn()
          render(
            <RouterProvider navigate={router.navigate}>
              <Button
                {...(el.render ? { render: el.render } : {})}
                disabled={state !== "enabled"}
                focusableWhenDisabled={state === "focusableWhenDisabled"}
                onPress={onPress}
              >
                Go
              </Button>
            </RouterProvider>,
          )
          // A disabled link keeps role link; every disabled non-link keeps role button.
          await fire("Go", el.role, input)
          const expected = state !== "enabled" ? 0 : input === "Space" ? el.space : 1
          expect(onPress).toHaveBeenCalledTimes(expected)
          // A link also routes exactly as often as it activates.
          if (el.role === "link") expect(router.calls).toHaveLength(expected)
        })
      }
    }
  }
})

describe("Tab order", () => {
  it("native disabled and disabled non-native are skipped; focusableWhenDisabled stays", async () => {
    render(
      <>
        <Button>Start</Button>
        <Button disabled>Native off</Button>
        <Button disabled render={<div />}>
          Div off
        </Button>
        <Button disabled render={<a href="/a" />}>
          Link off
        </Button>
        <Button disabled focusableWhenDisabled>
          Native focusable
        </Button>
        <Button disabled focusableWhenDisabled render={<div />}>
          Div focusable
        </Button>
        <Button disabled focusableWhenDisabled render={<a href="/a" />}>
          Link focusable
        </Button>
        <Button>End</Button>
      </>,
    )
    const user = userEvent.setup()
    const visited: (string | null)[] = []
    for (let i = 0; i < 6; i++) {
      await user.tab()
      visited.push(document.activeElement?.textContent ?? null)
    }
    expect(visited).toEqual([
      "Start",
      "Native focusable",
      "Div focusable",
      "Link focusable",
      "End",
      // wraps around out of the document to the first
      visited[5] ?? null,
    ])
    await user.tab({ shift: true })
    expect(document.activeElement?.textContent).toBe("End")
    await user.tab({ shift: true })
    expect(document.activeElement?.textContent).toBe("Link focusable")
  })
})

describe("regressions", () => {
  it("no type inside a form does not submit (radix#3468, reka-ui#3007)", async () => {
    const onSubmit = vi.fn((e: Event) => e.preventDefault())
    render(
      <form onSubmit={(e) => onSubmit(e.nativeEvent)}>
        <Button>Plain</Button>
      </form>,
    )
    expect(screen.getByRole("button").getAttribute("type")).toBe("button")
    const b = driver("Plain")
    await b.press()
    await b.via("keyboard").press()
    await b.via("keyboard").pressWithSpace()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("no type on a div or an anchor (headlessui#619)", () => {
    render(
      <>
        <Button render={<div />} type="submit">
          Div
        </Button>
        <Button render={<a href="/a" />} type="submit">
          Link
        </Button>
        <Button render={<a href="/a" />} disabled>
          Off
        </Button>
      </>,
    )
    for (const el of [
      screen.getByRole("button", { name: "Div" }),
      screen.getByRole("link", { name: "Link" }),
      screen.getByRole("link", { name: "Off" }),
    ]) {
      expect(el.hasAttribute("type")).toBe(false)
    }
  })

  it("a Button as a link keeps its role; Enter activates, Space does not (base-ui#4021)", async () => {
    const onPress = vi.fn()
    const router = fakeRouter()
    render(
      <RouterProvider navigate={router.navigate}>
        <Button render={<a href="/docs" />} onPress={onPress}>
          Docs
        </Button>
      </RouterProvider>,
    )
    const el = screen.getByRole("link", { name: "Docs" })
    expect(el.hasAttribute("role")).toBe(false)
    const b = driver("Docs", "link")
    await b.via("keyboard").pressWithSpace()
    expect(onPress).not.toHaveBeenCalled()
    await b.via("keyboard").press()
    expect(onPress).toHaveBeenCalledOnce()
  })

  it("disabled anchor: no href, role link, aria-disabled, Tab skips it (ariakit#722)", async () => {
    render(
      <>
        <Button>Before</Button>
        <Button render={<a href="/docs" />} disabled>
          Off
        </Button>
        <Button>After</Button>
      </>,
    )
    const el = screen.getByRole("link", { name: "Off" })
    expect(el.hasAttribute("href")).toBe(false)
    expect(el.getAttribute("role")).toBe("link")
    expect(el.getAttribute("aria-disabled")).toBe("true")
    const user = userEvent.setup()
    await user.tab()
    await user.tab()
    expect(document.activeElement?.textContent).toBe("After")
  })

  it("never disables itself with an inline pointer-events style (ariakit#845)", () => {
    render(
      <>
        <Button disabled>A</Button>
        <Button pending>B</Button>
        <Button disabled render={<div />}>
          C
        </Button>
        <Button disabled render={<a href="/a" />}>
          D
        </Button>
      </>,
    )
    for (const el of document.querySelectorAll("[data-scope=button]")) {
      expect(el.getAttribute("style")).toBeNull()
    }
  })

  it("focusableWhenDisabled with a consumer onClick: no onPress, keeps focus, Tab moves on (base-ui#1312)", async () => {
    const onPress = vi.fn()
    const onClick = vi.fn()
    render(
      <>
        <Button
          disabled
          focusableWhenDisabled
          onPress={onPress}
          onClick={onClick}
          onPressStart={onPress}
        >
          Off
        </Button>
        <Button>Next</Button>
      </>,
    )
    const el = screen.getByRole("button", { name: "Off" })
    const user = userEvent.setup()
    await user.tab()
    expect(document.activeElement).toBe(el)
    const b = driver("Off")
    await b.press()
    await b.via("touch").press()
    await b.via("keyboard").press()
    await b.via("keyboard").pressWithSpace()
    await b.via("virtual").press()
    expect(onPress).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(el)
    await user.tab()
    expect(document.activeElement?.textContent).toBe("Next")
  })

  it("a disabled Button has the native disabled attribute (base-ui#1843)", () => {
    render(<Button disabled>Off</Button>)
    expect(screen.getByRole("button").hasAttribute("disabled")).toBe(true)
  })

  it("Space on a submit Button: onPress once, submit once (react-spectrum#10658)", async () => {
    const onPress = vi.fn()
    const onSubmit = vi.fn((e: Event) => e.preventDefault())
    render(
      <form onSubmit={(e) => onSubmit(e.nativeEvent)}>
        <Button type="submit" onPress={onPress}>
          Send
        </Button>
      </form>,
    )
    await driver("Send").via("keyboard").pressWithSpace()
    expect(onPress).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledTimes(1)
    await driver("Send").via("keyboard").press()
    expect(onPress).toHaveBeenCalledTimes(2)
    expect(onSubmit).toHaveBeenCalledTimes(2)
  })

  it("Enter on a reset Button: onPress once, reset once", async () => {
    const onPress = vi.fn()
    const onReset = vi.fn()
    render(
      <form onReset={onReset}>
        <input aria-label="Name" defaultValue="a" />
        <Button type="reset" onPress={onPress}>
          Clear
        </Button>
      </form>,
    )
    const input = screen.getByLabelText("Name") as HTMLInputElement
    input.value = "changed"
    await driver("Clear").via("keyboard").press()
    expect(onPress).toHaveBeenCalledTimes(1)
    expect(onReset).toHaveBeenCalledTimes(1)
    expect(input.value).toBe("a")
  })

  it("autoFocus focuses the element after mount (base-ui#5150)", () => {
    render(<Button autoFocus>Hi</Button>)
    expect(document.activeElement).toBe(screen.getByRole("button"))
  })

  // BUG (reported): Button swallows its `id` prop (button.tsx destructures it for the
  // instance id and never renders it), so `<label htmlFor>` finds no control.
  it("a click forwarded by a label calls onPress once (react-spectrum#8887)", async () => {
    const onPress = vi.fn()
    render(
      <>
        <label htmlFor="b1">Label</label>
        <Button id="b1" onPress={onPress}>
          Target
        </Button>
      </>,
    )
    await userEvent.setup().click(screen.getByText("Label"))
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it("a click on a label wrapping the Button calls onPress once (react-spectrum#8887)", async () => {
    const onPress = vi.fn()
    render(
      // biome-ignore lint/a11y/noLabelWithoutControl: the Button is the control
      <label>
        Label
        <Button onPress={onPress}>Target</Button>
      </label>,
    )
    await userEvent.setup().click(screen.getByText("Label"))
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  // BUG (reported): `id` is not forwarded to the element.
  it("forwards id to the rendered element", () => {
    render(<Button id="mine">Id</Button>)
    expect(screen.getByRole("button").id).toBe("mine")
  })

  it("a bare click is a virtual press (react-spectrum#10229)", () => {
    const onPress = vi.fn()
    render(<Button onPress={onPress}>Bare</Button>)
    fireEvent.click(screen.getByRole("button"), { detail: 0 })
    expect(onPress).toHaveBeenCalledOnce()
    expect(onPress.mock.calls[0]?.[0].modality).toBe("virtual")
  })

  it("forwards onClick as the native click", async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>C</Button>)
    await driver("C").press()
    expect(onClick).toHaveBeenCalledOnce()
    expect(onClick.mock.calls[0]?.[0].nativeEvent).toBeInstanceOf(MouseEvent)
  })
})

describe("activation callbacks", () => {
  it("press moved off: start and end, no press", async () => {
    const onPress = vi.fn()
    const onPressStart = vi.fn()
    const onPressEnd = vi.fn()
    render(
      <>
        <Button onPress={onPress} onPressStart={onPressStart} onPressEnd={onPressEnd}>
          Drag
        </Button>
        <div data-testid="away">away</div>
      </>,
    )
    const user = userEvent.setup()
    const el = screen.getByRole("button")
    await user.pointer([
      { target: el, coords: { clientX: 5, clientY: 5 } },
      { keys: "[MouseLeft>]", target: el, coords: { clientX: 5, clientY: 5 } },
      { target: screen.getByTestId("away") },
      { keys: "[/MouseLeft]", target: screen.getByTestId("away") },
    ])
    expect(onPressStart).toHaveBeenCalledTimes(1)
    expect(onPressEnd).toHaveBeenCalledTimes(1)
    expect(onPress).not.toHaveBeenCalled()
  })

  it("keyboard: Enter, then Space on release, modality keyboard", async () => {
    const onPress = vi.fn()
    render(<Button onPress={onPress}>K</Button>)
    const b = driver("K")
    await b.via("keyboard").press()
    await b.via("keyboard").pressWithSpace()
    expect(onPress.mock.calls.map((c) => c[0].modality)).toEqual(["keyboard", "keyboard"])
  })

  it("an icon-only Button takes its name from aria-label", () => {
    render(
      <Button aria-label="Close">
        <svg aria-hidden="true" width="8" height="8" />
      </Button>,
    )
    expect(screen.getByRole("button", { name: "Close" })).toBeTruthy()
  })

  it("data-pressed is present only while a press is in progress", async () => {
    render(<Button>Hold</Button>)
    const el = screen.getByRole("button")
    const user = userEvent.setup()
    expect(el.hasAttribute("data-pressed")).toBe(false)
    await user.pointer({ keys: "[MouseLeft>]", target: el })
    expect(el.hasAttribute("data-pressed")).toBe(true)
    await user.pointer({ keys: "[/MouseLeft]", target: el })
    expect(el.hasAttribute("data-pressed")).toBe(false)
  })

  it("mouse click shows no ring; Shift+Tab back shows it (base-ui#3759)", async () => {
    render(
      <>
        <Button>One</Button>
        <Button>Two</Button>
      </>,
    )
    const one = screen.getByRole("button", { name: "One" })
    const user = userEvent.setup()
    await user.click(one)
    expect(one.hasAttribute("data-focus")).toBe(true)
    expect(one.hasAttribute("data-focus-visible")).toBe(false)
    await user.tab()
    expect(document.activeElement?.textContent).toBe("Two")
    await user.tab({ shift: true })
    expect(document.activeElement).toBe(one)
    expect(one.hasAttribute("data-focus")).toBe(true)
    expect(one.hasAttribute("data-focus-visible")).toBe(true)
  })
})

describe("pending", () => {
  const Form = (props: { pending: boolean; onPress?: () => void }) => (
    <form onSubmit={(e) => e.preventDefault()}>
      <Button
        type="submit"
        pending={props.pending}
        {...(props.onPress ? { onPress: props.onPress } : {})}
      >
        Save
      </Button>
    </form>
  )

  it("focus survives; one polite 'Loading' announcement (base-ui#4249)", async () => {
    const { rerender } = render(<Form pending={false} />)
    const b = driver("Save")
    const el = screen.getByRole("button")
    await act(async () => el.focus())
    rerender(<Form pending />)
    expect(document.activeElement).toBe(el)
    expect(el.getAttribute("aria-disabled")).toBe("true")
    expect(el.hasAttribute("disabled")).toBe(false)
    const spoken = await b.announcements()
    expect(spoken).toHaveLength(1)
    expect(spoken[0]).toMatchObject({ message: "Loading", priority: "polite" })
  })

  it("no announcement when not focused", async () => {
    const { rerender } = render(<Form pending={false} />)
    const b = driver("Save")
    rerender(<Form pending />)
    expect(await b.announcements()).toEqual([])
  })

  it("pending ignores clicks, Enter, Space and bare clicks; no submit", async () => {
    const onPress = vi.fn()
    const onSubmit = vi.fn((e: Event) => e.preventDefault())
    render(
      <form onSubmit={(e) => onSubmit(e.nativeEvent)}>
        <Button type="submit" pending onPress={onPress}>
          Save
        </Button>
      </form>,
    )
    const b = driver("Save")
    await b.press()
    await b.via("keyboard").press()
    await b.via("keyboard").pressWithSpace()
    await b.via("virtual").press()
    await b.via("touch").press()
    expect(onPress).not.toHaveBeenCalled()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("implicit submission from a text field does not submit a pending form's button", async () => {
    const onSubmit = vi.fn((e: Event) => e.preventDefault())
    render(
      <form onSubmit={(e) => onSubmit(e.nativeEvent)}>
        <input aria-label="Name" />
        <input aria-label="Other" />
        <Button type="submit" pending>
          Save
        </Button>
      </form>,
    )
    const user = userEvent.setup()
    await user.click(screen.getByLabelText("Name"))
    await user.keyboard("{Enter}")
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("hover still sets data-hover while pending (react-spectrum#9460)", async () => {
    render(<Button pending>Wait</Button>)
    const b = driver("Wait")
    await b.part("root").hover()
    expect(screen.getByRole("button").hasAttribute("data-hover")).toBe(true)
  })

  it("data-state and data-pending come and go with pending", () => {
    const { rerender } = render(<Button pending>Wait</Button>)
    const el = screen.getByRole("button")
    expect(el.getAttribute("data-state")).toBe("pending")
    expect(el.hasAttribute("data-pending")).toBe(true)
    rerender(<Button>Wait</Button>)
    expect(el.getAttribute("data-state")).toBe("idle")
    expect(el.hasAttribute("data-pending")).toBe(false)
  })

  it("localised announcement through the provider", async () => {
    const ui = (pending: boolean) => (
      <RindProvider messages={{ button: { pending: "Caricamento" } }}>
        <Button pending={pending}>Salva</Button>
      </RindProvider>
    )
    const { rerender } = render(ui(false))
    const b = driver("Salva")
    await act(async () => screen.getByRole("button").focus())
    rerender(ui(true))
    const spoken = await b.announcements()
    expect(spoken.map((s) => s.message)).toEqual(["Caricamento"])
  })

  it("the messages prop overrides the provider", async () => {
    const ui = (pending: boolean) => (
      <RindProvider messages={{ button: { pending: "Caricamento" } }}>
        <Button pending={pending} messages={{ pending: "Un attimo" }}>
          Salva
        </Button>
      </RindProvider>
    )
    const { rerender } = render(ui(false))
    const b = driver("Salva")
    await act(async () => screen.getByRole("button").focus())
    rerender(ui(true))
    expect((await b.announcements()).map((s) => s.message)).toEqual(["Un attimo"])
  })
})

describe("interactive descendants", () => {
  it("warns in development once after attach", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    render(
      <Button>
        Outer <a href="/x">inner</a>
      </Button>,
    )
    expect(warn.mock.calls.filter((c) => /interactive content/.test(String(c[0])))).toHaveLength(1)
  })

  it("does not warn for plain content", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    render(
      <Button>
        <span>plain</span>
      </Button>,
    )
    expect(warn).not.toHaveBeenCalled()
  })
})

describe("Anchor-rendered Button routes like a Link (react-spectrum#10603)", () => {
  it("a plain click navigates once; a modified click is left to the browser", async () => {
    const router = fakeRouter()
    render(
      <RouterProvider navigate={router.navigate}>
        <Button render={<a href="/docs" />}>Docs</Button>
      </RouterProvider>,
    )
    const l = driver("Docs", "link")
    await l.press()
    expect(router.calls.map((c) => c.href)).toEqual(["/docs"])
    expect(navigationLog().map((n) => [n.via, n.newTab])).toEqual([["router", false]])
    await l.part("root").click({ mod: true })
    // The modified click is not routed: the browser opens it elsewhere.
    expect(router.calls).toHaveLength(1)
    expect(navigationLog().at(-1)).toMatchObject({ newTab: true })
    expect(navigationLog().filter((n) => n.via === "router")).toHaveLength(1)
  })

  it("Enter navigates once through the router", async () => {
    const router = fakeRouter()
    render(
      <RouterProvider navigate={router.navigate}>
        <Button render={<a href="/docs" />}>Docs</Button>
      </RouterProvider>,
    )
    await driver("Docs", "link").via("keyboard").press()
    expect(router.calls).toHaveLength(1)
    expect(navigationLog().map((n) => n.via)).toEqual(["router"])
  })
})

describe("disabled fieldset through the component", () => {
  const flushObserver = () => act(() => new Promise<void>((r) => setTimeout(r, 20)))
  const attr = (name: string) => screen.getByRole("button", { name }).hasAttribute("data-disabled")

  it("runtime toggle: data-disabled and no activation, then back", async () => {
    const onPress = vi.fn()
    render(
      <fieldset>
        <Button onPress={onPress}>In</Button>
      </fieldset>,
    )
    const fs = document.querySelector("fieldset") as HTMLFieldSetElement
    await act(async () => {
      fs.disabled = true
    })
    await vi.waitFor(() => expect(attr("In")).toBe(true))
    await driver("In").press()
    await driver("In").via("virtual").press()
    expect(onPress).not.toHaveBeenCalled()
    await act(async () => {
      fs.disabled = false
    })
    await vi.waitFor(() => expect(attr("In")).toBe(false))
    await driver("In").press()
    expect(onPress).toHaveBeenCalledOnce()
  })

  it("starts disabled when mounted inside a disabled fieldset", async () => {
    render(
      <fieldset disabled>
        <Button render={<div />}>In</Button>
      </fieldset>,
    )
    await vi.waitFor(() => expect(attr("In")).toBe(true))
  })

  it("outer fieldset disabled and enabled again", async () => {
    const onPress = vi.fn()
    render(
      <fieldset id="outer">
        <fieldset>
          <Button onPress={onPress} render={<div />}>
            In
          </Button>
        </fieldset>
      </fieldset>,
    )
    const outer = document.getElementById("outer") as HTMLFieldSetElement
    await act(async () => {
      outer.disabled = true
    })
    await vi.waitFor(() => expect(attr("In")).toBe(true))
    await driver("In").press()
    expect(onPress).not.toHaveBeenCalled()
    await act(async () => {
      outer.disabled = false
    })
    await vi.waitFor(() => expect(attr("In")).toBe(false))
    await driver("In").press()
    expect(onPress).toHaveBeenCalledOnce()
  })

  it("first legend is exempt, second legend is disabled", async () => {
    const first = vi.fn()
    const second = vi.fn()
    render(
      <fieldset disabled>
        <legend>
          <Button render={<div />} onPress={first}>
            First
          </Button>
        </legend>
        <legend>
          <Button render={<div />} onPress={second}>
            Second
          </Button>
        </legend>
      </fieldset>,
    )
    await flushObserver()
    await vi.waitFor(() => expect(attr("Second")).toBe(true))
    expect(attr("First")).toBe(false)
    await driver("First").press()
    await driver("Second").press()
    expect(first).toHaveBeenCalledOnce()
    expect(second).not.toHaveBeenCalled()
  })

  it("first legend of a nested fieldset inside a disabled one is disabled", async () => {
    render(
      <fieldset disabled>
        <fieldset>
          <legend>
            <Button render={<div />}>Nested</Button>
          </legend>
        </fieldset>
      </fieldset>,
    )
    await vi.waitFor(() => expect(attr("Nested")).toBe(true))
  })

  it("portalled part under a disabled rind-ui Fieldset is disabled (A.1)", async () => {
    const onPress = vi.fn()
    render(
      <Fieldset.Root disabled>
        <Fieldset.Legend>Group</Fieldset.Legend>
        <Portal>
          <Button onPress={onPress}>Portalled</Button>
        </Portal>
      </Fieldset.Root>,
    )
    const el = screen.getByRole("button", { name: "Portalled" })
    expect(el.closest("fieldset")).toBeNull()
    expect(el.hasAttribute("data-disabled")).toBe(true)
    expect(el.hasAttribute("disabled")).toBe(true)
    await getButton(screen, { name: "Portalled" }).press()
    expect(onPress).not.toHaveBeenCalled()
  })
})

describe("held Enter on a submit Button", () => {
  it("activates once and submits once (repeat keydowns are not native clicks)", async () => {
    const onPress = vi.fn()
    const onSubmit = vi.fn((e: Event) => e.preventDefault())
    render(
      <form onSubmit={(e) => onSubmit(e.nativeEvent)}>
        <Button type="submit" onPress={onPress}>
          Hold
        </Button>
      </form>,
    )
    const el = screen.getByRole("button", { name: "Hold" })
    el.focus()
    await userEvent.keyboard("{Enter>5}{/Enter}")
    expect(onPress).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })
})
