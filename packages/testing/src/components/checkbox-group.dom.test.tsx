import { domEnvironment } from "@rind-ui/core"
import { CheckboxGroup, Field, Fieldset } from "@rind-ui/react"
import { act, render, screen, waitFor } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { expectRindWarning, getCheckboxGroup } from "../index"

const platform = domEnvironment().platform
const TOPPINGS = [
  { value: "a", label: "Olives" },
  { value: "b", label: "Basil" },
  { value: "c", label: "Chili" },
]

function Toppings(props: Partial<Parameters<typeof CheckboxGroup.Root>[0]>) {
  return (
    <form data-testid="f">
      <CheckboxGroup.Root name="toppings" allValues={["a", "b", "c"]} {...props}>
        <CheckboxGroup.Label>Toppings</CheckboxGroup.Label>
        <CheckboxGroup.Parent>
          <CheckboxGroup.ItemControl />
          <CheckboxGroup.ItemLabel>All toppings</CheckboxGroup.ItemLabel>
        </CheckboxGroup.Parent>
        {TOPPINGS.map((t) => (
          <CheckboxGroup.Item key={t.value} value={t.value}>
            <CheckboxGroup.ItemControl />
            <CheckboxGroup.ItemLabel>{t.label}</CheckboxGroup.ItemLabel>
          </CheckboxGroup.Item>
        ))}
      </CheckboxGroup.Root>
    </form>
  )
}

describe("CheckboxGroup smoke", () => {
  it("toggles items, submits the group name, runs the parent cycle", async () => {
    const onValueChange = vi.fn()
    render(<Toppings defaultValue={["a"]} onValueChange={onValueChange} />)
    const g = getCheckboxGroup(screen, { name: "Toppings" }, { platform })
    expect(await g.value()).toEqual(["a"])
    expect(await g.parentState()).toBe("mixed")
    await g.toggle("Basil")
    expect(await g.value()).toEqual(["a", "b"])
    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(new FormData(screen.getByTestId("f") as HTMLFormElement).getAll("toppings")).toEqual([
      "a",
      "b",
    ])
    // Partial [a, b] → all → none → [a, b].
    await g.toggleParent()
    expect(await g.value()).toEqual(["a", "b", "c"])
    await g.toggleParent()
    expect(await g.value()).toEqual([])
    await g.toggleParent()
    expect(await g.value()).toEqual(["a", "b"])
    const parent = screen.getByRole("checkbox", { name: "All toppings" })
    expect(parent.getAttribute("aria-controls")?.split(" ")).toHaveLength(3)
  })
})

// ---- Spec scenarios: checkbox-group (tasks 3.2, 4.3, 5.2-5.4, A.1) ----
const inJsdom = navigator.userAgent.includes("jsdom")
const ALL = ["a", "b", "c"]
const drv = (name = "Toppings") => getCheckboxGroup(screen, { name }, { platform })
const ctrl = (name: string) => screen.getByRole("checkbox", { name })
const hiddenInputs = () =>
  Array.from(document.querySelectorAll<HTMLInputElement>('[data-part="hidden-input"]'))
const itemInputs = () => hiddenInputs().filter((i) => i.closest("[data-parent]") === null)

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
  props?: Partial<Parameters<typeof CheckboxGroup.Item>[0]>
  controlId?: string
}
function Grp({
  items = TOPPINGS,
  parent = false,
  description,
  error,
  fieldset = false,
  ...root
}: Partial<Parameters<typeof CheckboxGroup.Root>[0]> & {
  items?: ItemSpec[]
  parent?: boolean
  description?: string
  error?: string
  fieldset?: boolean
}) {
  return (
    <form data-testid="f">
      <CheckboxGroup.Root
        name="toppings"
        {...(parent ? { allValues: ALL } : {})}
        {...(fieldset ? { render: <fieldset /> } : {})}
        {...root}
      >
        <CheckboxGroup.Label {...(fieldset ? { render: <legend /> } : {})}>
          Toppings
        </CheckboxGroup.Label>
        {description && <CheckboxGroup.Description>{description}</CheckboxGroup.Description>}
        {error && <CheckboxGroup.ErrorMessage>{error}</CheckboxGroup.ErrorMessage>}
        {parent && (
          <CheckboxGroup.Parent>
            <CheckboxGroup.ItemControl />
            <CheckboxGroup.ItemLabel>All toppings</CheckboxGroup.ItemLabel>
          </CheckboxGroup.Parent>
        )}
        {items.map((t) => (
          <CheckboxGroup.Item key={t.value} value={t.value} {...t.props}>
            <CheckboxGroup.ItemControl {...(t.controlId ? { id: t.controlId } : {})} />
            <CheckboxGroup.ItemLabel>{t.label}</CheckboxGroup.ItemLabel>
          </CheckboxGroup.Item>
        ))}
      </CheckboxGroup.Root>
    </form>
  )
}
const formData = () => new FormData(screen.getByTestId("f") as HTMLFormElement)

