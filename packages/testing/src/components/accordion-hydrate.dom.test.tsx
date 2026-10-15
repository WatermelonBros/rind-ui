// Accordion server markup hydrates with no warnings; initially open items do not animate
// (kobalte#226, reka-ui#978).
import { Accordion } from "@rind-ui/react"
import { act } from "@testing-library/react"
import type { ReactNode } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"

afterEach(() => vi.restoreAllMocks())

const HEIGHT = "--rind-accordion-content-height"
const tree = (): ReactNode => (
  <Accordion.Root defaultValue={["b"]}>
    {["a", "b", "c"].map((v) => (
      <Accordion.Item key={v} value={v}>
        <Accordion.Header>
          <Accordion.Trigger>Item {v}</Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Content>Text {v}</Accordion.Content>
      </Accordion.Item>
    ))}
  </Accordion.Root>
)

describe("Accordion hydration", () => {
  it("server HTML has b open and the others hidden; hydrates with zero warnings", async () => {
    const node = tree()
    const container = document.createElement("div")
    container.innerHTML = renderToString(node)
    document.body.append(container)

    const contents = (root: ParentNode) =>
      Array.from(root.querySelectorAll<HTMLElement>('[data-part="content"]'))
    const triggers = (root: ParentNode) =>
      Array.from(root.querySelectorAll<HTMLElement>('[data-part="trigger"]'))
    const server = {
      hidden: contents(container).map((c) => c.hasAttribute("hidden")),
      expanded: triggers(container).map((t) => t.getAttribute("aria-expanded")),
      heights: contents(container).map((c) => c.style.getPropertyValue(HEIGHT)),
    }
    expect(server.hidden).toEqual([true, false, true])
    expect(server.expanded).toEqual(["false", "true", "false"])
    expect(server.heights[1]).toBe("auto")

    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    let root: ReturnType<typeof hydrateRoot> | undefined
    await act(async () => {
      root = hydrateRoot(container, node, { onRecoverableError: (e) => error(String(e)) })
    })
    expect([...error.mock.calls, ...warn.mock.calls]).toEqual([])
    expect(triggers(container).map((t) => t.getAttribute("aria-expanded"))).toEqual([
      "false",
      "true",
      "false",
    ])
    const [, b] = contents(container)
    expect(b?.hasAttribute("hidden")).toBe(false)
    expect(b?.style.getPropertyValue(HEIGHT)).toBe("auto")
    await act(async () => root?.unmount())
    container.remove()
  })
})

describe("review fixes (add-accordion r1)", () => {
  it("a consumer trigger id is in the server HTML and labels the open region", () => {
    const html = renderToString(
      <Accordion.Root defaultValue={["s"]}>
        <Accordion.Item value="s">
          <Accordion.Header>
            <Accordion.Trigger id="faq-shipping">Shipping</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content>Body</Accordion.Content>
        </Accordion.Item>
      </Accordion.Root>,
    )
    const box = document.createElement("div")
    box.innerHTML = html
    expect(box.querySelector("button")?.id).toBe("faq-shipping")
    expect(box.querySelector("[data-part=content]")?.getAttribute("aria-labelledby")).toBe(
      "faq-shipping",
    )
  })
})
