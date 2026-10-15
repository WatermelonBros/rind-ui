import { domEnvironment } from "@rind-ui/core"
import { Button, Fieldset, Portal } from "@rind-ui/react"
import { act, render, screen, within } from "@testing-library/react"
import axe from "axe-core"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { getButton, getFieldset } from "../index"

afterEach(() => vi.restoreAllMocks())

const platform = domEnvironment().platform
/** A real press through the Button driver (pointer by default, or the given modality). */
const press = (name: string, via?: "keyboard") => {
  const b = getButton(screen, { name }, { platform })
  return via ? b.via(via).pressWithSpace() : b.press()
}

describe("Fieldset smoke", () => {
  it("names, describes, disables, shows the error", async () => {
    const { rerender } = render(
      <Fieldset.Root>
        <Fieldset.Legend>Shipping address</Fieldset.Legend>
        <Fieldset.Description>All fields required</Fieldset.Description>
        <input aria-label="Street" />
        <Fieldset.ErrorMessage>Enter an address</Fieldset.ErrorMessage>
      </Fieldset.Root>,
    )
    const f = getFieldset(screen, { name: "Shipping address" })
    expect(await f.name()).toBe("Shipping address")
    expect(await f.description()).toBe("All fields required")
    expect(await f.isDisabled()).toBe(false)
    expect(await f.errors()).toBeNull()
    const root = screen.getByRole("group")
    expect(root.hasAttribute("aria-labelledby")).toBe(false)
    expect(root.hasAttribute("role")).toBe(false)
    await act(async () =>
      rerender(
        <Fieldset.Root disabled invalid>
          <Fieldset.Legend>Shipping address</Fieldset.Legend>
          <Fieldset.Description>All fields required</Fieldset.Description>
          <input aria-label="Street" />
          <Fieldset.ErrorMessage>Enter an address</Fieldset.ErrorMessage>
        </Fieldset.Root>,
      ),
    )
    expect(await f.isDisabled()).toBe(true)
    expect(await f.isInvalid()).toBe(true)
    expect(await f.errors()).toBe("Enter an address")
    expect(await f.description()).toBe("All fields required Enter an address")
    expect((screen.getByRole("textbox") as HTMLInputElement).matches(":disabled")).toBe(true)
  })

  it("nested and first-legend exemption for rind controls", () => {
    render(
      <Fieldset.Root disabled>
        <Fieldset.Legend>
          Outer <Button>In legend</Button>
        </Fieldset.Legend>
        <Button>Outside legend</Button>
        <Fieldset.Root>
          <Fieldset.Legend>Inner</Fieldset.Legend>
        </Fieldset.Root>
      </Fieldset.Root>,
    )
    expect(screen.getByRole("button", { name: "In legend" }).hasAttribute("data-disabled")).toBe(
      false,
    )
    expect(
      screen.getByRole("button", { name: "Outside legend" }).hasAttribute("data-disabled"),
    ).toBe(true)
    expect(screen.getByRole("group", { name: "Inner" }).hasAttribute("data-disabled")).toBe(true)
  })
})

// --- openspec fieldset scenarios ---

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}
const group = (name: string) => screen.getByRole("group", { name })
const has = (el: Element, attr: string) => el.hasAttribute(attr)