describe("Group value", () => {
  it("toggling an item proposes the set once (bits-ui#1613)", async () => {
    const onValueChange = vi.fn()
    render(<Grp defaultValue={["a"]} onValueChange={onValueChange} />)
    await drv().toggle("Basil")
    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(onValueChange.mock.calls[0]?.[0]).toEqual(["a", "b"])
    expect(ctrl("Basil").getAttribute("aria-checked")).toBe("true")
  })

  it("a controlled group that refuses keeps every item", async () => {
    const onValueChange = vi.fn()
    render(<Grp value={["a"]} onValueChange={onValueChange} />)
    // The driver would wait for a change that never comes: press directly.
    await click(ctrl("Basil"))
    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(await drv().value()).toEqual(["a"])
    expect(ctrl("Basil").getAttribute("aria-checked")).toBe("false")
  })

  it("a controlled group that applies follows", async () => {
    function C() {
      const [v, setV] = useState<readonly string[]>([])
      return <Grp value={v} onValueChange={setV} />
    }
    render(<C />)
    await drv().toggle("Olives")
    await drv().toggle("Chili")
    expect(await drv().value()).toEqual(["a", "c"])
  })

  it("an item without a value is a development error", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    render(
      <CheckboxGroup.Root>
        <CheckboxGroup.Item>
          <CheckboxGroup.ItemControl aria-label="x" />
        </CheckboxGroup.Item>
      </CheckboxGroup.Root>,
    )
    expect(error.mock.calls.some((c) => /needs a `value`/.test(String(c[0])))).toBe(true)
  })
})

describe("Semantics and labelling", () => {
  it("the group is named by its Label, which is not a <label>", () => {
    render(<Grp />)
    const g = screen.getByRole("group", { name: "Toppings" })
    expect(g.getAttribute("aria-labelledby")).toBeTruthy()
    expect(screen.getByText("Toppings").tagName).not.toBe("LABEL")
  })

  it("items keep unique ids and each label toggles only its item (ark#2895)", async () => {
    render(<Grp />)
    const ids = TOPPINGS.map((t) => ctrl(t.label).id)
    expect(new Set(ids).size).toBe(3)
    expect(ids.every(Boolean)).toBe(true)
    await click(screen.getByText("Basil"))
    expect(await drv().value()).toEqual(["b"])
    await click(screen.getByText("Chili"))
    expect(await drv().value()).toEqual(["b", "c"])
  })

  it("the group description reaches the focused item", async () => {
    render(<Grp description="Pick at least one" />)
    act(() => ctrl("Olives").focus())
    const d = ctrl("Olives").getAttribute("aria-describedby") ?? ""
    const text = d
      .split(" ")
      .map((id) => document.getElementById(id)?.textContent)
      .join(" ")
    expect(text).toContain("Pick at least one")
  })

  it("rendered as fieldset/legend: no role, no aria-labelledby, named by the legend", () => {
    const { container } = render(<Grp fieldset />)
    const fs = container.querySelector("fieldset") as HTMLElement
    expect(fs.hasAttribute("role")).toBe(false)
    expect(fs.hasAttribute("aria-labelledby")).toBe(false)
    expect(screen.getByRole("group", { name: "Toppings" })).toBe(fs)
    expect(container.querySelector("legend")?.textContent).toBe("Toppings")
  })
})

describe("Keyboard and focus", () => {
  it("Tab goes through the items; ArrowDown is inert (react-spectrum#5907)", async () => {
    const user = userEvent.setup()
    render(<Grp />)
    act(() => ctrl("Olives").focus())
    await user.tab()
    expect(document.activeElement).toBe(ctrl("Basil"))
    await user.keyboard("{ArrowDown}")
    expect(document.activeElement).toBe(ctrl("Basil"))
    expect(await drv().value()).toEqual([])
    await user.keyboard(" ")
    expect(await drv().value()).toEqual(["b"])
  })

  it("Space on the Parent changes the value and keeps focus there", async () => {
    const user = userEvent.setup()
    render(<Grp parent defaultValue={["a"]} />)
    act(() => ctrl("All toppings").focus())
    await user.keyboard(" ")
    expect(await drv().value()).toEqual(ALL)
    expect(document.activeElement).toBe(ctrl("All toppings"))
  })

  it("the keyboard modality toggles an item", async () => {
    render(<Grp />)
    await drv().via("keyboard").toggle("Chili")
    expect(await drv().value()).toEqual(["c"])
  })
})

