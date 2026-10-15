// Checkbox Group server markup: a defaultValue renders checked on the server and hydrates
// cleanly (bits-ui#1249).
import { Checkbox, CheckboxGroup } from "@rind-ui/react"
import { act } from "@testing-library/react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"

afterEach(() => vi.restoreAllMocks())

const tree = (
  <form>
    <CheckboxGroup.Root name="t" defaultValue={["b"]}>
      <CheckboxGroup.Label>Toppings</CheckboxGroup.Label>
      {["a", "b", "c"].map((v) => (
        <Checkbox.Root key={v} value={v}>
          <Checkbox.Control />
          <Checkbox.Label>{v.toUpperCase()}</Checkbox.Label>
        </Checkbox.Root>
      ))}
    </CheckboxGroup.Root>
  </form>
)

describe("Checkbox Group hydration", () => {
  it("item b is checked in the server HTML", () => {
    const box = document.createElement("div")
    box.innerHTML = renderToString(tree)
    const controls = [...box.querySelectorAll('[role="checkbox"]')]
    expect(controls.map((c) => c.getAttribute("aria-checked"))).toEqual(["false", "true", "false"])
  })

  it("submits the default value before hydration (hidden input rendered checked)", () => {
    const box = document.createElement("div")
    box.innerHTML = renderToString(tree)
    expect([...new FormData(box.querySelector("form") as HTMLFormElement)]).toEqual([["t", "b"]])
  })

  it("hydrates with no console error or warning", async () => {
    const container = document.createElement("div")
    container.innerHTML = renderToString(tree)
    document.body.append(container)
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    let root: ReturnType<typeof hydrateRoot> | undefined
    await act(async () => {
      root = hydrateRoot(container, tree, { onRecoverableError: (e) => error(String(e)) })
    })
    expect([...error.mock.calls, ...warn.mock.calls]).toEqual([])
    const checked = [...container.querySelectorAll('[role="checkbox"]')].map((c) =>
      c.getAttribute("aria-checked"),
    )
    expect(checked).toEqual(["false", "true", "false"])
    await act(async () => root?.unmount())
    container.remove()
  })
})