describe("Fieldset anatomy and names", () => {
  it("default markup: a fieldset whose first child is the legend", () => {
    render(
      <Fieldset.Root>
        <Fieldset.Legend>Shipping address</Fieldset.Legend>
        <Fieldset.Description>All fields required</Fieldset.Description>
      </Fieldset.Root>,
    )
    const root = group("Shipping address")
    expect(root.tagName).toBe("FIELDSET")
    expect(root.firstElementChild?.tagName).toBe("LEGEND")
    expect(root.firstElementChild?.textContent).toBe("Shipping address")
    expect(root.querySelector("p")?.tagName).toBe("P")
    expect(root.getAttribute("data-scope")).toBe("fieldset")
    expect(root.getAttribute("data-part")).toBe("root")
  })

  it("native legend: named natively, no aria-labelledby, no role (ark#3614)", async () => {
    render(
      <Fieldset.Root>
        <Fieldset.Legend>Contact</Fieldset.Legend>
        <input aria-label="Email" />
      </Fieldset.Root>,
    )
    const root = group("Contact")
    expect(has(root, "aria-labelledby")).toBe(false)
    expect(has(root, "role")).toBe(false)
    expect(await getFieldset(screen, { name: "Contact" }).name()).toBe("Contact")
    await a11y()
  })

  it("substituted legend: aria-labelledby points at it and names the group (base-ui#3044)", async () => {
    render(
      <Fieldset.Root>
        <Fieldset.Legend render={<div />}>Billing</Fieldset.Legend>
        <input aria-label="Name" />
      </Fieldset.Root>,
    )
    const root = await screen.findByRole("group", { name: "Billing" })
    const legend = screen.getByText("Billing")
    expect(legend.tagName).toBe("DIV")
    expect(root.getAttribute("aria-labelledby")).toBe(legend.id)
    expect(legend.id).not.toBe("")
    expect(await getFieldset(screen, { name: "Billing" }).name()).toBe("Billing")
    await a11y()
  })

  it("a legend that is not the first child is not native: it labels by id", async () => {
    render(
      <Fieldset.Root>
        <input aria-label="Name" />
        <Fieldset.Legend>Late</Fieldset.Legend>
      </Fieldset.Root>,
    )
    const root = await screen.findByRole("group", { name: "Late" })
    expect(root.getAttribute("aria-labelledby")).toBe(screen.getByText("Late").id)
  })

  it("consumer ids on the legend are kept and referenced", async () => {
    render(
      <Fieldset.Root>
        <Fieldset.Legend id="mine" render={<span />}>
          Mine
        </Fieldset.Legend>
      </Fieldset.Root>,
    )
    const root = await screen.findByRole("group", { name: "Mine" })
    expect(root.getAttribute("aria-labelledby")).toBe("mine")
  })
})

