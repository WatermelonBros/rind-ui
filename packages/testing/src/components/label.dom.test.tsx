import { Label } from "@rind-ui/react"
import { fireEvent, render, screen } from "@testing-library/react"
import axe from "axe-core"
import { afterEach, describe, expect, it, vi } from "vitest"
import { domEnv, getLabel, navigationLog } from "../index"

describe("Label smoke", () => {
  it("for an input: names it, click focuses, double click selects nothing", async () => {
    render(
      <>
        <Label htmlFor="email">Email</Label>
        <input id="email" />
      </>,
    )
    const label = getLabel(screen, { text: "Email" })
    expect(await label.controlName()).toBe("Email")
    await label.click()
    expect(await label.isControlFocused()).toBe(true)
    await label.doubleClick()
    expect(await label.selectedText()).toBe("")
    expect(screen.getByText("Email").hasAttribute("role")).toBe(false)
  })

  it("non-labelable target: focus forwarded, warning, no for", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    render(
      <>
        <Label htmlFor="color">Colour</Label>
        <div id="color" tabIndex={0} role="radiogroup" aria-labelledby="x" />
      </>,
    )
    await vi.waitFor(() => expect(screen.getByText("Colour").hasAttribute("for")).toBe(false))
    expect(warn).toHaveBeenCalledOnce()
    await getLabel(screen, { text: "Colour" }).click()
    expect(document.activeElement?.id).toBe("color")
    warn.mockRestore()
  })
})

// --- openspec label / label-interaction scenarios ---

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}
const warnSpy = () => vi.spyOn(console, "warn").mockImplementation(() => {})
const env = () =>
  domEnv().create({ scope: "label", anchor: { role: "textbox" }, modality: "pointer" })

afterEach(() => {
  vi.restoreAllMocks()
  navigationLog().length = 0
})

describe("Label anatomy and association", () => {
  it("renders a native label with for and the scope attributes", () => {
    render(<Label htmlFor="email">Email</Label>)
    const el = screen.getByText("Email")
    expect(el.tagName).toBe("LABEL")
    expect(el.getAttribute("for")).toBe("email")
    expect(el.getAttribute("data-scope")).toBe("label")
    expect(el.getAttribute("data-part")).toBe("root")
    expect(el.hasAttribute("data-instance")).toBe(true)
    expect(document.querySelector('[data-scope="label"][data-part="root"]')).toBe(el)
  })

  it("names the input from for, and axe finds no violation (radix#638)", async () => {
    render(
      <>
        <Label htmlFor="email">Email</Label>
        <input id="email" />
      </>,
    )
    expect(screen.getByRole("textbox", { name: "Email" })).toBeTruthy()
    expect(await getLabel(screen, { text: "Email" }).controlName()).toBe("Email")
    await a11y()
  })

  it("a wrapping label names and focuses its input (radix#1232)", async () => {
    render(
      <Label>
        Name <input />
      </Label>,
    )
    const label = getLabel(screen, { text: "Name" })
    expect(await label.controlName()).toBe("Name")
    await label.click()
    expect(document.activeElement).toBe(screen.getByRole("textbox"))
    await a11y()
  })

  it("forwards every label attribute and keeps a consumer id", () => {
    render(
      <Label id="mine" htmlFor="x" className="c" data-extra="1">
        T
      </Label>,
    )
    const el = screen.getByText("T")
    expect(el.id).toBe("mine")
    expect(el.className).toBe("c")
    expect(el.getAttribute("data-extra")).toBe("1")
  })

  it("a consumer's aria-labelledby on a custom element names it from the Label id", async () => {
    const { rerender } = render(<Label>Colour</Label>)
    const id = screen.getByText("Colour").id
    expect(id).not.toBe("")
    rerender(
      <>
        <Label>Colour</Label>
        <div role="radiogroup" aria-labelledby={id} />
      </>,
    )
    expect(screen.getByText("Colour").id).toBe(id)
    expect(screen.getByRole("radiogroup", { name: "Colour" })).toBeTruthy()
    expect(await getLabel(screen, { text: "Colour" }).controlName()).toBe("Colour")
  })
})

describe("Label selection guard", () => {
  it("double click selects nothing, on a for label and a wrapping label (radix#2656)", async () => {
    render(
      <>
        <Label htmlFor="a">Alpha</Label>
        <input id="a" />
        <Label>
          Beta <input />
        </Label>
      </>,
    )
    for (const text of ["Alpha", "Beta"]) {
      const label = getLabel(screen, { text })
      await label.doubleClick()
      expect(await label.selectedText()).toBe("")
    }
  })

  it("only a repeated mousedown is cancelled; a single press moves focus away (base-ui#586)", async () => {
    render(
      <>
        <input aria-label="other" />
        <Label>Plain</Label>
      </>,
    )
    const other = screen.getByRole("textbox")
    const seen: boolean[] = []
    const record = (e: Event) => seen.push(e.defaultPrevented)
    document.addEventListener("mousedown", record)
    other.focus()
    await getLabel(screen, { text: "Plain" }).click()
    document.removeEventListener("mousedown", record)
    expect(seen).toEqual([false])
    expect(document.activeElement).not.toBe(other)
  })

  it("a double click's second mousedown is the one cancelled", () => {
    render(<Label>Plain</Label>)
    const label = screen.getByText("Plain")
    expect(fireEvent.mouseDown(label, { detail: 1 })).toBe(true)
    expect(fireEvent.mouseDown(label, { detail: 2 })).toBe(false)
  })

  it("the consumer's preventRindHandler() leaves the double click alone", () => {
    render(
      <Label
        onMouseDown={(e) => (e as unknown as { preventRindHandler(): void }).preventRindHandler()}
      >
        Plain
      </Label>,
    )
    expect(fireEvent.mouseDown(screen.getByText("Plain"), { detail: 2 })).toBe(true)
  })

  it("the consumer's own preventDefault is respected, not repeated", () => {
    const seen: boolean[] = []
    render(
      <Label
        onMouseDown={(e) => {
          e.preventDefault()
          seen.push(e.defaultPrevented)
        }}
      >
        Plain
      </Label>,
    )
    expect(fireEvent.mouseDown(screen.getByText("Plain"), { detail: 2 })).toBe(false)
    expect(seen).toEqual([true])
  })

  it("an interactive descendant keeps its default on a double press (bits-ui#1323)", () => {
    render(
      <Label>
        Name <input />
      </Label>,
    )
    expect(fireEvent.mouseDown(screen.getByRole("textbox"), { detail: 2 })).toBe(true)
  })
})

