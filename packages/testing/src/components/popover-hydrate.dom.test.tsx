// Popover server markup (spec "Open State" with defaultOpen at mount): an inline popover
// with `defaultOpen` renders open with the client's ids, hydration is silent, and the popover
// then behaves (focus inside, Escape closes). StrictMode double effects open and close cleanly.
import { Popover } from "@rind-ui/react"
import { act, render, screen, waitFor } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { StrictMode } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"

afterEach(() => vi.restoreAllMocks())

const tree = (defaultOpen = true) => (
  <>
    <button type="button">Page button</button>
    <Popover.Root defaultOpen={defaultOpen} id="p">
      <Popover.Trigger>Filters</Popover.Trigger>
      <Popover.Positioner>
        <Popover.Content>
          <Popover.Title>Filters</Popover.Title>
          <Popover.Description>Narrow the list.</Popover.Description>
          <label>
            Search <input />
          </label>
          <Popover.CloseTrigger>Done</Popover.CloseTrigger>
        </Popover.Content>
      </Popover.Positioner>
    </Popover.Root>
  </>
)

const ids = (root: ParentNode) =>
  [...root.querySelectorAll("[id]")].map((e) => e.id).filter((id) => id.includes("popover"))

describe("Popover hydration", () => {
  it("server markup: open content, parts carry ids derived from the root", () => {
    const box = document.createElement("div")
    box.innerHTML = renderToString(tree())
    const content = box.querySelector<HTMLElement>('[role="dialog"]')
    expect(content?.getAttribute("data-state")).toBe("open")
    const trigger = box.querySelector<HTMLElement>('[data-part="trigger"]')
    expect(trigger?.getAttribute("aria-expanded")).toBe("true")
    expect(trigger?.getAttribute("aria-haspopup")).toBe("dialog")
    expect(box.querySelector("h2")?.id).toBeTruthy()
    expect(box.querySelector("p")?.id).toBeTruthy()
  })

  it("server markup: closed popover renders the trigger only, not expanded", () => {
    const box = document.createElement("div")
    box.innerHTML = renderToString(tree(false))
    expect(box.querySelector('[role="dialog"]')).toBeNull()
    const trigger = box.querySelector<HTMLElement>('[data-part="trigger"]')
    expect(trigger?.getAttribute("aria-expanded")).toBe("false")
    expect(trigger?.hasAttribute("aria-controls")).toBe(false)
  })

  it.each([false, true])(
    "hydrates silently with the same ids, then opens (focus inside) and closes with Escape (strict=%s)",
    async (strict) => {
      const wrap = (ui: ReturnType<typeof tree>) => (strict ? <StrictMode>{ui}</StrictMode> : ui)
      const container = document.createElement("div")
      container.innerHTML = renderToString(wrap(tree()))
      document.body.append(container)
      const serverIds = ids(container)
      expect(serverIds.length).toBeGreaterThan(0)
      const error = vi.spyOn(console, "error").mockImplementation(() => {})
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
      let root: ReturnType<typeof hydrateRoot> | undefined
      await act(async () => {
        root = hydrateRoot(container, wrap(tree()), {
          onRecoverableError: (e) => error(String(e)),
        })
      })
      const content = () => container.querySelector<HTMLElement>('[role="dialog"]')
      await waitFor(() => expect(content()?.contains(document.activeElement)).toBe(true))
      const state = {
        calls: [...error.mock.calls, ...warn.mock.calls].map((c) => String(c[0]).slice(0, 160)),
        ids: ids(container),
        open: content()?.getAttribute("data-state"),
        expanded: container.querySelector('[data-part="trigger"]')?.getAttribute("aria-expanded"),
        named: [
          content()?.getAttribute("aria-labelledby"),
          content()?.getAttribute("aria-describedby"),
        ],
        parts: [container.querySelector("h2")?.id, container.querySelector("p")?.id],
        pageInert:
          container.querySelector("button")?.closest("[inert]") !== null ||
          container.querySelector("button")?.inert === true,
      }
      await userEvent.setup().keyboard("{Escape}")
      await waitFor(() => expect(container.querySelector('[role="dialog"]')).toBeNull())
      const trigger = container.querySelector<HTMLElement>('[data-part="trigger"]')
      await waitFor(() => expect(document.activeElement).toBe(trigger))
      const afterEscape = trigger?.getAttribute("aria-expanded")
      await act(async () => root?.unmount())
      container.remove()
      expect(state.calls, `strict=${strict}`).toEqual([])
      expect(state.ids).toEqual(serverIds)
      expect(state.open).toBe("open")
      expect(state.expanded).toBe("true")
      expect(state.named).toEqual(state.parts)
      // Non-modal: the page stays usable
      expect(state.pageInert).toBe(false)
      expect(afterEscape).toBe("false")
    },
  )

  it("StrictMode: a client-only popover opens and closes without leaving layers behind", async () => {
    const user = userEvent.setup()
    render(<StrictMode>{tree(false)}</StrictMode>)
    const trigger = screen.getByRole("button", { name: "Filters" })
    await act(async () => trigger.click())
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeNull())
    expect(trigger.getAttribute("aria-expanded")).toBe("true")
    await user.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(trigger.getAttribute("aria-expanded")).toBe("false")
    await act(async () => trigger.click())
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeNull())
  })
})