describe("Fieldset description and error", () => {
  it("no description, no error: no aria-describedby after mount (ark#3707)", async () => {
    render(
      <Fieldset.Root>
        <Fieldset.Legend>Plain</Fieldset.Legend>
        <input aria-label="x" />
      </Fieldset.Root>,
    )
    const root = group("Plain")
    await vi.waitFor(() => expect(has(root, "aria-describedby")).toBe(false))
    expect(await getFieldset(screen, { name: "Plain" }).description()).toBe("")
  })

  it("invalid without an ErrorMessage part adds nothing either", async () => {
    render(
      <Fieldset.Root invalid>
        <Fieldset.Legend>Bare</Fieldset.Legend>
      </Fieldset.Root>,
    )
    await vi.waitFor(() => expect(has(group("Bare"), "aria-describedby")).toBe(false))
  })

  it("description and error, description first (base-ui#3260)", async () => {
    render(
      <Fieldset.Root invalid>
        <Fieldset.Legend>Address</Fieldset.Legend>
        <Fieldset.ErrorMessage>Enter an address</Fieldset.ErrorMessage>
        <Fieldset.Description>All fields required</Fieldset.Description>
      </Fieldset.Root>,
    )
    const f = getFieldset(screen, { name: "Address" })
    // Order in aria-describedby, not in the DOM.
    expect(await f.description()).toBe("All fields required Enter an address")
    expect(await f.errors()).toBe("Enter an address")
    await a11y()
  })

  it("the error leaves the description when the Fieldset is valid again", async () => {
    const tree = (invalid: boolean) => (
      <Fieldset.Root invalid={invalid}>
        <Fieldset.Legend>Address</Fieldset.Legend>
        <Fieldset.Description>All fields required</Fieldset.Description>
        <Fieldset.ErrorMessage>Enter an address</Fieldset.ErrorMessage>
      </Fieldset.Root>
    )
    const { rerender } = render(tree(true))
    const f = getFieldset(screen, { name: "Address" })
    expect(await f.isInvalid()).toBe(true)
    await act(async () => rerender(tree(false)))
    expect(await f.isInvalid()).toBe(false)
    expect(await f.errors()).toBeNull()
    expect(await f.description()).toBe("All fields required")
    expect(screen.queryByText("Enter an address")).toBeNull()
  })

  it("forceMount keeps the ErrorMessage while valid; it is not a live region", async () => {
    render(
      <Fieldset.Root>
        <Fieldset.Legend>Address</Fieldset.Legend>
        <Fieldset.ErrorMessage forceMount>Enter an address</Fieldset.ErrorMessage>
      </Fieldset.Root>,
    )
    const error = screen.getByText("Enter an address")
    expect(has(error, "role")).toBe(false)
    expect(has(error, "aria-live")).toBe(false)
    expect(has(error, "data-invalid")).toBe(false)
  })

  it("consumer aria-describedby is kept after the parts' ids", async () => {
    render(
      <>
        <span id="extra">Extra</span>
        <Fieldset.Root aria-describedby="extra">
          <Fieldset.Legend>Address</Fieldset.Legend>
          <Fieldset.Description>Help</Fieldset.Description>
        </Fieldset.Root>
      </>,
    )
    expect(await getFieldset(screen, { name: "Address" }).description()).toBe("Help Extra")
  })

  it("invalid is not cascaded to the controls inside (ark#2928)", async () => {
    render(
      <Fieldset.Root invalid>
        <Fieldset.Legend>Contact</Fieldset.Legend>
        <input aria-label="Email" />
        <Fieldset.ErrorMessage>Fix the group</Fieldset.ErrorMessage>
      </Fieldset.Root>,
    )
    const input = screen.getByRole("textbox", { name: "Email" })
    expect(has(input, "aria-invalid")).toBe(false)
    expect(has(input, "data-invalid")).toBe(false)
    expect(screen.getByText("Fix the group")).toBeTruthy()
    expect(await getFieldset(screen, { name: "Contact" }).isInvalid()).toBe(true)
  })

  it.todo(
    "an invalid Fieldset contains a valid Text Field without aria-invalid (ark#2928) - add-text-field",
  )
})

describe("Fieldset data attributes", () => {
  it("every part: scope, part, instance; disabled and invalid only when they apply", () => {
    const tree = (flags: { disabled?: boolean; invalid?: boolean }) => (
      <Fieldset.Root {...flags}>
        <Fieldset.Legend>L</Fieldset.Legend>
        <Fieldset.Description>D</Fieldset.Description>
        <Fieldset.ErrorMessage forceMount>E</Fieldset.ErrorMessage>
      </Fieldset.Root>
    )
    const { rerender, container } = render(tree({}))
    const parts = () => Array.from(container.querySelectorAll('[data-scope="fieldset"]'))
    expect(parts().map((p) => p.getAttribute("data-part"))).toEqual([
      "root",
      "legend",
      "description",
      "error-message",
    ])
    const instance = parts()[0]?.getAttribute("data-instance")
    expect(instance).toBeTruthy()
    for (const p of parts()) {
      expect(p.getAttribute("data-instance")).toBe(instance)
      expect(has(p, "data-disabled")).toBe(false)
      expect(has(p, "data-invalid")).toBe(false)
    }
    rerender(tree({ disabled: true, invalid: true }))
    for (const p of parts()) {
      expect(has(p, "data-disabled")).toBe(true)
      expect(has(p, "data-invalid")).toBe(true)
    }
  })

  it("inherited disabled: the inner root and its legend carry data-disabled", () => {
    render(
      <Fieldset.Root disabled>
        <Fieldset.Legend>Outer</Fieldset.Legend>
        <Fieldset.Root>
          <Fieldset.Legend>Inner</Fieldset.Legend>
          <input aria-label="x" />
        </Fieldset.Root>
      </Fieldset.Root>,
    )
    const inner = group("Inner")
    expect(has(inner, "data-disabled")).toBe(true)
    expect(has(inner.querySelector("legend") as Element, "data-disabled")).toBe(true)
    // The inherited state reaches the native attribute too.
    expect(has(inner, "disabled")).toBe(true)
    expect((screen.getByRole("textbox") as HTMLInputElement).matches(":disabled")).toBe(true)
  })

  it("the legend of a disabled fieldset still carries data-disabled (the fieldset's state)", () => {
    render(
      <Fieldset.Root disabled>
        <Fieldset.Legend>Top</Fieldset.Legend>
      </Fieldset.Root>,
    )
    expect(has(screen.getByText("Top"), "data-disabled")).toBe(true)
  })
})

