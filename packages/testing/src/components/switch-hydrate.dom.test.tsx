// Switch server markup: the hidden input is rendered on the server and hydrates cleanly.
import { Switch } from "@rind-ui/react"
import { act } from "@testing-library/react"
import type { ReactNode } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"

afterEach(() => vi.restoreAllMocks())

const tree = (props: { defaultChecked?: boolean } = {}) => (
  <form>
    <Switch.Root name="wifi" {...props}>
      <Switch.Control>
        <Switch.Thumb />
      </Switch.Control>
      <Switch.Label>Wi-Fi</Switch.Label>
    </Switch.Root>
  </form>
)

async function hydrate(node: ReactNode) {
  const container = document.createElement("div")
  container.innerHTML = renderToString(node)
  document.body.append(container)
  const error = vi.spyOn(console, "error").mockImplementation(() => {})
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
  let root: ReturnType<typeof hydrateRoot> | undefined
  await act(async () => {
    root = hydrateRoot(container, node, { onRecoverableError: (e) => error(String(e)) })
  })
  const input = container.querySelector<HTMLInputElement>('[data-part="hidden-input"]')
  const after = { checked: input?.checked }
  const calls = [...error.mock.calls, ...warn.mock.calls]
  await act(async () => root?.unmount())
  container.remove()
  return { calls, after }
}

describe("Switch hydration", () => {
  it("server HTML carries name and checked, and submits before hydration", () => {
    const box = document.createElement("div")
    box.innerHTML = renderToString(tree({ defaultChecked: true }))
    const input = box.querySelector<HTMLInputElement>('input[data-part="hidden-input"]')
    expect(input?.getAttribute("name")).toBe("wifi")
    expect(input?.hasAttribute("checked")).toBe(true)
    expect(input?.getAttribute("aria-hidden")).toBe("true")
    expect([...new FormData(box.querySelector("form") as HTMLFormElement)]).toEqual([
      ["wifi", "on"],
    ])
  })

  it("an unchecked server render submits nothing", () => {
    const box = document.createElement("div")
    box.innerHTML = renderToString(tree())
    expect([...new FormData(box.querySelector("form") as HTMLFormElement)]).toEqual([])
  })

  it("hydrates a checked Switch with zero console errors", async () => {
    const { calls, after } = await hydrate(tree({ defaultChecked: true }))
    expect(calls).toEqual([])
    expect(after).toEqual({ checked: true })
  })
})
