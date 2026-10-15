import { domEnvironment } from "@rind-ui/core"
import { Collapsible } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { getCollapsible } from "../index"

const platform = domEnvironment().platform

describe("Collapsible smoke", () => {
  it("toggles, keeps until-found content with aria-controls, sizes defined", async () => {
    render(
      <Collapsible.Root>
        <Collapsible.Trigger>Details</Collapsible.Trigger>
        <Collapsible.Content>Body text</Collapsible.Content>
      </Collapsible.Root>,
    )
    const c = getCollapsible(screen, { name: "Details" }, { platform })
    expect(await c.isOpen()).toBe(false)
    const trigger = screen.getByRole("button", { name: "Details" })
    expect(trigger.getAttribute("aria-controls")).toBeTruthy()
    const content = document.getElementById(trigger.getAttribute("aria-controls") ?? "")
    expect(content?.hasAttribute("hidden")).toBe(true)
    expect(content?.style.getPropertyValue("--rind-collapsible-content-height")).toBe("0px")
    await c.open()
    expect(await c.isOpen()).toBe(true)
    expect(content?.hasAttribute("hidden")).toBe(false)
    await c.via("keyboard").toggle()
    expect(await c.isOpen()).toBe(false)
  })

  it("unmount mode: no aria-controls while closed", async () => {
    render(
      <Collapsible.Root closedContent="unmount">
        <Collapsible.Trigger>More</Collapsible.Trigger>
        <Collapsible.Content>Hidden</Collapsible.Content>
      </Collapsible.Root>,
    )
    const trigger = screen.getByRole("button", { name: "More" })
    expect(trigger.hasAttribute("aria-controls")).toBe(false)
    await getCollapsible(screen, { name: "More" }, { platform }).open()
    expect(trigger.getAttribute("aria-controls")).toBeTruthy()
  })
})

// ---- Spec scenarios (tasks 6.2 - 6.4) ----
import { act, fireEvent, waitFor } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { Activity, type ReactNode, useState } from "react"
import { afterEach, vi } from "vitest"

const inJsdom = navigator.userAgent.includes("jsdom")
const hasBeforeMatch = "onbeforematch" in document.body
const HEIGHT = "--rind-collapsible-content-height"
const WIDTH = "--rind-collapsible-content-width"
const opts = { platform }
const drv = (name: string) => getCollapsible(screen, { name }, opts)
const trigger = (name: string) => screen.getByRole("button", { name })
const contentOf = (name: string) =>
  document.getElementById(trigger(name).getAttribute("aria-controls") ?? "") as HTMLElement
const animated = {
  height: `var(${HEIGHT})`,
  overflow: "hidden",
  transition: "height 300ms linear",
} as const

afterEach(() => vi.restoreAllMocks())

