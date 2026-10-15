// Server markup hydrates cleanly, and a label works before any JavaScript runs
// (kobalte#652, radix#1577).
import { Label } from "@rind-ui/react"
import { act, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { getLabel } from "../index"

afterEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ""
})

function serverContainer(tree: ReactNode) {
  const container = document.createElement("div")
  container.innerHTML = renderToString(tree)
  document.body.append(container)
  return container
}

async function hydrate(tree: ReactNode) {
  const container = serverContainer(tree)
  const before = container.innerHTML
  const error = vi.spyOn(console, "error").mockImplementation(() => {})
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
  let root: ReturnType<typeof hydrateRoot> | undefined
  await act(async () => {
    root = hydrateRoot(container, tree, { onRecoverableError: (e) => error(String(e)) })
  })
  const calls = [...error.mock.calls, ...warn.mock.calls]
  const after = container.innerHTML
  await act(async () => root?.unmount())
  return { calls, before, after }
}

describe("Label hydration", () => {
  const trees: Record<string, () => ReactNode> = {
    "for an input": () => (
      <>
        <Label htmlFor="email">Email</Label>
        <input id="email" />
      </>
    ),
    wrapping: () => (
      <Label>
        Name <input />
      </Label>
    ),
    "generated id": () => <Label>Plain</Label>,
    "render span": () => (
      <>
        <Label htmlFor="c" render={<span />}>
          Colour
        </Label>
        <input id="c" />
      </>
    ),
  }
  it.each(Object.keys(trees))("%s hydrates with no warning and the same markup", async (name) => {
    const { calls, before, after } = await hydrate(trees[name]?.())
    expect(calls).toEqual([])
    expect(after).toBe(before)
  })

  it("the generated id is the server's id after hydration", async () => {
    const tree = <Label>Plain</Label>
    const container = serverContainer(tree)
    const serverId = screen.getByText("Plain").id
    let root: ReturnType<typeof hydrateRoot> | undefined
    await act(async () => {
      root = hydrateRoot(container, tree)
    })
    expect(screen.getByText("Plain").id).toBe(serverId)
    expect(serverId).not.toBe("")
    await act(async () => root?.unmount())
  })

  it("a click before hydration focuses the input natively", async () => {
    serverContainer(
      <>
        <Label htmlFor="email">Email</Label>
        <input id="email" />
      </>,
    )
    expect(screen.getByText("Email").getAttribute("for")).toBe("email")
    const label = getLabel(screen, { text: "Email" })
    await label.click()
    expect(document.activeElement).toBe(document.getElementById("email"))
    expect(await label.isControlFocused()).toBe(true)
  })
})
