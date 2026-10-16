// Tooltip server markup (spec "Description And Label Wiring"): the trigger references the
// content only once the content is mounted, so the server markup never has a dangling IDREF
// (a portalled content is not rendered on the server at all). After hydration the reference
// exists, the tooltip behaves, and hydration is silent. StrictMode double effects mount and
// unmount cleanly.
import { Tooltip } from "@rind-ui/react"
import { act, render, screen, waitFor } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { StrictMode } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"

afterEach(() => vi.restoreAllMocks())

const tree = ({ portal = true, type = "description" as "description" | "label" } = {}) => {
  const body = (
    <Tooltip.Positioner>
      <Tooltip.Content>Delete permanently</Tooltip.Content>
    </Tooltip.Positioner>
  )
  return (
    <>
      <button type="button">Page button</button>
      <Tooltip.Root id="t" type={type} openDelay={0}>
        <Tooltip.Trigger aria-describedby="hint">Delete</Tooltip.Trigger>
        {portal ? <Tooltip.Portal>{body}</Tooltip.Portal> : body}
      </Tooltip.Root>
      <p id="hint">Hint</p>
    </>
  )
}

/** Every IDREF in `root` that points at nothing. */
function dangling(root: ParentNode) {
  const out: string[] = []
  for (const attr of ["aria-describedby", "aria-labelledby", "aria-controls"]) {
    for (const el of root.querySelectorAll(`[${attr}]`)) {
      for (const id of (el.getAttribute(attr) ?? "").split(/\s+/).filter(Boolean)) {
        if (!el.ownerDocument.getElementById(id)) out.push(`${attr}=${id}`)
      }
    }
  }
  return out
}

describe("Tooltip hydration", () => {
  it("server markup: a portalled content is not rendered and the trigger has no dangling reference", () => {
    const box = document.createElement("div")
    document.body.append(box)
    box.innerHTML = renderToString(tree())
    const trigger = box.querySelector<HTMLElement>('[data-part="trigger"]')
    expect(trigger?.getAttribute("data-state")).toBe("closed")
    expect(box.querySelector('[data-part="content"]')).toBeNull()
    // the consumer's own reference stays; the tooltip adds none yet
    expect(trigger?.getAttribute("aria-describedby")).toBe("hint")
    expect(dangling(box)).toEqual([])
    box.remove()
  })

  it.each(["description", "label"] as const)(
    "server markup: inline %s content is hidden, referenced only after mount",
    (type) => {
      const box = document.createElement("div")
      document.body.append(box)
      box.innerHTML = renderToString(tree({ portal: false, type }))
      const content = box.querySelector<HTMLElement>('[data-part="content"]')
      expect(content?.hasAttribute("hidden")).toBe(true)
      expect(content?.getAttribute("data-state")).toBe("closed")
      const trigger = box.querySelector<HTMLElement>('[data-part="trigger"]')
      // Not referenced on the server: no IDREF could dangle if the client renders differently.
      expect(trigger?.getAttribute("aria-labelledby")).toBeNull()
      expect(dangling(box)).toEqual([])
      box.remove()
    },
  )

  it.each([
    [false, true],
    [true, true],
    [false, false],
    [true, false],
  ])(
    "hydrates silently, adds the reference once the content mounts, then behaves (strict=%s, portal=%s)",
    async (strict, portal) => {
      const wrap = (ui: ReturnType<typeof tree>) => (strict ? <StrictMode>{ui}</StrictMode> : ui)
      const container = document.createElement("div")
      container.innerHTML = renderToString(wrap(tree({ portal })))
      document.body.append(container)
      const serverTriggerId = container.querySelector('[data-part="trigger"]')?.id
      expect(serverTriggerId).toBeTruthy()
      const error = vi.spyOn(console, "error").mockImplementation(() => {})
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
      let root: ReturnType<typeof hydrateRoot> | undefined
      await act(async () => {
        root = hydrateRoot(container, wrap(tree({ portal })), {
          onRecoverableError: (e) => error(String(e)),
        })
      })
      const trigger = container.querySelector<HTMLElement>('[data-part="trigger"]') as HTMLElement
      await waitFor(() => expect(trigger.getAttribute("aria-describedby")).toContain("hint "))
      const ids = trigger.getAttribute("aria-describedby")?.split(" ") ?? []
      expect(ids[0]).toBe("hint")
      const content = document.getElementById(ids[1] ?? "")
      expect(content?.getAttribute("role")).toBe("tooltip")
      expect(content?.hasAttribute("hidden")).toBe(true)
      expect(trigger.id).toBe(serverTriggerId)
      expect(dangling(document.body)).toEqual([])
      expect(
        [...error.mock.calls, ...warn.mock.calls].map((c) => String(c[0]).slice(0, 200)),
        `strict=${strict} portal=${portal}`,
      ).toEqual([])
      // It behaves: keyboard focus opens it, Escape closes it
      const user = userEvent.setup()
      await act(() => user.tab()) // page button
      await act(() => user.tab()) // trigger
      expect(document.activeElement).toBe(trigger)
      await waitFor(() => expect(content?.getAttribute("data-state")).toBe("open"))
      await act(() => user.keyboard("{Escape}"))
      expect(content?.getAttribute("data-state")).toBe("closed")
      await act(async () => root?.unmount())
      container.remove()
    },
  )

  it("StrictMode: a client-only tooltip mounts, opens and closes without leaving layers behind", async () => {
    const user = userEvent.setup()
    render(<StrictMode>{tree()}</StrictMode>)
    const trigger = screen.getByRole("button", { name: "Delete" })
    await waitFor(() => expect(trigger.getAttribute("aria-describedby")).toContain("hint "))
    await act(async () => trigger.focus())
    await act(() => user.keyboard("{Shift>}{Tab}{/Shift}"))
    await act(() => user.tab())
    expect(document.activeElement).toBe(trigger)
    const content = document.getElementById(
      trigger.getAttribute("aria-describedby")?.split(" ").at(-1) ?? "",
    )
    await waitFor(() => expect(content?.getAttribute("data-state")).toBe("open"))
    await act(() => user.keyboard("{Escape}"))
    expect(content?.getAttribute("data-state")).toBe("closed")
    await act(() => user.tab())
    await act(() => user.tab({ shift: true }))
    await waitFor(() => expect(content?.getAttribute("data-state")).toBe("open"))
    // exactly one content element: the Strict Mode remount did not duplicate it
    expect(document.querySelectorAll('[data-part="content"]')).toHaveLength(1)
  })

  it("unmounting removes the portal host content and every reference to it", async () => {
    const { unmount } = render(tree())
    await waitFor(() => expect(document.querySelector('[data-part="content"]')).not.toBeNull())
    unmount()
    expect(document.querySelector('[data-part="content"]')).toBeNull()
  })
})
