import { domEnvironment } from "@rind-ui/core"
import { Accordion } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { getAccordion } from "../index"

const platform = domEnvironment().platform

function Faq(props: Partial<Parameters<typeof Accordion.Root>[0]>) {
  return (
    <Accordion.Root {...props}>
      {["Shipping", "Returns", "Payment"].map((label) => (
        <Accordion.Item key={label} value={label.toLowerCase()}>
          <Accordion.Header>
            <Accordion.Trigger>{label}</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content>{label} text</Accordion.Content>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  )
}

describe("Accordion smoke", () => {
  it("single mode switches; headers are h3; region while open", async () => {
    render(<Faq />)
    const a = getAccordion(screen, { item: "Shipping" }, { platform })
    expect(await a.expanded()).toEqual([])
    await a.expand("Returns")
    expect(await a.expanded()).toEqual(["Returns"])
    await a.expand("Shipping")
    expect(await a.expanded()).toEqual(["Shipping"])
    expect(document.querySelectorAll("h3[data-part=header]")).toHaveLength(3)
    const trigger = screen.getByRole("button", { name: "Shipping" })
    const region = screen.getByRole("region", { name: "Shipping" })
    expect(region.id).toBe(trigger.getAttribute("aria-controls"))
    expect(await a.contentText("Shipping")).toBe("Shipping text")
    await a.collapse("Shipping")
    expect(await a.expanded()).toEqual([])
  })

  it("multiple mode keeps others; non-collapsible locks", async () => {
    render(<Faq multiple />)
    const a = getAccordion(screen, { item: "Shipping" }, { platform })
    await a.expand("Shipping")
    await a.expand("Payment")
    expect(await a.expanded()).toEqual(["Shipping", "Payment"])
  })

  it("non-collapsible: the open trigger is locked", async () => {
    render(<Faq collapsible={false} defaultValue={["returns"]} />)
    const t = screen.getByRole("button", { name: "Returns" })
    expect(t.getAttribute("aria-disabled")).toBe("true")
    const a = getAccordion(screen, { item: "Shipping" }, { platform })
    await a.toggle("Returns")
    expect(await a.expanded()).toEqual(["Returns"])
  })

  it("keyboardNavigation: ArrowDown moves to the next trigger", async () => {
    render(<Faq keyboardNavigation />)
    const a = getAccordion(screen, { item: "Shipping" }, { platform })
    screen.getByRole("button", { name: "Shipping" }).focus()
    await a.via("keyboard").focusNext()
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Returns" }))
  })
})

// ---- Spec scenarios (tasks 3.3, 4.4, 5.2) ----
import { Heading } from "@rind-ui/react"
import { act, fireEvent, waitFor } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { afterEach, vi } from "vitest"

type RootProps = Parameters<typeof Accordion.Root>[0]
const inJsdom = navigator.userAgent.includes("jsdom")
const hasBeforeMatch = "onbeforematch" in document.body
const HEIGHT = "--rind-accordion-content-height"
const trigger = (name: string) => screen.getByRole("button", { name })
const contentOf = (name: string) =>
  document.getElementById(trigger(name).getAttribute("aria-controls") ?? "") as HTMLElement
const expanded = (name: string) => trigger(name).getAttribute("aria-expanded") === "true"
const open = () =>
  Array.from(document.querySelectorAll<HTMLElement>('[data-part="trigger"]'))
    .filter((t) => t.getAttribute("aria-expanded") === "true")
    .map((t) => t.textContent)

afterEach(() => vi.restoreAllMocks())

/** A real pointer press at the element's centre: a click without coordinates lands at 0,0. */
async function click(el: Element) {
  const r = el.getBoundingClientRect()
  const coords = { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }
  await userEvent.setup().pointer([
    { target: el, coords },
    { keys: "[MouseLeft]", target: el, coords },
  ])
}

/** `n` items "Item 0".."Item n-1" with values "0".."n-1"-prefixed `i`. */
function Many({ n, ...props }: { n: number } & RootProps) {
  return (
    <Accordion.Root {...props}>
      {Array.from({ length: n }, (_, i) => `i${i}`).map((v, i) => (
        <Accordion.Item key={v} value={v}>
          <Accordion.Header>
            <Accordion.Trigger>{`Item ${i}`}</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content>{`Body ${i}`}</Accordion.Content>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  )
}

describe("Anatomy", () => {
  it("an item with the value 0 opens (radix#2937)", async () => {
    render(
      <Accordion.Root>
        <Accordion.Item value="0">
          <Accordion.Header>
            <Accordion.Trigger>Zero</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content>Body</Accordion.Content>
        </Accordion.Item>
      </Accordion.Root>,
    )
    await click(trigger("Zero"))
    expect(expanded("Zero")).toBe(true)
  })

  it.skipIf(!hasBeforeMatch)(
    "find-in-page opens a closed item, closes the other in single mode",
    async () => {
      const onValueChange = vi.fn()
      render(<Faq defaultValue={["shipping"]} onValueChange={onValueChange} />)
      const c = contentOf("Returns")
      await waitFor(() => expect(c.getAttribute("hidden")).toBe("until-found"))
      c.dispatchEvent(new Event("beforematch", { bubbles: true }))
      await waitFor(() => expect(expanded("Returns")).toBe(true))
      expect(onValueChange).toHaveBeenCalledTimes(1)
      expect(onValueChange.mock.calls[0]?.[0]).toEqual(["returns"])
      expect(onValueChange.mock.calls[0]?.[1].event.reason).toBe("find-in-page")
      expect(expanded("Shipping")).toBe(false)
    },
  )

  it("size custom properties are defined on every content", () => {
    render(<Faq defaultValue={["returns"]} />)
    expect(contentOf("Shipping").style.getPropertyValue(HEIGHT)).toBe("0px")
    expect(contentOf("Returns").style.getPropertyValue(HEIGHT)).toBe("auto")
    expect(contentOf("Shipping").style.getPropertyValue("--rind-accordion-content-width")).not.toBe(
      "",
    )
  })
})

describe("Heading structure", () => {
  it("headingLevel={2} gives h2 headers containing only their trigger", () => {
    render(<Faq headingLevel={2} />)
    const headers = document.querySelectorAll("[data-part=header]")
    expect(headers).toHaveLength(3)
    for (const h of headers) {
      expect(h.tagName).toBe("H2")
      expect(Array.from(h.children).map((c) => c.getAttribute("data-part"))).toEqual(["trigger"])
    }
  })

  it("inside Heading.Level 4 headers are h4; headingLevel overrides", () => {
    const { rerender } = render(
      <Heading.Level level={4}>
        <Faq />
      </Heading.Level>,
    )
    expect(
      Array.from(document.querySelectorAll("[data-part=header]")).map((h) => h.tagName),
    ).toEqual(["H4", "H4", "H4"])
    rerender(
      <Heading.Level level={4}>
        <Faq headingLevel={2} />
      </Heading.Level>,
    )
    expect(
      Array.from(document.querySelectorAll("[data-part=header]")).map((h) => h.tagName),
    ).toEqual(["H2", "H2", "H2"])
  })

  it("a Heading without level in an open panel is h4 by default", () => {
    render(
      <Accordion.Root defaultValue={["a"]}>
        <Accordion.Item value="a">
          <Accordion.Header>
            <Accordion.Trigger>First</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content>
            <Heading>Inner</Heading>
          </Accordion.Content>
        </Accordion.Item>
      </Accordion.Root>,
    )
    expect(screen.getByRole("heading", { name: "Inner" }).tagName).toBe("H4")
  })

  it("a header rendered as a div has role heading and aria-level 3", () => {
    render(
      <Accordion.Root>
        <Accordion.Item value="a">
          <Accordion.Header render={<div />}>
            <Accordion.Trigger>First</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content>Body</Accordion.Content>
        </Accordion.Item>
      </Accordion.Root>,
    )
    const h = document.querySelector("[data-part=header]") as HTMLElement
    expect(h.tagName).toBe("DIV")
    expect(h.getAttribute("role")).toBe("heading")
    expect(h.getAttribute("aria-level")).toBe("3")
  })

  it("an extra element in the header warns, naming the item (base-ui#3632)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    render(
      <Accordion.Root>
        <Accordion.Item value="shipping">
          <Accordion.Header>
            <Accordion.Trigger>Shipping</Accordion.Trigger>
            <button type="button">Edit</button>
          </Accordion.Header>
          <Accordion.Content>Body</Accordion.Content>
        </Accordion.Item>
      </Accordion.Root>,
    )
    expect(warn.mock.calls.some((c) => String(c[0]).includes('"shipping"'))).toBe(true)
  })
})

describe("Panel region rule", () => {
  it("single mode with ten items: the open panel is a region named by its trigger", () => {
    render(<Many n={10} defaultValue={["i3"]} />)
    const region = screen.getByRole("region", { name: "Item 3" })
    expect(region.id).toBe(trigger("Item 3").getAttribute("aria-controls"))
    expect(screen.getAllByRole("region")).toHaveLength(1)
  })

  it("multiple with eight items: no region", () => {
    render(<Many n={8} multiple defaultValue={["i1", "i2"]} />)
    expect(screen.queryAllByRole("region")).toEqual([])
    expect(contentOf("Item 1").hasAttribute("role")).toBe(false)
  })

  it("a closed panel has no role, no aria-labelledby, no aria-hidden", () => {
    render(<Faq defaultValue={["shipping"]} />)
    const closed = contentOf("Returns")
    expect(closed.hasAttribute("hidden")).toBe(true)
    expect(closed.hasAttribute("role")).toBe(false)
    expect(closed.hasAttribute("aria-labelledby")).toBe(false)
    expect(closed.hasAttribute("aria-hidden")).toBe(false)
  })

  it("a consumer trigger id names the region (base-ui#1531)", () => {
    render(
      <Accordion.Root defaultValue={["s"]}>
        <Accordion.Item value="s">
          <Accordion.Header>
            <Accordion.Trigger id="faq-shipping">Shipping</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content>Body</Accordion.Content>
        </Accordion.Item>
      </Accordion.Root>,
    )
    expect(trigger("Shipping").id).toBe("faq-shipping")
    expect(contentOf("Shipping").getAttribute("aria-labelledby")).toBe("faq-shipping")
  })
})

describe("Value modes", () => {
  it("switching in single mode reports [b]", async () => {
    const onValueChange = vi.fn()
    render(<Faq defaultValue={["shipping"]} onValueChange={onValueChange} />)
    await click(trigger("Returns"))
    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(onValueChange.mock.calls[0]?.[0]).toEqual(["returns"])
    expect(open()).toEqual(["Returns"])
  })

  it("closing in multiple mode reports the remaining item (ark#1656)", async () => {
    const onValueChange = vi.fn()
    render(<Faq multiple defaultValue={["shipping", "returns"]} onValueChange={onValueChange} />)
    await click(trigger("Shipping"))
    expect(onValueChange.mock.calls.at(-1)?.[0]).toEqual(["returns"])
    expect(open()).toEqual(["Returns"])
  })

  it("non-collapsible: pressing the open trigger does not call onValueChange", async () => {
    const onValueChange = vi.fn()
    render(<Faq collapsible={false} defaultValue={["shipping"]} onValueChange={onValueChange} />)
    await click(trigger("Shipping"))
    expect(onValueChange).not.toHaveBeenCalled()
    expect(open()).toEqual(["Shipping"])
  })

  it("controlled value to undefined warns and stays controlled; [] closes all", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const ctl = (value: readonly string[] | undefined) => ({ value }) as unknown as RootProps
    const { rerender } = render(<Faq {...ctl(["shipping"])} />)
    expect(open()).toEqual(["Shipping"])
    rerender(<Faq {...ctl(undefined)} />)
    expect(warn.mock.calls.some((c) => /controlled/i.test(String(c[0])))).toBe(true)
    expect(open()).toEqual(["Shipping"])
    rerender(<Faq {...ctl([])} />)
    expect(open()).toEqual([])
  })
})

describe("Locked and disabled items", () => {
  it("the locked open trigger is reachable with Tab and has aria-disabled", async () => {
    render(
      <>
        <button type="button">before</button>
        <Faq collapsible={false} defaultValue={["shipping"]} />
      </>,
    )
    expect(trigger("Shipping").getAttribute("aria-disabled")).toBe("true")
    expect(trigger("Shipping").hasAttribute("data-disabled")).toBe(true)
    await userEvent.setup().tab()
    await userEvent.setup().tab()
    expect(document.activeElement).toBe(trigger("Shipping"))
  })

  it("a disabled item has native disabled and no aria-disabled (zag#3137)", () => {
    render(
      <Accordion.Root>
        <Accordion.Item value="a" disabled>
          <Accordion.Header>
            <Accordion.Trigger>A</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content>Body</Accordion.Content>
        </Accordion.Item>
      </Accordion.Root>,
    )
    expect(trigger("A").hasAttribute("disabled")).toBe(true)
    expect(trigger("A").hasAttribute("aria-disabled")).toBe(false)
  })

  it("focusableWhenDisabled: aria-disabled, focusable, ignores presses", async () => {
    render(
      <Accordion.Root focusableWhenDisabled>
        <Accordion.Item value="a" disabled>
          <Accordion.Header>
            <Accordion.Trigger>A</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content>Body</Accordion.Content>
        </Accordion.Item>
      </Accordion.Root>,
    )
    expect(trigger("A").getAttribute("aria-disabled")).toBe("true")
    expect(trigger("A").hasAttribute("disabled")).toBe(false)
    await userEvent.setup().tab()
    expect(document.activeElement).toBe(trigger("A"))
    await click(trigger("A"))
    expect(expanded("A")).toBe(false)
  })

  it("a runtime disabled change ignores the next press (bits-ui#654)", async () => {
    const Dyn = ({ disabled }: { disabled: boolean }) => (
      <Accordion.Root>
        <Accordion.Item value="a" disabled={disabled}>
          <Accordion.Header>
            <Accordion.Trigger>A</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content>Body</Accordion.Content>
        </Accordion.Item>
      </Accordion.Root>
    )
    const { rerender } = render(<Dyn disabled={false} />)
    rerender(<Dyn disabled />)
    fireEvent.click(trigger("A"))
    await click(trigger("A"))
    expect(expanded("A")).toBe(false)
  })
})

describe("Keyboard", () => {
  it("Enter and Space toggle", async () => {
    render(<Faq />)
    const user = userEvent.setup()
    act(() => trigger("Shipping").focus())
    await user.keyboard("{Enter}")
    expect(open()).toEqual(["Shipping"])
    await user.keyboard(" ")
    expect(open()).toEqual([])
  })

  it("a held key toggles once", async () => {
    const onValueChange = vi.fn()
    render(<Faq onValueChange={onValueChange} />)
    const t = trigger("Shipping")
    act(() => t.focus())
    fireEvent.keyDown(t, { key: "Enter", code: "Enter" })
    fireEvent.keyDown(t, { key: "Enter", code: "Enter", repeat: true })
    fireEvent.keyDown(t, { key: "Enter", code: "Enter", repeat: true })
    fireEvent.keyUp(t, { key: "Enter", code: "Enter" })
    expect(onValueChange).toHaveBeenCalledTimes(1)
  })

  it("a bare click with detail 0 toggles once", () => {
    const onValueChange = vi.fn()
    render(<Faq onValueChange={onValueChange} />)
    fireEvent.click(trigger("Shipping"), { detail: 0 })
    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(open()).toEqual(["Shipping"])
  })

  it("arrows do nothing by default and are not prevented", async () => {
    render(<Faq />)
    const prevented: boolean[] = []
    const listen = (e: KeyboardEvent) => prevented.push(e.defaultPrevented)
    document.addEventListener("keydown", listen)
    const user = userEvent.setup()
    act(() => trigger("Shipping").focus())
    await user.keyboard("{ArrowDown}{ArrowUp}{Home}{End}")
    document.removeEventListener("keydown", listen)
    expect(document.activeElement).toBe(trigger("Shipping"))
    expect(open()).toEqual([])
    expect(prevented).toEqual([false, false, false, false])
  })

  describe("keyboardNavigation", () => {
    it("vertical: ArrowDown and ArrowUp wrap; Home and End jump", async () => {
      render(<Faq keyboardNavigation />)
      const user = userEvent.setup()
      act(() => trigger("Shipping").focus())
      await user.keyboard("{ArrowUp}")
      expect(document.activeElement).toBe(trigger("Payment"))
      await user.keyboard("{ArrowDown}")
      expect(document.activeElement).toBe(trigger("Shipping"))
      await user.keyboard("{End}")
      expect(document.activeElement).toBe(trigger("Payment"))
      await user.keyboard("{Home}")
      expect(document.activeElement).toBe(trigger("Shipping"))
    })

    it("skips disabled items but not the locked one", async () => {
      render(
        <Accordion.Root keyboardNavigation collapsible={false} defaultValue={["shipping"]}>
          {[
            ["shipping", "Shipping", false],
            ["returns", "Returns", true],
            ["payment", "Payment", false],
          ].map(([v, l, d]) => (
            <Accordion.Item key={String(v)} value={String(v)} disabled={Boolean(d)}>
              <Accordion.Header>
                <Accordion.Trigger>{String(l)}</Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Content>x</Accordion.Content>
            </Accordion.Item>
          ))}
        </Accordion.Root>,
      )
      const user = userEvent.setup()
      act(() => trigger("Shipping").focus())
      await user.keyboard("{ArrowDown}")
      expect(document.activeElement).toBe(trigger("Payment"))
      await user.keyboard("{ArrowUp}")
      expect(document.activeElement).toBe(trigger("Shipping"))
    })

    it("horizontal under dir=rtl: ArrowLeft moves to the next trigger", async () => {
      render(<Faq keyboardNavigation orientation="horizontal" dir="rtl" />)
      act(() => trigger("Shipping").focus())
      await userEvent.setup().keyboard("{ArrowLeft}")
      expect(document.activeElement).toBe(trigger("Returns"))
    })

    it("keys in an input inside an open panel are untouched (reka-ui#1504, react-spectrum#5745)", async () => {
      render(
        <Accordion.Root keyboardNavigation defaultValue={["a"]}>
          {["a", "b"].map((v) => (
            <Accordion.Item key={v} value={v}>
              <Accordion.Header>
                <Accordion.Trigger>{`T ${v}`}</Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Content>
                <input aria-label={`field ${v}`} />
              </Accordion.Content>
            </Accordion.Item>
          ))}
        </Accordion.Root>,
      )
      const input = screen.getByLabelText("field a") as HTMLInputElement
      const user = userEvent.setup()
      await click(input)
      await user.keyboard("ab{ArrowDown}{Home} c{End}d")
      expect(input.value).toBe(" cabd")
      expect(document.activeElement).toBe(input)
      expect(open()).toEqual(["T a"])
    })

    it("navigation reaches a trigger whose content was unmounted (ark#3732)", async () => {
      render(<Faq keyboardNavigation closedContent="unmount" />)
      const user = userEvent.setup()
      await click(trigger("Returns"))
      expect(expanded("Returns")).toBe(true)
      await click(trigger("Returns"))
      await waitFor(() => expect(screen.queryByText("Returns text")).toBeNull())
      act(() => trigger("Shipping").focus())
      await user.keyboard("{ArrowDown}")
      expect(document.activeElement).toBe(trigger("Returns"))
    })
  })
})

describe("Pointer interaction inside panels", () => {
  it.skipIf(inJsdom)(
    "an input in an open panel focuses on the first click (kobalte#440)",
    async () => {
      render(
        <Accordion.Root defaultValue={["a"]}>
          <Accordion.Item value="a">
            <Accordion.Header>
              <Accordion.Trigger>A</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Content>
              <input aria-label="note" />
            </Accordion.Content>
          </Accordion.Item>
        </Accordion.Root>,
      )
      await click(screen.getByLabelText("note"))
      expect(document.activeElement).toBe(screen.getByLabelText("note"))
    },
  )
})

describe("Simultaneous transitions", () => {
  it.skipIf(inJsdom)("switching animates both items (base-ui#3099)", async () => {
    const style = document.createElement("style")
    style.textContent = `[data-scope=accordion][data-part=content]{overflow:hidden;height:var(${HEIGHT});transition:height 200ms}`
    document.head.append(style)
    try {
      render(<Faq defaultValue={["shipping"]} />)
      const a = contentOf("Shipping")
      const b = contentOf("Returns")
      await click(trigger("Returns"))
      expect(a.isConnected).toBe(true)
      expect(a.hasAttribute("hidden")).toBe(false)
      expect(a.getAttribute("data-state")).toBe("closed")
      expect(b.hasAttribute("hidden")).toBe(false)
      expect(a.getAnimations().length).toBeGreaterThan(0)
      expect(b.getAnimations().length).toBeGreaterThan(0)
      await waitFor(() => expect(a.hasAttribute("hidden")).toBe(true), { timeout: 3000 })
      expect(b.hasAttribute("hidden")).toBe(false)
    } finally {
      style.remove()
    }
  })
})
