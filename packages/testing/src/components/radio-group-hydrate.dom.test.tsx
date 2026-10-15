// Radio Group server markup (spec "Server render", base-ui#5597): the labelled root, the
// tab stop and the submitted value exist before hydration, and hydrate without a warning.
import { RadioGroup } from "@rind-ui/react"
import { act } from "@testing-library/react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"

afterEach(() => vi.restoreAllMocks())

const tree = (
  <form>
    <RadioGroup.Root name="size" defaultValue="m">
      <RadioGroup.Label>Size</RadioGroup.Label>
      {["s", "m", "l"].map((v) => (
        <RadioGroup.Item key={v} value={v}>
          <RadioGroup.ItemControl>
            <RadioGroup.ItemIndicator />
          </RadioGroup.ItemControl>
          <RadioGroup.ItemLabel>{v.toUpperCase()}</RadioGroup.ItemLabel>
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  </form>
)

const parse = () => {
  const box = document.createElement("div")
  box.innerHTML = renderToString(tree)
  return box
}

describe("Radio Group hydration", () => {
  it("the server HTML labels the root and makes the checked radio the tab stop", () => {
    const box = parse()
    const root = box.querySelector('[role="radiogroup"]') as HTMLElement
    const label = box.querySelector('[data-part="label"]') as HTMLElement
    expect(label.id).toBeTruthy()
    expect(root.getAttribute("aria-labelledby")).toBe(label.id)
    const controls = [...box.querySelectorAll<HTMLElement>('[role="radio"]')]
    expect(controls.map((c) => c.getAttribute("aria-checked"))).toEqual(["false", "true", "false"])
    expect(controls.map((c) => c.getAttribute("tabindex"))).toEqual(["-1", "0", "-1"])
  })

  it("a form submitted before hydration contains size=m", () => {
    const form = parse().querySelector("form") as HTMLFormElement
    expect([...new FormData(form)]).toEqual([["size", "m"]])
  })

  it("hydrates with zero console errors or warnings", async () => {
    const container = document.createElement("div")
    container.innerHTML = renderToString(tree)
    document.body.append(container)
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    let root: ReturnType<typeof hydrateRoot> | undefined
    await act(async () => {
      root = hydrateRoot(container, tree, { onRecoverableError: (e) => error(String(e)) })
    })
    const calls = [...error.mock.calls, ...warn.mock.calls]
    const tabbable = [...container.querySelectorAll<HTMLElement>('[role="radio"]')].filter(
      (r) => r.tabIndex === 0,
    )
    const inputs = [...container.querySelectorAll<HTMLInputElement>('[data-part="hidden-input"]')]
    await act(async () => root?.unmount())
    container.remove()
    expect(calls).toEqual([])
    expect(tabbable.map((r) => r.getAttribute("aria-checked"))).toEqual(["true"])
    expect(inputs.map((i) => i.checked)).toEqual([false, true, false])
  })
})