describe("Parent", () => {
  it("mixed, checked and unchecked states", async () => {
    render(<Grp parent defaultValue={["a"]} />)
    const p = ctrl("All toppings")
    expect(p.getAttribute("aria-checked")).toBe("mixed")
    expect(p.getAttribute("data-state")).toBe("indeterminate")
    expect(await drv().parentState()).toBe("mixed")
    await drv().toggle("Basil")
    await drv().toggle("Chili")
    expect(await drv().parentState()).toBe("checked")
    await drv().toggle("Olives")
    await drv().toggle("Basil")
    await drv().toggle("Chili")
    expect(await drv().parentState()).toBe("unchecked")
  })

  it("aria-controls lists rendered ids only, including a consumer id (base-ui#2691)", () => {
    // the broken or partial setup this test exercises logs it
    expectRindWarning(/checkbox-group: allValues \["b"\] have no rendered item/)
    render(
      <Grp
        parent
        items={[
          { value: "a", label: "Olives" },
          { value: "c", label: "Chili", controlId: "custom-c" },
        ]}
      />,
    )
    const controls = (ctrl("All toppings").getAttribute("aria-controls") ?? "").split(" ")
    expect(controls).toEqual([ctrl("Olives").id, "custom-c"])
  })

  it("proposes only arrays (base-ui#4896)", async () => {
    const onValueChange = vi.fn()
    render(<Grp parent onValueChange={onValueChange} />)
    await drv().toggleParent()
    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(Array.isArray(onValueChange.mock.calls[0]?.[0])).toBe(true)
    expect(onValueChange.mock.calls[0]?.[0]).toEqual(ALL)
  })

  it("is not submitted and has no name", async () => {
    render(<Grp parent defaultValue={["a"]} />)
    await drv().toggleParent()
    expect(formData().getAll("toppings")).toEqual(ALL)
    expect([...formData().keys()].every((k) => k === "toppings")).toBe(true)
    const parentInput = hiddenInputs().find((i) => i.closest("[data-parent]"))
    expect(parentInput?.hasAttribute("name") ?? false).toBe(false)
  })

  it("the select-all cycle in every modality; virtual toggles once", async () => {
    render(<Grp parent defaultValue={["a"]} />)
    await drv().via("virtual").toggleParent()
    expect(await drv().value()).toEqual(ALL)
    await drv().via("keyboard").toggleParent()
    expect(await drv().value()).toEqual([])
    await drv().toggleParent()
    expect(await drv().value()).toEqual(["a"])
  })

  it("never changes disabled items (base-ui#729)", async () => {
    render(
      <Grp
        parent
        defaultValue={["b"]}
        items={[
          { value: "a", label: "Olives" },
          { value: "b", label: "Basil", props: { disabled: true } },
          { value: "c", label: "Chili", props: { disabled: true } },
        ]}
      />,
    )
    await waitFor(async () => expect(await drv().parentState()).toBe("mixed"))
    await drv().toggleParent()
    expect(await drv().value()).toEqual(["a", "b"])
    expect(await drv().parentState()).toBe("mixed")
    await drv().toggleParent()
    expect(await drv().value()).toEqual(["b"])
  })

  it("a Parent without allValues is a development error", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    render(
      <CheckboxGroup.Root>
        <CheckboxGroup.Parent>
          <CheckboxGroup.ItemControl aria-label="all" />
        </CheckboxGroup.Parent>
      </CheckboxGroup.Root>,
    )
    expect(error.mock.calls.some((c) => /allValues/.test(String(c[0])))).toBe(true)
  })
})