describe("Fieldset props forwarding and substitution", () => {
  it("forwards className, id and handlers to every part", () => {
    const onClick = vi.fn()
    render(
      <Fieldset.Root id="f" className="a" onClick={onClick}>
        <Fieldset.Legend className="b" data-x="1">
          L
        </Fieldset.Legend>
        <Fieldset.Description className="c">D</Fieldset.Description>
      </Fieldset.Root>,
    )
    const root = group("L")
    expect(root.id).toBe("f")
    expect(root.className).toBe("a")
    expect(screen.getByText("L").className).toBe("b")
    expect(screen.getByText("L").getAttribute("data-x")).toBe("1")
    expect(screen.getByText("D").className).toBe("c")
    screen.getByText("D").click()
    expect(onClick).toHaveBeenCalledOnce()
  })

  it("a part outside the Root throws a clear error", () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    expect(() => render(<Fieldset.Legend>x</Fieldset.Legend>)).toThrow(/inside Fieldset.Root/)
  })
})

// --- disabled propagation ---

/** Button/native controls with a spy each, so a press is observable. */
function Controls({ spies }: { spies: ReturnType<typeof makeSpies> }) {
  return (
    <>
      <input type="checkbox" aria-label="native-checkbox" />
      <input aria-label="native-input" />
      <Button onPress={spies.button}>button</Button>
      <Button render={<div />} onPress={spies.div}>
        div
      </Button>
      <Portal>
        <Button onPress={spies.portal}>portal</Button>
      </Portal>
    </>
  )
}

type Place = "body" | "legend1" | "legend2"

function Group({
  disabled,
  place,
  children,
}: {
  disabled: boolean
  place: Place
  children?: ReactNode
}) {
  return (
    <Fieldset.Root disabled={disabled}>
      <Fieldset.Legend>{place === "legend1" ? children : "First"}</Fieldset.Legend>
      <Fieldset.Legend>{place === "legend2" ? children : "Second"}</Fieldset.Legend>
      {place === "body" ? children : null}
    </Fieldset.Root>
  )
}

const makeSpies = () => ({ button: vi.fn(), div: vi.fn(), portal: vi.fn() })

describe("Fieldset disabled propagation matrix", () => {
  const rows: [string, boolean, boolean | undefined, Place][] = []
  for (const outer of [false, true]) {
    for (const inner of [undefined, false, true] as const) {
      for (const place of ["body", "legend1", "legend2"] as const) {
        rows.push([
          `outer ${outer ? "disabled" : "enabled"}, ${
            inner === undefined ? "no inner" : `inner ${inner ? "disabled" : "enabled"}`
          }, controls in ${place}`,
          outer,
          inner,
          place,
        ])
      }
    }
  }

  const matrixRow = async (outer: boolean, inner: boolean | undefined, place: Place) => {
    const spies = makeSpies()
    const controls = <Controls spies={spies} />
    render(
      inner === undefined ? (
        <Group disabled={outer} place={place}>
          {controls}
        </Group>
      ) : (
        <Group disabled={outer} place="body">
          <Group disabled={inner} place={place}>
            {controls}
          </Group>
        </Group>
      ),
    )
    // The oracle is HTML itself: the native checkbox in the same markup. WebKit's :disabled
    // ignores an outer disabled fieldset for the first legend of a nested one (HTML says
    // disabled), so that row follows the spec instead.
    const nativeChecked = (screen.getByRole("checkbox") as HTMLInputElement).matches(":disabled")
    const webkitQuirk = outer && inner !== undefined && place === "legend1"
    const expected = webkitQuirk ? true : nativeChecked
    if (!webkitQuirk) {
      expect((screen.getByRole("textbox") as HTMLInputElement).matches(":disabled")).toBe(expected)
    }
    const button = await screen.findByRole("button", { name: "button" })
    const div = screen.getByText("div")
    const portal = await screen.findByRole("button", { name: "portal" })
    await vi.waitFor(() => {
      for (const el of [button, div, portal]) expect(has(el, "data-disabled")).toBe(expected)
    })
    expect(has(div, "aria-disabled")).toBe(expected)
    for (const key of ["button", "div", "portal"] as const) {
      await press(key)
      expect(spies[key], key).toHaveBeenCalledTimes(expected ? 0 : 1)
    }
  }

  for (const [name, outer, inner, place] of rows) {
    it(name, () => matrixRow(outer, inner, place))
  }
})