/** A controlled collapsible whose setter escapes, so the test can drive it as a parent. */
let setOpenExternally: (open: boolean) => void = () => {}
function Controlled({
  refuse = false,
  onOpenChange,
  children,
  ...rest
}: {
  refuse?: boolean
  onOpenChange?: (open: boolean, details: { event: { type: string; reason?: string } }) => void
  children?: ReactNode
  closedContent?: "until-found" | "hidden" | "unmount"
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(rest.defaultOpen ?? false)
  setOpenExternally = setOpen
  return (
    <Collapsible.Root
      open={open}
      closedContent={rest.closedContent ?? "until-found"}
      onOpenChange={(o, d) => {
        onOpenChange?.(o, d as never)
        if (!refuse) setOpen(o)
      }}
    >
      <Collapsible.Trigger>Details</Collapsible.Trigger>
      <Collapsible.Content>{children ?? "Body text"}</Collapsible.Content>
    </Collapsible.Root>
  )
}

describe("Trigger rendered as a span", () => {
  it("has role/tabindex and toggles with pointer, Enter, Space and a bare click", async () => {
    render(
      <Collapsible.Root>
        <Collapsible.Trigger render={<span />}>Details</Collapsible.Trigger>
        <Collapsible.Content>Body</Collapsible.Content>
      </Collapsible.Root>,
    )
    const t = trigger("Details")
    expect(t.tagName).toBe("SPAN")
    expect(t.getAttribute("role")).toBe("button")
    expect(t.tabIndex).toBe(0)
    const c = drv("Details")
    await c.open()
    expect(await c.isOpen()).toBe(true)
    await c.via("keyboard").toggle()
    expect(await c.isOpen()).toBe(false)
    act(() => t.focus())
    const user = userEvent.setup()
    await user.keyboard(" ")
    expect(await c.isOpen()).toBe(true)
    await user.keyboard("{Enter}")
    expect(await c.isOpen()).toBe(false)
    fireEvent.click(t, { detail: 0 })
    expect(await c.isOpen()).toBe(true)
  })
})

describe("Activation", () => {
  it("a bare click (detail 0) toggles exactly once (kobalte#119)", async () => {
    const onOpenChange = vi.fn()
    render(
      <Collapsible.Root onOpenChange={onOpenChange}>
        <Collapsible.Trigger>Details</Collapsible.Trigger>
        <Collapsible.Content>Body</Collapsible.Content>
      </Collapsible.Root>,
    )
    fireEvent.click(trigger("Details"), { detail: 0 })
    expect(onOpenChange).toHaveBeenCalledTimes(1)
    expect(trigger("Details").getAttribute("aria-expanded")).toBe("true")
  })

  it("a held Enter toggles once", async () => {
    const onOpenChange = vi.fn()
    render(
      <Collapsible.Root onOpenChange={onOpenChange}>
        <Collapsible.Trigger>Details</Collapsible.Trigger>
        <Collapsible.Content>Body</Collapsible.Content>
      </Collapsible.Root>,
    )
    const t = trigger("Details")
    act(() => t.focus())
    fireEvent.keyDown(t, { key: "Enter" })
    fireEvent.keyDown(t, { key: "Enter", repeat: true })
    fireEvent.keyDown(t, { key: "Enter", repeat: true })
    fireEvent.keyUp(t, { key: "Enter" })
    await waitFor(() => expect(onOpenChange).toHaveBeenCalled())
    expect(onOpenChange).toHaveBeenCalledTimes(1)
  })
})

describe("Disclosure semantics", () => {
  it("until-found: aria-controls references the hidden content, which has no aria-hidden", () => {
    render(
      <Collapsible.Root>
        <Collapsible.Trigger>Details</Collapsible.Trigger>
        <Collapsible.Content>Body</Collapsible.Content>
        <Collapsible.Indicator />
      </Collapsible.Root>,
    )
    const c = contentOf("Details")
    expect(c).toBeTruthy()
    expect(c.hasAttribute("hidden")).toBe(true)
    expect(c.hasAttribute("aria-hidden")).toBe(false)
    expect(document.querySelector('[data-part="indicator"]')?.getAttribute("aria-hidden")).toBe(
      "true",
    )
  })

  it.skipIf(inJsdom)(
    "aria-expanded is false at the closing step, during the exit animation",
    async () => {
      render(
        <Collapsible.Root defaultOpen>
          <Collapsible.Trigger>Details</Collapsible.Trigger>
          <Collapsible.Content style={animated}>Body</Collapsible.Content>
        </Collapsible.Root>,
      )
      const c = contentOf("Details")
      await drv("Details").close()
      expect(trigger("Details").getAttribute("aria-expanded")).toBe("false")
      expect(c.isConnected).toBe(true)
      expect(c.getAttribute("data-state")).toBe("closed")
      expect(c.hasAttribute("hidden")).toBe(false)
      expect(c.getAnimations().length).toBeGreaterThan(0)
      await waitFor(() => expect(c.hasAttribute("hidden")).toBe(true), { timeout: 3000 })
    },
  )
})

describe("Disabled", () => {
  it("defaultOpen + disabled is visible and ignores presses", async () => {
    render(
      <Collapsible.Root defaultOpen disabled>
        <Collapsible.Trigger>Details</Collapsible.Trigger>
        <Collapsible.Content>Body</Collapsible.Content>
      </Collapsible.Root>,
    )
    expect(contentOf("Details").hasAttribute("hidden")).toBe(false)
    fireEvent.click(trigger("Details"), { detail: 0 })
    await userEvent.setup().click(trigger("Details"))
    expect(trigger("Details").getAttribute("aria-expanded")).toBe("true")
    expect(contentOf("Details").hasAttribute("hidden")).toBe(false)
  })

  it("disabled and closed: plain hidden, not until-found; flipping disabled degrades it", () => {
    const tree = (disabled: boolean) => (
      <Collapsible.Root disabled={disabled}>
        <Collapsible.Trigger>Details</Collapsible.Trigger>
        <Collapsible.Content>Body</Collapsible.Content>
      </Collapsible.Root>
    )
    const { rerender } = render(tree(true))
    expect(contentOf("Details").getAttribute("hidden")).toBe("")
    rerender(tree(false))
    expect(contentOf("Details").hasAttribute("hidden")).toBe(true)
    rerender(tree(true))
    expect(contentOf("Details").getAttribute("hidden")).toBe("")
  })

  it("disabling does not reveal (react-spectrum#9004)", () => {
    const tree = (disabled: boolean) => (
      <Collapsible.Root disabled={disabled}>
        <Collapsible.Trigger>Details</Collapsible.Trigger>
        <Collapsible.Content>Body</Collapsible.Content>
      </Collapsible.Root>
    )
    const { rerender } = render(tree(true))
    rerender(tree(false))
    expect(contentOf("Details").hasAttribute("hidden")).toBe(true)
    expect(trigger("Details").getAttribute("aria-expanded")).toBe("false")
  })

  it("a controlled parent can still open a disabled collapsible", () => {
    render(
      <Collapsible.Root open={true} disabled>
        <Collapsible.Trigger>Details</Collapsible.Trigger>
        <Collapsible.Content>Body</Collapsible.Content>
      </Collapsible.Root>,
    )
    expect(trigger("Details").getAttribute("aria-expanded")).toBe("true")
  })
})

describe("Focus on close", () => {
  it("moves focus from inside the content to the trigger", async () => {
    render(
      <Controlled defaultOpen>
        <a href="#x">Inner link</a>
      </Controlled>,
    )
    const link = screen.getByText("Inner link")
    act(() => link.focus())
    expect(document.activeElement).toBe(link)
    act(() => setOpenExternally(false))
    await waitFor(() => expect(document.activeElement).toBe(trigger("Details")))
  })

  it("leaves focus elsewhere alone", async () => {
    render(
      <>
        <input aria-label="other" />
        <Controlled defaultOpen />
      </>,
    )
    const input = screen.getByLabelText("other")
    act(() => input.focus())
    act(() => setOpenExternally(false))
    expect(document.activeElement).toBe(input)
  })
})

describe("Closed content modes", () => {
  it("form submission includes an input in closed content (radix#2808)", () => {
    render(
      <form aria-label="f">
        <Collapsible.Root>
          <Collapsible.Trigger>Details</Collapsible.Trigger>
          <Collapsible.Content>
            <input name="secret" defaultValue="42" />
          </Collapsible.Content>
        </Collapsible.Root>
      </form>,
    )
    const form = screen.getByRole("form") as HTMLFormElement
    expect(new FormData(form).get("secret")).toBe("42")
  })

  it("controlled close with no animation is hidden after the update (base-ui#4553)", () => {
    render(<Controlled defaultOpen closedContent="hidden" />)
    const c = contentOf("Details")
    expect(c.hasAttribute("hidden")).toBe(false)
    act(() => setOpenExternally(false))
    expect(c.hasAttribute("hidden")).toBe(true)
  })

  it("hidden mode: never visible when closed after exit (open, close cycle)", async () => {
    render(
      <Collapsible.Root closedContent="hidden">
        <Collapsible.Trigger>Details</Collapsible.Trigger>
        <Collapsible.Content style={animated}>Body</Collapsible.Content>
      </Collapsible.Root>,
    )
    const c = contentOf("Details")
    expect(c.getAttribute("hidden")).toBe("")
    await drv("Details").open()
    await drv("Details").close()
    await waitFor(() => expect(c.getAttribute("hidden")).toBe(""), { timeout: 3000 })
    expect(c.isConnected).toBe(true)
  })

  it("unmount: content is removed when closed; aria-controls follows", async () => {
    render(
      <Collapsible.Root closedContent="unmount" defaultOpen>
        <Collapsible.Trigger>Details</Collapsible.Trigger>
        <Collapsible.Content>Body</Collapsible.Content>
      </Collapsible.Root>,
    )
    expect(trigger("Details").getAttribute("aria-controls")).toBeTruthy()
    await drv("Details").close()
    await waitFor(() => expect(screen.queryByText("Body")).toBeNull())
    expect(trigger("Details").hasAttribute("aria-controls")).toBe(false)
  })

  it.skipIf(inJsdom)(
    "unmount: stays with data-state=closed until the transition ends",
    async () => {
      render(
        <Collapsible.Root closedContent="unmount" defaultOpen>
          <Collapsible.Trigger>Details</Collapsible.Trigger>
          <Collapsible.Content style={animated}>Body</Collapsible.Content>
        </Collapsible.Root>,
      )
      const c = contentOf("Details")
      await drv("Details").close()
      expect(c.isConnected).toBe(true)
      expect(c.getAttribute("data-state")).toBe("closed")
      await waitFor(() => expect(c.isConnected).toBe(false), { timeout: 3000 })
    },
  )
})

describe("Open state", () => {
  it("controlled refusal leaves the content closed and hidden", async () => {
    render(<Controlled refuse />)
    await drv("Details")
      .open()
      .catch(() => {})
    fireEvent.click(trigger("Details"), { detail: 0 })
    expect(trigger("Details").getAttribute("aria-expanded")).toBe("false")
    expect(contentOf("Details").hasAttribute("hidden")).toBe(true)
  })

  it("a parent-driven change does not call onOpenChange", () => {
    const onOpenChange = vi.fn()
    render(<Controlled onOpenChange={onOpenChange} />)
    act(() => setOpenExternally(true))
    expect(trigger("Details").getAttribute("aria-expanded")).toBe("true")
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it("uncontrolled: onOpenChange gets a TOGGLE event", async () => {
    const onOpenChange = vi.fn()
    render(
      <Collapsible.Root onOpenChange={onOpenChange}>
        <Collapsible.Trigger>Details</Collapsible.Trigger>
        <Collapsible.Content>Body</Collapsible.Content>
      </Collapsible.Root>,
    )
    await drv("Details").open()
    expect(onOpenChange).toHaveBeenCalledTimes(1)
    const [open, details] = onOpenChange.mock.calls[0] ?? []
    expect(open).toBe(true)
    expect(details.event.type).toBe("TOGGLE")
  })

  it("attributes agree: open and disabled", () => {
    render(
      <Collapsible.Root defaultOpen disabled>
        <Collapsible.Trigger>Details</Collapsible.Trigger>
        <Collapsible.Content>Body</Collapsible.Content>
        <Collapsible.Indicator />
      </Collapsible.Root>,
    )
    for (const part of ["root", "trigger", "content", "indicator"]) {
      const el = document.querySelector(`[data-part="${part}"]`)
      expect(el?.getAttribute("data-state"), part).toBe("open")
      expect(el?.hasAttribute("data-disabled"), part).toBe(true)
    }
  })
})

describe("Size custom properties", () => {
  it("always defined: 0px closed (both axes), auto when defaultOpen", () => {
    render(
      <>
        <Collapsible.Root>
          <Collapsible.Trigger>Closed</Collapsible.Trigger>
          <Collapsible.Content>Body</Collapsible.Content>
        </Collapsible.Root>
        <Collapsible.Root defaultOpen>
          <Collapsible.Trigger>Open</Collapsible.Trigger>
          <Collapsible.Content>Body</Collapsible.Content>
        </Collapsible.Root>
      </>,
    )
    const closed = contentOf("Closed")
    expect(closed.style.getPropertyValue(HEIGHT)).toBe("0px")
    expect(closed.style.getPropertyValue(WIDTH)).toBe("0px")
    const open = contentOf("Open")
    expect(open.style.getPropertyValue(HEIGHT)).toBe("auto")
    expect(open.style.getPropertyValue(WIDTH)).toBe("auto")
  })

  it("nested open content defines its own variables (radix#3037)", () => {
    render(
      <Collapsible.Root defaultOpen>
        <Collapsible.Trigger>Outer</Collapsible.Trigger>
        <Collapsible.Content>
          <Collapsible.Root defaultOpen>
            <Collapsible.Trigger>Inner</Collapsible.Trigger>
            <Collapsible.Content />
          </Collapsible.Root>
        </Collapsible.Content>
      </Collapsible.Root>,
    )
    expect(contentOf("Inner").style.getPropertyValue(HEIGHT)).toBe("auto")
  })

  it.skipIf(inJsdom)("defaultOpen runs no transition (zag#1396)", () => {
    render(
      <Collapsible.Root defaultOpen>
        <Collapsible.Trigger>Details</Collapsible.Trigger>
        <Collapsible.Content style={animated}>Body</Collapsible.Content>
      </Collapsible.Root>,
    )
    const c = contentOf("Details")
    expect(c.getAnimations()).toEqual([])
    expect(c.style.getPropertyValue(HEIGHT)).toBe("auto")
  })

  it.skipIf(inJsdom)(
    "first open in unmount mode goes 0px to px and transitions (radix#1265)",
    async () => {
      render(
        <Collapsible.Root closedContent="unmount">
          <Collapsible.Trigger>Details</Collapsible.Trigger>
          <Collapsible.Content style={animated}>
            <div style={{ height: 120 }}>tall</div>
          </Collapsible.Content>
        </Collapsible.Root>,
      )
      await drv("Details").open()
      const c = contentOf("Details")
      expect(c.style.getPropertyValue(HEIGHT)).toBe("120px")
      expect(c.getAnimations().length).toBeGreaterThan(0)
      await waitFor(() => expect(c.style.getPropertyValue(HEIGHT)).toBe("auto"), { timeout: 3000 })
    },
  )

  it.skipIf(inJsdom)(
    "flex content with centered alignment measures its natural height (radix#2832)",
    async () => {
      render(
        <Collapsible.Root closedContent="unmount">
          <Collapsible.Trigger>Details</Collapsible.Trigger>
          <Collapsible.Content
            style={{ ...animated, display: "flex", justifyContent: "center", alignItems: "center" }}
          >
            <div style={{ height: 80 }}>x</div>
          </Collapsible.Content>
        </Collapsible.Root>,
      )
      await drv("Details").open()
      expect(contentOf("Details").style.getPropertyValue(HEIGHT)).toBe("80px")
    },
  )
})

describe("Mount and re-insertion do not replay", () => {
  it.skipIf(inJsdom)("reordering open collapsibles runs no transition (zag#2138)", async () => {
    function List({ order }: { order: string[] }) {
      return (
        <div>
          {order.map((k) => (
            <Collapsible.Root key={k}>
              <Collapsible.Trigger>{k}</Collapsible.Trigger>
              <Collapsible.Content style={animated}>
                <div style={{ height: 50 }}>{k} body</div>
              </Collapsible.Content>
            </Collapsible.Root>
          ))}
        </div>
      )
    }
    const { rerender } = render(<List order={["a", "b"]} />)
    for (const k of ["a", "b"]) {
      await drv(k).open()
      await drv(k).close()
      await waitFor(() => expect(contentOf(k).hasAttribute("hidden")).toBe(true), { timeout: 3000 })
      await drv(k).open()
      // Settled before the next trigger is pressed: a growing sibling would move it.
      await waitFor(() => expect(contentOf(k).style.getPropertyValue(HEIGHT)).toBe("auto"), {
        timeout: 3000,
      })
    }
    await waitFor(() => expect(contentOf("a").style.getPropertyValue(HEIGHT)).toBe("auto"), {
      timeout: 3000,
    })
    await waitFor(() => expect(contentOf("b").style.getPropertyValue(HEIGHT)).toBe("auto"), {
      timeout: 3000,
    })
    rerender(<List order={["b", "a"]} />)
    for (const k of ["a", "b"]) expect(contentOf(k).getAnimations()).toEqual([])
  })

  it.skipIf(inJsdom)(
    "Activity hide and show runs no transition; data-state stays open (radix#3778)",
    async () => {
      function Host({ mode }: { mode: "visible" | "hidden" }) {
        return (
          <Activity mode={mode}>
            <Collapsible.Root defaultOpen>
              <Collapsible.Trigger>Details</Collapsible.Trigger>
              <Collapsible.Content style={animated}>
                <div style={{ height: 50 }}>Body</div>
              </Collapsible.Content>
            </Collapsible.Root>
          </Activity>
        )
      }
      const { rerender } = render(<Host mode="visible" />)
      const c = contentOf("Details")
      rerender(<Host mode="hidden" />)
      rerender(<Host mode="visible" />)
      expect(c.getAnimations()).toEqual([])
      expect(c.getAttribute("data-state")).toBe("open")
    },
  )

  it("data-reveal=mount when initially open, dropped after the first close", async () => {
    render(
      <Collapsible.Root defaultOpen>
        <Collapsible.Trigger>Details</Collapsible.Trigger>
        <Collapsible.Content>Body</Collapsible.Content>
      </Collapsible.Root>,
    )
    const c = contentOf("Details")
    expect(c.getAttribute("data-state")).toBe("open")
    expect(c.getAttribute("data-reveal")).toBe("mount")
    await drv("Details").close()
    expect(c.getAttribute("data-state")).toBe("closed")
    expect(c.hasAttribute("data-reveal")).toBe(false)
  })
})

describe("Find-in-page", () => {
  it.skipIf(!hasBeforeMatch)(
    "beforematch opens, immediately, with reason find-in-page",
    async () => {
      const onOpenChange = vi.fn()
      render(
        <Collapsible.Root onOpenChange={onOpenChange}>
          <Collapsible.Trigger>Details</Collapsible.Trigger>
          <Collapsible.Content style={animated}>
            <div style={{ height: 90 }}>needle</div>
          </Collapsible.Content>
        </Collapsible.Root>,
      )
      const c = contentOf("Details")
      await waitFor(() => expect(c.getAttribute("hidden")).toBe("until-found"))
      // Same task: no await between the event and the assertions.
      c.dispatchEvent(new Event("beforematch", { bubbles: true }))
      expect(c.style.getPropertyValue(HEIGHT)).toBe("auto")
      await waitFor(() => expect(trigger("Details").getAttribute("aria-expanded")).toBe("true"))
      expect(onOpenChange.mock.calls[0]?.[1].event.reason).toBe("find-in-page")
      expect(c.getAttribute("data-reveal")).toBe("find-in-page")
      expect(c.hasAttribute("hidden")).toBe(false)
    },
  )

  it.skipIf(!hasBeforeMatch)("beforematch on already-open content stays open", async () => {
    render(
      <Collapsible.Root defaultOpen>
        <Collapsible.Trigger>Details</Collapsible.Trigger>
        <Collapsible.Content>Body</Collapsible.Content>
      </Collapsible.Root>,
    )
    contentOf("Details").dispatchEvent(new Event("beforematch", { bubbles: true }))
    await new Promise((r) => requestAnimationFrame(r))
    expect(trigger("Details").getAttribute("aria-expanded")).toBe("true")
  })

  it.skipIf(!hasBeforeMatch)(
    "a refused reveal restores hidden=until-found after a frame",
    async () => {
      render(<Controlled refuse />)
      const c = contentOf("Details")
      await waitFor(() => expect(c.getAttribute("hidden")).toBe("until-found"))
      c.dispatchEvent(new Event("beforematch", { bubbles: true }))
      await new Promise((r) => requestAnimationFrame(r))
      await new Promise((r) => requestAnimationFrame(r))
      expect(trigger("Details").getAttribute("aria-expanded")).toBe("false")
      expect(c.getAttribute("hidden")).toBe("until-found")
    },
  )

  // Headless automation never focuses the page, and Chromium then fires no beforematch for
  // window.find (verified: find() returns true, event count 0).
  it.skipIf(!hasBeforeMatch || inJsdom || !document.hasFocus())(
    "window.find opens the content end to end",
    async () => {
      render(
        <Collapsible.Root>
          <Collapsible.Trigger>Details</Collapsible.Trigger>
          <Collapsible.Content>zzuniqueneedle</Collapsible.Content>
        </Collapsible.Root>,
      )
      await waitFor(() => expect(contentOf("Details").getAttribute("hidden")).toBe("until-found"))
      // biome-ignore lint/suspicious/noExplicitAny: non-standard but shipped window.find
      ;(window as any).find("zzuniqueneedle")
      await waitFor(() => expect(trigger("Details").getAttribute("aria-expanded")).toBe("true"))
    },
  )

  it.skipIf(inJsdom)(
    "warns when a stylesheet sets [hidden]{display:none} (react-spectrum#7160)",
    async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
      const style = document.createElement("style")
      style.textContent = "[hidden]{display:none !important}"
      document.head.append(style)
      try {
        render(
          <Collapsible.Root>
            <Collapsible.Trigger>Details</Collapsible.Trigger>
            <Collapsible.Content>Body</Collapsible.Content>
          </Collapsible.Root>,
        )
        // Only meaningful where until-found is applied (Chromium); elsewhere hidden="" also
        // computes display none, but the attribute is not "until-found".
        if (!hasBeforeMatch) return
        await waitFor(() => expect(warn).toHaveBeenCalled())
        expect(String(warn.mock.calls[0]?.[0])).toContain("collapsible")
      } finally {
        style.remove()
      }
    },
  )
})

// ponytail: reduced motion not emulated here (needs a page-level emulateMedia); covered by the theme.

describe("review fixes (add-collapsible r1)", () => {
  it("a consumer id on Content is what the trigger's aria-controls references", async () => {
    render(
      <Collapsible.Root>
        <Collapsible.Trigger>Own id</Collapsible.Trigger>
        <Collapsible.Content id="my-panel">Body</Collapsible.Content>
      </Collapsible.Root>,
    )
    const trigger = screen.getByRole("button", { name: "Own id" })
    expect(trigger.getAttribute("aria-controls")).toBe("my-panel")
    expect(document.getElementById("my-panel")?.getAttribute("data-part")).toBe("content")
  })
})