describe("Disabled and read-only", () => {
  it("the group's disabled wins over an item's disabled={false} (base-ui#1043)", async () => {
    // the broken or partial setup this test exercises logs it
    expectRindWarning(/checkbox-group: allValues \["b","c"\] have no rendered item/)
    render(
      <Grp disabled items={[{ value: "a", label: "Olives", props: { disabled: false } }]} parent />,
    )
    expect(await drv().isDisabled()).toBe(true)
    expect(
      ctrl("Olives").hasAttribute("disabled") ||
        ctrl("Olives").getAttribute("aria-disabled") === "true",
    ).toBe(true)
    expect(itemInputs()[0]?.disabled).toBe(true)
    expect(document.querySelector("[data-parent]")?.hasAttribute("data-disabled")).toBe(true)
  })

  it("an item disabled alone leaves the others operable (ark#3759)", async () => {
    render(
      <Grp
        items={[
          { value: "a", label: "Olives", props: { disabled: true } },
          { value: "b", label: "Basil" },
        ]}
      />,
    )
    await drv()
      .toggle("Olives")
      .catch(() => {})
    expect(await drv().value()).toEqual([])
    await drv().toggle("Basil")
    expect(await drv().value()).toEqual(["b"])
    expect(itemInputs().map((i) => i.disabled)).toEqual([true, false])
  })

  it("read-only: Space does not change the value, keeps focus and aria-readonly", async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(<Grp readOnly defaultValue={["a"]} onValueChange={onValueChange} />)
    act(() => ctrl("Basil").focus())
    await user.keyboard(" ")
    expect(await drv().value()).toEqual(["a"])
    expect(onValueChange).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(ctrl("Basil"))
    expect(ctrl("Basil").getAttribute("aria-readonly")).toBe("true")
  })
})