describe("Label clicks pass through", () => {
  it("a link inside navigates and the checkbox does not toggle (headlessui#3658)", async () => {
    render(
      <Label>
        <input type="checkbox" /> I accept the <a href="/terms">terms</a>
      </Label>,
    )
    const e = env()
    await e.find({ role: "link" }).click()
    expect(navigationLog().map((n) => new URL(n.href).pathname)).toEqual(["/terms"])
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(false)
  })

  it("a descendant's preventDefault stops the activation (radix#609)", async () => {
    render(
      <Label>
        <input type="checkbox" />
        {/* biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/useKeyWithClickEvents: a descendant that cancels the click */}
        <span onClick={(e) => e.preventDefault()}>blocked</span>
        <span>allowed</span>
      </Label>,
    )
    const box = screen.getByRole("checkbox") as HTMLInputElement
    await env().find({ text: "blocked" }).click()
    expect(box.checked).toBe(false)
    await env().find({ text: "allowed" }).click()
    expect(box.checked).toBe(true)
  })

  it("clicks are never cancelled by the label", () => {
    render(
      <Label>
        Plain <input />
      </Label>,
    )
    expect(fireEvent.click(screen.getByText("Plain"), { detail: 1 })).toBe(true)
  })
})

describe("Label with a non-labelable target", () => {
  it("div with tabIndex: focused, warns once naming Label and div, renders without for", async () => {
    const warn = warnSpy()
    render(
      <>
        <Label htmlFor="color">Colour</Label>
        {/* biome-ignore lint/a11y/noNoninteractiveTabindex: a consumer's focusable div, the case under test */}
        <div id="color" tabIndex={0} />
      </>,
    )
    await vi.waitFor(() => expect(screen.getByText("Colour").hasAttribute("for")).toBe(false))
    expect(warn).toHaveBeenCalledOnce()
    const message = String(warn.mock.calls[0]?.[0])
    expect(message).toContain("Colour")
    expect(message).toContain("<div>")
    await getLabel(screen, { text: "Colour" }).click()
    expect(document.activeElement?.id).toBe("color")
  })

  it("a radiogroup div: the label focuses the group and selects nothing", async () => {
    warnSpy()
    render(
      <>
        <Label htmlFor="g">Size</Label>
        <div id="g" role="radiogroup" tabIndex={0} aria-labelledby="size">
          {/* biome-ignore lint/a11y/useSemanticElements: a custom radio inside a custom group */}
          <div role="radio" aria-checked="false" tabIndex={-1}>
            S
          </div>
        </div>
      </>,
    )
    await vi.waitFor(() => expect(screen.getByText("Size").hasAttribute("for")).toBe(false))
    await getLabel(screen, { text: "Size" }).click()
    expect(document.activeElement?.id).toBe("g")
    expect(screen.getByRole("radio").getAttribute("aria-checked")).toBe("false")
  })

  it("a missing id warns once as well, and stays quiet for a labelable target", async () => {
    const warn = warnSpy()
    render(
      <>
        <Label htmlFor="ghost">Ghost</Label>
        <Label htmlFor="ok">Fine</Label>
        <input id="ok" />
      </>,
    )
    await vi.waitFor(() => expect(warn).toHaveBeenCalledOnce())
    expect(String(warn.mock.calls[0]?.[0])).toContain("Ghost")
    expect(screen.getByText("Fine").getAttribute("for")).toBe("ok")
  })
})

describe("Label substituted element", () => {
  it("render={<span />} has no for, focuses its control, and the control's aria-labelledby names it (base-ui#587)", async () => {
    render(
      <>
        <Label id="lbl" htmlFor="c" render={<span />}>
          Colour
        </Label>
        <input id="c" aria-labelledby="lbl" />
      </>,
    )
    const span = screen.getByText("Colour")
    expect(span.tagName).toBe("SPAN")
    expect(span.hasAttribute("for")).toBe(false)
    const label = getLabel(screen, { text: "Colour" })
    expect(await label.controlName()).toBe("Colour")
    await label.click()
    expect(await label.isControlFocused()).toBe(true)
    expect(span.hasAttribute("role")).toBe(false)
    await a11y()
  })
})

describe("driver click forwards a real click (ariakit#7176)", () => {
  it("the click the label forwards to its input carries detail ≥ 1", async () => {
    const seen: { detail: number }[] = []
    render(
      <>
        <Label htmlFor="agree">Agree</Label>
        <input
          id="agree"
          type="checkbox"
          onClick={(e) => seen.push({ detail: e.detail })}
        />
      </>,
    )
    await getLabel(screen, { text: "Agree" }).click()
    expect(seen).toHaveLength(1)
    expect(seen[0]?.detail).toBeGreaterThanOrEqual(1)
  })
})
