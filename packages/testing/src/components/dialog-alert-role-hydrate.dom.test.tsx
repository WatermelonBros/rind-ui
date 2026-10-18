// Alert Dialog server markup (it follows the Dialog's "Server Rendering"): an inline alert dialog
// with `defaultOpen` renders open with the client's ids; hydration is silent, inerts the page and
// focuses Cancel.
import { Dialog } from "@rind-ui/react"
import { act, waitFor } from "@testing-library/react"
import { StrictMode } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"

afterEach(() => vi.restoreAllMocks())

const tree = () => (
  <>
    <button type="button">Page button</button>
    <Dialog.Root role="alertdialog" defaultOpen id="d">
      <Dialog.Trigger>Open</Dialog.Trigger>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.Title>Delete project?</Dialog.Title>
          <Dialog.Description>This cannot be undone.</Dialog.Description>
          <Dialog.Cancel>Cancel</Dialog.Cancel>
          <Dialog.Action>Delete</Dialog.Action>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  </>
)

const ids = (root: ParentNode) =>
  [...root.querySelectorAll("[id]")].map((e) => e.id).filter((id) => id.startsWith("dialog-"))

describe("Alert Dialog hydration", () => {
  it("server markup: content open, parts carry ids derived from the root", () => {
    const box = document.createElement("div")
    box.innerHTML = renderToString(tree())
    const content = box.querySelector<HTMLElement>('[role="alertdialog"]')
    expect(content?.getAttribute("data-state")).toBe("open")
    const title = box.querySelector("h2")
    const description = box.querySelector("p")
    expect(title?.id).toBeTruthy()
    expect(description?.id).toBeTruthy()
  })

  it.each([false, true])(
    "hydrates silently with the same ids, then the page is inert and focus is inside (strict=%s)",
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
      const content0 = () => container.querySelector<HTMLElement>('[role="alertdialog"]')
      await waitFor(() => expect(content0()?.contains(document.activeElement)).toBe(true))
      const calls = [...error.mock.calls, ...warn.mock.calls]
      const content = container.querySelector<HTMLElement>('[role="alertdialog"]')
      const pageButton = container.querySelector("button")
      const state = {
        calls,
        ids: ids(container),
        open: content?.getAttribute("data-state"),
        inert: pageButton?.closest("[inert]") !== null || pageButton?.inert === true,
        named: [
          content?.getAttribute("aria-labelledby"),
          content?.getAttribute("aria-describedby"),
        ],
        parts: [container.querySelector("h2")?.id, container.querySelector("p")?.id],
        cancelFocused: document.activeElement?.getAttribute("data-part") === "cancel",
        active: document.activeElement?.outerHTML,
        focusInside: content?.contains(document.activeElement) === true,
      }
      await act(async () => root?.unmount())
      container.remove()
      expect(
        state.calls.map((c) => String(c).slice(0, 160)),
        `strict=${strict}`,
      ).toEqual([])
      expect(state.ids).toEqual(serverIds)
      expect(state.open).toBe("open")
      expect(state.inert).toBe(true)
      expect(state.named).toEqual(state.parts)
      expect(state.focusInside, state.active).toBe(true)
      expect(state.cancelFocused, state.active).toBe(true)
    },
  )
})