describe("Required group", () => {
  const submit = () => act(() => (screen.getByTestId("f") as HTMLFormElement).requestSubmit())

  it("an empty required group blocks submission and focuses the first enabled item", async () => {
    const onSubmit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault())
    render(
      <form data-testid="f" onSubmit={onSubmit}>
        <CheckboxGroup.Root name="t" required>
          <CheckboxGroup.Label>Toppings</CheckboxGroup.Label>
          {TOPPINGS.map((t, i) => (
            <CheckboxGroup.Item key={t.value} value={t.value} disabled={i === 0}>
              <CheckboxGroup.ItemControl />
              <CheckboxGroup.ItemLabel>{t.label}</CheckboxGroup.ItemLabel>
            </CheckboxGroup.Item>
          ))}
        </CheckboxGroup.Root>
      </form>,
    )
    expect(await drv().isRequired()).toBe(true)
    expect(ctrl("Basil").getAttribute("aria-required")).toBe("true")
    expect(ctrl("Olives").hasAttribute("aria-required")).toBe(false)
    expect(screen.getByRole("group").hasAttribute("aria-required")).toBe(false)
    submit()
    expect(onSubmit).not.toHaveBeenCalled()
    // jsdom runs constraint validation but does not move focus.
    if (!inJsdom) await waitFor(() => expect(document.activeElement).toBe(ctrl("Basil")))
    await drv().toggle("Chili")
    submit()
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it("one checked is enough: valid, and no item carries aria-required", async () => {
    render(<Grp required defaultValue={["b"]} />)
    expect(itemInputs().every((i) => i.validity.valid)).toBe(true)
    for (const t of TOPPINGS) expect(ctrl(t.label).hasAttribute("aria-required")).toBe(false)
    expect(screen.getByRole("group").hasAttribute("aria-required")).toBe(false)
  })

  it("item-level required keeps its own constraint (base-ui#4952)", () => {
    render(
      <Grp
        defaultValue={["a"]}
        items={[
          { value: "a", label: "Olives", props: { required: true } },
          { value: "b", label: "Basil", props: { required: true } },
        ]}
      />,
    )
    const [a, b] = itemInputs()
    expect(a?.validity.valid).toBe(true)
    expect(b?.validity.valid).toBe(false)
    // The group's value is non-empty, yet an individually required item keeps its own
    // aria-required, checked (Olives) or not (Basil).
    expect(ctrl("Olives").getAttribute("aria-required")).toBe("true")
    expect(ctrl("Basil").getAttribute("aria-required")).toBe("true")
  })

  it("focus goes to the failing item (base-ui#5200)", async () => {
    render(
      <Grp
        defaultValue={["a"]}
        items={[
          { value: "a", label: "Olives" },
          { value: "b", label: "Basil", props: { required: true } },
        ]}
      />,
    )
    submit()
    if (!inJsdom) await waitFor(() => expect(document.activeElement).toBe(ctrl("Basil")))
  })

  it("validity is recomputed on change (react-aria#6173)", async () => {
    render(<Grp required />)
    submit()
    expect(itemInputs().some((i) => !i.validity.valid)).toBe(true)
    await drv().toggle("Olives")
    expect(itemInputs().every((i) => i.validity.valid)).toBe(true)
  })
})

describe("Invalid state", () => {
  it("items are aria-invalid and described by the ErrorMessage", () => {
    render(<Grp invalid error="Pick one" />)
    for (const t of TOPPINGS) {
      const c = ctrl(t.label)
      expect(c.getAttribute("aria-invalid")).toBe("true")
      const text = (c.getAttribute("aria-describedby") ?? "")
        .split(" ")
        .map((id) => document.getElementById(id)?.textContent)
        .join(" ")
      expect(text).toContain("Pick one")
    }
    expect(screen.getByRole("group").hasAttribute("data-invalid")).toBe(true)
    expect(screen.getByText("Pick one").getAttribute("aria-live")).toBeNull()
  })

  it("the ErrorMessage is not rendered while valid", () => {
    render(<Grp error="Pick one" />)
    expect(screen.queryByText("Pick one")).toBeNull()
  })
})

describe("Form submission and reset", () => {
  it("native submission omits a disabled item", () => {
    render(
      <Grp
        defaultValue={["a", "c"]}
        items={[
          { value: "a", label: "Olives" },
          { value: "b", label: "Basil" },
          { value: "c", label: "Chili", props: { disabled: true } },
        ]}
      />,
    )
    expect(formData().getAll("toppings")).toEqual(["a"])
  })

  it("an item's own name is ignored; the group's name wins", () => {
    render(
      <Grp defaultValue={["a"]} items={[{ value: "a", label: "Olives", props: { name: "x" } }]} />,
    )
    expect([...formData()]).toEqual([["toppings", "a"]])
  })

  it("reset unchecks every box at once with one RESET callback (react-aria#7749)", async () => {
    const onValueChange = vi.fn()
    render(
      <form data-testid="f">
        <CheckboxGroup.Root name="t" onValueChange={onValueChange}>
          <CheckboxGroup.Label>Toppings</CheckboxGroup.Label>
          {TOPPINGS.map((t) => (
            <CheckboxGroup.Item key={t.value} value={t.value}>
              <CheckboxGroup.ItemControl />
              <CheckboxGroup.ItemLabel>{t.label}</CheckboxGroup.ItemLabel>
            </CheckboxGroup.Item>
          ))}
        </CheckboxGroup.Root>
        <button type="reset">Reset</button>
      </form>,
    )
    for (const t of TOPPINGS) await drv().toggle(t.label)
    expect(await drv().value()).toEqual(ALL)
    onValueChange.mockClear()
    act(() => (screen.getByTestId("f") as HTMLFormElement).reset())
    await waitFor(async () => expect(await drv().value()).toEqual([]))
    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(onValueChange.mock.calls[0]?.[0]).toEqual([])
    expect(onValueChange.mock.calls[0]?.[1].reason).toBe("RESET")
    await waitFor(() => expect(itemInputs().every((i) => !i.checked)).toBe(true))
  })

  it("reset restores the default value", async () => {
    render(
      <>
        <Grp defaultValue={["b"]} />
        <button type="reset" form="x">
          r
        </button>
      </>,
    )
    await drv().toggle("Olives")
    act(() => (screen.getByTestId("f") as HTMLFormElement).reset())
    await waitFor(async () => expect(await drv().value()).toEqual(["b"]))
  })
})

describe("Data attributes", () => {
  it("Root, Parent and item hooks", () => {
    render(<Grp disabled parent />)
    expect(screen.getByRole("group").hasAttribute("data-disabled")).toBe(true)
    expect(screen.getByRole("group").getAttribute("data-scope")).toBe("checkbox-group")
    const p = ctrl("All toppings")
    expect(p.hasAttribute("data-parent")).toBe(true)
    expect(p.hasAttribute("data-disabled")).toBe(true)
    expect(ctrl("Olives").getAttribute("data-value")).toBe("a")
    expect(ctrl("Olives").hasAttribute("data-parent")).toBe(false)
  })
})

describe("Field binding", () => {
  it("in an invalid Field only the group registers and the Field names and describes it", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    render(
      <Field.Root invalid>
        <Field.Label>Toppings</Field.Label>
        <CheckboxGroup.Root name="t">
          {TOPPINGS.map((t) => (
            <CheckboxGroup.Item key={t.value} value={t.value}>
              <CheckboxGroup.ItemControl />
              <CheckboxGroup.ItemLabel>{t.label}</CheckboxGroup.ItemLabel>
            </CheckboxGroup.Item>
          ))}
        </CheckboxGroup.Root>
        <Field.ErrorMessage>Pick one</Field.ErrorMessage>
      </Field.Root>,
    )
    expect(warn.mock.calls.filter((c) => /second control/.test(String(c[0])))).toEqual([])
    expect(screen.getByRole("group", { name: "Toppings" })).toBeTruthy()
    for (const t of TOPPINGS) expect(ctrl(t.label).getAttribute("aria-invalid")).toBe("true")
    const g = screen.getByRole("group")
    const text = (g.getAttribute("aria-describedby") ?? "")
      .split(" ")
      .map((id) => document.getElementById(id)?.textContent)
      .join(" ")
    expect(text).toContain("Pick one")
  })

  it("a disabled Fieldset disables every item", async () => {
    render(
      <Fieldset.Root disabled>
        <Fieldset.Legend>Group</Fieldset.Legend>
        <Field.Root>
          <Field.Label>Toppings</Field.Label>
          <CheckboxGroup.Root name="t" defaultValue={["a"]}>
            {TOPPINGS.map((t) => (
              <CheckboxGroup.Item key={t.value} value={t.value}>
                <CheckboxGroup.ItemControl />
                <CheckboxGroup.ItemLabel>{t.label}</CheckboxGroup.ItemLabel>
              </CheckboxGroup.Item>
            ))}
          </CheckboxGroup.Root>
        </Field.Root>
      </Fieldset.Root>,
    )
    await waitFor(() => expect(itemInputs().every((i) => i.disabled)).toBe(true))
    expect(itemInputs()).toHaveLength(3)
  })
})