describe("Fieldset disabled at runtime", () => {
  const tree = (disabled: boolean, spies: ReturnType<typeof makeSpies>) => (
    <Fieldset.Root disabled={disabled}>
      <Fieldset.Legend>Group</Fieldset.Legend>
      <Controls spies={spies} />
    </Fieldset.Root>
  )

  it("Buttons gain and lose data-disabled; presses are ignored, then work again", async () => {
    const spies = makeSpies()
    const { rerender } = render(tree(false, spies))
    const els = async () => ({
      button: await screen.findByRole("button", { name: "button" }),
      div: screen.getByText("div"),
      portal: await screen.findByRole("button", { name: "portal" }),
    })
    const pressAll = async () => {
      for (const name of ["button", "div", "portal"]) await press(name)
    }
    const flags = async () => Object.values(await els()).map((el) => has(el, "data-disabled"))
    expect(await flags()).toEqual([false, false, false])
    await pressAll()
    expect(Object.values(spies).map((s) => s.mock.calls.length)).toEqual([1, 1, 1])

    await act(async () => rerender(tree(true, spies)))
    await vi.waitFor(async () => expect(await flags()).toEqual([true, true, true]))
    await pressAll()
    expect(Object.values(spies).map((s) => s.mock.calls.length)).toEqual([1, 1, 1])

    await act(async () => rerender(tree(false, spies)))
    await vi.waitFor(async () => expect(await flags()).toEqual([false, false, false]))
    await pressAll()
    expect(Object.values(spies).map((s) => s.mock.calls.length)).toEqual([2, 2, 2])
  })

  it("the keyboard is ignored while disabled and works again after (headlessui#194 shape)", async () => {
    const onPress = vi.fn()
    const tree = (disabled: boolean) => (
      <Fieldset.Root disabled={disabled}>
        <Fieldset.Legend>Group</Fieldset.Legend>
        <Button render={<div />} onPress={onPress}>
          Toggle
        </Button>
      </Fieldset.Root>
    )
    const { rerender } = render(tree(true))
    const el = screen.getByText("Toggle")
    expect(el.getAttribute("aria-disabled")).toBe("true")
    await press("Toggle", "keyboard")
    expect(onPress).not.toHaveBeenCalled()
    await act(async () => rerender(tree(false)))
    await vi.waitFor(() => expect(has(el, "data-disabled")).toBe(false))
    await press("Toggle", "keyboard")
    expect(onPress).toHaveBeenCalledOnce()
  })

  it.todo("Switch inside a disabled Fieldset (headlessui#194) - add-switch")
})

