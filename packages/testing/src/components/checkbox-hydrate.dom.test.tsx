// Checkbox server markup: the hidden input is rendered on the server and hydrates cleanly.
import { CheckboxGroup } from "@rind-ui/react"
import { act } from "@testing-library/react"
import type { ReactNode } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"

afterEach(() => vi.restoreAllMocks())

const tree = (props: { defaultChecked?: boolean | "indeterminate"; name?: string } = {}) => (
  <form>
    <CheckboxGroup.Item name="terms" {...props}>
      <CheckboxGroup.ItemControl>
        <CheckboxGroup.ItemIndicator>✓</CheckboxGroup.ItemIndicator>
      </CheckboxGroup.ItemControl>
      <CheckboxGroup.ItemLabel>Accept terms</CheckboxGroup.ItemLabel>
    </CheckboxGroup.Item>
  </form>
)

async function hydrate(node: ReactNode) {
  const container = document.createElement("div")
  const html = renderToString(node)
  container.innerHTML = html
  document.body.append(container)
  const error = vi.spyOn(console, "error").mockImplementation(() => {})
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
  let root: ReturnType<typeof hydrateRoot> | undefined
  await act(async () => {
    root = hydrateRoot(container, node, { onRecoverableError: (e) => error(String(e)) })
  })
  const input = container.querySelector<HTMLInputElement>('[data-part="hidden-input"]')
  const after = { checked: input?.checked, indeterminate: input?.indeterminate }
  const calls = [...error.mock.calls, ...warn.mock.calls]
  await act(async () => root?.unmount())
  container.remove()
  return { html, calls, after }
}

describe("Checkbox hydration", () => {
  it("server HTML has the hidden input with name and checked, and submits before hydration", () => {
    const html = renderToString(tree({ defaultChecked: true }))
    const box = document.createElement("div")
    box.innerHTML = html
    const input = box.querySelector<HTMLInputElement>('input[data-part="hidden-input"]')
    expect(input?.getAttribute("name")).toBe("terms")
    expect(input?.hasAttribute("checked")).toBe(true)
    expect(input?.getAttribute("aria-hidden")).toBe("true")
    // A form submitted before hydration: the parsed server HTML is a real form.
    const form = box.querySelector("form") as HTMLFormElement
    expect([...new FormData(form)]).toEqual([["terms", "on"]])
  })

  it("an unchecked server render submits nothing", () => {
    const box = document.createElement("div")
    box.innerHTML = renderToString(tree())
    expect([...new FormData(box.querySelector("form") as HTMLFormElement)]).toEqual([])
  })

  it("hydrates a checked Checkbox with zero console errors", async () => {
    const { calls, after } = await hydrate(tree({ defaultChecked: true }))
    expect(calls).toEqual([])
    expect(after).toEqual({ checked: true, indeterminate: false })
  })

  it("an indeterminate default is set on the input right after hydration", async () => {
    const { html, calls, after } = await hydrate(tree({ defaultChecked: "indeterminate" }))
    expect(calls).toEqual([])
    // The property has no attribute: the server cannot render it.
    expect(html).not.toMatch(/<input[^>]*checked/)
    expect(after).toEqual({ checked: false, indeterminate: true })
  })

  it("an unnamed Checkbox still renders an identified hidden input on the server", () => {
    const box = document.createElement("div")
    box.innerHTML = renderToString(
      <CheckboxGroup.Item>
        <CheckboxGroup.ItemControl aria-label="x" />
      </CheckboxGroup.Item>,
    )
    expect(box.querySelector("input")?.id).toBeTruthy()
  })
})