describe("allValues and the rendered items (task 3.2)", () => {
  it("warns when a rendered item is not in allValues", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    render(
      <CheckboxGroup.Root allValues={["a"]}>
        <CheckboxGroup.Label>Extras</CheckboxGroup.Label>
        <CheckboxGroup.Item value="a">
          <CheckboxGroup.ItemControl />
          <CheckboxGroup.ItemLabel>A</CheckboxGroup.ItemLabel>
        </CheckboxGroup.Item>
        <CheckboxGroup.Item value="z">
          <CheckboxGroup.ItemControl />
          <CheckboxGroup.ItemLabel>Z</CheckboxGroup.ItemLabel>
        </CheckboxGroup.Item>
      </CheckboxGroup.Root>,
    )
    await vi.waitFor(() =>
      expect(warn.mock.calls.some(([m]) => /\["z"\] are not in allValues/.test(String(m)))).toBe(
        true,
      ),
    )
    warn.mockRestore()
  })
})

describe("review fixes (add-radio-group r1): external Field errors (base-ui#1745)", () => {
  function InField({ value, errors }: { value?: readonly string[]; errors: readonly string[] }) {
    return (
      <form data-testid="ef">
        <Field.Root errors={errors}>
          <Field.Label>Extras</Field.Label>
          <CheckboxGroup.Root {...(value === undefined ? {} : { value })}>
            {["a", "b"].map((v) => (
              <CheckboxGroup.Item key={v} value={v}>
                <CheckboxGroup.ItemControl />
                <CheckboxGroup.ItemLabel>{v.toUpperCase()}</CheckboxGroup.ItemLabel>
              </CheckboxGroup.Item>
            ))}
          </CheckboxGroup.Root>
          <Field.ErrorMessage />
        </Field.Root>
      </form>
    )
  }

  it("survives a programmatic change", async () => {
    const { rerender } = render(<InField value={[]} errors={["Pick again"]} />)
    expect(screen.getByText("Pick again")).toBeTruthy()
    rerender(<InField value={["a"]} errors={["Pick again"]} />)
    expect(screen.queryByText("Pick again")).toBeTruthy()
    // A form reset clears the Field's external errors by the Field's own reset (field
    // "reset": a user's reset button clears everything); what the group reports for it is
    // not a user change, which the programmatic case above already exercises.
  })

  it("a user change clears it", async () => {
    render(<InField errors={["Pick again"]} />)
    await getCheckboxGroup(screen, { name: "Extras" }, { platform }).toggle("A")
    await waitFor(() => expect(screen.queryByText("Pick again")).toBeNull())
  })
})