describe("Fieldset disabled: the scenarios", () => {
  it("div-based control: aria-disabled and activation ignored (headlessui#1802 shape)", async () => {
    const onPress = vi.fn()
    render(
      <Fieldset.Root disabled>
        <Fieldset.Legend>Plan</Fieldset.Legend>
        <Button render={<div />} onPress={onPress}>
          Pro
        </Button>
        <Button render={<div />} onPress={onPress}>
          Team
        </Button>
      </Fieldset.Root>,
    )
    for (const name of ["Pro", "Team"]) {
      expect(screen.getByText(name).getAttribute("aria-disabled")).toBe("true")
      await press(name)
    }
    expect(onPress).not.toHaveBeenCalled()
  })

  it.todo(
    "Radio Group with div items inside a disabled Fieldset (headlessui#1802) - add-radio-group",
  )

  it("portalled part: data-disabled and no press (radix#2417 shape)", async () => {
    const onPress = vi.fn()
    render(
      <Fieldset.Root disabled>
        <Fieldset.Legend>Pick</Fieldset.Legend>
        <Portal>
          <Button onPress={onPress}>Option</Button>
        </Portal>
      </Fieldset.Root>,
    )
    const option = await screen.findByRole("button", { name: "Option" })
    expect(option.closest("fieldset")).toBeNull()
    expect(has(option, "data-disabled")).toBe(true)
    await press("Option")
    expect(onPress).not.toHaveBeenCalled()
  })

  it.todo(
    "Select inside a disabled Fieldset does not open, trigger has data-disabled (radix#2417) - add-select",
  )

  it("nested: an enabled Fieldset inside a disabled one is disabled with its controls", async () => {
    render(
      <Fieldset.Root disabled>
        <Fieldset.Legend>Outer</Fieldset.Legend>
        <Fieldset.Root>
          <Fieldset.Legend>Inner</Fieldset.Legend>
          <input aria-label="Street" />
          <Button>Save</Button>
        </Fieldset.Root>
      </Fieldset.Root>,
    )
    expect(await getFieldset(screen, { name: "Inner" }).isDisabled()).toBe(true)
    expect((screen.getByRole("textbox") as HTMLInputElement).matches(":disabled")).toBe(true)
    expect(has(screen.getByRole("button"), "data-disabled")).toBe(true)
  })

  it("control inside the first legend stays enabled, like a native checkbox", async () => {
    render(
      <Fieldset.Root disabled>
        <Fieldset.Legend>
          Toppings <input type="checkbox" aria-label="Select all" /> <Button>All via button</Button>
        </Fieldset.Legend>
        <input type="checkbox" aria-label="Cheese" />
        <Button>Cheese button</Button>
      </Fieldset.Root>,
    )
    const check = (name: string) => screen.getByRole("checkbox", { name }) as HTMLInputElement
    expect(check("Select all").matches(":disabled")).toBe(false)
    expect(check("Cheese").matches(":disabled")).toBe(true)
    expect(has(screen.getByRole("button", { name: "All via button" }), "data-disabled")).toBe(false)
    expect(has(screen.getByRole("button", { name: "Cheese button" }), "data-disabled")).toBe(true)
    expect(await getFieldset(screen, { name: /Toppings/ }).isDisabled()).toBe(true)
  })

  it.todo("Checkbox in the first legend stays enabled, one elsewhere is disabled - add-checkbox")

  it("submission: disabled native values are not in the form data", () => {
    const tree = (disabled: boolean) => (
      <form data-testid="form">
        <input name="outside" defaultValue="o" />
        <Fieldset.Root disabled={disabled}>
          <Fieldset.Legend>
            Group <input name="legend" defaultValue="l" />
          </Fieldset.Legend>
          <input name="text" defaultValue="t" />
          <input name="check" type="checkbox" defaultChecked value="c" />
        </Fieldset.Root>
      </form>
    )
    const { rerender } = render(tree(true))
    const data = () => new FormData(screen.getByTestId("form") as HTMLFormElement)
    expect([...data().keys()].sort()).toEqual(["legend", "outside"])
    rerender(tree(false))
    expect([...data().keys()].sort()).toEqual(["check", "legend", "outside", "text"])
  })

  it("submission: a nested disabled fieldset excludes its values, an enabled sibling keeps them", () => {
    render(
      <form data-testid="form">
        <Fieldset.Root disabled>
          <Fieldset.Legend>Off</Fieldset.Legend>
          <Fieldset.Root>
            <Fieldset.Legend>Inner</Fieldset.Legend>
            <input name="deep" defaultValue="d" />
          </Fieldset.Root>
        </Fieldset.Root>
        <Fieldset.Root>
          <Fieldset.Legend>On</Fieldset.Legend>
          <input name="kept" defaultValue="k" />
        </Fieldset.Root>
      </form>,
    )
    expect([...new FormData(screen.getByTestId("form") as HTMLFormElement).keys()]).toEqual([
      "kept",
    ])
  })

  it.todo(
    "a disabled Fieldset's named Text Field and Checkbox are not submitted - add-text-field, add-checkbox",
  )

  it("a disabled submit Button inside a disabled Fieldset does not submit", async () => {
    const onSubmit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault())
    render(
      <form onSubmit={onSubmit}>
        <Fieldset.Root disabled>
          <Fieldset.Legend>G</Fieldset.Legend>
          <Button type="submit">Send</Button>
        </Fieldset.Root>
      </form>,
    )
    await press("Send")
    expect(onSubmit).not.toHaveBeenCalled()
  })
})

describe("Fieldset substituted root", () => {
  it("is a group with aria-disabled, native controls stay enabled, rind controls follow, dev warning once", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const tree = (extra?: string) => (
      <Fieldset.Root id="subst-root" disabled render={<div data-extra={extra} />}>
        <Fieldset.Legend>Sub</Fieldset.Legend>
        <input aria-label="Native" />
        <Button>Rind</Button>
      </Fieldset.Root>
    )
    const { rerender } = render(tree())
    const root = screen.getByRole("group", { name: "Sub" })
    expect(root.tagName).toBe("DIV")
    expect(root.getAttribute("role")).toBe("group")
    expect(root.getAttribute("aria-disabled")).toBe("true")
    expect(has(root, "disabled")).toBe(false)
    expect(has(root, "data-disabled")).toBe(true)
    expect((screen.getByRole("textbox") as HTMLInputElement).matches(":disabled")).toBe(false)
    expect(has(screen.getByRole("button"), "data-disabled")).toBe(true)
    // The legend of a div root is not a native first-child naming: aria-labelledby names it.
    expect(root.getAttribute("aria-labelledby")).toBe(screen.getByText("Sub").id)
    rerender(tree("again"))
    const warnings = warn.mock.calls.filter((c) => String(c[0]).includes("fieldset"))
    expect(warnings).toHaveLength(1)
    expect(String(warnings[0]?.[0])).toContain("does not disable native controls")
  })

  it("an enabled substituted root does not warn and has no aria-disabled", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    render(
      <Fieldset.Root render={<section />}>
        <Fieldset.Legend>Quiet</Fieldset.Legend>
      </Fieldset.Root>,
    )
    const root = screen.getByRole("group", { name: "Quiet" })
    expect(has(root, "aria-disabled")).toBe(false)
    expect(warn).not.toHaveBeenCalled()
  })

  it("a native root never warns", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    render(
      <Fieldset.Root disabled>
        <Fieldset.Legend>Native</Fieldset.Legend>
      </Fieldset.Root>,
    )
    expect(warn).not.toHaveBeenCalled()
  })
})

describe("Fieldset driver", () => {
  it("isDisabled and isInvalid read the root; the legend is found by role group + name", async () => {
    render(
      <Fieldset.Root disabled invalid>
        <Fieldset.Legend>Shipping address</Fieldset.Legend>
        <Fieldset.ErrorMessage>Enter an address</Fieldset.ErrorMessage>
      </Fieldset.Root>,
    )
    const f = getFieldset(screen, { name: "Shipping address" })
    expect(await f.isDisabled()).toBe(true)
    expect(await f.isInvalid()).toBe(true)
    expect(await f.errors()).toBe("Enter an address")
    expect(within(group("Shipping address")).getByText("Enter an address")).toBeTruthy()
  })
})
